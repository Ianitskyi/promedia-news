import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source = readFileSync(new URL('../public/js/promedia-network-promo.js', import.meta.url), 'utf8');
const browser = {};
runInNewContext(source, {window: browser});
const {choosePromo} = browser.ProMediaNetworkPromo;

test('Network banners never advertise vacancies or their own host in any language', () => {
  const hosts = ['promedia.report','www.promedia.report','projects.promedia.report','atlas.promedia.report','communities.promedia.report','ratings.promedia.report','research.promedia.report','guide.promedia.report','jobs.promedia.report','events.promedia.report','brief.promedia.report','santa.promedia.report'];
  for (const host of hosts) for (const lang of ['uk','en','crh']) {
    const promo = choosePromo(host, lang, lang === 'uk' ? '/' : '/' + lang + '/');
    assert.ok(promo, `${host} ${lang}`);
    const target = new URL(promo.href);
    assert.notEqual(target.hostname, host.replace(/^www\./, ''));
    assert.notEqual(target.hostname, 'jobs.promedia.report');
    assert.equal(target.pathname, lang === 'uk' ? '/' : '/' + lang + '/');
    assert.ok(promo.copy.every(value => typeof value === 'string' && value.length > 0));
  }
});

test('Public sites get contextual destinations while news and internal tools keep their own layout', () => {
  assert.equal(choosePromo('atlas.promedia.report','uk','/').id, 'research');
  assert.equal(choosePromo('ratings.promedia.report','uk','/').id, 'atlas');
  assert.equal(choosePromo('communities.promedia.report','uk','/').id, 'research');
  assert.equal(choosePromo('research.promedia.report','uk','/').id, 'communities');
  assert.equal(choosePromo('santa.promedia.report','uk','/').id, 'projects');
  for (const host of ['news.promedia.report','money.promedia.report','localhost','example.com']) assert.equal(choosePromo(host,'uk','/'), null);
});

test('Administrative, account and registration routes receive no network banner', () => {
  for (const path of ['/admin','/admin/articles','/en/admin/','/api/health','/login','/auth/callback','/dashboard','/manage/123','/register','/registration/1','/check-in/1']) {
    assert.equal(choosePromo('events.promedia.report','en',path), null, path);
  }
});
