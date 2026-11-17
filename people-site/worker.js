// people.promedia.report — статичний сайт досьє. Воркер лише додає кілька службових адрес;
// усе інше віддається зі зібраних файлів people-site/dist.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // /photo/<slug> — коротка адреса фото людини (для блоку «Люди в матеріалі» на news.promedia.report).
    const photo = url.pathname.match(/^\/photo\/([a-z0-9-]+)\/?$/);
    if (photo) {
      const res = await env.ASSETS.fetch(new Request(new URL("/api/people.json", url), request));
      if (res.ok) {
        const data = await res.json();
        const person = (data.people || []).find(p => p.slug === photo[1]);
        if (person?.photo?.src) {
          return new Response(null, { status: 302, headers: { location: person.photo.src, "cache-control": "public, max-age=3600" } });
        }
      }
      return new Response("Not found", { status: 404 });
    }

    if (url.pathname === "/api/people.json") {
      const res = await env.ASSETS.fetch(request);
      const out = new Response(res.body, res);
      out.headers.set("access-control-allow-origin", "*");
      return out;
    }

    return env.ASSETS.fetch(request);
  }
};
