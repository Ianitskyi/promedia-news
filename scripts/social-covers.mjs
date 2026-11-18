// Обкладинки для соцмереж (Facebook, X, Telegram, LinkedIn): вони показують фото 1,91:1
// і ріжуть його по центру, тож на портретах лишається тулуб без голови.
// Для кожної опублікованої статті з вертикальною чи квадратною обкладинкою скрипт робить
// окрему картинку 1200×630 з урахуванням точки фокусу з адмінки (інакше — верхня третина,
// де на портретах обличчя) у public/img/social/. Робочий процес комітить і викладає ці файли,
// а потім `--apply` записує їх у дані обкладинки як og (токен Cloudflare не має запису в R2).
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
// 50/50 — значення адмінки за замовчуванням, тобто кадр ніхто не виставляв.
const chosen = p => { const v = point(p); return v && !(v.x === 50 && v.y === 50) ? v : null; };
const FORMATS = ['desktop', 'mobile', 'social', 'feed'];
const point = p => p && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y))
  ? {x: Math.max(0, Math.min(100, Number(p.x))), y: Math.max(0, Math.min(100, Number(p.y)))} : null;

const COLUMNS = [['cover_image_url', 'cover_crop_data'], ['cover_image_url_en', 'cover_crop_data_en'], ['cover_image_url_crh', 'cover_crop_data_crh']];

// Оновлюємо лише поле social, щоб не зачепити правки з адмінки, зроблені тим часом.
const save = ({id, urlCol, dataCol, src, og, autoPoint}) => {
  const base = `CASE WHEN json_valid(${dataCol}) THEN ${dataCol} ELSE '{}' END`;
  const points = autoPoint ? FORMATS.map(f => `, '$.${f}', json(${q(JSON.stringify(autoPoint))})`).join('') : '';
  d1(`UPDATE articles SET ${dataCol} = json_set(${base}, '$.og', json(${q(JSON.stringify(og))})${points}) WHERE id = ${Number(id)} AND ${urlCol} = ${q(src)}`);
};

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
    const manual = chosen(meta.social) || chosen(meta.desktop) || chosen(meta.feed);
    if (manual && meta.og && meta.og.signature === `${src}|${manual.x}|${manual.y}`) continue;
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
    // Кадр ніхто не виставляв — знаходимо найцікавіше місце (обличчя, шкіра, контраст)
    // і записуємо його для всіх форматів: сайт, головна, сторіз, соцмережі.
    let autoPoint = null, focus = manual;
    if (!focus) {
      const side = 300, scale = side / Math.min(width, height);
      const {info} = await sharp(buffer).rotate().resize(side, side, {fit: 'cover', position: sharp.strategy.attention}).toBuffer({resolveWithObject: true});
      autoPoint = focus = {
        x: Math.round(Math.max(0, Math.min(100, info.attentionX / (width * scale) * 100))),
        y: Math.round(Math.max(0, Math.min(100, info.attentionY / (height * scale) * 100)))
      };
      if (autoPoint.x === 50 && autoPoint.y === 50) autoPoint = focus = {x: 50, y: 49};
      console.log(`Auto focus for ${row.slug} (${urlCol}): ${focus.x}% ${focus.y}%`);
    }
    const signature = `${src}|${focus.x}|${focus.y}`;
    if (!autoPoint && meta.og && meta.og.signature === signature) continue;
    let og = {signature};
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
      og = {signature, url: `/img/social/${name}`};
      made++;
      console.log(`Social cover for ${row.slug} (${urlCol}): ${og.url}`);
    }
    pending.push({id: row.id, urlCol, dataCol, src, og, autoPoint});
  }
}
writeFileSync(PENDING, JSON.stringify(pending));
console.log(`Done: ${made} new social cover(s).`);
