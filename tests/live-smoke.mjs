import assert from 'node:assert/strict';
const base='http://127.0.0.1:5173';
const login=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'});
const cookie=login.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');
const {user}=await (await fetch(base+'/api/session',{headers:{cookie}})).json();
assert.ok(user?.id,'Local preview identity required');
async function call(body){const response=await fetch(base+'/api/data',{method:body?'POST':'GET',headers:{cookie,'Content-Type':'application/json','X-LifeHub-User':user.id,Origin:base},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,data:await response.json()};}
const task={id:crypto.randomUUID(),title:'API smoke test',done:false,priority:'Средний',date:'',version:0};
assert.equal((await call({action:'save',kind:'task',item:task,isNew:true})).status,200);
assert.ok((await call()).data.tasks.some(t=>t.id===task.id));
assert.equal((await call({action:'save',kind:'task',item:{...task,done:true},isNew:false})).data.version,1);
assert.equal((await call({action:'save',kind:'task',item:task,isNew:false})).status,409);
assert.equal((await call({action:'delete',kind:'task',id:task.id,version:1})).status,200);
assert.ok(!(await call()).data.tasks.some(t=>t.id===task.id));
assert.equal((await fetch(base+'/api/data')).status,401);
for(const asset of ['/manifest.webmanifest','/sw.js','/offline.html','/icon-192.png','/icon-512.png','/apple-touch-icon.png'])assert.equal((await fetch(base+asset)).status,200,asset);
console.log('PASS: real local D1 CRUD, persistence across requests, conflict, delete, missing owner, all PWA assets.');
