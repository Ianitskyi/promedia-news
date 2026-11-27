// Автовибір мови для першого візиту (news, projects, головний promedia.report).
//
// Правило: людина вперше заходить на будь-який сайт ПроМедіа (немає куки pm_lang) —
// відкриваємо ту мовну версію, яка відповідає основній мові її браузера/системи:
//   • якщо така мова в нас уже є (en, de, crh, а згодом pl, fr…) — саме вона;
//   • слов'янські мови (білоруська, сербська, російська, польська тощо) — українська;
//   • тюркські (турецька, азербайджанська, казахська, татарська тощо) — кримськотатарська;
//   • німецькомовні варіанти (de-AT, de-CH, швейцарська німецька) — німецька;
//   • усе інше — англійська.
// Після першого візиту кука pm_lang (на весь .promedia.report, на рік) запам'ятовує мову,
// і далі ми нікого нікуди не перекидаємо: перемикач мов працює як звичайно.
// Боти пошукових систем і соцмереж не перенаправляються — вони бачать сторінку за адресою.
//
// Таку саму таблицю мов має клієнтський скрипт public/js/promedia-language-suggest.js
// (для піддоменів без власного воркера) — правте обидва місця разом.

export const LANG_COOKIE = "pm_lang";
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

export const SLAVIC = ["uk", "be", "ru", "pl", "cs", "sk", "sl", "hr", "sr", "bs", "mk", "bg", "sh", "cnr", "rue", "csb", "szl", "hsb", "dsb"];
export const TURKIC = ["crh", "tr", "az", "kk", "ky", "uz", "tk", "tt", "ba", "cv", "ug", "sah", "gag", "krc", "kum", "nog", "alt", "tyv", "kaa", "kjh"];
export const GERMANIC_DE = ["de", "gsw"];

const BOT_UA = /bot|crawl|spider|slurp|preview|facebookexternalhit|facebookcatalog|telegram|whatsapp|viber|skype|discord|slack|linkedin|twitter|embedly|pinterest|vkshare|lighthouse|headless|curl|wget|python|node-fetch|go-http|java\//i;

// Основна мова з заголовка Accept-Language: найвищий q, при рівності — перша за порядком.
export function primaryLanguage(acceptLanguage) {
  const items = String(acceptLanguage || "")
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      const qParam = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      const q = qParam ? Number(qParam.slice(2)) : 1;
      return { code: tag.trim().toLowerCase().split(/[-_]/)[0], q: Number.isFinite(q) ? q : 0, index };
    })
    .filter((item) => item.code && item.code !== "*" && item.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);
  return items.length ? items[0].code : "";
}

// Яку мовну версію відкрити для мови code, якщо на сайті є мови available (перша — типова).
export function pickLanguage(code, available) {
  const has = (lang) => available.includes(lang);
  const fallback = has("en") ? "en" : available[0];
  if (!code) return null;
  if (has(code)) return code;
  if (SLAVIC.includes(code)) return has("uk") ? "uk" : fallback;
  if (TURKIC.includes(code)) return has("crh") ? "crh" : fallback;
  if (GERMANIC_DE.includes(code)) return has("de") ? "de" : fallback;
  return fallback;
}

export function readCookie(request, name) {
  const raw = request.headers.get("Cookie") || "";
  for (const part of raw.split(";")) {
    const eq = part.indexOf("=");
    if (eq !== -1 && part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return null;
}

function isPromediaHost(host) {
  return host === "promedia.report" || host.endsWith(".promedia.report");
}

export function langCookieHeader(lang, url) {
  let value = `${LANG_COOKIE}=${encodeURIComponent(lang)}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`;
  if (url.protocol === "https:") value += "; Secure";
  if (isPromediaHost(url.hostname.toLowerCase())) value += "; Domain=.promedia.report";
  return value;
}

// Мова сторінки за префіксом шляху: /en/…, /crh/…, /de/… (типова мова — без префікса).
export function languageOfPath(pathname, available) {
  const m = pathname.match(/^\/([a-z]{2,3})(?=\/|$)/i);
  const code = m ? m[1].toLowerCase() : "";
  return code && code !== available[0] && available.includes(code) ? code : available[0];
}

export function pathForLanguage(pathname, available, target) {
  const current = languageOfPath(pathname, available);
  let rest = current === available[0] ? pathname : pathname.slice(current.length + 1);
  if (!rest.startsWith("/")) rest = "/" + rest;
  return target === available[0] ? rest : `/${target}${rest}`;
}

function isPagePath(pathname) {
  if (/^\/(api|admin|admins|img-storage|js|css|assets|fonts|images?|cdn-cgi|\.well-known)(\/|$)/i.test(pathname)) return false;
  if (/\.(xml|txt|json|rss|atom|ico|png|jpe?g|webp|gif|svg|css|js|map|webmanifest|pdf|mp3|mp4|woff2?)$/i.test(pathname)) return false;
  return true;
}

// Повертає мову, на яку треба перенаправити, або null.
export function autoLanguageTarget(request, url, available) {
  if (request.method !== "GET") return null;
  if (!isPagePath(url.pathname)) return null;
  if (url.searchParams.has("lang") || url.searchParams.has("nocache")) return null;
  if (readCookie(request, LANG_COOKIE)) return null;
  const ua = request.headers.get("User-Agent") || "";
  if (!ua || BOT_UA.test(ua)) return null;
  const purpose = (request.headers.get("Sec-Purpose") || request.headers.get("Purpose") || "").toLowerCase();
  if (purpose.includes("prefetch") || purpose.includes("prerender")) return null;
  // Перехід з іншої сторінки ПроМедіа — людина вже на сайті, мову обрала сама.
  try {
    const ref = request.headers.get("Referer");
    if (ref && isPromediaHost(new URL(ref).hostname.toLowerCase())) return null;
  } catch (err) {}
  const target = pickLanguage(primaryLanguage(request.headers.get("Accept-Language")), available);
  if (!target || target === languageOfPath(url.pathname, available)) return null;
  return target;
}

export function autoLanguageRedirect(url, available, target) {
  const dest = new URL(url.href);
  dest.pathname = pathForLanguage(url.pathname, available, target);
  if (dest.pathname === "/" + target) dest.pathname += "/";
  return new Response(null, {
    status: 302,
    headers: {
      Location: dest.href,
      "Cache-Control": "private, no-store",
      "Set-Cookie": langCookieHeader(target, url)
    }
  });
}

// Додає куку pm_lang до HTML-відповіді, якщо її ще немає (позначка «перший візит уже був»).
export function withLanguageCookie(request, url, response, available) {
  if (!response || request.method !== "GET" || response.status !== 200) return response;
  if (!isPagePath(url.pathname) || readCookie(request, LANG_COOKIE)) return response;
  const type = response.headers.get("Content-Type") || "";
  if (!type.includes("text/html")) return response;
  const out = new Response(response.body, response);
  out.headers.append("Set-Cookie", langCookieHeader(languageOfPath(url.pathname, available), url));
  return out;
}
