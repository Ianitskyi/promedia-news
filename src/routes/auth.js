import {
  hashPassword,
  verifyPassword,
  createSessionToken,
  sessionCookieHeader,
  clearSessionCookieHeader,
  getCurrentUser,
  createPasswordResetToken,
  hashPasswordResetToken
} from "../lib/auth.js";

function json(data, status, extraHeaders) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { "Content-Type": "application/json; charset=utf-8", ...(extraHeaders || {}) }
  });
}

async function sendPasswordResetEmail(env, recipient, resetUrl) {
  if (!env.RESEND_API_KEY || !env.RESET_EMAIL_FROM) return false;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: env.RESET_EMAIL_FROM,
      to: [recipient],
      subject: "Відновлення пароля — Новини ПроМедіа",
      text: `Щоб встановити новий пароль до адмінки Новин ПроМедіа, відкрийте посилання протягом однієї години:\n${resetUrl}\n\nЯкщо це були не ви, просто проігноруйте цей лист.`,
      html: `<p>Щоб встановити новий пароль до адмінки Новин ПроМедіа, відкрийте це посилання протягом однієї години:</p><p><a href="${resetUrl}">Відновити пароль</a></p><p>Якщо це були не ви, просто проігноруйте цей лист.</p>`
    })
  });

  if (!response.ok) {
    console.error("Password reset email failed", response.status, await response.text());
    return false;
  }
  return true;
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

  // POST /api/auth/password-reset/request
  if (url.pathname === "/api/auth/password-reset/request" && request.method === "POST") {
    const body = await request.json().catch(() => null);
    const email = body && typeof body.email === "string" ? body.email.toLowerCase().trim() : "";
    if (!email) return json({ error: "Вкажіть email" }, 400);
    if (!env.RESEND_API_KEY || !env.RESET_EMAIL_FROM) {
      return json({ error: "Відновлення пароля ще не налаштоване. Зверніться до адміністратора сайту." }, 503);
    }

    const user = await db.prepare("SELECT id, email FROM users WHERE email = ?").bind(email).first();
    // Однакова відповідь не дозволяє перевіряти, чи існує обліковий запис.
    if (!user) return json({ ok: true });

    const recent = await db.prepare(
      "SELECT id FROM password_reset_tokens WHERE user_id = ? AND used_at IS NULL AND created_at > datetime('now', '-5 minutes') LIMIT 1"
    ).bind(user.id).first();
    if (recent) return json({ ok: true });

    const token = createPasswordResetToken();
    const tokenHash = await hashPasswordResetToken(token);
    await db.prepare("DELETE FROM password_reset_tokens WHERE user_id = ? AND (used_at IS NOT NULL OR expires_at <= datetime('now'))").bind(user.id).run();
    await db.prepare(
      "INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, datetime('now', '+1 hour'))"
    ).bind(user.id, tokenHash).run();

    const resetUrl = `https://news.promedia.report/admin#/reset-password?token=${encodeURIComponent(token)}`;
    const delivered = await sendPasswordResetEmail(env, user.email, resetUrl);
    if (!delivered) {
      await db.prepare("DELETE FROM password_reset_tokens WHERE token_hash = ?").bind(tokenHash).run();
      return json({ error: "Не вдалося надіслати лист. Спробуйте пізніше." }, 502);
    }
    return json({ ok: true });
  }

  // POST /api/auth/password-reset/confirm
  if (url.pathname === "/api/auth/password-reset/confirm" && request.method === "POST") {
    const body = await request.json().catch(() => null);
    if (!body || !body.token || !body.password) return json({ error: "Посилання та новий пароль обов'язкові" }, 400);
    if (body.password.length < 10) return json({ error: "Пароль має бути не менше 10 символів" }, 400);

    const tokenHash = await hashPasswordResetToken(body.token);
    const record = await db.prepare(
      "SELECT id, user_id FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > datetime('now') ORDER BY id DESC LIMIT 1"
    ).bind(tokenHash).first();
    if (!record) return json({ error: "Посилання недійсне або його строк дії минув. Запросіть нове." }, 400);

    const passwordHash = await hashPassword(body.password);
    await db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").bind(passwordHash, record.user_id).run();
    await db.prepare("UPDATE password_reset_tokens SET used_at = datetime('now') WHERE user_id = ? AND used_at IS NULL").bind(record.user_id).run();
    const user = await db.prepare("SELECT id, email, name, role FROM users WHERE id = ?").bind(record.user_id).first();
    const session = await createSessionToken({ uid: user.id, role: user.role }, env.AUTH_SECRET);
    return json({ ok: true, user }, 200, { "Set-Cookie": sessionCookieHeader(session) });
  }

  // POST /api/auth/change-password
  if (url.pathname === "/api/auth/change-password" && request.method === "POST") {
    const user = await getCurrentUser(request, env);
    if (!user) return json({ error: "unauthenticated" }, 401);
    const body = await request.json().catch(() => null);
    if (!body || !body.currentPassword || !body.newPassword) return json({ error: "Вкажіть поточний і новий пароль" }, 400);
    if (body.newPassword.length < 10) return json({ error: "Новий пароль має бути не менше 10 символів" }, 400);
    const record = await db.prepare("SELECT password_hash FROM users WHERE id = ?").bind(user.id).first();
    if (!record || !(await verifyPassword(body.currentPassword, record.password_hash))) {
      return json({ error: "Поточний пароль неправильний" }, 401);
    }
    const passwordHash = await hashPassword(body.newPassword);
    await db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").bind(passwordHash, user.id).run();
    return json({ ok: true });
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
