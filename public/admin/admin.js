(function () {
  "use strict";

  var root = document.getElementById("admin-root");
  var userRow = document.getElementById("admin-user-row");
  var state = {
    user: null,
    articles: [],
    users: [],
    mediaCatalog: null,
    richEditors: [],
    pushSummary: null,
    subdomains: [],
    subdomainsConfigured: false,
    subdomainEditor: null
  };

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function api(path, options) {
    options = options || {};
    var headers = options.headers || {};
    if (options.body && !(options.body instanceof ArrayBuffer) && !(options.body instanceof Blob)) {
      headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(options.body);
    }
    return fetch(path, Object.assign({ credentials: "include", headers: headers }, options))
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          if (!res.ok) throw new Error(data.error || ("HTTP " + res.status));
          return data;
        });
      });
  }

  function navigate(hash) {
    window.location.hash = hash;
  }

  // ---------- Layout helpers ----------

  function renderUserRow() {
    if (!state.user) { userRow.innerHTML = ""; return; }
    userRow.innerHTML =
      '<span class="admin-hint">' + escapeHtml(state.user.name) + " (" + escapeHtml(state.user.role) + ")</span>" +
      '<button class="admin-btn secondary" id="logout-btn" type="button">Вийти</button>';
    document.getElementById("logout-btn").addEventListener("click", function () {
      api("/api/auth/logout", { method: "POST" }).then(function () {
        state.user = null;
        navigate("#/login");
        boot();
      });
    });
  }

  // ---------- Login ----------

  function renderLogin(errorMsg) {
    root.innerHTML =
      '<div class="admin-card" style="max-width:420px;margin:60px auto">' +
      "<h1 style=\"font-family:var(--serif);color:var(--ink);margin-top:0\">Вхід</h1>" +
      (errorMsg ? '<p class="admin-error">' + escapeHtml(errorMsg) + "</p>" : "") +
      '<form class="admin-form" id="login-form">' +
      '<div class="admin-field"><label>Email</label><input type="email" name="email" required autofocus /></div>' +
      '<div class="admin-field"><label>Пароль</label><input type="password" name="password" required /></div>' +
      '<button class="admin-btn" type="submit">Увійти</button>' +
      "</form></div>";
    document.getElementById("login-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var form = e.target;
      api("/api/auth/login", {
        method: "POST",
        body: { email: form.email.value, password: form.password.value }
      }).then(function (data) {
        state.user = data.user;
        renderUserRow();
        navigate("#/dashboard");
        boot();
      }).catch(function (err) {
        renderLogin(err.message);
      });
    });
  }

  // ---------- Dashboard ----------

  function statusBadge(status) {
    var label = status === "published" ? "опубліковано" : "чернетка";
    return '<span class="admin-status ' + status + '">' + label + "</span>";
  }

  function loadArticles() {
    return api("/api/admin/articles").then(function (data) {
      state.articles = data.items;
    });
  }

  function renderDashboard() {
    var tabsHtml =
      '<div class="admin-row" style="margin-bottom:18px">' +
      '<button class="admin-btn" id="new-article-btn" type="button">+ Нова стаття</button>' +
      (state.user.role === "admin" ? '<button class="admin-btn secondary" id="push-btn" type="button">Пуш-сповіщення</button>' : "") +
      (state.user.role === "admin" ? '<button class="admin-btn secondary" id="subdomains-btn" type="button">Дослідження</button>' : "") +
      (state.user.role === "admin" ? '<button class="admin-btn secondary" id="users-btn" type="button">Користувачі</button>' : "") +
      "</div>";

    var rows = state.articles.map(function (a) {
      return "<tr>" +
        "<td>" + (a.isImportant ? '<span title="Важлива новина" aria-label="Важлива новина">★ </span>' : "") + escapeHtml(a.title) + "</td>" +
        "<td>" + statusBadge(a.status) + "</td>" +
        "<td>" + escapeHtml(new Date(a.updatedAt).toLocaleDateString("uk-UA")) + "</td>" +
        '<td><a href="#/edit/' + a.id + '">Редагувати</a></td>' +
        "</tr>";
    }).join("");

    var tableHtml = state.articles.length
      ? '<table class="admin-table"><thead><tr><th>Заголовок</th><th>Статус</th><th>Оновлено</th><th></th></tr></thead><tbody>' + rows + "</tbody></table>"
      : '<p class="empty-state">Статей ще немає.</p>';

    root.innerHTML = tabsHtml + '<div class="admin-card">' + tableHtml + "</div>";
    document.getElementById("new-article-btn").addEventListener("click", function () { navigate("#/new"); });
    var pushBtn = document.getElementById("push-btn");
    if (pushBtn) pushBtn.addEventListener("click", function () { navigate("#/push"); });
    var subdomainsBtn = document.getElementById("subdomains-btn");
    if (subdomainsBtn) subdomainsBtn.addEventListener("click", function () { navigate("#/subdomains"); });
    var usersBtn = document.getElementById("users-btn");
    if (usersBtn) usersBtn.addEventListener("click", function () { navigate("#/users"); });
  }

  // ---------- Push notifications ----------

  function loadPushSummary() {
    return api("/api/admin/push/summary").then(function (data) {
      state.pushSummary = data;
      return data;
    });
  }

  function renderPushPanel() {
    var summary = state.pushSummary || { enabled: false, counts: { active: 0, uk: 0, en: 0 }, recent: [] };
    var rows = (summary.recent || []).map(function (item) {
      var title = item.title_uk + (item.title_en ? " / " + item.title_en : "");
      return "<tr>" +
        "<td>" + escapeHtml(title) + "</td>" +
        "<td>" + escapeHtml(item.target_lang || "all") + "</td>" +
        "<td>" + escapeHtml(new Date(item.sent_at).toLocaleString("uk-UA")) + "</td>" +
        "<td>" + escapeHtml(item.delivered || 0) + " / " + escapeHtml(item.attempted || 0) + "</td>" +
        "<td>" + escapeHtml(item.failed || 0) + "</td>" +
        "</tr>";
    }).join("");

    root.innerHTML =
      '<p><a href="#/dashboard">← До списку статей</a></p>' +
      '<div class="admin-card">' +
      '<h1 style="font-family:var(--serif);color:var(--ink);margin-top:0">Пуш-сповіщення</h1>' +
      (!summary.enabled ? '<p class="admin-error">Web Push ще не активовано на сервері: потрібно задати секрет VAPID_PRIVATE_JWK.</p>' : "") +
      '<div class="admin-row" style="margin-bottom:16px">' +
        '<span class="admin-status published">Активні: ' + escapeHtml(summary.counts.active || 0) + '</span>' +
        '<span class="admin-status draft">UA: ' + escapeHtml(summary.counts.uk || 0) + '</span>' +
        '<span class="admin-status draft">EN: ' + escapeHtml(summary.counts.en || 0) + '</span>' +
      '</div>' +
      '<p class="admin-hint">Сповіщення з’являться лише в тих читачів, які самі натиснули дзвіночок і дозволили повідомлення у браузері.</p>' +
      '<p class="admin-error" id="push-error"></p>' +
      '<p class="admin-hint" id="push-result"></p>' +
      '<form class="admin-form" id="push-form">' +
        '<div class="admin-field"><label>Кому відправити</label><select name="targetLang">' +
          '<option value="all">Усім підписникам</option>' +
          '<option value="uk">Лише українська версія</option>' +
          '<option value="en">Лише англійська версія</option>' +
        '</select></div>' +
        '<div class="admin-field"><label>Заголовок українською*</label><input type="text" name="titleUk" maxlength="90" required placeholder="Оновлення ПроМедіа" /></div>' +
        '<div class="admin-field"><label>Текст українською*</label><textarea name="bodyUk" maxlength="180" required placeholder="Коротко поясніть, що сталося"></textarea></div>' +
        '<div class="admin-field"><label>Заголовок англійською</label><input type="text" name="titleEn" maxlength="90" placeholder="ProMedia update" /></div>' +
        '<div class="admin-field"><label>Текст англійською</label><textarea name="bodyEn" maxlength="180" placeholder="Briefly explain what happened"></textarea></div>' +
        '<div class="admin-field"><label>Посилання, яке відкриється після кліку</label><input type="url" name="url" placeholder="https://news.promedia.report/" /></div>' +
        '<button class="admin-btn" type="submit"' + (!summary.enabled ? " disabled" : "") + '>Відправити сповіщення</button>' +
      '</form>' +
      '</div>' +
      '<div class="admin-card">' +
      '<h2 style="font-family:var(--serif);color:var(--ink);margin-top:0;font-size:19px">Останні відправки</h2>' +
      (rows
        ? '<table class="admin-table"><thead><tr><th>Заголовок</th><th>Мова</th><th>Дата</th><th>Доставлено</th><th>Помилки</th></tr></thead><tbody>' + rows + '</tbody></table>'
        : '<p class="empty-state">Відправок ще немає.</p>') +
      '</div>';

    document.getElementById("push-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var form = e.target;
      var button = form.querySelector("button[type='submit']");
      var errorEl = document.getElementById("push-error");
      var resultEl = document.getElementById("push-result");
      errorEl.textContent = "";
      resultEl.textContent = "";
      button.disabled = true;
      api("/api/admin/push/send", {
        method: "POST",
        body: {
          targetLang: form.targetLang.value,
          titleUk: form.titleUk.value,
          bodyUk: form.bodyUk.value,
          titleEn: form.titleEn.value,
          bodyEn: form.bodyEn.value,
          url: form.url.value
        }
      }).then(function (data) {
        resultEl.textContent = "Відправлено: " + data.delivered + " з " + data.attempted + ". Помилок: " + data.failed + ".";
        return loadPushSummary();
      }).then(function () {
        renderPushPanel();
      }).catch(function (err) {
        errorEl.textContent = err.message;
        button.disabled = false;
      });
    });
  }

  // ---------- GitHub-backed subdomains ----------

  function loadSubdomains() {
    return api("/api/admin/subdomains").then(function (data) {
      state.subdomains = data.items || [];
      state.subdomainsConfigured = Boolean(data.configured);
      return data;
    });
  }

  function getSubdomain(siteId) {
    return state.subdomains.find(function (site) { return site.id === siteId; }) || null;
  }

  function getSubdomainFile(site, fileId) {
    return site && site.files ? site.files.find(function (file) { return file.id === fileId; }) : null;
  }

  function renderSubdomainsHub() {
    var cards = state.subdomains.map(function (site) {
      var files = site.files.map(function (file) {
        return '<button class="admin-btn secondary" type="button" data-subdomain-file="' + escapeHtml(site.id + ":" + file.id) + '">' + escapeHtml(file.label) + '</button>';
      }).join("");
      return '<div class="admin-card admin-subdomain-card">' +
        '<div><h2>' + escapeHtml(site.title) + '</h2>' +
        '<p class="admin-hint">' + escapeHtml(site.label) + '</p>' +
        '<p class="admin-hint">' + escapeHtml(site.files.map(function (f) { return f.path; }).join(" · ")) + '</p></div>' +
        '<div class="admin-row">' + files + '<a class="admin-btn secondary" href="' + escapeHtml(site.liveUrl) + '" target="_blank" rel="noopener">Відкрити сайт</a></div>' +
      '</div>';
    }).join("");

    root.innerHTML =
      '<p><a href="#/dashboard">← До списку статей</a></p>' +
      '<div class="admin-card">' +
      '<h1 style="font-family:var(--serif);color:var(--ink);margin-top:0">Дослідження та субдомени</h1>' +
      '<p class="admin-hint">Цей розділ редагує GitHub-субдомени через сервер news.promedia.report. Редактору не потрібен GitHub-акаунт: достатньо бути залогіненим у цю адмінку.</p>' +
      (!state.subdomainsConfigured ? '<p class="admin-error">Завантаження доступне, але збереження ще не увімкнене: на сервері потрібно додати секрет SUBDOMAINS_GITHUB_TOKEN.</p>' : "") +
      '</div>' +
      (cards || '<div class="admin-card"><p class="empty-state">Субдомени ще не налаштовані.</p></div>');

    Array.prototype.forEach.call(document.querySelectorAll("[data-subdomain-file]"), function (button) {
      button.addEventListener("click", function () {
        var parts = button.dataset.subdomainFile.split(":");
        navigate("#/subdomains/" + parts[0] + "/" + parts[1]);
      });
    });
  }

  function arrayToCsv(value) {
    return Array.isArray(value) ? value.join(", ") : "";
  }

  function csvToArray(value) {
    return String(value || "").split(",").map(function (item) { return item.trim(); }).filter(Boolean);
  }

  function deepGet(source, path, fallback) {
    var current = source;
    for (var i = 0; i < path.length; i += 1) {
      if (!current || current[path[i]] === undefined || current[path[i]] === null) return fallback;
      current = current[path[i]];
    }
    return current;
  }

  function deepSet(source, path, value) {
    var current = source;
    for (var i = 0; i < path.length - 1; i += 1) {
      var key = path[i];
      if (!current[key] || typeof current[key] !== "object") current[key] = {};
      current = current[key];
    }
    current[path[path.length - 1]] = value;
  }

  function jsonPathAttr(path) {
    return escapeHtml(JSON.stringify(path));
  }

  function syncSubdomainEditor() {
    if (!state.subdomainEditor) return;
    state.subdomainEditor.content = JSON.stringify(state.subdomainEditor.data, null, 2) + "\n";
    var source = document.getElementById("subdomain-json-source");
    if (source) source.value = state.subdomainEditor.content;
    var status = document.getElementById("subdomain-dirty-status");
    if (status) status.textContent = state.subdomainEditor.content === state.subdomainEditor.originalContent ? "Без змін" : "Є незбережені зміни";
  }

  function smartField(path, label, value, options) {
    options = options || {};
    var kind = options.kind || (typeof value === "number" ? "number" : "text");
    var wide = options.wide ? " wide" : "";
    var hint = options.hint ? '<span class="admin-field-hint">' + escapeHtml(options.hint) + '</span>' : "";
    var attr = 'data-json-path="' + jsonPathAttr(path) + '" data-json-kind="' + escapeHtml(kind) + '"';
    if (options.textarea) {
      return '<div class="admin-smart-field' + wide + '">' +
        '<label>' + escapeHtml(label) + '</label>' +
        '<textarea ' + attr + '>' + escapeHtml(value) + '</textarea>' +
        hint +
      '</div>';
    }
    var type = options.type || (kind === "number" ? "number" : "text");
    return '<div class="admin-smart-field' + wide + '">' +
      '<label>' + escapeHtml(label) + '</label>' +
      '<input type="' + escapeHtml(type) + '" value="' + escapeHtml(value) + '" ' + attr + ' />' +
      hint +
    '</div>';
  }

  function smartSelect(path, label, value, options, kind) {
    var htmlOptions = options.map(function (item) {
      return '<option value="' + escapeHtml(item.value) + '"' + (item.value === value ? " selected" : "") + '>' + escapeHtml(item.label) + '</option>';
    }).join("");
    return '<div class="admin-smart-field">' +
      '<label>' + escapeHtml(label) + '</label>' +
      '<select data-json-path="' + jsonPathAttr(path) + '" data-json-kind="' + escapeHtml(kind || "text") + '">' + htmlOptions + '</select>' +
    '</div>';
  }

  function renderPrimitiveJsonField(path, key, value) {
    var labelMap = {
      schemaVersion: "Версія схеми",
      admin: "Службова інформація",
      i18n: "Мовні версії",
      uk: "Українська версія",
      en: "Англійська версія",
      meta: "SEO",
      indexTitle: "SEO-заголовок головної",
      indexDesc: "SEO-опис головної",
      hero: "Перший екран",
      eyebrow: "Надзаголовок",
      title: "Заголовок",
      lede: "Короткий опис",
      list: "Список",
      sectionLabel: "Назва розділу",
      empty: "Порожній стан",
      links: "Посилання"
    };
    var label = labelMap[key] || key;
    if (typeof value === "boolean") {
      return smartSelect(path, label, value ? "true" : "false", [
        { value: "true", label: "Так" },
        { value: "false", label: "Ні" }
      ], "boolean");
    }
    return smartField(path, label, value == null ? "" : value, {
      kind: typeof value === "number" ? "number" : "text",
      textarea: String(value || "").length > 90,
      wide: String(value || "").length > 90
    });
  }

  function renderGenericJsonNode(value, path, key) {
    if (value === null || ["string", "number", "boolean"].indexOf(typeof value) !== -1) {
      return renderPrimitiveJsonField(path, key, value);
    }
    if (Array.isArray(value)) {
      return '<details class="admin-form-section" open><summary>' + escapeHtml(key || "Список") + ' (' + value.length + ')</summary><div class="admin-form-grid">' +
        value.map(function (item, index) { return renderGenericJsonNode(item, path.concat(index), "Запис " + (index + 1)); }).join("") +
      '</div></details>';
    }
    var simple = [];
    var complex = [];
    Object.keys(value || {}).forEach(function (childKey) {
      var child = value[childKey];
      if (child === null || ["string", "number", "boolean"].indexOf(typeof child) !== -1) simple.push([childKey, child]);
      else complex.push([childKey, child]);
    });
    return '<details class="admin-form-section" open><summary>' + escapeHtml(key || "Вміст") + '</summary>' +
      (simple.length ? '<div class="admin-form-grid">' + simple.map(function (entry) {
        return renderPrimitiveJsonField(path.concat(entry[0]), entry[0], entry[1]);
      }).join("") + '</div>' : '') +
      complex.map(function (entry) { return renderGenericJsonNode(entry[1], path.concat(entry[0]), entry[0]); }).join("") +
    '</details>';
  }

  function renderGenericJsonEditor() {
    return '<div class="admin-form-editor">' + renderGenericJsonNode(state.subdomainEditor.data, [], "Вміст") + '</div>';
  }

  function renderResearchEntry(item, index) {
    var title = deepGet(item, ["title", "uk"], "") || deepGet(item, ["title", "en"], "") || "Нове дослідження";
    var meta = [deepGet(item, ["year"], ""), deepGet(item, ["date"], "")].filter(Boolean).join(" · ");
    return '<details class="admin-form-section admin-research-entry" open>' +
      '<summary><span>' + escapeHtml(title) + '</span><em>' + escapeHtml(meta) + '</em></summary>' +
      '<div class="admin-research-tools">' +
        '<button class="admin-btn secondary" type="button" data-research-duplicate="' + index + '">Дублювати</button>' +
        '<button class="admin-btn danger" type="button" data-research-delete="' + index + '">Видалити</button>' +
      '</div>' +
      '<div class="admin-form-grid">' +
        smartField([index, "id"], "ID / slug", deepGet(item, ["id"], ""), { hint: "Латиницею, без пробілів. Краще не змінювати після публікації." }) +
        smartField([index, "date"], "Дата", deepGet(item, ["date"], ""), { type: "date" }) +
        smartField([index, "year"], "Рік", deepGet(item, ["year"], ""), { kind: "number" }) +
        smartField([index, "publisher"], "Видавець", deepGet(item, ["publisher"], "")) +
        smartField([index, "originalUrl"], "Оригінальна публікація", deepGet(item, ["originalUrl"], ""), { type: "url", wide: true }) +
      '</div>' +
      '<h3 class="admin-smart-subtitle">Українська версія</h3>' +
      '<div class="admin-form-grid">' +
        smartField([index, "title", "uk"], "Назва українською", deepGet(item, ["title", "uk"], ""), { wide: true }) +
        smartField([index, "summary", "uk"], "Короткий опис українською", deepGet(item, ["summary", "uk"], ""), { textarea: true, wide: true }) +
        smartField([index, "authors", "uk"], "Автори українською", arrayToCsv(deepGet(item, ["authors", "uk"], [])), { kind: "array", hint: "Кілька авторів розділяйте комами." }) +
        smartField([index, "tags", "uk"], "Теги українською", arrayToCsv(deepGet(item, ["tags", "uk"], [])), { kind: "array", hint: "Кілька тегів розділяйте комами." }) +
        smartSelect([index, "languages", "uk", "type"], "Тип посилання UA", deepGet(item, ["languages", "uk", "type"], "full"), [
          { value: "full", label: "Повний текст на сайті" },
          { value: "external", label: "Зовнішнє посилання" }
        ]) +
        smartField([index, "languages", "uk", "url"], "URL української версії", deepGet(item, ["languages", "uk", "url"], "")) +
      '</div>' +
      '<h3 class="admin-smart-subtitle">Англійська версія</h3>' +
      '<div class="admin-form-grid">' +
        smartField([index, "title", "en"], "Назва англійською", deepGet(item, ["title", "en"], ""), { wide: true }) +
        smartField([index, "summary", "en"], "Короткий опис англійською", deepGet(item, ["summary", "en"], ""), { textarea: true, wide: true }) +
        smartField([index, "authors", "en"], "Автори англійською", arrayToCsv(deepGet(item, ["authors", "en"], [])), { kind: "array", hint: "Кілька авторів розділяйте комами." }) +
        smartField([index, "tags", "en"], "Теги англійською", arrayToCsv(deepGet(item, ["tags", "en"], [])), { kind: "array", hint: "Кілька тегів розділяйте комами." }) +
        smartSelect([index, "languages", "en", "type"], "Тип посилання EN", deepGet(item, ["languages", "en", "type"], "full"), [
          { value: "full", label: "Повний текст на сайті" },
          { value: "external", label: "Зовнішнє посилання" }
        ]) +
        smartField([index, "languages", "en", "url"], "URL англійської версії", deepGet(item, ["languages", "en", "url"], "")) +
      '</div>' +
    '</details>';
  }

  function renderResearchCatalogEditor() {
    var items = state.subdomainEditor.data || [];
    return '<div class="admin-catalog-actions">' +
      '<div><h2>Каталог досліджень</h2><p class="admin-hint">Це картки на головній research.promedia.report. Повні HTML-тексти поки лишаються окремими файлами в GitHub.</p></div>' +
      '<button class="admin-btn" type="button" data-research-add>+ Додати дослідження</button>' +
    '</div>' +
    items.map(renderResearchEntry).join("");
  }

  function bindSubdomainSmartFields() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-json-path]"), function (field) {
      field.addEventListener("input", function () {
        var path = JSON.parse(field.dataset.jsonPath);
        var kind = field.dataset.jsonKind || "text";
        var value = field.value;
        if (kind === "number") value = Number(value) || 0;
        if (kind === "array") value = csvToArray(value);
        if (kind === "boolean") value = value === "true";
        deepSet(state.subdomainEditor.data, path, value);
        syncSubdomainEditor();
      });
      field.addEventListener("change", function () {
        var event = document.createEvent("HTMLEvents");
        event.initEvent("input", true, false);
        field.dispatchEvent(event);
      });
    });

    Array.prototype.forEach.call(document.querySelectorAll("[data-research-delete]"), function (button) {
      button.addEventListener("click", function () {
        if (!window.confirm("Видалити це дослідження з каталогу?")) return;
        state.subdomainEditor.data.splice(Number(button.dataset.researchDelete), 1);
        syncSubdomainEditor();
        renderSubdomainEditor();
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-research-duplicate]"), function (button) {
      button.addEventListener("click", function () {
        var source = state.subdomainEditor.data[Number(button.dataset.researchDuplicate)] || {};
        var copy = JSON.parse(JSON.stringify(source));
        copy.id = (copy.id || "research") + "-copy";
        state.subdomainEditor.data.splice(Number(button.dataset.researchDuplicate) + 1, 0, copy);
        syncSubdomainEditor();
        renderSubdomainEditor();
      });
    });
    var addButton = document.querySelector("[data-research-add]");
    if (addButton) addButton.addEventListener("click", function () {
      var today = new Date().toISOString().slice(0, 10);
      state.subdomainEditor.data.unshift({
        id: "new-research-" + Date.now(),
        year: new Date().getFullYear(),
        date: today,
        authors: { uk: [], en: [] },
        publisher: "",
        originalUrl: "",
        tags: { uk: [], en: [] },
        title: { uk: "", en: "" },
        summary: { uk: "", en: "" },
        languages: {
          uk: { type: "full", url: "" },
          en: { type: "external", url: "" }
        }
      });
      syncSubdomainEditor();
      renderSubdomainEditor();
    });

    var source = document.getElementById("subdomain-json-source");
    if (source) source.addEventListener("input", function () {
      try {
        state.subdomainEditor.data = JSON.parse(source.value);
        state.subdomainEditor.content = source.value;
        document.getElementById("subdomain-source-error").textContent = "";
        var status = document.getElementById("subdomain-dirty-status");
        if (status) status.textContent = state.subdomainEditor.content === state.subdomainEditor.originalContent ? "Без змін" : "Є незбережені зміни";
      } catch (err) {
        document.getElementById("subdomain-source-error").textContent = "JSON-помилка: " + err.message;
      }
    });
  }

  function loadSubdomainEditor(siteId, fileId) {
    return api("/api/admin/subdomains/" + encodeURIComponent(siteId) + "/files/" + encodeURIComponent(fileId))
      .then(function (data) {
        state.subdomainEditor = {
          site: data.site,
          file: data.file,
          sha: data.sha,
          content: data.content,
          originalContent: JSON.stringify(JSON.parse(data.content), null, 2) + "\n",
          data: JSON.parse(data.content),
          configured: Boolean(data.configured)
        };
        state.subdomainEditor.content = state.subdomainEditor.originalContent;
      });
  }

  function saveSubdomainEditor() {
    if (!state.subdomainEditor) return;
    var errorEl = document.getElementById("subdomain-error");
    var resultEl = document.getElementById("subdomain-result");
    var saveBtn = document.getElementById("subdomain-save");
    errorEl.textContent = "";
    resultEl.textContent = "";
    syncSubdomainEditor();
    saveBtn.disabled = true;
    api("/api/admin/subdomains/" + encodeURIComponent(state.subdomainEditor.site.id) + "/files/" + encodeURIComponent(state.subdomainEditor.file.id), {
      method: "PUT",
      body: {
        sha: state.subdomainEditor.sha,
        content: state.subdomainEditor.content,
        message: "Update " + state.subdomainEditor.file.path + " via ProMedia admin"
      }
    }).then(function (data) {
      state.subdomainEditor.sha = data.sha;
      state.subdomainEditor.originalContent = state.subdomainEditor.content;
      resultEl.innerHTML = 'Збережено в GitHub. GitHub Pages оновить сайт автоматично. Commit: <a href="' + escapeHtml(data.commit.url) + '" target="_blank" rel="noopener">' + escapeHtml(data.commit.sha.slice(0, 7)) + '</a>.';
      syncSubdomainEditor();
      saveBtn.disabled = false;
    }).catch(function (err) {
      errorEl.textContent = err.message;
      saveBtn.disabled = false;
    });
  }

  function renderSubdomainEditor(loadError) {
    if (loadError) {
      root.innerHTML =
        '<p><a href="#/subdomains">← До досліджень і субдоменів</a></p>' +
        '<div class="admin-card"><h1 style="font-family:var(--serif);color:var(--ink);margin-top:0">Не вдалося завантажити файл</h1>' +
        '<p class="admin-error">' + escapeHtml(loadError) + '</p></div>';
      return;
    }
    var editor = state.subdomainEditor;
    if (!editor) return;
    var body = editor.file.type === "researchCatalog" ? renderResearchCatalogEditor() : renderGenericJsonEditor();
    root.innerHTML =
      '<p><a href="#/subdomains">← До досліджень і субдоменів</a></p>' +
      '<div class="admin-card">' +
        '<div class="admin-subdomain-head">' +
          '<div><p class="admin-hint">' + escapeHtml(editor.site.label) + ' · ' + escapeHtml(editor.file.path) + '</p>' +
          '<h1 style="font-family:var(--serif);color:var(--ink);margin:0">' + escapeHtml(editor.file.label) + '</h1>' +
          '<p class="admin-hint">' + escapeHtml(editor.file.help || "") + '</p></div>' +
          '<div class="admin-row"><a class="admin-btn secondary" href="' + escapeHtml(editor.site.liveUrl) + '" target="_blank" rel="noopener">Відкрити сайт</a>' +
          '<button class="admin-btn" type="button" id="subdomain-save"' + (!editor.configured ? " disabled" : "") + '>Зберегти</button></div>' +
        '</div>' +
        (!editor.configured ? '<p class="admin-error">Збереження ще не увімкнене: на сервері потрібно додати секрет SUBDOMAINS_GITHUB_TOKEN.</p>' : '') +
        '<p class="admin-error" id="subdomain-error"></p>' +
        '<p class="admin-hint" id="subdomain-result"></p>' +
        '<p class="admin-hint" id="subdomain-dirty-status">Без змін</p>' +
      '</div>' +
      '<div class="admin-card">' + body +
        '<details class="admin-json-details"><summary>Технічний JSON</summary>' +
          '<p class="admin-error" id="subdomain-source-error"></p>' +
          '<textarea id="subdomain-json-source" spellcheck="false">' + escapeHtml(editor.content) + '</textarea>' +
        '</details>' +
      '</div>';
    var saveBtn = document.getElementById("subdomain-save");
    if (saveBtn) saveBtn.addEventListener("click", saveSubdomainEditor);
    bindSubdomainSmartFields();
    syncSubdomainEditor();
  }

  // ---------- Media catalog (для тегування медіа) ----------

  function loadMediaCatalog() {
    if (state.mediaCatalog) return Promise.resolve(state.mediaCatalog);
    return fetch("https://communities.promedia.report/data/communities.json")
      .then(function (res) { return res.json(); })
      .then(function (all) {
        state.mediaCatalog = all.filter(function (m) { return m.status === "approved"; });
        return state.mediaCatalog;
      })
      .catch(function () { state.mediaCatalog = []; return state.mediaCatalog; });
  }

  // ---------- Editor ----------

  function uploadImage(file) {
    return fetch("/api/admin/upload", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": file.type },
      body: file
    }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) throw new Error(data.error || "Не вдалось завантажити зображення");
        return data.url;
      });
    });
  }

  function normalizeUrl(url) {
    var value = String(url || "").trim();
    if (!value) return "";
    if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return value;
    return "https://" + value;
  }

  function inlineMarkdownToEditorHtml(text) {
    var out = escapeHtml(text);
    out = out.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, '<img src="$2" alt="$1" loading="lazy" />');
    out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    out = out.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, "$1<em>$2</em>");
    return out;
  }

  function markdownToEditorHtml(markdown) {
    var lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
    var blocks = [];
    var paragraph = [];
    var list = null;

    function flushParagraph() {
      if (paragraph.length) {
        blocks.push("<p>" + inlineMarkdownToEditorHtml(paragraph.join(" ")) + "</p>");
        paragraph = [];
      }
    }

    function flushList() {
      if (list) {
        blocks.push("<" + list.type + ">" + list.items.map(function (item) {
          return "<li>" + inlineMarkdownToEditorHtml(item) + "</li>";
        }).join("") + "</" + list.type + ">");
        list = null;
      }
    }

    lines.forEach(function (rawLine) {
      var line = rawLine.trim();
      var match;

      if (!line) {
        flushParagraph();
        flushList();
        return;
      }

      match = line.match(/^(#{1,6})\s+(.*)$/);
      if (match) {
        flushParagraph();
        flushList();
        blocks.push("<h" + match[1].length + ">" + inlineMarkdownToEditorHtml(match[2]) + "</h" + match[1].length + ">");
        return;
      }

      match = line.match(/^>\s?(.*)$/);
      if (match) {
        flushParagraph();
        flushList();
        blocks.push("<blockquote><p>" + inlineMarkdownToEditorHtml(match[1]) + "</p></blockquote>");
        return;
      }

      match = line.match(/^[-*]\s+(.*)$/);
      if (match) {
        flushParagraph();
        if (!list || list.type !== "ul") {
          flushList();
          list = { type: "ul", items: [] };
        }
        list.items.push(match[1]);
        return;
      }

      match = line.match(/^\d+\.\s+(.*)$/);
      if (match) {
        flushParagraph();
        if (!list || list.type !== "ol") {
          flushList();
          list = { type: "ol", items: [] };
        }
        list.items.push(match[1]);
        return;
      }

      flushList();
      paragraph.push(line);
    });

    flushParagraph();
    flushList();
    return blocks.join("") || "<p><br></p>";
  }

  function nodeListToMarkdown(nodes) {
    return Array.prototype.map.call(nodes, inlineNodeToMarkdown).join("");
  }

  function inlineNodeToMarkdown(node) {
    if (node.nodeType === Node.TEXT_NODE) return node.nodeValue.replace(/\u00a0/g, " ");
    if (node.nodeType !== Node.ELEMENT_NODE) return "";

    var tag = node.tagName.toLowerCase();
    var style = node.getAttribute("style") || "";
    var inner;
    if (tag === "br") return "\n";
    if (tag === "strong" || tag === "b") return "**" + nodeListToMarkdown(node.childNodes).trim() + "**";
    if (tag === "em" || tag === "i") return "*" + nodeListToMarkdown(node.childNodes).trim() + "*";
    if (tag === "a") {
      var href = normalizeUrl(node.getAttribute("href"));
      var label = nodeListToMarkdown(node.childNodes).trim() || href;
      return href ? "[" + label + "](" + href + ")" : label;
    }
    if (tag === "img") {
      var src = node.getAttribute("src") || "";
      var alt = node.getAttribute("alt") || "";
      return src ? "![" + alt + "](" + src + ")" : "";
    }
    inner = nodeListToMarkdown(node.childNodes);
    if (/font-weight\s*:\s*(bold|[6-9]00)/i.test(style)) return "**" + inner.trim() + "**";
    if (/font-style\s*:\s*italic/i.test(style)) return "*" + inner.trim() + "*";
    return nodeListToMarkdown(node.childNodes);
  }

  function blockNodeToMarkdown(node) {
    if (node.nodeType === Node.TEXT_NODE) return node.nodeValue.trim();
    if (node.nodeType !== Node.ELEMENT_NODE) return "";

    var tag = node.tagName.toLowerCase();
    var levelMatch = tag.match(/^h([1-6])$/);
    var text;

    if (levelMatch) {
      text = nodeListToMarkdown(node.childNodes).trim();
      return text ? Array(Number(levelMatch[1]) + 1).join("#") + " " + text : "";
    }
    if (tag === "blockquote") {
      text = nodeListToMarkdown(node.childNodes).replace(/\n+/g, "\n").trim();
      return text ? text.split("\n").map(function (line) { return "> " + line.trim(); }).join("\n") : "";
    }
    if (tag === "ul" || tag === "ol") {
      return Array.prototype.map.call(node.children, function (child, index) {
        if (child.tagName.toLowerCase() !== "li") return "";
        var marker = tag === "ol" ? (index + 1) + ". " : "- ";
        return marker + nodeListToMarkdown(child.childNodes).replace(/\n+/g, " ").trim();
      }).filter(Boolean).join("\n");
    }
    if (tag === "p" || tag === "div" || tag === "li") {
      return nodeListToMarkdown(node.childNodes).trim();
    }
    return nodeListToMarkdown(node.childNodes).trim();
  }

  function editorHtmlToMarkdown(surface) {
    var parts = Array.prototype.map.call(surface.childNodes, blockNodeToMarkdown)
      .map(function (part) { return part.replace(/[ \t]+\n/g, "\n").trim(); })
      .filter(Boolean);
    return parts.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  function commandButton(label, title, command) {
    return '<button class="admin-editor-icon" type="button" data-editor-command="' + command + '" title="' + escapeHtml(title) + '" aria-label="' + escapeHtml(title) + '">' + label + "</button>";
  }

  function richTextEditorHtml(name, value, langLabel, required) {
    return '' +
      '<div class="admin-rich-editor" data-rich-editor="' + name + '" data-required="' + (required ? "true" : "false") + '">' +
      '<div class="admin-editor-toolbar" role="toolbar" aria-label="Панель форматування ' + escapeHtml(langLabel) + '">' +
      '<select class="admin-editor-format" data-editor-format title="Стиль абзацу" aria-label="Стиль абзацу">' +
      '<option value="p">Абзац</option>' +
      '<option value="h2">Підзаголовок</option>' +
      '<option value="h3">Малий підзаголовок</option>' +
      '</select>' +
      commandButton("<strong>B</strong>", "Жирний", "bold") +
      commandButton("<em>I</em>", "Курсив", "italic") +
      commandButton("•", "Маркований список", "insertUnorderedList") +
      commandButton("1.", "Нумерований список", "insertOrderedList") +
      commandButton("“”", "Цитата", "blockquote") +
      commandButton("URL", "Додати посилання", "link") +
      commandButton("↶", "Скасувати", "undo") +
      commandButton("↷", "Повторити", "redo") +
      commandButton("Tx", "Очистити форматування", "removeFormat") +
      '<span class="admin-hint">Ctrl+K — посилання</span>' +
      '</div>' +
      '<div class="admin-editor-surface" data-editor-surface="true" contenteditable="true" role="textbox" aria-multiline="true" aria-label="' + escapeHtml(langLabel) + '"></div>' +
      '<textarea class="admin-editor-source" name="' + name + '">' + escapeHtml(value) + "</textarea>" +
      '<p class="admin-editor-note">Пишіть як у звичайному документі. Сайт сам збере чистий текст у своєму стилі.</p>' +
      '</div>';
  }

  function saveSelection(editor) {
    var selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;
    var range = selection.getRangeAt(0);
    if (!editor.surface.contains(range.commonAncestorContainer)) return;
    editor.selection = range.cloneRange();
  }

  function restoreSelection(editor) {
    if (!editor.selection) return;
    var selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(editor.selection);
  }

  function updateEditorToolbar(editor) {
    var selection = window.getSelection();
    if (!selection || !selection.rangeCount || !editor.surface.contains(selection.anchorNode)) return;
    var current = selection.anchorNode.nodeType === Node.ELEMENT_NODE ? selection.anchorNode : selection.anchorNode.parentNode;
    var block = "p";
    while (current && current !== editor.surface) {
      if (/^H[1-6]$/.test(current.tagName)) { block = current.tagName.toLowerCase(); break; }
      if (current.tagName === "BLOCKQUOTE") { block = "p"; break; }
      current = current.parentNode;
    }
    if (editor.formatSelect) editor.formatSelect.value = block === "h2" || block === "h3" ? block : "p";
    Array.prototype.forEach.call(editor.toolbar.querySelectorAll("[data-editor-command]"), function (button) {
      var command = button.dataset.editorCommand;
      var active = false;
      if (command === "bold" || command === "italic" || command === "insertUnorderedList" || command === "insertOrderedList") {
        try { active = document.queryCommandState(command); } catch (e) { active = false; }
      }
      button.classList.toggle("is-active", active);
    });
  }

  function ensureEditorLinks(surface) {
    Array.prototype.forEach.call(surface.querySelectorAll("a[href]"), function (link) {
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener");
    });
  }

  function syncRichEditors() {
    state.richEditors.forEach(function (editor) {
      ensureEditorLinks(editor.surface);
      editor.textarea.value = editorHtmlToMarkdown(editor.surface);
    });
  }

  function findRichEditor(name) {
    return state.richEditors.find(function (editor) {
      return editor.container && editor.container.dataset.richEditor === name;
    }) || null;
  }

  function setRichEditorMarkdown(name, markdown) {
    var editor = findRichEditor(name);
    if (!editor) return;
    editor.surface.innerHTML = markdownToEditorHtml(markdown || "");
    ensureEditorLinks(editor.surface);
    editor.textarea.value = editorHtmlToMarkdown(editor.surface);
  }

  function insertEditorLink(editor) {
    restoreSelection(editor);
    var selection = window.getSelection();
    var selected = selection && selection.rangeCount ? selection.toString().trim() : "";
    var selectedLooksLikeUrl = /^[a-z][a-z0-9+.-]*:/i.test(selected) || /^[\w.-]+\.[a-z]{2,}/i.test(selected);
    var label = selectedLooksLikeUrl ? window.prompt("Яке слово або фразу показати замість адреси?") : selected;
    if (!label) label = window.prompt("Яке слово або фразу залінкувати?");
    if (!label) return;
    var url = normalizeUrl(window.prompt("Вставте адресу посилання", selectedLooksLikeUrl ? selected : "https://"));
    if (!url) return;
    restoreSelection(editor);
    if (!selected) {
      document.execCommand("insertHTML", false, '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener">' + escapeHtml(label) + "</a>");
    } else {
      document.execCommand("createLink", false, url);
    }
    ensureEditorLinks(editor.surface);
    editor.surface.focus();
    saveSelection(editor);
    syncRichEditors();
  }

  function runEditorCommand(editor, command, value) {
    restoreSelection(editor);
    editor.surface.focus();
    if (command === "link") {
      insertEditorLink(editor);
      return;
    }
    if (command === "blockquote") {
      document.execCommand("formatBlock", false, "blockquote");
    } else if (command === "removeFormat") {
      document.execCommand("removeFormat", false, null);
      document.execCommand("formatBlock", false, "p");
    } else {
      document.execCommand(command, false, value || null);
    }
    ensureEditorLinks(editor.surface);
    saveSelection(editor);
    syncRichEditors();
    updateEditorToolbar(editor);
  }

  function attachRichTextEditors() {
    state.richEditors = [];
    Array.prototype.forEach.call(document.querySelectorAll(".admin-rich-editor"), function (container) {
      var name = container.dataset.richEditor;
      var textarea = container.querySelector('textarea[name="' + name + '"]');
      var surface = container.querySelector("[data-editor-surface]");
      var toolbar = container.querySelector(".admin-editor-toolbar");
      var formatSelect = container.querySelector("[data-editor-format]");
      var editor = { container: container, textarea: textarea, surface: surface, toolbar: toolbar, formatSelect: formatSelect, selection: null };
      surface.innerHTML = markdownToEditorHtml(textarea.value);
      ensureEditorLinks(surface);
      state.richEditors.push(editor);

      surface.addEventListener("input", function () {
        ensureEditorLinks(surface);
        syncRichEditors();
      });
      surface.addEventListener("keyup", function () { saveSelection(editor); updateEditorToolbar(editor); });
      surface.addEventListener("mouseup", function () { saveSelection(editor); updateEditorToolbar(editor); });
      surface.addEventListener("focus", function () { saveSelection(editor); updateEditorToolbar(editor); });
      surface.addEventListener("blur", function () { syncRichEditors(); });
      surface.addEventListener("keydown", function (event) {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
          event.preventDefault();
          saveSelection(editor);
          insertEditorLink(editor);
        }
      });

      if (formatSelect) {
        formatSelect.addEventListener("change", function () {
          runEditorCommand(editor, "formatBlock", formatSelect.value);
        });
      }

      Array.prototype.forEach.call(toolbar.querySelectorAll("[data-editor-command]"), function (button) {
        button.addEventListener("mousedown", function (event) { event.preventDefault(); });
        button.addEventListener("click", function () {
          runEditorCommand(editor, button.dataset.editorCommand);
        });
      });
    });
  }

  function renderEditor(article) {
    var isNew = !article;
    var a = article || {
      title: "", titleEn: "", excerpt: "", excerptEn: "", bodyMd: "", bodyMdEn: "",
      coverImageUrl: "", tags: [], relatedMediaIds: [], isImportant: false, cardStyle: "auto", status: "draft"
    };

    root.innerHTML =
      '<p><a href="#/dashboard">← До списку статей</a></p>' +
      '<div class="admin-card">' +
      '<h1 style="font-family:var(--serif);color:var(--ink);margin-top:0">' + (isNew ? "Нова стаття" : "Редагування статті") + "</h1>" +
      '<p class="admin-error" id="editor-error"></p>' +
      '<p class="admin-hint" id="assist-status" aria-live="polite"></p>' +
      '<form class="admin-form" id="editor-form">' +
      '<div class="admin-field"><label>Заголовок (укр)*</label><input type="text" name="title" required value="' + escapeHtml(a.title) + '" /></div>' +
      '<div class="admin-field"><label>Заголовок (англ)</label><input type="text" name="titleEn" value="' + escapeHtml(a.titleEn) + '" /></div>' +
      '<div class="admin-field"><label>Короткий опис (укр) — якщо порожньо, візьметься з тексту</label><input type="text" name="excerpt" value="' + escapeHtml(a.excerpt) + '" /></div>' +
      '<div class="admin-field"><label>Короткий опис (англ)</label><input type="text" name="excerptEn" value="' + escapeHtml(a.excerptEn) + '" /></div>' +
      '<div class="admin-field admin-markdown-field"><label>Текст статті (укр)*</label>' +
      richTextEditorHtml("bodyMd", a.bodyMd, "Текст статті українською", true) + "</div>" +
      '<div class="admin-field admin-markdown-field"><label>Текст статті (англ)</label>' +
      richTextEditorHtml("bodyMdEn", a.bodyMdEn, "Article text in English", false) + "</div>" +
      '<div class="admin-field"><label>Обкладинка</label>' +
      '<input type="file" id="cover-input" accept="image/*" />' +
      '<span class="admin-hint">Бажано: горизонтальне фото 16:9, від 1200×675 px; JPG, PNG або WebP; до 8 МБ. Важливі логотипи й написи краще тримати ближче до центру, бо картки можуть обрізати краї.</span>' +
      '<input type="hidden" name="coverImageUrl" id="cover-url" value="' + escapeHtml(a.coverImageUrl) + '" />' +
      (a.coverImageUrl ? '<img class="admin-cover-preview" id="cover-preview" src="' + escapeHtml(a.coverImageUrl) + '" />' : '<img class="admin-cover-preview" id="cover-preview" style="display:none" />') +
      "</div>" +
      '<div class="admin-field"><label>Теги (через кому)</label><input type="text" name="tags" value="' + escapeHtml(a.tags.join(", ")) + '" /></div>' +
      '<div class="admin-field"><label>Оформлення картки на головній сторінці новин</label>' +
      '<select name="cardStyle">' +
      '<option value="auto"' + ((a.cardStyle || "auto") === "auto" ? " selected" : "") + '>Автоматично — за позицією</option>' +
      '<option value="hero"' + (a.cardStyle === "hero" ? " selected" : "") + '>Велика головна новина</option>' +
      '<option value="image"' + (a.cardStyle === "image" ? " selected" : "") + '>Картка з фото</option>' +
      '<option value="text"' + (a.cardStyle === "text" ? " selected" : "") + '>Картка без фото</option>' +
      '</select><span class="admin-hint">Ручний вибір має пріоритет над автоматичним шаблоном. Велика головна новина може бути лише одна.</span></div>' +
      '<div class="admin-field"><label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer">' +
      '<input type="checkbox" name="isImportant" style="width:auto;margin-top:3px"' + (a.isImportant ? " checked" : "") + ' />' +
      '<span><strong>Важлива новина</strong><br><span class="admin-hint">Додати матеріал до добору «Вибрані новини» на головному сайті</span></span>' +
      "</label></div>" +
      '<div class="admin-field"><label>Пов’язані медіа (пошук за назвою з каталогу карти спільнот)</label>' +
      '<input type="text" id="media-search" placeholder="Почніть вводити назву медіа…" autocomplete="off" />' +
      '<div id="media-search-results"></div>' +
      '<div id="media-selected" class="admin-row" style="margin-top:6px"></div>' +
      "</div>" +
      '<div class="admin-row">' +
      '<button class="admin-btn" type="submit">Зберегти</button>' +
      (a.status === "published"
        ? '<button class="admin-btn secondary" type="button" id="unpublish-btn">Зняти з публікації</button>'
        : (!isNew ? '<button class="admin-btn" type="button" id="publish-btn">Опублікувати</button>' : "")) +
      (!isNew ? '<button class="admin-btn danger" type="button" id="delete-btn">Видалити</button>' : "") +
      "</div>" +
      "</form></div>";

    var selectedMediaIds = a.relatedMediaIds.slice();
    attachRichTextEditors();
    var formEl = document.getElementById("editor-form");

    function formField(form, name) {
      return form.elements[name];
    }

    var assistState = {
      timer: null,
      sequence: 0,
      lastKey: "",
      disabled: false,
      titleEnTouched: Boolean(a.titleEn),
      excerptEnTouched: Boolean(a.excerptEn),
      bodyMdEnTouched: Boolean(a.bodyMdEn),
      tagsTouched: Boolean(a.tags && a.tags.length)
    };

    function setAssistStatus(message, isError) {
      var el = document.getElementById("assist-status");
      if (!el) return;
      el.className = isError ? "admin-error" : "admin-hint";
      el.textContent = message || "";
    }

    function needsLiveAssist() {
      return !assistState.titleEnTouched || !assistState.excerptEnTouched || !assistState.bodyMdEnTouched || !assistState.tagsTouched;
    }

    function applyLiveAssist(suggestions) {
      if (!suggestions) return;
      if (!assistState.titleEnTouched && suggestions.titleEn) formField(formEl, "titleEn").value = suggestions.titleEn;
      if (!assistState.excerptEnTouched && suggestions.excerptEn) formField(formEl, "excerptEn").value = suggestions.excerptEn;
      if (!assistState.bodyMdEnTouched && suggestions.bodyMdEn) setRichEditorMarkdown("bodyMdEn", suggestions.bodyMdEn);
      if (!assistState.tagsTouched && suggestions.tags && suggestions.tags.length) formField(formEl, "tags").value = suggestions.tags.join(", ");
    }

    function runLiveAssist() {
      if (assistState.disabled || !needsLiveAssist()) return;
      syncRichEditors();
      var title = formField(formEl, "title").value.trim();
      var excerpt = formField(formEl, "excerpt").value.trim();
      var bodyMd = formField(formEl, "bodyMd").value.trim();
      if (title.length < 4 && bodyMd.length < 40) return;
      var key = title + "\n" + excerpt + "\n" + bodyMd;
      if (key === assistState.lastKey) return;
      assistState.lastKey = key;
      var sequence = ++assistState.sequence;
      setAssistStatus("Готую англійський переклад і теги…");
      api("/api/admin/articles/assist", {
        method: "POST",
        body: { title: title, excerpt: excerpt, bodyMd: bodyMd }
      }).then(function (data) {
        if (sequence !== assistState.sequence) return;
        applyLiveAssist(data.suggestions);
        setAssistStatus("Автопереклад і теги оновлено.");
        window.setTimeout(function () {
          if (sequence === assistState.sequence) setAssistStatus("");
        }, 3500);
      }).catch(function (err) {
        if (err.message.indexOf("OPENAI_API_KEY") !== -1 || err.message.indexOf("Автопереклад ще не підключений") !== -1) {
          assistState.disabled = true;
          setAssistStatus("");
          return;
        }
        setAssistStatus("Автопереклад зараз не спрацював. Можна продовжити вручну.", true);
      });
    }

    function scheduleLiveAssist() {
      if (assistState.disabled || !needsLiveAssist()) return;
      window.clearTimeout(assistState.timer);
      assistState.timer = window.setTimeout(runLiveAssist, 3500);
    }

    formField(formEl, "title").addEventListener("input", scheduleLiveAssist);
    formField(formEl, "excerpt").addEventListener("input", scheduleLiveAssist);
    formField(formEl, "titleEn").addEventListener("input", function () { assistState.titleEnTouched = true; });
    formField(formEl, "excerptEn").addEventListener("input", function () { assistState.excerptEnTouched = true; });
    formField(formEl, "tags").addEventListener("input", function () { assistState.tagsTouched = true; });
    var ukEditor = findRichEditor("bodyMd");
    if (ukEditor) ukEditor.surface.addEventListener("input", scheduleLiveAssist);
    var enEditor = findRichEditor("bodyMdEn");
    if (enEditor) enEditor.surface.addEventListener("input", function () { assistState.bodyMdEnTouched = true; });

    function renderSelectedMedia() {
      loadMediaCatalog().then(function (catalog) {
        var el = document.getElementById("media-selected");
        if (!el) return;
        el.innerHTML = selectedMediaIds.map(function (id) {
          var found = catalog.find(function (m) { return m.id === id; });
          var name = found ? found.name : id;
          return '<span class="article-tag" data-id="' + escapeHtml(id) + '" style="cursor:pointer">' + escapeHtml(name) + " ✕</span>";
        }).join(" ");
        Array.prototype.forEach.call(el.querySelectorAll("[data-id]"), function (chip) {
          chip.addEventListener("click", function () {
            selectedMediaIds = selectedMediaIds.filter(function (id) { return id !== chip.dataset.id; });
            renderSelectedMedia();
          });
        });
      });
    }
    renderSelectedMedia();

    var searchInput = document.getElementById("media-search");
    searchInput.addEventListener("input", function () {
      var q = searchInput.value.trim().toLowerCase();
      var resultsEl = document.getElementById("media-search-results");
      if (!q) { resultsEl.innerHTML = ""; return; }
      loadMediaCatalog().then(function (catalog) {
        var matches = catalog.filter(function (m) {
          return m.name.toLowerCase().indexOf(q) !== -1 && selectedMediaIds.indexOf(m.id) === -1;
        }).slice(0, 8);
        resultsEl.innerHTML = matches.map(function (m) {
          return '<div class="admin-hint" data-pick="' + escapeHtml(m.id) + '" style="cursor:pointer;padding:4px 0">' + escapeHtml(m.name) + " (" + escapeHtml(m.city) + ")</div>";
        }).join("");
        Array.prototype.forEach.call(resultsEl.querySelectorAll("[data-pick]"), function (row) {
          row.addEventListener("click", function () {
            selectedMediaIds.push(row.dataset.pick);
            searchInput.value = "";
            resultsEl.innerHTML = "";
            renderSelectedMedia();
          });
        });
      });
    });

    var coverInput = document.getElementById("cover-input");
    coverInput.addEventListener("change", function () {
      var file = coverInput.files[0];
      if (!file) return;
      uploadImage(file).then(function (url) {
        document.getElementById("cover-url").value = url;
        var preview = document.getElementById("cover-preview");
        preview.src = url;
        preview.style.display = "block";
      }).catch(function (err) {
        document.getElementById("editor-error").textContent = err.message;
      });
    });

    function collectPayload(form) {
      syncRichEditors();
      var fields = form.elements;
      return {
        title: fields.title.value,
        titleEn: fields.titleEn.value || null,
        excerpt: fields.excerpt.value || null,
        excerptEn: fields.excerptEn.value || null,
        bodyMd: fields.bodyMd.value,
        bodyMdEn: fields.bodyMdEn.value || null,
        coverImageUrl: fields.coverImageUrl.value || null,
        tags: fields.tags.value.split(",").map(function (t) { return t.trim(); }).filter(Boolean),
        relatedMediaIds: selectedMediaIds,
        isImportant: fields.isImportant.checked,
        cardStyle: fields.cardStyle.value
      };
    }

    formEl.addEventListener("submit", function (e) {
      e.preventDefault();
      var form = e.target;
      var payload = collectPayload(form);
      if (!payload.bodyMd) {
        document.getElementById("editor-error").textContent = "Текст статті українською обов'язковий";
        return;
      }
      var req = isNew
        ? api("/api/admin/articles", { method: "POST", body: payload })
        : api("/api/admin/articles/" + a.id, { method: "PUT", body: payload });
      req.then(function () { navigate("#/dashboard"); loadArticles().then(renderRoute); })
        .catch(function (err) { document.getElementById("editor-error").textContent = err.message; });
    });

    var publishBtn = document.getElementById("publish-btn");
    if (publishBtn) publishBtn.addEventListener("click", function () {
      api("/api/admin/articles/" + a.id + "/publish", { method: "POST" })
        .then(function () { navigate("#/dashboard"); loadArticles().then(renderRoute); })
        .catch(function (err) { document.getElementById("editor-error").textContent = err.message; });
    });
    var unpublishBtn = document.getElementById("unpublish-btn");
    if (unpublishBtn) unpublishBtn.addEventListener("click", function () {
      api("/api/admin/articles/" + a.id + "/unpublish", { method: "POST" })
        .then(function () { navigate("#/dashboard"); loadArticles().then(renderRoute); })
        .catch(function (err) { document.getElementById("editor-error").textContent = err.message; });
    });
    var deleteBtn = document.getElementById("delete-btn");
    if (deleteBtn) deleteBtn.addEventListener("click", function () {
      if (!window.confirm("Видалити статтю остаточно?")) return;
      api("/api/admin/articles/" + a.id, { method: "DELETE" })
        .then(function () { navigate("#/dashboard"); loadArticles().then(renderRoute); })
        .catch(function (err) { document.getElementById("editor-error").textContent = err.message; });
    });
  }

  // ---------- Users ----------

  function loadUsers() {
    return api("/api/admin/users").then(function (data) { state.users = data.items; });
  }

  function renderUsers() {
    var rows = state.users.map(function (u) {
      return "<tr><td>" + escapeHtml(u.name) + "</td><td>" + escapeHtml(u.email) + "</td><td>" + escapeHtml(u.role) + "</td></tr>";
    }).join("");
    root.innerHTML =
      '<p><a href="#/dashboard">← До списку статей</a></p>' +
      '<div class="admin-card">' +
      "<h1 style=\"font-family:var(--serif);color:var(--ink);margin-top:0\">Автори</h1>" +
      '<table class="admin-table"><thead><tr><th>Ім’я</th><th>Email</th><th>Роль</th></tr></thead><tbody>' + rows + "</tbody></table>" +
      "</div>" +
      '<div class="admin-card">' +
      "<h2 style=\"font-family:var(--serif);color:var(--ink);margin-top:0;font-size:19px\">Додати автора</h2>" +
      '<p class="admin-error" id="new-user-error"></p>' +
      '<form class="admin-form" id="new-user-form">' +
      '<div class="admin-field"><label>Ім’я</label><input type="text" name="name" required /></div>' +
      '<div class="admin-field"><label>Email</label><input type="email" name="email" required /></div>' +
      '<div class="admin-field"><label>Пароль (мінімум 10 символів)</label><input type="text" name="password" required minlength="10" /></div>' +
      '<div class="admin-field"><label>Роль</label><select name="role"><option value="author">Автор</option><option value="admin">Адміністратор</option></select></div>' +
      '<button class="admin-btn" type="submit">Створити</button>' +
      "</form></div>";

    document.getElementById("new-user-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var form = e.target;
      api("/api/admin/users", {
        method: "POST",
        body: { name: form.name.value, email: form.email.value, password: form.password.value, role: form.role.value }
      }).then(function () {
        return loadUsers();
      }).then(function () {
        renderUsers();
      }).catch(function (err) {
        document.getElementById("new-user-error").textContent = err.message;
      });
    });
  }

  // ---------- Router ----------

  function renderRoute() {
    var hash = window.location.hash || "#/dashboard";

    if (!state.user) {
      renderLogin();
      return;
    }

    if (hash === "#/login") { navigate("#/dashboard"); return; }
    if (hash === "#/new") { renderEditor(null); return; }
    if (hash === "#/users") {
      if (state.user.role !== "admin") { navigate("#/dashboard"); return; }
      loadUsers().then(renderUsers);
      return;
    }
    if (hash === "#/push") {
      if (state.user.role !== "admin") { navigate("#/dashboard"); return; }
      loadPushSummary().then(renderPushPanel);
      return;
    }
    if (hash === "#/subdomains") {
      if (state.user.role !== "admin") { navigate("#/dashboard"); return; }
      loadSubdomains().then(renderSubdomainsHub).catch(function (err) {
        root.innerHTML =
          '<p><a href="#/dashboard">← До списку статей</a></p>' +
          '<div class="admin-card"><h1 style="font-family:var(--serif);color:var(--ink);margin-top:0">Не вдалося завантажити субдомени</h1>' +
          '<p class="admin-error">' + escapeHtml(err.message) + '</p></div>';
      });
      return;
    }
    var subdomainMatch = hash.match(/^#\/subdomains\/([a-z0-9-]+)\/([a-z0-9-]+)$/);
    if (subdomainMatch) {
      if (state.user.role !== "admin") { navigate("#/dashboard"); return; }
      loadSubdomains()
        .then(function () { return loadSubdomainEditor(subdomainMatch[1], subdomainMatch[2]); })
        .then(function () { renderSubdomainEditor(); })
        .catch(function (err) { renderSubdomainEditor(err.message); });
      return;
    }
    var editMatch = hash.match(/^#\/edit\/(\d+)$/);
    if (editMatch) {
      var article = state.articles.find(function (a) { return String(a.id) === editMatch[1]; });
      if (article) { renderEditor(article); return; }
      loadArticles().then(function () {
        var found = state.articles.find(function (a) { return String(a.id) === editMatch[1]; });
        if (found) renderEditor(found); else navigate("#/dashboard");
      });
      return;
    }
    renderDashboard();
  }

  window.addEventListener("hashchange", renderRoute);

  function boot() {
    api("/api/me").then(function (data) {
      state.user = data.user;
      renderUserRow();
      return loadArticles();
    }).then(function () {
      renderRoute();
    }).catch(function () {
      state.user = null;
      renderUserRow();
      renderLogin();
    });
  }

  boot();
})();
