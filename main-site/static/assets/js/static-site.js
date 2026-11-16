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

    function projectTagLabel(tag, lang) {
      const map = {
        "навчання": { en: "training", crh: "talim" },
        "спільнота": { en: "community", crh: "cemaat" },
        "спільноти": { en: "communities", crh: "cemaatlar" },
        "дослідження": { en: "research", crh: "tedqiqat" },
        "консалтинг": { en: "consulting", crh: "mesleat" },
        "медіа": { en: "media", crh: "mediya" },
        "штучний інтелект": { en: "artificial intelligence", crh: "suniy zekâ" },
        "автоматизація": { en: "automation", crh: "avtomatlaştırma" },
        "фактчекінг": { en: "fact-checking", crh: "faktçeking" },
        "відео": { en: "video", crh: "video" },
        "модерація": { en: "moderation", crh: "moderatsiya" },
        "інструмент": { en: "tool", crh: "alet" },
        "інструменти": { en: "tools", crh: "aletler" },
        "журналістика": { en: "journalism", crh: "jurnalistika" },
        "медіаграмотність": { en: "media literacy", crh: "mediya savatlılığı" }
      };
      const value = String(tag || "").trim();
      if (lang === "uk") return value;
      const key = value.toLocaleLowerCase("uk-UA");
      return (map[key] && map[key][lang]) || value;
    }

    fetch(api)
      .then((r) => r.ok ? r.json() : Promise.reject(new Error("Projects API error")))
      .then((data) => {
        const records = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : (Array.isArray(data?.projects) ? data.projects : []));
        const items = records.filter((p) => p && typeof p.slug === "string" && p.slug.trim()).slice(0, 4);
        if (!items.length) return;

        grid.innerHTML = items.map((p) => {
          const title = lang === "en"
            ? (p.titleEn || p.title_en || p.title)
            : lang === "crh"
              ? (p.titleCrh || p.title_crh || p.title)
              : p.title;

          const excerpt = lang === "en"
            ? (p.excerptEn || p.excerpt_en || p.excerpt || "")
            : lang === "crh"
              ? (p.excerptCrh || p.excerpt_crh || p.excerpt || "")
              : (p.excerpt || "");

          const status = p.projectStatus || p.project_status || p.status || "";
          const label = status === "active"
            ? (lang === "uk" ? "Триває" : lang === "en" ? "Active" : "Devam ete")
            : status === "completed"
              ? (lang === "uk" ? "Завершено" : lang === "en" ? "Completed" : "Tamamlandı")
              : status === "upcoming"
                ? (lang === "uk" ? "Заплановано" : lang === "en" ? "Upcoming" : "Planlaştırılğan")
                : "";

          const badgeClass = status === "completed"
            ? "bg-secondary"
            : status === "upcoming" ? "bg-warning text-dark" : "bg-success";
          const rawImg = p.coverImageUrl || p.cover_image_url || "";
          let img = "";
          if (typeof rawImg === "string" && rawImg.trim()) {
            try {
              const url = new URL(rawImg, "https://projects.promedia.report");
              // Only render ordinary web images; one malformed API record
              // must not prevent the remaining project cards from loading.
              if (url.protocol === "https:" || url.protocol === "http:") img = url.toString();
            } catch (_) {}
          }
          let tags = [];
          if (Array.isArray(p.tags)) tags = p.tags;
          else {
            try { tags = JSON.parse(p.tags || "[]"); } catch (_) {}
          }

          return `<div class="col static-project-card">
            <a href="${base}${encodeURIComponent(p.slug)}" class="card h-100 text-decoration-none text-dark shadow-sm">
              <div class="position-relative">
                <div class="ratio ratio-16x9 bg-light rounded-top overflow-hidden">
                  ${img ? `<img loading="lazy" decoding="async" src="${esc(img)}" class="w-100 h-100" style="object-fit:cover" alt="${esc(title)}">` : ""}
                </div>
                ${label ? `<span class="badge position-absolute top-0 start-0 m-2 ${badgeClass}">${esc(label)}</span>` : ""}
              </div>
              <div class="card-body">
                <h3 class="h5 card-title">${esc(title)}</h3>
                <p class="card-text text-muted">${esc(excerpt)}</p>
                <div class="d-flex flex-wrap gap-2 mt-2">
                  ${tags.slice(0, 3).map((t) => `<span class="badge bg-light text-dark border">${esc(projectTagLabel(t, lang))}</span>`).join("")}
                </div>
              </div>
            </a>
          </div>`;
        }).join("");
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
      section.innerHTML = `
        <div class="container">
          <div class="row g-4 align-items-end mb-4">
            <div class="col-lg-6">
              <div class="eyebrow mb-3">${labels.eyebrow}</div>
              <h2 class="section-title">${labels.title}</h2>
            </div>
          </div>
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
