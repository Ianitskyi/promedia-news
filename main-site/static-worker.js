// Заглушка «Сайт оновлюється». Щоб прибрати — поставити false.
const MAINTENANCE = true;
const MAINTENANCE_PAGE = `<!doctype html><html lang="uk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>ПроМедіа — оновлюємо сайт</title><style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f5f2ea;color:#0d0c5c;font-family:Montserrat,Arial,sans-serif;padding:24px;box-sizing:border-box}main{max-width:560px}img{width:120px;height:auto;margin-bottom:28px}h1{font-size:28px;line-height:1.2;margin:0 0 14px}p{font-size:17px;line-height:1.55;margin:0 0 12px}.line{width:40px;height:3px;background:#ffac33;margin:22px 0}.en{color:#4a4a7a;font-size:15px}a{color:#0d0c5c}</style></head><body><main><img src="/assets/logo.svg" alt="ПроМедіа"><h1>Сайт оновлюється</h1><p>Ми проводимо технічні роботи й скоро повернемося. Перепрошуємо за незручності.</p><p>Зв'язатися з нами: <a href="mailto:info@promedia.report">info@promedia.report</a></p><div class="line"></div><p class="en">The site is under maintenance. We'll be back shortly — sorry for the inconvenience.</p></main></body></html>`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/news" || url.pathname.startsWith("/news/")) {
      const suffix = url.pathname.replace(/^\/news/, "") || "/";
      return Response.redirect("https://news.promedia.report" + suffix + url.search, 301);
    }

    if (url.pathname === "/projects" || url.pathname.startsWith("/projects/")) {
      const suffix = url.pathname.replace(/^\/projects/, "") || "/";
      return Response.redirect("https://projects.promedia.report" + suffix + url.search, 301);
    }

    const isPage = !/\.[a-z0-9]{2,5}$/i.test(url.pathname) || url.pathname.endsWith(".html");
    if (MAINTENANCE && isPage) {
      return new Response(MAINTENANCE_PAGE, {
        status: 503,
        headers: { "content-type": "text/html; charset=utf-8", "retry-after": "3600", "cache-control": "no-store" }
      });
    }

    return env.ASSETS.fetch(request);
  }
};
