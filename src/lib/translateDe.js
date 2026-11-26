// Німецька версія новин і проєктів (власник, 26.11.2026): перекладає ШІ, автоматично, без кроків для людини.
// Cloudflare cron кожні 5 хвилин бере до шести матеріалів, у яких ще немає німецького тексту
// або український змінився після перекладу, — але лише через 2 години після останньої правки,
// бо тексти ще деякий час правлять після публікації. Спершу проєкти, потім новини (найсвіжіші першими).
// Ключ — той самий OPENAI_API_KEY, що й для автоперекладу в адмінці.

const SETTLE_SQL = "datetime('now', '-2 hours')";
const LOCK_KEY = "de_translate_lock";
const LOCK_MINUTES = 12;
const RETRY_AFTER_HOURS = 6;

const STATE_TABLE_SQL = "CREATE TABLE IF NOT EXISTS scheduler_state (key TEXT PRIMARY KEY, value TEXT)";
const ERRORS_TABLE_SQL =
  "CREATE TABLE IF NOT EXISTS translation_errors (kind TEXT NOT NULL, item_id INTEGER NOT NULL, lang TEXT NOT NULL, failed_at TEXT NOT NULL, error TEXT, PRIMARY KEY (kind, item_id, lang))";

const RULES = [
  "You are a senior German-language news editor and translator for ProMedia, a Ukrainian NGO that publishes news about media, journalism and communications.",
  "Translate the Ukrainian original into natural, idiomatic Standard German (Germany) in a clear journalistic register for German-speaking journalists, researchers, media-development organisations and donors.",
  "An English version of the same text is attached as a reference only: follow its spelling of personal names, organisations and media brands, and its short explanations of Ukrainian realities. If the Ukrainian original and the English reference differ, the Ukrainian original wins.",
  "Write Ukrainian personal names exactly as in the English reference (passport-style Latin, e.g. Andrii Ianitskyi); never re-transliterate them into German conventions. Media brands keep the spelling of their own logo (Texty.org.ua, Suspilne, Ukrainska Pravda).",
  "Use established German place names where they exist: die Ukraine, Kyjiw, Lwiw, Charkiw, Odesa, Dnipro, Saporischschja, Mykolajiw, Cherson, die Krim. Crimea is part of Ukraine; never describe it otherwise.",
  "At the first mention, briefly explain Ukrainian institutions or realities a German reader may not know (e.g. „Suspilne, der öffentlich-rechtliche Rundfunk der Ukraine“), as the English reference does. Keep such explanations short and add no new facts.",
  "When a Ukrainian media outlet, publisher or newsroom is mentioned, make clear at the first mention that it is Ukrainian (e.g. „das ukrainische Medium Texty.org.ua“, „der ukrainische Verlag Lokalna Istorija“) — the Ukrainian original omits this because its readers know it. Foreign media need no such label.",
  "ГО «ПроМедіа» / ProMedia is always „ProMedia“ (the organisation: „die NGO ProMedia“). Keep „ProMedia Report“ and other product names unchanged.",
  "Write the Standard German of Germany, not Austrian or Swiss variants: Januar (never Jänner), Februar (never Feber). In genitive forms of personal names never insert a hyphen: Taylor Swifts Fans, not Taylor-Swifts Fans.",
  "Use German quotation marks „…“ in running text. Use the feminine form for women's roles (Journalistin, Redakteurin, Chefredakteurin). For mixed groups prefer pair forms or neutral wording (Journalistinnen und Journalisten, Medienschaffende); never use the gender star or colon.",
  "Attribute sources in the sentence (who reports or says it). After a quoted headline-style source, write „…, berichtet Texty.org.ua“ rather than a dash.",
  "Preserve Markdown exactly: headings, lists, blockquotes, tables, **bold**, *italics*, ==highlighted phrases== (keep the == markers around the corresponding German phrase), links [text](url) with unchanged URLs, images ![alt](url) with unchanged URLs (translate alt text and captions), embedded video lines and the notes block after a line with ---. Keep paragraph breaks.",
  "Translate everything that is Ukrainian prose; leave no Ukrainian or Russian words except proper names already in Latin. Do not add, drop or soften facts, numbers, dates, quotes, links or legal caveats (allegations stay „mutmaßlich“/attributed).",
  "The excerpt is a German SEO teaser under 170 characters. If the Ukrainian excerpt is empty, write one from the text.",
  "Return empty strings for fields whose Ukrainian source is empty."
].join("\n");

const ARTICLE_FIELDS = [
  ["title", "titleDe"], ["excerpt", "excerptDe"], ["body_md", "bodyMdDe"]
];
const PROJECT_FIELDS = [
  ["title", "titleDe"], ["excerpt", "excerptDe"], ["body_md", "bodyMdDe"], ["work_md", "workMdDe"],
  ["results_md", "resultsMdDe"], ["partner", "partnerDe"], ["donor", "donorDe"], ["period_label", "periodLabelDe"]
];

function schemaFor(fields) {
  const properties = Object.fromEntries(fields.map(([, key]) => [key, { type: "string" }]));
  return { type: "object", additionalProperties: false, required: fields.map(([, key]) => key), properties };
}

function responseText(data) {
  if (typeof data.output_text === "string") return data.output_text;
  const chunks = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) if (typeof content.text === "string") chunks.push(content.text);
  }
  return chunks.join("");
}

// Мінімальні виправлення того, що модель іноді пише по-своєму.
export function normalizeGerman(text) {
  return String(text || "")
    .replace(/\bJänner/g, "Januar")
    .replace(/\bFeber\b/g, "Februar")
    .replace(/\bKiew\b/g, "Kyjiw")
    .replace(/\bLemberg\b/g, "Lwiw")
    .replace(/\bCharkow\b/g, "Charkiw")
    .replace(/\bOdessa\b/g, "Odesa")
    .replace(/\bYanitskyi\b/g, "Ianitskyi")
    .replace(/\bJanizkyj\b/g, "Ianitskyi")
    .trim();
}

export async function translateToGerman(env, kind, source) {
  const apiKey = String(env.OPENAI_API_KEY || "").trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
  let fields = kind === "project" ? PROJECT_FIELDS : ARTICLE_FIELDS;
  const original = Object.fromEntries(fields.map(([col]) => [col, String(source[col] || "")]));
  const english = Object.fromEntries(fields.map(([col]) => [col, String(source[`${col}_en`] || "")]));
  // Підпис обкладинки новини (cover_crop_data.caption) теж перекладаємо, якщо німецького ще немає.
  const caption = kind === "article" ? coverCaptionOf(source) : null;
  if (caption?.uk && !caption.de) {
    fields = [...fields, ["cover_caption", "coverCaptionDe"]];
    original.cover_caption = String(caption.uk);
    english.cover_caption = String(caption.en || "");
  }
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: env.OPENAI_TRANSLATE_MODEL || env.OPENAI_MODEL || "gpt-5-mini",
      store: false,
      reasoning: { effort: "low" },
      input: [
        { role: "system", content: [{ type: "input_text", text: RULES }] },
        { role: "user", content: [{ type: "input_text", text: JSON.stringify({ kind, ukrainianOriginal: original, englishReference: english }) }] }
      ],
      text: { format: { type: "json_schema", name: `promedia_${kind}_de`, strict: true, schema: schemaFor(fields) } }
    })
  });
  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { throw new Error(`OpenAI returned non-JSON (HTTP ${response.status})`); }
  if (!response.ok) throw new Error(data?.error?.message || `OpenAI API ${response.status}`);
  const parsed = JSON.parse(responseText(data));
  const out = {};
  for (const [col, key] of fields) out[`${col}_de`] = original[col].trim() ? normalizeGerman(parsed[key]) : "";
  if (!out.title_de) throw new Error("Empty German title");
  if (original.body_md.trim() && out.body_md_de.length < original.body_md.length * 0.5) {
    throw new Error("German body looks truncated");
  }
  return out;
}

function coverMetaOf(row) {
  try { const m = typeof row.cover_crop_data === "string" ? JSON.parse(row.cover_crop_data) : row.cover_crop_data; return m && typeof m === "object" ? m : {}; } catch { return {}; }
}
function coverCaptionOf(row) {
  const c = coverMetaOf(row).caption;
  return c && typeof c === "object" ? c : null;
}

async function takeLock(db) {
  await db.prepare(STATE_TABLE_SQL).run();
  const row = await db.prepare("SELECT value FROM scheduler_state WHERE key = ?").bind(LOCK_KEY).first();
  if (row?.value && Date.parse(row.value) > Date.now() - LOCK_MINUTES * 60 * 1000) return false;
  await db.prepare(
    "INSERT INTO scheduler_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).bind(LOCK_KEY, new Date().toISOString()).run();
  return true;
}
async function releaseLock(db) {
  await db.prepare("UPDATE scheduler_state SET value = '' WHERE key = ?").bind(LOCK_KEY).run();
}

const NOT_FAILED_RECENTLY = (kind, alias) => `NOT EXISTS (SELECT 1 FROM translation_errors e WHERE e.kind = '${kind}' AND e.item_id = ${alias}.id AND e.lang = 'de' AND datetime(e.failed_at) > datetime('now', '-${RETRY_AFTER_HOURS} hours'))`;

export async function pendingGerman(db) {
  await db.prepare(ERRORS_TABLE_SQL).run();
  // Спершу проєкти (їх небагато, а каталог /de/ показує лише перекладені), потім новини: закріплена й головна
  // з фото — першими (щоб німецька стрічка виглядала як українська), далі найсвіжіші.
  const project = await db.prepare(
    `SELECT p.* FROM projects p WHERE p.publication_status = 'published' AND p.deleted_at IS NULL
       AND (p.title_de IS NULL OR p.title_de = '' OR p.de_translated_at IS NULL OR datetime(p.de_translated_at) < datetime(COALESCE(p.updated_at, p.published_at)))
       AND datetime(COALESCE(p.updated_at, p.published_at, p.created_at)) <= ${SETTLE_SQL} AND ${NOT_FAILED_RECENTLY("project", "p")}
     ORDER BY p.id DESC LIMIT 1`
  ).first().catch(() => null);
  if (project) return { kind: "project", row: project };
  const article = await db.prepare(
    `SELECT a.* FROM articles a WHERE a.status = 'published' AND a.deleted_at IS NULL
       AND (a.title_de IS NULL OR a.title_de = '' OR a.de_translated_at IS NULL OR datetime(a.de_translated_at) < datetime(COALESCE(a.updated_at, a.published_at)))
       AND datetime(COALESCE(a.updated_at, a.published_at, a.created_at)) <= ${SETTLE_SQL} AND ${NOT_FAILED_RECENTLY("article", "a")}
     ORDER BY (a.pinned_at IS NOT NULL) DESC, (a.card_style = 'hero') DESC, a.published_at DESC LIMIT 1`
  ).first();
  if (article) return { kind: "article", row: article };
  return null;
}

// До шести матеріалів за запуск (кожні 5 хвилин), але не довше 4 хвилин. Повертає перекладені slug.
export async function runGermanTranslation(env, { maxItems = 6, budgetMs = 4 * 60 * 1000 } = {}) {
  const db = env.DB;
  if (!String(env.OPENAI_API_KEY || "").trim()) return [];
  if (!(await takeLock(db))) return [];
  const started = Date.now();
  const done = [];
  try {
    for (let n = 0; n < maxItems && Date.now() - started < budgetMs; n++) {
      const job = await pendingGerman(db);
      if (!job) break;
      const { kind, row } = job;
      const table = kind === "project" ? "projects" : "articles";
      try {
        const de = await translateToGerman(env, kind, row);
        const captionDe = de.cover_caption_de;
        delete de.cover_caption_de;
        if (captionDe) {
          const meta = coverMetaOf(row);
          meta.caption = { ...(meta.caption || {}), de: captionDe };
          de.cover_crop_data = JSON.stringify(meta);
        }
        const cols = Object.keys(de);
        // updated_at не чіпаємо: переклад — не редакційна правка.
        await db.prepare(
          `UPDATE ${table} SET ${cols.map(c => `${c} = ?`).join(", ")}, de_translated_at = ? WHERE id = ?`
        ).bind(...cols.map(c => de[c] || null), new Date().toISOString(), row.id).run();
        await db.prepare("DELETE FROM translation_errors WHERE kind = ? AND item_id = ? AND lang = 'de'").bind(kind, row.id).run();
        done.push(row.slug);
      } catch (err) {
        await db.prepare(
          "INSERT INTO translation_errors (kind, item_id, lang, failed_at, error) VALUES (?, ?, 'de', ?, ?) ON CONFLICT(kind, item_id, lang) DO UPDATE SET failed_at = excluded.failed_at, error = excluded.error"
        ).bind(kind, row.id, new Date().toISOString(), String(err?.message || err).slice(0, 500)).run();
        console.error("de-translate", kind, row.slug, err?.message || err);
        // Ключ не працює чи закінчились кошти — не мучимо API до наступного запуску.
        if (/api key|quota|billing|insufficient|401|429/i.test(String(err?.message || ""))) break;
      }
    }
  } finally {
    await releaseLock(db);
  }
  return done;
}

export async function germanStatus(db) {
  await db.prepare(ERRORS_TABLE_SQL).run();
  const a = await db.prepare(
    "SELECT COUNT(*) AS total, SUM(CASE WHEN title_de IS NOT NULL AND title_de != '' THEN 1 ELSE 0 END) AS done FROM articles WHERE status = 'published' AND deleted_at IS NULL"
  ).first();
  const p = await db.prepare(
    "SELECT COUNT(*) AS total, SUM(CASE WHEN title_de IS NOT NULL AND title_de != '' THEN 1 ELSE 0 END) AS done FROM projects WHERE publication_status = 'published' AND deleted_at IS NULL"
  ).first().catch(() => null);
  const errors = (await db.prepare("SELECT kind, item_id, failed_at, error FROM translation_errors WHERE lang = 'de' ORDER BY failed_at DESC LIMIT 10").all()).results || [];
  return { articles: { total: a?.total || 0, translated: a?.done || 0 }, projects: { total: p?.total || 0, translated: p?.done || 0 }, errors };
}
