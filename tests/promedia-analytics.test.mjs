import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source = readFileSync(new URL('../public/js/promedia-analytics.js', import.meta.url), 'utf8');

function element(tag) {
  const el = {tagName: tag, children: [], attrs: {}, style: {}, textContent: ''};
  el.setAttribute = (k, v) => { el.attrs[k] = String(v); };
  el.getAttribute = (k) => (k in el.attrs ? el.attrs[k] : null);
  el.appendChild = (child) => { el.children.push(child); return child; };
  el.remove = () => { el.removed = true; };
  return el;
}

function run({href, lang = 'uk', cookie = '', metas = {}, storage = {}, popupOpen = false}) {
  const url = new URL(href);
  const head = element('head');
  const body = element('body');
  const cookies = [];
  const document = {
    readyState: 'complete',
    head, body,
    documentElement: {lang},
    get cookie() { return cookie; },
    set cookie(value) { cookies.push(value); },
    createElement: element,
    getElementById: () => null,
    querySelector: (selector) => (selector in metas ? {getAttribute: () => metas[selector]} : (popupOpen && selector.includes('pm-language-suggest') ? {} : null)),
    querySelectorAll: () => [],
    addEventListener: () => {}
  };
  const store = {...storage};
  let timers = 0;
  const window = {
    document,
    location: {hostname: url.hostname, pathname: url.pathname, search: url.search},
    sessionStorage: {getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; }},
    setTimeout: (fn) => { if (timers++ < 5) fn(); }
  };
  runInNewContext(source, {window, URLSearchParams});
  const calls = (window.dataLayer || []).map((args) => Array.from(args));
  const scripts = head.children.filter((child) => child.tagName === 'script');
  const notice = body.children.find((child) => child.id === 'pm-analytics-notice');
  return {window, calls, scripts, notice, cookies};
}

const pure = (() => { const w = {}; runInNewContext(source, {window: w}); return w.ProMediaAnalytics; })();

test('GA loads only on promedia.report and its subdomains', () => {
  for (const host of ['promedia.report', 'news.promedia.report', 'atlas.promedia.report', 'brief.promedia.report', 'NEWS.PROMEDIA.REPORT']) {
    assert.equal(pure.isProductionHost(host), true, host);
  }
  for (const host of ['www.promedia.report', 'localhost', '127.0.0.1', 'promedia-news.ianitskyi.workers.dev', 'staging.promedia-news.workers.dev', 'promedia.report.evil.com', 'evilpromedia.report', 'promedia-atlas.ianitskyi.chatgpt.site', '']) {
    assert.equal(pure.isProductionHost(host), false, host);
  }
});

test('site_section is derived from the host', () => {
  assert.equal(pure.siteSection('promedia.report'), 'main');
  assert.equal(pure.siteSection('news.promedia.report'), 'news');
  assert.equal(pure.siteSection('ratings.promedia.report'), 'ratings');
  assert.equal(pure.siteSection('santa.promedia.report'), 'santa');
  assert.equal(pure.siteSection('labs.promedia.report'), 'labs');
  assert.equal(pure.siteSection('localhost'), 'other');
});

test('content_language follows the path prefix, then <html lang>', () => {
  assert.equal(pure.contentLanguage('/en/article/x', 'uk'), 'en');
  assert.equal(pure.contentLanguage('/crh/', 'uk'), 'crh');
  assert.equal(pure.contentLanguage('/research/report-crh.html', 'crh'), 'crh');
  assert.equal(pure.contentLanguage('/', 'en-GB'), 'en');
  assert.equal(pure.contentLanguage('/english-news', ''), 'uk');
});

test('content_type covers articles, projects, vacancies, tools and pages', () => {
  assert.equal(pure.contentType('news', '/article/winter'), 'article');
  assert.equal(pure.contentType('news', '/en/article/winter'), 'article');
  assert.equal(pure.contentType('news', '/'), 'page');
  assert.equal(pure.contentType('projects', '/project/media-atlas'), 'project');
  assert.equal(pure.contentType('main', '/projects/media-atlas'), 'project');
  assert.equal(pure.contentType('main', '/projects/category/research'), 'page');
  assert.equal(pure.contentType('jobs', '/vacancy.html'), 'vacancy');
  assert.equal(pure.contentType('jobs', '/'), 'page');
  assert.equal(pure.contentType('atlas', '/media/123'), 'tool');
  assert.equal(pure.contentType('research', '/research/engaged-journalism.html'), 'article');
  assert.equal(pure.contentType('santa', '/', {ogType: 'article'}), 'article');
  assert.equal(pure.contentType('news', '/', {declared: 'tool'}), 'tool');
  assert.equal(pure.contentType('news', '/', {declared: 'nonsense'}), 'page');
});

test('production article page sends one config with section, type, language and publish date', () => {
  const {calls, scripts, window} = run({
    href: 'https://news.promedia.report/article/winter',
    metas: {'meta[property="og:type"]': 'article', 'meta[property="article:published_time"]': '2026-11-01T10:00:00Z'}
  });
  assert.equal(scripts.length, 1);
  assert.match(scripts[0].src, /googletagmanager\.com\/gtag\/js\?id=G-D8TM22QR9R$/);
  const config = calls.find((c) => c[0] === 'config');
  assert.equal(config[1], 'G-D8TM22QR9R');
  assert.equal(config[2].cookie_domain, 'auto');
  assert.equal(config[2].site_section, 'news');
  assert.equal(config[2].content_type, 'article');
  assert.equal(config[2].content_language, 'uk');
  assert.equal(config[2].publish_date, '2026-11-01');
  assert.equal(config[2].debug_mode, undefined);
  assert.equal('language' in config[2], false, 'must not override GA built-in language');
  const set = calls.find((c) => c[0] === 'set');
  assert.equal(set[1].site_section, 'news');
  assert.equal(typeof window.gtag, 'function');
});

test('author is taken only from article meta and never as a URL', () => {
  const a = run({href: 'https://news.promedia.report/article/x', metas: {'meta[property="og:type"]': 'article', 'meta[property="article:author"]': 'Катя Горчинська'}});
  assert.equal(a.calls.find((c) => c[0] === 'config')[2].author, 'Катя Горчинська');
  const b = run({href: 'https://news.promedia.report/article/x', metas: {'meta[property="og:type"]': 'article', 'meta[property="article:author"]': 'https://facebook.com/someone'}});
  assert.equal(b.calls.find((c) => c[0] === 'config')[2].author, undefined);
});

test('nothing is sent on localhost, workers.dev or www', () => {
  for (const href of ['http://localhost:8787/', 'http://127.0.0.1:8787/', 'https://promedia-news.ianitskyi.workers.dev/', 'https://www.promedia.report/']) {
    const {calls, scripts, notice} = run({href});
    assert.equal(scripts.length, 0, href);
    assert.equal(calls.length, 0, href);
    assert.equal(notice, undefined, href);
  }
});

test('?ga_debug=1 enables DebugView even on a staging host', () => {
  const {calls, scripts} = run({href: 'https://promedia-news.ianitskyi.workers.dev/?ga_debug=1'});
  assert.equal(scripts.length, 1);
  assert.equal(calls.find((c) => c[0] === 'config')[2].debug_mode, true);
});

test('opt-out cookie stops GA on every subdomain', () => {
  const {calls, scripts, window, notice} = run({href: 'https://ratings.promedia.report/', cookie: 'pm_analytics=denied; pm_analytics_notice=1'});
  assert.equal(scripts.length, 0);
  assert.equal(calls.length, 0);
  assert.equal(window['ga-disable-G-D8TM22QR9R'], true);
  assert.equal(notice, undefined);
  assert.equal(window.ProMediaAnalytics.isEnabled(), false);
});

test('notice waits while another network popup is open', () => {
  const blocked = run({href: 'https://atlas.promedia.report/', metas: {}, popupOpen: true});
  assert.equal(blocked.notice, undefined);
  assert.equal(blocked.scripts.length, 1, 'analytics itself is not delayed');
});

test('notice is shown once, in the page language, and opt-out writes a domain-wide cookie', () => {
  const first = run({href: 'https://atlas.promedia.report/en/', lang: 'en'});
  assert.ok(first.notice, 'notice shown on first visit');
  assert.equal(first.notice.attrs['aria-label'], 'Analytics notice');
  first.window.ProMediaAnalytics.optOut();
  assert.ok(first.cookies.some((c) => /^pm_analytics=denied;.*Domain=promedia\.report/.test(c)));
  assert.ok(first.cookies.some((c) => /^_ga=; Max-Age=0/.test(c)));
  const later = run({href: 'https://atlas.promedia.report/', cookie: 'pm_analytics_notice=1'});
  assert.equal(later.notice, undefined);
  assert.equal(later.scripts.length, 1);
});
