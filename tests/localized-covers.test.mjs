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
 for(const name of readdirSync(new URL('../migrations/',import.meta.url)).filter(n=>n.endsWith('.sql')).sort()){
  // articles.pinned_at/pinned_until are added by scripts/ensure-article-pinned.mjs at deploy, not by a migration.
  if(/pinned_(at|until)/.test(read('migrations/'+name)))for(const col of ['pinned_at','pinned_until'])if(!db.prepare("SELECT 1 FROM pragma_table_info('articles') WHERE name=?").get(col))db.exec('ALTER TABLE articles ADD COLUMN '+col+' TEXT');
  db.exec(read('migrations/'+name));
 }
 db.exec("INSERT INTO users(id,email,password_hash,name,role) VALUES(1,'test@example.org','test','Test','admin')");
 const D1={async batch(list){for(const st of list)await st.run();},prepare(sql){
  let values=[];
  return {
   bind(...v){values=v;return this;},
   async first(){return db.prepare(sql).get(...values)||null;},
   async all(){return {results:db.prepare(sql).all(...values)};},
   async run(){const r=db.prepare(sql).run(...values);return {meta:{last_row_id:Number(r.lastInsertRowid)}};}
  };
 }};
 const source=read('src/routes/admin.js').replace(/^import .*?;\s*/gm,'').replace(/export /g,'');
 const pin=await import('../src/lib/pinning.js');
 const handler=new Function('getCurrentUser','uniqueSlug','completeArticleDraft','normalizeUkrainianFields','markdownToPlainText','isPinActive','pinUntilDate','resolvePinUntil',source+';return handleAdminRoute;')(async()=>({id:1,role:'admin'}),async()=>'santa-test',async b=>b,a=>a,x=>x,pin.isPinActive,pin.pinUntilDate,pin.resolvePinUntil);
 const call=async(method,path,body)=>{const u=new URL(path,'https://news.promedia.report');const request=new Request(u,{method,...(body?{headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{})});return handler(request,{DB:D1},u)};
 let response=await call('POST','/api/admin/articles',{title:'Санта',bodyMd:'Текст',coverImageUrl:'/uk.png',coverImageUrlEn:'/en.png',coverImageUrlCrh:'/crh.png',coverCropDataCrh:{alt:'Gizli Santa'}});
 assert.equal(response.status,201);let item=(await response.json()).item;assert.equal(item.coverImageUrlCrh,'/crh.png');assert.equal(item.coverCropDataCrh.alt,'Gizli Santa');
 response=await call('PUT','/api/admin/articles/'+item.id,{coverImageUrlCrh:'/new-crh.png',coverCropDataCrh:{alt:'QT'}});assert.equal(response.status,200);
 const saved=db.prepare('SELECT * FROM articles WHERE id=?').get(item.id);assert.equal(saved.cover_image_url,'/uk.png');assert.equal(saved.cover_image_url_en,'/en.png');assert.equal(saved.cover_image_url_crh,'/new-crh.png');
 response=await call('PUT','/api/admin/articles/'+item.id,{coverImageUrlCrh:null});assert.equal(response.status,200);assert.equal(db.prepare('SELECT cover_image_url_crh FROM articles WHERE id=?').get(item.id).cover_image_url_crh,null);
 // Закріплення завжди з терміном: без дати — 5 днів, минула дата — помилка, свою дату зберігаємо.
 response=await call('PUT','/api/admin/articles/'+item.id,{isPinned:true});assert.equal(response.status,200);
 item=(await response.json()).item;assert.equal(item.isPinned,true);assert.equal(item.pinnedUntil,pin.defaultPinDate());
 response=await call('PUT','/api/admin/articles/'+item.id,{isPinned:true,pinnedUntil:'2020-01-01'});assert.equal(response.status,400);
 response=await call('PUT','/api/admin/articles/'+item.id,{isPinned:true,pinnedUntil:'2999-12-04'});item=(await response.json()).item;assert.equal(item.pinnedUntil,'2999-12-04');
 assert.equal(db.prepare('SELECT pinned_until FROM articles WHERE id=?').get(item.id).pinned_until,'2999-12-04T22:00:00.000Z');
 response=await call('POST','/api/admin/articles/'+item.id+'/pin',{pinned:true});item=(await response.json()).item;assert.equal(item.pinnedUntil,pin.defaultPinDate());
 db.prepare("UPDATE articles SET pinned_until='2020-01-01T22:00:00.000Z' WHERE id=?").run(item.id);
 response=await call('GET','/api/admin/articles');const listed=(await response.json());item=(listed.items||listed.articles).find(x=>x.id===item.id);assert.equal(item.isPinned,false);assert.equal(item.pinnedUntil,null);
 response=await call('PUT','/api/admin/articles/'+item.id,{isPinned:false});assert.equal(db.prepare('SELECT pinned_at FROM articles WHERE id=?').get(item.id).pinned_at,null);
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

test('Brief is linked from the secondary menu, without a header button',()=>{
 for(const lang of ['uk','en','crh']){
  const definitions=new Map();class Element{getAttribute(){return null;}}
  runInNewContext(read('public/js/promedia-global-shell.js'),{HTMLElement:Element,URL,
   location:{hostname:'news.promedia.report',pathname:lang==='uk'?'/':'/'+lang+'/',href:'https://news.promedia.report/'},
   document:{documentElement:{lang},getElementById:()=>null,querySelector:()=>null,createElement:()=>({}),head:{appendChild(){}}},
   customElements:{get:n=>definitions.get(n),define:(n,c)=>definitions.set(n,c)}});
  const Header=definitions.get('promedia-global-header'),header=new Header();header.connectedCallback();
  assert.equal(header.innerHTML.includes('class="" href="https://brief.promedia.report/">Brief</a>'),true,lang);
  assert.equal(header.innerHTML.includes('data-pm-brief'),false,lang);
 }
});

test('The BRIEF bar is added under the header only in Ukrainian and not on BRIEF itself',()=>{
 for(const [lang,host,want] of [['uk','news.promedia.report',1],['uk','research.promedia.report',1],['en','news.promedia.report',0],['crh','atlas.promedia.report',0],['uk','brief.promedia.report',0]]){
  const definitions=new Map(),added=[];class Element{getAttribute(){return null;}after(x){added.push(x);}}
  runInNewContext(read('public/js/promedia-global-shell.js'),{HTMLElement:Element,URL,
   fetch:()=>new Promise(()=>{}),
   location:{hostname:host,pathname:lang==='uk'?'/':'/'+lang+'/',href:'https://'+host+'/'},
   document:{documentElement:{lang},getElementById:()=>null,querySelector:()=>null,createElement:()=>({setAttribute(){},querySelector:()=>({})}),head:{appendChild(){}},body:{prepend(){}}},
   customElements:{get:n=>definitions.get(n),define:(n,c)=>definitions.set(n,c)}});
  const Header=definitions.get('promedia-global-header'),header=new Header();header.connectedCallback();
  assert.equal(added.length,want,lang+' '+host);
  if(want) assert.match(added[0].innerHTML,/brief\.promedia\.report/);
 }
});

test('The BRIEF bar keeps playing from the same second on the next page (owner, 2026-11-18)',async()=>{
 const jar={};const cookie={get value(){return Object.entries(jar).map(([k,v])=>k+'='+v).join('; ')},
  set value(s){const [kv,...attrs]=s.split(';');const [k,v]=kv.split('=');if(attrs.some(a=>a.trim()==='max-age=0'))delete jar[k];else jar[k]=v;assert(attrs.includes('domain=.promedia.report'))}};
 const page=(host,{blockAutoplay=false}={})=>{
  const definitions=new Map(),added=[],win={},audios=[];
  class Element{getAttribute(){return null;}after(x){added.push(x);}}
  class Audio{constructor(src){this.src=src;this.paused=true;this.currentTime=0;this.duration=300;this.l={};audios.push(this)}
   addEventListener(e,f){(this.l[e]=this.l[e]||[]).push(f)}emit(e){(this.l[e]||[]).forEach(f=>f({}))}
   play(){if(blockAutoplay&&!this.tapped)return Promise.reject(new Error('NotAllowedError'));this.paused=false;this.emit('play');return Promise.resolve()}
   pause(){this.paused=true;this.emit('pause')}}
  const el=()=>({hidden:true,textContent:'',setAttribute(){},append(){},addEventListener(e,f){this['on'+e]=f}});
  const btn=el(),meta=el();
  const today=new Date().toISOString().slice(0,10);
  const files={'https://brief.promedia.report/demo/index.json':{demos:[{file:'demo/'+today+'-daily.json'}]},
   ['https://brief.promedia.report/demo/'+today+'-daily.json']:{date:today,audio:'demo/'+today+'-daily.mp3',duration_sec:300}};
  const doc={documentElement:{lang:'uk'},getElementById:()=>null,querySelector:()=>null,head:{appendChild(){}},body:{prepend(){}},
   createElement:()=>({setAttribute(){},classList:{toggle(){}},querySelector:s=>s.includes('play')?btn:meta,textContent:''}),
   createTextNode:()=>({nodeValue:''})};
  Object.defineProperty(doc,'cookie',{get:()=>cookie.value,set:v=>{cookie.value=v}});
  runInNewContext(read('public/js/promedia-global-shell.js'),{HTMLElement:Element,URL,Audio,Date,Promise,
   fetch:u=>Promise.resolve({json:()=>Promise.resolve(files[u.split('?')[0]])}),
   addEventListener:(e,f)=>{win[e]=f},window:{},String,Math,Number,
   location:{hostname:host,pathname:'/',href:'https://'+host+'/',protocol:'https:'},document:doc,
   customElements:{get:n=>definitions.get(n),define:(n,c)=>definitions.set(n,c)}});
  new (definitions.get('promedia-global-header'))().connectedCallback();
  return {btn,audios,win};
 };
 const tick=()=>new Promise(r=>setTimeout(r,10));
 // Page 1: the listener presses play and listens to 1:40, then opens another page.
 const a=page('news.promedia.report');await tick();
 const one=a.audios[0];a.btn.onclick();one.currentTime=100;one.emit('timeupdate');
 a.win.pagehide({});one.pause(); // the browser stops the sound while leaving: not the listener's pause
 // Page 2, another ProMedia site: same edition, same second, already playing.
 const b=page('ratings.promedia.report');await tick();
 const two=b.audios[0];assert.equal(two.currentTime,100);assert.equal(two.paused,false);
 // The listener pauses at 2:30: the next page waits at 2:30 instead of playing.
 two.currentTime=150;two.pause();
 const c=page('atlas.promedia.report');await tick();
 assert.equal(c.audios[0].currentTime,150);assert.equal(c.audios[0].paused,true);
 // iPhone: sound needs a tap — the bar waits at the same second, one tap continues.
 c.audios[0].tapped=1;c.btn.onclick();c.audios[0].emit('timeupdate');c.win.pagehide({});
 const d=page('news.promedia.report',{blockAutoplay:true});await tick();
 assert.equal(d.audios[0].currentTime,150);assert.equal(d.audios[0].paused,true);
 // To the end: the next page starts from the beginning.
 d.audios[0].tapped=1;d.btn.onclick();d.audios[0].emit('ended');
 const e=page('news.promedia.report');await tick();
 assert.equal(e.audios[0].currentTime,0);assert.equal(e.audios[0].paused,true);
});
