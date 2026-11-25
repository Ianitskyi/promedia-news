import { handlePublicRoute } from "./routes/public.js";
import { handleAuthRoute } from "./routes/auth.js";
import { handleAdminRoute } from "./routes/admin.js";
import { handleProjectsAdminRoute } from "./routes/projectsAdmin.js";
import { handleProjectsPublicRoute } from "./routes/projects.js";
import { handleAnalyticsRoute } from "./routes/analytics.js";
import { publishDueArticles, schedulerStatus } from "./lib/scheduler.js";
import { handleInternalUpload } from "./lib/internalUpload.js";
import { runThreadsAutopost, refreshThreadsToken, threadsStatus } from "./lib/threads.js";

const EDGE_CACHE_SECONDS = 120;
const NO_EDGE_CACHE = /^\/(admin|api\/(admin|auth|me|setup|push|analytics|scheduler-status|threads-status|export)|img-storage)(\/|$)/;

function edgeCacheable(request, url) {
  return request.method === "GET"
    && !request.headers.has("Authorization")
    && !url.searchParams.has("nocache")
    && !NO_EDGE_CACHE.test(url.pathname);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    try {
      const uploadRes = await handleInternalUpload(request, env, url);
      if (uploadRes) return uploadRes;

      const analyticsRes = await handleAnalyticsRoute(request, env, url);
      if (analyticsRes) return analyticsRes;

      // Перевірка роботи розкладу: коли востаннє спрацював таймер і скільки новин чекає (без їхнього змісту).
      if (url.pathname === "/api/scheduler-status") {
        return new Response(JSON.stringify(await schedulerStatus(env.DB)), {
          headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
        });
      }

      // Стан автопостингу в Threads: що й коли пішло, остання помилка (без токенів).
      if (url.pathname === "/api/threads-status") {
        return new Response(JSON.stringify(await threadsStatus(env)), {
          headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
        });
      }

      // Роздача картинок з R2, якщо не налаштовано публічний домен бакета
      // (env.IMAGES_PUBLIC_BASE_URL). Зручно для локальної розробки.
      if (url.pathname.startsWith("/img-storage/")) {
        const key = url.pathname.replace("/img-storage/", "");
        const object = await env.IMAGES.get(key);
        if (!object) return new Response("Not found", { status: 404 });
        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set("Cache-Control", "public, max-age=31536000, immutable");
        return new Response(object.body, { headers });
      }

      if (url.pathname.startsWith("/api/admin/projects")) {
        const res = await handleProjectsAdminRoute(request, env, url);
        if (res) return res;
      }

      if (url.pathname.startsWith("/api/admin/")) {
        const res = await handleAdminRoute(request, env, url);
        if (res) return res;
      }

      if (url.pathname.startsWith("/api/auth/") || url.pathname === "/api/me" || url.pathname === "/api/setup") {
        const res = await handleAuthRoute(request, env, url);
        if (res) return res;
      }

      // Публічні сторінки й API однакові для всіх читачів, тож тримаємо їх у кеші
      // Cloudflare коротко (EDGE_CACHE_SECONDS): боти й сплески трафіку більше не
      // б'ють щоразу в D1 (25.11.2026 вичерпували денний ліміт читань).
      const cache = edgeCacheable(request, url) ? caches.default : null;
      if (cache) {
        const hit = await cache.match(request);
        if (hit) return hit;
      }

      const publicRes = (await handleProjectsPublicRoute(request, env, url)) || (await handlePublicRoute(request, env, url));
      if (publicRes) {
        if (cache && publicRes.status === 200 && !publicRes.headers.has("Set-Cookie")) {
          const cached = new Response(publicRes.body, publicRes);
          if (!cached.headers.has("Cache-Control")) cached.headers.set("Cache-Control", "public, max-age=0, must-revalidate");
          const edge = cached.clone();
          edge.headers.set("Cache-Control", `public, max-age=${EDGE_CACHE_SECONDS}`);
          ctx.waitUntil(cache.put(request, edge));
          return cached;
        }
        return publicRes;
      }

      // Усе інше (статика: css, favicon, /admin SPA-шел, картинки логотипу)
      // віддається binding'ом assets — сюди доходимо лише якщо жоден
      // динамічний маршрут вище не спрацював.
      return env.ASSETS.fetch(request);
    } catch (err) {
      console.error(err);
      return new Response(JSON.stringify({ error: "internal_error" }), {
        status: 500,
        headers: { "Content-Type": "application/json; charset=utf-8" }
      });
    }
  },

  async scheduled(event, env, ctx) {
    // Кожні 5 хвилин: відкрити новини, час публікації яких настав (src/lib/scheduler.js).
    ctx.waitUntil(publishDueArticles(env.DB).catch(e => console.error("scheduler", e)));
    // Автопостинг у Threads (src/lib/threads.js) — після розкладу, щоб не заважати публікації.
    ctx.waitUntil(runThreadsAutopost(env).catch(e => console.error("threads", e)));
    if (event.cron === "17 3 * * *") {
      ctx.waitUntil(refreshThreadsToken(env).catch(e => console.error("threads-token", e)));
      ctx.waitUntil(
        env.DB.prepare(
          "DELETE FROM articles WHERE deleted_at IS NOT NULL AND datetime(deleted_at) <= datetime('now', '-30 days')"
        ).run()
      );
    }
  }
};
