// Ukrainian editorial style: «outer quotes» and “nested quotes”.
// Only matched pairs in prose are changed; code, link targets and apostrophes
// are preserved. Run before HTML escaping, never against rendered attributes.
export function normalizeUkrainianQuotes(value) {
  if (typeof value !== "string" || !/[«»“”„"]/.test(value)) return value;
  const protectedText = [];
  const protectedPattern = /```[^]*?```|~~~[^]*?~~~|`[^`\n]*`|\]\((?:\\.|[^)\\])*\)|<[^>\n]*>|https?:\/\/[^\s<>"«»“”„]+/g;
  const source = value.replace(protectedPattern, (text) => {
    protectedText.push(text);
    return `\uE000${protectedText.length - 1}\uE001`;
  });
  const normalized = source.split(/(\n\s*\n)/).map((paragraph) => {
    const chars = [...paragraph];
    const stack = [];
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      if (!/[«»“”„"]/.test(ch)) continue;
      const top = stack[stack.length - 1];
      const prev = chars[i - 1] || "";
      const next = chars[i + 1] || "";
      let closes = ch === "»" || ch === "”" || (ch === "“" && top?.raw === "„");
      if (ch === '"') {
        // A straight quote following a number outside a quotation can be an
        // inch mark. A straight nested opener follows whitespace/punctuation.
        const opens = next && !/\s/.test(next) && (!prev || /[\s([{—–:*_>]/.test(prev));
        closes = !opens && Boolean(top);
        if (!opens && !closes) continue;
      }
      if (closes) {
        if (!top) continue;
        stack.pop();
        chars[top.index] = top.depth % 2 === 0 ? "«" : "“";
        chars[i] = top.depth % 2 === 0 ? "»" : "”";
      } else {
        stack.push({ index: i, raw: ch, depth: stack.length });
      }
    }
    return chars.join("");
  }).join("");
  return normalized.replace(/\uE000(\d+)\uE001/g, (_, i) => protectedText[Number(i)]);
}

// Use the full organization name in editorial headlines. Product names such
// as ProMedia Report, ProMedia News and ProMedia Events are separate names.
export function normalizeUkrainianTitle(value) {
  const title = normalizeUkrainianQuotes(value);
  if (typeof title !== "string") return title;
  return title.replace(
    /(?<![\p{L}\p{N}@/])(?:(?:ГО|[Гг]ромадська\s+організація)\s+)?(?:«(?:ПроМедіа|ProMedia)»|ПроМедіа(?![\p{L}\p{N}./@-])|ProMedia(?![\p{L}\p{N}./@-]|\s+(?:Report|News|Events|CRM)\b))/gu,
    "ГО «ПроМедіа»"
  );
}

const UKRAINIAN_FIELDS = new Set([
  "title", "excerpt", "bodyMd", "body_md", "workMd", "work_md",
  "resultsMd", "results_md", "partner", "donor", "periodLabel", "period_label"
]);

// Shared by public APIs, exports and the admin editor. Translation fields and
// image/URL/crop data are deliberately outside the editorial field allowlist.
export function ukrainianTypographyReplacer(key, value) {
  if (key === "title") return normalizeUkrainianTitle(value);
  return UKRAINIAN_FIELDS.has(key) ? normalizeUkrainianQuotes(value) : value;
}

export function normalizeUkrainianFields(record) {
  if (!record) return record;
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, ukrainianTypographyReplacer(key, value)]));
}
