import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { runThreadsAutopost, buildPostText, pickImage, refreshThreadsToken } from "../src/lib/threads.js";

function d1(db) {
  return {
    prepare(sql) {
      let args = [];
      const st = {
        bind(...a) { args = a; return st; },
        async run() { db.prepare(sql).run(...args); return { success: true }; },
        async all() { return { results: db.prepare(sql).all(...args) }; },
        async first() { return db.prepare(sql).get(...args) ?? null; }
      };
      return st;
    }
  };
}

function setup() {
  const db = new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE articles (slug TEXT PRIMARY KEY, title TEXT, excerpt TEXT, status TEXT, deleted_at TEXT,
    cover_image_url TEXT, cover_crop_data TEXT, published_at TEXT, updated_at TEXT)`);
  const add = (slug, o = {}) => db.prepare(
    "INSERT INTO articles VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(slug, o.title || "Заголовок " + slug, o.excerpt || "Лід новини.", o.status || "published", o.deleted || null,
    o.cover === undefined ? "/img-storage/articles/" + slug + ".jpg" : o.cover, null, o.published, o.updated || o.published);
  const env = { DB: d1(db), THREADS_USER_ID: "123", THREADS_ACCESS_TOKEN: "token-abcdefghijkl" };
  const calls = [];
  const fakeFetch = async (url, init = {}) => {
    calls.push({ url: new URL(url), method: init.method || "GET" });
    const u = new URL(url);
    let body = {};
    if (u.pathname.endsWith("/threads")) body = { id: "container-" + calls.length };
    else if (u.pathname.endsWith("/threads_publish")) body = { id: "media-1" };
    else if (u.pathname.includes("media-1")) body = { permalink: "https://www.threads.com/@promedia/post/x" };
    else if (u.pathname.endsWith("refresh_access_token")) body = { access_token: "fresh-token" };
    return new Response(JSON.stringify(body), { status: 200 });
  };
  return { db, add, env, calls, fakeFetch };
}

const at = iso => new Date(iso);

test("First run only records the start; old news is never posted", async () => {
  const { add, env, calls, fakeFetch } = setup();
  add("old", { published: "2026-11-20T10:00:00Z" });
  const r = await runThreadsAutopost(env, at("2026-11-25T12:00:00Z"), fakeFetch);
  assert.ok(r.started);
  const r2 = await runThreadsAutopost(env, at("2026-11-25T12:05:00Z"), fakeFetch);
  assert.deepEqual(r2, { idle: true });
  assert.equal(calls.length, 0);
});

test("Waits 2 hours after the last edit, then creates and publishes once", async () => {
  const { db, add, env, calls, fakeFetch } = setup();
  await runThreadsAutopost(env, at("2026-11-25T08:00:00Z"), fakeFetch);
  add("fresh", { published: "2026-11-25T09:00:00Z", updated: "2026-11-25T10:30:00Z" });
  assert.deepEqual(await runThreadsAutopost(env, at("2026-11-25T12:00:00Z"), fakeFetch), { idle: true });
  assert.deepEqual(await runThreadsAutopost(env, at("2026-11-25T12:31:00Z"), fakeFetch), { container: "fresh" });
  const create = calls[0].url;
  assert.equal(create.searchParams.get("media_type"), "IMAGE");
  assert.equal(create.searchParams.get("image_url"), "https://news.promedia.report/img-storage/articles/fresh.jpg");
  assert.match(create.searchParams.get("text"), /https:\/\/news\.promedia\.report\/article\/fresh$/);
  const pub = await runThreadsAutopost(env, at("2026-11-25T12:36:00Z"), fakeFetch);
  assert.equal(pub.posted, "fresh");
  assert.equal(pub.permalink, "https://www.threads.com/@promedia/post/x");
  assert.deepEqual(await runThreadsAutopost(env, at("2026-11-25T12:41:00Z"), fakeFetch), { idle: true });
  assert.equal(db.prepare("SELECT status FROM threads_posts").get().status, "posted");
});

test("Forced slug posts right away, even if older than the start", async () => {
  const { add, env, fakeFetch } = setup();
  await runThreadsAutopost(env, at("2026-11-26T10:15:00Z"), fakeFetch);
  add("promedia-zapustylo-nimetsku-versiiu-saitu", { published: "2026-11-26T10:08:00Z", updated: "2026-11-26T11:56:00Z" });
  add("other-old", { published: "2026-11-26T10:00:00Z" });
  assert.deepEqual(await runThreadsAutopost(env, at("2026-11-26T12:50:00Z"), fakeFetch), { container: "promedia-zapustylo-nimetsku-versiiu-saitu" });
  assert.equal((await runThreadsAutopost(env, at("2026-11-26T12:55:00Z"), fakeFetch)).posted, "promedia-zapustylo-nimetsku-versiiu-saitu");
  assert.deepEqual(await runThreadsAutopost(env, at("2026-11-26T13:00:00Z"), fakeFetch), { idle: true });
});

test("No cover, drafts and deleted news are skipped", async () => {
  const { add, env, fakeFetch } = setup();
  await runThreadsAutopost(env, at("2026-11-25T08:00:00Z"), fakeFetch);
  add("nocover", { published: "2026-11-25T09:00:00Z", cover: "" });
  add("draft", { published: "2026-11-25T09:00:00Z", status: "draft" });
  add("deleted", { published: "2026-11-25T09:00:00Z", deleted: "2026-11-25T09:30:00Z" });
  assert.deepEqual(await runThreadsAutopost(env, at("2026-11-25T14:00:00Z"), fakeFetch), { idle: true });
});

test("External or webp covers fall back to a link card", async () => {
  assert.equal(pickImage({ cover_image_url: "https://images.unsplash.com/photo?ixlib=rb&u=1" }), null);
  assert.equal(pickImage({ cover_image_url: "/img-storage/a.webp" }), null);
  assert.equal(pickImage({ cover_image_url: "/img-storage/a.PNG" }), "https://news.promedia.report/img-storage/a.PNG");
});

test("Post text fits 500 characters and keeps the link", () => {
  const text = buildPostText({ slug: "s", title: "Т".repeat(120), excerpt: "слово ".repeat(200) }, { withLink: true });
  assert.ok(Array.from(text).length <= 500);
  assert.ok(text.endsWith("https://news.promedia.report/article/s"));
  assert.ok(text.includes("…"));
});

test("Errors are retried three times, then left alone", async () => {
  const { db, add, env } = setup();
  const failing = async () => new Response(JSON.stringify({ error: { message: "bad image" } }), { status: 400 });
  await runThreadsAutopost(env, at("2026-11-25T08:00:00Z"), failing);
  add("broken", { published: "2026-11-25T09:00:00Z" });
  for (const t of ["12:00", "12:05", "12:10", "12:15"]) await runThreadsAutopost(env, at(`2026-11-25T${t}:00Z`), failing);
  const row = db.prepare("SELECT status, attempts, error FROM threads_posts").get();
  assert.deepEqual({ ...row }, { status: "error", attempts: 3, error: "bad image" });
});

test("Account ID is looked up once when only the token is set", async () => {
  const { add, env, calls } = setup();
  delete env.THREADS_USER_ID;
  const f = async (url, init = {}) => {
    calls.push(new URL(url));
    const u = new URL(url);
    const body = u.pathname.endsWith("/me") ? { id: "777", username: "promediaua" } : { id: "c1" };
    return new Response(JSON.stringify(body), { status: 200 });
  };
  await runThreadsAutopost(env, at("2026-11-25T08:00:00Z"), f);
  add("n", { published: "2026-11-25T09:00:00Z" });
  await runThreadsAutopost(env, at("2026-11-25T12:00:00Z"), f);
  await runThreadsAutopost(env, at("2026-11-25T12:05:00Z"), f);
  assert.equal(calls.filter(u => u.pathname.endsWith("/me")).length, 1);
  assert.ok(calls.some(u => u.pathname === "/v1.0/777/threads"));
});

test("Token is refreshed weekly", async () => {
  const { env, fakeFetch, calls } = setup();
  await runThreadsAutopost(env, at("2026-11-25T08:00:00Z"), fakeFetch);
  // Свіжий токен із секрету не чіпаємо тиждень, потім продовжуємо.
  assert.equal(await refreshThreadsToken(env, at("2026-11-26T08:00:00Z"), fakeFetch), null);
  assert.equal(await refreshThreadsToken(env, at("2026-12-04T08:00:00Z"), fakeFetch), true);
  assert.equal(calls.length, 1);
  assert.equal(await refreshThreadsToken(env, at("2026-12-05T08:00:00Z"), fakeFetch), null);
});
