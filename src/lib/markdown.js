// Мінімальний markdown -> HTML конвертер без залежностей.
// Весь вхідний текст спершу екранується як plain text, тому довільний
// HTML/скрипти в тілі статті не можуть виконатись (XSS-safe за дизайном) —
// підтримуються лише явно розпізнані markdown-конструкції нижче.

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

function inline(text) {
  let out = escapeHtml(text);
  // зображення: ![alt](url)
  out = out.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, '<img src="$2" alt="$1" loading="lazy" />');
  // посилання: [text](url)
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  // жирний / курсив
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");
  return out;
}

export function markdownToHtml(md) {
  if (!md) return "";
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const htmlBlocks = [];
  let paragraph = [];
  let list = null; // { type: 'ul' | 'ol', items: [] }

  function flushParagraph() {
    if (paragraph.length) {
      htmlBlocks.push("<p>" + inline(paragraph.join(" ")) + "</p>");
      paragraph = [];
    }
  }
  function flushList() {
    if (list) {
      const tag = list.type;
      htmlBlocks.push(`<${tag}>` + list.items.map((it) => "<li>" + inline(it) + "</li>").join("") + `</${tag}>`);
      list = null;
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line === "") {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      htmlBlocks.push(`<h${level}>` + inline(heading[2]) + `</h${level}>`);
      continue;
    }

    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      flushParagraph();
      flushList();
      htmlBlocks.push("<blockquote><p>" + inline(quote[1]) + "</p></blockquote>");
      continue;
    }

    const ulItem = line.match(/^[-*]\s+(.*)$/);
    if (ulItem) {
      flushParagraph();
      if (!list || list.type !== "ul") { flushList(); list = { type: "ul", items: [] }; }
      list.items.push(ulItem[1]);
      continue;
    }

    const olItem = line.match(/^\d+\.\s+(.*)$/);
    if (olItem) {
      flushParagraph();
      if (!list || list.type !== "ol") { flushList(); list = { type: "ol", items: [] }; }
      list.items.push(olItem[1]);
      continue;
    }

    flushList();
    paragraph.push(line);
  }
  flushParagraph();
  flushList();

  return htmlBlocks.join("\n");
}

// Проста версія без розмітки — для excerpt/OG-опису, коли він не задан вручну.
export function markdownToPlainText(md, maxLength) {
  const text = String(md ?? "")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#>*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (maxLength && text.length > maxLength) {
    return text.slice(0, maxLength - 1).trim() + "…";
  }
  return text;
}
