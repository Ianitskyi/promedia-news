import { hashPassword, verifyPassword, createSessionToken, sessionCookieHeader, clearSessionCookieHeader, getCurrentUser } from "../lib/auth.js";

function json(data, status, extraHeaders) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { "Content-Type": "application/json; charset=utf-8", ...(extraHeaders || {}) }
  });
}

export async function handleAuthRoute(request, env, url) {
  const db = env.DB;

  // POST /api/setup — працює лише один раз, поки таблиця users порожня.
  // Створює першого адміністратора. Приклад виклику — у README.
  if (url.pathname === "/api/setup" && request.method === "POST") {
    const { count } = await db.prepare("SELECT COUNT(*) as count FROM users").first();
    if (count > 0) {
      return json({ error: "already_initialized" }, 403);
    }
    const body = await request.json().catch(() => null);
    if (!body || !body.email || !body.password || !body.name) {
      return json({ error: "email, password, name обов'язкові" }, 400);
    }
    if (body.password.length < 10) {
      return json({ error: "Пароль має бути не менше 10 символів" }, 400);
    }
    const passwordHash = await hashPassword(body.password);
    const result = await db.prepare(
      "INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, 'admin')"
    ).bind(body.email.toLowerCase().trim(), passwordHash, body.name).run();
    const uid = result.meta.last_row_id;
    const token = await createSessionToken({ uid, role: "admin" }, env.AUTH_SECRET);
    return json({ ok: true, user: { id: uid, email: body.email, name: body.name, role: "admin" } }, 200, {
      "Set-Cookie": sessionCookieHeader(token)
    });
  }

  // POST /api/auth/login
  if (url.pathname === "/api/auth/login" && request.method === "POST") {
    const body = await request.json().catch(() => null);
    if (!body || !body.email || !body.password) {
      return json({ error: "email і password обов'язкові" }, 400);
    }
    const user = await db.prepare(
      "SELECT id, email, password_hash, name, role FROM users WHERE email = ?"
    ).bind(body.email.toLowerCase().trim()).first();
    if (!user) return json({ error: "Невірний email або пароль" }, 401);
    const ok = await verifyPassword(body.password, user.password_hash);
    if (!ok) return json({ error: "Невірний email або пароль" }, 401);
    const token = await createSessionToken({ uid: user.id, role: user.role }, env.AUTH_SECRET);
    return json(
      { ok: true, user: { id: user.id, email: user.email, name: user.name, role: user.role } },
      200,
      { "Set-Cookie": sessionCookieHeader(token) }
    );
  }

  // POST /api/auth/logout
  if (url.pathname === "/api/auth/logout" && request.method === "POST") {
    return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookieHeader() });
  }

  // GET /api/me
  if (url.pathname === "/api/me" && request.method === "GET") {
    const user = await getCurrentUser(request, env);
    if (!user) return json({ error: "unauthenticated" }, 401);
    return json({ user });
  }

  return null;
}
