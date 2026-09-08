import assert from 'node:assert/strict';
import {handlePublicRoute} from '../src/routes/public.js';
const article={id:1,slug:'test',title:'Тест',excerpt:'',body_md:'Текст',tags:'[]',related_media_ids:'["atlas-test"]',published_at:'2026-09-08T10:00:00Z'};
const env={DB:{prepare:()=>({bind:()=>({first:async()=>article})})},ASSETS:{fetch:async()=>Response.json([{id:'atlas-test',name:'Медіа тест',newsIds:['atlas-test','legacy-id'],url:'https://promedia-atlas.ianitskyi.chatgpt.site/media/atlas-test'}])}};
const original=globalThis.fetch;
try{
 globalThis.fetch=async()=>{throw Error('Communities temporarily unavailable')};
 const req=new Request('https://news.promedia.report/article/test');
 let html=await (await handlePublicRoute(req,env,new URL(req.url))).text();
 assert.ok(html.includes('https://promedia-atlas.ianitskyi.chatgpt.site/media/atlas-test'));
 assert.ok(html.includes('Медіа тест'));
 article.related_media_ids='["legacy-id"]';
 html=await (await handlePublicRoute(req,env,new URL(req.url))).text();
 assert.ok(html.includes('https://promedia-atlas.ianitskyi.chatgpt.site/media/atlas-test'));
 env.ASSETS.fetch=async()=>{throw Error('Atlas unavailable')};
 globalThis.fetch=async()=>Response.json([{id:'legacy-id',name:'Старе медіа'}]);
 html=await (await handlePublicRoute(req,env,new URL(req.url))).text();
 assert.ok(html.includes('https://communities.promedia.report/media/?id=legacy-id'));
 assert.ok(html.includes('Старе медіа'));
 console.log('Atlas article links, legacy tags and independent catalog failure fallbacks verified.');
}finally{globalThis.fetch=original}
