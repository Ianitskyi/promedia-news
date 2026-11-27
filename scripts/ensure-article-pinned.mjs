import {execFileSync} from 'node:child_process';
// Закріплена новина вгорі стрічки: колонка articles.pinned_at (NULL — не закріплена).
// articles.pinned_until — кінець закріплення (UTC), до кінця обраного дня за Києвом (з 28.11.2026).
// Повторний запуск безпечний: колонки додаємо лише якщо їх ще немає.
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
if(!columns.has('pinned_until')){execute('ALTER TABLE articles ADD COLUMN pinned_until TEXT');console.log('Added pinned_until');}
const verified=new Set(execute("SELECT name FROM pragma_table_info('articles')").map(row=>row.name));
if(!verified.has('pinned_at')||!verified.has('pinned_until'))throw Error('Missing pinned columns');
console.log('Pinned articles column verified.');
