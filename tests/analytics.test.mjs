import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { webcrypto } from "node:crypto";

globalThis.crypto ||= webcrypto;
const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const auth = await import("data:text/javascript;base64," + Buffer.from(read("src/lib/analytics-auth.js")).toString("base64"));
const routeSource = read("src/routes/analytics.js").replace(/^import .*?;\s*/gm, "").replace(/export /g, "");
const { handleAnalyticsRoute, validateViewsReport } = new Function("verifyAnalyticsToken", routeSource + ";return {handleAnalyticsRoute,validateViewsReport};")(auth.verifyAnalyticsToken);
const now = Date.now();
const seconds = Math.floor(now / 1000);
const claims = { iss: "https://token.actions.githubusercontent.com", aud: auth.ANALYTICS_AUDIENCE, repository_id: "1297520567", repository_owner_id: "48093599", repository: "Ianitskyi/promedia-weekly-dashboard", ref: "refs/heads/main", workflow_ref: "Ianitskyi/promedia-weekly-dashboard/.github/workflows/news-views.yml@refs/heads/main", event_name: "schedule", iat: seconds, nbf: seconds, exp: seconds + 300 };
const keypair = await crypto.subtle.generateKey({name:"RSASSA-PKCS1-v1_5",modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:"SHA-256"},true,["sign","verify"]);
const jwk = {...await crypto.subtle.exportKey("jwk",keypair.publicKey),kid:"test"};
const b64 = value => Buffer.from(typeof value === "string" ? value : JSON.stringify(value)).toString("base64url");
async function token(overrides = {}) {
  const input = b64({alg:"RS256",kid:"test"}) + "." + b64({...claims,...overrides});
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5",keypair.privateKey,new TextEncoder().encode(input));
  return input + "." + Buffer.from(signature).toString("base64url");
}
const options = {now,fetcher: async (url, init) => {
  assert.equal(url,"https://token.actions.githubusercontent.com/.well-known/jwks");
  assert.equal(init.redirect,"manual", "Workers supports manual redirects; redirects remain rejected by the status check");
  return Response.json({keys:[jwk]});
}};

test("Only the signed main-branch analytics workflow can sync totals", async () => {
  assert.equal((await auth.verifyAnalyticsToken(await token(),options)).repository_id,claims.repository_id);
  for (const overrides of [{repository_id:"other"},{repository_owner_id:"other"},{repository:"other/repo"},{aud:"other"},{ref:"refs/heads/other"},{workflow_ref:"other"},{exp:seconds-1},{iat:seconds-601},{nbf:seconds+90},{event_name:"pull_request"}]) {
    await assert.rejects(auth.verifyAnalyticsToken(await token(overrides),options));
  }
  const valid = await token();
  const parts = valid.split(".");
  parts[1] = b64({...claims,jti:"tampered"});
  await assert.rejects(auth.verifyAnalyticsToken(parts.join("."),options));
  await assert.rejects(auth.verifyAnalyticsToken("invalid",options));
});

function report(items = [{slug:"example",views:123}]) {
  return {schemaVersion:1,source:"ga4",propertyId:"366614690",metric:"screenPageViews",generatedAt:new Date(now).toISOString(),dateRange:{startDate:"2019-01-01",endDate:"today"},items};
}
test("Incomplete, negative, duplicate and stale analytics reports are rejected", () => {
  assert.equal(validateViewsReport(report(),now).items[0].views,123);
  for (const data of [report([{slug:"example",views:-1}]),report([{slug:"example",views:1.2}]),report([{slug:"example",views:1},{slug:"example",views:2}]),{...report(),generatedAt:"2020-01-01"},{...report(),propertyId:"other"}]) assert.throws(() => validateViewsReport(data,now));
});

test("Sync rejects unauthenticated requests before touching the database", async () => {
  let touched = false;
  const env = {DB:{batch(){touched=true;throw Error("Unexpected DB call");}}};
  const response = await handleAnalyticsRoute(new Request(auth.ANALYTICS_AUDIENCE,{method:"POST",body:JSON.stringify(report())}),env,new URL(auth.ANALYTICS_AUDIENCE),async()=>{throw Error("Unauthorized");});
  assert.equal(response.status,401);
  assert.equal(touched,false);
});

test("Sync upsert updates only published articles and ignores older replays", async () => {
  const queries = [];
  const env = {DB:{prepare(sql){return {bind(...values){return {sql,values};}};},async batch(statements){queries.push(...statements);return statements.map(()=>({meta:{changes:1}}));}}};
  const response = await handleAnalyticsRoute(new Request(auth.ANALYTICS_AUDIENCE,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(report())}),env,new URL(auth.ANALYTICS_AUDIENCE),async()=>claims);
  assert.equal(response.status,200);
  const sql = queries[0].sql;
  const python = `import sqlite3,json,sys
p=json.loads(sys.argv[1]);db=sqlite3.connect(':memory:')
db.executescript("CREATE TABLE articles(id INTEGER PRIMARY KEY,slug TEXT,status TEXT,deleted_at TEXT);INSERT INTO articles VALUES(1,'example','published',NULL),(2,'draft','draft',NULL),(3,'deleted','published','2026-01-01');")
db.executescript(p['migration'])
for slug,views,when in [('example',123,'2026-11-11T09:00:00Z'),('example',2,'2026-11-10T09:00:00Z'),('draft',99,'2026-11-11T09:00:00Z'),('deleted',99,'2026-11-11T09:00:00Z')]:db.execute(p['sql'],(views,when,slug))
print(json.dumps(db.execute('SELECT article_id,ga4_views FROM article_views').fetchall()))`;
  assert.deepEqual(JSON.parse(execFileSync("python3",["-c",python,JSON.stringify({sql,migration:read("migrations/0014_article_views.sql")})],{encoding:"utf8"})),[[1,123]]);
});

const markdown = await import("data:text/javascript;base64," + Buffer.from(read("src/lib/markdown.js")).toString("base64"));
const typography = await import("data:text/javascript;base64," + Buffer.from(read("src/lib/typography.js")).toString("base64"));
const renderSource = read("src/lib/render.js").replace(/^import .*?;\s*/gm, "").replace(/export /g, "");
const renderers = new Function("markdownToHtml","markdownToPlainText","escapeHtml","normalizeUkrainianQuotes","normalizeUkrainianTitle",renderSource+";return {renderHomepage,renderArticlePage};")(markdown.markdownToHtml,markdown.markdownToPlainText,markdown.escapeHtml,typography.normalizeUkrainianQuotes,typography.normalizeUkrainianTitle);
test("Article and card view totals appear in all languages; unknown totals stay hidden", () => {
  const article={slug:"example",title:"Новина",title_en:"News",title_crh:"Haber",body_md:"Text",tags:"[]",published_at:"2026-11-11",view_count:1234};
  for(const lang of ["uk","en","crh"]) {
    for(const html of [renderers.renderHomepage({articles:[article],lang,baseUrl:"https://news.promedia.report"}),renderers.renderArticlePage({article,lang,baseUrl:"https://news.promedia.report",relatedMediaNames:[]})]) assert.match(html,/class="article-views"[^>]*aria-label="[^"]+: 1234"/);
  }
  const html=renderers.renderHomepage({articles:[{...article,view_count:null}],lang:"uk",baseUrl:"https://news.promedia.report"});
  assert.doesNotMatch(html,/class="article-views"/);
});
