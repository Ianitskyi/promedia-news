import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { missingPersonTags, addPersonTags } from "../src/lib/personTags.js";

const people = [
  { slug: "sevgil-musaieva", name: { uk: "Севгіль Мусаєва", en: "Sevgil Musaieva" }, aliases: [] },
  { slug: "mykhailo-tkach", name: { uk: "Михайло Ткач", en: "Mykhailo Tkach" }, aliases: ["Ткач Михайло"] },
  { slug: "nataliia-humeniuk", name: { uk: "Наталія Гуменюк", en: "Nataliia Humeniuk" }, aliases: ["Наталка Гуменюк"] },
];

test("adds a tag for a bold name with a dossier", () => {
  const a = { tags: ["Заяви"], bodyMd: "Заявила головна редакторка **Севгіль Мусаєва**." };
  assert.deepEqual(addPersonTags(a, people), ["Севгіль Мусаєва"]);
  assert.deepEqual(a.tags, ["Заяви", "Севгіль Мусаєва"]);
});

test("recognises declined forms", () => {
  const a = { tags: [], bodyMd: "Колонка **Севгіль Мусаєвої** і розслідування **Михайла Ткача**, книжка **Наталії Гуменюк**." };
  assert.deepEqual(missingPersonTags(a, people), ["Севгіль Мусаєва", "Михайло Ткач", "Наталія Гуменюк"]);
});

test("keeps existing tags and aliases, no duplicates", () => {
  const a = { tags: ["Наталка Гуменюк", "Михайло Ткач"], bodyMd: "**Наталія Гуменюк** і **Михайло Ткач**." };
  assert.deepEqual(missingPersonTags(a, people), []);
});

test("ignores non-bold names, notes under the thin line and quotes", () => {
  const a = { tags: [], bodyMd: "Севгіль Мусаєва пише.\n\n> **Михайло Ткач** сказав\n\n---\n\n*Фото: **Наталія Гуменюк**.*" };
  assert.deepEqual(missingPersonTags(a, people), []);
});

test("uses the English body too", () => {
  const a = { tags: [], bodyMd: "Текст.", bodyMdEn: "Editor-in-chief **Sevgil Musaieva** wrote." };
  assert.deepEqual(missingPersonTags(a, people), ["Севгіль Мусаєва"]);
});

test("real dossiers: the 28.11 statement gets Musaieva without the tag", () => {
  const real = readdirSync("people/data").filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(`people/data/${f}`, "utf8")));
  const a = JSON.parse(readFileSync("content/articles/2026-11-28-go-promedia-zaklykaie-vladu-rozsliduvaty-tysk-na-ukrainsku-pravdu.json", "utf8"));
  a.tags = a.tags.filter((t) => t !== "Севгіль Мусаєва");
  assert.ok(missingPersonTags(a, real).includes("Севгіль Мусаєва"));
});
