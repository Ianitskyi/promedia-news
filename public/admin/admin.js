(function () {
  "use strict";

  var root = document.getElementById("admin-root");
  var userRow = document.getElementById("admin-user-row");
  var state = { user: null, articles: [], users: [], mediaCatalog: null, richEditors: [] };

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
