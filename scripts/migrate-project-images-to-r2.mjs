import fs from "node:fs/promises";

const API_BASE = process.env.PROJECTS_API_BASE || "https://news.promedia.report";
const ADMIN_EMAIL = process.env.PROMEDIA_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.PROMEDIA_ADMIN_PASSWORD;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("Set PROMEDIA_ADMIN_EMAIL and PROMEDIA_ADMIN_PASSWORD environment variables.");
  process.exit(1);
}

async function request(path, options = {}) {
  const res = await fetch(API_BASE + path, options);
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch {}
  if (!res.ok) throw new Error(data.error || `${res.status} ${res.statusText}`);
  return { data, headers: res.headers };
}

const loginRes = await fetch(API_BASE + "/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
});
if (!loginRes.ok) throw new Error("Login failed: " + loginRes.status);
const setCookie = loginRes.headers.get("set-cookie");
if (!setCookie) throw new Error("No session cookie returned");
const cookie = setCookie.split(";")[0];

const listRes = await request("/api/admin/projects", { headers: { Cookie: cookie } });
const projects = listRes.data.items || [];
let migrated = 0;
let skipped = 0;

for (const project of projects) {
  const oldUrl = project.coverImageUrl || "";
  if (!oldUrl || !/^https?:\/\/promedia\.report\//i.test(oldUrl)) {
    skipped++;
    continue;
  }

  const imageRes = await fetch(oldUrl);
  if (!imageRes.ok) {
    console.warn("Skip image fetch", project.slug, imageRes.status, oldUrl);
    continue;
  }
  const contentType = imageRes.headers.get("content-type") || "image/jpeg";
  const body = await imageRes.arrayBuffer();

  const uploadRes = await fetch(API_BASE + "/api/admin/projects/upload", {
    method: "POST",
    headers: { Cookie: cookie, "Content-Type": contentType },
    body
  });
  const uploadText = await uploadRes.text();
  let uploadData = {};
  try { uploadData = JSON.parse(uploadText); } catch {}
  if (!uploadRes.ok || !uploadData.url) {
    console.warn("Skip upload", project.slug, uploadRes.status, uploadData.error || uploadText);
    continue;
  }

  await request("/api/admin/projects/" + project.id, {
    method: "PUT",
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ coverImageUrl: uploadData.url })
  });

  migrated++;
  console.log("Migrated", project.slug, "->", uploadData.url);
}

console.log(JSON.stringify({ migrated, skipped, total: projects.length }, null, 2));
