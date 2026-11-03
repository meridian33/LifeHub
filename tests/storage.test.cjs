const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const source=ts.transpileModule(fs.readFileSync('lib/storage.ts','utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
function client(response){
  const module={exports:{}},calls=[];
  new Function('exports','fetch',source)(module.exports,async(url,options)=>{
    calls.push({url,...options});return response;
  });
  return {...module.exports,calls};
}
test('invalid successful responses never confirm writes or imports',async()=>{
  for(const body of ['<html>Sign in</html>','null','[]','"ok"','{"error":"failed"}']){
    const c=client(new Response(body,{status:200}));
    await assert.rejects(c.importData('owner',{}),/ответ сервера/);
    assert.equal(c.calls.length,1,'uncertain writes must not be retried automatically');
  }
});
test('HTTP errors preserve server message and tolerate null bodies',async()=>{
  for(const [body,message] of [['{"error":"Конфликт"}',/Конфликт/],['null',/выполнить запрос/]]){
    await assert.rejects(client(new Response(body,{status:409})).loadData('owner'),message);
  }
});
test('successful request pins owner, avoids cache and sends one mutation',async()=>{
  const saved={id:'task',title:'Plan',version:1};
  const c=client(Response.json(saved));
  assert.deepEqual(await c.saveTask('alice',saved,false),saved);
  assert.equal(c.calls.length,1);
  assert.equal(c.calls[0].headers['X-LifeHub-User'],'alice');
  assert.equal(c.calls[0].cache,'no-store');
  assert.deepEqual(JSON.parse(c.calls[0].body),{action:'save',kind:'task',item:saved,isNew:false});
});
