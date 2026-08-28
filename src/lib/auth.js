// Пароль: PBKDF2-SHA256 через Web Crypto (доступно в рантаймі Workers).
// Сесія: підписаний токен (не JWT-бібліотека, а мінімальний власний формат
// HMAC-SHA256), щоб не тягнути зовнішніх залежностей.

const PBKDF2_ITERATIONS = 100000;
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 днів

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

function base64UrlEncode(bytes) {
  let binary = "";
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str) {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial, 256
  );
  return `${PBKDF2_ITERATIONS}:${toHex(salt)}:${toHex(bits)}`;
}

export async function verifyPassword(password, stored) {
  const parts = stored.split(":");
  if (parts.length !== 3) return false;
  const [iterStr, saltHex, hashHex] = parts;
  const iterations = parseInt(iterStr, 10);
  const salt = fromHex(saltHex);
  const keyMaterial = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    keyMaterial, 256
  );
  const computedHex = toHex(bits);
  if (computedHex.length !== hashHex.length) return false;
  // порівняння за постійний час
  let diff = 0;
  for (let i = 0; i < computedHex.length; i++) {
    diff |= computedHex.charCodeAt(i) ^ hashHex.charCodeAt(i);
  }
  return diff === 0;
}

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" },
    false, ["sign", "verify"]
  );
}

export async function createSessionToken(payload, secret) {
  const body = { ...payload, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS };
  const bodyBytes = new TextEncoder().encode(JSON.stringify(body));
  const bodyB64 = base64UrlEncode(bodyBytes);
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(bodyB64));
  const sigB64 = base64UrlEncode(new Uint8Array(sig));
  return `${bodyB64}.${sigB64}`;
}

export async function verifySessionToken(token, secret) {
  if (!token || token.indexOf(".") === -1) return null;
  const [bodyB64, sigB64] = token.split(".");
  const key = await hmacKey(secret);
  const expectedSig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(bodyB64));
  const expectedSigB64 = base64UrlEncode(new Uint8Array(expectedSig));
  if (expectedSigB64 !== sigB64) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(bodyB64)));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch (err) {
    return null;
  }
}

const SESSION_COOKIE = "pm_session";

export function sessionCookieHeader(token) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`;
}

export function clearSessionCookieHeader() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function getSessionTokenFromRequest(request) {
  const cookieHeader = request.headers.get("Cookie") || "";
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  return match ? match[1] : null;
}

export async function getCurrentUser(request, env) {
  const token = getSessionTokenFromRequest(request);
  if (!token) return null;
  const payload = await verifySessionToken(token, env.AUTH_SECRET);
  if (!payload) return null;
  const user = await env.DB.prepare(
    "SELECT id, email, name, role FROM users WHERE id = ?"
  ).bind(payload.uid).first();
  return user || null;
}
