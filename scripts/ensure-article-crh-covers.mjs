import {execFileSync} from 'node:child_process';
const db='promedia-news';
function execute(sql){
 const output=execFileSync('npx',['wrangler','d1','execute',db,'--remote','--command',sql],{encoding:'utf8',timeout:180000});
 const start=output.search(/\[\s*\{\s*"results"\s*:/);
 if(start<0)throw Error('Cannot parse D1 response');
 const data=JSON.parse(output.slice(start).trim());
 if(!data.length||data.some(item=>!item.success))throw Error('D1 operation failed');
 return data[0].results;
}
// Additive and repeatable: old articles retain their Ukrainian fallback.
const columns=new Set(execute("SELECT name FROM pragma_table_info('articles')").map(row=>row.name));
if(!columns.has('id')||!columns.has('cover_image_url_en'))throw Error('Unexpected articles schema');
for(const column of ['cover_image_url_crh','cover_crop_data_crh']){
 if(!columns.has(column)){execute('ALTER TABLE articles ADD COLUMN '+column+' TEXT');console.log('Added '+column);}
}
const verified=new Set(execute("SELECT name FROM pragma_table_info('articles')").map(row=>row.name));
for(const column of ['cover_image_url_crh','cover_crop_data_crh'])if(!verified.has(column))throw Error('Missing '+column);
console.log('Independent Crimean Tatar covers verified.');
