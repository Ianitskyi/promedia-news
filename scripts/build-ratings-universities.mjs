// Довідник університетів з рейтингу журфаків (ratings.promedia.report) для картки
// «Університети в матеріалі» під новинами. Запуск:
//   node scripts/build-ratings-universities.mjs /шлях/до/Journalism2026
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const repo = process.argv[2];
if (!repo) throw Error('Вкажіть шлях до клону Ianitskyi/Journalism2026');
const files = readdirSync(join(repo, 'data')).filter(f => /^\d{4}-(current|\d{2}-\d{2})\.json$/.test(f)).sort();
const byId = new Map();
for (const f of files) {
  const snap = JSON.parse(readFileSync(join(repo, 'data', f), 'utf8'));
  const year = Number(f.slice(0, 4));
  for (const degree of ['bachelor', 'master']) {
    for (const r of snap[degree] || []) {
      const u = byId.get(r.id) || { id: r.id, name: r.name, nameEn: r.nameEn || '', short: r.short || '', ranks: {} };
      u.name = r.name || u.name; if (r.nameEn) u.nameEn = r.nameEn; if (r.short) u.short = r.short;
      if (r.rank != null && (!u.ranks[degree] || u.ranks[degree].year <= year)) u.ranks[degree] = { year, rank: r.rank, final: Boolean(snap.final) };
      byId.set(r.id, u);
    }
  }
}
// Логотипи й англійські назви — з коду сайту рейтингу (js/university.js, js/data.js).
const uniJs = readFileSync(join(repo, 'js/university.js'), 'utf8');
const logoBlock = (uniJs.match(/const INSTITUTION_LOGOS = \{([\s\S]*?)\n\};/) || [])[1] || '';
for (const [, id, url] of logoBlock.matchAll(/"([^"]+)":\s*"([^"]+)"/g)) if (byId.has(id)) byId.get(id).logo = url;
const dataJs = readFileSync(join(repo, 'js/data.js'), 'utf8');
for (const [, id, en] of dataJs.matchAll(/id:\s*"([^"]+)"[^}]*?nameEn:\s*"([^"]+)"/g)) if (byId.has(id) && !byId.get(id).nameEn) byId.get(id).nameEn = en;
const out = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'uk'));
writeFileSync('public/data/ratings-universities.json', JSON.stringify(out, null, 1) + '\n');
console.log(`ratings-universities.json: ${out.length} університетів`);
