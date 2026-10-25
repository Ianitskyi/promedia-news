import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const database = "promedia-news";
const migration = "migrations/0013_project_content_structure.sql";
const requiredColumns = [
  "work_md", "work_md_en", "work_md_crh",
  "results_md", "results_md_en", "results_md_crh",
  "period_label", "period_label_en", "period_label_crh"
];

function wrangler(args) {
  return execFileSync("npx", ["wrangler", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
}

function getColumns() {
  const sql = "SELECT name FROM pragma_table_info('projects') WHERE name IN (" + requiredColumns.map((name) => "'" + name + "'").join(",") + ") ORDER BY name";
  const payload = JSON.parse(wrangler(["d1", "execute", database, "--remote", "--command", sql, "--json"]));
  return new Set((payload[0]?.results || []).map((row) => row.name));
}

const before = getColumns();
if (before.size === requiredColumns.length) {
  console.log("Project-content schema is already complete.");
  process.exit(0);
}
if (before.size !== 0) {
  throw new Error("Partial project-content schema detected (" + before.size + "/" + requiredColumns.length + "); stopped without writing.");
}

const sql = readFileSync(migration, "utf8");
if (!sql.includes("ALTER TABLE projects ADD COLUMN work_md") || !sql.includes("ALTER TABLE projects ADD COLUMN period_label_crh")) {
  throw new Error("Migration file does not match the expected project-content migration.");
}

console.log("Creating a Cloudflare D1 recovery bookmark before migration.");
wrangler(["d1", "time-travel", "info", database]);
console.log("Applying " + migration);
wrangler(["d1", "execute", database, "--remote", "--file=" + migration]);

const after = getColumns();
if (after.size !== requiredColumns.length) {
  throw new Error("Migration verification failed (" + after.size + "/" + requiredColumns.length + ").");
}
console.log("Project-content schema verified: " + requiredColumns.length + " columns present.");
