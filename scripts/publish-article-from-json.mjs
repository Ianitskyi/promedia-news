// Publishes editorially approved articles from content/articles/*.json to D1.
// Idempotent: an article whose slug already exists is skipped and never overwritten,
// so later edits made in the admin panel stay authoritative.
//
// Cover photos come from Wikimedia Commons, or from an original illustration already
// served from this site's public/ folder (cover.url, a same-site path like /img/news/x.jpg).
// Commons covers: The script reads the author and
// licence from the Commons API, refuses non-free files, substitutes the credit
// placeholders (⟦АВТОР⟧/⟦AUTHOR⟧/⟦MÜELLİF⟧ and ⟦ЛІЦЕНЗІЯ⟧/⟦LICENCE⟧/⟦LİTSENZİYA⟧)
// and uploads a resized copy to R2. It fails if any placeholder is left unfilled.
import {execFileSync} from 'node:child_process';
import {readFileSync, readdirSync, writeFileSync, mkdtempSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

const DB = 'promedia-news';
const BUCKET = 'promedia-news-images';
const DIR = process.argv[2] || 'content/articles';
const UA = 'ProMediaNewsPublisher/1.0 (https://news.promedia.report)';
const SCHEDULE_TABLE_SQL = 'CREATE TABLE IF NOT EXISTS scheduled_publications (slug TEXT PRIMARY KEY, publish_at TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0, published_at_run TEXT)';

function wrangler(args) {
  return execFileSync('npx', ['wrangler', ...args], {encoding: 'utf8', timeout: 180000});
}
function d1(sqlOrFile, isFile = false) {
  const out = wrangler(['d1', 'execute', DB, '--remote', '--json', isFile ? '--file' : '--command', sqlOrFile]);
  const start = out.search(/\[\s*\{/);
  if (start < 0) throw Error('Cannot parse D1 response');
  const data = JSON.parse(out.slice(start).trim());
  if (!data.length || data.some(item => item.success === false)) throw Error('D1 operation failed');
  return data[0].results || [];
}
const q = value => value == null ? 'NULL' : `'${String(value).replace(/'/g, "''")}'`;

// Завантаження фото в R2. Спершу напряму (wrangler), а якщо ключ Cloudflare не має права
// писати в R2 — через службовий маршрут сайту /api/internal/r2-put з одноразовим токеном,
// який ми кладемо в D1 (див. src/lib/internalUpload.js). Повертає /img-storage/… або null.
const SITE = process.env.NEWS_SITE_URL || 'https://news.promedia.report';
let uploadToken = null;
async function uploadToR2(file, key, contentType) {
  try {
    wrangler(['r2', 'object', 'put', `${BUCKET}/${key}`, '--file', file, '--content-type', contentType, '--remote']);
    return `/img-storage/${key}`;
  } catch {
    console.log('R2 direct upload not permitted; uploading through the site.');
  }
  try {
    if (!uploadToken) {
      const {randomBytes, createHash} = await import('node:crypto');
      uploadToken = randomBytes(32).toString('hex');
      const hash = createHash('sha256').update(uploadToken).digest('hex');
      const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      const sqlFile = join(mkdtempSync(join(tmpdir(), 'tok-')), 'token.sql');
      writeFileSync(sqlFile, `CREATE TABLE IF NOT EXISTS upload_tokens (token_hash TEXT PRIMARY KEY, expires_at TEXT NOT NULL);
INSERT INTO upload_tokens (token_hash, expires_at) VALUES (${q(hash)}, ${q(expires)});`);
      d1(sqlFile, true);
    }
    const res = await fetch(`${SITE}/api/internal/r2-put?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: {Authorization: `Bearer ${uploadToken}`, 'Content-Type': contentType, 'User-Agent': UA},
      body: readFileSync(file)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw Error(`HTTP ${res.status} ${data.error || ''}`);
    console.log(`Uploaded ${key} through the site (${data.bytes} bytes).`);
    return data.url;
  } catch (e) {
    console.log(`::warning::Upload through the site failed: ${e.message}`);
    return null;
  }
}
const stripHtml = html => String(html || '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/\s+/g, ' ').trim();

async function commonsInfo(file, width) {
  const url = 'https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({
    action: 'query', format: 'json', prop: 'imageinfo', titles: 'File:' + file,
    iiprop: 'url|extmetadata|mime', iiurlwidth: String(width || 1600)
  });
  const res = await fetch(url, {headers: {'User-Agent': UA}});
  if (!res.ok) throw Error('Commons API ' + res.status);
  const page = Object.values((await res.json()).query.pages)[0];
  const info = page?.imageinfo?.[0];
  if (!info) throw Error('Commons file not found: ' + file);
  const meta = info.extmetadata || {};
  const author = stripHtml(meta.Artist?.value);
  const licence = stripHtml(meta.LicenseShortName?.value);
  const licenceUrl = stripHtml(meta.LicenseUrl?.value);
  if (!author) throw Error('Commons file has no author: ' + file);
  if (!/^(CC BY|CC0|Public domain)/i.test(licence) || /NC|ND/.test(licence)) {
    throw Error(`Licence "${licence}" is not allowed for ${file}`);
  }
  return {author, licence, licenceUrl, thumb: info.thumburl || info.url, mime: info.mime, page: info.descriptionurl};
}

function fillCredit(text, credit) {
  const lic = credit.licenceUrl ? `[${credit.licence}](${credit.licenceUrl})` : credit.licence;
  return text
    .replace(/⟦(АВТОР|AUTHOR|MÜELLİF)⟧/g, credit.author)
    .replace(/⟦(ЛІЦЕНЗІЯ|LICENCE|LİTSENZİYA)⟧/g, lic);
}


// Підпис обкладинки (cover.caption) теж може містити ⟦АВТОР⟧ / ⟦ЛІЦЕНЗІЯ⟧ — заповнюємо з Вікісховища
// (ліцензія тут простим текстом: підпис під фото — не Markdown).
function fillCaption(cover, credit) {
  if (!cover?.caption || typeof cover.caption !== 'object') return;
  for (const k of Object.keys(cover.caption)) {
    cover.caption[k] = String(cover.caption[k])
      .replace(/⟦(АВТОР|AUTHOR|MÜELLİF)⟧/g, credit.author)
      .replace(/⟦(ЛІЦЕНЗІЯ|LICENCE|LİTSENZİYA)⟧/g, credit.licence);
  }
}

// Метадані обкладинки для cover_crop_data: alt, підпис і, за потреби, точки фокусу кадру
// (cover.focus = {mobile, desktop, feed, social}, кожна {x, y} у відсотках) — ті самі, що виставляє адмінка.
function coverMeta(a) {
  const c = a.cover || {};
  const meta = {};
  if (c.alt) meta.alt = c.alt;
  if (c.caption) meta.caption = c.caption;
  for (const k of ['mobile', 'desktop', 'feed', 'social']) {
    const pnt = c.focus?.[k];
    if (pnt && Number.isFinite(Number(pnt.x)) && Number.isFinite(Number(pnt.y))) meta[k] = {x: Number(pnt.x), y: Number(pnt.y)};
  }
  return Object.keys(meta).length ? JSON.stringify(meta) : null;
}

const files = readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
for (const f of files) {
  const a = JSON.parse(readFileSync(join(DIR, f), 'utf8'));
  if (!a.slug || !a.title || !a.bodyMd) throw Error('Missing slug/title/bodyMd in ' + f);
  // Scheduled publication: "publishAt" (ISO 8601 with a time zone offset, e.g. 2026-11-18T03:00:00+02:00).
  // A future article goes into D1 right away as a hidden draft and into scheduled_publications;
  // the site's own Cloudflare cron (every 5 minutes, src/lib/scheduler.js) makes it public on time.
  // (Since 23.11.2026: GitHub skipped scheduled runs, so we no longer rely on them.)
  let scheduledFor = null;
  if (a.publishAt) {
    const due = new Date(a.publishAt);
    if (Number.isNaN(due.getTime())) throw Error(`Invalid publishAt in ${f}: ${a.publishAt}`);
    if (due > new Date()) scheduledFor = due.toISOString();
  }
  if (d1(`SELECT id FROM articles WHERE slug = ${q(a.slug)}`).length) {
    // Still waiting: if the editor moved "publishAt", move the scheduled time too.
    if (scheduledFor) {
      d1(SCHEDULE_TABLE_SQL);
      d1(`UPDATE scheduled_publications SET publish_at = ${q(scheduledFor)} WHERE slug = ${q(a.slug)} AND done = 0 AND publish_at != ${q(scheduledFor)}`);
    }
    // An approved revision is applied once, then admin edits stay authoritative.
    const marker = a.revision ? `article_revision:${a.slug}:${a.revision}` : null;
    d1('CREATE TABLE IF NOT EXISTS editorial_data_fixes (name TEXT PRIMARY KEY)');
    if (!marker || d1(`SELECT 1 FROM editorial_data_fixes WHERE name = ${q(marker)}`).length) {
      console.log(`Skip ${a.slug}: already exists.`);
      continue;
    }
    // A new cover for a published article: set "coverRevision" to the same value as "revision".
    let newCover = null;
    if (a.cover?.commonsFile) {
      const credit = await commonsInfo(a.cover.commonsFile, a.cover.width);
      for (const k of ['bodyMd', 'bodyMdEn', 'bodyMdCrh']) if (a[k]) a[k] = fillCredit(a[k], credit);
      fillCaption(a.cover, credit);
      if (a.coverRevision && a.coverRevision === a.revision) {
        newCover = credit.thumb;
        console.log(`New cover for ${a.slug}: ${credit.page} — ${credit.author}, ${credit.licence}`);
      }
    }
    // Власне фото (cover.url) як нова обкладинка вже опублікованої новини.
    if (!newCover && a.cover?.url && a.coverRevision && a.coverRevision === a.revision) {
      if (!/^\/img\/[a-z0-9/_-]+\.(jpe?g|png|webp)$/i.test(a.cover.url)) throw Error('cover.url must be a same-site /img/ path: ' + f);
      newCover = a.cover.url;
      console.log(`New cover for ${a.slug}: ${a.cover.url}`);
    }
    for (const k of ['bodyMd', 'bodyMdEn', 'bodyMdCrh']) {
      if (a[k] && /⟦[^⟧]+⟧/.test(a[k])) throw Error(`Unfilled placeholder in ${k} of ${f}`);
    }
    // Editing a published article never moves it to the top: the order follows the first
    // publication date. It becomes the lead story again only when the editor asks for it,
    // by setting "raiseToTop" to the same value as this "revision".
    // Лише два варіанти: «З фото на першій» (hero) і звичайна картка (auto).
    if (a.cardStyle && a.cardStyle !== 'hero') a.cardStyle = 'auto';
    const raise = a.cardStyle === 'hero' && a.raiseToTop === a.revision;
    const cardStyle = a.cardStyle === 'hero' && !raise ? null : a.cardStyle;
    const sql = `UPDATE articles SET title = ${q(a.title)}, title_en = ${q(a.titleEn)}, title_crh = ${q(a.titleCrh)},
      excerpt = ${q(a.excerpt || '')}, excerpt_en = ${q(a.excerptEn)}, excerpt_crh = ${q(a.excerptCrh)},
      body_md = ${q(a.bodyMd)}, body_md_en = ${q(a.bodyMdEn)}, body_md_crh = ${q(a.bodyMdCrh)},
      tags = ${q(JSON.stringify(a.tags || []))},
      ${Array.isArray(a.relatedMediaIds) ? `related_media_ids = ${q(JSON.stringify(a.relatedMediaIds))},` : ''}
      is_important = ${a.isImportant === undefined ? 'is_important' : (a.isImportant ? 1 : 0)},
      card_style = ${cardStyle ? q(cardStyle) : 'card_style'},
      ${newCover ? `cover_image_url = ${q(newCover)}, cover_crop_data = ${q(coverMeta(a))},` : ''}
      updated_at = ${q(new Date().toISOString())}
    WHERE slug = ${q(a.slug)} AND NOT EXISTS (SELECT 1 FROM editorial_data_fixes WHERE name = ${q(marker)});
    ${pinSql(a, marker)}
    INSERT OR IGNORE INTO editorial_data_fixes (name) VALUES (${q(marker)});`;
    const sqlFile = join(mkdtempSync(join(tmpdir(), 'sql-')), 'update.sql');
    writeFileSync(sqlFile, sql);
    d1(sqlFile, true);
    console.log(`Updated ${a.slug} to revision ${a.revision}${raise ? ' and raised it to the lead story' : ''}.`);
    continue;
  }
  let coverUrl = null;
  if (a.cover?.url) {
    if (!/^\/img\/[a-z0-9/_-]+\.(jpe?g|png|webp)$/i.test(a.cover.url)) throw Error('cover.url must be a same-site /img/ path: ' + f);
    coverUrl = a.cover.url;
  } else if (a.cover?.commonsFile) {
    const credit = await commonsInfo(a.cover.commonsFile, a.cover.width);
    console.log(`Cover: ${credit.page} — ${credit.author}, ${credit.licence}`);
    for (const k of ['bodyMd', 'bodyMdEn', 'bodyMdCrh']) if (a[k]) a[k] = fillCredit(a[k], credit);
    fillCaption(a.cover, credit);
    const img = await fetch(credit.thumb, {headers: {'User-Agent': UA}});
    if (!img.ok) throw Error('Cover download ' + img.status);
    const tmp = join(mkdtempSync(join(tmpdir(), 'cover-')), 'cover.jpg');
    writeFileSync(tmp, Buffer.from(await img.arrayBuffer()));
    const key = `articles/${a.slug.slice(0, 60)}-${Date.now()}.jpg`;
    coverUrl = await uploadToR2(tmp, key, 'image/jpeg');
    if (!coverUrl) {
      // Wikimedia allows hotlinking its thumbnails.
      console.log('::warning::R2 upload failed both ways; using the Wikimedia Commons thumbnail URL.');
      coverUrl = credit.thumb;
    }
  }
  for (const k of ['bodyMd', 'bodyMdEn', 'bodyMdCrh']) {
    if (a[k] && /⟦[^⟧]+⟧/.test(a[k])) throw Error(`Unfilled placeholder in ${k} of ${f}`);
  }
  if (a.cover?.caption && /⟦[^⟧]+⟧/.test(JSON.stringify(a.cover.caption))) throw Error(`Unfilled placeholder in cover.caption of ${f}`);
  const author = d1("SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1")[0];
  if (!author) throw Error('No admin user found');
  const now = new Date().toISOString();
  const published = a.publishedAt || (a.publishAt ? new Date(a.publishAt).toISOString() : now);
  const sql = `INSERT INTO articles (slug, title, title_en, title_crh, excerpt, excerpt_en, excerpt_crh,
    body_md, body_md_en, body_md_crh, cover_image_url, cover_crop_data, tags, related_media_ids, is_important, card_style, status, author_id,
    published_at, created_at, updated_at)
  SELECT ${[a.slug, a.title, a.titleEn, a.titleCrh, a.excerpt || '', a.excerptEn, a.excerptCrh,
    a.bodyMd, a.bodyMdEn, a.bodyMdCrh, coverUrl, coverMeta(a),
    JSON.stringify(a.tags || []), JSON.stringify(Array.isArray(a.relatedMediaIds) ? a.relatedMediaIds : [])].map(q).join(', ')}, ${a.isImportant ? 1 : 0}, ${q(a.cardStyle || 'auto')},
    ${scheduledFor ? "'draft'" : "'published'"}, ${Number(author.id)}, ${q(published)}, ${q(now)}, ${q(now)}
  WHERE NOT EXISTS (SELECT 1 FROM articles WHERE slug = ${q(a.slug)});
  ${scheduledFor ? `${SCHEDULE_TABLE_SQL};
  INSERT OR REPLACE INTO scheduled_publications (slug, publish_at, done) VALUES (${q(a.slug)}, ${q(scheduledFor)}, 0);` : pinSql(a)}`;
  const sqlFile = join(mkdtempSync(join(tmpdir(), 'sql-')), 'insert.sql');
  writeFileSync(sqlFile, sql);
  d1(sqlFile, true);
  const row = d1(`SELECT id, status FROM articles WHERE slug = ${q(a.slug)}`)[0];
  if (!row || row.status !== (scheduledFor ? 'draft' : 'published')) throw Error('Insert not verified for ' + a.slug);
  console.log(scheduledFor
    ? `Scheduled ${a.slug} (id ${row.id}): hidden draft, the site publishes it at ${scheduledFor}.`
    : `Published ${a.slug} (id ${row.id}).`);
}

// Картки «Медіа в матеріалі» / «Університети в матеріалі» для вже опублікованих новин
// (зокрема з адмінки): content/related-media.json — { "slug": ["atlas-…", "univ:…"] }.
// Змінює лише related_media_ids, текст не чіпає. Кожен список застосовується один раз,
// тож пізніші правки в адмінці не перезаписуються.
const RELATED_FILE = join(DIR, '..', 'related-media.json');
let related = {};
try { related = JSON.parse(readFileSync(RELATED_FILE, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
for (const [slug, ids] of Object.entries(related)) {
  if (slug.startsWith('_') || !Array.isArray(ids)) continue;
  const value = JSON.stringify(ids);
  const marker = `related_media:${slug}:${value}`;
  d1(`UPDATE articles SET related_media_ids = ${q(value)} WHERE slug = ${q(slug)} AND NOT EXISTS (SELECT 1 FROM editorial_data_fixes WHERE name = ${q(marker)}); INSERT OR IGNORE INTO editorial_data_fixes (name) VALUES (${q(marker)});`);
  console.log(`Related media for ${slug}: ${value}`);
}

// "pinned": true — закріпити новину вгорі стрічки (знімає закріплення з попередньої);
// "pinned": false — відкріпити. Без поля закріплення не змінюється.
function pinSql(a, marker) {
  if (a.pinned === undefined) return '';
  const guard = marker ? ` AND NOT EXISTS (SELECT 1 FROM editorial_data_fixes WHERE name = ${q(marker)})` : '';
  if (!a.pinned) return `UPDATE articles SET pinned_at = NULL WHERE slug = ${q(a.slug)}${guard};`;
  return `UPDATE articles SET pinned_at = NULL WHERE pinned_at IS NOT NULL AND slug != ${q(a.slug)}${guard};
    UPDATE articles SET pinned_at = ${q(new Date().toISOString())} WHERE slug = ${q(a.slug)}${guard};`;
}
