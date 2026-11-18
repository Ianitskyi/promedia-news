// Обкладинки для соцмереж (Facebook, X, Telegram, LinkedIn): вони показують фото 1,91:1
// і ріжуть його по центру, тож на портретах лишається тулуб без голови.
// Для кожної опублікованої статті з вертикальною чи квадратною обкладинкою скрипт робить
// окрему картинку 1200×630 з урахуванням точки фокусу з адмінки (інакше — верхня третина,
// де на портретах обличчя) у public/img/social/. Робочий процес комітить і викладає ці файли,
// а потім `--apply` записує їх у дані обкладинки як social (токен Cloudflare не має запису в R2).
// Картинку перероблено, коли змінилася обкладинка або точка фокусу.
import {execFileSync} from 'node:child_process';
import {writeFileSync, readFileSync, mkdirSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import sharp from 'sharp';

const DB = 'promedia-news';
const OUT_DIR = 'public/img/social';
const PENDING = 'social-covers-pending.json';
const ORIGIN = 'https://news.promedia.report';
const OUT_W = 1200, OUT_H = 630;

function wrangler(args) {
  return execFileSync('npx', ['wrangler', ...args], {encoding: 'utf8', timeout: 180000});
}
function d1(sql) {
  const out = wrangler(['d1', 'execute', DB, '--remote', '--json', '--command', sql]);
  const start = out.search(/\[\s*\{/);
  if (start < 0) throw Error('Cannot parse D1 response');
  const data = JSON.parse(out.slice(start).trim());
  if (!data.length || data.some(item => item.success === false)) throw Error('D1 operation failed');
  return data[0].results || [];
}
const q = value => value == null ? 'NULL' : `'${String(value).replace(/'/g, "''")}'`;
const parse = v => { try { return (typeof v === 'string' ? JSON.parse(v) : v) || {}; } catch { return {}; } };
const point = p => p && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y))
  ? {x: Math.max(0, Math.min(100, Number(p.x))), y: Math.max(0, Math.min(100, Number(p.y)))} : null;

const COLUMNS = [['cover_image_url', 'cover_crop_data'], ['cover_image_url_en', 'cover_crop_data_en'], ['cover_image_url_crh', 'cover_crop_data_crh']];

// Оновлюємо лише поле social, щоб не зачепити правки з адмінки, зроблені тим часом.
const save = ({id, urlCol, dataCol, src, social}) => d1(`UPDATE articles SET ${dataCol} = json_set(CASE WHEN json_valid(${dataCol}) THEN ${dataCol} ELSE '{}' END, '$.social', json(${q(JSON.stringify(social))})) WHERE id = ${Number(id)} AND ${urlCol} = ${q(src)}`);

if (process.argv.includes('--apply')) {
  const pending = existsSync(PENDING) ? JSON.parse(readFileSync(PENDING, 'utf8')) : [];
  pending.forEach(save);
  console.log(`Applied ${pending.length} social cover(s).`);
  process.exit(0);
}

const pending = [];
const rows = d1(`SELECT id, slug, ${COLUMNS.flat().join(', ')} FROM articles WHERE status = 'published' AND deleted_at IS NULL`);
let made = 0;
for (const row of rows) {
  for (const [urlCol, dataCol] of COLUMNS) {
    const src = row[urlCol];
    if (!src) continue;
    const meta = parse(row[dataCol]);
    const focus = point(meta.desktop) || point(meta.feed) || {x: 50, y: 30};
    const signature = `${src}|${focus.x}|${focus.y}`;
    if (meta.social && meta.social.signature === signature) continue;
    let buffer;
    try {
      const res = await fetch(new URL(src, ORIGIN), {headers: {'User-Agent': 'ProMediaSocialCovers/1.0 (https://news.promedia.report)'}});
      if (!res.ok) throw Error('HTTP ' + res.status);
      buffer = Buffer.from(await res.arrayBuffer());
    } catch (err) {
      console.log(`Skip ${row.slug} (${urlCol}): ${err.message}`);
      continue;
    }
    const image = sharp(buffer).rotate();
    const {width, height} = await image.metadata();
    if (!width || !height) continue;
    let social = {signature};
    // Широкі фото соцмережі й так показують цілими — окрема картинка не потрібна.
    if (width / height < 1.6) {
      const cropW = Math.min(width, Math.round(height * OUT_W / OUT_H));
      const cropH = Math.round(cropW * OUT_H / OUT_W);
      const left = Math.round(Math.max(0, Math.min(width - cropW, focus.x / 100 * width - cropW / 2)));
      const top = Math.round(Math.max(0, Math.min(height - cropH, focus.y / 100 * height - cropH / 2)));
      const jpeg = await image.extract({left, top, width: cropW, height: cropH}).resize(OUT_W, OUT_H).jpeg({quality: 85}).toBuffer();
      const name = `${row.id}-${urlCol.replace(/_/g, '-')}-${createHash('sha1').update(signature).digest('hex').slice(0, 10)}.jpg`;
      mkdirSync(OUT_DIR, {recursive: true});
      writeFileSync(`${OUT_DIR}/${name}`, jpeg);
      social = {signature, url: `/img/social/${name}`};
      made++;
      console.log(`Social cover for ${row.slug} (${urlCol}): ${social.url}`);
    }
    pending.push({id: row.id, urlCol, dataCol, src, social});
  }
}
writeFileSync(PENDING, JSON.stringify(pending));
console.log(`Done: ${made} new social cover(s).`);
