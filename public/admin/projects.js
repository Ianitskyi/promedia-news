(function () {
  "use strict";
  var root = document.getElementById("projects-admin-root");
  var userRow = document.getElementById("admin-user-row");
  var state = { user: null, projects: [], trash: [], editing: null };

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function renderUserRow() {
    if (!userRow || !state.user) return;
    userRow.innerHTML =
      '<span class="admin-hint">' + esc(state.user.name) + " (" + esc(state.user.role) + ")</span>" +
      '<a class="admin-btn secondary" href="/admin#/change-password">Пароль</a>' +
      '<button class="admin-btn secondary" id="projects-logout" type="button">Вийти</button>';
    document.getElementById("projects-logout").addEventListener("click", function () {
      api("/api/auth/logout", { method:"POST" }).then(function () { window.location.href = "/admin"; });
    });
  }

  function api(path, options) {
    options = options || {};
    var headers = options.headers || {};
    if (options.body && !(options.body instanceof ArrayBuffer) && !(options.body instanceof Blob)) {
      headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(options.body);
    }
    return fetch(path, Object.assign({ credentials: "include", headers: headers }, options)).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) throw new Error(data.error || ("HTTP " + res.status));
        return data;
      });
    });
  }

  function statusBadge(status) {
    var label = status === "published" ? "опубліковано" : "чернетка";
    return '<span class="admin-status ' + (status === "published" ? "published" : "draft") + '">' + label + '</span>';
  }

  function adminSectionNav(active) {
    return '<div class="admin-section-nav">' +
      '<a class="admin-section-link' + (active === "news" ? " active" : "") + '" href="/admin#/dashboard">Новини</a>' +
      '<a class="admin-section-link' + (active === "projects" ? " active" : "") + '" href="/admin/projects.html">Проєкти</a>' +
      '<a class="admin-section-link' + (active === "research" ? " active" : "") + '" href="/admin#/subdomains">Дослідження</a>' +
    '</div>';
  }

  function projectNeedsTranslation(p) {
    return !String(p.titleEn || "").trim() || !String(p.excerptEn || "").trim() || !String(p.bodyMdEn || "").trim()
      || !String(p.titleCrh || "").trim() || !String(p.excerptCrh || "").trim() || !String(p.bodyMdCrh || "").trim()
      || (p.partner && (!String(p.partnerEn || "").trim() || !String(p.partnerCrh || "").trim()))
      || (p.donor && (!String(p.donorEn || "").trim() || !String(p.donorCrh || "").trim()));
  }

  function loadProjects() {
    return api("/api/admin/projects").then(function (data) { state.projects = data.items || []; });
  }

  function loadTrash() {
    return api("/api/admin/projects/trash").then(function (data) { state.trash = data.items || []; });
  }

  function list(notice) {
    notice = typeof notice === "string" ? notice : "";
    var rows = state.projects.map(function (p) {
      var projectState = p.projectStatus === "completed" ? "завершено" : (p.projectStatus === "upcoming" ? "заплановано" : "триває");
      return "<tr><td>" + (p.isFeatured ? "★ " : "") + esc(p.title) + "</td><td>" + esc(projectState) + "</td><td>" +
        statusBadge(p.publicationStatus) + "</td><td>" + esc(new Date(p.updatedAt).toLocaleDateString("uk-UA")) +
        '</td><td><div class="admin-row"><button class="admin-btn secondary" data-edit="' + p.id + '" type="button">Редагувати</button></div></td></tr>';
    }).join("");
    var hasMissingTranslations = state.projects.some(projectNeedsTranslation);
    root.innerHTML =
      adminSectionNav("projects") +
      '<div class="admin-row admin-context-actions" style="margin-bottom:18px"><button class="admin-btn" id="new-project" type="button">+ Новий проєкт</button>' +
      (hasMissingTranslations && state.user.role === "admin" ? '<button class="admin-btn secondary" id="translate-projects" type="button">Перекласти відсутні EN/QT</button>' : '') +
      (state.user.role === "admin" ? '<button class="admin-btn secondary" id="project-trash" type="button">Кошик</button>' : '') +
      '<span class="admin-hint" id="translate-projects-status"></span></div>' +
      '<div class="admin-card"><h1 style="font-family:var(--serif);color:var(--ink);margin-top:0">Проєкти</h1>' +
      (notice ? '<p class="admin-success" role="status">' + esc(notice) + '</p>' : '') +
      (rows ? '<table class="admin-table"><thead><tr><th>Назва</th><th>Статус проєкту</th><th>Публікація</th><th>Оновлено</th><th></th></tr></thead><tbody>' + rows + '</tbody></table>' :
        '<p class="empty-state">Проєктів ще немає.</p>') + '</div>';
    document.getElementById("new-project").addEventListener("click", function () { editor(null); });
    var translateBtn = document.getElementById("translate-projects");
    if (translateBtn) translateBtn.addEventListener("click", function () {
      var status = document.getElementById("translate-projects-status");
      translateBtn.disabled = true;
      function next() {
        api("/api/admin/projects/translate-missing", { method:"POST" }).then(function (data) {
          if (data.done) {
            status.textContent = "Переклади заповнено.";
            return loadProjects().then(list);
          }
          status.textContent = "Перекладено: " + (data.translated || "") + ". Залишилось: " + data.remaining;
          window.setTimeout(next, 250);
        }).catch(function (err) {
          status.textContent = err.message;
          translateBtn.disabled = false;
        });
      }
      status.textContent = "Перекладаю…";
      next();
    });
    var trashBtn = document.getElementById("project-trash");
    if (trashBtn) trashBtn.addEventListener("click", function () { loadTrash().then(renderTrash); });
    Array.prototype.forEach.call(root.querySelectorAll("[data-edit]"), function (btn) {
      btn.addEventListener("click", function () {
        var id = Number(btn.dataset.edit);
        editor(state.projects.find(function (p) { return p.id === id; }) || null);
      });
    });
  }

  function renderTrash() {
    var rows = state.trash.map(function (p) {
      return "<tr><td>" + esc(p.title) + "</td><td>" + esc(new Date(p.deletedAt).toLocaleDateString("uk-UA")) + "</td>" +
        '<td><div class="admin-row"><button class="admin-btn secondary" data-restore-project="' + p.id + '" type="button">Відновити</button>' +
        '<button class="admin-btn danger" data-delete-project-forever="' + p.id + '" type="button">Видалити назавжди</button></div></td></tr>';
    }).join("");
    root.innerHTML = adminSectionNav("projects") +
      '<div class="admin-row admin-context-actions" style="margin-bottom:18px"><button class="admin-btn secondary" id="back-from-project-trash" type="button">← До проєктів</button></div>' +
      '<div class="admin-card"><h1 style="font-family:var(--serif);color:var(--ink);margin-top:0">Кошик проєктів</h1>' +
      '<p class="admin-hint">Проєкти в кошику не показуються на сайті. Їх можна відновити або видалити назавжди.</p>' +
      (rows ? '<table class="admin-table"><thead><tr><th>Назва</th><th>Видалено</th><th></th></tr></thead><tbody>' + rows + '</tbody></table>' :
        '<p class="empty-state">Кошик порожній.</p>') + '</div>';
    document.getElementById("back-from-project-trash").addEventListener("click", function () { list(); });
    Array.prototype.forEach.call(root.querySelectorAll("[data-restore-project]"), function (btn) {
      btn.addEventListener("click", function () {
        api("/api/admin/projects/" + btn.dataset.restoreProject + "/restore", { method:"POST" })
          .then(loadTrash).then(renderTrash).catch(function (err) { window.alert(err.message); });
      });
    });
    Array.prototype.forEach.call(root.querySelectorAll("[data-delete-project-forever]"), function (btn) {
      btn.addEventListener("click", function () {
        if (!window.confirm("Видалити цей проєкт назавжди? Відновити його буде неможливо.")) return;
        api("/api/admin/projects/" + btn.dataset.deleteProjectForever + "/permanent", { method:"DELETE" })
          .then(loadTrash).then(renderTrash).catch(function (err) { window.alert(err.message); });
      });
    });
  }

  function value(form, name) { return form.elements[name].value.trim(); }
  function cleanTag(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
  function uniqueTags(tags) {
    return (Array.isArray(tags) ? tags : []).reduce(function (result, raw) {
      var tag = cleanTag(raw), key = tag.toLocaleLowerCase("uk-UA");
      if (tag && tag.length <= 48 && !result.some(function (value) { return value.toLocaleLowerCase("uk-UA") === key; })) result.push(tag);
      return result;
    }, []).slice(0, 12);
  }
  function tagChips(tags) {
    return tags.map(function (tag, index) {
      return '<span class="project-tag-chip">' + esc(tag) + '<button type="button" class="project-tag-remove" data-project-tag-index="' + index + '" aria-label="Прибрати тег ' + esc(tag) + '">×</button></span>';
    }).join("");
  }
  function tagEditor(selected) {
    var tags = uniqueTags(selected);
    return '<div class="project-tag-editor" aria-label="Теги проєкту">' +
      '<input type="hidden" name="projectTags" value="' + esc(JSON.stringify(tags)) + '" />' +
      '<div class="project-tag-list" id="project-tag-list">' + tagChips(tags) + '</div>' +
      '<div class="admin-row project-tag-add"><input id="project-tag-input" maxlength="48" placeholder="Новий тег" autocomplete="off" />' +
      '<button class="admin-btn secondary" id="add-project-tag" type="button">Додати тег</button></div>' +
      '<span class="admin-hint">Додайте лише потрібні позначки; до 12 тегів у проєкті.</span></div>';
  }

  function editor(project) {
    var p = project || {
      title:"",titleEn:"",titleCrh:"",excerpt:"",excerptEn:"",excerptCrh:"",bodyMd:"",bodyMdEn:"",bodyMdCrh:"",workMd:"",workMdEn:"",workMdCrh:"",resultsMd:"",resultsMdEn:"",resultsMdCrh:"",coverImageUrl:"",coverImageUrlEn:"",
      partner:"",partnerEn:"",partnerCrh:"",donor:"",donorEn:"",donorCrh:"",projectStatus:"active",startDate:"",endDate:"",
      periodLabel:"",websiteUrl:"",tags:[],isFeatured:false,publicationStatus:"draft"
    };
    var isNew = !project;
    root.innerHTML =
      adminSectionNav("projects") +
      '<p><button class="admin-btn secondary" id="back-projects" type="button">← До списку проєктів</button></p>' +
      '<div class="admin-card"><h1 style="font-family:var(--serif);color:var(--ink);margin-top:0">' + (isNew ? "Новий проєкт" : "Редагування проєкту") + '</h1>' +
      '<p class="admin-error" id="project-error"></p>' +
      '<p class="admin-hint" id="project-save-status" role="status" aria-live="polite"></p>' +
      '<form class="admin-form" id="project-form">' +
      '<div class="admin-field"><label>Назва (укр)*</label><input name="title" required value="' + esc(p.title) + '" /></div>' +
      '<div class="admin-field"><label>Назва (англ)</label><input name="titleEn" value="' + esc(p.titleEn) + '" /></div>' +
      '<div class="admin-field"><label>Назва (кримськотатарська)</label><input name="titleCrh" value="' + esc(p.titleCrh) + '" /></div>' +
      '<div class="admin-field"><label>Короткий опис (укр)</label><textarea name="excerpt">' + esc(p.excerpt) + '</textarea></div>' +
      '<div class="admin-field"><label>Короткий опис (англ)</label><textarea name="excerptEn">' + esc(p.excerptEn) + '</textarea></div>' +
      '<div class="admin-field"><label>Короткий опис (кримськотатарська)</label><textarea name="excerptCrh">' + esc(p.excerptCrh) + '</textarea></div>' +
      '<div class="admin-field admin-markdown-field"><label>Про проєкт (укр)*</label>'+ProMediaRichEditor.html("bodyMd",p.bodyMd,"Опис проєкту українською",true)+'</div>' +
      '<div class="admin-field admin-markdown-field"><label>Що ми робили (укр)*</label>'+ProMediaRichEditor.html("workMd",p.workMd,"Що ми робили українською",true)+'</div>' +
      '<div class="admin-field admin-markdown-field"><label>Результати (укр)*</label>'+ProMediaRichEditor.html("resultsMd",p.resultsMd,"Результати українською",true)+'</div>' +
      '<div class="admin-field admin-markdown-field"><label>Про проєкт (англ)</label>'+ProMediaRichEditor.html("bodyMdEn",p.bodyMdEn,"Project description in English",false)+'</div>' +
      '<div class="admin-field admin-markdown-field"><label>Що ми робили (англ)</label>'+ProMediaRichEditor.html("workMdEn",p.workMdEn,"Work completed in English",false)+'</div>' +
      '<div class="admin-field admin-markdown-field"><label>Результати (англ)</label>'+ProMediaRichEditor.html("resultsMdEn",p.resultsMdEn,"Results in English",false)+'</div>' +
      '<div class="admin-field admin-markdown-field"><label>Про проєкт (кримськотатарська)</label>'+ProMediaRichEditor.html("bodyMdCrh",p.bodyMdCrh,"Layiha tasviri qırımtatarca",false)+'</div>' +
      '<div class="admin-field admin-markdown-field"><label>Що ми робили (кримськотатарська)</label>'+ProMediaRichEditor.html("workMdCrh",p.workMdCrh,"Yapqanımız qırımtatarca",false)+'</div>' +
      '<div class="admin-field admin-markdown-field"><label>Результати (кримськотатарська)</label>'+ProMediaRichEditor.html("resultsMdCrh",p.resultsMdCrh,"Neticeler qırımtatarca",false)+'</div>' +
      '<div class="admin-field"><label>Обкладинка</label><input type="file" id="project-cover" accept="image/*" />' +
      '<input type="hidden" id="project-cover-url-field" name="coverImageUrl" value="' + esc(p.coverImageUrl) + '" />' +
      (p.coverImageUrl ? '<img class="admin-cover-preview" id="project-cover-preview" src="' + esc(p.coverImageUrl) + '" />' : '<img class="admin-cover-preview" id="project-cover-preview" style="display:none" />') + '<div class="cover-editor" id="project-cover-crop"></div><input type="hidden" name="coverCropData" id="project-cover-crop-value" value="' + esc(JSON.stringify(p.coverCropData || {})) + '" />' + '</div>' +
      '<div class="admin-field"><label>Обкладинка (англ)</label><input type="file" id="project-cover-en" accept="image/*" />' +
      '<input type="hidden" id="project-cover-url-en-field" name="coverImageUrlEn" value="' + esc(p.coverImageUrlEn || "") + '" />' +
      (p.coverImageUrlEn ? '<img class="admin-cover-preview" id="project-cover-en-preview" src="' + esc(p.coverImageUrlEn) + '" />' : '<img class="admin-cover-preview" id="project-cover-en-preview" style="display:none" />') +
      '<div class="cover-editor" id="project-cover-crop-en"></div><input type="hidden" name="coverCropDataEn" id="project-cover-crop-en-value" value="' + esc(JSON.stringify(p.coverCropDataEn || {})) + '" /></div>' +
      '<div class="admin-field"><label>Статус проєкту</label><select name="projectStatus">' +
      '<option value="upcoming"' + (p.projectStatus === "upcoming" ? " selected" : "") + '>Заплановано</option>' +
      '<option value="active"' + (p.projectStatus === "active" ? " selected" : "") + '>Триває</option>' +
      '<option value="completed"' + (p.projectStatus === "completed" ? " selected" : "") + '>Завершено</option></select></div>' +
      '<div class="admin-row"><div class="admin-field"><label>Дата початку</label><input type="date" name="startDate" value="' + esc(p.startDate || "") + '" /></div>' +
      '<div class="admin-field"><label>Дата завершення</label><input type="date" name="endDate" value="' + esc(p.endDate || "") + '" /></div></div>' +
      '<div class="admin-field"><label>Період для показу на сайті</label><input name="periodLabel" placeholder="Наприклад: травень–червень 2026" value="'+esc(p.periodLabel||"")+'" /><span class="admin-hint">Зберігає точне формулювання для періодів без конкретного дня.</span></div>' +
      '<div class="admin-field"><label>Партнер (укр)</label><input name="partner" value="' + esc(p.partner) + '" /></div>' +
      '<div class="admin-field"><label>Партнер (англ)</label><input name="partnerEn" value="' + esc(p.partnerEn) + '" /></div>' +
      '<div class="admin-field"><label>Партнер (кримськотатарська)</label><input name="partnerCrh" value="' + esc(p.partnerCrh) + '" /></div>' +
      '<div class="admin-field"><label>Донор (укр)</label><input name="donor" value="' + esc(p.donor) + '" /></div>' +
      '<div class="admin-field"><label>Донор (англ)</label><input name="donorEn" value="' + esc(p.donorEn) + '" /></div>' +
      '<div class="admin-field"><label>Донор (кримськотатарська)</label><input name="donorCrh" value="' + esc(p.donorCrh) + '" /></div>' +
      '<div class="admin-field"><label>Посилання на сайт/матеріали проєкту</label><input type="url" name="websiteUrl" value="' + esc(p.websiteUrl) + '" /></div>' +
      '<div class="admin-field"><label>Теги</label>'+tagEditor(p.tags)+'</div>' +
      '<div class="admin-field"><label style="display:flex;gap:10px;align-items:center"><input type="checkbox" name="isFeatured" style="width:auto"' + (p.isFeatured ? " checked" : "") + ' /> Показувати як вибраний проєкт</label></div>' +
      '<div class="admin-row"><button class="admin-btn" type="submit">Зберегти</button>' +
      (!isNew && p.publicationStatus === "published" ? '<button class="admin-btn secondary" id="unpublish-project" type="button">Зняти з публікації</button>' : '') +
      (!isNew && p.publicationStatus !== "published" ? '<button class="admin-btn" id="publish-project" type="button">Опублікувати</button>' : '') +
      (!isNew ? '<button class="admin-btn danger" id="delete-project" type="button">Видалити</button>' : '') +
      '</div></form></div>';

    document.getElementById("back-projects").addEventListener("click", function () { list(); });
    var form = document.getElementById("project-form");
    var projectTagField = form.elements.projectTags;
    function currentProjectTags() {
      try { return uniqueTags(JSON.parse(projectTagField.value || "[]")); } catch (_) { return []; }
    }
    function renderProjectTags(tags) {
      var clean = uniqueTags(tags);
      projectTagField.value = JSON.stringify(clean);
      document.getElementById("project-tag-list").innerHTML = tagChips(clean);
      Array.prototype.forEach.call(form.querySelectorAll("[data-project-tag-index]"), function (button) {
        button.addEventListener("click", function () {
          var tags = currentProjectTags();
          tags.splice(Number(button.dataset.projectTagIndex), 1);
          renderProjectTags(tags);
        });
      });
    }
    function addProjectTag() {
      var input = document.getElementById("project-tag-input");
      var tag = cleanTag(input.value), tags = currentProjectTags();
      if (!tag) return;
      if (tag.length > 48) { document.getElementById("project-error").textContent = "Тег має містити до 48 символів."; return; }
      if (tags.length >= 12) { document.getElementById("project-error").textContent = "У проєкті може бути до 12 тегів."; return; }
      if (!tags.some(function (value) { return value.toLocaleLowerCase("uk-UA") === tag.toLocaleLowerCase("uk-UA"); })) tags.push(tag);
      input.value = "";
      document.getElementById("project-error").textContent = "";
      renderProjectTags(tags);
      input.focus();
    }
    document.getElementById("add-project-tag").addEventListener("click", addProjectTag);
    document.getElementById("project-tag-input").addEventListener("keydown", function (event) {
      if (event.key === "Enter") { event.preventDefault(); addProjectTag(); }
    });
    renderProjectTags(currentProjectTags());
    (function foldTranslations() {
      var formFields = Array.prototype.filter.call(form.querySelectorAll(".admin-field"), function (field) {
        var label = field.querySelector("label");
        return label && /\((англ|кримськотатарська)([,)]|$)/i.test(label.textContent || "");
      });
      if (!formFields.length) return;
      var details = document.createElement("details");
      details.className = "admin-translations";
      details.innerHTML = "<summary>Переклади: англійська та кримськотатарська — розгорнути для перевірки</summary>";
      formFields[0].parentNode.insertBefore(details, formFields[0]);
      formFields.forEach(function (field) { details.appendChild(field); });
    })();
    var projectEditors = ProMediaRichEditor.attach(form);
    var projectCrop = ProMediaCoverEditor.create("project-cover-crop", "project-cover-url-field", "project-cover-crop-value");
    var projectCropEn = ProMediaCoverEditor.create("project-cover-crop-en", "project-cover-url-en-field", "project-cover-crop-en-value");
    (function () {
      var copyButton = document.createElement("button");
      copyButton.type = "button"; copyButton.className = "admin-btn secondary";
      copyButton.textContent = "Скопіювати кадрування з української обкладинки";
      copyButton.addEventListener("click", function () {
        projectCropEn.setValue(projectCrop.getValue());
      });
      document.getElementById("project-cover-crop-en").parentNode.appendChild(copyButton);
    })();
    document.getElementById("project-cover").addEventListener("change", function (e) {
      var file = e.target.files && e.target.files[0]; if (!file) return;
      fetch("/api/admin/projects/upload", { method:"POST", credentials:"include", headers:{"Content-Type":file.type}, body:file })
        .then(function (r) { return r.json().then(function(d){ if(!r.ok) throw new Error(d.error || "Upload failed"); return d; }); })
        .then(function (d) {
          form.elements.coverImageUrl.value = d.url;
          projectCrop.setImage(d.url);
          var img=document.getElementById("project-cover-preview"); img.src=d.url; img.style.display="";
        }).catch(function(err){ document.getElementById("project-error").textContent=err.message; });
    });

    document.getElementById("project-cover-en").addEventListener("change", function (e) {
      var file = e.target.files && e.target.files[0]; if (!file) return;
      fetch("/api/admin/projects/upload", { method:"POST", credentials:"include", headers:{"Content-Type":file.type}, body:file })
        .then(function (r) { return r.json().then(function(d){ if(!r.ok) throw new Error(d.error || "Upload failed"); return d; }); })
        .then(function (d) {
          form.elements.coverImageUrlEn.value = d.url;
          projectCropEn.setImage(d.url);
          var img = document.getElementById("project-cover-en-preview"); img.src = d.url; img.style.display = "";
        }).catch(function(err){ document.getElementById("project-error").textContent = err.message; });
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var saveButton = form.querySelector('button[type="submit"]');
      var saveStatus = document.getElementById("project-save-status");
      ProMediaRichEditor.sync(projectEditors);
      var body = {
        title:value(form,"title"), titleEn:value(form,"titleEn"), titleCrh:value(form,"titleCrh"), excerpt:value(form,"excerpt"), excerptEn:value(form,"excerptEn"), excerptCrh:value(form,"excerptCrh"),
        bodyMd:value(form,"bodyMd"), bodyMdEn:value(form,"bodyMdEn"), bodyMdCrh:value(form,"bodyMdCrh"), workMd:value(form,"workMd"), workMdEn:value(form,"workMdEn"), workMdCrh:value(form,"workMdCrh"), resultsMd:value(form,"resultsMd"), resultsMdEn:value(form,"resultsMdEn"), resultsMdCrh:value(form,"resultsMdCrh"), coverImageUrl:value(form,"coverImageUrl"), coverCropData:projectCrop.getValue(), coverImageUrlEn:value(form,"coverImageUrlEn"), coverCropDataEn:projectCropEn.getValue(),
        partner:value(form,"partner"), partnerEn:value(form,"partnerEn"), partnerCrh:value(form,"partnerCrh"), donor:value(form,"donor"), donorEn:value(form,"donorEn"), donorCrh:value(form,"donorCrh"),
        projectStatus:form.elements.projectStatus.value, startDate:form.elements.startDate.value, endDate:form.elements.endDate.value, periodLabel:value(form,"periodLabel"),
        websiteUrl:value(form,"websiteUrl"), tags:currentProjectTags(),
        isFeatured:form.elements.isFeatured.checked
      };
      if (!body.bodyMd || !body.workMd || !body.resultsMd) { document.getElementById("project-error").textContent="Заповніть поля «Про проєкт», «Що ми робили» та «Результати»."; return; }
      saveButton.disabled = true;
      saveButton.textContent = "Зберігаю…";
      saveStatus.textContent = "Зберігаю зміни. Це може тривати кілька секунд.";
      api(isNew ? "/api/admin/projects" : "/api/admin/projects/" + p.id, { method:isNew ? "POST" : "PUT", body:body })
        .then(loadProjects).then(function () { list("Проєкт збережено."); })
        .catch(function(err){
          saveButton.disabled = false;
          saveButton.textContent = "Зберегти";
          saveStatus.textContent = "";
          document.getElementById("project-error").textContent=err.message;
        });
    });

    var pub=document.getElementById("publish-project");
    if(pub) pub.addEventListener("click", function(){ api("/api/admin/projects/"+p.id+"/publish",{method:"POST"}).then(loadProjects).then(list); });
    var unpub=document.getElementById("unpublish-project");
    if(unpub) unpub.addEventListener("click", function(){ api("/api/admin/projects/"+p.id+"/unpublish",{method:"POST"}).then(loadProjects).then(list); });
    var del=document.getElementById("delete-project");
    if(del) del.addEventListener("click", function(){
      if(!window.confirm("Перемістити цей проєкт у кошик?")) return;
      api("/api/admin/projects/"+p.id,{method:"DELETE"}).then(loadProjects).then(list);
    });
  }

  api("/api/me").then(function (data) {
    state.user = data.user;
    renderUserRow();
    return loadProjects();
  }).then(list).catch(function () {
    root.innerHTML = '<div class="admin-card"><p class="admin-error">Спочатку увійдіть в адмінку новин.</p><p><a class="admin-btn" href="/admin">Увійти</a></p></div>';
  });
})();
