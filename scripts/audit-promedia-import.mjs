const ORIGIN = "https://promedia.report";
const TARGET_ORIGIN = "https://news.promedia.report";

// The legacy CMS exposes separate UA/EN records together in both locale lists.
// Pair them explicitly so the new bilingual article model does not create duplicates.
const ARTICLE_PAIRS = [
  ["go-promedia-zapustila-rejting-zhurfakiv-ukrayini", "promedia-launches-ukrainian-journalism-schools-ranking"],
  ["ukrayinski-media-demonstruyut-vinahidlivist-pid-podvijnim-tiskom", "ukrainian-media-show-ingenuity-under-double-pressure"],
  ["analitiki-doslidili-stan-ukrayinskih-media-pid-chas-vijni", "analysts-examine-the-state-of-ukrainian-media-during-the-war"],
  ["fedorov-potribno-bulo-bilshe-spilkuvatisya-z-suspilstvom", "fedorov-we-should-have-communicated-more-with-society"],
  ["ukrayinska-studentka-povernulasya-z-yaponiyi-dodomu-pid-chas-vijni", "ukrainian-student-returns-home-from-japan-during-the-war"],
  ["karta-mediinykh-spilnot-ukrainy", "promedia-launches-map-of-ukrainian-media-communities"],
  ["rada-vidkrila-komiteti-dlya-zhurnalistiv", "parliament-opens-committee-meetings-to-journalists"],
  ["irrp-zapustiv-servis-dopublikacijnogo-faktchekingu-zhurnalistskih-rozsliduvan-proof", "irrp-launches-proof-a-pre-publication-fact-checking-service-for-investigative-journalists"],
  ["promedia-calls-to-allocate-uah-39-billion-to-suspilne-2027", null],
  ["the-kyiv-independent-rozpochali-kampaniyu-v-britaniyi", null]
];

function decodeEntities(value) {
  const named = {
    amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
    ndash: "–", mdash: "—", laquo: "«", raquo: "»", hellip: "…"
  };
  return String(value || "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => named[name.toLowerCase()] ?? match);
}

function plainText(html) {
  return decodeEntities(String(html || "").replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function absoluteUrl(url) {
  return new URL(decodeEntities(url), ORIGIN).href;
}

function articleHtmlToMarkdown(html) {
  let value = String(html || "");
  value = value.replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_, href, label) => `[${plainText(label)}](${absoluteUrl(href)})`);
  value = value.replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi,
    (_, level, text) => `${"#".repeat(Number(level))} ${plainText(text)}\n\n`);
  value = value.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_, text) => `- ${plainText(text)}\n`);
  value = value.replace(/<br\s*\/?\s*>/gi, "\n");
  value = value.replace(/<\/p\s*>/gi, "\n\n");
  value = value.replace(/<[^>]*>/g, "");
  return decodeEntities(value)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function slugFromUrl(url) {
  return new URL(url).pathname.split("/").filter(Boolean).at(-1);
}

function parseDate(value) {
  const match = String(value || "").match(/(\d{2})\.(\d{2})\.(\d{4})/);
  return match ? `${match[3]}-${match[2]}-${match[1]}T12:00:00.000Z` : null;
}

function detectLanguage(text) {
  const value = String(text || "");
  const cyrillic = (value.match(/[А-Яа-яІіЇїЄєҐґ]/g) || []).length;
  const latin = (value.match(/[A-Za-z]/g) || []).length;
  return cyrillic > Math.max(4, latin * 0.12) ? "uk" : "en";
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { "User-Agent": "ProMedia news migration audit/1.0" } });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.text();
}

function parseListing(html) {
  const posts = [];
  const pattern = /<a\b[^>]*href=["']([^"']*\/news\/post\/[^"']+)["'][^>]*class=["'][^"']*\bpost\b[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = pattern.exec(html))) {
    posts.push({ url: absoluteUrl(match[1]), slug: slugFromUrl(match[1]) });
  }
  return posts;
}

async function d1Query(sql, params = []) {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
  if (!token || !accountId || !databaseId) {
    throw new Error("Missing CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_D1_DATABASE_ID");
  }
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ sql, params })
    }
  );
  const payload = await response.json();
  if (!response.ok || !payload.success) {
    throw new Error(`D1 query failed (${response.status}): ${JSON.stringify(payload.errors || payload)}`);
  }
  return payload.result?.[0] || {};
}

function sessionCookie(response) {
  const raw = response.headers.get("set-cookie") || "";
  return raw.split(";", 1)[0];
}

async function getAdminSession() {
  const email = process.env.PROMEDIA_ADMIN_EMAIL;
  const password = process.env.PROMEDIA_ADMIN_PASSWORD;
  const name = process.env.PROMEDIA_ADMIN_NAME;
  if (!email || !password || !name) throw new Error("Missing ProMedia admin environment variables");

  const setup = await fetch(`${TARGET_ORIGIN}/api/setup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name })
  });
  if (setup.ok) return sessionCookie(setup);

  const setupBody = await setup.json().catch(() => ({}));
  if (setup.status !== 403 || setupBody.error !== "already_initialized") {
    throw new Error(`Admin setup failed (${setup.status}): ${JSON.stringify(setupBody)}`);
  }
  const login = await fetch(`${TARGET_ORIGIN}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  if (!login.ok) throw new Error(`Admin login failed (${login.status})`);
  return sessionCookie(login);
}

async function copyCoverToR2(sourceUrl, cookie) {
  if (!sourceUrl) return null;
  const source = await fetch(sourceUrl, { headers: { "User-Agent": "ProMedia news migration/1.0" } });
  if (!source.ok) throw new Error(`Image fetch failed (${source.status}): ${sourceUrl}`);
  const contentType = (source.headers.get("content-type") || "image/jpeg").split(";", 1)[0];
  const upload = await fetch(`${TARGET_ORIGIN}/api/admin/upload`, {
    method: "POST",
    headers: { Cookie: cookie, "Content-Type": contentType },
    body: await source.arrayBuffer()
  });
  const payload = await upload.json().catch(() => ({}));
  if (!upload.ok || !payload.url) {
    throw new Error(`Image upload failed (${upload.status}): ${JSON.stringify(payload)}`);
  }
  return new URL(payload.url, TARGET_ORIGIN).href;
}

async function applyImport(recordsBySlug) {
  const cookie = await getAdminSession();
  if (!cookie) throw new Error("Admin session cookie was not returned");
  const adminResult = await d1Query("SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1");
  const authorId = adminResult.results?.[0]?.id;
  if (!authorId) throw new Error("No admin user found after setup");

  const imported = [];
  for (const [ukSlug, enSlug] of ARTICLE_PAIRS) {
    const uk = recordsBySlug.get(ukSlug)?.uk;
    const en = enSlug ? recordsBySlug.get(enSlug)?.en : null;
    if (!uk) throw new Error(`Missing Ukrainian source: ${ukSlug}`);
    if (uk.detectedLanguage !== "uk") throw new Error(`Unexpected UA language: ${ukSlug}`);
    if (en && en.detectedLanguage !== "en") throw new Error(`Unexpected EN language: ${enSlug}`);

    const existing = await d1Query("SELECT cover_image_url FROM articles WHERE slug = ?", [ukSlug]);
    const existingCover = existing.results?.[0]?.cover_image_url || null;
    const coverImageUrl = existingCover || await copyCoverToR2(uk.coverImageUrl || en?.coverImageUrl, cookie);
    const now = new Date().toISOString();
    const publishedAt = uk.publishedAt || en?.publishedAt || now;
    const tags = uk.tags.length ? uk.tags : (en?.tags || []);
    const sql = `
      INSERT INTO articles (
        slug, title, title_en, excerpt, excerpt_en, body_md, body_md_en,
        cover_image_url, tags, related_media_ids, status, author_id,
        published_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', 'published', ?, ?, ?, ?)
      ON CONFLICT(slug) DO UPDATE SET
        title = excluded.title,
        title_en = excluded.title_en,
        excerpt = excluded.excerpt,
        excerpt_en = excluded.excerpt_en,
        body_md = excluded.body_md,
        body_md_en = excluded.body_md_en,
        cover_image_url = excluded.cover_image_url,
        tags = excluded.tags,
        status = 'published',
        author_id = excluded.author_id,
        published_at = excluded.published_at,
        updated_at = excluded.updated_at
    `;
    await d1Query(sql, [
      ukSlug,
      uk.title,
      en?.title || null,
      uk.excerpt,
      en?.excerpt || null,
      uk.bodyMd,
      en?.bodyMd || null,
      coverImageUrl,
      JSON.stringify(tags),
      authorId,
      publishedAt,
      publishedAt,
      now
    ]);
    imported.push({ slug: ukSlug, hasEnglish: Boolean(en), coverCopied: Boolean(coverImageUrl) });
    console.error(`IMPORTED ${imported.length}/${ARTICLE_PAIRS.length}: ${ukSlug}`);
  }
  return imported;
}

async function crawlListing(locale) {
  const prefix = locale === "en" ? "/en" : "";
  const bySlug = new Map();
  for (let page = 1; page <= 20; page += 1) {
    const html = await fetchText(`${ORIGIN}${prefix}/news?page=${page}`);
    const posts = parseListing(html);
    if (!posts.length) break;
    const before = bySlug.size;
    posts.forEach((post) => bySlug.set(post.slug, post));
    if (bySlug.size === before) break;
  }
  return [...bySlug.values()];
}

function capture(html, pattern) {
  const match = html.match(pattern);
  return match ? match[1] : "";
}

function parseArticle(html, locale, slug) {
  const main = capture(html, /<main\b[^>]*>([\s\S]*?)<\/main>/i) || html;
  const title = plainText(capture(main, /<h1\b[^>]*>([\s\S]*?)<\/h1>/i));
  const dateText = plainText(capture(main, /<div\b[^>]*class=["'][^"']*\bfilter-lbl\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i));
  const bodyHtml = capture(main, /<article\b[^>]*>([\s\S]*?)<\/article>/i);
  const cover = capture(main, /<img\b[^>]*src=["']([^"']+)["'][^>]*>/i);
  const tags = [...main.matchAll(/<span\b[^>]*class=["'][^"']*\bbadge\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi)]
    .map((match) => plainText(match[1]))
    .filter(Boolean);
  const bodyMd = articleHtmlToMarkdown(bodyHtml);
  return {
    slug,
    locale,
    sourceUrl: `${ORIGIN}${locale === "en" ? "/en" : ""}/news/post/${slug}`,
    title,
    bodyMd,
    excerpt: bodyMd.replace(/\s+/g, " ").slice(0, 240).trim(),
    coverImageUrl: cover ? absoluteUrl(cover) : null,
    tags,
    publishedAt: parseDate(dateText),
    detectedLanguage: detectLanguage(`${title}\n${bodyMd}`)
  };
}

async function main() {
  const [ukListing, enListing] = await Promise.all([crawlListing("uk"), crawlListing("en")]);
  const slugs = [...new Set([...ukListing, ...enListing].map((post) => post.slug))].sort();
  const rows = [];
  const recordsBySlug = new Map();
  for (const slug of slugs) {
    const [ukHtml, enHtml] = await Promise.all([
      fetchText(`${ORIGIN}/news/post/${slug}`),
      fetchText(`${ORIGIN}/en/news/post/${slug}`)
    ]);
    const uk = parseArticle(ukHtml, "uk", slug);
    const en = parseArticle(enHtml, "en", slug);
    recordsBySlug.set(slug, { uk, en });
    rows.push({
      slug,
      date: uk.publishedAt || en.publishedAt,
      ukTitle: uk.title,
      enTitle: en.title,
      ukDetected: uk.detectedLanguage,
      enDetected: en.detectedLanguage,
      localized: uk.title !== en.title || uk.bodyMd !== en.bodyMd,
      ukChars: uk.bodyMd.length,
      enChars: en.bodyMd.length,
      tagsUk: uk.tags,
      tagsEn: en.tags
    });
  }
  const apply = process.argv.includes("--apply");
  const imported = apply ? await applyImport(recordsBySlug) : [];
  const counts = apply
    ? await d1Query("SELECT COUNT(*) AS articles, SUM(CASE WHEN title_en IS NOT NULL AND body_md_en IS NOT NULL THEN 1 ELSE 0 END) AS bilingual FROM articles WHERE status = 'published'")
    : null;
  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    writes: imported.length,
    listingCounts: { uk: ukListing.length, en: enListing.length },
    uniqueSlugs: slugs.length,
    normalizedArticles: ARTICLE_PAIRS.length,
    imported,
    productionCounts: counts?.results?.[0] || null,
    rows: apply ? undefined : rows
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
