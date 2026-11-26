(function () {
  // Hero typewriter
  const words = JSON.parse(document.body.dataset.rotator || "[]");
  let wi = 0, ci = 0, deleting = false;

  function typewriter() {
    const el = document.getElementById("typewriter");
    if (!el || !words.length) return;

    const word = words[wi];
    ci += deleting ? -1 : 1;
    el.textContent = word.slice(0, ci);

    let delay = deleting ? 45 : 110;
    if (!deleting && ci === word.length) {
      deleting = true;
      delay = 1000;
    } else if (deleting && ci === 0) {
      deleting = false;
      wi = (wi + 1) % words.length;
      delay = 180;
    }
    setTimeout(typewriter, delay);
  }
  typewriter();

  // Header state
  function updateTopState() {
    document.body.classList.toggle("is-top", window.scrollY < 20);
  }
  updateTopState();
  addEventListener("scroll", updateTopState, { passive: true });

  // Accordion
  document.querySelectorAll("[data-acc]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = document.getElementById(btn.dataset.acc);
      if (!target) return;
      const open = target.classList.contains("show");

      document.querySelectorAll(".accordion-collapse").forEach((x) => x.classList.remove("show"));
      document.querySelectorAll(".accordion-button").forEach((x) => x.classList.add("collapsed"));

      if (!open) {
        target.classList.add("show");
        btn.classList.remove("collapsed");
      }
    });
  });

  // Team modals: use the existing #team-* links, including keyboard navigation.
  // Keep aria-hidden synchronized with CSS :target so that screen readers
  // can access a dialog opened via its anchor.
  function syncTeamModals() {
    const active = window.location.hash;
    let hasOpenModal = false;
    document.querySelectorAll(".pm-team-modal").forEach((modal) => {
      const open = active === "#" + modal.id;
      modal.classList.toggle("is-open", open);
      modal.setAttribute("aria-hidden", String(!open));
      if (open) {
        hasOpenModal = true;
        const close = modal.querySelector(".pm-team-close");
        if (close) close.focus({ preventScroll: true });
      }
    });
    document.body.classList.toggle("pm-modal-open", hasOpenModal);
  }

  window.addEventListener("hashchange", syncTeamModals);
  syncTeamModals();

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !document.querySelector(".pm-team-modal.is-open")) return;
    window.location.hash = "team";
  });

  // Projects API
  const grid = document.getElementById("projects-grid");
  if (grid) {
    const api = grid.dataset.api;
    const lang = grid.dataset.lang;
    const base = grid.dataset.base;

    function esc(s) {
      return String(s || "").replace(/[&<>"']/g, (m) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[m]));
    }

    // Fade the right edge while more pills are hidden behind it.
    const updateFade = () => {
      grid.classList.toggle("has-more", grid.scrollLeft + grid.clientWidth < grid.scrollWidth - 2);
    };
    grid.addEventListener("scroll", updateFade, { passive: true });
    window.addEventListener("resize", updateFade);
    updateFade();

    fetch(api)
      .then((r) => r.ok ? r.json() : Promise.reject(new Error("Projects API error")))
      .then((data) => {
        const records = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : (Array.isArray(data?.projects) ? data.projects : []));
        // Only projects that are running now; everything else lives behind "All projects".
        const statusOf = (p) => p.projectStatus || p.project_status || p.status || "";
        const items = records
          .filter((p) => p && typeof p.slug === "string" && p.slug.trim() && statusOf(p) === "active");
        if (!items.length) return;

        const home = grid.dataset.home || "https://projects.promedia.report/";
        const allLabel = grid.dataset.all || "";

        // Pills show short project names only; the full title stays on the project page.
        const SHORT_NAMES = [
          { test: /санта|santa/i, uk: "Таємний Санта", en: "Secret Santa", crh: "Gizli Santa", de: "Wichteln" },
          { test: /спільнот|communit/i, uk: "Карта медійних спільнот", en: "Media Communities Map", crh: "Media cemiyetleri haritası", de: "Karte der Medien-Communitys" },
          { test: /атлас|atlas/i, uk: "Атлас медіа", en: "Media Atlas", crh: "Mediya Atlası", de: "Medienatlas" },
          { test: /proof|фактчек|fact-?check/i, uk: "Proof", en: "Proof", crh: "Proof", de: "Proof" },
          { test: /automation lab/i, uk: "AI and Automation Lab 2.0", en: "AI and Automation Lab 2.0", crh: "AI and Automation Lab 2.0", de: "AI and Automation Lab 2.0" },
          { test: /журфак|journalism school|faculties of journalism/i, uk: "Рейтинг журфаків", en: "J-school ranking", crh: "Jurnalistika fakultetleri reytingi", de: "Journalistik-Ranking" }
        ];
        // Fixed order on the strip: Santa, Atlas, Communities map, J-school ranking, then the rest as they come.
        const ORDER = [/санта|santa/i, /атлас|atlas/i, /спільнот|communit/i, /журфак|journalism school|faculties of journalism/i];
        const orderOf = (p) => {
          const key = `${p.slug} ${p.title || ""} ${p.titleEn || p.title_en || ""}`;
          const i = ORDER.findIndex((re) => re.test(key));
          return i === -1 ? ORDER.length : i;
        };
        items.sort((a, b) => orderOf(a) - orderOf(b));
        grid.innerHTML = items.map((p) => {
          const fullTitle = lang === "en"
            ? (p.titleEn || p.title_en || p.title)
            : lang === "de"
            ? (p.titleDe || p.titleEn || p.title_en || p.title)
            : lang === "crh"
              ? (p.titleCrh || p.title_crh || p.title)
              : p.title;
          const short = SHORT_NAMES.find((n) => n.test.test(`${p.slug} ${p.title || ""} ${p.titleEn || p.title_en || ""}`));
          // Without a short name, just drop the obvious "of Ukraine" ending.
          const title = short
            ? (short[lang] || short.uk)
            : String(fullTitle || "").replace(/\s+(України|в Україні|of Ukraine|in Ukraine|Ukrainanıñ|Ukrainada)$/i, "");
          return `<a class="pm-project-pill" href="${base}${encodeURIComponent(p.slug)}" title="${esc(fullTitle)}">${esc(title)}</a>`;
        }).join("") + (allLabel ? `<a class="pm-project-pill pm-project-pill--all" href="${esc(home)}">${esc(allLabel)}&nbsp;&rarr;</a>` : "");
        updateFade();
      })
      .catch(() => {});

    // Featured news from the shared ProMedia news service. The service's
    // script owns loading, localization and the editor-selected three-item
    // selection; this page only provides its placement and labels.
    const projectsSection = grid.closest(".section-lastprojects");
    if (projectsSection && !document.querySelector(".pm-featured-news-grid")) {
      const labels = {
        uk: {
          eyebrow: "Новини",
          title: "Новини ProMedia",
          all: "Усі матеріали"
        },
        en: {
          eyebrow: "News",
          title: "ProMedia News",
          all: "All content"
        },
        crh: {
          eyebrow: "Haberler",
          title: "ProMedia haberleri",
          all: "Bütün materiallar"
        },
        de: {
          eyebrow: "Nachrichten",
          title: "ProMedia Nachrichten",
          all: "Alle Beiträge"
        }
      }[lang] || {};
      const section = document.createElement("section");
      section.className = "section section-featured-news";
      // No visible heading: the lead story starts right away, each item carries its own rubric.
      section.setAttribute("aria-label", labels.title || "");
      section.innerHTML = `
        <div class="container">
          <div class="pm-featured-news-grid" aria-live="polite"></div>
          <div class="d-flex flex-wrap justify-content-end align-items-end mt-4">
            <a class="btn btn-secondary pm-featured-news-all" href="https://news.promedia.report/">${labels.all} &rarr;</a>
          </div>
        </div>`;
      projectsSection.insertAdjacentElement("afterend", section);

      const script = document.createElement("script");
      script.src = "https://news.promedia.report/js/promedia-featured-news.js";
      script.defer = true;
      document.head.appendChild(script);
    }
  }
})();
