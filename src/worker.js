import { handlePublicRoute } from "./routes/public.js";
import { handleAuthRoute } from "./routes/auth.js";
import { handleAdminRoute } from "./routes/admin.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    try {
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

      if (url.pathname.startsWith("/api/admin/")) {
        const res = await handleAdminRoute(request, env, url);
        if (res) return res;
      }

      if (url.pathname.startsWith("/api/auth/") || url.pathname === "/api/me" || url.pathname === "/api/setup") {
        const res = await handleAuthRoute(request, env, url);
        if (res) return res;
      }

      const publicRes = await handlePublicRoute(request, env, url);
      if (publicRes) return publicRes;

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
};
