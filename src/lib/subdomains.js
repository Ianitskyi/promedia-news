const SITES = [
  {
    id: "research",
    label: "research.promedia.report",
    title: "Дослідження",
    repo: "Ianitskyi/promedia-research",
    branch: "main",
    liveUrl: "https://research.promedia.report",
    files: [
      {
        id: "site",
        label: "Тексти і SEO",
        path: "content/site.json",
        type: "json",
        help: "Заголовки, SEO-описи, перший екран і службові тексти українською та англійською."
      },
      {
        id: "catalog",
        label: "Каталог досліджень",
        path: "data/research.json",
        type: "researchCatalog",
        help: "Картки досліджень: назви, описи, автори, теги, джерела та посилання на повні тексти."
      }
    ]
  }
];

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}

function publicSite(site) {
  return {
    id: site.id,
    label: site.label,
    title: site.title,
    branch: site.branch,
    liveUrl: site.liveUrl,
    files: site.files.map((file) => ({
      id: file.id,
      label: file.label,
      path: file.path,
      type: file.type,
      help: file.help
    }))
  };
}

function getSite(id) {
  return SITES.find((site) => site.id === id) || null;
}

function getFile(site, id) {
  return site.files.find((file) => file.id === id) || null;
}

function token(env) {
  return String(env.SUBDOMAINS_GITHUB_TOKEN || "").trim();
}

function repoApiPath(site, file) {
  return `/repos/${site.repo}/contents/${encodeURIComponent(file.path).replace(/%2F/g, "/")}`;
}

function decodeBase64(content) {
  const clean = String(content || "").replace(/\n/g, "");
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function encodeBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

async function githubRequest(env, path, options = {}) {
  const authToken = token(env);
  const headers = {
    "Accept": "application/vnd.github+json",
    "User-Agent": "promedia-news-admin",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(options.headers || {})
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(data && data.message ? data.message : `GitHub API ${response.status}`);
  }
  return data;
}

function validateResearchCatalog(data) {
  if (!Array.isArray(data)) throw new Error("Каталог досліджень має бути списком записів.");
  const ids = data.map((item) => item && item.id).filter(Boolean);
  if (ids.length !== new Set(ids).size) throw new Error("У каталозі досліджень є дублікати ID.");
  data.forEach((item, index) => {
    if (!item || typeof item !== "object") throw new Error(`Запис ${index + 1} має бути об’єктом.`);
    if (!item.id) throw new Error(`У записі ${index + 1} бракує ID.`);
    if (!item.title || !item.title.uk || !item.title.en) throw new Error(`У записі ${index + 1} бракує назви UA або EN.`);
  });
}

function validateContent(content, file) {
  if (file.type !== "json" && file.type !== "researchCatalog") return;
  const parsed = JSON.parse(content);
  if (file.type === "researchCatalog") validateResearchCatalog(parsed);
}

export async function handleAdminSubdomainsRoute(request, env, url, user) {
  if (user.role !== "admin") return json({ error: "forbidden" }, 403);

  if (url.pathname === "/api/admin/subdomains" && request.method === "GET") {
    return json({
      configured: Boolean(token(env)),
      items: SITES.map(publicSite)
    });
  }

  const fileMatch = url.pathname.match(/^\/api\/admin\/subdomains\/([a-z0-9-]+)\/files\/([a-z0-9-]+)$/);
  if (!fileMatch) return null;

  const site = getSite(fileMatch[1]);
  if (!site) return json({ error: "unknown_site" }, 404);
  const file = getFile(site, fileMatch[2]);
  if (!file) return json({ error: "unknown_file" }, 404);

  if (request.method === "GET") {
    const data = await githubRequest(
      env,
      `${repoApiPath(site, file)}?ref=${encodeURIComponent(site.branch)}`
    );
    if (data.type !== "file") return json({ error: "not_a_file" }, 400);
    return json({
      configured: Boolean(token(env)),
      site: publicSite(site),
      file: {
        id: file.id,
        label: file.label,
        path: file.path,
        type: file.type,
        help: file.help,
        htmlUrl: data.html_url
      },
      content: decodeBase64(data.content),
      sha: data.sha
    });
  }

  if (request.method === "PUT") {
    if (!token(env)) {
      return json({ error: "Серверний GitHub-доступ ще не підключений. Потрібен секрет SUBDOMAINS_GITHUB_TOKEN." }, 503);
    }
    const body = await request.json().catch(() => null);
    if (!body || typeof body.content !== "string" || !body.sha) {
      return json({ error: "content і sha обов’язкові" }, 400);
    }
    try {
      validateContent(body.content, file);
    } catch (err) {
      return json({ error: err.message || "Невалідний вміст" }, 400);
    }

    const message = String(body.message || `Update ${file.path} via ProMedia admin`).trim();
    const result = await githubRequest(env, repoApiPath(site, file), {
      method: "PUT",
      body: JSON.stringify({
        message,
        content: encodeBase64(body.content.endsWith("\n") ? body.content : `${body.content}\n`),
        sha: body.sha,
        branch: site.branch
      })
    });
    return json({
      ok: true,
      sha: result.content.sha,
      commit: {
        sha: result.commit.sha,
        url: result.commit.html_url
      }
    });
  }

  return null;
}
