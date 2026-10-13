import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const db = "promedia-news";
const expectedId = "b5471e04-ad38-45d7-a306-0c6f8c47c14b";
const expected = {
  articles: ["cover_crop_data", "cover_crop_data_en"],
  projects: ["cover_crop_data", "cover_crop_data_en", "cover_image_url_en"]
};
const migration = "migrations/0012_cover_crop_positions.sql";
const sql = readFileSync(migration, "utf8");
if (!sql.includes("ALTER TABLE articles ADD COLUMN cover_crop_data") ||
    !sql.includes("ALTER TABLE projects ADD COLUMN cover_image_url_en")) {
  throw Error("Migration file does not match the expected cover-crop migration");
}
function wrangler(args) {
  return execFileSync("npx", ["wrangler", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], timeout: 180000 });
}
function queryColumns(table) {
  const output = wrangler(["d1", "execute", db, "--remote", "--command",
    "SELECT name FROM pragma_table_info('" + table + "')"]);
  const start = output.search(/\[\s*\{\s*"results"\s*:/);
  if (start < 0) throw Error("Unable to identify D1 response for " + table);
  const response = JSON.parse(output.slice(start).trim());
  if (response.length !== 1 || !response[0].success || !Array.isArray(response[0].results))
    throw Error("Unexpected D1 schema inspection response for " + table);
  const names = response[0].results.map(row => row.name);
  if (!names.length) throw Error("Table does not exist: " + table);
  return names;
}
const info = JSON.parse(wrangler(["d1", "info", db, "--json"]));
if (info.name !== db || (info.uuid && info.uuid !== expectedId)) {
  throw Error("Cloudflare D1 account points to an unexpected database");
}
console.log("Target D1 database:", db, expectedId);
let present = 0;
for (const [table, columns] of Object.entries(expected)) {
  const all = queryColumns(table);
  const matches = columns.filter(c => all.includes(c));
  present += matches.length;
  console.log(table + ": " + matches.length + "/" + columns.length + " cover columns present");
}
if (present === 5) {
  console.log("Migration already applied; no changes made.");
  process.exit(0);
}
if (present !== 0) {
  throw Error("Partial cover migration detected (" + present + "/5); stopped without writing");
}
const bookmark = wrangler(["d1", "time-travel", "info", db]);
const match = bookmark.match(/current bookmark is '([^']+)'/);
if (!match) throw Error("Cannot capture a pre-migration Time Travel bookmark; stopped");
console.log("Pre-migration recovery bookmark:", match[1]);
console.log("Applying exactly migrations/0012_cover_crop_positions.sql");
wrangler(["d1", "execute", db, "--remote", "--file=" + migration]);
let verified = 0;
for (const [table, columns] of Object.entries(expected)) {
  const all = queryColumns(table);
  const missing = columns.filter(c => !all.includes(c));
  if (missing.length) throw Error("Migration verification FAILED: " + table + " missing " + missing.join(", "));
  verified += columns.length;
}
console.log("SUCCESS: all " + verified + " D1 cover crop columns verified.");
