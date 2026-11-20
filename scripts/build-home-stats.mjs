// Рахує цифри для блоку «У цифрах» на promedia.report і пише main-site/static/data/stats.json.
// Джерела — ті самі дані, з яких працюють розділи: Карта спільнот, Атлас медіа, Рейтинг журфаків, Люди.
// Якщо якесь джерело недоступне, лишаємо попереднє значення (або цифру, вписану в HTML).
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from "node:fs";

const OUT = "main-site/static/data/stats.json";
const RAW = "https://raw.githubusercontent.com";
const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};
const stats = { ...prev };

async function json(url) {
  const res = await fetch(url, { headers: { "user-agent": "promedia-home-stats" } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}
async function step(key, fn) {
  try { const n = await fn(); if (Number.isFinite(n) && n > 0) stats[key] = n; console.log(key, n); }
  catch (e) { console.warn(`::warning::${key}: ${e.message}`); }
}

await step("communities", async () => {
  const d = await json(`${RAW}/Ianitskyi/promedia-communities/main/data/communities.json`);
  return d.filter(m => m && m.status === "approved").length;
});
await step("atlas", async () => {
  const d = await json(`${RAW}/Ianitskyi/promedia-atlas/main/public/data/registry.json`);
  return Array.isArray(d.media) ? d.media.length : NaN;
});
await step("universities", async () => {
  // Останній рік, для якого вже є підсумковий файл рейтингу.
  for (let y = new Date().getUTCFullYear(); y >= 2026; y--) {
    try {
      const d = await json(`${RAW}/ProMedia-Ukraine/Journalism2026/main/data/${y}-current.json`);
      if (Array.isArray(d.bachelor) && d.bachelor.length) return d.bachelor.length;
    } catch {}
  }
  return NaN;
});
await step("people", async () => readdirSync("people/data").filter(f => f.endsWith(".json")).length);

stats.updatedAt = new Date().toISOString();
mkdirSync("main-site/static/data", { recursive: true });
writeFileSync(OUT, JSON.stringify(stats, null, 2) + "\n");
console.log(stats);
