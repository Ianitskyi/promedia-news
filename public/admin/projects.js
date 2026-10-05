(function () {
  "use strict";
  var root = document.getElementById("projects-admin-root");
  var state = { user: null, projects: [], editing: null };

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (ch) {
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

  function loadProjects() {
    return api("/api/admin/projects").then(function (data) { state.projects = data.items || []; });
  }

  function list() {
    var rows = state.projects.map(function (p) {
      var projectState = p.projectStatus === "completed" ? "завершено" : (p.projectStatus === "upcoming" ? "заплановано" : "триває");
      return "<tr><td>" + (p.isFeatured ? "★ " : "") + esc(p.title) + "</td><td>" + esc(projectState) + "</td><td>" +
        statusBadge(p.publicationStatus) + "</td><td>" + esc(new Date(p.updatedAt).toLocaleDateString("uk-UA")) +
        '</td><td><button class="admin-btn secondary" data-edit="' + p.id + '" type="button">Редагувати</button></td></tr>';
    }).join("");
    root.innerHTML =
      '<div class="admin-row" style="margin-bottom:18px"><button class="admin-btn" id="new-project" type="button">+ Новий проєкт</button><button class="admin-btn secondary" id="translate-projects" type="button">Перекласти відсутні EN/QT</button><span class="admin-hint" id="translate-projects-status"></span></div>' +
      '<div class="admin-card"><h1 style="font-family:var(--serif);color:var(--ink);margin-top:0">Проєкти</h1>' +
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
            translateBtn.disabled = false;
            return loadProjects().then(list);
          }
          status.textContent = "Перекладено: " + (data.translated || "") + ". Залишилось: " + data.remaining;
          next();
        }).catch(function (err) {
          status.textContent = err.message;
          translateBtn.disabled = false;
        });
      }
      status.textContent = "Перекладаю…";
      next();
    });
    Array.prototype.forEach.call(root.querySelectorAll("[data-edit]"), function (btn) {
      btn.addEventListener("click", function () {
        var id = Number(btn.dataset.edit);
        editor(state.projects.find(function (p) { return p.id === id; }) || null);
      });
    });
  }

  function value(form, name) { return form.elements[name].value.trim(); }

  function editor(project) {
    var p = project || {
      title:"",titleEn:"",titleCrh:"",excerpt:"",excerptEn:"",excerptCrh:"",bodyMd:"",bodyMdEn:"",bodyMdCrh:"",coverImageUrl:"",
      partner:"",partnerEn:"",partnerCrh:"",donor:"",donorEn:"",donorCrh:"",projectStatus:"active",startDate:"",endDate:"",
      websiteUrl:"",tags:[],isFeatured:false,publicationStatus:"draft"
    };
    var isNew = !project;
    root.innerHTML =
      '<p><button class="admin-btn secondary" id="back-projects" type="button">← До списку проєктів</button></p>' +
      '<div class="admin-card"><h1 style="font-family:var(--serif);color:var(--ink);margin-top:0">' + (isNew ? "Новий проєкт" : "Редагування проєкту") + '</h1>' +
      '<p class="admin-error" id="project-error"></p>' +
      '<form class="admin-form" id="project-form">' +
      '<div class="admin-field"><label>Назва (укр)*</label><input name="title" required value="' + esc(p.title) + '" /></div>' +
      '<div class="admin-field"><label>Назва (англ)</label><input name="titleEn" value="' + esc(p.titleEn) + '" /></div>' +
      '<div class="admin-field"><label>Назва (кримськотатарська)</label><input name="titleCrh" value="' + esc(p.titleCrh) + '" /></div>' +
      '<div class="admin-field"><label>Короткий опис (укр)</label><textarea name="excerpt">' + esc(p.excerpt) + '</textarea></div>' +
      '<div class="admin-field"><label>Короткий опис (англ)</label><textarea name="excerptEn">' + esc(p.excerptEn) + '</textarea></div>' +
      '<div class="admin-field"><label>Короткий опис (кримськотатарська)</label><textarea name="excerptCrh">' + esc(p.excerptCrh) + '</textarea></div>' +
      '<div class="admin-field"><label>Повний опис (укр, Markdown)*</label><textarea name="bodyMd" rows="12" required>' + esc(p.bodyMd) + '</textarea></div>' +
      '<div class="admin-field"><label>Повний опис (англ, Markdown)</label><textarea name="bodyMdEn" rows="12">' + esc(p.bodyMdEn) + '</textarea></div>' +
      '<div class="admin-field"><label>Повний опис (кримськотатарська, Markdown)</label><textarea name="bodyMdCrh" rows="12">' + esc(p.bodyMdCrh) + '</textarea></div>' +
      '<div class="admin-field"><label>Обкладинка</label><input type="file" id="project-cover" accept="image/*" />' +
      '<input type="hidden" name="coverImageUrl" value="' + esc(p.coverImageUrl) + '" />' +
      (p.coverImageUrl ? '<img class="admin-cover-preview" id="project-cover-preview" src="' + esc(p.coverImageUrl) + '" />' : '<img class="admin-cover-preview" id="project-cover-preview" style="display:none" />') + '</div>' +
      '<div class="admin-field"><label>Статус проєкту</label><select name="projectStatus">' +
      '<option value="upcoming"' + (p.projectStatus === "upcoming" ? " selected" : "") + '>Заплановано</option>' +
      '<option value="active"' + (p.projectStatus === "active" ? " selected" : "") + '>Триває</option>' +
      '<option value="completed"' + (p.projectStatus === "completed" ? " selected" : "") + '>Завершено</option></select></div>' +
      '<div class="admin-row"><div class="admin-field"><label>Дата початку</label><input type="date" name="startDate" value="' + esc(p.startDate || "") + '" /></div>' +
      '<div class="admin-field"><label>Дата завершення</label><input type="date" name="endDate" value="' + esc(p.endDate || "") + '" /></div></div>' +
      '<div class="admin-field"><label>Партнер (укр)</label><input name="partner" value="' + esc(p.partner) + '" /></div>' +
      '<div class="admin-field"><label>Партнер (англ)</label><input name="partnerEn" value="' + esc(p.partnerEn) + '" /></div>' +
      '<div class="admin-field"><label>Партнер (кримськотатарська)</label><input name="partnerCrh" value="' + esc(p.partnerCrh) + '" /></div>' +
      '<div class="admin-field"><label>Донор (укр)</label><input name="donor" value="' + esc(p.donor) + '" /></div>' +
      '<div class="admin-field"><label>Донор (англ)</label><input name="donorEn" value="' + esc(p.donorEn) + '" /></div>' +
      '<div class="admin-field"><label>Донор (кримськотатарська)</label><input name="donorCrh" value="' + esc(p.donorCrh) + '" /></div>' +
      '<div class="admin-field"><label>Посилання на сайт/матеріали проєкту</label><input type="url" name="websiteUrl" value="' + esc(p.websiteUrl) + '" /></div>' +
      '<div class="admin-field"><label>Теги (через кому)</label><input name="tags" value="' + esc((p.tags || []).join(", ")) + '" /></div>' +
      '<div class="admin-field"><label style="display:flex;gap:10px;align-items:center"><input type="checkbox" name="isFeatured" style="width:auto"' + (p.isFeatured ? " checked" : "") + ' /> Показувати як вибраний проєкт</label></div>' +
      '<div class="admin-row"><button class="admin-btn" type="submit">Зберегти</button>' +
      (!isNew && p.publicationStatus === "published" ? '<button class="admin-btn secondary" id="unpublish-project" type="button">Зняти з публікації</button>' : '') +
      (!isNew && p.publicationStatus !== "published" ? '<button class="admin-btn" id="publish-project" type="button">Опублікувати</button>' : '') +
      (!isNew ? '<button class="admin-btn danger" id="delete-project" type="button">Видалити</button>' : '') +
      '</div></form></div>';

    document.getElementById("back-projects").addEventListener("click", list);
    var form = document.getElementById("project-form");
    document.getElementById("project-cover").addEventListener("change", function (e) {
      var file = e.target.files && e.target.files[0]; if (!file) return;
      fetch("/api/admin/projects/upload", { method:"POST", credentials:"include", headers:{"Content-Type":file.type}, body:file })
        .then(function (r) { return r.json().then(function(d){ if(!r.ok) throw new Error(d.error || "Upload failed"); return d; }); })
        .then(function (d) {
          form.elements.coverImageUrl.value = d.url;
          var img=document.getElementById("project-cover-preview"); img.src=d.url; img.style.display="";
        }).catch(function(err){ document.getElementById("project-error").textContent=err.message; });
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var body = {
        title:value(form,"title"), titleEn:value(form,"titleEn"), titleCrh:value(form,"titleCrh"), excerpt:value(form,"excerpt"), excerptEn:value(form,"excerptEn"), excerptCrh:value(form,"excerptCrh"),
        bodyMd:value(form,"bodyMd"), bodyMdEn:value(form,"bodyMdEn"), bodyMdCrh:value(form,"bodyMdCrh"), coverImageUrl:value(form,"coverImageUrl"),
        partner:value(form,"partner"), partnerEn:value(form,"partnerEn"), partnerCrh:value(form,"partnerCrh"), donor:value(form,"donor"), donorEn:value(form,"donorEn"), donorCrh:value(form,"donorCrh"),
        projectStatus:form.elements.projectStatus.value, startDate:form.elements.startDate.value, endDate:form.elements.endDate.value,
        websiteUrl:value(form,"websiteUrl"), tags:value(form,"tags").split(",").map(function(x){return x.trim();}).filter(Boolean),
        isFeatured:form.elements.isFeatured.checked
      };
      api(isNew ? "/api/admin/projects" : "/api/admin/projects/" + p.id, { method:isNew ? "POST" : "PUT", body:body })
        .then(loadProjects).then(list).catch(function(err){ document.getElementById("project-error").textContent=err.message; });
    });

    var pub=document.getElementById("publish-project");
    if(pub) pub.addEventListener("click", function(){ api("/api/admin/projects/"+p.id+"/publish",{method:"POST"}).then(loadProjects).then(list); });
    var unpub=document.getElementById("unpublish-project");
    if(unpub) unpub.addEventListener("click", function(){ api("/api/admin/projects/"+p.id+"/unpublish",{method:"POST"}).then(loadProjects).then(list); });
    var del=document.getElementById("delete-project");
    if(del) del.addEventListener("click", function(){
      if(!window.confirm("Видалити цей проєкт?")) return;
      api("/api/admin/projects/"+p.id,{method:"DELETE"}).then(loadProjects).then(list);
    });
  }

  api("/api/me").then(function (data) {
    state.user = data.user;
    return loadProjects();
  }).then(list).catch(function () {
    root.innerHTML = '<div class="admin-card"><p class="admin-error">Спочатку увійдіть в адмінку новин.</p><p><a class="admin-btn" href="/admin">Увійти</a></p></div>';
  });
})();