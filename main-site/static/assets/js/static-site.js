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
        // Active projects first, then upcoming, then completed; at most eight pills.
        const rank = { active: 0, upcoming: 1, completed: 2 };
        const statusOf = (p) => p.projectStatus || p.project_status || p.status || "";
        const items = records
          .filter((p) => p && typeof p.slug === "string" && p.slug.trim())
          .map((p, i) => ({ p, i }))
          .sort((x, y) => ((rank[statusOf(x.p)] ?? 1) - (rank[statusOf(y.p)] ?? 1)) || (x.i - y.i))
          .map((x) => x.p)
          .slice(0, 8);
        if (!items.length) return;

        const statusLabels = {
          active: { uk: "Триває", en: "Active", crh: "Devam ete" },
          upcoming: { uk: "Заплановано", en: "Upcoming", crh: "Planlaştırılğan" },
          completed: { uk: "Завершено", en: "Completed", crh: "Tamamlandı" }
        };
        const home = grid.dataset.home || "https://projects.promedia.report/";
        const allLabel = grid.dataset.all || "";

        grid.innerHTML = items.map((p) => {
          const title = lang === "en"
            ? (p.titleEn || p.title_en || p.title)
            : lang === "crh"
              ? (p.titleCrh || p.title_crh || p.title)
              : p.title;
          const status = statusOf(p);
          const label = statusLabels[status] ? statusLabels[status][lang] || statusLabels[status].uk : "";
          return `<a class="pm-project-pill" href="${base}${encodeURIComponent(p.slug)}">`
            + `<span class="pm-project-dot pm-project-dot--${esc(status || "none")}" aria-hidden="true"></span>${esc(title)}`
            + (label ? `<span class="visually-hidden"> — ${esc(label)}</span>` : "")
            + `</a>`;
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
          all: "Усі новини"
        },
        en: {
          eyebrow: "News",
          title: "ProMedia News",
          all: "All news"
        },
        crh: {
          eyebrow: "Haberler",
          title: "ProMedia haberleri",
          all: "Bütün haberler"
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
