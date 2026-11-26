(function(){
  const HOSTS={
    projects:"projects.promedia.report",
    news:"news.promedia.report",
    communities:"communities.promedia.report",
    ratings:"ratings.promedia.report",
    research:"research.promedia.report",
    atlas:"atlas.promedia.report",
    santa:"santa.promedia.report",
    brief:"brief.promedia.report",
    people:"people.promedia.report",
    brands:"brands.promedia.report"
  };
  const L={
    uk:{language:"Мова",partners:"Партнери та донори",projects:"Проєкти",about:"Про нас",contacts:"Контакти",news:"Новини",communities:"Карта спільнот",ratings:"Рейтинг журфаків",research:"Дослідження",atlas:"Атлас медіа",santa:"Санта",proof:"Proof",brief:"Brief",people:"Люди",brands:"Медіабренди",details:"Дані про організацію",official:"Офіційна назва",officialValue:"ГО «ПроМедіа»",reg:"Реєстраційний номер",address:"Юридична адреса",addressValue:"вул. Володимира Самійленка 19/44, Київ, Україна, 03118",chair:"Голова правління",chairValue:"Андрій Яніцький",privacy:"Приватність і cookie",analyticsOn:"Вимкнути аналітику",analyticsOff:"Увімкнути аналітику",support:"Підтримати ПроМедіа",donationOffer:"Умови пожертви",rights:"Усі права захищені"},
    en:{language:"Language",partners:"Partners and donors",projects:"Projects",about:"About us",contacts:"Contacts",news:"News",communities:"Communities Map",ratings:"Journalism Schools",research:"Research",atlas:"Media Atlas",santa:"Santa",proof:"Proof",people:"People",brands:"Media brands",details:"Organization details",official:"Official name",officialValue:"NGO “ProMedia”",reg:"Registration number",address:"Legal address",addressValue:"19/44 Volodymyr Samiilenko St, Kyiv, Ukraine, 03118",chair:"Chair of the Board",chairValue:"Andrii Ianitskyi",privacy:"Privacy and cookies",analyticsOn:"Turn off analytics",analyticsOff:"Turn on analytics",support:"Support ProMedia",donationOffer:"Donation terms",rights:"All rights reserved"},
    crh:{language:"Til",partners:"Ortaqlar ve donorlar",projects:"Leyhalar",about:"Biz aqqımızda",contacts:"Kontaktlar",news:"Haberler",communities:"Cemaatlar haritası",ratings:"Jurnalistika fakülteleri reytingi",research:"Tedqiqatlar",atlas:"Mediya Atlası",santa:"Santa",proof:"Proof",people:"İnsanlar",brands:"Mediya brendleri",details:"Teşkilât aqqında malümat",official:"Resmiy adı",officialValue:"«ProMedia» İCT",reg:"Qayd nomeri",address:"Yuridik adres",addressValue:"Volodymyr Samiilenko soqağı, 19/44, Kyiv, Ukrayina, 03118",chair:"İdare Keñeşi reisi",chairValue:"Andrii Ianitskyi",privacy:"Mahremiyet ve cookie",analyticsOn:"Analitikanı söndürmek",analyticsOff:"Analitikanı qabuzmaq",support:"ProMediağa yardım et",donationOffer:"Bağış şartları",rights:"Er aqqı saqlıdır"},
    de:{language:"Sprache",partners:"Partner und Förderer",projects:"Projekte",about:"Über uns",contacts:"Kontakt",news:"Nachrichten",communities:"Community-Karte",ratings:"Journalistik-Ranking",research:"Forschung",atlas:"Medienatlas",santa:"Santa",proof:"Proof",people:"Personen",brands:"Medienmarken",details:"Angaben zur Organisation",official:"Offizieller Name",officialValue:"NGO „ProMedia“",reg:"Registernummer",address:"Rechtliche Anschrift",addressValue:"Volodymyr-Samiilenko-Str. 19/44, 03118 Kyjiw, Ukraine",chair:"Vorstandsvorsitzender",chairValue:"Andrii Ianitskyi",privacy:"Datenschutz und Cookies",analyticsOn:"Analyse deaktivieren",analyticsOff:"Analyse aktivieren",support:"ProMedia unterstützen",donationOffer:"Spendenbedingungen",rights:"Alle Rechte vorbehalten"}
  };
  const lang=(()=>{
    const p=location.pathname.split("/").filter(Boolean)[0];
    if(p==="en"||p==="crh"||p==="de") return p;
    const h=(document.documentElement.lang||"").toLowerCase();
    return h.startsWith("en")?"en":h.startsWith("crh")?"crh":h.startsWith("de")?"de":"uk";
  })();
  // Мови інтерфейсу мережі (власник, 26.11.2026): перемикач — один компактний список, щоб мов могло бути більше.
  // Німецька поки є лише в Новинах, Проєктах і «Про нас»; інші сайти німецькому читачеві відкриваються англійською.
  const LANG_NAMES=[["uk","UA","Українська"],["en","EN","English"],["crh","QT","Qırımtatarca"],["de","DE","Deutsch"]];
  const DE_HOSTS=["promedia.report","www.promedia.report","news.promedia.report","projects.promedia.report","about.promedia.report"];
  const langFor=(host)=>lang==="de"&&!DE_HOSTS.includes(host)?"en":lang;
  const t=L[lang];
  const analyticsOn=!/(?:^|;\s*)pm_analytics=denied(?:;|$)/.test(document.cookie);
  const prefixFor=(host)=>{const l=langFor(host);return l==="uk"?"":"/"+l};
  const prefix=prefixFor("promedia.report"); // головна promedia.report
  // Сторінки головного сайту (підтримка, умови пожертви, приватність) є всіма мовами, зокрема німецькою (з 26.11.2026).
  const pagesPrefix=prefix;
  const localize=(base)=>base+prefixFor(new URL(base).hostname)+"/";
  const mainBase="https://promedia.report";
  const mainHome=mainBase+(prefix||"")+"/";
  const aboutUrl=localize("https://about.promedia.report"); // «Про нас» — окремий сайт трьома мовами; команди на головній більше немає
  const projectUrl=localize("https://projects.promedia.report");
  const links={
    news:localize("https://news.promedia.report"),
    communities:localize("https://communities.promedia.report"),
    ratings:localize("https://ratings.promedia.report"),
    research:localize("https://research.promedia.report"),
    atlas:localize("https://atlas.promedia.report"),
    santa:"https://santa.promedia.report/",
    brief:"https://brief.promedia.report/",
    people:localize("https://people.promedia.report"),
    brands:localize("https://brands.promedia.report")
  };
  const current=Object.keys(HOSTS).find(k=>location.hostname===HOSTS[k])||"";
  const samePath=(targetLang)=>{
    const alt=document.querySelector('link[rel="alternate"][hreflang="'+targetLang+'"]');
    if(alt&&alt.href)return alt.href;
    if(location.hostname==="research.promedia.report"&&location.pathname.includes("/membership-guide/")){
      return targetLang==="uk"?"https://research.promedia.report/membership-guide/":"https://research.promedia.report/"+targetLang+"/";
    }
    const u=new URL(location.href);
    let path=u.pathname.replace(/^\/(en|crh|de)(?=\/|$)/,"")||"/";
    const p=targetLang==="uk"?"":"/"+targetLang;
    return u.origin+p+(path==="/" ? "/" : path)+u.search+u.hash;
  };
  const socialIcon=(name)=>({
    youtube:'<svg viewBox="0 0 24 24"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4L15.8 12l-6.2 3.6Z"/></svg>',
    instagram:'<svg viewBox="0 0 24 24"><path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7Zm10.5 1.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"/></svg>',
    linkedin:'<svg viewBox="0 0 24 24"><path d="M4.98 3.5A2.5 2.5 0 1 1 5 8.5a2.5 2.5 0 0 1-.02-5ZM3 10h4v11H3V10Zm6 0h3.8v1.5h.05c.53-1 1.83-2.05 3.77-2.05C20.65 9.45 21 12.1 21 15.55V21h-4v-4.83c0-1.15-.02-2.63-1.6-2.63-1.6 0-1.85 1.25-1.85 2.55V21H9V10Z"/></svg>',
    facebook:'<svg viewBox="0 0 24 24"><path d="M13.7 21v-8h2.8l.4-3.2h-3.2V7.7c0-.9.3-1.6 1.7-1.6h1.8V3.2c-.3 0-1.4-.2-2.6-.2-2.6 0-4.4 1.6-4.4 4.5v2.3H7.3V13h2.9v8h3.5Z"/></svg>'
  }[name]);
  // Соцмережі ПроМедіа (Telegram-каналу немає). Шапка на комп'ютері й низ меню-бургера (owner, 2026-11-23).
  const SOCIALS=[["facebook","Facebook","https://www.facebook.com/promediaukraine"],["instagram","Instagram","https://www.instagram.com/promediaua/"],["linkedin","LinkedIn","https://www.linkedin.com/company/promediaukraine"],["youtube","YouTube","https://www.youtube.com/@prostirmedia"]];
  const socialLinks=(cls)=>`<div class="${cls}">${SOCIALS.map(([k,n,h])=>`<a href="${h}" target="_blank" rel="noopener" aria-label="${n}" title="${n}">${socialIcon(k)}</a>`).join("")}</div>`;
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
.pm-global-lang{position:relative;flex:0 0 auto}
.pm-global-ext-lang{display:inline-block;margin-left:5px;padding:1px 4px;border:1px solid currentColor;border-radius:4px;font-size:9px;font-weight:700;line-height:1.2;letter-spacing:.04em;vertical-align:2px;opacity:.55}
.pm-global-lang>summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:4px;padding:5px 9px;border:1px solid rgba(13,12,92,.18);border-radius:999px;color:var(--pm-shell-ink);font-size:12px;font-weight:700;line-height:1;user-select:none}
.pm-global-lang>summary::-webkit-details-marker{display:none}
.pm-global-lang>summary:hover,.pm-global-lang[open]>summary{border-color:var(--pm-shell-ink)}
.pm-global-lang>summary svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.pm-global-lang>summary .pm-global-lang-chev{width:11px;height:11px;transition:transform .15s}
.pm-global-lang[open]>summary .pm-global-lang-chev{transform:rotate(180deg)}
.pm-global-lang-list{position:absolute;right:0;top:calc(100% + 8px);z-index:1000;min-width:196px;padding:4px 0;border:1px solid rgba(13,12,92,.12);border-radius:12px;background:#fff;box-shadow:0 14px 30px rgba(13,12,92,.16)}
.pm-global-lang-list a{display:flex;align-items:center;gap:10px;padding:9px 14px;color:var(--pm-shell-ink);font-size:14px;font-weight:600;text-decoration:none;white-space:nowrap}
.pm-global-lang-list a:hover{background:#fff8ec}
.pm-global-lang-list a span{width:24px;font-size:11px;font-weight:700;color:rgba(13,12,92,.55)}
.pm-global-lang-list a[aria-current="true"]{font-weight:800}
.pm-global-lang-list a[aria-current="true"]::after{content:"✓";margin-left:auto;color:#e8901a;font-weight:800}
.pm-global-head-socials{display:flex;gap:2px;align-items:center;padding-left:14px;border-left:1px solid rgba(13,12,92,.12)}
.pm-global-head-socials a{display:grid;place-items:center;width:28px;height:28px;color:rgba(13,12,92,.6)}
.pm-global-head-socials a:hover{color:#e8901a}.pm-global-head-socials svg{width:16px;height:16px;fill:currentColor}
.pm-global-mobile-socials{display:flex;gap:6px;padding:10px 14px;border-top:1px solid rgba(13,12,92,.08);background:#fff}
.pm-global-mobile-panel .pm-global-mobile-socials a{display:grid;place-items:center;width:36px;height:36px;padding:0;color:var(--pm-shell-ink)}
.pm-global-mobile-socials svg{width:19px;height:19px;fill:currentColor}
.pm-brief-bar{display:flex;align-items:center;gap:12px;min-height:38px;padding:5px clamp(18px,4vw,64px);background:var(--pm-shell-ink);color:#fff;font:500 13px/1.3 Montserrat,Arial,sans-serif;box-sizing:border-box}
.pm-brief-bar__play{flex:0 0 auto;display:grid;place-items:center;width:28px;height:28px;padding:0;border:0;border-radius:50%;background:var(--pm-shell-accent);color:var(--pm-shell-ink);font-size:11px;cursor:pointer}
.pm-brief-bar__play[hidden]{display:none}.pm-brief-bar__play:focus-visible{outline:2px solid #fff;outline-offset:2px}
.pm-brief-bar.is-playing .pm-brief-bar__play{background:#fff}
.pm-brief-bar__name{font-weight:800;letter-spacing:.06em}
.pm-brief-bar__text{color:#d9d8f2}
.pm-brief-bar__meta{color:#b9b8dd;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.pm-brief-bar a{margin-left:auto;color:var(--pm-shell-accent);text-decoration:none;font-weight:700;white-space:nowrap}
.pm-brief-bar a:hover{text-decoration:underline}
.pm-brief-bar__short{display:none}
@media(max-width:640px){.pm-brief-bar{gap:10px;padding:5px 18px}.pm-brief-bar__text,.pm-brief-bar__long{display:none}.pm-brief-bar__short{display:inline}}
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
.pm-global-footer-logo img{width:150px;height:auto;filter:none}
.pm-global-footer-contact{margin:0;padding:0;list-style:none}.pm-global-footer-contact li{margin:0 0 10px}
.pm-global-footer a{color:#fff;text-decoration:none}.pm-global-footer a:hover{color:var(--pm-shell-accent)}
.pm-global-footer-nav{display:flex;flex-direction:column;gap:9px}
.pm-global-partners{margin-top:34px;padding-top:26px;border-top:1px solid rgba(255,255,255,.18)}
.pm-global-partners h3{margin:0 0 14px;color:#9da6c7;font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase}
.pm-global-partners-grid{display:flex;flex-wrap:wrap;gap:10px}
.pm-global-partner{display:flex;align-items:center;justify-content:center;width:132px;height:64px;padding:8px 12px;box-sizing:border-box;border-radius:6px;background:#fff;overflow:hidden}
.pm-global-partner img{display:block;max-width:100%;max-height:46px;object-fit:contain}
.pm-global-footer a.pm-global-partner-text{color:#2e3038!important;font-size:13px;font-weight:700;line-height:1.15;text-align:center}
.pm-global-footer a.pm-global-partner:hover{opacity:.88;color:#2e3038!important}
.pm-global-socials{display:flex;gap:12px;margin-top:14px}.pm-global-socials a{display:flex;align-items:center;justify-content:center;width:38px;height:38px;border:1px solid rgba(255,255,255,.3);border-radius:50%}
.pm-global-socials svg{width:20px;height:20px;fill:currentColor}
.pm-global-org{margin:34px auto 0;max-width:900px}.pm-global-org h3{text-align:center;font-size:1rem;margin:0 0 14px}
.pm-global-org>summary{list-style:none;cursor:pointer}.pm-global-org>summary::-webkit-details-marker{display:none}
@media(min-width:641px){.pm-global-org>summary{pointer-events:none}}
@media(max-width:640px){.pm-global-org{margin-top:22px;border-top:1px solid rgba(255,255,255,.18);border-bottom:1px solid rgba(255,255,255,.18)}.pm-global-org>summary h3{display:flex;justify-content:space-between;align-items:center;text-align:left;margin:0;padding:14px 0}.pm-global-org>summary h3::after{content:"+";font-size:20px;font-weight:400;line-height:1}.pm-global-org[open]>summary h3::after{content:"−"}.pm-global-org[open] table{margin-bottom:10px}}
.pm-global-org table{width:100%;border-collapse:collapse}.pm-global-org td{padding:9px 10px;border-bottom:1px solid rgba(255,255,255,.18);vertical-align:top}.pm-global-org td:first-child{font-weight:700;color:#fff;width:36%}
.pm-global-bottom{display:flex;justify-content:space-between;gap:22px;margin-top:34px;padding-top:28px;border-top:1px solid rgba(255,255,255,.18);font-size:.9rem}.pm-global-powered{display:flex;align-items:center;gap:10px;margin-top:8px}.pm-global-powered img{width:88px;filter:brightness(0) invert(1);opacity:.9}.pm-global-analytics-toggle{font:inherit;color:inherit;background:none;border:0;padding:0;text-decoration:underline;cursor:pointer}
@media(max-width:980px){.pm-global-primary,.pm-global-secondary,.pm-global-head-socials{display:none}.pm-global-burger{display:block;margin-left:2px}.pm-global-lang{margin-left:auto}.pm-global-main{min-height:62px;padding:6px 18px}.pm-global-logo{width:100px;height:44px}.pm-global-footer-top{grid-template-columns:1fr 1fr}.pm-global-footer-nav{grid-column:1/-1;flex-direction:row;flex-wrap:wrap}}
@media(max-width:640px){.pm-global-partner{width:calc(33.333% - 7px);height:52px;padding:6px 8px}.pm-global-partner img{max-height:38px}.pm-global-footer a.pm-global-partner-text{font-size:11px}.pm-global-partners{margin-top:26px;padding-top:20px}.pm-global-org h3{font-size:15px}.pm-global-org td{font-size:13px}.pm-global-org td:first-child{padding-bottom:0!important;opacity:.7}.pm-global-org tr{padding:6px 0!important}.pm-global-footer{padding:42px 0 36px}.pm-global-footer-top{grid-template-columns:1fr}.pm-global-footer-nav{grid-column:auto}.pm-global-bottom{flex-direction:column}.pm-global-org td{display:block;width:100%!important;padding:6px 0;border:0}.pm-global-org tr{display:block;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.18)}}
`;
  if(!document.getElementById("pm-global-shell-style")){
    const s=document.createElement("style");s.id="pm-global-shell-style";s.textContent=css;document.head.appendChild(s);
  }
  class PMHeader extends HTMLElement{
    connectedCallback(){
      const sec=[
        ["news",t.news,links.news],["communities",t.communities,links.communities],["ratings",t.ratings,links.ratings],["research",t.research,links.research],["atlas",t.atlas,links.atlas],["santa",t.santa,links.santa],["brief",t.brief||"Brief",links.brief],["people",t.people,links.people],["brands",t.brands,links.brands]
      ].filter(([key]) => key !== "santa" || lang === "uk"); // Санта — лише українською; BRIEF — у другому меню (власник, 17.11.2026)
      const mobileMain=[[t.projects,projectUrl],[t.about,aboutUrl],[t.contacts,mainHome+"#contacts"]];
      // Німецька: розділи без німецької версії лишаються в меню, але з позначкою «EN» (власник, 26.11.2026).
      const extBadge=(url)=>{try{return lang==="de"&&!DE_HOSTS.includes(new URL(url).hostname)?'<span class="pm-global-ext-lang" title="English">EN</span>':""}catch(e){return ""}};
      const mobileSub=sec.map(x=>[x[1]+extBadge(x[2]),x[2]]);
      const available=(this.getAttribute("data-langs")||"uk,en,crh"+(DE_HOSTS.includes(location.hostname)?",de":"")).split(",").map(x=>x.trim()).filter(Boolean);
      const langs=LANG_NAMES.filter(([code])=>available.includes(code));
      const curLang=LANG_NAMES.find(([code])=>code===lang)||LANG_NAMES[0];
      const langMenu=langs.length>1?`<details class="pm-global-lang"><summary aria-label="${curLang[2]} — ${t.language}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3Z"/></svg>${curLang[1]}<svg class="pm-global-lang-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></summary><div class="pm-global-lang-list">${langs.map(([code,short,name])=>`<a href="${samePath(code)}" hreflang="${code}" lang="${code}"${code===lang?' aria-current="true"':""}><span>${short}</span>${name}</a>`).join("")}</div></details>`:"";
      this.innerHTML=`<header class="pm-global-header"><div class="pm-global-main">
        <a class="pm-global-logo" href="${mainHome}" aria-label="ProMedia"><img src="https://news.promedia.report/img/promedia-wordmark.svg" alt="ProMedia"></a>
        <nav class="pm-global-primary"><a href="${projectUrl}">${t.projects}</a><a href="${aboutUrl}">${t.about}</a><a href="${mainHome}#contacts">${t.contacts}</a></nav>
        ${langMenu}
        ${socialLinks("pm-global-head-socials")}
        <details class="pm-global-burger"><summary aria-label="Menu"><span></span></summary><div class="pm-global-mobile-panel"><div class="pm-global-mobile-main">${mobileMain.map(x=>`<a href="${x[1]}">${x[0]}</a>`).join("")}</div><div class="pm-global-mobile-sub">${mobileSub.map(x=>`<a href="${x[1]}">${x[0]}</a>`).join("")}</div>${socialLinks("pm-global-mobile-socials")}</div></details>
      </div><nav class="pm-global-secondary">${sec.map(x=>`<a class="${current===x[0]?"active":""}" href="${x[2]}"${extBadge(x[2])?' hreflang="en"':""}>${x[1]}${extBadge(x[2])}</a>`).join("")}</nav></header>`;
      // Narrow BRIEF bar under the header on every ProMedia site (owner, 2026-11-17).
      // Ukrainian only (BRIEF is Ukrainian); not on BRIEF itself, which has its own player.
      if(lang==="uk"&&location.hostname!=="brief.promedia.report"&&typeof this.after==="function"&&!document.querySelector(".pm-brief-bar")){
        const bar=document.createElement("aside");
        bar.className="pm-brief-bar";bar.setAttribute("aria-label","BRIEF — аудіовипуск новин");
        bar.innerHTML=`<button type="button" class="pm-brief-bar__play" aria-label="Слухати BRIEF" hidden>▶</button><span class="pm-brief-bar__name">BRIEF</span><span class="pm-brief-bar__text">Головні новини — послухати за 5 хвилин</span><span class="pm-brief-bar__meta"></span><a href="https://brief.promedia.report/"><span class="pm-brief-bar__long">Текст і джерела</span><span class="pm-brief-bar__short">Джерела</span> →</a>`;
        this.after(bar);
        briefBar(bar);
      }
    }
  }
  // The latest BRIEF edition plays right on the page; without it the bar stays a plain link.
  function briefBar(bar){
    const BRIEF="https://brief.promedia.report/";
    const btn=bar.querySelector(".pm-brief-bar__play"),meta=bar.querySelector(".pm-brief-bar__meta");
    const fmt=s=>{s=Math.max(0,Math.round(s||0));return Math.floor(s/60)+":"+String(s%60).padStart(2,"0")};
    fetch(BRIEF+"demo/index.json",{cache:"no-store"}).then(r=>r.json())
      .then(idx=>fetch(BRIEF+idx.demos[0].file,{cache:"no-store"})).then(r=>r.json())
      .then(d=>{
        if(!d||!d.audio) return;
        const p=String(d.date||"").split("-"),day=p.length===3?p[2]+"."+p[1]:"";
        const label=document.createElement("span");label.className="pm-brief-bar__long";label.textContent="Випуск за ";
        const rest=document.createTextNode("");meta.append(label,rest);
        const audio=new Audio(BRIEF+d.audio);audio.preload="none";
        const show=()=>{rest.nodeValue=day+" · "+(audio.currentTime>0?fmt(audio.currentTime)+" / ":"")+fmt(audio.duration||d.duration_sec)};
        const state=()=>{const on=!audio.paused;btn.textContent=on?"❚❚":"▶";btn.setAttribute("aria-label",on?"Пауза":"Слухати BRIEF");bar.classList.toggle("is-playing",on);show()};
        // Listening statistics (owner, 2026-11-17): started, half, to the end — once per page view,
        // in the network's Google Analytics; nothing is sent after "Вимкнути аналітику".
        const sent={};
        const track=(name,percent)=>{
          if(sent[name])return;sent[name]=1;
          if(/(?:^|;\s*)pm_analytics=denied/.test(document.cookie||""))return;
          const params={brief_edition:String(d.date||""),brief_place:"network_bar",brief_site:location.hostname,percent};
          if(window.ProMediaAnalytics&&typeof window.ProMediaAnalytics.track==="function")window.ProMediaAnalytics.track(name,params);
          else if(typeof window.gtag==="function")window.gtag("event",name,params);
        };
        const listen=()=>{const t=audio.duration||d.duration_sec;if(!sent.brief_play||!t)return;const f=audio.currentTime/t;if(f>=.5)track("brief_progress",50);if(f>=.95)track("brief_complete",100)};
        // Keeps playing across pages (owner, 2026-11-18): the bar remembers the edition, the second and
        // whether it was playing in a cookie for all *.promedia.report sites and picks up on the next page.
        // If the browser blocks sound without a tap (iPhone), the bar waits at the same second.
        const resumed=resumeState(d.date);
        if(resumed){audio.preload="auto";audio.currentTime=resumed.t;sent.brief_play=1} // the start was already counted
        let saved=0,leaving=false; // the browser pauses the sound while leaving — that pause is not the listener's
        const save=force=>{const now=Date.now();if(leaving||(!force&&now-saved<2000))return;saved=now;
          if(audio.ended||!audio.currentTime){saveState("");return}
          saveState([d.date,Math.floor(audio.currentTime),audio.paused?0:1,now].join("|"))};
        audio.addEventListener("play",()=>track("brief_play",0));
        audio.addEventListener("timeupdate",listen);
        ["play","pause","timeupdate"].forEach(e=>audio.addEventListener(e,state));
        audio.addEventListener("timeupdate",()=>save(false));
        audio.addEventListener("pause",()=>save(true));
        addEventListener("pagehide",()=>{save(true);leaving=true});
        addEventListener("pageshow",e=>{if(e.persisted)leaving=false});
        audio.addEventListener("ended",()=>{if(sent.brief_play)track("brief_complete",100);audio.currentTime=0;saveState("");state()});
        btn.addEventListener("click",()=>audio.paused?audio.play():audio.pause());
        show();btn.hidden=false;
        if(resumed){
          audio.addEventListener("loadedmetadata",()=>{if(audio.currentTime<resumed.t-1)audio.currentTime=resumed.t},{once:true});
          if(resumed.playing){const p=audio.play();if(p&&p.catch)p.catch(()=>state())}
        }
      }).catch(()=>{});
  }
  // Where the BRIEF bar stopped: "date|second|playing|time" in a cookie shared by *.promedia.report.
  const BRIEF_STATE="pm_brief_bar";
  function saveState(value){
    const domain=/(^|\.)promedia\.report$/.test(location.hostname)?";domain=.promedia.report":"";
    document.cookie=BRIEF_STATE+"="+encodeURIComponent(value)+";path=/;SameSite=Lax"+(location.protocol==="https:"?";Secure":"")+domain+";max-age="+(value?6*3600:0);
  }
  function resumeState(date){
    const m=(document.cookie||"").match(/(?:^|;\s*)pm_brief_bar=([^;]*)/);
    if(!m)return null;
    const [d,t,playing,at]=decodeURIComponent(m[1]).split("|");
    if(d!==String(date)||!(+t>0))return null; // a new edition starts from the beginning
    // Keep playing only right after a page change; after a long break just wait at the same second.
    return {t:+t,playing:playing==="1"&&Date.now()-(+at)<2*60*1000};
  }
  // Партнери й донори — показуються в спільному підвалі всіх сайтів мережі.
  const PARTNERS=[
    {name:"Institute for War & Peace Reporting",href:"https://iwpr.net/",img:"iwpr.png"},
    {name:"Regional Press Development Institute",href:"https://irrp.org.ua/about-rpdi-eng/",img:"rpdi.png"},
    {name:"Recovery Window",href:"https://recovery.win/"},
    {name:"National Union of Journalists of Ukraine",href:"https://nsju.org/",img:"nuju.png"},
    {name:"Lviv Media Forum",href:"https://lvivmediaforum.com/",img:"lmf.png"},
    {name:"Georgiy Gongadze Prize",href:"https://gongadzeprize.com.ua/",img:"gongadze.png"}
  ];
  class PMFooter extends HTMLElement{
    connectedCallback(){
      // На телефоні дані про організацію згорнуті, на більших екранах — відкриті.
      const orgOpen=!(window.matchMedia&&window.matchMedia("(max-width:640px)").matches);
      this.innerHTML=`<footer class="pm-global-footer"><div class="pm-global-footer-inner">
      <div class="pm-global-footer-top">
        <div class="pm-global-footer-logo"><a href="${mainHome}"><img src="https://news.promedia.report/img/promedia-logo-footer.svg" alt="ProMedia"></a></div>
        <div id="contacts"><ul class="pm-global-footer-contact"><li><a href="tel:+380506959537">+38 (050) 695 95 37</a></li><li><a href="mailto:info@promedia.report">info@promedia.report</a></li></ul><div class="pm-global-socials">
          <a href="https://www.youtube.com/@prostirmedia" target="_blank" rel="noopener" aria-label="YouTube">${socialIcon("youtube")}</a>
          <a href="https://www.instagram.com/promediaua/" target="_blank" rel="noopener" aria-label="Instagram">${socialIcon("instagram")}</a>
          <a href="https://www.linkedin.com/company/promediaukraine" target="_blank" rel="noopener" aria-label="LinkedIn">${socialIcon("linkedin")}</a>
          <a href="https://www.facebook.com/promediaukraine" target="_blank" rel="noopener" aria-label="Facebook">${socialIcon("facebook")}</a>
        </div></div>
        <nav class="pm-global-footer-nav"><a href="${projectUrl}">${t.projects}</a><a href="${aboutUrl}">${t.about}</a><a href="${mainHome}#contacts">${t.contacts}</a><a href="${mainBase}${pagesPrefix}/support/">${t.support}</a><a href="${mainBase}${pagesPrefix}/donation-offer/">${t.donationOffer}</a></nav>
      </div>
      <div class="pm-global-partners"><h3>${t.partners}</h3><div class="pm-global-partners-grid">${PARTNERS.map(p=>`<a class="pm-global-partner${p.img?"":" pm-global-partner-text"}" href="${p.href}" target="_blank" rel="noopener">${p.img?`<img loading="lazy" decoding="async" src="https://promedia.report/assets/partners/${p.img}" alt="${p.name}">`:p.name}</a>`).join("")}</div></div>
      <details class="pm-global-org"${orgOpen?" open":""}><summary><h3>${t.details}</h3></summary><table>
        <tr><td>${t.official}</td><td>${t.officialValue}</td></tr>
        <tr><td>${t.reg}</td><td>45995408</td></tr>
        <tr><td>${t.address}</td><td>${t.addressValue}</td></tr>
        <tr><td>${t.chair}</td><td>${t.chairValue}</td></tr>
        <tr><td>E-mail</td><td><a href="mailto:info@promedia.report">info@promedia.report</a></td></tr>
      </table></details>
      <div class="pm-global-bottom"><div>© 2025–2026 ProMedia. ${t.rights}<div class="pm-global-powered">Created by <a href="https://fabrikastyle.com" target="_blank" rel="noopener"><img src="https://fabrikastyle.com/logo-fa.svg" alt="Fabrika Style"></a></div></div><div><a href="${mainBase+(lang==="uk"?"/privacy-policy/":pagesPrefix+"/privacy-policy/")}">${t.privacy}</a> · <button type="button" class="pm-global-analytics-toggle" data-pm-analytics-toggle data-label-on="${t.analyticsOn}" data-label-off="${t.analyticsOff}" aria-pressed="${analyticsOn}">${analyticsOn?t.analyticsOn:t.analyticsOff}</button></div></div>
      </div></footer>`;
    }
  }
  // Списки мов і меню закриваються кліком поза ними або клавішею Esc.
  if(typeof document.addEventListener==="function"){
    document.addEventListener("click",e=>{document.querySelectorAll(".pm-global-lang[open],.pm-global-burger[open]").forEach(d=>{if(!d.contains(e.target))d.removeAttribute("open")})});
    document.addEventListener("keydown",e=>{if(e.key==="Escape")document.querySelectorAll(".pm-global-lang[open]").forEach(d=>d.removeAttribute("open"))});
  }
  if(!customElements.get("promedia-global-header")) customElements.define("promedia-global-header",PMHeader);
  if(!customElements.get("promedia-global-footer")) customElements.define("promedia-global-footer",PMFooter);
  // These applications keep their own product navigation below the common header.
  const standaloneHosts=["events.promedia.report","money.promedia.report","jobs.promedia.report","brief.promedia.report"];
  if(standaloneHosts.includes(location.hostname)&&!document.querySelector("promedia-global-header")){
    const font=document.createElement("link");font.rel="stylesheet";
    font.href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap";
    document.head.appendChild(font);
    const header=document.createElement("promedia-global-header");
    // Events switches its interface language through its own cookie-based control.
    header.setAttribute("data-langs",location.hostname==="events.promedia.report"?"none":"uk");
    document.body.prepend(header);
  }

  // The static homepage shares this deployed shell. Show its existing localized
  // biographies inline while preserving the archived homepage source.
  function showHomepageTeam() {
    if (!["promedia.report", "www.promedia.report"].includes(location.hostname)) return;
    const section = document.querySelector(".section-team#team");
    if (!section || section.dataset.inlineBios === "true") return;
    const cards = Array.from(section.querySelectorAll(".pm-team-card"));
    if (cards.length !== 4) return;
    const people = cards.map(card => {
      const link = card.querySelector(".pm-team-open");
      const modal = link && document.getElementById(link.getAttribute("href").slice(1));
      const description = modal && modal.querySelector(".pm-team-modal-description");
      const position = card.querySelector(".pm-team-position");
      const photo = card.querySelector(".pm-team-photo");
      return { card, modal, description, position, photo };
    });
    if (people.some(person => !person.modal || !person.description || !person.position || !person.photo)) return;

    people.forEach(({ card, modal, description, position, photo }) => {
      const bio = description.cloneNode(true);
      bio.className = "pm-team-bio";
      position.after(bio);
      // Phones: first sentence only, the rest opens with «Далі» (owner, 2026-11-17).
      const parts = bio.children.length ? null : bio.textContent.trim().match(/^(.+?[.!?»])\s+(\S[\s\S]*)$/);
      if (parts) {
        bio.textContent = parts[1] + " ";
        const rest = document.createElement("span");
        rest.className = "pm-team-bio-more";
        rest.id = modal.id + "-more";
        rest.textContent = parts[2];
        const more = document.createElement("button");
        more.type = "button";
        more.className = "pm-team-bio-toggle";
        more.setAttribute("aria-expanded", "false");
        more.setAttribute("aria-controls", rest.id);
        more.textContent = lang === "en" ? "More" : lang === "crh" ? "Devamı" : lang === "de" ? "Mehr" : "Далі";
        more.addEventListener("click", () => {
          card.classList.add("pm-team-card-open");
          more.setAttribute("aria-expanded", "true");
        });
        bio.append(rest, more);
      }
      const portrait = document.createElement("div");
      portrait.className = "pm-team-photo";
      while (photo.firstChild) portrait.appendChild(photo.firstChild);
      photo.replaceWith(portrait);
      card.querySelectorAll(".pm-team-name.pm-team-open").forEach(link => {
        link.replaceWith(document.createTextNode(link.textContent));
      });
      card.classList.remove("pm-team-card-right");
      card.id = modal.id;
    });
    section.querySelectorAll(":scope > .container > p").forEach(paragraph => {
      if (paragraph.textContent.includes("2019") && paragraph.textContent.includes("ProMedia Report")) paragraph.remove();
    });
    people.forEach(({ modal }) => modal.remove());
    document.body.classList.remove("pm-modal-open");
    const style = document.getElementById("pm-team-exact");
    if (style) style.textContent = "\n.pm-team-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px;margin-top:32px}\n.pm-team-card{display:grid;grid-template-columns:38% minmax(0,1fr);align-items:start;background:#fff;scroll-margin-top:120px}\n.pm-team-photo{display:block;overflow:hidden}\n.pm-team-photo img{display:block;width:100%;height:auto;object-fit:contain;object-position:center top;aspect-ratio:1/1}\n.pm-team-copy{padding:24px 18px}\n.pm-team-copy h4{margin:0 0 8px;color:#2d2d2d;font-size:1.25rem;font-weight:700}\n.pm-team-position{margin:0 0 14px;color:#555;font-size:1rem}\n.pm-team-bio{margin:0 0 20px;font-size:.92rem;line-height:1.65;overflow-wrap:anywhere}\n.pm-team-social{display:flex;gap:14px;margin:0;padding:0;list-style:none}\n.pm-team-social li{margin:0!important}\n.pm-team-social a{display:flex;align-items:center;justify-content:center;width:28px;height:28px;color:#0d0c5c;text-decoration:none}\n.pm-team-social a:hover{color:#ffac33}\n.pm-team-social svg{width:26px;height:26px;fill:currentColor}\n@media(max-width:991px){.pm-team-grid{grid-template-columns:1fr}}\n.pm-team-bio-toggle{display:none}\n@media(max-width:767px){\n .pm-team-card:not(.pm-team-card-open) .pm-team-bio-more{display:none}\n .pm-team-card:not(.pm-team-card-open) .pm-team-bio-toggle{display:inline;padding:0;border:0;background:none;color:#0d0c5c;font:inherit;font-weight:700;text-decoration:underline;text-underline-offset:3px;cursor:pointer}\n}\n@media(max-width:575px){\n .pm-team-card{grid-template-columns:1fr}\n .pm-team-photo{width:min(100%,320px);justify-self:center}\n .pm-team-copy{padding:20px 18px 28px}\n}\n";
    section.dataset.inlineBios = "true";
  }
  showHomepageTeam();

  function refineHomepage() {
    if (!["promedia.report", "www.promedia.report"].includes(location.hostname) || !document.body.classList.contains("homepage") || document.body.dataset.pmHomeRefined) return;
    document.body.dataset.pmHomeRefined = "true";
    const style = document.createElement("style");
    style.id = "pm-home-refinements";
    style.textContent = `
body.homepage .section-lastprojects .eyebrow,
body.homepage .section-featured-news .eyebrow,
body.homepage #services .eyebrow{display:none!important}
@media(max-width:767px){
 body.homepage #projects-grid .card-text,
 body.homepage #projects-grid .badge,
 body.homepage #projects-grid .card-body>.d-flex{display:none!important}
 body.homepage #projects-grid .card-body{padding:12px}
 body.homepage #projects-grid .card-title{margin-bottom:0!important}
}
`;
    document.head.appendChild(style);
    const newsHeading = document.querySelector(".section-featured-news h2");
    if (newsHeading) newsHeading.textContent = t.news;
    const contactHeading = document.querySelector("#contacts .cf-title");
    if (contactHeading) {
      const highlight = contactHeading.querySelector("span");
      if (lang === "crh") {
        const word = document.createElement("span");
        word.textContent = "Fikirleriñizni";
        contactHeading.replaceChildren(word, document.createTextNode(" muzakere eteyik"));
      } else if (highlight) highlight.textContent = lang === "en" ? "ideas" : lang === "de" ? "Ideen" : "ідеї";
    }
    const services = document.getElementById("services");
    if (services) {
      services.querySelectorAll(".accordion-collapse").forEach(panel => panel.classList.remove("show"));
      const syncAccordion = () => services.querySelectorAll("button[data-acc]").forEach(button => {
        const panel = document.getElementById(button.dataset.acc);
        const expanded = !!panel && panel.classList.contains("show");
        button.classList.toggle("collapsed", !expanded);
        button.setAttribute("aria-expanded", String(expanded));
        if (panel) button.setAttribute("aria-controls", panel.id);
      });
      syncAccordion();
      services.addEventListener("click", () => requestAnimationFrame(syncAccordion));
    }

    // Async project/news cards and team portraits can move an anchor after a click.
    // Keep the chosen section aligned until the upper-page layout settles, or the
    // visitor starts scrolling. This also handles arriving directly at #team.
    let stopAlignment = () => {};
    function alignAnchor(hash) {
      const target = document.getElementById(hash.slice(1));
      if (!target) return;
      stopAlignment();
      const abort = new AbortController();
      let active = true, frame = 0;
      const align = () => {
        frame = 0;
        if (!active || !target.isConnected) return;
        const header = document.querySelector(".pm-global-header");
        const offset = (header ? header.getBoundingClientRect().height : 0) + 16;
        const top = Math.max(0, window.scrollY + target.getBoundingClientRect().top - offset);
        const previous = document.documentElement.style.scrollBehavior;
        document.documentElement.style.scrollBehavior = "auto";
        window.scrollTo({ top, behavior: "instant" });
        document.documentElement.style.scrollBehavior = previous;
      };
      const schedule = () => { if (active && !frame) frame = requestAnimationFrame(align); };
      const observer = typeof ResizeObserver === "function" ? new ResizeObserver(schedule) : null;
      document.querySelectorAll(".hero-rotator,.section-lastprojects,.section-featured-news,.section-team").forEach(section => observer && observer.observe(section));
      const timer = setTimeout(() => stopAlignment(), 5000);
      stopAlignment = () => {
        active = false;
        if (frame) cancelAnimationFrame(frame);
        if (observer) observer.disconnect();
        abort.abort();
        clearTimeout(timer);
      };
      window.addEventListener("wheel", stopAlignment, { once: true, passive: true, signal: abort.signal });
      window.addEventListener("touchstart", stopAlignment, { once: true, passive: true, signal: abort.signal });
      window.addEventListener("keydown", stopAlignment, { once: true, signal: abort.signal });
      document.addEventListener("load", schedule, { capture: true, signal: abort.signal });
      if (document.fonts) document.fonts.ready.then(schedule);
      schedule();
    }
    document.addEventListener("click", event => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target.closest && event.target.closest("a[href]");
      if (!link || link.target && link.target !== "_self") return;
      const url = new URL(link.href, location.href);
      if (!["promedia.report", "www.promedia.report"].includes(url.hostname) || url.pathname.replace(/\/$/, "") !== location.pathname.replace(/\/$/, "") || !["#team", "#contacts"].includes(url.hash)) return;
      event.preventDefault();
      event.stopPropagation();
      const menu = link.closest("details.pm-global-burger");
      if (menu) menu.removeAttribute("open");
      if (location.hash !== url.hash) history.pushState(null, "", location.pathname + location.search + url.hash);
      alignAnchor(url.hash);
    }, true);
    window.addEventListener("hashchange", () => {
      if (["#team", "#contacts"].includes(location.hash)) alignAnchor(location.hash);
      else stopAlignment();
    });
    if (["#team", "#contacts"].includes(location.hash)) alignAnchor(location.hash);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", refineHomepage, { once: true });
  else refineHomepage();


  // One low-page cross-promotion slot on public services; news has its own slots.
  const promoHosts = ["promedia.report", "www.promedia.report", "projects.promedia.report", "communities.promedia.report", "ratings.promedia.report", "research.promedia.report", "guide.promedia.report", "atlas.promedia.report", "jobs.promedia.report", "events.promedia.report", "brief.promedia.report", "santa.promedia.report", "people.promedia.report", "brands.promedia.report"];
  // Newsletter signup (owner, 2026-11-20): header link (desktop), footer link, story-end block
  // and homepage strip. The script itself stays silent until the Events list goes live.
  if (/(^|\.)promedia\.report$/.test(location.hostname) && !document.getElementById("pm-newsletter-loader")) {
    const nl = document.createElement("script");
    nl.id = "pm-newsletter-loader";
    nl.src = "https://news.promedia.report/js/promedia-newsletter.js?v=20261120a";
    nl.defer = true;
    document.head.appendChild(nl);
  }

  if (promoHosts.includes(location.hostname) && !document.getElementById("pm-network-promo-loader")) {
    const promo = document.createElement("script");
    promo.id = "pm-network-promo-loader";
    promo.src = "https://news.promedia.report/js/promedia-network-promo.js";
    promo.defer = true;
    document.head.appendChild(promo);
  }

})();
