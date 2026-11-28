// Перевірка опублікованих сторінок новин (правило Андрія Яніцького, 28.11.2026):
// мало того, що сторінка відкривається — на ній має бути картка «Люди в матеріалі»
// для кожної людини з досьє, яка є в тегах (або стоїть у тексті напівжирним).
//
// Використання:
//   node scripts/check-article-pages.mjs <slug> [<slug> …]   — конкретні новини
//   node scripts/check-article-pages.mjs                      — новини з content/articles за останні 3 дні
// Код виходу 1, якщо якась сторінка не відкривається або бракує картки досьє.
import {readFileSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
import {addPersonTags} from '../src/lib/personTags.js';

const SITE = process.env.NEWS_SITE_URL || 'https://news.promedia.report';
const ARTICLES = 'content/articles';
const people = readdirSync('people/data').filter(f => f.endsWith('.json'))
  .map(f => JSON.parse(readFileSync(join('people/data', f), 'utf8')));
const key = t => String(t || '').normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('uk-UA');

const files = readdirSync(ARTICLES).filter(f => f.endsWith('.json'));
const bySlug = new Map(files.map(f => {
  const a = JSON.parse(readFileSync(join(ARTICLES, f), 'utf8'));
  return [a.slug, {file: f, a}];
}));

let slugs = process.argv.slice(2);
if (!slugs.length) {
  const since = new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10);
  slugs = [...bySlug.values()].filter(({file}) => file.slice(0, 10) >= since).map(({a}) => a.slug);
}

let failed = 0;
for (const slug of slugs) {
  const entry = bySlug.get(slug);
  if (!entry) { console.log(`::error::${slug}: no JSON in ${ARTICLES}`); failed++; continue; }
  const a = {...entry.a, tags: [...(entry.a.tags || [])]};
  if (a.publishAt && new Date(a.publishAt) > new Date()) { console.log(`${slug}: scheduled, skipped`); continue; }
  addPersonTags(a, people);
  const tagKeys = new Set(a.tags.map(key));
  const expected = people.filter(p => [p.name?.uk, ...(p.aliases || [])].some(n => tagKeys.has(key(n))));
  for (const lang of ['', '/en']) {
    const url = `${SITE}${lang}/article/${slug}?check=${Date.now()}`;
    let html = '', status = 0;
    try { const res = await fetch(url); status = res.status; html = await res.text(); } catch (e) { status = String(e.message); }
    if (status !== 200) { console.log(`::error::${lang || '/uk'} ${slug}: HTTP ${status}`); failed++; continue; }
    const missing = expected.filter(p => !new RegExp(`people-box-name"[^>]*/${p.slug}/`).test(html));
    if (missing.length) {
      console.log(`::error::${lang || '/uk'} ${slug}: no «Люди в матеріалі» card for ${missing.map(p => p.name.uk).join(', ')}`);
      failed++;
    } else {
      console.log(`${lang || '/uk'} ${slug}: OK${expected.length ? ` (досьє: ${expected.map(p => p.name.uk).join(', ')})` : ''}`);
    }
  }
}
process.exit(failed ? 1 : 0);
