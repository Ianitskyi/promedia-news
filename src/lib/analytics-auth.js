// Only the existing ProMedia analytics workflow may refresh public aggregates.
const ISSUER = "https://token.actions.githubusercontent.com";
export const ANALYTICS_AUDIENCE = "https://news.promedia.report/api/analytics/sync";
const WORKFLOW = "Ianitskyi/promedia-weekly-dashboard/.github/workflows/news-views.yml@refs/heads/main";
let keyCache;

function decode(segment) {
  if (!/^[A-Za-z0-9_-]+$/.test(segment)) throw Error("Invalid token encoding");
  try {
    const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
    return Uint8Array.from(atob(base64 + "=".repeat((4 - base64.length % 4) % 4)), c => c.charCodeAt(0));
  } catch (_) { throw Error("Invalid token encoding"); }
}

export async function verifyAnalyticsToken(token, { now = Date.now(), fetcher = fetch } = {}) {
  if (!token || token.length > 16000) throw Error("Missing workflow identity");
  const parts = token.split(".");
  if (parts.length !== 3) throw Error("Invalid workflow identity");
  let header, claims;
  try {
    header = JSON.parse(new TextDecoder().decode(decode(parts[0])));
    claims = JSON.parse(new TextDecoder().decode(decode(parts[1])));
  } catch (_) { throw Error("Invalid workflow identity"); }
  const seconds = Math.floor(now / 1000);
  if (header.alg !== "RS256" || typeof header.kid !== "string" ||
      claims.iss !== ISSUER || claims.aud !== ANALYTICS_AUDIENCE ||
      claims.repository_id !== "1297520567" || claims.repository_owner_id !== "48093599" ||
      claims.repository !== "Ianitskyi/promedia-weekly-dashboard" ||
      claims.ref !== "refs/heads/main" || claims.workflow_ref !== WORKFLOW ||
      !["push", "schedule", "workflow_dispatch"].includes(claims.event_name) ||
      !Number.isFinite(claims.exp) || claims.exp <= seconds ||
      !Number.isFinite(claims.iat) || claims.iat > seconds + 30 || claims.iat < seconds - 600 ||
      !Number.isFinite(claims.nbf) || claims.nbf > seconds + 30) throw Error("Untrusted workflow identity");

  // Fixed issuer URL; never follow token-provided jku/x5u URLs.
  const cacheable = fetcher === fetch;
  let keys = cacheable && keyCache?.until > now ? keyCache.keys : null;
  if (!keys || !keys.some(key => key.kid === header.kid)) {
    let response;
    try { response = await fetcher(`${ISSUER}/.well-known/jwks`, { redirect: "manual" }); }
    catch (_) { throw Error("Workflow signing keys unavailable"); }
    if (!response.ok) throw Error("Workflow signing keys unavailable");
    try { keys = (await response.json()).keys; }
    catch (_) { throw Error("Invalid workflow signing keys"); }
    if (!Array.isArray(keys)) throw Error("Invalid workflow signing keys");
    if (cacheable) keyCache = { keys, until: now + 300000 };
  }
  const jwk = keys.find(key => key.kid === header.kid && key.kty === "RSA" && (!key.alg || key.alg === "RS256"));
  if (!jwk) throw Error("Unknown workflow signing key");
  let key;
  try {
    key = await crypto.subtle.importKey("jwk", { kty: "RSA", n: jwk.n, e: jwk.e, alg: "RS256", ext: true }, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  } catch (_) { throw Error("Invalid workflow signing keys"); }
  let valid = false;
  try { valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, decode(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`)); }
  catch (_) { throw Error("Invalid workflow signature"); }
  if (!valid) throw Error("Invalid workflow signature");
  return claims;
}
