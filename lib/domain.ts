export type Task = {id:string; title:string; done:boolean; priority:string; date:string; version:number};
export type Note = {id:string; title:string; body:string; date:string; version:number};
export type Tx = {id:string; name:string; amount:number; category:string; type:"expense"|"income"; date:string; impulse:boolean; version:number;accountId?:string};
export type ExtraKind = 'event'|'account'|'wish'|'transfer'|'subscription';
export type ExtraRecord = {
  id:string;kind:ExtraKind;title:string;date:string;version:number;
  amount?:number;accountId?:string;toAccountId?:string;note?:string;status?:'planned'|'bought'|'declined';repeat?:'none'|'weekly'|'monthly';
};

const kinds:ExtraKind[]=['event','account','wish','transfer','subscription'];
export function parseExtra(value:unknown):ExtraRecord {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Некорректная запись.');
  const row=value as Record<string,unknown>;
  if(!kinds.includes(row.kind as ExtraKind))throw new Error('Неизвестный тип записи.');
  if(typeof row.id!=='string'||!row.id.trim()||row.id.length>200)throw new Error('Некорректный идентификатор.');
  if(typeof row.title!=='string'||!row.title.trim()||row.title.length>150)throw new Error('Название должно содержать от 1 до 150 символов.');
  if(typeof row.date!=='string'||(row.date!==''&&!isISODate(row.date)))throw new Error('Некорректная дата.');
  const kind=row.kind as ExtraKind;
  const common={id:row.id,kind,title:row.title.trim(),date:row.date,version:0};
  if(kind==='account')return {...common,amount:row.amount===undefined||row.amount===0?0:parseMoney(row.amount)};
  if(kind==='event'){
    if(typeof row.note!=='string'||row.note.length>2000)throw new Error('Описание события слишком длинное.');
    if(row.repeat!==undefined&&!['none','weekly','monthly'].includes(String(row.repeat)))throw new Error('Некорректный повтор события.');
    return {...common,note:row.note,repeat:(row.repeat??'none') as ExtraRecord['repeat']};
  }
  if(kind==='transfer'){
    if(typeof row.accountId!=='string'||!row.accountId.trim()||typeof row.toAccountId!=='string'||!row.toAccountId.trim()||row.accountId===row.toAccountId)throw new Error('Выбери разные счета для перевода.');
    if(typeof row.amount!=='number')throw new Error('Укажи сумму перевода.');
    return {...common,amount:parseMoney(row.amount),accountId:row.accountId,toAccountId:row.toAccountId};
  }
  if(kind==='subscription'){
    if(typeof row.amount!=='number'||!isISODate(row.date))throw new Error('Укажи сумму и дату следующего платежа.');
    return {...common,amount:parseMoney(row.amount),accountId:typeof row.accountId==='string'?row.accountId:undefined};
  }
  if(typeof row.amount!=='number')throw new Error('Укажи стоимость покупки.');
  if(row.status!=='planned'&&row.status!=='bought'&&row.status!=='declined')throw new Error('Некорректный статус покупки.');
  if(row.note!==undefined&&(typeof row.note!=='string'||row.note.length>2000))throw new Error('Описание покупки слишком длинное.');
  return {...common,amount:parseMoney(row.amount),status:row.status,note:typeof row.note==='string'?row.note:''};
}

export type Data = {tasks:Task[]; notes:Note[]; transactions:Tx[]; extras?:ExtraRecord[]; budget:number; preferencesVersion:number};
export const initialData:Data = {tasks:[], notes:[], transactions:[], extras:[], budget:120000, preferencesVersion:0};
export function localDate(date = new Date()) {
  return [date.getFullYear(), String(date.getMonth()+1).padStart(2,"0"), String(date.getDate()).padStart(2,"0")].join("-");
}
export const currentMonth = () => localDate().slice(0,7);

// Compare calendar days in UTC so weekly repeats also work across DST changes.
export function eventOccurs(event:ExtraRecord, day:string):boolean {
  if (!isISODate(event.date) || !isISODate(day) || day < event.date) return false;
  if (day === event.date) return true;
  if (event.repeat === "weekly") return (Date.parse(day)-Date.parse(event.date)) % (7*86400000) === 0;
  if (event.repeat !== "monthly") return false;
  const [year,month] = day.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year,month,0)).getUTCDate();
  return Number(day.slice(-2)) === Math.min(Number(event.date.slice(-2)),lastDay);
}

export function nextEventDate(event:ExtraRecord, today:string):string|null {
  if (!isISODate(event.date) || !isISODate(today)) return null;
  if (event.date >= today) return event.date;
  if (event.repeat === "weekly") {
    const weeks = Math.ceil((Date.parse(today)-Date.parse(event.date))/(7*86400000));
    return new Date(Date.parse(event.date)+weeks*7*86400000).toISOString().slice(0,10);
  }
  if (event.repeat !== "monthly") return null;
  const [year,month] = today.split("-").map(Number);
  const occurrence = (offset:number) => {
    const date = new Date(Date.UTC(year,month-1+offset,1));
    const lastDay = new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();
    date.setUTCDate(Math.min(Number(event.date.slice(-2)),lastDay));
    return date.toISOString().slice(0,10);
  };
  const current = occurrence(0);
  return current >= today ? current : occurrence(1);
}

export function dashboardData(data:Data, month:string, today:string) {
  const priorityRank:Record<string,number>={"Высокий":0,"Средний":1,"Низкий":2};
  const tasks = data.tasks.filter(task=>!task.done).sort((a,b)=>(a.date||"9999-12-31").localeCompare(b.date||"9999-12-31") || (priorityRank[a.priority]??1)-(priorityRank[b.priority]??1));
  const transactions = data.transactions.filter(tx=>tx.date.slice(0,7)===month).sort((a,b)=>b.date.localeCompare(a.date));
  const noteDate = (date:string) => /^\d{2}\.\d{2}\.\d{4}$/.test(date) ? date.split(".").reverse().join("-") : date;
  const notes = [...data.notes].sort((a,b)=>noteDate(b.date).localeCompare(noteDate(a.date)));
  const upcoming = [
    ...tasks.filter(task=>task.date>=today).map(task=>({id:"task:"+task.id,title:task.title,date:task.date,kind:"task" as const})),
    ...(data.extras??[]).filter(record=>record.kind==="event").flatMap(event=>{
      const date=nextEventDate(event,today);
      return date ? [{id:"event:"+event.id,title:event.title,date,kind:"event" as const}] : [];
    }),
  ].sort((a,b)=>a.date.localeCompare(b.date));
  return {tasks,transactions,notes,upcoming};
}
export const formatMoney = (n:number) => new Intl.NumberFormat("ru-RU",{maximumFractionDigits:2}).format(n)+" ₸";
export function parseMoney(value:unknown):number {
  const text = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim().replace(",",".") : "";
  if (!/^\d+(\.\d{1,2})?$/.test(text)) throw new Error("Сумма должна быть положительным числом, не более двух знаков после запятой.");
  const amount = Number(text);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 999999999.99) throw new Error("Сумма должна быть от 0,01 до 999 999 999,99 ₸.");
  return Math.round(amount*100)/100;
}
export function isISODate(value:string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year,month,day] = value.split("-").map(Number);
  if (year < 1900 || year > 9999 || month < 1 || month > 12 || day < 1) return false;
  return day <= new Date(Date.UTC(year,month,0)).getUTCDate();
}
export function summarizeMonth(transactions:Tx[], month:string) {
  let income = 0, expense = 0, impulseTotal = 0;
  const categories = new Map<string,number>();
  for (const tx of transactions) {
    if (tx.date.slice(0,7) !== month) continue;
    const cents = Math.round(tx.amount*100);
    if (tx.type === "income") income += cents;
    else {
      expense += cents;
      if (tx.impulse) impulseTotal += cents;
      categories.set(tx.category,(categories.get(tx.category) ?? 0)+cents);
    }
  }
  return {income:income/100,expense:expense/100,balance:(income-expense)/100,impulseTotal:impulseTotal/100,
    categories:[...categories].map(([category,amount])=>({category,amount:amount/100})).sort((a,b)=>b.amount-a.amount)};
}
function object(value:unknown):Record<string,unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Некорректный объект в резервной копии.");
  return value as Record<string,unknown>;
}
function text(value:unknown, field:string, max:number, empty=false):string {
  if (typeof value !== "string" || value.length > max || (!empty && !value.trim())) throw new Error("Некорректное поле: "+field);
  return value;
}
function boolean(value:unknown,field:string) {
  if (typeof value !== "boolean") throw new Error("Некорректное поле: "+field);
  return value;
}
function date(value:unknown,empty=false) {
  if (empty && value === "") return "";
  if (typeof value !== "string" || !isISODate(value)) throw new Error("Некорректная дата. Нужен формат ГГГГ-ММ-ДД.");
  return value;
}
export function parseBackup(raw:string):Data {
  if (new TextEncoder().encode(raw).length > 5*1024*1024) throw new Error("Размер резервной копии больше 5 МБ.");
  let parsed:unknown;
  try {parsed = JSON.parse(raw);} catch {throw new Error("Файл не является корректным JSON.");}
  let source = object(parsed);
  if ("schemaVersion" in source) {
    if (source.schemaVersion !== 3 && source.schemaVersion !== 4) throw new Error("Эта версия резервной копии не поддерживается.");
    source = object(source.data);
  }
  const arrays = ["tasks","notes","transactions"].map(key => {
    const rows = source[key];
    if (!Array.isArray(rows)) throw new Error("В резервной копии отсутствует список "+key);
    return rows;
  });
  if (arrays.reduce((sum,rows)=>sum+rows.length,0)>10000) throw new Error("Не более 10 000 записей за один импорт.");
  const read = <T>(rows:unknown[], map:(row:Record<string,unknown>,id:string)=>T) => {
    const ids = new Set<string>();
    return rows.map(value => {
      const row = object(value), id = text(row.id,"id",200);
      if (ids.has(id)) throw new Error("Повторяющийся идентификатор в резервной копии.");
      ids.add(id);
      return map(row,id);
    });
  };
  const tasks = read(arrays[0],(r,id):Task => {
    if (!["Низкий","Средний","Высокий"].includes(String(r.priority))) throw new Error("Некорректный приоритет задачи.");
    return {id,title:text(r.title,"Название",150),done:boolean(r.done,"Статус"),priority:String(r.priority),date:date(r.date,true),version:0};
  });
  const notes = read(arrays[1],(r,id):Note => ({id,title:text(r.title,"Заголовок",150),body:text(r.body,"Текст",50000,true),date:text(r.date,"Дата заметки",100,true),version:0}));
  const transactions = read(arrays[2],(r,id):Tx => {
    if (r.type !== "expense" && r.type !== "income") throw new Error("Некорректный тип операции.");
    const impulse = boolean(r.impulse,"Импульсивная покупка");
    if (r.type === "income" && impulse) throw new Error("Доход не может быть импульсивной покупкой.");
    if (typeof r.amount !== "number") throw new Error("Сумма в JSON должна быть числом.");
    if(r.accountId!==undefined&&(typeof r.accountId!=='string'||r.accountId.length>200))throw new Error('Некорректный счёт операции.');
    return {id,name:text(r.name,"Описание",150),amount:parseMoney(r.amount),category:text(r.category,"Категория",100),type:r.type,date:date(r.date),impulse,version:0,...(r.accountId?{accountId:r.accountId as string}:{})};
  });
  if (typeof source.budget !== "number") throw new Error("Бюджет в JSON должен быть числом.");
  const extras=source.extras===undefined?[]:Array.isArray(source.extras)?source.extras.map(parseExtra):(()=>{throw new Error('Некорректный список дополнительных записей.');})();
  const extraIds=new Set<string>();
  for(const item of extras){const key=item.kind+':'+item.id;if(extraIds.has(key))throw new Error('Повторяющийся идентификатор в резервной копии.');extraIds.add(key);}
  if(extras.length+arrays.reduce((sum,rows)=>sum+rows.length,0)>10000)throw new Error('Не более 10 000 записей за один импорт.');
  return {tasks,notes,transactions,extras,budget:parseMoney(source.budget),preferencesVersion:0};
}
export const createBackup = (data:Data) => JSON.stringify({schemaVersion:4,exportedAt:new Date().toISOString(),data},null,2);
export function transactionsCSV(transactions:Tx[]) {
  const cell = (value:string|number) => {
    let s = String(value);
    if (/^[\s\u0000-\u001f]*[=+@-]/.test(s) || /^[\t\r\n]/.test(s)) s = "'"+s;
    return '"'+s.replace(/"/g,'""')+'"';
  };
  const rows:Array<Array<string|number>> = [["Дата","Описание","Тип","Категория","Сумма (KZT)","Импульсивная"]];
  for (const tx of transactions) rows.push([tx.date,tx.name,tx.type==="expense"?"Расход":"Доход",tx.category,tx.amount.toFixed(2),tx.impulse?"Да":"Нет"]);
  return "\uFEFF"+rows.map(row=>row.map(cell).join(";")).join("\r\n");
}
