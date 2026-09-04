const VAPID_PUBLIC_KEY = "BNteUF_5Gf27PZxDrxmtcTZuZ19lhqToKCdvC6iUdcQU-GVLfZ3PI0ZH-pxCF250dIk15yqqFx6MUvAtVE_zRLk";
const DEFAULT_SUBJECT = "mailto:info@promedia.report";
const DEFAULT_NOTIFICATION_URL = "https://news.promedia.report/";

function json(data, status, extraHeaders) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...(extraHeaders || {})
    }
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store"
  };
}

function corsJson(data, status) {
  return json(data, status, corsHeaders());
}

function normalizeLang(value) {
  return value === "en" ? "en" : "uk";
}

function normalizeTargetLang(value) {
  return ["all", "uk", "en"].includes(value) ? value : "all";
}

function textValue(value, maxLength) {
  const clean = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!maxLength || clean.length <= maxLength) return clean;
  return clean.slice(0, maxLength - 1).trim() + "…";
}

function validateUrl(value) {
  const clean = String(value || "").trim();
  if (!clean) return DEFAULT_NOTIFICATION_URL;
  try {
    const parsed = new URL(clean);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return DEFAULT_NOTIFICATION_URL;
    return parsed.href;
  } catch (err) {
    return DEFAULT_NOTIFICATION_URL;
  }
}

function parseSubscription(body) {
  const subscription = body && body.subscription ? body.subscription : body;
  const endpoint = subscription && typeof subscription.endpoint === "string" ? subscription.endpoint : "";
  const keys = subscription && subscription.keys ? subscription.keys : {};
  const p256dh = typeof keys.p256dh === "string" ? keys.p256dh : "";
  const auth = typeof keys.auth === "string" ? keys.auth : "";

  if (!endpoint || !p256dh || !auth) return null;
  try {
    const endpointUrl = new URL(endpoint);
    if (endpointUrl.protocol !== "https:") return null;
  } catch (err) {
    return null;
  }
  return { endpoint, p256dh, auth };
}

function base64UrlEncode(input) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function derToJose(signature) {
  const bytes = new Uint8Array(signature);
  if (bytes.length === 64) return bytes;
  if (bytes[0] !== 0x30) return bytes;

  let offset = 2;
  if (bytes[1] & 0x80) offset += bytes[1] & 0x7f;
  if (bytes[offset] !== 0x02) return bytes;
  const rLength = bytes[offset + 1];
  let r = bytes.slice(offset + 2, offset + 2 + rLength);
  offset = offset + 2 + rLength;
  if (bytes[offset] !== 0x02) return bytes;
  const sLength = bytes[offset + 1];
  let s = bytes.slice(offset + 2, offset + 2 + sLength);

  if (r.length > 32) r = r.slice(r.length - 32);
  if (s.length > 32) s = s.slice(s.length - 32);
  const jose = new Uint8Array(64);
  jose.set(r, 32 - r.length);
  jose.set(s, 64 - s.length);
  return jose;
}

async function createVapidJwt(audience, env) {
  if (!env.VAPID_PRIVATE_JWK) {
    throw new Error("vapid_secret_missing");
  }
  const privateJwk = typeof env.VAPID_PRIVATE_JWK === "string"
    ? JSON.parse(env.VAPID_PRIVATE_JWK)
    : env.VAPID_PRIVATE_JWK;
  const header = base64UrlEncode(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const payload = base64UrlEncode(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + (12 * 60 * 60),
    sub: env.VAPID_SUBJECT || DEFAULT_SUBJECT
  }));
  const unsigned = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    "jwk",
    privateJwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(unsigned)
  );
  return `${unsigned}.${base64UrlEncode(derToJose(signature))}`;
}

async function sendEmptyPush(endpoint, env) {
  const audience = new URL(endpoint).origin;
  const token = await createVapidJwt(audience, env);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "TTL": "86400",
      "Urgency": "normal",
      "Authorization": `vapid t=${token}, k=${VAPID_PUBLIC_KEY}`
    }
  });
  return {
    ok: response.status === 201 || response.status === 202,
    gone: response.status === 404 || response.status === 410,
    status: response.status
  };
}

export function handlePushPreflight() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function handlePublicPushRoute(request, env, url) {
  const db = env.DB;

  if (request.method === "OPTIONS") return handlePushPreflight();

  if (url.pathname === "/api/push/public-key" && request.method === "GET") {
    return corsJson({ publicKey: VAPID_PUBLIC_KEY, enabled: Boolean(env.VAPID_PRIVATE_JWK) });
  }

  if (url.pathname === "/api/push/subscribe" && request.method === "POST") {
    const body = await request.json().catch(() => null);
    const subscription = parseSubscription(body);
    if (!subscription) return corsJson({ error: "invalid_subscription" }, 400);

    const now = new Date().toISOString();
    const lang = normalizeLang(body && body.lang);
    const origin = textValue((body && body.origin) || request.headers.get("Origin") || "", 255);
    const userAgent = textValue(request.headers.get("User-Agent") || "", 500);
    await db.prepare(`
      INSERT INTO push_subscriptions (endpoint, p256dh, auth, user_agent, lang, origin, created_at, updated_at, last_seen_at, disabled_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
      ON CONFLICT(endpoint) DO UPDATE SET
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        user_agent = excluded.user_agent,
        lang = excluded.lang,
        origin = excluded.origin,
        updated_at = excluded.updated_at,
        last_seen_at = excluded.last_seen_at,
        disabled_at = NULL
    `).bind(
      subscription.endpoint,
      subscription.p256dh,
      subscription.auth,
      userAgent,
      lang,
      origin,
      now,
      now,
      now
    ).run();
    return corsJson({ ok: true });
  }

  if (url.pathname === "/api/push/unsubscribe" && request.method === "POST") {
    const body = await request.json().catch(() => null);
    const subscription = parseSubscription(body);
    if (!subscription) return corsJson({ error: "invalid_subscription" }, 400);

    const now = new Date().toISOString();
    await db.prepare("UPDATE push_subscriptions SET disabled_at = ?, updated_at = ? WHERE endpoint = ?")
      .bind(now, now, subscription.endpoint).run();
    return corsJson({ ok: true });
  }

  if (url.pathname === "/api/push/latest" && request.method === "GET") {
    const lang = normalizeLang(url.searchParams.get("lang"));
    const row = await db.prepare(`
      SELECT title_uk, body_uk, title_en, body_en, url, sent_at
      FROM push_messages
      WHERE target_lang = 'all' OR target_lang = ?
      ORDER BY sent_at DESC
      LIMIT 1
    `).bind(lang).first();
    if (!row) {
      return corsJson({
        item: lang === "en"
          ? { title: "ProMedia update", body: "New materials from ProMedia are available.", url: DEFAULT_NOTIFICATION_URL }
          : { title: "Оновлення ПроМедіа", body: "На сайті ПроМедіа з’явилися нові матеріали.", url: DEFAULT_NOTIFICATION_URL }
      });
    }
    return corsJson({
      item: {
        title: lang === "en" ? (row.title_en || row.title_uk) : row.title_uk,
        body: lang === "en" ? (row.body_en || row.body_uk) : row.body_uk,
        url: row.url || DEFAULT_NOTIFICATION_URL,
        sentAt: row.sent_at
      }
    });
  }

  return null;
}

export async function handleAdminPushRoute(request, env, url, user) {
  if (user.role !== "admin") return json({ error: "forbidden" }, 403);

  if (url.pathname === "/api/admin/push/summary" && request.method === "GET") {
    const active = await env.DB.prepare("SELECT COUNT(*) AS count FROM push_subscriptions WHERE disabled_at IS NULL").first();
    const uk = await env.DB.prepare("SELECT COUNT(*) AS count FROM push_subscriptions WHERE disabled_at IS NULL AND lang = 'uk'").first();
    const en = await env.DB.prepare("SELECT COUNT(*) AS count FROM push_subscriptions WHERE disabled_at IS NULL AND lang = 'en'").first();
    const { results } = await env.DB.prepare(`
      SELECT id, title_uk, title_en, target_lang, sent_at, attempted, delivered, failed
      FROM push_messages
      ORDER BY sent_at DESC
      LIMIT 10
    `).all();
    return json({
      enabled: Boolean(env.VAPID_PRIVATE_JWK),
      publicKey: VAPID_PUBLIC_KEY,
      counts: {
        active: active ? active.count : 0,
        uk: uk ? uk.count : 0,
        en: en ? en.count : 0
      },
      recent: results || []
    });
  }

  if (url.pathname === "/api/admin/push/send" && request.method === "POST") {
    if (!env.VAPID_PRIVATE_JWK) return json({ error: "Web Push ще не налаштовано: немає VAPID_PRIVATE_JWK" }, 500);

    const body = await request.json().catch(() => null);
    if (!body) return json({ error: "invalid_body" }, 400);
    const targetLang = normalizeTargetLang(body.targetLang);
    const titleUk = textValue(body.titleUk, 90);
    const bodyUk = textValue(body.bodyUk, 180);
    const titleEn = textValue(body.titleEn, 90);
    const bodyEn = textValue(body.bodyEn, 180);
    const targetUrl = validateUrl(body.url);

    if (!titleUk || !bodyUk) return json({ error: "Український заголовок і текст обов’язкові" }, 400);
    if ((targetLang === "en" || targetLang === "all") && (!titleEn || !bodyEn)) {
      return json({ error: "Для англомовних підписників додайте англійський заголовок і текст" }, 400);
    }

    const sentAt = new Date().toISOString();
    const inserted = await env.DB.prepare(`
      INSERT INTO push_messages (title_uk, body_uk, title_en, body_en, url, target_lang, sent_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(titleUk, bodyUk, titleEn || null, bodyEn || null, targetUrl, targetLang, sentAt).run();

    const query = targetLang === "all"
      ? "SELECT id, endpoint FROM push_subscriptions WHERE disabled_at IS NULL ORDER BY updated_at DESC"
      : "SELECT id, endpoint FROM push_subscriptions WHERE disabled_at IS NULL AND (lang = ? OR lang IS NULL OR lang = '') ORDER BY updated_at DESC";
    const selected = targetLang === "all"
      ? await env.DB.prepare(query).all()
      : await env.DB.prepare(query).bind(targetLang).all();
    const subscriptions = selected.results || [];

    let delivered = 0;
    let failed = 0;
    for (const subscription of subscriptions) {
      try {
        const result = await sendEmptyPush(subscription.endpoint, env);
        if (result.ok) {
          delivered += 1;
        } else {
          failed += 1;
          if (result.gone) {
            await env.DB.prepare("UPDATE push_subscriptions SET disabled_at = ?, updated_at = ? WHERE id = ?")
              .bind(sentAt, sentAt, subscription.id).run();
          }
        }
      } catch (err) {
        failed += 1;
      }
    }

    await env.DB.prepare("UPDATE push_messages SET attempted = ?, delivered = ?, failed = ? WHERE id = ?")
      .bind(subscriptions.length, delivered, failed, inserted.meta.last_row_id).run();

    return json({
      ok: true,
      attempted: subscriptions.length,
      delivered,
      failed
    });
  }

  return null;
}
