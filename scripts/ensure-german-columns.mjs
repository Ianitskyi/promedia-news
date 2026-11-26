import {execFileSync} from 'node:child_process';
// Німецька версія (26.11.2026): колонки *_de для новин і проєктів. Повторний запуск безпечний —
// додаємо лише ті колонки, яких ще немає (див. migrations/0034_german.sql).
const db='promedia-news';
function execute(sql){
 const output=execFileSync('npx',['wrangler','d1','execute',db,'--remote','--command',sql],{encoding:'utf8',timeout:180000});
 const start=output.search(/\[\s*\{\s*"results"\s*:/);
 if(start<0)throw Error('Cannot parse D1 response');
 const data=JSON.parse(output.slice(start).trim());
 if(!data.length||data.some(item=>!item.success))throw Error('D1 operation failed');
 return data[0].results;
}
const WANTED={
 articles:['title_de','excerpt_de','body_md_de','de_translated_at'],
 projects:['title_de','excerpt_de','body_md_de','work_md_de','results_md_de','partner_de','donor_de','period_label_de','de_translated_at']
};
for(const [table,cols] of Object.entries(WANTED)){
 const have=new Set(execute(`SELECT name FROM pragma_table_info('${table}')`).map(row=>row.name));
 if(!have.has('id'))throw Error('Unexpected schema: '+table);
 for(const col of cols){
  if(!have.has(col)){execute(`ALTER TABLE ${table} ADD COLUMN ${col} TEXT`);console.log(`Added ${table}.${col}`);}
 }
 const verified=new Set(execute(`SELECT name FROM pragma_table_info('${table}')`).map(row=>row.name));
 const missing=cols.filter(c=>!verified.has(c));
 if(missing.length)throw Error(`Missing ${table}: ${missing.join(', ')}`);
}
console.log('German columns verified.');
// Німецька Німеччини, а не Австрії (26.11.2026): «Jänner» → «Januar» у вже перекладених текстах. Повторний запуск нічого не змінює.
for(const table of ['articles','projects']){
 const cols=table==='articles'?['title_de','excerpt_de','body_md_de']:['title_de','excerpt_de','body_md_de','work_md_de','results_md_de','period_label_de'];
 execute(`UPDATE ${table} SET ${cols.map(c=>`${c} = replace(${c}, 'Jänner', 'Januar')`).join(', ')} WHERE ${cols.map(c=>`${c} LIKE '%Jänner%'`).join(' OR ')}`);
}
console.log('German wording normalised.');
