(function(){
  const HOSTS={
    projects:"projects.promedia.report",
    news:"news.promedia.report",
    communities:"communities.promedia.report",
    ratings:"ratings.promedia.report",
    research:"research.promedia.report",
    atlas:"atlas.promedia.report"
  };
  const L={
    uk:{projects:"Проєкти",about:"Про нас",contacts:"Контакти",news:"Новини",communities:"Карта спільнот",ratings:"Рейтинг журфаків",research:"Дослідження",atlas:"Атлас медіа",details:"Дані про організацію",official:"Офіційна назва",officialValue:"ГО «ПроМедіа»",reg:"Реєстраційний номер",address:"Юридична адреса",addressValue:"вул. Володимира Самійленка 19/44, Київ, Україна, 03118",chair:"Голова правління",chairValue:"Андрій Яніцький",privacy:"Приватність і cookie",rights:"Усі права захищені"},
    en:{projects:"Projects",about:"About us",contacts:"Contacts",news:"News",communities:"Communities Map",ratings:"Journalism Schools",research:"Research",atlas:"Media Atlas",details:"Organization details",official:"Official name",officialValue:"NGO “ProMedia”",reg:"Registration number",address:"Legal address",addressValue:"19/44 Volodymyr Samiilenko St, Kyiv, Ukraine, 03118",chair:"Chair of the Board",chairValue:"Andrii Ianitskyi",privacy:"Privacy and cookies",rights:"All rights reserved"},
    crh:{projects:"Loyihalar",about:"Biz aqqımızda",contacts:"Kontaktlar",news:"Haberler",communities:"Cemaatlar haritası",ratings:"Jurnalistika fakülteleri reytingi",research:"Tedqiqatlar",atlas:"Mediya Atlası",details:"Teşkilât aqqında malümat",official:"Resmiy adı",officialValue:"«ProMedia» İCT",reg:"Qayd nomeri",address:"Yuridik adres",addressValue:"Volodymyr Samiilenko soqağı, 19/44, Kyiv, Ukraina, 03118",chair:"İdare Keñeşi reisi",chairValue:"Andrii Ianitskyi",privacy:"Mahremiyet ve cookie",rights:"Er aqqı saqlıdır"}
  };
  const lang=(()=>{
    const p=location.pathname.split("/").filter(Boolean)[0];
    if(p==="en"||p==="crh") return p;
    const h=(document.documentElement.lang||"").toLowerCase();
    return h.startsWith("en")?"en":h.startsWith("crh")?"crh":"uk";
  })();
  const t=L[lang];
  const prefix=lang==="uk"?"":"/"+lang;
  const localize=(base)=>base+prefix+"/";
  const mainBase="https://promedia.report";
  const mainHome=mainBase+(lang==="uk"?"/":prefix+"/");
  const projectUrl=localize("https://projects.promedia.report");
  const links={
    news:localize("https://news.promedia.report"),
    communities:localize("https://communities.promedia.report"),
    ratings:localize("https://ratings.promedia.report"),
    research:localize("https://research.promedia.report"),
    atlas:localize("https://atlas.promedia.report")
  };
  const current=Object.keys(HOSTS).find(k=>location.hostname===HOSTS[k])||"";
  const samePath=(targetLang)=>{
    const alt=document.querySelector('link[rel="alternate"][hreflang="'+targetLang+'"]');
    if(alt&&alt.href)return alt.href;
    if(location.hostname==="research.promedia.report"&&location.pathname.includes("/membership-guide/")){
      return targetLang==="uk"?"https://research.promedia.report/membership-guide/":"https://research.promedia.report/"+targetLang+"/";
    }
    const u=new URL(location.href);
    let path=u.pathname.replace(/^\/(en|crh)(?=\/|$)/,"")||"/";
    const p=targetLang==="uk"?"":"/"+targetLang;
    return u.origin+p+(path==="/" ? "/" : path)+u.search+u.hash;
  };
  const socialIcon=(name)=>({
    youtube:'<svg viewBox="0 0 24 24"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4L15.8 12l-6.2 3.6Z"/></svg>',
    instagram:'<svg viewBox="0 0 24 24"><path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7Zm10.5 1.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"/></svg>',
    linkedin:'<svg viewBox="0 0 24 24"><path d="M4.98 3.5A2.5 2.5 0 1 1 5 8.5a2.5 2.5 0 0 1-.02-5ZM3 10h4v11H3V10Zm6 0h3.8v1.5h.05c.53-1 1.83-2.05 3.77-2.05C20.65 9.45 21 12.1 21 15.55V21h-4v-4.83c0-1.15-.02-2.63-1.6-2.63-1.6 0-1.85 1.25-1.85 2.55V21H9V10Z"/></svg>',
    facebook:'<svg viewBox="0 0 24 24"><path d="M13.7 21v-8h2.8l.4-3.2h-3.2V7.7c0-.9.3-1.6 1.7-1.6h1.8V3.2c-.3 0-1.4-.2-2.6-.2-2.6 0-4.4 1.6-4.4 4.5v2.3H7.3V13h2.9v8h3.5Z"/></svg>'
  }[name]);
  const css=`
:root{--pm-shell-ink:#0d0c5c;--pm-shell-paper:#f7f5ef;--pm-shell-accent:#ffac33}
promedia-global-header,promedia-global-footer{display:block;font-family:Montserrat,Arial,sans-serif}
.pm-global-header{position:sticky;top:0;z-index:999;width:100%;background:rgba(255,255,255,.98);border-bottom:1px solid rgba(13,12,92,.1);box-shadow:0 4px 16px rgba(13,12,92,.06)}
.pm-global-main{display:flex;align-items:center;gap:28px;min-height:70px;padding:8px clamp(18px,4vw,64px)}
.pm-global-logo{display:block;width:112px;height:50px;flex:0 0 auto}
.pm-global-logo img{display:block;width:100%;height:100%;object-fit:contain}
.pm-global-primary{display:flex;align-items:center;gap:clamp(18px,2.4vw,36px);margin-left:auto}
.pm-global-primary a,.pm-global-secondary a{color:var(--pm-shell-ink);font-weight:700;text-decoration:none;white-space:nowrap}
.pm-global-primary a{font-size:15px}.pm-global-secondary a{font-size:12px;color:rgba(13,12,92,.72)}
.pm-global-primary a:hover,.pm-global-secondary a:hover{color:#e8901a}
.pm-global-langs{display:flex;gap:2px;align-items:center}
.pm-global-langs a{padding:4px 8px;border-radius:999px;color:var(--pm-shell-ink);font-size:12px;font-weight:700;text-decoration:none}
.pm-global-langs a.active{background:var(--pm-shell-ink);color:#fff}
.pm-global-secondary{display:flex;justify-content:flex-end;gap:clamp(18px,2.2vw,34px);padding:8px clamp(18px,4vw,64px) 10px;background:var(--pm-shell-paper);border-top:1px solid rgba(13,12,92,.08);overflow-x:auto;scrollbar-width:none}
.pm-global-secondary::-webkit-scrollbar{display:none}.pm-global-secondary a.active{color:#e8901a}
.pm-global-burger{display:none;margin-left:auto;position:relative}.pm-global-burger summary{list-style:none;cursor:pointer;width:42px;height:42px;display:grid;place-items:center;gap:5px}.pm-global-burger summary::-webkit-details-marker{display:none}
.pm-global-burger summary span,.pm-global-burger summary:before,.pm-global-burger summary:after{content:"";display:block;width:23px;height:2px;background:var(--pm-shell-ink)}
.pm-global-mobile-panel{position:absolute;right:0;top:48px;min-width:280px;overflow:hidden;border:1px solid rgba(13,12,92,.12);border-radius:14px;background:#fff;box-shadow:0 14px 30px rgba(13,12,92,.16)}
.pm-global-mobile-main,.pm-global-mobile-sub{display:flex;flex-direction:column}.pm-global-mobile-main{background:#fff}.pm-global-mobile-sub{background:var(--pm-shell-paper);border-top:1px solid rgba(13,12,92,.08)}
.pm-global-mobile-panel a{display:block;padding:12px 14px;color:var(--pm-shell-ink);font-size:13px;font-weight:700;text-decoration:none}
.pm-global-mobile-panel a:hover{background:#fff8ec}.pm-global-mobile-sub a:hover{background:#efeade}
.pm-global-footer{background:#08083a;color:#e9edf2;padding:64px 0 42px}
.pm-global-footer-inner{width:min(1120px,calc(100% - 40px));margin:0 auto}
.pm-global-footer-top{display:grid;grid-template-columns:1fr 1fr 1fr;gap:34px;align-items:start}
.pm-global-footer-logo img{width:150px;filter:brightness(0) invert(1)}
.pm-global-footer-contact{margin:0;padding:0;list-style:none}.pm-global-footer-contact li{margin:0 0 10px}
.pm-global-footer a{color:#fff;text-decoration:none}.pm-global-footer a:hover{color:var(--pm-shell-accent)}
.pm-global-footer-nav{display:flex;flex-direction:column;gap:9px}
.pm-global-socials{display:flex;gap:12px;margin-top:14px}.pm-global-socials a{display:flex;align-items:center;justify-content:center;width:38px;height:38px;border:1px solid rgba(255,255,255,.3);border-radius:50%}
.pm-global-socials svg{width:20px;height:20px;fill:currentColor}
.pm-global-org{margin:34px auto 0;max-width:900px}.pm-global-org h3{text-align:center;font-size:1rem;margin:0 0 14px}
.pm-global-org table{width:100%;border-collapse:collapse}.pm-global-org td{padding:9px 10px;border-bottom:1px solid rgba(255,255,255,.18);vertical-align:top}.pm-global-org td:first-child{font-weight:700;color:#fff;width:36%}
.pm-global-bottom{display:flex;justify-content:space-between;gap:22px;margin-top:34px;padding-top:28px;border-top:1px solid rgba(255,255,255,.18);font-size:.9rem}.pm-global-powered{display:flex;align-items:center;gap:10px;margin-top:8px}.pm-global-powered img{width:88px;filter:brightness(0) invert(1);opacity:.9}
@media(max-width:980px){.pm-global-primary,.pm-global-secondary{display:none}.pm-global-burger{display:block}.pm-global-main{min-height:62px;padding:6px 18px}.pm-global-logo{width:100px;height:44px}.pm-global-footer-top{grid-template-columns:1fr 1fr}.pm-global-footer-nav{grid-column:1/-1;flex-direction:row;flex-wrap:wrap}}
@media(max-width:640px){.pm-global-footer{padding:42px 0 36px}.pm-global-footer-top{grid-template-columns:1fr}.pm-global-footer-nav{grid-column:auto}.pm-global-bottom{flex-direction:column}.pm-global-org td{display:block;width:100%!important;padding:6px 0;border:0}.pm-global-org tr{display:block;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.18)}}
`;
  if(!document.getElementById("pm-global-shell-style")){
    const s=document.createElement("style");s.id="pm-global-shell-style";s.textContent=css;document.head.appendChild(s);
  }
  class PMHeader extends HTMLElement{
    connectedCallback(){
      const sec=[
        ["news",t.news,links.news],["communities",t.communities,links.communities],["ratings",t.ratings,links.ratings],["research",t.research,links.research],["atlas",t.atlas,links.atlas]
      ];
      const mobileMain=[[t.projects,projectUrl],[t.about,mainHome+"#team"],[t.contacts,mainHome+"#contacts"]];
      const mobileSub=sec.map(x=>[x[1],x[2]]);
      const available=(this.getAttribute("data-langs")||"uk,en,crh").split(",").map(x=>x.trim()).filter(Boolean);
      this.innerHTML=`<header class="pm-global-header"><div class="pm-global-main">
        <a class="pm-global-logo" href="${mainHome}" aria-label="ProMedia"><img src="https://news.promedia.report/img/promedia-wordmark.svg" alt="ProMedia"></a>
        <nav class="pm-global-primary"><a href="${projectUrl}">${t.projects}</a><a href="${mainHome}#team">${t.about}</a><a href="${mainHome}#contacts">${t.contacts}</a></nav>
        <div class="pm-global-langs">${available.includes("uk")?`<a class="${lang==="uk"?"active":""}" href="${samePath("uk")}">UA</a>`:""}${available.includes("en")?`<a class="${lang==="en"?"active":""}" href="${samePath("en")}">EN</a>`:""}${available.includes("crh")?`<a class="${lang==="crh"?"active":""}" href="${samePath("crh")}">QT</a>`:""}</div>
        <details class="pm-global-burger"><summary aria-label="Menu"><span></span></summary><div class="pm-global-mobile-panel"><div class="pm-global-mobile-main">${mobileMain.map(x=>`<a href="${x[1]}">${x[0]}</a>`).join("")}</div><div class="pm-global-mobile-sub">${mobileSub.map(x=>`<a href="${x[1]}">${x[0]}</a>`).join("")}</div></div></details>
      </div><nav class="pm-global-secondary">${sec.map(x=>`<a class="${current===x[0]?"active":""}" href="${x[2]}">${x[1]}</a>`).join("")}</nav></header>`;
    }
  }
  class PMFooter extends HTMLElement{
    connectedCallback(){
      this.innerHTML=`<footer class="pm-global-footer"><div class="pm-global-footer-inner">
      <div class="pm-global-footer-top">
        <div class="pm-global-footer-logo"><a href="${mainHome}"><img src="https://news.promedia.report/img/promedia-logo-footer.svg" alt="ProMedia"></a></div>
        <div><ul class="pm-global-footer-contact"><li><a href="tel:+380506959537">+38 (050) 695 95 37</a></li><li><a href="mailto:info@promedia.report">info@promedia.report</a></li></ul><div class="pm-global-socials">
          <a href="https://www.youtube.com/@prostirmedia" target="_blank" rel="noopener" aria-label="YouTube">${socialIcon("youtube")}</a>
          <a href="https://www.instagram.com/promediaua/" target="_blank" rel="noopener" aria-label="Instagram">${socialIcon("instagram")}</a>
          <a href="https://www.linkedin.com/company/promediaukraine" target="_blank" rel="noopener" aria-label="LinkedIn">${socialIcon("linkedin")}</a>
          <a href="https://www.facebook.com/promediaukraine" target="_blank" rel="noopener" aria-label="Facebook">${socialIcon("facebook")}</a>
        </div></div>
        <nav class="pm-global-footer-nav"><a href="${projectUrl}">${t.projects}</a><a href="${mainHome}#team">${t.about}</a><a href="${mainHome}#contacts">${t.contacts}</a></nav>
      </div>
      <div class="pm-global-org"><h3>${t.details}</h3><table>
        <tr><td>${t.official}</td><td>${t.officialValue}</td></tr>
        <tr><td>${t.reg}</td><td>45995408</td></tr>
        <tr><td>${t.address}</td><td>${t.addressValue}</td></tr>
        <tr><td>${t.chair}</td><td>${t.chairValue}</td></tr>
        <tr><td>E-mail</td><td><a href="mailto:info@promedia.report">info@promedia.report</a></td></tr>
      </table></div>
      <div class="pm-global-bottom"><div>© 2025–2026 ProMedia. ${t.rights}<div class="pm-global-powered">Created by <a href="https://fabrikastyle.com" target="_blank" rel="noopener"><img src="https://fabrikastyle.com/logo-fa.svg" alt="Fabrika Style"></a></div></div><div><a href="https://promedia.report/privacy-policy/">${t.privacy}</a></div></div>
      </div></footer>`;
    }
  }
  if(!customElements.get("promedia-global-header")) customElements.define("promedia-global-header",PMHeader);
  if(!customElements.get("promedia-global-footer")) customElements.define("promedia-global-footer",PMFooter);
})();