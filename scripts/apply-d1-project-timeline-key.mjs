// Adds projects.is_key (the «Важливий на таймлайні» flag) once; safe to run on every deploy.
import { execFileSync } from "node:child_process";

const database = "promedia-news";
const migration = "migrations/0031_project_timeline_key.sql";

function wrangler(args) {
  return execFileSync("npx", ["wrangler", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
}
function hasColumn() {
  const sql = "SELECT name FROM pragma_table_info('projects') WHERE name = 'is_key'";
  const payload = JSON.parse(wrangler(["d1", "execute", database, "--remote", "--command", sql, "--json"]));
  return (payload[0]?.results || []).length === 1;
}

if (hasColumn()) {
  console.log("projects.is_key already exists.");
  process.exit(0);
}
console.log("Applying " + migration);
wrangler(["d1", "execute", database, "--remote", "--file=" + migration]);
if (!hasColumn()) throw new Error("projects.is_key was not created.");
console.log("projects.is_key created; key projects marked.");
