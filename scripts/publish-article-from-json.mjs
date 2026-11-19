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

const files = readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
for (const f of files) {
  const a = JSON.parse(readFileSync(join(DIR, f), 'utf8'));
  if (!a.slug || !a.title || !a.bodyMd) throw Error('Missing slug/title/bodyMd in ' + f);
  // Scheduled publication: "publishAt" (ISO 8601 with a time zone offset, e.g. 2026-11-18T03:00:00+02:00)
  // keeps a new article off the site until that moment; the workflow runs every 15 minutes.
  if (a.publishAt) {
    const due = new Date(a.publishAt);
    if (Number.isNaN(due.getTime())) throw Error(`Invalid publishAt in ${f}: ${a.publishAt}`);
    if (due > new Date() && !d1(`SELECT id FROM articles WHERE slug = ${q(a.slug)}`).length) {
      console.log(`Scheduled ${a.slug}: waits until ${due.toISOString()}.`);
      continue;
    }
  }
  if (d1(`SELECT id FROM articles WHERE slug = ${q(a.slug)}`).length) {
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
      ${newCover ? `cover_image_url = ${q(newCover)}, cover_crop_data = ${q(a.cover?.alt || a.cover?.caption ? JSON.stringify({...(a.cover.alt ? {alt: a.cover.alt} : {}), ...(a.cover.caption ? {caption: a.cover.caption} : {})}) : null)},` : ''}
      updated_at = ${q(new Date().toISOString())}
    WHERE slug = ${q(a.slug)} AND NOT EXISTS (SELECT 1 FROM editorial_data_fixes WHERE name = ${q(marker)});
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
    const img = await fetch(credit.thumb, {headers: {'User-Agent': UA}});
    if (!img.ok) throw Error('Cover download ' + img.status);
    const tmp = join(mkdtempSync(join(tmpdir(), 'cover-')), 'cover.jpg');
    writeFileSync(tmp, Buffer.from(await img.arrayBuffer()));
    const key = `articles/${a.slug.slice(0, 60)}-${Date.now()}.jpg`;
    try {
      wrangler(['r2', 'object', 'put', `${BUCKET}/${key}`, '--file', tmp, '--content-type', 'image/jpeg', '--remote']);
      coverUrl = `/img-storage/${key}`;
    } catch {
      // The deployment token may lack R2 write access; Wikimedia allows hotlinking its thumbnails.
      console.log('::warning::R2 upload not permitted; using the Wikimedia Commons thumbnail URL.');
      coverUrl = credit.thumb;
    }
  }
  for (const k of ['bodyMd', 'bodyMdEn', 'bodyMdCrh']) {
    if (a[k] && /⟦[^⟧]+⟧/.test(a[k])) throw Error(`Unfilled placeholder in ${k} of ${f}`);
  }
  const author = d1("SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1")[0];
  if (!author) throw Error('No admin user found');
  const now = new Date().toISOString();
  const published = a.publishedAt || (a.publishAt ? new Date(a.publishAt).toISOString() : now);
  const sql = `INSERT INTO articles (slug, title, title_en, title_crh, excerpt, excerpt_en, excerpt_crh,
    body_md, body_md_en, body_md_crh, cover_image_url, cover_crop_data, tags, related_media_ids, is_important, card_style, status, author_id,
    published_at, created_at, updated_at)
  SELECT ${[a.slug, a.title, a.titleEn, a.titleCrh, a.excerpt || '', a.excerptEn, a.excerptCrh,
    a.bodyMd, a.bodyMdEn, a.bodyMdCrh, coverUrl, a.cover?.alt || a.cover?.caption ? JSON.stringify({...(a.cover.alt ? {alt: a.cover.alt} : {}), ...(a.cover.caption ? {caption: a.cover.caption} : {})}) : null,
    JSON.stringify(a.tags || []), JSON.stringify(Array.isArray(a.relatedMediaIds) ? a.relatedMediaIds : [])].map(q).join(', ')}, ${a.isImportant ? 1 : 0}, ${q(a.cardStyle || 'auto')},
    'published', ${Number(author.id)}, ${q(published)}, ${q(now)}, ${q(now)}
  WHERE NOT EXISTS (SELECT 1 FROM articles WHERE slug = ${q(a.slug)});`;
  const sqlFile = join(mkdtempSync(join(tmpdir(), 'sql-')), 'insert.sql');
  writeFileSync(sqlFile, sql);
  d1(sqlFile, true);
  const row = d1(`SELECT id, status FROM articles WHERE slug = ${q(a.slug)}`)[0];
  if (!row || row.status !== 'published') throw Error('Insert not verified for ' + a.slug);
  console.log(`Published ${a.slug} (id ${row.id}).`);
}
