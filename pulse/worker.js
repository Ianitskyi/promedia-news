import { handleStat, isStatHost } from "./stat.js";
// «Пульс ПроМедіа» — див. wrangler.toml.
// Маршрути:
//   GET  /            — коротка сторінка-статус
//   GET  /setup       — форма разового налаштування (потрібен код налаштування)
//   POST /setup       — зберігає ключ Google і токен бота, вмикає вебхук Telegram
//   POST /tg          — вебхук Telegram (/start реєструє чат, /now і /today — зведення)
//   POST /mcp/<key>   — конектор для Claude (MCP, Streamable HTTP, без сесій)

const TZ = "Europe/Kyiv";
const GA_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const MCP_PROTOCOL = "2025-06-18";

// ───────────────────────── сховище (D1) ─────────────────────────

let schemaReady = false;
async function ensureSchema(env) {
  if (schemaReady) return;
  await env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS pulse_kv (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS pulse_samples (ts INTEGER PRIMARY KEY, users INTEGER NOT NULL)"),
  ]);
  schemaReady = true;
}

async function kvGet(env, key) {
  await ensureSchema(env);
  const row = await env.DB.prepare("SELECT value FROM pulse_kv WHERE key = ?").bind(key).first();
  return row ? row.value : null;
}
async function kvGetJson(env, key) {
  const v = await kvGet(env, key);
  if (!v) return null;
  try { return JSON.parse(v); } catch { return null; }
}
async function kvSet(env, key, value) {
  await ensureSchema(env);
  const v = typeof value === "string" ? value : JSON.stringify(value);
  await env.DB.prepare("INSERT INTO pulse_kv (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
    .bind(key, v, Date.now()).run();
}
async function kvDel(env, key) {
  await ensureSchema(env);
  await env.DB.prepare("DELETE FROM pulse_kv WHERE key = ?").bind(key).run();
}

// ───────────────────────── дрібниці ─────────────────────────

function randomToken(bytes = 24) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function sha256Hex(text) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function b64url(input) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function kyivParts(date = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(date).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) % 24, minute: Number(p.minute), hm: `${p.hour}:${p.minute}` };
}
function num(n) {
  return Number(n || 0).toLocaleString("uk-UA");
}
function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", ...headers } });
}
function html(body, status = 200) {
  return new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

// ───────────────────────── власний ключ сервісного акаунта ─────────────────────────
// Пара ключів генерується тут, у воркері; приватний ключ не покидає D1.
// Публічний сертифікат (GET /setup/cert) завантажується в Google Cloud
// («Сервісний акаунт → Ключі → Додати ключ → Завантажити наявний ключ»).
function der(tag, content) {
  const len = content.length;
  let lenBytes;
  if (len < 0x80) lenBytes = [len];
  else { const b = []; let n = len; while (n > 0) { b.unshift(n & 0xff); n >>= 8; } lenBytes = [0x80 | b.length, ...b]; }
  const out = new Uint8Array(1 + lenBytes.length + len);
  out[0] = tag; out.set(lenBytes, 1); out.set(content, 1 + lenBytes.length);
  return out;
}
const cat = (...parts) => { const n = parts.reduce((s, p) => s + p.length, 0); const o = new Uint8Array(n); let i = 0; for (const p of parts) { o.set(p, i); i += p.length; } return o; };
const seq = (...p) => der(0x30, cat(...p));
const oid = (bytes) => der(0x06, new Uint8Array(bytes));
const utf8 = (s) => der(0x0c, new TextEncoder().encode(s));
const utc = (d) => { const p = (n) => String(n).padStart(2, "0"); return der(0x17, new TextEncoder().encode(`${p(d.getUTCFullYear() % 100)}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`)); };
async function selfSignedCert(keyPair, cn) {
  const spki = new Uint8Array(await crypto.subtle.exportKey("spki", keyPair.publicKey));
  const sha256rsa = seq(oid([0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x0b]), new Uint8Array([0x05, 0x00]));
  const name = seq(der(0x31, seq(oid([0x55, 0x04, 0x03]), utf8(cn))));
  const serial = crypto.getRandomValues(new Uint8Array(16)); serial[0] = (serial[0] & 0x7f) | 0x01;
  const now = new Date(Date.now() - 3600_000), until = new Date(Date.UTC(2036, 0, 1));
  const tbs = seq(der(0xa0, der(0x02, new Uint8Array([2]))), der(0x02, serial), sha256rsa, name, seq(utc(now), utc(until)), name, spki);
  const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", keyPair.privateKey, tbs));
  const cert = seq(tbs, sha256rsa, der(0x03, cat(new Uint8Array([0]), sig)));
  let s = ""; for (const b of cert) s += String.fromCharCode(b);
  const b64 = btoa(s).match(/.{1,64}/g).join("\n");
  return `-----BEGIN CERTIFICATE-----\n${b64}\n-----END CERTIFICATE-----\n`;
}

async function ensureOwnKey(env) {
  let pem = await kvGet(env, "ga_cert_pem");
  if (pem) return pem;
  const kp = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", kp.privateKey));
  let s = ""; for (const b of pkcs8) s += String.fromCharCode(b);
  pem = await selfSignedCert(kp, "promedia-pulse");
  await kvSet(env, "ga_private_pkcs8", btoa(s));
  await kvSet(env, "ga_cert_pem", pem);
  return pem;
}

async function serviceAccount(env) {
  const sa = await kvGetJson(env, "ga_sa_key");
  if (sa && sa.private_key && sa.client_email) return sa;
  const pkcs8 = await kvGet(env, "ga_private_pkcs8");
  if (pkcs8 && env.GA_SA_EMAIL) return { client_email: env.GA_SA_EMAIL, private_key: pkcs8, private_key_id: env.GA_KEY_ID || undefined };
  return null;
}

// ───────────────────────── Google Analytics ─────────────────────────

let tokenCache = null; // { token, exp }

async function googleToken(env) {
  if (tokenCache && tokenCache.exp > Date.now() + 60_000) return tokenCache.token;
  const sa = await serviceAccount(env);
  if (!sa) throw new Error("Доступ до Google ще не налаштовано (сторінка /setup).");
  return fetchGoogleToken(sa);
}

async function fetchGoogleToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify(sa.private_key_id ? { alg: "RS256", typ: "JWT", kid: sa.private_key_id } : { alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({ iss: sa.client_email, scope: GA_SCOPE, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${header}.${claims}`));
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${header}.${claims}.${b64url(sig)}` }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) throw new Error(`Google не видав доступ: ${data.error_description || data.error || res.status}`);
  tokenCache = { token: data.access_token, exp: Date.now() + (data.expires_in || 3600) * 1000 };
  return tokenCache.token;
}

async function ga(env, method, body) {
  const token = await googleToken(env);
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${env.GA_PROPERTY_ID}:${method}`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || res.status;
    if (res.status === 403) throw new Error(`GA4 відмовив у доступі (${msg}). Перевірте, що сервісний акаунт доданий до ресурсу GA4 з роллю «Переглядач».`);
    throw new Error(`Помилка GA4: ${msg}`);
  }
  return data;
}

function rowsOf(report) {
  const dims = (report.dimensionHeaders || []).map((h) => h.name);
  const mets = (report.metricHeaders || []).map((h) => h.name);
  return (report.rows || []).map((r) => {
    const o = {};
    dims.forEach((d, i) => (o[d] = r.dimensionValues[i].value));
    mets.forEach((m, i) => (o[m] = Number(r.metricValues[i].value)));
    return o;
  });
}

const rt = (env, dims, minutes = 30, limit = 10, metric = "activeUsers") =>
  ga(env, "runRealtimeReport", {
    dimensions: dims.map((name) => ({ name })),
    metrics: [{ name: metric }],
    minuteRanges: [{ startMinutesAgo: minutes - 1, endMinutesAgo: 0 }],
    orderBys: dims.length ? [{ metric: { metricName: metric }, desc: true }] : undefined,
    limit,
  }).then(rowsOf);

async function activeUsersLast(env, minutes) {
  const rows = await rt(env, [], minutes, 1);
  return rows[0]?.activeUsers || 0;
}

// Зведення «просто зараз» (за останні 30 хвилин, уся мережа сайтів ПроМедіа)
async function pulseNow(env) {
  const [total30, total5, perMinute, countries, cities, pages, devices] = await Promise.all([
    activeUsersLast(env, 30),
    activeUsersLast(env, 5),
    rt(env, ["minutesAgo"], 30, 30),
    rt(env, ["country"], 30, 10),
    rt(env, ["city"], 30, 10),
    rt(env, ["unifiedScreenName"], 30, 10, "screenPageViews"),
    rt(env, ["deviceCategory"], 30, 5),
  ]);
  const series = Array.from({ length: 30 }, (_, i) => {
    const ago = 29 - i;
    const r = perMinute.find((x) => Number(x.minutesAgo) === ago);
    return { minutes_ago: ago, users: r ? r.activeUsers : 0 };
  });
  const baseline = await baselineFor(env, new Date());
  return {
    generated_at: new Date().toISOString(),
    kyiv_time: kyivParts().hm,
    scope: "Усі сайти ПроМедіа (один ресурс GA4). Реальний час: останні 30 хвилин.",
    active_users_30min: total30,
    active_users_5min: total5,
    usual_5min: baseline,
    per_minute: series,
    countries: countries.map((r) => ({ country: r.country, users: r.activeUsers })),
    cities: cities.map((r) => ({ city: r.city, users: r.activeUsers })),
    pages: pages.map((r) => ({ title: r.unifiedScreenName, views: r.screenPageViews })),
    devices: devices.map((r) => ({ device: r.deviceCategory, users: r.activeUsers })),
  };
}

// Зведення за сьогодні (стандартні звіти GA4: тут є джерела трафіку й адреси сторінок; дані з затримкою)
const GA_DATE = /^(today|yesterday|[0-9]{1,4}daysAgo|20[0-9]{2}-[01][0-9]-[0-3][0-9])$/;

function periodOf({ days = 1, start_date = "", end_date = "" } = {}) {
  if (start_date || end_date) {
    const s = String(start_date || "today"), e = String(end_date || "today");
    if (!GA_DATE.test(s) || !GA_DATE.test(e)) throw new Error("Дати періоду: YYYY-MM-DD, today, yesterday або NdaysAgo.");
    const label = s === e ? (s === "today" ? "сьогодні" : s) : `${s} — ${e}`;
    return { range: { startDate: s, endDate: e }, label };
  }
  const d = Math.max(1, Math.min(730, Number(days) || 1));
  return { range: { startDate: d === 1 ? "today" : `${d - 1}daysAgo`, endDate: "today" }, label: d === 1 ? "сьогодні (за Києвом)" : `останні ${d} дн.` };
}

async function pulseToday(env, { host = "", days = 1, start_date = "", end_date = "" } = {}) {
  const per = periodOf({ days, start_date, end_date });
  const dateRanges = [per.range];
  const filter = host ? { dimensionFilter: { filter: { fieldName: "hostName", stringFilter: { matchType: "EXACT", value: host } } } } : {};
  const rep = (dims, metrics, limit, extra = {}) =>
    ga(env, "runReport", {
      dateRanges, dimensions: dims.map((name) => ({ name })), metrics: metrics.map((name) => ({ name })),
      orderBys: [{ metric: { metricName: metrics[0] }, desc: true }], limit, ...filter, ...extra,
    }).then(rowsOf);
  const [totals, hosts, sources, pages, countries] = await Promise.all([
    ga(env, "runReport", { dateRanges, metrics: [{ name: "activeUsers" }, { name: "screenPageViews" }, { name: "sessions" }], ...filter }).then(rowsOf),
    host ? Promise.resolve([]) : rep(["hostName"], ["activeUsers", "screenPageViews"], 15),
    rep(["sessionSource", "sessionMedium"], ["sessions", "activeUsers"], 12),
    rep(["hostName", "pagePath", "pageTitle"], ["screenPageViews", "activeUsers"], 12),
    rep(["country"], ["activeUsers"], 10),
  ]);
  const t = totals[0] || {};
  return {
    generated_at: new Date().toISOString(),
    period: per.label,
    scope: host || "усі сайти ПроМедіа",
    note: "Стандартні звіти GA4 оновлюються із затримкою (зазвичай кілька десятків хвилин).",
    users: t.activeUsers || 0,
    pageviews: t.screenPageViews || 0,
    sessions: t.sessions || 0,
    sites: hosts.map((r) => ({ host: r.hostName, users: r.activeUsers, views: r.screenPageViews })),
    sources: sources.map((r) => ({ source: r.sessionSource, medium: r.sessionMedium, sessions: r.sessions, users: r.activeUsers })),
    pages: pages.map((r) => ({ url: `https://${r.hostName}${r.pagePath}`, title: r.pageTitle, views: r.screenPageViews, users: r.activeUsers })),
    countries: countries.map((r) => ({ country: r.country, users: r.activeUsers })),
  };
}

// ───────────────────────── історія і «звичайний рівень» ─────────────────────────

async function saveSample(env, ts, users) {
  await ensureSchema(env);
  await env.DB.batch([
    env.DB.prepare("INSERT OR REPLACE INTO pulse_samples (ts, users) VALUES (?, ?)").bind(ts, users),
    env.DB.prepare("DELETE FROM pulse_samples WHERE ts < ?").bind(ts - 21 * 86400_000),
  ]);
}

// Середня кількість людей за 5 хв у цю ж годину доби за попередні 14 днів;
// якщо історії ще мало — середнє за останні 24 години (без останніх 30 хвилин).
async function baselineFor(env, date) {
  await ensureSchema(env);
  const now = date.getTime();
  const { results } = await env.DB.prepare("SELECT ts, users FROM pulse_samples WHERE ts >= ? AND ts < ?")
    .bind(now - 14 * 86400_000, now - 30 * 60_000).all();
  if (!results || results.length < 12) return null;
  const hour = kyivParts(date).hour;
  const sameHour = results.filter((r) => {
    const h = kyivParts(new Date(r.ts)).hour;
    return h === hour && now - r.ts > 6 * 3600_000;
  });
  const pool = sameHour.length >= 6 ? sameHour : results.filter((r) => now - r.ts < 24 * 3600_000);
  if (!pool.length) return null;
  return Math.round((pool.reduce((s, r) => s + r.users, 0) / pool.length) * 10) / 10;
}

async function pulseHistory(env, hours = 24) {
  await ensureSchema(env);
  const h = Math.max(1, Math.min(24 * 14, Number(hours) || 24));
  const { results } = await env.DB.prepare("SELECT ts, users FROM pulse_samples WHERE ts >= ? ORDER BY ts")
    .bind(Date.now() - h * 3600_000).all();
  return {
    hours: h,
    note: "Кожна точка — скільки людей було на сайтах ПроМедіа за 5 хвилин до цього моменту (перевірка кожні 5 хвилин).",
    rows: (results || []).map((r) => ({ time: new Date(r.ts).toISOString(), kyiv: kyivParts(new Date(r.ts)).hm, users: r.users })),
  };
}

// ───────────────────────── Telegram ─────────────────────────

async function tg(env, method, payload, token) {
  const t = token || (await kvGet(env, "tg_token"));
  if (!t) throw new Error("Токен бота не налаштовано.");
  const res = await fetch(`https://api.telegram.org/bot${t}/${method}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) throw new Error(`Telegram: ${data.description || res.status}`);
  return data.result;
}

async function notify(env, text) {
  const chat = await kvGet(env, "tg_chat_id");
  if (!chat) return false;
  await tg(env, "sendMessage", { chat_id: chat, text, parse_mode: "HTML", disable_web_page_preview: true });
  return true;
}

function nowText(n) {
  const lines = [`📊 <b>Зараз на сайтах ПроМедіа</b> (${n.kyiv_time})`,
    `За 30 хв: <b>${num(n.active_users_30min)}</b> · за 5 хв: <b>${num(n.active_users_5min)}</b>` +
      (n.usual_5min != null ? ` (зазвичай ~${num(n.usual_5min)})` : "")];
  if (n.pages.length) lines.push("", "<b>Читають:</b>", ...n.pages.slice(0, 5).map((p) => `• ${esc(p.title)} — ${num(p.views)}`));
  if (n.cities.length) lines.push("", "<b>Міста:</b> " + n.cities.slice(0, 6).map((c) => `${esc(c.city)} ${c.users}`).join(", "));
  if (n.countries.length) lines.push("<b>Країни:</b> " + n.countries.slice(0, 5).map((c) => `${esc(c.country)} ${c.users}`).join(", "));
  if (n.devices.length) lines.push("<b>Пристрої:</b> " + n.devices.map((d) => `${esc(d.device)} ${d.users}`).join(", "));
  return lines.join("\n");
}

function todayText(t, title = "📅 <b>Підсумок дня</b>") {
  const lines = [`${title} — ${esc(t.scope)}`,
    `Читачів: <b>${num(t.users)}</b> · переглядів: <b>${num(t.pageviews)}</b>`];
  if (t.sites.length) lines.push("", "<b>Сайти:</b>", ...t.sites.slice(0, 6).map((s) => `• ${esc(s.host)} — ${num(s.users)}`));
  if (t.pages.length) lines.push("", "<b>Найпопулярніше:</b>", ...t.pages.slice(0, 5).map((p) => `• <a href="${esc(p.url)}">${esc(p.title || p.url)}</a> — ${num(p.views)}`));
  if (t.sources.length) lines.push("", "<b>Звідки:</b> " + t.sources.slice(0, 6).map((s) => `${esc(s.source)} ${num(s.sessions)}`).join(", "));
  lines.push("", `<i>${esc(t.note)}</i>`);
  return lines.join("\n");
}

async function handleTelegram(request, env) {
  const secret = await kvGet(env, "tg_webhook_secret");
  if (!secret || request.headers.get("x-telegram-bot-api-secret-token") !== secret) return new Response("forbidden", { status: 403 });
  const update = await request.json().catch(() => ({}));
  const msg = update.message;
  if (!msg || !msg.chat) return new Response("ok");
  const chatId = String(msg.chat.id);
  const registered = await kvGet(env, "tg_chat_id");
  const text = (msg.text || "").trim();
  try {
    if (!registered) {
      if (msg.chat.type !== "private") return new Response("ok");
      await kvSet(env, "tg_chat_id", chatId);
      const mcp = await kvGet(env, "mcp_key");
      const origin = new URL(request.url).origin;
      await tg(env, "sendMessage", {
        chat_id: chatId, parse_mode: "HTML", disable_web_page_preview: true,
        text: [
          "✅ <b>Пульс ПроМедіа підключено.</b>",
          "Сюди приходитимуть повідомлення, лише коли трафік незвично зросте, і короткий підсумок дня ввечері.",
          "", "Команди: /now — хто зараз на сайтах, /today — підсумок за сьогодні.",
          "", "<b>Адреса конектора для Claude</b> (нікому не пересилайте):", `<code>${origin}/mcp/${mcp}</code>`,
        ].join("\n"),
      });
      return new Response("ok");
    }
    if (chatId !== registered) return new Response("ok"); // чужі чати ігноруємо
    if (/^\/now\b/.test(text)) await notify(env, nowText(await pulseNow(env)));
    else if (/^\/today\b/.test(text)) await notify(env, todayText(await pulseToday(env), "📅 <b>Сьогодні</b>"));
    else if (/^\/start\b/.test(text) || /^\/help\b/.test(text)) await notify(env, "Команди: /now — хто зараз на сайтах, /today — підсумок за сьогодні.");
  } catch (e) {
    await notify(env, `⚠️ ${esc(e.message)}`).catch(() => {});
  }
  return new Response("ok");
}

// ───────────────────────── перевірка кожні 5 хвилин ─────────────────────────

function inQuietHours(env, hour) {
  const m = String(env.QUIET_HOURS || "").match(/^(\d{1,2})-(\d{1,2})$/);
  if (!m) return false;
  const a = Number(m[1]), b = Number(m[2]);
  return a <= b ? hour >= a && hour < b : hour >= a || hour < b;
}

async function scheduled(env, scheduledTime) {
  if (!(await serviceAccount(env))) return; // ще не налаштовано
  const when = new Date(scheduledTime);
  const ts = Math.floor(scheduledTime / 300_000) * 300_000;
  const users = await activeUsersLast(env, 5);
  const baseline = await baselineFor(env, when);
  await saveSample(env, ts, users);
  await kvSet(env, "last_ok", { at: new Date(ts).toISOString(), users });

  const mult = Number(env.ALERT_MULTIPLIER) || 3;
  const minUsers = Number(env.ALERT_MIN_USERS) || 10;
  const k = kyivParts(when);
  const state = (await kvGetJson(env, "alert_state")) || { active: false };
  const quiet = inQuietHours(env, k.hour);
  // Поки історії мало (перші години), тривога лише на дуже помітний сплеск
  const threshold = baseline == null ? Math.max(minUsers * 3, 30) : Math.max(minUsers, baseline * mult);

  if (!state.active && users >= threshold) {
    const now = await pulseNow(env).catch(() => null);
    const lines = [`🔥 <b>Сплеск на сайтах ПроМедіа</b> (${k.hm})`,
      `Зараз: <b>${num(users)}</b> людей за 5 хв` + (baseline != null ? `, зазвичай ~${num(baseline)} (×${(users / Math.max(baseline, 0.5)).toFixed(1)})` : "")];
    if (now?.pages.length) lines.push("", "<b>Читають:</b>", ...now.pages.slice(0, 3).map((p) => `• ${esc(p.title)} — ${num(p.views)}`));
    if (now?.cities.length) lines.push("<b>Міста:</b> " + now.cities.slice(0, 5).map((c) => `${esc(c.city)} ${c.users}`).join(", "));
    if (now?.countries.length) lines.push("<b>Країни:</b> " + now.countries.slice(0, 4).map((c) => `${esc(c.country)} ${c.users}`).join(", "));
    lines.push("", "Звідки прийшли (Facebook, Google, Telegram…) GA показує із затримкою — /today або спитайте Claude.");
    if (!quiet) await notify(env, lines.join("\n"));
    await kvSet(env, "alert_state", { active: true, since: ts, peak: users, notified: quiet ? 0 : users, baseline, calm: 0 });
  } else if (state.active) {
    state.peak = Math.max(state.peak || 0, users);
    // ще суттєвіше зростання — одне додаткове повідомлення на кожне подвоєння
    if (!quiet && users >= Math.max(2 * (state.notified || 0), threshold)) {
      await notify(env, `📈 Ажіотаж росте: <b>${num(users)}</b> людей за 5 хв (${k.hm}).`);
      state.notified = users;
    }
    const calmLevel = baseline == null ? threshold / 2 : Math.max(minUsers / 2, baseline * 1.5);
    state.calm = users < calmLevel ? (state.calm || 0) + 1 : 0;
    if (state.calm >= 2) {
      const mins = Math.round((ts - state.since) / 60_000);
      if (!quiet && state.notified) await notify(env, `✅ Трафік повернувся до звичного (${k.hm}). Сплеск тривав ~${mins} хв, пік — ${num(state.peak)} людей за 5 хв.`);
      await kvSet(env, "alert_state", { active: false });
    } else {
      await kvSet(env, "alert_state", state);
    }
  }

  // Підсумок дня — раз на добу в задану годину за Києвом
  const hour = String(env.DAILY_SUMMARY_HOUR || "").trim();
  if (hour !== "" && k.hour === Number(hour) && k.minute < 5) {
    const last = await kvGet(env, "summary_date");
    if (last !== k.date) {
      await kvSet(env, "summary_date", k.date);
      await notify(env, todayText(await pulseToday(env)));
    }
  }
}

// ───────────────────────── MCP-конектор для Claude ─────────────────────────

// Частини для дашборда: кожна віддає {rows: [...]} і робить лише потрібний запит до GA.
async function nowPart(env, part) {
  switch (part) {
    case "summary": {
      const [a30, a5, base] = await Promise.all([activeUsersLast(env, 30), activeUsersLast(env, 5), baselineFor(env, new Date())]);
      return { rows: [{ active_30min: a30, active_5min: a5, usual_5min: base, kyiv_time: kyivParts().hm }] };
    }
    case "minutes": {
      const per = await rt(env, ["minutesAgo"], 30, 30);
      return { rows: Array.from({ length: 30 }, (_, i) => {
        const ago = 29 - i; const r = per.find((x) => Number(x.minutesAgo) === ago);
        return { minutes_ago: ago, users: r ? r.activeUsers : 0 };
      }) };
    }
    case "countries": return { rows: (await rt(env, ["country"], 30, 10)).map((r) => ({ country: r.country, users: r.activeUsers })) };
    case "cities": return { rows: (await rt(env, ["city"], 30, 10)).map((r) => ({ city: r.city, users: r.activeUsers })) };
    case "pages": return { rows: (await rt(env, ["unifiedScreenName"], 30, 10, "screenPageViews")).map((r) => ({ title: r.unifiedScreenName, views: r.screenPageViews })) };
    case "devices": return { rows: (await rt(env, ["deviceCategory"], 30, 5)).map((r) => ({ device: r.deviceCategory, users: r.activeUsers })) };
    default: return pulseNow(env);
  }
}

async function todayPart(env, part, args) {
  if (part === "daily") {
    const per = periodOf(args);
    const host = args.host || "";
    const rep = await ga(env, "runReport", {
      dateRanges: [per.range], dimensions: [{ name: "date" }],
      metrics: [{ name: "activeUsers" }, { name: "screenPageViews" }],
      orderBys: [{ dimension: { dimensionName: "date" } }], limit: 1000,
      ...(host ? { dimensionFilter: { filter: { fieldName: "hostName", stringFilter: { matchType: "EXACT", value: host } } } } : {}),
    });
    return { rows: rowsOf(rep).map((r) => ({ date: `${r.date.slice(0, 4)}-${r.date.slice(4, 6)}-${r.date.slice(6, 8)}`, users: r.activeUsers, views: r.screenPageViews })) };
  }
  if (!part) return pulseToday(env, args);
  const t = await pulseToday(env, args);
  if (part === "summary") return { rows: [{ users: t.users, pageviews: t.pageviews, sessions: t.sessions, period: t.period }] };
  if (["sites", "sources", "pages", "countries"].includes(part)) return { rows: t[part] };
  return t;
}

const TOOLS = [
  {
    name: "pulse_now",
    title: "Пульс: хто зараз на сайтах",
    description: "Відвідуваність усіх сайтів ПроМедіа (promedia.report, news.promedia.report, atlas, ratings тощо — один ресурс GA4) у реальному часі за останні 30 хвилин: скільки людей зараз, графік по хвилинах, країни, міста, що читають (заголовки сторінок), пристрої, і «звичайний рівень» для цієї години. Джерел трафіку тут немає — для них pulse_today.",
    inputSchema: {
      type: "object",
      properties: { part: { type: "string", enum: ["summary", "minutes", "countries", "cities", "pages", "devices"], description: "Лише одна частина зведення у вигляді {rows}. Порожньо — усе разом." } },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "pulse_today",
    title: "Пульс: звіт за будь-який період",
    description: "Стандартний звіт GA4 за сьогодні, за останні N днів або за довільний період (start_date/end_date, напр. для звіту донору): читачі, перегляди, сайти, джерела трафіку (Google, Facebook, Telegram…), найпопулярніші сторінки з адресами, країни. Дані GA оновлює із затримкою. Можна обмежити одним сайтом через host, напр. news.promedia.report.",
    inputSchema: {
      type: "object",
      properties: {
        host: { type: "string", description: "Сайт, напр. news.promedia.report. Порожньо — усі сайти." },
        days: { type: "integer", minimum: 1, maximum: 730, description: "1 — лише сьогодні (типово). Ігнорується, якщо задано start_date/end_date." },
        start_date: { type: "string", description: "Початок періоду: YYYY-MM-DD, today, yesterday або NdaysAgo." },
        end_date: { type: "string", description: "Кінець періоду: YYYY-MM-DD, today, yesterday або NdaysAgo." },
        part: { type: "string", enum: ["summary", "daily", "sites", "sources", "pages", "countries"], description: "Лише одна частина у вигляді {rows}; daily — читачі й перегляди по днях. Порожньо — усе разом." },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "pulse_history",
    title: "Пульс: історія за години",
    description: "Записи перевірок кожні 5 хвилин: скільки людей було на сайтах ПроМедіа. Для графіка динаміки за останні N годин (до 14 днів) і пошуку сплесків.",
    inputSchema: {
      type: "object",
      properties: { hours: { type: "integer", minimum: 1, maximum: 336, description: "Скільки годин назад (типово 24)." } },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
];

async function callTool(env, name, args = {}) {
  if (name === "pulse_now") return nowPart(env, args.part);
  if (name === "pulse_today") return todayPart(env, args.part, args);
  if (name === "pulse_history") return pulseHistory(env, args.hours);
  throw Object.assign(new Error(`Невідомий інструмент: ${name}`), { code: -32602 });
}

async function handleRpc(env, msg) {
  const { id, method, params = {} } = msg || {};
  if (id === undefined || id === null) return null; // сповіщення — без відповіді
  const ok = (result) => ({ jsonrpc: "2.0", id, result });
  const err = (code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });
  switch (method) {
    case "initialize":
      return ok({
        protocolVersion: params.protocolVersion || MCP_PROTOCOL,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "promedia-pulse", title: "Пульс ПроМедіа", version: "1.0.0" },
        instructions: "Відвідуваність сайтів ПроМедіа з Google Analytics 4. pulse_now — реальний час (30 хв), pulse_today — джерела, сторінки, сайти за день, pulse_history — динаміка перевірок кожні 5 хв.",
      });
    case "ping":
      return ok({});
    case "tools/list":
      return ok({ tools: TOOLS });
    case "tools/call":
      try {
        const data = await callTool(env, params.name, params.arguments || {});
        return ok({ content: [{ type: "text", text: JSON.stringify(data, null, 1) }], structuredContent: data });
      } catch (e) {
        if (e.code) return err(e.code, e.message);
        return ok({ content: [{ type: "text", text: e.message }], isError: true });
      }
    default:
      return err(-32601, `Метод не підтримується: ${method}`);
  }
}

async function handleMcp(request, env, key) {
  const expected = await kvGet(env, "mcp_key");
  if (!expected || key !== expected) return new Response("not found", { status: 404 });
  if (request.method === "GET") return new Response("method not allowed", { status: 405, headers: { allow: "POST" } });
  if (request.method === "DELETE") return new Response(null, { status: 204 });
  if (request.method !== "POST") return new Response("method not allowed", { status: 405 });
  let body;
  try { body = await request.json(); } catch { return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400); }
  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map((m) => handleRpc(env, m)))).filter(Boolean);
    return out.length ? json(out) : new Response(null, { status: 202 });
  }
  const out = await handleRpc(env, body);
  return out ? json(out) : new Response(null, { status: 202 });
}

// ───────────────────────── сторінка налаштування ─────────────────────────

const PAGE_CSS = `body{font:16px/1.5 system-ui,-apple-system,sans-serif;max-width:640px;margin:0 auto;padding:20px;color:#1a1a1a}
h1{font-size:22px}label{display:block;font-weight:600;margin:18px 0 6px}input,textarea{width:100%;box-sizing:border-box;font:inherit;padding:10px;border:1px solid #bbb;border-radius:6px}
textarea{min-height:120px;font-family:ui-monospace,monospace;font-size:12px}button{margin-top:22px;padding:12px 18px;font:inherit;font-weight:600;background:#c8102e;color:#fff;border:0;border-radius:6px;width:100%}
.hint{color:#666;font-size:14px}.ok{color:#137333}.bad{color:#b3261e}code{background:#f2f2f2;padding:2px 4px;border-radius:4px;word-break:break-all}`;

function setupForm(status, message = "") {
  const s = (v) => (v ? "<span class=ok>✓ налаштовано</span>" : "<span class=bad>ще немає</span>");
  return html(`<!doctype html><html lang=uk><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>Пульс ПроМедіа — налаштування</title><style>${PAGE_CSS}</style>
<h1>Пульс ПроМедіа — налаштування</h1>
${message}
<p class=hint>Ключ Google: ${s(status.ga)} · бот Telegram: ${s(status.bot)} · чат: ${s(status.chat)}</p>
<form method=post enctype="multipart/form-data">
<label>Код налаштування</label><input name=code required autocomplete=off placeholder="xxxx-xxxx-xxxx">
<label>Ключ сервісного акаунта Google (файл .json)</label><input type=file name=sa_file accept=".json,application/json">
<p class=hint>Або вставте вміст файлу:</p><textarea name=sa_text placeholder='{"type":"service_account", ...}'></textarea>
<label>Токен бота Telegram (від @BotFather)</label><input name=bot_token autocomplete=off placeholder="123456789:AA...">
<p class=hint>Можна заповнити лише одне поле — інше залишиться як є.</p>
<button>Зберегти й перевірити</button></form>
<script>var c=decodeURIComponent((location.hash||"").slice(1));if(c){document.querySelector('[name=code]').value=c;}</script></html>`);
}

async function setupStatus(env) {
  return { ga: !!(await serviceAccount(env)), bot: !!(await kvGet(env, "tg_token")), chat: !!(await kvGet(env, "tg_chat_id")) };
}

async function handleSetup(request, env) {
  if (request.method === "GET") return setupForm(await setupStatus(env));
  const form = await request.formData();
  const code = String(form.get("code") || "").trim().toLowerCase();
  if (!env.SETUP_HASH || (await sha256Hex(code)) !== env.SETUP_HASH) {
    return setupForm(await setupStatus(env), "<p class=bad><b>Невірний код налаштування.</b></p>");
  }
  const notes = [];
  // ключ Google
  let saRaw = String(form.get("sa_text") || "").trim();
  const file = form.get("sa_file");
  if (!saRaw && file && typeof file === "object" && file.size) saRaw = (await file.text()).trim();
  if (saRaw) {
    try {
      const sa = JSON.parse(saRaw);
      if (sa.type !== "service_account" || !sa.private_key || !sa.client_email) throw new Error("це не ключ сервісного акаунта");
      tokenCache = null;
      await fetchGoogleToken(sa);
      await kvSet(env, "ga_sa_key", sa);
      try {
        const u = await activeUsersLast(env, 30);
        notes.push(`<p class=ok>✓ Google Analytics працює. Зараз на сайтах: <b>${u}</b> людей за 30 хв.</p>`);
      } catch (e) {
        notes.push(`<p class=bad>Ключ збережено, але GA4 ще не відповідає: ${esc(e.message)}</p><p class=hint>Додайте <code>${esc(sa.client_email)}</code> у Google Analytics → Адміністрування → Керування доступом до ресурсу → роль «Переглядач». Потім ще раз натисніть «Зберегти» з кодом (поля можна лишити порожніми).</p>`);
      }
    } catch (e) {
      notes.push(`<p class=bad>Ключ Google не прийнято: ${esc(e.message)}</p>`);
    }
  } else if (await serviceAccount(env)) {
    try {
      const u = await activeUsersLast(env, 30);
      notes.push(`<p class=ok>✓ Google Analytics працює. Зараз на сайтах: <b>${u}</b> людей за 30 хв.</p>`);
    } catch (e) {
      notes.push(`<p class=bad>GA4: ${esc(e.message)}</p>`);
    }
  }
  // бот Telegram
  const botToken = String(form.get("bot_token") || "").trim();
  if (botToken) {
    try {
      const me = await tg(env, "getMe", {}, botToken);
      const hookSecret = randomToken(16);
      const origin = new URL(request.url).origin;
      await tg(env, "setWebhook", { url: `${origin}/tg`, secret_token: hookSecret, allowed_updates: ["message"], drop_pending_updates: true }, botToken);
      await kvSet(env, "tg_token", botToken);
      await kvSet(env, "tg_webhook_secret", hookSecret);
      await kvDel(env, "tg_chat_id");
      notes.push(`<p class=ok>✓ Бот @${esc(me.username)} підключено.</p><p><b>Останній крок:</b> відкрийте <a href="https://t.me/${esc(me.username)}">t.me/${esc(me.username)}</a> і натисніть «Start». Бот відповість і надішле адресу конектора для Claude.</p>`);
    } catch (e) {
      notes.push(`<p class=bad>Бот не прийнято: ${esc(e.message)}</p>`);
    }
  }
  let mcp = await kvGet(env, "mcp_key");
  if (!mcp) { mcp = randomToken(20); await kvSet(env, "mcp_key", mcp); }
  notes.push(`<p><b>Адреса конектора для Claude</b> (нікому не пересилайте):<br><code id=mcp-url>${esc(new URL(request.url).origin)}/mcp/${mcp}</code></p>`);
  return setupForm(await setupStatus(env), notes.join(""));
}

// ───────────────────────── вхідна точка ─────────────────────────

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (isStatHost(url)) return await handleStat(request, env, { nowPart, todayPart, pulseHistory });
      if (url.pathname === "/setup/cert") return new Response(await ensureOwnKey(env), { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
      if (url.pathname === "/setup") return await handleSetup(request, env);
      if (url.pathname === "/tg" && request.method === "POST") return await handleTelegram(request, env);
      const m = url.pathname.match(/^\/mcp\/([a-f0-9]{20,64})\/?$/);
      if (m) return await handleMcp(request, env, m[1]);
      if (url.pathname === "/health") return json({ ok: true, ...(await setupStatus(env)), last_check: await kvGetJson(env, "last_ok"), last_error: await kvGetJson(env, "last_error") });
      if (url.pathname === "/") return html(`<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>Пульс ПроМедіа</title><style>${PAGE_CSS}</style><h1>Пульс ПроМедіа</h1><p>Службовий сервіс відвідуваності сайтів ПроМедіа.</p>`);
      return new Response("not found", { status: 404 });
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(scheduled(env, event.scheduledTime).catch(async (e) => {
      console.error("pulse cron:", e.message);
      await kvSet(env, "last_error", { at: new Date().toISOString(), message: e.message }).catch(() => {});
      // про збій повідомляємо не частіше ніж раз на 6 годин
      try {
        const last = Number(await kvGet(env, "error_notified_at")) || 0;
        if (Date.now() - last > 6 * 3600_000) {
          await kvSet(env, "error_notified_at", String(Date.now()));
          await notify(env, `⚠️ Пульс не може отримати дані: ${esc(e.message)}`);
        }
      } catch { /* нема куди повідомити */ }
    }));
  },
};
