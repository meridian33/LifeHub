const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const {DatabaseSync}=require('node:sqlite');
function compile(file,imports={}){const m={exports:{}};new Function('exports','require',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(m.exports,n=>imports[n]);return m.exports;}
const domain=compile('lib/domain.ts');
const {handleData}=compile('lib/server-data.ts',{'./domain':domain});
function fixture(){
 const sql=new DatabaseSync(':memory:');
 for(const file of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')))sql.exec(fs.readFileSync('drizzle/'+file,'utf8'));
 const wrap=(query,args=[])=>({bind(...values){return wrap(query,values)},async run(){sql.prepare(query).run(...args);return {}},async first(){return sql.prepare(query).get(...args)||null},all(){return {results:sql.prepare(query).all(...args)}}});
 const db={prepare:query=>wrap(query),async batch(stmts){sql.exec('BEGIN');try{const out=stmts.map(s=>s.all());sql.exec('COMMIT');return out}catch(e){sql.exec('ROLLBACK');throw e}}};
 const call=async(owner,body,extra={})=>{const res=await handleData(new Request('https://lifehub.test/api/data',{method:body?'POST':'GET',headers:{'X-LifeHub-User':owner||'','Origin':'https://lifehub.test','Content-Type':'application/json',...extra},...(body?{body:JSON.stringify(body)}:{})}),owner,db);return {status:res.status,data:await res.json()};};
 return {sql,db,call};
}
const task={id:'one',title:'Задача',done:false,priority:'Средний',date:'',version:0};
test('anonymous, account switch and cross-origin mutations denied',async()=>{
 const f=fixture();assert.equal((await f.call(null)).status,401);assert.equal((await f.call('a',undefined,{'X-LifeHub-User':'b'})).status,403);assert.equal((await f.call('a',{action:'save',kind:'task',item:task,isNew:true},{Origin:'https://evil.test'})).status,403);f.sql.close();
});
test('CRUD isolates owners, detects stale edits/deletes and survives reread',async()=>{
 const f=fixture();await f.call('a');await f.call('b');
 assert.equal((await f.call('a',{action:'save',kind:'task',item:{...task,owner:'b'},isNew:true})).status,200);
 assert.equal((await f.call('b')).data.tasks.length,0);
 assert.equal((await f.call('b',{action:'save',kind:'task',item:task,isNew:false})).status,409);
 const update=await f.call('a',{action:'save',kind:'task',item:{...task,done:true},isNew:false});assert.equal(update.data.version,1);
 assert.equal((await f.call('a',{action:'save',kind:'task',item:task,isNew:false})).status,409);
 assert.equal((await f.call('a',{action:'delete',kind:'task',id:task.id,version:0})).status,409);
 assert.equal((await f.call('a')).data.tasks[0].done,true);
 assert.equal((await f.call('a',{action:'delete',kind:'task',id:task.id,version:1})).status,200);
 assert.equal((await f.call('a')).data.tasks.length,0);f.sql.close();
});
test('notes, transactions, budget and malicious payload validation',async()=>{
 const f=fixture();await f.call('a');
 const note={id:'n',title:'Идея',body:'Текст',date:'2026-10-16',version:0};
 const tx={id:'t',name:'Кофе',amount:12.34,category:'Еда',type:'expense',date:'2026-10-16',impulse:false,version:0};
 for(const [kind,item]of [['note',note],['tx',tx]])assert.equal((await f.call('a',{action:'save',kind,item,isNew:true})).status,200);
 for(const patch of [{amount:1.001},{date:'2026-02-30'},{impulse:'true'},{type:'income',impulse:true}])assert.equal((await f.call('a',{action:'save',kind:'tx',item:{...tx,...patch},isNew:false})).status,400);
 assert.equal((await f.call('a',{action:'budget',budget:100.25,version:0})).status,200);
 assert.equal((await f.call('a',{action:'budget',budget:200,version:0})).status,409);
 const loaded=(await f.call('a')).data;assert.equal(loaded.budget,100.25);assert.equal(loaded.notes[0].body,'Текст');assert.equal(loaded.transactions[0].amount,12.34);f.sql.close();
});
test('import validates all rows, appends atomically, deduplicates retries, preserves budget',async()=>{
 const f=fixture();await f.call('a');
 const data={...domain.initialData,tasks:[task]};
 assert.equal((await f.call('a',{action:'import',data:{...data,notes:[{id:'bad'}]}})).status,400);assert.equal((await f.call('a')).data.tasks.length,0);
 assert.equal((await f.call('a',{action:'import',data})).status,200);assert.equal((await f.call('a',{action:'import',data})).status,200);
 const result=(await f.call('a')).data;assert.equal(result.tasks.length,1);assert.notEqual(result.tasks[0].id,task.id);assert.equal(result.budget,120000);
 f.sql.exec("CREATE TRIGGER reject_import BEFORE INSERT ON imports BEGIN SELECT RAISE(ABORT,'test failure'); END;");
 assert.equal((await f.call('a',{action:'import',data:{...data,tasks:[{...task,title:'different'}]}})).status,503);
 assert.equal((await f.call('a')).data.tasks.length,1);f.sql.close();
});
test('new planning records are owner isolated and use optimistic versions',async()=>{
 const f=fixture();await f.call('a');await f.call('b');
 const account={id:'account',kind:'account',title:'Kaspi',date:'2026-10-21',amount:0,version:0};
 assert.equal((await f.call('a',{action:'save',kind:'account',item:account,isNew:true})).status,200);
 assert.equal((await f.call('b')).data.extras.length,0);
 const wish={id:'wish',kind:'wish',title:'Наушники',date:'2026-10-21',amount:45000,status:'planned',note:'Желание',version:0};
 assert.equal((await f.call('a',{action:'save',kind:'wish',item:wish,isNew:true})).status,200);
 assert.equal((await f.call('a',{action:'save',kind:'wish',item:{...wish,status:'declined'},isNew:false})).status,200);
 assert.equal((await f.call('a',{action:'save',kind:'wish',item:wish,isNew:false})).status,409);
 assert.equal((await f.call('a')).data.extras.find(row=>row.id==='wish').status,'declined');
 assert.equal((await f.call('a',{action:'save',kind:'transfer',item:{id:'bad',kind:'transfer',title:'Перевод',date:'2026-10-21',amount:5,accountId:'account',toAccountId:'account',version:0},isNew:true})).status,400);
 f.sql.close();
});
test('upgraded import recognizes backups imported before extras existed',async()=>{
 const f=fixture();await f.call('a');
 const data={...domain.initialData,tasks:[task]};
 const normalized=domain.parseBackup(JSON.stringify(data));
 const legacy={tasks:normalized.tasks,notes:normalized.notes,transactions:normalized.transactions,budget:normalized.budget,preferencesVersion:normalized.preferencesVersion};
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(legacy))))).map(b=>b.toString(16).padStart(2,'0')).join('');
 f.sql.prepare('INSERT INTO imports(owner,digest,created_at) VALUES (?,?,?)').run('a',digest,Date.now());
 assert.equal((await f.call('a',{action:'import',data})).status,200);
 assert.equal((await f.call('a')).data.tasks.length,0);
 f.sql.close();
});
