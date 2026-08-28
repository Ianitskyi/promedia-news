const UA_TRANSLIT = {
  а: "a", б: "b", в: "v", г: "h", ґ: "g", д: "d", е: "e", є: "ie", ж: "zh",
  з: "z", и: "y", і: "i", ї: "i", й: "i", к: "k", л: "l", м: "m", н: "n",
  о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts",
  ч: "ch", ш: "sh", щ: "shch", ь: "", ю: "iu", я: "ia", "’": "", "'": ""
};

function transliterate(text) {
  return String(text).toLowerCase().split("").map((ch) => (
    Object.prototype.hasOwnProperty.call(UA_TRANSLIT, ch) ? UA_TRANSLIT[ch] : ch
  )).join("");
}

export function slugify(text) {
  return transliterate(text)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "post";
}

export async function uniqueSlug(db, baseText) {
  const base = slugify(baseText);
  let candidate = base;
  let i = 2;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await db.prepare("SELECT id FROM articles WHERE slug = ?").bind(candidate).first();
    if (!existing) return candidate;
    candidate = `${base}-${i}`;
    i += 1;
  }
}
