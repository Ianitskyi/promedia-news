import {execFileSync} from 'node:child_process';
// Закріплена новина вгорі стрічки: колонка articles.pinned_at (NULL — не закріплена).
// Повторний запуск безпечний: колонку додаємо лише якщо її ще немає.
const db='promedia-news';
function execute(sql){
 const output=execFileSync('npx',['wrangler','d1','execute',db,'--remote','--command',sql],{encoding:'utf8',timeout:180000});
 const start=output.search(/\[\s*\{\s*"results"\s*:/);
 if(start<0)throw Error('Cannot parse D1 response');
 const data=JSON.parse(output.slice(start).trim());
 if(!data.length||data.some(item=>!item.success))throw Error('D1 operation failed');
 return data[0].results;
}
const columns=new Set(execute("SELECT name FROM pragma_table_info('articles')").map(row=>row.name));
if(!columns.has('id'))throw Error('Unexpected articles schema');
if(!columns.has('pinned_at')){execute('ALTER TABLE articles ADD COLUMN pinned_at TEXT');console.log('Added pinned_at');}
const verified=new Set(execute("SELECT name FROM pragma_table_info('articles')").map(row=>row.name));
if(!verified.has('pinned_at'))throw Error('Missing pinned_at');
console.log('Pinned articles column verified.');
