// Озвучка статей синтезатором мовлення Google Cloud Text-to-Speech (українська й англійська).
// Запускається в GitHub Actions (tts.yml) з ключем GOOGLE_TTS_API_KEY.
// Озвучуємо матеріали рубрики «Статті» (новини — ні). Готові MP3 лежать у public/audio/<slug>-<lang>.mp3,
// а src/data/tts-index.js каже сайту, для яких статей і мов є запис (і хеш тексту, щоб
// перегенерувати озвучку лише тоді, коли текст змінився).
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

const KEY = process.env.GOOGLE_TTS_API_KEY;
if (!KEY) { console.log("GOOGLE_TTS_API_KEY is not set; skipping."); process.exit(0); }

const DIR = "content/articles";
const AUDIO_DIR = "public/audio";
const INDEX = "src/data/tts-index.js";
const LANGS = { uk: { code: "uk-UA", title: "title", body: "bodyMd" }, en: { code: "en-GB", title: "titleEn", body: "bodyMdEn" } };
const API = "https://texttospeech.googleapis.com/v1";

function loadIndex() {
  if (!existsSync(INDEX)) return {};
  const m = readFileSync(INDEX, "utf8").match(/export const TTS = (\{[\s\S]*\});/);
  return m ? JSON.parse(m[1]) : {};
}

// Текст для читання: заголовок + тіло без розмітки; без приміток під тонкою лінією,
// без фото, відео, аудіо й підписів під ними.
export function speakableText(title, md) {
  const lines = String(md || "").replace(/\r\n/g, "\n").split("\n");
  const cut = lines.findIndex((l) => /^(-{3,}|\*{3,})$/.test(l.trim()));
  const body = (cut >= 0 ? lines.slice(0, cut) : lines);
  const out = [];
  for (let i = 0; i < body.length; i++) {
    const line = body[i].trim();
    if (/^!\[[^\]]*\]\([^)]+\)$/.test(line) || /^\[(youtube|audio)\]\([^)]+\)$/i.test(line)) {
      if (/^\*[^*].*\*$/.test((body[i + 1] || "").trim())) i++;
      continue;
    }
    if (/^\*[^*].*\*$/.test(line) && /^(Перша частина|Part one|Birinci qısım)/.test(line.slice(1))) continue;
    out.push(line
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/==([^=]+)==/g, "$1")
      .replace(/^#{1,6}\s+/, "")
      .replace(/^>\s?/, "")
      .replace(/^[-*]\s+/, "")
      .replace(/[*_`]/g, ""));
  }
  return [title, ...out].join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// Google приймає до 5000 байтів за запит: ріжемо по абзацах і реченнях.
function chunks(text, maxBytes = 4200) {
  const parts = [];
  let current = "";
  const pieces = text.split(/(?<=[.!?…»”])\s+|\n+/).filter(Boolean);
  for (const piece of pieces) {
    const candidate = current ? current + " " + piece : piece;
    if (Buffer.byteLength(candidate, "utf8") > maxBytes && current) { parts.push(current); current = piece; }
    else current = candidate;
  }
  if (current) parts.push(current);
  return parts;
}

async function pickVoice(code) {
  const res = await fetch(`${API}/voices?languageCode=${code}&key=${KEY}`);
  if (!res.ok) throw Error(`voices ${code}: ${res.status} ${await res.text()}`);
  const voices = (await res.json()).voices || [];
  const rank = (name) => /Chirp3-HD/.test(name) ? 0 : /Neural2/.test(name) ? 1 : /Wavenet/.test(name) ? 2 : /Standard/.test(name) ? 3 : 4;
  const preferred = { "uk-UA": ["Chirp3-HD-Charon", "Chirp3-HD-Kore"], "en-GB": ["Chirp3-HD-Charon", "Neural2-B"] }[code] || [];
  const exact = voices.find((v) => preferred.some((p) => v.name.endsWith(p)));
  const voice = exact || voices.filter((v) => v.languageCodes.includes(code)).sort((a, b) => rank(a.name) - rank(b.name))[0];
  if (!voice) throw Error("No voice for " + code);
  return voice.name;
}

async function synthesize(text, code, voice) {
  const buffers = [];
  for (const part of chunks(text)) {
    const res = await fetch(`${API}/text:synthesize?key=${KEY}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: { text: part }, voice: { languageCode: code, name: voice }, audioConfig: { audioEncoding: "MP3", speakingRate: 1.0 } })
    });
    if (!res.ok) throw Error(`synthesize ${code}: ${res.status} ${await res.text()}`);
    buffers.push(Buffer.from((await res.json()).audioContent, "base64"));
  }
  return Buffer.concat(buffers);
}

const index = loadIndex();
mkdirSync(AUDIO_DIR, { recursive: true });
let changed = false;
for (const f of readdirSync(DIR).filter((x) => x.endsWith(".json")).sort()) {
  const a = JSON.parse(readFileSync(join(DIR, f), "utf8"));
  // Озвучуємо лише статті (рубрика «Статті»); новини — ні. "tts": false вимикає, "tts": true вмикає вручну.
  const isArticle = Array.isArray(a.tags) && a.tags.includes("Статті");
  if (a.tts === false || !(isArticle || a.tts === true)) continue;
  for (const [lang, cfg] of Object.entries(LANGS)) {
    if (!a[cfg.body]) continue;
    const text = speakableText(a[cfg.title] || a.title, a[cfg.body]);
    const hash = createHash("sha256").update(text).digest("hex").slice(0, 16);
    const file = `${a.slug}-${lang}.mp3`;
    const entry = index[a.slug]?.[lang];
    if (entry && entry.hash === hash && existsSync(join(AUDIO_DIR, file))) continue;
    const voice = await pickVoice(cfg.code);
    const audio = await synthesize(text, cfg.code, voice);
    writeFileSync(join(AUDIO_DIR, file), audio);
    // MP3 від Google — 32 кбіт/с; тривалість рахуємо з розміру файлу.
    const minutes = Math.max(1, Math.round(audio.length * 8 / 32000 / 60));
    index[a.slug] = { ...(index[a.slug] || {}), [lang]: { file: `/audio/${file}`, minutes, voice, hash } };
    console.log(`TTS ${a.slug} [${lang}] ${voice}: ${text.length} chars, ~${minutes} min`);
    changed = true;
  }
}
if (changed) {
  writeFileSync(INDEX, "// Згенеровано scripts/tts-generate.mjs — не редагуйте вручну.\nexport const TTS = " + JSON.stringify(index, null, 2) + ";\n");
}
console.log(changed ? "TTS index updated." : "Nothing to synthesize.");
