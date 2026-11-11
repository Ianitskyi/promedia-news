import { verifyAnalyticsToken } from "../lib/analytics-auth.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

export function validateViewsReport(report, now = Date.now()) {
  const generated = Date.parse(report?.generatedAt);
  if (report?.schemaVersion !== 1 || report.source !== "ga4" || report.propertyId !== "366614690" ||
      report.metric !== "screenPageViews" || report.dateRange?.startDate !== "2019-01-01" || report.dateRange?.endDate !== "today" ||
      !Number.isFinite(generated) || generated > now + 30000 || generated < now - 600000 ||
      !Array.isArray(report.items) || report.items.length === 0 || report.items.length > 10000) throw Error("Invalid analytics report");
  const slugs = new Set();
  for (const item of report.items) {
    if (typeof item.slug !== "string" || !/^[a-z0-9-]{1,200}$/.test(item.slug) || slugs.has(item.slug) ||
        !Number.isSafeInteger(item.views) || item.views < 0) throw Error("Invalid article view total");
    slugs.add(item.slug);
  }
  return { ...report, generatedAt: new Date(generated).toISOString() };
}

export async function handleAnalyticsRoute(request, env, url, verify = verifyAnalyticsToken) {
  if (url.pathname !== "/api/analytics/sync") return null;
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    await verify(request.headers.get("Authorization")?.match(/^Bearer (\S+)$/)?.[1]);
  } catch (error) {
    const reasons = new Set(["Missing workflow identity", "Invalid workflow identity", "Invalid token encoding", "Untrusted workflow identity", "Workflow signing keys unavailable", "Invalid workflow signing keys", "Unknown workflow signing key", "Invalid workflow signature"]);
    return json({ error: "unauthorized", reason: reasons.has(error.message) ? error.message : "Identity verification failed", serverTime: new Date().toISOString() }, 401);
  }
  let report;
  try {
    if (!request.headers.get("Content-Type")?.startsWith("application/json")) throw Error("Expected JSON");
    // Bound memory even for chunked requests with no Content-Length.
    const reader = request.body?.getReader();
    if (!reader) throw Error("Missing report");
    const chunks = []; let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 2000000) { await reader.cancel(); throw Error("Report too large"); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    report = validateViewsReport(JSON.parse(new TextDecoder().decode(bytes)));
  } catch (_) { return json({ error: "invalid_report" }, 400); }

  let updated = 0;
  // Small atomic batches stay below D1 parameter and statement limits.
  for (let offset = 0; offset < report.items.length; offset += 50) {
    const results = await env.DB.batch(report.items.slice(offset, offset + 50).map(item => env.DB.prepare(`
      INSERT INTO article_views (article_id, ga4_views, synced_at)
      SELECT id, ?, ? FROM articles WHERE slug = ? AND status = 'published' AND deleted_at IS NULL
      ON CONFLICT(article_id) DO UPDATE SET ga4_views = excluded.ga4_views, synced_at = excluded.synced_at
      WHERE article_views.synced_at < excluded.synced_at
    `).bind(item.views, report.generatedAt, item.slug)));
    updated += results.reduce((total, result) => total + (result.meta?.changes || 0), 0);
  }
  return json({ updated, source: "ga4", syncedAt: report.generatedAt });
}
