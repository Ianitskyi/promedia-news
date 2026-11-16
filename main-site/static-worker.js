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

    return env.ASSETS.fetch(request);
  }
};
