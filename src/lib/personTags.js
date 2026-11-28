// Теги людей із досьє (правило Андрія Яніцького, 28.11.2026).
// Картку «Люди в матеріалі» під новиною сайт малює лише за тегом з ім'ям людини (src/lib/render.js,
// peopleBox). Щоб картка не випадала, коли тег забули, скрипт публікації сам додає тег (name.uk досьє)
// для кожної людини з досьє, чиє ім'я стоїть у тексті напівжирним (так за стандартом пишемо першу
// згадку). Відмінки розпізнаються: «**Давида Арахамію**», «**Севгіль Мусаєвої**».
// Не чіпаємо рядки під тонкою лінією (службові примітки) і цитати.

const tagKey = (t) => String(t || "").normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("uk-UA");
const norm = (v) => String(v || "").replace(/[’ʼ`]/g, "'").replace(/\s+/g, " ").toLowerCase().trim();

function wordMatches(nameWord, textWord) {
  if (nameWord === textWord) return true;
  if (nameWord.length < 3) return false;
  const stemLen = Math.max(3, nameWord.length - (nameWord.length <= 4 ? 1 : 2));
  return textWord.startsWith(nameWord.slice(0, stemLen)) && Math.abs(textWord.length - nameWord.length) <= 3;
}

function nameVariants(person) {
  const names = [person.name?.uk, person.name?.en, ...(person.aliases || [])];
  // Форми з ініціалами (лише в aliases) не відмінюються — пропускаємо.
  return names.filter((n) => n && !/(^|\s)\S\.(\s|$)/.test(n)).map((n) => norm(n).split(" "));
}

function personMatches(person, text) {
  const words = norm(text).replace(/[«»"“”„.,:;!?()]/g, "").split(" ").filter(Boolean);
  if (words.length < 2) return false;
  return nameVariants(person).some((nw) => nw.length === words.length && nw.every((w, i) => wordMatches(w, words[i])));
}

function boldNames(md) {
  const main = String(md || "").split(/\n-{3,}\n/)[0];
  const lines = main.split("\n").filter((l) => !/^\s*>/.test(l));
  return [...lines.join("\n").matchAll(/\*\*([^*\n]{3,80})\*\*/g)].map((m) => m[1].replace(/\[([^\]]+)\]\([^)]*\)/g, "$1"));
}

// Повертає імена (name.uk) людей із досьє, яких немає в тегах, хоча вони стоять у тексті напівжирним.
export function missingPersonTags(article, people) {
  const tags = new Set((article.tags || []).map(tagKey));
  const has = (p) => [p.name?.uk, ...(p.aliases || [])].some((n) => tags.has(tagKey(n)));
  const bold = ["bodyMd", "bodyMdEn"].flatMap((k) => boldNames(article[k]));
  const out = [];
  for (const p of people) {
    if (!p?.name?.uk || has(p) || out.includes(p.name.uk)) continue;
    if (bold.some((b) => personMatches(p, b))) out.push(p.name.uk);
  }
  return out;
}

// Додає відсутні теги до article.tags (змінює об'єкт) і повертає список доданих.
export function addPersonTags(article, people) {
  const missing = missingPersonTags(article, people);
  if (missing.length) article.tags = [...(article.tags || []), ...missing];
  return missing;
}
