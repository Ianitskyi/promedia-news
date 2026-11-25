// brands.promedia.report — статичний сайт досьє медіабрендів. Воркер лише додає кілька службових адрес;
// усе інше віддається зі зібраних файлів brands-site/dist.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // /logo/<slug> — коротка адреса логотипа бренду (для блоку «Медіабренди в матеріалі» на news.promedia.report).
    const logo = url.pathname.match(/^\/logo\/([a-z0-9-]+)\/?$/);
    if (logo) {
      const res = await env.ASSETS.fetch(new Request(new URL("/api/brands.json", url), request));
      if (res.ok) {
        const data = await res.json();
        const brand = (data.brands || []).find(b => b.slug === logo[1]);
        if (brand?.logo?.src) {
          return new Response(null, { status: 302, headers: { location: brand.logo.src, "cache-control": "public, max-age=3600" } });
        }
      }
      return new Response("Not found", { status: 404 });
    }

    if (url.pathname === "/api/brands.json") {
      const res = await env.ASSETS.fetch(request);
      const out = new Response(res.body, res);
      out.headers.set("access-control-allow-origin", "*");
      return out;
    }

    return env.ASSETS.fetch(request);
  }
};
