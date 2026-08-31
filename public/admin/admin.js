(function () {
  "use strict";

  var root = document.getElementById("admin-root");
  var userRow = document.getElementById("admin-user-row");
  var state = { user: null, articles: [], users: [], mediaCatalog: null };

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
    var usersBtn = document.getElementById("users-btn");
    if (usersBtn) usersBtn.addEventListener("click", function () { navigate("#/users"); });
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
      '<form class="admin-form" id="editor-form">' +
      '<div class="admin-field"><label>Заголовок (укр)*</label><input type="text" name="title" required value="' + escapeHtml(a.title) + '" /></div>' +
      '<div class="admin-field"><label>Заголовок (англ)</label><input type="text" name="titleEn" value="' + escapeHtml(a.titleEn) + '" /></div>' +
      '<div class="admin-field"><label>Короткий опис (укр) — якщо порожньо, візьметься з тексту</label><input type="text" name="excerpt" value="' + escapeHtml(a.excerpt) + '" /></div>' +
      '<div class="admin-field"><label>Короткий опис (англ)</label><input type="text" name="excerptEn" value="' + escapeHtml(a.excerptEn) + '" /></div>' +
      '<div class="admin-field"><label>Текст статті (укр, markdown)*</label><textarea name="bodyMd" rows="12" required>' + escapeHtml(a.bodyMd) + "</textarea></div>" +
      '<div class="admin-field"><label>Текст статті (англ, markdown)</label><textarea name="bodyMdEn" rows="12">' + escapeHtml(a.bodyMdEn) + "</textarea></div>" +
      '<div class="admin-field"><label>Обкладинка</label>' +
      '<input type="file" id="cover-input" accept="image/*" />' +
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
      return {
        title: form.title.value,
        titleEn: form.titleEn.value || null,
        excerpt: form.excerpt.value || null,
        excerptEn: form.excerptEn.value || null,
        bodyMd: form.bodyMd.value,
        bodyMdEn: form.bodyMdEn.value || null,
        coverImageUrl: form.coverImageUrl.value || null,
        tags: form.tags.value.split(",").map(function (t) { return t.trim(); }).filter(Boolean),
        relatedMediaIds: selectedMediaIds,
        isImportant: form.isImportant.checked,
        cardStyle: form.cardStyle.value
      };
    }

    document.getElementById("editor-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var form = e.target;
      var payload = collectPayload(form);
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
