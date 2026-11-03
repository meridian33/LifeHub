import type {Task, Note, Tx, Data} from './domain';
import type {ExtraRecord} from './extra-domain';
async function request<T>(userId:string, body?:unknown):Promise<T> {
  const response=await fetch('/api/data',{method:body?'POST':'GET',cache:'no-store',headers:{'Content-Type':'application/json','X-LifeHub-User':userId},...(body?{body:JSON.stringify(body)}:{})});
  let result:unknown;
  try {result=await response.json();}
  catch {throw new Error('Не удалось прочитать ответ сервера. Изменения не подтверждены; обнови данные перед повтором.');}
  if(!response.ok) {
    const message=result&&typeof result==='object'&&'error' in result&&typeof result.error==='string'?result.error:'Не удалось выполнить запрос.';
    throw new Error(message);
  }
  if(!result||typeof result!=='object'||Array.isArray(result)||'error' in result) {
    throw new Error('Некорректный ответ сервера. Изменения не подтверждены; обнови данные перед повтором.');
  }
  return result as T;
}
export const loadData=(userId:string)=>request<Data>(userId);
export const saveTask=(userId:string,item:Task,isNew:boolean)=>request<Task>(userId,{action:'save',kind:'task',item,isNew});
export const saveNote=(userId:string,item:Note,isNew:boolean)=>request<Note>(userId,{action:'save',kind:'note',item,isNew});
export const saveTransaction=(userId:string,item:Tx,isNew:boolean)=>request<Tx>(userId,{action:'save',kind:'tx',item,isNew});
export const saveExtra=(userId:string,item:ExtraRecord,isNew:boolean)=>request<ExtraRecord>(userId,{action:'save',kind:item.kind,item,isNew});
export const deleteRecord=(userId:string,kind:string,id:string,version:number)=>request<void>(userId,{action:'delete',kind,id,version});
export const saveBudget=(userId:string,budget:number,version:number)=>request<{budget:number;version:number}>(userId,{action:'budget',budget,version});
export const importData=(userId:string,data:Data)=>request<void>(userId,{action:'import',data});
