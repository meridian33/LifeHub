import {initialData,parseBackup,parseMoney,parseExtra,type Data} from './domain';

const conflict='Запись изменена или удалена на другом устройстве. Черновик сохранён в форме. Скопируй его и обнови данные.';
class Failure extends Error {constructor(message:string,public status=400){super(message);}}
function version(value:unknown):number {
  if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0||value>=Number.MAX_SAFE_INTEGER)throw new Failure('Некорректная версия записи.');
  return value;
}
function kind(value:unknown):string {
  if(!['task','note','tx','event','account','wish','transfer','subscription'].includes(String(value)))throw new Failure('Неизвестный тип записи.');return value as string;
}
function id(value:unknown):string {
  if(typeof value!=='string'||!value.trim()||value.length>200)throw new Failure('Некорректный идентификатор.');return value;
}
function json(value:unknown,status=200){return Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
async function readBody(request:Request){
  if(!request.headers.get('content-type')?.startsWith('application/json'))throw new Failure('Нужен формат JSON.',415);
  const reader=request.body?.getReader();if(!reader)throw new Failure('Пустой запрос.');
  let bytes=0;const chunks:Uint8Array[]=[];
  for(;;){const {value,done}=await reader.read();if(done)break;bytes+=value.length;if(bytes>6*1024*1024){await reader.cancel();throw new Failure('Запрос больше 6 МБ.',413);}chunks.push(value);}
  const joined=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){joined.set(chunk,offset);offset+=chunk.length;}
  try{return JSON.parse(new TextDecoder().decode(joined));}catch{throw new Failure('Некорректный JSON.');}
}
export async function handleData(request:Request,owner:string|null,db?:D1Database):Promise<Response>{
  try{
    if(!owner)throw new Failure('Войди через ChatGPT, чтобы открыть личные данные.',401);
    if(request.headers.get('X-LifeHub-User')!==owner)throw new Failure('Аккаунт изменился. Обнови страницу.',403);
    if(request.method==='POST'&&request.headers.get('Origin')!==new URL(request.url).origin)throw new Failure('Запрос с другого сайта отклонён.',403);
    if(!db)throw new Failure('Облачное хранилище пока недоступно.',503);
    if(request.method==='GET'){
      await db.prepare('INSERT OR IGNORE INTO preferences(owner) VALUES (?)').bind(owner).run();
      const results=await db.batch<Record<string,unknown>>([
        db.prepare('SELECT kind,payload,version FROM records WHERE owner=? ORDER BY updated_at DESC,id').bind(owner),
        db.prepare('SELECT budget_cents,version FROM preferences WHERE owner=?').bind(owner),
      ]);
      const data:Data={...initialData,tasks:[],notes:[],transactions:[],extras:[]};
      for(const row of results[0].results){const item={...JSON.parse(row.payload as string),version:row.version};
        if(row.kind==='task')data.tasks.push(item);else if(row.kind==='note')data.notes.push(item);else if(row.kind==='tx')data.transactions.push(item);else if(['event','account','wish','transfer','subscription'].includes(String(row.kind)))data.extras!.push(item);}
      const prefs=results[1].results[0];data.budget=Number(prefs.budget_cents)/100;data.preferencesVersion=Number(prefs.version);
      return json(data);
    }
    if(request.method!=='POST')throw new Failure('Метод не поддерживается.',405);
    const body=await readBody(request);
    if(!body||typeof body!=='object'||Array.isArray(body))throw new Failure('Некорректный запрос.');
    const now=Date.now();
    if(body.action==='save'){
      const k=kind(body.kind);const item=body.item;
      if(!item||typeof item!=='object')throw new Failure('Нет записи.');
      const expected=version(item.version);id(item.id);
      if(typeof body.isNew!=='boolean'||(body.isNew&&expected!==0))throw new Failure('Некорректная версия новой записи.');
      let clean:Record<string,unknown>;
      try{
        if(k==='task'||k==='note'||k==='tx'){
          const key=k==='task'?'tasks':k==='note'?'notes':'transactions';
          const validated=parseBackup(JSON.stringify({...initialData,[key]:[item]}));
          clean=validated[key][0] as unknown as Record<string,unknown>;
        }else{
          const extra=parseExtra({...item,kind:k});
          clean=extra as unknown as Record<string,unknown>;
        }
      }catch(e){throw new Failure((e as Error).message);}
      const payload=JSON.stringify({...clean,version:undefined});
      const stmt=body.isNew
        ?db.prepare('INSERT OR IGNORE INTO records(owner,kind,id,payload,version,updated_at) VALUES (?,?,?,?,0,?) RETURNING version').bind(owner,k,clean.id,payload,now)
        :db.prepare('UPDATE records SET payload=?,version=version+1,updated_at=? WHERE owner=? AND kind=? AND id=? AND version=? RETURNING version').bind(payload,now,owner,k,clean.id,expected);
      const row=await stmt.first<{version:number}>();if(!row)throw new Failure(conflict,409);
      return json({...clean,version:row.version});
    }
    if(body.action==='delete'){
      const row=await db.prepare('DELETE FROM records WHERE owner=? AND kind=? AND id=? AND version=? RETURNING id').bind(owner,kind(body.kind),id(body.id),version(body.version)).first();
      if(!row)throw new Failure(conflict,409);return json({ok:true});
    }
    if(body.action==='budget'){
      let budget:number;try{budget=parseMoney(body.budget);}catch(e){throw new Failure((e as Error).message);}
      const row=await db.prepare('UPDATE preferences SET budget_cents=?,version=version+1 WHERE owner=? AND version=? RETURNING version').bind(Math.round(budget*100),owner,version(body.version)).first<{version:number}>();
      if(!row)throw new Failure(conflict,409);return json({budget,version:row.version});
    }
    if(body.action==='import'){
      let data:Data;try{data=parseBackup(JSON.stringify(body.data));}catch(e){throw new Failure((e as Error).message);}
      const hash=async(value:unknown)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value))))).map(b=>b.toString(16).padStart(2,'0')).join('');
      const digest=await hash(data);
      // Older imports used the same normalized fields without `extras`.
      const legacyDigest=await hash({tasks:data.tasks,notes:data.notes,transactions:data.transactions,budget:data.budget,preferencesVersion:data.preferencesVersion});
      const rows=[...data.tasks.map(item=>({kind:'task',item})),...data.notes.map(item=>({kind:'note',item})),...data.transactions.map(item=>({kind:'tx',item})),...(data.extras??[]).map(item=>({kind:item.kind,item}))].map(({kind,item})=>({kind,item:{...item,id:crypto.randomUUID(),version:0}}));
      const chunks:typeof rows[]=[];let chunk:typeof rows=[];let size=0;
      for(const row of rows){const bytes=new TextEncoder().encode(JSON.stringify(row)).length;if(size+bytes>512*1024&&chunk.length){chunks.push(chunk);chunk=[];size=0;}chunk.push(row);size+=bytes;}
      if(chunk.length)chunks.push(chunk);
      await db.batch([
        ...chunks.map(part=>db.prepare(`INSERT INTO records(owner,kind,id,payload,version,updated_at)
          SELECT ?,json_extract(value,'$.kind'),json_extract(value,'$.item.id'),json_extract(value,'$.item'),0,?
          FROM json_each(?) WHERE NOT EXISTS(SELECT 1 FROM imports WHERE owner=? AND digest IN (?,?))`).bind(owner,now,JSON.stringify(part),owner,digest,legacyDigest)),
        db.prepare('INSERT OR IGNORE INTO imports(owner,digest,created_at) VALUES (?,?,?)').bind(owner,digest,now),
      ]);
      return json({ok:true});
    }
    throw new Failure('Неизвестное действие.');
  }catch(e){
    if(e instanceof Failure)return json({error:e.message},e.status);
    console.error('LifeHub storage failure', e instanceof Error?e.name:'unknown');
    return json({error:'Хранилище временно недоступно. Изменения не подтверждены; обнови данные перед повтором.'},503);
  }
}
