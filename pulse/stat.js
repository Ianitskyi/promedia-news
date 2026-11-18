// stat.promedia.report — закрита сторінка статистики для команди ПроМедіа.
// Вхід через Google (Google Identity Services, без пароля), сесія — cookie на 30 днів. Хто має доступ — див. allowed() і STAT_ALLOWED у wrangler.toml.

const STAT_HOST = "stat.promedia.report";
const COOKIE = "pm_stat";
const DAY = 86400_000;

async function sha(text) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function rnd(bytes) {
  const a = new Uint8Array(bytes); crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}
let ready = false;
async function schema(env) {
  if (ready) return;
  await env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS pulse_kv (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS stat_sessions (token_hash TEXT PRIMARY KEY, email TEXT NOT NULL, expires INTEGER NOT NULL)"),
  ]);
  ready = true;
}

// Хто може входити: адреси зі STAT_ALLOWED (повні адреси або «@домен») і всі користувачі адмінки новин
async function allowed(env, email) {
  const list = String(env.STAT_ALLOWED || "").toLowerCase().split(",").map((x) => x.trim()).filter(Boolean);
  if (list.some((a) => (a.startsWith("@") ? email.endsWith(a) : email === a))) return true;
  const row = await env.DB.prepare("SELECT 1 FROM users WHERE lower(email) = ?").bind(email).first().catch(() => null);
  return !!row;
}

function cookieOf(request) {
  const m = (request.headers.get("cookie") || "").match(new RegExp("(?:^|; )" + COOKIE + "=([a-f0-9]{64})"));
  return m ? m[1] : null;
}

async function sessionUser(request, env) {
  const t = cookieOf(request);
  if (!t) return null;
  const row = await env.DB.prepare("SELECT email, expires FROM stat_sessions WHERE token_hash = ?").bind(await sha(t)).first();
  return row && row.expires > Date.now() ? row.email : null;
}

const LOGIN_CSS = "body{font:16px/1.5 system-ui,-apple-system,sans-serif;max-width:420px;margin:14vh auto;padding:0 20px;color:#1a1a1a;text-align:center}h1{font-size:22px}.m{color:#666;font-size:14px}.e{color:#b3261e}#g{display:flex;justify-content:center;margin:24px 0}@media (prefers-color-scheme:dark){body{background:#161616;color:#eee}}";

function loginPage(env, note = "") {
  const cid = esc(env.GOOGLE_CLIENT_ID || "");
  return new Response(`<!doctype html><html lang=uk><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><meta name=robots content=noindex><title>Вхід — Статистика ПроМедіа</title><style>${LOGIN_CSS}</style>
<h1>Статистика ПроМедіа</h1>
<p class=m>Для команди ПроМедіа. Увійдіть своїм Google-акаунтом (пошта @promedia.report).</p>
<p class=e id=err>${esc(note)}</p>
<div id=g></div>
<script src="https://accounts.google.com/gsi/client" async></script>
<script>
window.onGoogle = function (r) {
  document.getElementById('err').textContent = 'Перевіряю…';
  fetch('/login/google', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ credential: r.credential }) })
    .then(function (x) { return x.json(); })
    .then(function (j) { if (j.ok) location.replace('/'); else document.getElementById('err').textContent = j.error || 'Не вдалося увійти.'; })
    .catch(function () { document.getElementById('err').textContent = 'Не вдалося увійти. Спробуйте ще раз.'; });
};
window.addEventListener('load', function () {
  google.accounts.id.initialize({ client_id: '${cid}', callback: window.onGoogle, ux_mode: 'popup', auto_select: true });
  google.accounts.id.renderButton(document.getElementById('g'), { theme: 'outline', size: 'large', text: 'signin_with', locale: 'uk' });
  google.accounts.id.prompt();
});
</script></html>`, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

let gCerts = null; // { keys, at }
async function googleKeys() {
  if (gCerts && Date.now() - gCerts.at < 3600_000) return gCerts.keys;
  const res = await fetch("https://www.googleapis.com/oauth2/v3/certs");
  if (!res.ok) throw new Error("google certs " + res.status);
  gCerts = { keys: (await res.json()).keys, at: Date.now() };
  return gCerts.keys;
}

function b64urlBytes(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

// Перевіряє Google ID-токен і повертає підтверджену пошту або null
async function verifyGoogle(env, token) {
  const [h, p, sig] = String(token || "").split(".");
  if (!h || !p || !sig) return null;
  const header = JSON.parse(new TextDecoder().decode(b64urlBytes(h)));
  const claims = JSON.parse(new TextDecoder().decode(b64urlBytes(p)));
  if (claims.aud !== env.GOOGLE_CLIENT_ID) return null;
  if (!["accounts.google.com", "https://accounts.google.com"].includes(claims.iss)) return null;
  if (!claims.exp || claims.exp * 1000 < Date.now()) return null;
  if (claims.email_verified !== true && claims.email_verified !== "true") return null;
  const jwk = (await googleKeys()).find((k) => k.kid === header.kid);
  if (!jwk) return null;
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64urlBytes(sig), new TextEncoder().encode(h + "." + p));
  return ok ? String(claims.email || "").toLowerCase() : null;
}

async function handleGoogleLogin(request, env) {
  const reply = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", ...headers } });
  const body = await request.json().catch(() => null);
  let email = null;
  try { email = await verifyGoogle(env, body && body.credential); } catch (e) { console.error("google verify:", e.message); }
  if (!email) return reply({ error: "Google не підтвердив вхід. Спробуйте ще раз." }, 401);
  if (!(await allowed(env, email))) return reply({ error: `Акаунт ${email} не має доступу. Увійдіть робочою поштою @promedia.report.` }, 403);
  const token = rnd(32);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM stat_sessions WHERE expires < ?").bind(Date.now()),
    env.DB.prepare("INSERT INTO stat_sessions (token_hash, email, expires) VALUES (?, ?, ?)").bind(await sha(token), email, Date.now() + 30 * DAY),
  ]);
  return reply({ ok: true }, 200, { "set-cookie": `${COOKIE}=${token}; Path=/; Max-Age=${30 * 86400}; HttpOnly; Secure; SameSite=Lax` });
}

export function isStatHost(url) {
  return url.hostname === STAT_HOST;
}

export async function handleStat(request, env, api) {
  const url = new URL(request.url);
  await schema(env);
  if (url.pathname === "/robots.txt") return new Response("User-agent: *\nDisallow: /\n");
  if (url.pathname === "/login/google" && request.method === "POST") return handleGoogleLogin(request, env);
  if (url.pathname === "/logout") {
    const t = cookieOf(request);
    if (t) await env.DB.prepare("DELETE FROM stat_sessions WHERE token_hash = ?").bind(await sha(t)).run();
    return new Response(null, { status: 303, headers: { location: "/", "set-cookie": `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax` } });
  }
  const user = await sessionUser(request, env);
  if (!user) {
    if (url.pathname.startsWith("/api/")) return new Response(JSON.stringify({ error: "login" }), { status: 401, headers: { "content-type": "application/json" } });
    return loginPage(env);
  }
  const send = (data) => new Response(JSON.stringify(data), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
  try {
    if (url.pathname === "/api/now") {
      const parts = ["summary", "minutes", "pages", "cities", "countries", "devices"];
      const vals = await Promise.all(parts.map((p) => api.nowPart(env, p).then((r) => r.rows)));
      return send(Object.fromEntries(parts.map((p, i) => [p, vals[i]])));
    }
    if (url.pathname === "/api/today") {
      const host = url.searchParams.get("host") || "";
      const days = Number(url.searchParams.get("days")) || 1;
      return send(await api.todayPart(env, "", { host, days }));
    }
    if (url.pathname === "/api/history") return send(await api.pulseHistory(env, Number(url.searchParams.get("hours")) || 24));
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 502, headers: { "content-type": "application/json; charset=utf-8" } });
  }
  if (url.pathname === "/" || url.pathname === "/index.html") {
    return new Response(PAGE.replace("{{USER}}", esc(user)), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
  }
  return new Response("not found", { status: 404 });
}


const PAGE = `<!doctype html>
<html lang="uk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Статистика ПроМедіа</title>
<style>
:root{--fg:#1a1a1a;--muted:#6b6b6b;--bg:#f6f5f2;--panel:#fff;--line:#e4e2dc;--accent:#c8102e;--bar:#c8102e;--ok:#137333}
@media (prefers-color-scheme:dark){:root{--fg:#ececec;--muted:#a0a0a0;--bg:#161616;--panel:#202020;--line:#333;--bar:#e0475f}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.wrap{max-width:1100px;margin:0 auto;padding:20px 16px 40px}
header{display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:8px}
h1{font-size:24px;margin:0}h2{font-size:16px;margin:0 0 10px}.muted{color:var(--muted);font-size:13px}
.lead{margin:6px 0 18px;color:var(--muted)}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:16px}
.card,.box{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px;min-width:0}
.card .v{font-size:34px;font-weight:600;font-variant-numeric:tabular-nums;line-height:1.1;margin-top:4px}
.hot{color:var(--accent)}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px;margin-bottom:12px}
.bars{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:7px}
.bars li{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 8px}
.bars .nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bars .n{color:var(--muted);font-variant-numeric:tabular-nums}
.bars .b{grid-column:1/3;height:4px;border-radius:2px;background:var(--bar)}
.chart{position:relative;height:170px}.chart svg{width:100%;height:100%;display:block}
.chart text{fill:var(--muted);font-size:11px}.tip{position:absolute;top:0;background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:2px 8px;font-size:12px;pointer-events:none;white-space:nowrap}
table{width:100%;border-collapse:collapse}th,td{padding:6px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
th{font-size:12px;color:var(--muted);font-weight:500}td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}td a{color:inherit}
.tw{overflow-x:auto}.ctl{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:22px 0 10px}
select,button{font:inherit;font-size:13px;padding:5px 9px;border:1px solid var(--line);border-radius:6px;background:var(--panel);color:var(--fg)}
.err{color:var(--accent);font-size:13px}
</style></head><body><div class="wrap">
<header><h1>Статистика ПроМедіа</h1><span class="muted">Ви увійшли як {{USER}} · <a href="/logout" style="color:inherit">вийти</a></span></header>
<p class="lead" id="lead">Завантажую…</p>
<div class="cards">
 <div class="card"><div class="muted">Людей за 30 хв</div><div class="v" id="a30">—</div></div>
 <div class="card"><div class="muted">За 5 хв</div><div class="v" id="a5">—</div><div class="muted">зазвичай о цій порі: <span id="usual">—</span></div></div>
 <div class="card"><div class="muted">Читачів за період</div><div class="v" id="tu">—</div><div class="muted">переглядів: <span id="tv">—</span></div></div>
</div>
<div class="grid">
 <div class="box"><h2>По хвилинах, останні 30 хв</h2><div class="chart" id="minutes"></div></div>
 <div class="box"><h2>Останні 24 години</h2><div class="muted" style="margin:-6px 0 6px">людей за 5 хв, перевірка кожні 5 хв</div><div class="chart" id="history"></div></div>
</div>
<div class="box" style="margin-bottom:12px"><h2>Що читають зараз</h2><ul class="bars" id="pages"></ul></div>
<div class="grid">
 <div class="box"><h2>Міста</h2><ul class="bars" id="cities"></ul></div>
 <div class="box"><h2>Країни</h2><ul class="bars" id="countries"></ul></div>
 <div class="box"><h2>Пристрої</h2><ul class="bars" id="devices"></ul></div>
</div>
<div class="ctl"><h2 style="margin:0">Звіт</h2>
 <select id="days"><option value="1">Сьогодні</option><option value="7">7 днів</option><option value="28">28 днів</option></select>
 <select id="host"><option value="">Усі сайти</option></select>
 <span class="muted">Google віддає ці дані із затримкою</span></div>
<div class="grid">
 <div class="box"><h2>Звідки прийшли</h2><ul class="bars" id="sources"></ul></div>
 <div class="box"><h2>Сайти</h2><ul class="bars" id="sites"></ul></div>
</div>
<div class="box"><h2>Найпопулярніше</h2><div class="tw"><table><thead><tr><th>Сторінка</th><th class="n">Перегляди</th><th class="n">Читачі</th></tr></thead><tbody id="top"></tbody></table></div></div>
<p class="muted" style="margin-top:18px">Дані: Google Analytics 4, усі сайти *.promedia.report. Блоки «зараз» оновлюються щохвилини.</p>
</div>
<script>
var fmt=function(n){return n==null?'—':Number(n).toLocaleString('uk-UA')};
var $=function(id){return document.getElementById(id)};
function get(u){return fetch(u,{credentials:'same-origin'}).then(function(r){return r.json().then(function(j){if(!r.ok)throw new Error(j.error||r.status);return j})})}
function el(t,c,txt){var e=document.createElement(t);if(c)e.className=c;if(txt!=null)e.textContent=txt;return e}
var SRC={'(direct)':'Напряму',google:'Google','facebook.com':'Facebook','m.facebook.com':'Facebook','l.facebook.com':'Facebook','lm.facebook.com':'Facebook','t.me':'Telegram','l.threads.com':'Threads','threads.net':'Threads','instagram.com':'Instagram','l.instagram.com':'Instagram'};
var DEV={mobile:'Телефон',desktop:'Комп’ютер',tablet:'Планшет'};
function bars(id,rows,name,val,limit){var ul=$(id);ul.replaceChildren();rows=(rows||[]).slice(0,limit||8);
 if(!rows.length){ul.appendChild(el('li','muted','Поки нікого'));return}
 var max=Math.max.apply(null,rows.map(function(r){return +r[val]}))||1;
 rows.forEach(function(r){var li=el('li');var nm=el('span','nm',name(r));nm.title=nm.textContent;var b=el('span','b');b.style.width=Math.max(2,100*r[val]/max)+'%';li.append(nm,el('span','n',fmt(r[val])),b);ul.appendChild(li)})}
function chart(id,pts,label){var box=$(id);box.replaceChildren();if(!pts.length){box.appendChild(el('div','muted','Ще накопичується'));return}
 var W=box.clientWidth||300,H=170,ml=28,mb=20,mt=6,max=Math.max(1,Math.max.apply(null,pts.map(function(p){return p.v})));
 var ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 '+W+' '+H);svg.setAttribute('role','img');svg.setAttribute('aria-label',label);
 function mk(t,a){var e=document.createElementNS(ns,t);for(var k in a)e.setAttribute(k,a[k]);svg.appendChild(e);return e}
 var y=function(v){return H-mb-(H-mb-mt)*v/max},x=function(i){return ml+(W-ml-6)*(pts.length===1?0.5:i/(pts.length-1))};
 [0,Math.round(max/2),max].forEach(function(v){mk('line',{x1:ml,x2:W-6,y1:y(v),y2:y(v),stroke:'currentColor','stroke-opacity':0.12});var t=mk('text',{x:ml-4,y:y(v)+4,'text-anchor':'end'});t.textContent=v});
 if(id==='minutes'){var bw=(W-ml-6)/pts.length*0.8;pts.forEach(function(p,i){mk('rect',{x:ml+(W-ml-6)*i/pts.length,y:y(p.v),width:bw,height:Math.max(0,H-mb-y(p.v)),fill:'var(--bar)'})})}
 else{mk('path',{d:pts.map(function(p,i){return(i?'L':'M')+x(i)+' '+y(p.v)}).join(''),fill:'none',stroke:'var(--bar)','stroke-width':1.8})}
 [0,Math.floor(pts.length/2),pts.length-1].forEach(function(i){var t=mk('text',{x:id==='minutes'?ml+(W-ml-6)*(i+0.4)/pts.length:x(i),y:H-4,'text-anchor':'middle'});t.textContent=pts[i].l});
 box.appendChild(svg);var tip=el('div','tip');tip.hidden=true;box.appendChild(tip);
 svg.addEventListener('pointermove',function(e){var r=svg.getBoundingClientRect();var i=Math.round((e.clientX-r.left-ml*r.width/W)/((r.width-(ml+6)*r.width/W))*(pts.length-1));i=Math.max(0,Math.min(pts.length-1,i));tip.hidden=false;tip.textContent=pts[i].t+': '+fmt(pts[i].v);tip.style.left=Math.min(Math.max(0,e.clientX-r.left-40),r.width-110)+'px'});
 svg.addEventListener('pointerleave',function(){tip.hidden=true})}
function loadNow(){return get('/api/now').then(function(d){var s=d.summary[0]||{};$('a30').textContent=fmt(s.active_30min);$('a5').textContent=fmt(s.active_5min);$('usual').textContent=s.usual_5min==null?'ще рахується':fmt(s.usual_5min);
 var hot=s.usual_5min!=null&&s.active_5min>=Math.max(10,3*s.usual_5min);$('a5').classList.toggle('hot',hot);
 var lead='О '+s.kyiv_time+' на сайтах ПроМедіа '+fmt(s.active_30min)+' людей за 30 хвилин. ';
 lead+=s.usual_5min==null?'Звичайний рівень ще накопичується.':hot?'Це сплеск: за 5 хв '+fmt(s.active_5min)+', зазвичай близько '+fmt(s.usual_5min)+'.':s.active_5min>1.5*s.usual_5min?'Трохи жвавіше, ніж зазвичай.':'Усе спокійно, як зазвичай о цій порі.';$('lead').textContent=lead;
 chart('minutes',d.minutes.map(function(r){return{v:r.users,l:r.minutes_ago?'−'+r.minutes_ago+' хв':'зараз',t:r.minutes_ago?r.minutes_ago+' хв тому':'щойно'}}),'Людей щохвилини за 30 хвилин');
 bars('pages',d.pages,function(r){return r.title},'views',10);bars('cities',d.cities,function(r){return r.city},'users');bars('countries',d.countries,function(r){return r.country},'users');bars('devices',d.devices,function(r){return DEV[r.device]||r.device},'users')}).catch(function(e){$('lead').textContent='';$('lead').appendChild(el('span','err','Не вдалося отримати дані: '+e.message))})}
function loadHistory(){return get('/api/history?hours=24').then(function(d){chart('history',d.rows.map(function(r){return{v:r.users,l:r.kyiv,t:r.kyiv}}),'Людей за 5 хвилин протягом доби')})}
var hostsFilled=false;
function loadToday(){var q='?days='+$('days').value+'&host='+encodeURIComponent($('host').value);return get('/api/today'+q).then(function(t){$('tu').textContent=fmt(t.users);$('tv').textContent=fmt(t.pageviews);
 bars('sources',t.sources,function(r){return(SRC[r.source]||r.source)+(r.medium&&r.medium!=='(none)'&&r.medium!=='referral'?' · '+r.medium:'')},'sessions',10);
 bars('sites',t.sites,function(r){return r.host},'users',10);
 if(!hostsFilled&&t.sites&&t.sites.length){hostsFilled=true;t.sites.forEach(function(s){$('host').appendChild(new Option(s.host,s.host))})}
 var tb=$('top');tb.replaceChildren();(t.pages||[]).slice(0,15).forEach(function(p){var tr=el('tr'),td=el('td'),a=el('a',null,p.title||p.url);a.href=p.url;a.target='_blank';a.rel='noopener';td.appendChild(a);tr.append(td,el('td','n',fmt(p.views)),el('td','n',fmt(p.users)));tb.appendChild(tr)})})}
$('days').addEventListener('change',loadToday);$('host').addEventListener('change',loadToday);
loadNow();loadHistory();loadToday();
setInterval(function(){if(document.visibilityState==='visible'){loadNow()}},60000);
setInterval(function(){if(document.visibilityState==='visible'){loadHistory();loadToday()}},300000);
var lw=0;addEventListener('resize',function(){if(Math.abs(innerWidth-lw)>40){lw=innerWidth;loadNow();loadHistory()}});
</script></body></html>`;
