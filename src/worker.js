import { handlePublicRoute } from "./routes/public.js";
import { handleAuthRoute } from "./routes/auth.js";
import { handleAdminRoute } from "./routes/admin.js";
import { handleProjectsAdminRoute } from "./routes/projectsAdmin.js";
import { handleProjectsPublicRoute } from "./routes/projects.js";
import { handleAnalyticsRoute } from "./routes/analytics.js";
import { publishDueArticles, schedulerStatus } from "./lib/scheduler.js";
import { handleInternalUpload } from "./lib/internalUpload.js";
import { runThreadsAutopost, refreshThreadsToken, threadsStatus } from "./lib/threads.js";
import { runGermanTranslation, germanStatus } from "./lib/translateDe.js";
import { autoLanguageTarget, autoLanguageRedirect, withLanguageCookie } from "./lib/autoLanguage.js";

// Мовні версії news.promedia.report і projects.promedia.report (перша — типова, без префікса).
// Нова мова з'явилася — допишіть її сюди, і новачків з такою мовою браузера відкриватиме нею.
const SITE_LANGUAGES = ["uk", "en", "crh", "de"];
const AUTO_LANGUAGE_HOSTS = new Set(["news.promedia.report", "projects.promedia.report"]);

const EDGE_CACHE_SECONDS = 120;

// Сторінки, які рідко змінюються, але дорого читаються з D1 (перебирають усі новини),
// тримаємо в кеші довше. Головна й статті лишаються на 2 хвилини, щоб правки
// після публікації з'являлися швидко.
function edgeCacheSeconds(url) {
  const p = url.pathname.replace(/^\/(en|crh|de)(?=\/|$)/, "") || "/";
  const q = url.searchParams;
  if (p === "/sitemap.xml") return 3600;
  if (p === "/news-sitemap.xml") return 600;
  if (/^\/archive(\/\d+)?\/?$/.test(p)) return 900;
  if (p === "/" && (q.has("tag") || q.has("topic") || q.get("sort") === "top")) return 600;
  if (p.startsWith("/tag/")) return 600;
  if (p === "/api/articles" && (q.has("tag") || q.has("mediaId") || q.has("before"))) return 600;
  if (p.startsWith("/project") || p.startsWith("/api/projects")) return 600;
  return EDGE_CACHE_SECONDS;
}
const NO_EDGE_CACHE = /^\/(admin|api\/(admin|auth|me|setup|push|analytics|scheduler-status|threads-status|translation-status|export)|img-storage)(\/|$)/;

// Параметри, від яких справді залежить відповідь публічних сторінок і API.
// Усе інше (fbclid, utm_*, gclid, випадкові хвости від ботів) у ключ кешу не йде:
// інакше кожен перехід із Facebook/Telegram мав унікальну адресу, кеш промахувався
// й запит ішов у D1 (27.11.2026 знову вичерпали денний ліміт читань).
const CACHE_KEY_PARAMS = new Set(["tag", "topic", "sort", "before", "limit", "mediaId", "important", "withHero", "lang", "featured", "status"]);

function edgeCacheKey(url) {
  const key = new URL(url.origin + url.pathname);
  [...url.searchParams.keys()].filter(k => CACHE_KEY_PARAMS.has(k)).sort()
    .forEach(k => key.searchParams.set(k, url.searchParams.get(k)));
  return new Request(key.toString(), { method: "GET" });
}

function edgeCacheable(request, url) {
  return request.method === "GET"
    && !request.headers.has("Authorization")
    && !url.searchParams.has("nocache")
    && !NO_EDGE_CACHE.test(url.pathname);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!AUTO_LANGUAGE_HOSTS.has(url.hostname.toLowerCase())) return handleRequest(request, env, ctx, url);
    // Перший візит: відкриваємо мовою браузера (src/lib/autoLanguage.js).
    const target = autoLanguageTarget(request, url, SITE_LANGUAGES);
    if (target) return autoLanguageRedirect(url, SITE_LANGUAGES, target);
    return withLanguageCookie(request, url, await handleRequest(request, env, ctx, url), SITE_LANGUAGES);
  },

  scheduled
};

async function handleRequest(request, env, ctx, url) {
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

      // Стан німецького автоперекладу: скільки перекладено, останні помилки (без текстів).
      if (url.pathname === "/api/translation-status") {
        return new Response(JSON.stringify(await germanStatus(env.DB)), {
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
      const cacheKey = cache ? edgeCacheKey(url) : null;
      if (cache) {
        const hit = await cache.match(cacheKey);
        if (hit) return hit;
      }

      const publicRes = (await handleProjectsPublicRoute(request, env, url)) || (await handlePublicRoute(request, env, url));
      if (publicRes) {
        if (cache && publicRes.status === 200 && !publicRes.headers.has("Set-Cookie")) {
          const cached = new Response(publicRes.body, publicRes);
          if (!cached.headers.has("Cache-Control")) cached.headers.set("Cache-Control", "public, max-age=0, must-revalidate");
          const edge = cached.clone();
          edge.headers.set("Cache-Control", `public, max-age=${edgeCacheSeconds(url)}`);
          ctx.waitUntil(cache.put(cacheKey, edge));
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
}

async function scheduled(event, env, ctx) {
    // Кожні 5 хвилин: відкрити новини, час публікації яких настав (src/lib/scheduler.js).
    ctx.waitUntil(publishDueArticles(env.DB).catch(e => console.error("scheduler", e)));
    // Threads і німецький переклад щоразу переглядають усю таблицю новин, а чекають
    // 2 години після правки — тож їм досить запуску раз на 15 хвилин (економія читань D1).
    const minute = new Date(event.scheduledTime || Date.now()).getUTCMinutes();
    if (minute % 15 < 5) {
      // Автопостинг у Threads (src/lib/threads.js) — після розкладу, щоб не заважати публікації.
      ctx.waitUntil(runThreadsAutopost(env).catch(e => console.error("threads", e)));
      // Німецька версія: через 2 години після останньої правки (src/lib/translateDe.js).
      ctx.waitUntil(runGermanTranslation(env).catch(e => console.error("de-translate", e)));
    }
    if (event.cron === "17 3 * * *") {
      ctx.waitUntil(refreshThreadsToken(env).catch(e => console.error("threads-token", e)));
      ctx.waitUntil(
        env.DB.prepare(
          "DELETE FROM articles WHERE deleted_at IS NOT NULL AND datetime(deleted_at) <= datetime('now', '-30 days')"
        ).run()
      );
    }
  }
