// Publishes editorially approved project cards from content/projects/*.json to D1.
// Idempotent: a project whose slug already exists is skipped and never overwritten,
// so later edits made in the admin panel stay authoritative.
// Covers must be same-site illustrations from public/ (coverImageUrl like /img/projects/x.jpg).
import {execFileSync} from 'node:child_process';
import {readFileSync, readdirSync, writeFileSync, mkdtempSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

const DB = 'promedia-news';
const DIR = process.argv[2] || 'content/projects';
const STATUSES = new Set(['upcoming', 'active', 'completed']);

function d1(sqlOrFile, isFile = false) {
  const out = execFileSync('npx', ['wrangler', 'd1', 'execute', DB, '--remote', '--json', isFile ? '--file' : '--command', sqlOrFile], {encoding: 'utf8', timeout: 180000});
  const start = out.search(/\[\s*\{/);
  if (start < 0) throw Error('Cannot parse D1 response');
  const data = JSON.parse(out.slice(start).trim());
  if (!data.length || data.some(item => item.success === false)) throw Error('D1 operation failed');
  return data[0].results || [];
}
const q = value => value == null || value === '' ? 'NULL' : `'${String(value).replace(/'/g, "''")}'`;
const qs = value => `'${String(value || '').replace(/'/g, "''")}'`;

const files = readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
for (const f of files) {
  const p = JSON.parse(readFileSync(join(DIR, f), 'utf8'));
  if (!p.slug || !p.title) throw Error('Missing slug/title in ' + f);
  const status = p.projectStatus || 'active';
  if (!STATUSES.has(status)) throw Error('Bad projectStatus in ' + f);
  if (p.coverImageUrl && !/^\/img\/[a-z0-9/_-]+\.(jpe?g|png|webp)$/i.test(p.coverImageUrl)) throw Error('coverImageUrl must be a same-site /img/ path: ' + f);
  for (const d of [p.startDate, p.endDate]) if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) throw Error('Dates must be YYYY-MM-DD in ' + f);
  if (d1(`SELECT id FROM projects WHERE slug = ${q(p.slug)}`).length) {
    // An approved revision of the titles, homepage flag and tags is applied once per `revision`;
    // everything else stays with the admin panel.
    const marker = p.revision ? `project_revision:${p.slug}:${p.revision}` : null;
    d1('CREATE TABLE IF NOT EXISTS editorial_data_fixes (name TEXT PRIMARY KEY)');
    if (marker && !d1(`SELECT 1 FROM editorial_data_fixes WHERE name = ${q(marker)}`).length) {
      d1(`UPDATE projects SET title = ${q(p.title)}, title_en = ${q(p.titleEn)}, title_crh = ${q(p.titleCrh)}, is_featured = ${p.isFeatured ? 1 : 0}, tags = ${qs(JSON.stringify(p.tags || []))}, updated_at = ${qs(new Date().toISOString())} WHERE slug = ${q(p.slug)}`);
      d1(`INSERT INTO editorial_data_fixes (name) VALUES (${q(marker)})`);
      console.log(`Applied revision ${p.revision} to ${p.slug}.`);
    } else {
      console.log(`Skip ${p.slug}: already exists.`);
    }
    continue;
  }
  const author = d1("SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1")[0];
  if (!author) throw Error('No admin user found');
  const now = new Date().toISOString();
  const published = p.publishedAt || now;
  const crop = '{}';
  const sql = `INSERT INTO projects (slug, title, title_en, title_crh, excerpt, excerpt_en, excerpt_crh,
    body_md, body_md_en, body_md_crh, work_md, work_md_en, work_md_crh, results_md, results_md_en, results_md_crh,
    period_label, period_label_en, period_label_crh, cover_image_url, cover_crop_data,
    partner, partner_en, partner_crh, donor, donor_en, donor_crh,
    project_status, start_date, end_date, website_url, tags, is_featured, publication_status, author_id,
    published_at, created_at, updated_at)
  SELECT ${q(p.slug)}, ${q(p.title)}, ${q(p.titleEn)}, ${q(p.titleCrh)}, ${qs(p.excerpt)}, ${q(p.excerptEn)}, ${q(p.excerptCrh)},
    ${qs(p.bodyMd)}, ${q(p.bodyMdEn)}, ${q(p.bodyMdCrh)}, ${qs(p.workMd)}, ${q(p.workMdEn)}, ${q(p.workMdCrh)},
    ${qs(p.resultsMd)}, ${q(p.resultsMdEn)}, ${q(p.resultsMdCrh)},
    ${q(p.periodLabel)}, ${q(p.periodLabelEn)}, ${q(p.periodLabelCrh)}, ${q(p.coverImageUrl)}, ${qs(crop)},
    ${q(p.partner)}, ${q(p.partnerEn)}, ${q(p.partnerCrh)}, ${q(p.donor)}, ${q(p.donorEn)}, ${q(p.donorCrh)},
    ${qs(status)}, ${q(p.startDate)}, ${q(p.endDate)}, ${q(p.websiteUrl)}, ${qs(JSON.stringify(p.tags || []))}, ${p.isFeatured ? 1 : 0},
    'published', ${Number(author.id)}, ${qs(published)}, ${qs(now)}, ${qs(now)}
  WHERE NOT EXISTS (SELECT 1 FROM projects WHERE slug = ${q(p.slug)});`;
  const sqlFile = join(mkdtempSync(join(tmpdir(), 'sql-')), 'insert.sql');
  writeFileSync(sqlFile, sql);
  d1(sqlFile, true);
  const row = d1(`SELECT id, publication_status FROM projects WHERE slug = ${q(p.slug)}`)[0];
  if (!row || row.publication_status !== 'published') throw Error('Insert not verified for ' + p.slug);
  console.log(`Published project ${p.slug} (id ${row.id}).`);
}
