import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {runInNewContext} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const renderSource=read('src/lib/render.js').replace(/^import .*?;\s*/gm,'').replace(/export /g,'');
const covers=new Function(renderSource+';return {articleCover,articleCoverMetadata,articleFocalStyle};')();
test('Each language selects its own image and crop; missing translations fall back to Ukrainian',()=>{
 const a={cover_image_url:'/uk.png',cover_image_url_en:'/en.png',cover_image_url_crh:'/crh.png',cover_crop_data:'{"alt":"UK","desktop":{"x":11,"y":22}}',cover_crop_data_en:'{"alt":"EN","desktop":{"x":33,"y":44}}',cover_crop_data_crh:'{"alt":"QT","fit":"contain","desktop":{"x":55,"y":66}}'};
 for(const [lang,path,alt] of [['uk','/uk.png','UK'],['en','/en.png','EN'],['crh','/crh.png','QT']]){
  assert.equal(covers.articleCover(a,lang),path);assert.equal(covers.articleCoverMetadata(a,lang).alt,alt);
 }
 assert.match(covers.articleFocalStyle(a,'crh','desktop'),/object-fit:contain.*55% 66%/);
 a.cover_image_url_crh=null;assert.equal(covers.articleCover(a,'crh'),'/uk.png');assert.equal(covers.articleCoverMetadata(a,'crh').alt,'UK');
});
test('Admin API saves, reads, changes and clears Crimean Tatar cover independently',async()=>{
 const db=new DatabaseSync(':memory:');
 for(const name of readdirSync(new URL('../migrations/',import.meta.url)).filter(n=>n.endsWith('.sql')).sort())db.exec(read('migrations/'+name));
 db.exec("INSERT INTO users(id,email,password_hash,name,role) VALUES(1,'test@example.org','test','Test','admin')");
 const D1={prepare(sql){
  let values=[];
  return {
   bind(...v){values=v;return this;},
   async first(){return db.prepare(sql).get(...values)||null;},
   async all(){return {results:db.prepare(sql).all(...values)};},
   async run(){const r=db.prepare(sql).run(...values);return {meta:{last_row_id:Number(r.lastInsertRowid)}};}
  };
 }};
 const source=read('src/routes/admin.js').replace(/^import .*?;\s*/gm,'').replace(/export /g,'');
 const handler=new Function('getCurrentUser','uniqueSlug','completeArticleDraft','normalizeUkrainianFields','markdownToPlainText',source+';return handleAdminRoute;')(async()=>({id:1,role:'admin'}),async()=>'santa-test',async b=>b,a=>a,x=>x);
 const call=async(method,path,body)=>{const u=new URL(path,'https://news.promedia.report');const request=new Request(u,{method,...(body?{headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{})});return handler(request,{DB:D1},u)};
 let response=await call('POST','/api/admin/articles',{title:'Санта',bodyMd:'Текст',coverImageUrl:'/uk.png',coverImageUrlEn:'/en.png',coverImageUrlCrh:'/crh.png',coverCropDataCrh:{alt:'Gizli Santa'}});
 assert.equal(response.status,201);let item=(await response.json()).item;assert.equal(item.coverImageUrlCrh,'/crh.png');assert.equal(item.coverCropDataCrh.alt,'Gizli Santa');
 response=await call('PUT','/api/admin/articles/'+item.id,{coverImageUrlCrh:'/new-crh.png',coverCropDataCrh:{alt:'QT'}});assert.equal(response.status,200);
 const saved=db.prepare('SELECT * FROM articles WHERE id=?').get(item.id);assert.equal(saved.cover_image_url,'/uk.png');assert.equal(saved.cover_image_url_en,'/en.png');assert.equal(saved.cover_image_url_crh,'/new-crh.png');
 response=await call('PUT','/api/admin/articles/'+item.id,{coverImageUrlCrh:null});assert.equal(response.status,200);assert.equal(db.prepare('SELECT cover_image_url_crh FROM articles WHERE id=?').get(item.id).cover_image_url_crh,null);
});
test('Santa preset prepares three language covers without saving or publishing an article',()=>{
 const source=read('public/admin/admin.js');const start=source.indexOf('document.getElementById("santa-covers-preset").addEventListener');const end=source.indexOf('function collectPayload',start);const action=source.slice(start,end);
 for(const lang of ['uk','en','crh'])assert(action.includes('lang:"'+lang+'"'));
 assert(!/api\(|fetch\(|publish/.test(action));assert.match(source,/coverImageUrlCrh: fields.coverImageUrlCrh.value/);
});
test('The shared header links to Santa on desktop and mobile only in Ukrainian',()=>{
 for(const lang of ['uk','en','crh']){
  const definitions=new Map();class Element{getAttribute(){return null;}}
  runInNewContext(read('public/js/promedia-global-shell.js'),{HTMLElement:Element,URL,
   location:{hostname:'news.promedia.report',pathname:lang==='uk'?'/':'/'+lang+'/',href:'https://news.promedia.report/'},
   document:{documentElement:{lang},getElementById:()=>null,querySelector:()=>null,createElement:()=>({}),head:{appendChild(){}}},
   customElements:{get:n=>definitions.get(n),define:(n,c)=>definitions.set(n,c)}});
  const Header=definitions.get('promedia-global-header'),header=new Header();header.connectedCallback();
  assert.equal((header.innerHTML.match(/href="https:\/\/santa.promedia.report\/"/g)||[]).length,lang==='uk'?2:0);
  assert.equal(header.innerHTML.includes(lang==='uk'?'>Санта</a>':'>Santa</a>'),lang==='uk');
 }
});
