// Only the existing ProMedia analytics workflow may refresh public aggregates.
const ISSUER = "https://token.actions.githubusercontent.com";
export const ANALYTICS_AUDIENCE = "https://news.promedia.report/api/analytics/sync";
const WORKFLOW = "Ianitskyi/promedia-weekly-dashboard/.github/workflows/news-views.yml@refs/heads/main";
let keyCache;

function decode(segment) {
  if (!/^[A-Za-z0-9_-]+$/.test(segment)) throw Error("Invalid token encoding");
  return Uint8Array.from(atob(segment.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
}

export async function verifyAnalyticsToken(token, { now = Date.now(), fetcher = fetch } = {}) {
  if (!token || token.length > 16000) throw Error("Missing workflow identity");
  const parts = token.split(".");
  if (parts.length !== 3) throw Error("Invalid workflow identity");
  const header = JSON.parse(new TextDecoder().decode(decode(parts[0])));
  const claims = JSON.parse(new TextDecoder().decode(decode(parts[1])));
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
    const response = await fetcher(`${ISSUER}/.well-known/jwks`, { redirect: "error" });
    if (!response.ok) throw Error("Workflow signing keys unavailable");
    keys = (await response.json()).keys;
    if (!Array.isArray(keys)) throw Error("Invalid workflow signing keys");
    if (cacheable) keyCache = { keys, until: now + 300000 };
  }
  const jwk = keys.find(key => key.kid === header.kid && key.kty === "RSA" && (!key.alg || key.alg === "RS256"));
  if (!jwk) throw Error("Unknown workflow signing key");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, decode(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  if (!valid) throw Error("Invalid workflow signature");
  return claims;
}
