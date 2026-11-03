"use client";
import Link from "./section-link";
import {useEffect, useRef, useState, type ReactNode} from "react";
import {LayoutDashboard,ListTodo,NotebookPen,Wallet,Settings,Plus,Sun,Moon,Check,Trash2,X,MoreHorizontal,Heart,ArrowRight,Download,Upload,RefreshCw,Search,Cloud,Zap,CalendarDays,ShoppingBag,type LucideIcon} from "lucide-react";
import {useTheme} from "@/hooks/use-theme";

import {useLifeHub,errorMessage} from "@/hooks/use-lifehub";
import {createBackup,currentMonth,formatMoney as money,isISODate,localDate,parseBackup,parseMoney,summarizeMonth,transactionsCSV,type Data,type Task,type Note,type Tx} from "@/lib/domain";
import {deleteRecord,importData,loadData,saveBudget,saveNote,saveTask,saveTransaction,saveExtra} from "@/lib/storage";
import type {ExtraRecord} from "@/lib/extra-domain";
import {CalendarView,WishlistView} from "./planning-views";
import DashboardView from "./dashboard-view";
import FinanceAccounts from "./finance-accounts";

// Section links use the statically imported router in production.
const nav = [{id:"dashboard",name:"Главная",icon:LayoutDashboard},{id:"tasks",name:"Задачи",icon:ListTodo},{id:"notes",name:"Заметки",icon:NotebookPen},{id:"finances",name:"Финансы",icon:Wallet},{id:"calendar",name:"Календарь",icon:CalendarDays},{id:"wishlist",name:"Желания",icon:ShoppingBag},{id:"settings",name:"Настройки",icon:Settings}] as const;
type Kind = "task"|"note"|"tx";
type Editor = {kind:Kind; record?:Task|Note|Tx};
const dateLabel = (date:string) => isISODate(date) ? date.split("-").reverse().join(".") : date || "Без даты";
const download = (text:string,name:string,type:string) => {
  const url = URL.createObjectURL(new Blob([text],{type}));
  const a = document.createElement("a"); a.href=url; a.download=name; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
};
function Metric({label,value,note}:{label:string;value:string|number;note?:string}) {
  return <div className="card"><div className="metriclabel">{label}</div><div className="metric">{value}</div>{note&&<div className="metanote">{note}</div>}</div>;
}
function SearchField({label,placeholder,value,onChange}:{label:string;placeholder:string;value:string;onChange:(value:string)=>void}) {
  return <label className="search-field"><span className="sr-only">{label}</span><Search size={18} aria-hidden="true"/><input type="search" className="search" placeholder={placeholder} value={value} onChange={e=>onChange(e.target.value)}/></label>;
}
function Segmented({label,value,options,onChange}:{label:string;value:string;options:{value:string;label:string}[];onChange:(value:string)=>void}) {
  return <div className="segmented" role="group" aria-label={label}>{options.map(option=><button key={option.value} type="button" aria-pressed={option.value===value} onClick={()=>onChange(option.value)}>{option.label}</button>)}</div>;
}
function EmptyState({icon:Icon,title,description,action,onAction,disabled}:{icon:LucideIcon;title:string;description:string;action?:string;onAction?:()=>void;disabled?:boolean}) {
  return <div className="empty"><Icon size={28} aria-hidden="true"/><h3>{title}</h3><p>{description}</p>{action&&<button className="quietlink" disabled={disabled} onClick={onAction}>{action}<ArrowRight size={16}/></button>}</div>;
}
function SettingsGroup({title,children}:{title:string;children:ReactNode}) {
  return <section className="settings-group"><h2>{title}</h2><div className="card settings-card">{children}</div></section>;
}
function Dialog({title,close,busy,children}:{title:string;close:()=>void;busy:boolean;children:ReactNode}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(()=>{
    const dialog=ref.current;
    const trigger=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const scrollY=window.scrollY;
    const previousBodyStyle=document.body.style.cssText;
    Object.assign(document.body.style,{position:"fixed",top:`-${scrollY}px`,width:"100%"});
    const viewport=window.visualViewport;
    const fit=()=>{
      if(!dialog||!viewport)return;
      dialog.style.setProperty("--visible-height",`${viewport.height}px`);
      dialog.style.setProperty("--visible-top",`${viewport.offsetTop}px`);
    };
    fit();
    viewport?.addEventListener("resize",fit);
    viewport?.addEventListener("scroll",fit);
    window.addEventListener("resize",fit);
    dialog?.showModal();
    dialog?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    return()=>{
      dialog?.close();
      viewport?.removeEventListener("resize",fit);
      viewport?.removeEventListener("scroll",fit);
      window.removeEventListener("resize",fit);
      document.body.style.cssText=previousBodyStyle;
      window.scrollTo(0,scrollY);
      // React may remove the dialog before effect cleanup; restore focus explicitly.
      queueMicrotask(()=>{
        if(document.querySelector("dialog[open]"))return;
        const target=trigger?.isConnected?trigger:document.querySelector<HTMLElement>(".sectionheader .button");
        target?.focus({preventScroll:true});
      });
    };
  },[]);
  return <dialog ref={ref} className="modal" aria-labelledby="dialog-title" onKeyDown={e=>{
    if(e.key!=="Tab")return;
    const controls=Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href]')).filter(element=>element.getClientRects().length&&!element.closest("fieldset[disabled]"));
    const first=controls[0],last=controls[controls.length-1];
    if(!first){e.preventDefault();return;}
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  }} onCancel={e=>{e.preventDefault();if(!busy)close();}}>
    <div className="modalhead"><h2 className="cardtitle" id="dialog-title">{title}</h2><button type="button" className="iconbtn" aria-label="Закрыть" disabled={busy} onClick={close}><X size={18}/></button></div>{children}
  </dialog>;
}

function RecordEditor({editor,busy,error,onSave,onDelete,onClose,onDirty,accounts}:{editor:Editor;busy:boolean;error:string;accounts:ExtraRecord[];
  onSave:(item:Task|Note|Tx,isNew:boolean)=>Promise<boolean>;onDelete:()=>Promise<boolean>;onClose:()=>void;onDirty:(dirty:boolean)=>void}) {
  const {kind,record}=editor;
  const [title,setTitle]=useState(record ? "title" in record ? record.title : record.name : "");
  const [body,setBody]=useState(record&&"body" in record?record.body:"");
  const [priority,setPriority]=useState(record&&"priority" in record?record.priority:"Средний");
  const [date,setDate]=useState(record?.date || (kind==="tx"?localDate():""));
  const [amount,setAmount]=useState(record&&"amount" in record?String(record.amount):"");
  const [category,setCategory]=useState(record&&"category" in record?record.category:"Еда");
  const [type,setType]=useState<"expense"|"income">(record&&"type" in record?record.type:"expense");
  const [impulse,setImpulse]=useState(record&&"impulse" in record?record.impulse:false);
  const [accountId,setAccountId]=useState(record&&"accountId" in record?record.accountId??"":"");
  const [validation,setValidation]=useState("");
  const [validationField,setValidationField]=useState("");
  const save = async (e:React.FormEvent) => {
    e.preventDefault();setValidation("");setValidationField("");
    let invalidField="record-title";
    try {
      if (!title.trim() || title.trim().length>150) throw new Error("Введи название длиной до 150 символов.");
      invalidField=kind==="tx"?"tx-date":"due";
      if (kind!=="note" && date && !isISODate(date)) throw new Error("Проверь дату.");
      const common={id:record?.id??crypto.randomUUID(),version:record?.version??0};
      let item:Task|Note|Tx;
      if(kind==="task") item={...common,title:title.trim(),done:record&&"done" in record?record.done:false,priority,date};
      else if(kind==="note") item={...common,title:title.trim(),body,date:localDate()};
      else {invalidField="amount";item={...common,name:title.trim(),amount:parseMoney(amount),category:type==="income"?"Доход":category,type,date:date||localDate(),impulse:type==="expense"&&impulse,accountId};}
      if (await onSave(item,!record)) {onDirty(false);onClose();}
    } catch(e) {setValidation(errorMessage(e));setValidationField(invalidField);document.getElementById(invalidField)?.focus();}
  };
  return <Dialog title={record?"Редактировать":kind==="task"?"Новая задача":kind==="note"?"Новая заметка":"Новая операция"} busy={busy} close={onClose}>
    <form onSubmit={save} onChange={()=>onDirty(true)}>
      <fieldset disabled={busy} className="editor-fields">
        <div className="field"><label htmlFor="record-title">{kind==="tx"?"Описание операции":"Название"}</label><input aria-invalid={validationField==="record-title"||undefined} aria-describedby={validationField==="record-title"?"record-validation":undefined} id="record-title" data-autofocus required maxLength={150} value={title} onChange={e=>setTitle(e.target.value)}/>{validation&&validationField==="record-title"&&<p id="record-validation" className="field-error" role="alert">{validation}</p>}</div>
        {kind==="task"&&<><div className="field"><label htmlFor="priority">Приоритет</label><select id="priority" value={priority} onChange={e=>setPriority(e.target.value)}>{["Низкий","Средний","Высокий"].map(p=><option key={p}>{p}</option>)}</select></div><div className="field"><label htmlFor="due">Срок (необязательно)</label><input aria-invalid={validationField==="due"||undefined} aria-describedby={validationField==="due"?"record-validation":undefined} id="due" type="date" min="1900-01-01" max="9999-12-31" value={date} onChange={e=>setDate(e.target.value)}/>{validation&&validationField==="due"&&<p id="record-validation" className="field-error" role="alert">{validation}</p>}</div></>}
        {kind==="note"&&<div className="field"><label htmlFor="note-body">Текст</label><textarea id="note-body" maxLength={50000} value={body} onChange={e=>setBody(e.target.value)} placeholder="Начни писать…"/></div>}
        {kind==="tx"&&<><div className="field"><label htmlFor="tx-type">Тип операции</label><select id="tx-type" value={type} onChange={e=>setType(e.target.value as "expense"|"income")}><option value="expense">Расход</option><option value="income">Доход</option></select></div><div className="field"><label htmlFor="tx-account">Счёт</label><select id="tx-account" value={accountId} onChange={e=>setAccountId(e.target.value)}><option value="">Без счёта</option>{accounts.map(account=><option key={account.id} value={account.id}>{account.title}</option>)}</select></div>
          <div className="field"><label htmlFor="amount">Сумма (₸)</label><input aria-invalid={validationField==="amount"||undefined} aria-describedby={validationField==="amount"?"record-validation":undefined} id="amount" required inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0,00"/>{validation&&validationField==="amount"&&<p id="record-validation" className="field-error" role="alert">{validation}</p>}</div>
          {type==="expense"&&<><div className="field"><label htmlFor="category">Категория</label><select id="category" value={category} onChange={e=>setCategory(e.target.value)}>{[...new Set(["Еда","Транспорт","Покупки","Развлечения","Учеба","Здоровье","Другое",category])].map(c=><option key={c}>{c}</option>)}</select></div><label className="checkbox-label"><input type="checkbox" checked={impulse} onChange={e=>setImpulse(e.target.checked)}/>Импульсивная покупка</label></>}
          <div className="field"><label htmlFor="tx-date">Дата</label><input aria-invalid={validationField==="tx-date"||undefined} aria-describedby={validationField==="tx-date"?"record-validation":undefined} id="tx-date" required type="date" min="1900-01-01" max="9999-12-31" value={date} onChange={e=>setDate(e.target.value)}/>{validation&&validationField==="tx-date"&&<p id="record-validation" className="field-error" role="alert">{validation}</p>}</div></>}
        {error&&<div className="authalert" role="alert">{error}</div>}
        <div className="modalactions">{record&&<button type="button" className="button secondary danger" aria-label="Удалить запись" onClick={async()=>{if(confirm("Удалить эту запись?")&&await onDelete()){onDirty(false);onClose();}}}><Trash2 size={17}/>Удалить</button>}<button type="button" className="button secondary" onClick={onClose}>Отмена</button><button type="submit" className="button">{busy?"Сохранение…":"Сохранить"}</button></div>
      </fieldset>
    </form>
  </Dialog>;
}

export default function LifeHub({section}:{section:string}) {
  const hub=useLifeHub();
  const {user,data,ready,busy,refreshing,status,error,online,authLoading,authError}=hub;
  const unavailable=busy||refreshing;
  const current=nav.find(n=>n.id===section)?.id??"dashboard";
  const {theme,preference,selectTheme,accent,selectAccent,density,selectDensity,font,selectFont,changeTheme}=useTheme();
  const [editor,setEditor]=useState<Editor|null>(null),[choose,setChoose]=useState(false);
  const [capture,setCapture]=useState(false),[captureText,setCaptureText]=useState(""),[captureKind,setCaptureKind]=useState<"auto"|Kind>("auto"),[captureError,setCaptureError]=useState("");
  const [searches,setSearches]=useState<Record<string,{query:string;filter:string}>>({});
  const {query,filter}=searches[current]??{query:"",filter:"all"};
  const setQuery=(query:string)=>setSearches(previous=>({...previous,[current]:{query,filter}}));
  const setFilter=(filter:string)=>setSearches(previous=>({...previous,[current]:{query,filter}}));
  const [month,setMonth]=useState(currentMonth);
  const [budgetError,setBudgetError]=useState("");
  const [budget,setBudget]=useState("120000"),[pendingImport,setPendingImport]=useState<Data|null>(null),[importName,setImportName]=useState("");
  const dirty=useRef(false),fileInput=useRef<HTMLInputElement>(null);
  const budgetDirty=current==="finances"&&budget!==String(data.budget);
  useEffect(()=>{setBudget(String(data.budget));},[data.budget]);
  useEffect(()=>{
    const beforeUnload=(e:BeforeUnloadEvent)=>{if(dirty.current||budgetDirty||busy){e.preventDefault();}};
    window.addEventListener("beforeunload",beforeUnload);
    return()=>window.removeEventListener("beforeunload",beforeUnload);
  },[busy,budgetDirty]);
  useEffect(()=>{setBudgetError("");setEditor(null);setChoose(false);setPendingImport(null);},[current]);
  const closeEditor=()=>{if(busy)return;if(dirty.current&&!confirm("Закрыть форму без сохранения изменений?"))return;dirty.current=false;setEditor(null);hub.setError("");};
  const open=(kind:Kind,record?:Task|Note|Tx)=>{hub.setError("");dirty.current=false;setEditor({kind,record});};
  const save=async(item:Task|Note|Tx,isNew:boolean)=>hub.perform(async()=>{
    if(!user||!editor)return;
    if(editor.kind==="task"){const saved=await saveTask(user.id,item as Task,isNew);return {...data,tasks:isNew?[saved,...data.tasks]:data.tasks.map(t=>t.id===saved.id?saved:t)};}
    if(editor.kind==="note"){const saved=await saveNote(user.id,item as Note,isNew);return {...data,notes:isNew?[saved,...data.notes]:data.notes.map(n=>n.id===saved.id?saved:n)};}
    const saved=await saveTransaction(user.id,item as Tx,isNew);return {...data,transactions:isNew?[saved,...data.transactions]:data.transactions.map(t=>t.id===saved.id?saved:t)};
  });
  const remove=async()=>hub.perform(async()=>{
    if(!user||!editor?.record)return;
    const {kind,record}=editor;await deleteRecord(user.id,kind,record.id,record.version);
    return {...data,tasks:kind==="task"?data.tasks.filter(t=>t.id!==record.id):data.tasks,notes:kind==="note"?data.notes.filter(n=>n.id!==record.id):data.notes,transactions:kind==="tx"?data.transactions.filter(t=>t.id!==record.id):data.transactions};
  },"Запись удалена");
  const toggle=async(task:Task)=>hub.perform(async()=>{
    const saved=await saveTask(user!.id,{...task,done:!task.done},false);
    return {...data,tasks:data.tasks.map(t=>t.id===task.id?saved:t)};
  });
  const saveAdditional=async(item:ExtraRecord,isNew:boolean)=>hub.perform(async()=>{
    const saved=await saveExtra(user!.id,item,isNew);
    return {...data,extras:[saved,...(data.extras??[]).filter(record=>record.id!==saved.id)]};
  },"Запись сохранена");
  const removeAdditional=async(item:ExtraRecord)=>hub.perform(async()=>{
    await deleteRecord(user!.id,item.kind,item.id,item.version);
    return {...data,extras:(data.extras??[]).filter(record=>record.id!==item.id)};
  },"Запись удалена");
  const reload=async()=>{if(busy)return;if((dirty.current||budgetDirty)&&!confirm("Обновить данные и отменить несохранённые изменения?"))return;dirty.current=false;setEditor(null);setBudget(String(data.budget));await hub.reload();};
  const signOut=async()=>{
    if(busy||(dirty.current||budgetDirty)&&!confirm("Выйти без сохранения изменений?"))return;
    window.location.assign('/signout-with-chatgpt?return_to=/');
  };
  const exportJSON=()=>download(createBackup(data),"lifehub-"+localDate()+".json","application/json;charset=utf-8");
  const prepareImport=async(file?:File)=>{
    if(!file)return;
    hub.setError("");
    try{if(file.size>5*1024*1024)throw new Error("Максимальный размер файла — 5 МБ.");const imported=parseBackup(await file.text());setPendingImport(imported);setImportName(file.name);}
    catch(e){hub.setError(errorMessage(e));}
    finally{if(fileInput.current)fileInput.current.value="";}
  };
  const confirmImport=async()=>{
    if(!pendingImport||!user)return;
    let committed=false;
    const ok=await hub.perform(async()=>{
      await importData(user.id,pendingImport);committed=true;setPendingImport(null);
      return await loadData(user.id);
    },"Импорт завершён");
    if(!ok&&committed)hub.setError("Импорт сохранён, но обновить список не удалось. Нажми «Обновить». Не импортируй файл повторно.");
  };
  const addExamples=()=>{
    setImportName("Демонстрационные записи");
    setPendingImport({budget:data.budget,preferencesVersion:0,extras:[],tasks:[{id:"demo-task",title:"Познакомиться с LifeHub",done:false,priority:"Средний",date:localDate(),version:0}],notes:[{id:"demo-note",title:"Моё пространство",body:"Здесь можно хранить идеи и планы. Эта заметка сохранится в облаке.",date:localDate(),version:0}],transactions:[{id:"demo-tx",name:"Пример: кофе",amount:1500,category:"Еда",type:"expense",date:localDate(),impulse:false,version:0}]});
  };
  const captureMatch=captureText.trim().match(/^(.+?)\s+(\d+(?:[.,]\d{1,2})?)\s*(?:₸|тг)?$/i);
  const inferredKind:Kind=captureKind!=="auto"?captureKind:captureMatch?"tx":/(?:^|\s)(?:завтра|сегодня)(?:\s|$)/i.test(captureText)?"task":"note";
  const saveCapture=async()=>{
    const value=captureText.trim();setCaptureError("");
    if(!value||value.length>150){setCaptureError("Введи текст длиной до 150 символов.");return;}
    try{
      const id=crypto.randomUUID(),today=localDate();
      const ok=await hub.perform(async()=>{
        if(inferredKind==="task"){
          const tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);
          const date=/(?:^|\s)завтра(?:\s|$)/i.test(value)?localDate(tomorrow):/(?:^|\s)сегодня(?:\s|$)/i.test(value)?today:"";
          const item=await saveTask(user!.id,{id,title:value.replace(/\s+(завтра|сегодня)$/i,"").trim(),date,done:false,priority:"Средний",version:0},true);
          return {...data,tasks:[item,...data.tasks]};
        }
        if(inferredKind==="tx"){
          if(!captureMatch)throw new Error("Для расхода введи название и сумму, например «Такси 2500».");
          const item=await saveTransaction(user!.id,{id,name:captureMatch[1],amount:parseMoney(captureMatch[2]),category:"Другое",type:"expense",date:today,impulse:false,version:0},true);
          return {...data,transactions:[item,...data.transactions]};
        }
        const item=await saveNote(user!.id,{id,title:value,body:"",date:today,version:0},true);
        return {...data,notes:[item,...data.notes]};
      },"Запись добавлена");
      if(ok){setCapture(false);setCaptureText("");setCaptureKind("auto");}
    }catch(error){setCaptureError(errorMessage(error));}
  };
  const summary=summarizeMonth(data.transactions,month);
  const monthTx=data.transactions.filter(t=>t.date.startsWith(month+"-"));
  const done=data.tasks.filter(t=>t.done).length;
  const today=localDate();
  const search=query.trim().toLowerCase();
  const tasks=data.tasks.filter(t=>t.title.toLowerCase().includes(search)&&(filter==="all"||filter==="done"&&t.done||filter==="open"&&!t.done||filter==="today"&&!t.done&&t.date===today||filter==="overdue"&&!t.done&&Boolean(t.date)&&t.date<today));
  const notes=data.notes.filter(n=>(n.title+" "+n.body).toLowerCase().includes(search));
  const transactions=monthTx.filter(t=>(t.name+" "+t.category).toLowerCase().includes(search)&&(filter==="all"||t.type===filter)).sort((a,b)=>b.date.localeCompare(a.date));
  const resetFilters=()=>setSearches(previous=>({...previous,[current]:{query:"",filter:"all"}}));
  const filtered=Boolean(query)||filter!=="all";
  const taskRows=(items:Task[])=>items.length?items.map(t=><div className="taskrow" key={t.id}>
    <button className={"check "+(t.done?"done":"")} disabled={unavailable||!online} onClick={()=>void toggle(t)} aria-pressed={t.done} aria-label={t.done?"Отменить выполнение "+t.title:"Выполнить "+t.title}>{t.done&&<Check size={14}/>}</button>
    <div className="task-description"><span className={"taskname "+(t.done?"done":"")}>{t.title}</span><div className="task-meta">{t.date&&<small className={!t.done&&t.date<today?"overdue":"smallmuted"}>{!t.done&&t.date<today?"Просрочено · ":!t.done&&t.date===today?"Сегодня · ":""}{dateLabel(t.date)}</small>}<span className={"pill "+(t.priority==="Высокий"?"priority-high":"")}>{t.priority}</span></div></div>
    <button className="iconbtn" title="Редактировать задачу" disabled={unavailable} onClick={()=>open("task",t)} aria-label={"Редактировать задачу "+t.title}><MoreHorizontal size={20}/></button>
  </div>):<EmptyState icon={ListTodo} title={filtered?"Задачи не найдены":current==="dashboard"&&data.tasks.length?"Всё выполнено":"Пока нет задач"} description={filtered?"Попробуй другой запрос или сбрось фильтры.":"Добавь следующий шаг — и освободи место для главного."} action={filtered?"Сбросить фильтры":"Добавить задачу"} onAction={filtered?resetFilters:()=>open("task")} disabled={unavailable}/>;
  const noteCards=(items:Note[])=>items.length?<div className="notegrid">{items.map(n=><button className="card notecard" key={n.id} disabled={unavailable} onClick={()=>open("note",n)}><h2 className="cardtitle">{n.title}</h2><div className="notebody">{n.body||"Пустая заметка"}</div><div className="notedate">{dateLabel(n.date)}</div></button>)}</div>:<div className="card"><EmptyState icon={NotebookPen} title={query?"Заметки не найдены":"Место для твоих мыслей"} description={query?"Попробуй другое название или слово из текста.":"Сохрани идею, план или то, что хочется запомнить."} action={query?"Очистить поиск":"Создать заметку"} onAction={query?()=>setQuery(""):()=>open("note")} disabled={unavailable}/></div>;
  const txTable=(items:Tx[])=>items.length?<div className="tablewrap"><table className="table"><caption className="sr-only">Операции за {month}</caption><thead><tr><th scope="col">Операция</th><th scope="col">Категория</th><th scope="col">Дата</th><th scope="col">Сумма</th><th scope="col"><span className="sr-only">Действия</span></th></tr></thead><tbody>{items.map(t=><tr key={t.id}><td>{t.name}{t.impulse&&<><Zap size={14} className="impulse-icon" aria-hidden="true"/><span className="sr-only">Импульсивная покупка</span></>}<small className="mobile-date">{t.category} · {dateLabel(t.date)}</small></td><td>{t.category}</td><td>{dateLabel(t.date)}</td><td className={"money "+(t.type==="income"?"positive":"negative")}><span className="sr-only">{t.type==="income"?"Доход: ":"Расход: "}</span>{t.type==="income"?"+":"−"}{money(t.amount)}</td><td><button className="iconbtn" title="Редактировать операцию" disabled={unavailable} onClick={()=>open("tx",t)} aria-label={"Редактировать операцию "+t.name}><MoreHorizontal size={20}/></button></td></tr>)}</tbody></table></div>:<EmptyState icon={Wallet} title={filtered?"Операции не найдены":"В этом месяце пока пусто"} description={filtered?"Измени запрос или тип операции.":"Добавь доход или расход, чтобы увидеть сводку."} action={filtered?"Сбросить фильтры":"Добавить операцию"} onAction={filtered?resetFilters:()=>open("tx")} disabled={unavailable}/>;
  const monthPicker=<div className="month-picker"><label htmlFor="report-month">Период отчёта</label><input id="report-month" type="month" min="1900-01" max="9999-12" value={month} onChange={e=>{if(/^\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value))setMonth(e.target.value);}}/></div>;
  const budgetCard=<section className={"card "+(summary.expense>data.budget?"budget-over":"")}><div className="cardhead"><h2 className="cardtitle">Месячный бюджет</h2><span className="pill">{month}</span></div><div className="smallmuted">{summary.expense>data.budget?"Превышение бюджета":"Осталось на месяц"}</div><div className="metric">{money(Math.abs(Math.round((data.budget-summary.expense)*100)/100))}</div><div className="progressbg" role="progressbar" aria-label="Использовано бюджета" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100,Math.round(summary.expense/data.budget*100))} aria-valuetext={money(summary.expense)+" из "+money(data.budget)}><div className="progressbar" style={{width:Math.min(100,summary.expense/data.budget*100)+"%"}}/></div><p className="hint">Потрачено {money(summary.expense)} из {money(data.budget)}. На импульсивные покупки: {money(summary.impulseTotal)}.</p>
    {current==="finances"&&<form onSubmit={async e=>{e.preventDefault();setBudgetError("");let amount:number;try{amount=parseMoney(budget);}catch(error){setBudgetError(errorMessage(error));document.getElementById("budget")?.focus();return;}const ok=await hub.perform(async()=>{const result=await saveBudget(user!.id,amount,data.preferencesVersion);return {...data,budget:result.budget,preferencesVersion:result.version};});if(ok)dirty.current=false;}}><div className="field"><label htmlFor="budget">Лимит на каждый месяц (₸)</label><input id="budget" aria-invalid={Boolean(budgetError)||undefined} aria-describedby={budgetError?"budget-error":undefined} inputMode="decimal" value={budget} disabled={unavailable} onChange={e=>setBudget(e.target.value)}/>{budgetError&&<p id="budget-error" className="field-error" role="alert">{budgetError}</p>}</div><button type="submit" className="button secondary" disabled={unavailable||!online}>Сохранить лимит</button><p className="hint">Один лимит применяется ко всем месяцам.</p></form>}
  </section>;

  if(authLoading)return <div className="authscreen"><div className="authcard" role="status" aria-busy="true"><div className="authmark"><Heart size={24}/></div><h1>LifeHub</h1><p>Проверяем сессию…</p><div className="skeleton" aria-hidden="true"/><div className="skeleton short" aria-hidden="true"/></div></div>;
  if(!user)return <div className="authscreen"><div className="authcard"><div className="authmark"><Heart size={24}/></div><h1>LifeHub</h1><p>Твоё личное пространство для задач, заметок и финансов.</p>{authError&&<div className="authalert" role="alert">{authError}</div>}<a className="button" href="/signin-with-chatgpt?return_to=/" target="_top">Войти через ChatGPT</a><small>Приватное пространство. Отдельный пароль LifeHub не нужен.</small></div></div>;
  if(!ready)return <div className="authscreen"><div className="authcard"><h1>LifeHub</h1><p role="status" aria-busy={refreshing}>{status}</p>{error&&<div className="authalert" role="alert">{error}</div>}<div className="toolbar"><button className="button" disabled={refreshing} onClick={()=>void hub.reload()}>{refreshing?"Загрузка…":"Повторить"}</button><button className="button secondary" onClick={()=>void signOut()}>Выйти</button></div></div></div>;
  return <div className="app" onClickCapture={e=>{if(!(e.target instanceof Element))return;const link=e.target.closest<HTMLAnchorElement>("a[href]");if(!link)return;const target=new URL(link.href);if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||link.target==="_blank"||link.hasAttribute("download")||(target.origin===location.origin&&target.pathname===location.pathname&&target.search===location.search))return;if(busy||(dirty.current||budgetDirty)&&!confirm("Перейти без сохранения изменений?")){e.preventDefault();e.stopPropagation();}else {dirty.current=false;setBudget(String(data.budget));}}}>
    <a className="skip-link" href="#main-content">К содержимому</a><aside className="sidebar"><Link className="logo" href="/"><span className="logo-icon"><Heart size={19}/></span>LifeHub</Link><nav className="navgroup" aria-label="Основная навигация"><div className="navlabel">Моё пространство</div>{nav.slice(0,-1).map(n=><Link key={n.id} aria-current={current===n.id?"page":undefined} className={"nav "+(current===n.id?"active":"")} href={n.id==="dashboard"?"/":"/"+n.id}><n.icon size={18}/>{n.name}</Link>)}</nav><div className="sidebar-bottom"><Link href="/settings" aria-current={current==="settings"?"page":undefined} className={"nav "+(current==="settings"?"active":"")}><Settings size={18}/>Настройки</Link><div className="profile"><div className="avatar">Я</div><div className="profile-text"><b>Личный аккаунт</b><div className="smallmuted">{user.email}</div></div></div></div></aside>
    <main className="main" id="main-content" tabIndex={-1}><header className="topbar"><div className="breadcrumb">LifeHub <span aria-hidden="true">/</span><b>{nav.find(n=>n.id===current)?.name}</b></div><div className="top-actions"><button className="iconbtn" disabled={unavailable} onClick={()=>setCapture(true)} aria-label="Быстрый ввод" title="Быстрый ввод"><Plus size={17}/></button><button className="iconbtn" disabled={unavailable} onClick={()=>void reload()} aria-label="Обновить данные" title="Обновить данные"><RefreshCw size={17}/></button><button className="iconbtn" onClick={changeTheme} aria-label="Сменить тему" title={theme!=="dark"?"Тёмная тема":"Светлая тема"}>{theme!=="dark"?<Moon size={17}/>:<Sun size={17}/>}</button></div></header>
      <header className="mobilehead"><Link className="logo" href="/"><span className="logo-icon"><Heart size={17}/></span>LifeHub</Link><div className="top-actions"><button className="iconbtn" disabled={unavailable} onClick={()=>setCapture(true)} aria-label="Быстрый ввод" title="Быстрый ввод"><Plus size={17}/></button><button className="iconbtn" disabled={unavailable} onClick={()=>void reload()} aria-label="Обновить данные" title="Обновить данные"><RefreshCw size={17}/></button><button className="iconbtn" onClick={changeTheme} aria-label="Сменить тему" title={theme!=="dark"?"Тёмная тема":"Светлая тема"}>{theme!=="dark"?<Moon size={17}/>:<Sun size={17}/>}</button><Link className="iconbtn" href="/settings" aria-current={current==="settings"?"page":undefined} aria-label="Настройки" title="Настройки"><Settings size={17}/></Link></div></header>
      <nav className="mobile-extra-nav" aria-label="Дополнительные разделы"><Link href="/calendar" aria-current={current==="calendar"?"page":undefined}>Календарь</Link><Link href="/wishlist" aria-current={current==="wishlist"?"page":undefined}>Желания</Link><Link href="/settings" aria-current={current==="settings"?"page":undefined}>Настройки</Link></nav><div className="content">
        {!online&&<div className="authalert offline-notice" role="status">Нет подключения. Можно просмотреть загруженные записи; сохранение станет доступно после подключения.</div>}
        {error&&!editor&&<div className="authalert" role="alert">{error} <button className="quietlink" disabled={unavailable} onClick={()=>void reload()}>Обновить данные</button></div>}
        {current==="dashboard"&&<DashboardView data={data} month={month} today={today} monthPicker={monthPicker} taskRows={taskRows} budgetCard={budgetCard} openNote={id=>open("note",data.notes.find(note=>note.id===id))} openTransaction={id=>open("tx",data.transactions.find(tx=>tx.id===id))} openCapture={()=>setCapture(true)} disabled={unavailable}/>}
        {current==="tasks"&&<><div className="sectionheader"><div><h1 className="headline">Мои задачи</h1><p className="subtitle">Порядок в делах начинается с одного шага.</p></div><button className="button" disabled={unavailable} onClick={()=>open("task")}><Plus size={17}/>Новая задача</button></div><dl className="summary-strip"><div><dt>Всего</dt><dd>{data.tasks.length}</dd></div><div><dt>В процессе</dt><dd>{data.tasks.length-done}</dd></div><div><dt>Выполнено</dt><dd>{done}</dd></div><div><dt>Прогресс</dt><dd>{data.tasks.length?Math.round(done/data.tasks.length*100):0}%</dd></div></dl><div className="toolbar spaced"><SearchField label="Поиск задач" placeholder="Поиск задач…" value={query} onChange={setQuery}/><Segmented label="Статус задач" value={filter} onChange={setFilter} options={[{value:"all",label:"Все"},{value:"open",label:"В процессе"},{value:"done",label:"Завершены"},{value:"today",label:"На сегодня"},{value:"overdue",label:"Просрочены"}]}/></div><div className="card">{taskRows(tasks)}</div></>}
        {current==="notes"&&<><div className="sectionheader"><div><h1 className="headline">Заметки</h1><p className="subtitle">Идеи, мысли и всё, что важно.</p></div><button className="button" disabled={unavailable} onClick={()=>open("note")}><Plus size={17}/>Новая заметка</button></div><div className="toolbar"><SearchField label="Поиск заметок" placeholder="Поиск по заметкам…" value={query} onChange={setQuery}/><span className="smallmuted">Заметок: {data.notes.length}</span></div>{noteCards(notes)}</>}
        {current==="finances"&&<><div className="sectionheader"><div><h1 className="headline">Финансы</h1><p className="subtitle">Осознанные решения начинаются с учёта.</p></div><button className="button" disabled={unavailable} onClick={()=>open("tx")}><Plus size={17}/>Новая операция</button></div>{monthPicker}<div className="grid4"><Metric label="Доходы" value={money(summary.income)}/><Metric label="Расходы" value={money(summary.expense)}/><Metric label="Разница" value={money(summary.balance)} note="Доходы минус расходы"/><Metric label="Импульсивные покупки" value={money(summary.impulseTotal)}/></div><div className="grid2">{budgetCard}<section className="card"><div className="cardhead"><h2 className="cardtitle">Расходы по категориям</h2></div>{summary.categories.map(c=><div className="category-row" key={c.category}><div className="line"><span>{c.category}</span><b>{money(c.amount)}</b></div><div className="progressbg"><div className="progressbar" style={{width:(c.amount/summary.expense*100)+"%"}}/></div></div>)}{!summary.categories.length&&<div className="empty">В этом месяце ещё нет расходов</div>}</section></div><section className="card spaced"><div className="cardhead"><h2 className="cardtitle">История операций</h2><button className="quietlink" onClick={()=>download(transactionsCSV(transactions),"lifehub-"+month+".csv","text/csv;charset=utf-8")}><Download size={14}/> CSV</button></div><div className="toolbar"><SearchField label="Поиск операций" placeholder="Описание или категория…" value={query} onChange={setQuery}/><Segmented label="Тип операций" value={filter} onChange={setFilter} options={[{value:"all",label:"Все"},{value:"expense",label:"Расходы"},{value:"income",label:"Доходы"}]}/></div>{txTable(transactions)}</section><FinanceAccounts data={data} busy={busy} online={online} save={saveAdditional} remove={removeAdditional}/></>}
        {current==="calendar"&&<CalendarView data={data} busy={busy} online={online} save={saveAdditional} remove={removeAdditional}/>}
        {current==="wishlist"&&<WishlistView data={data} busy={busy} online={online} save={saveAdditional} remove={removeAdditional}/>}
        {current==="settings"&&<><div className="sectionheader"><div><h1 className="headline">Настройки</h1><p className="subtitle">Настрой LifeHub под себя.</p></div></div><div className="settings-layout"><SettingsGroup title="Общие">
          <Setting title="Оформление" description="Системная тема следует настройкам устройства"><Segmented label="Оформление" value={preference} onChange={value=>selectTheme(value as "light"|"dark"|"system"|"warm")} options={[{value:"light",label:"Светлая"},{value:"dark",label:"Тёмная"},{value:"warm",label:"Тёплая"},{value:"system",label:"Системная"}]}/></Setting>
          <Setting title="Акцентный цвет" description="Выделение кнопок и ссылок"><Segmented label="Акцентный цвет" value={accent} onChange={value=>selectAccent(value as typeof accent)} options={[{value:"blue",label:"Синий"},{value:"green",label:"Зелёный"},{value:"violet",label:"Фиолетовый"},{value:"graphite",label:"Графит"}]}/></Setting>
          <Setting title="Плотность" description="Расстояние между блоками"><Segmented label="Плотность" value={density} onChange={value=>selectDensity(value as typeof density)} options={[{value:"compact",label:"Компактно"},{value:"comfortable",label:"Удобно"},{value:"spacious",label:"Просторно"}]}/></Setting>
          <Setting title="Шрифт" description="Стиль текста во всём приложении"><Segmented label="Шрифт" value={font} onChange={value=>selectFont(value as typeof font)} options={[{value:"system",label:"Системный"},{value:"inter",label:"Inter"},{value:"montserrat",label:"Montserrat"},{value:"manrope",label:"Manrope"},{value:"plus-jakarta-sans",label:"Plus Jakarta Sans"},{value:"georgia",label:"Georgia"}]}/></Setting>
          <Setting title="Основная валюта" description="Тенге (KZT)"><span className="pill">₸ KZT</span></Setting>
          </SettingsGroup><SettingsGroup title="Данные и резервные копии"><Setting title="Резервная копия" description="Все задачи, заметки, операции и лимит бюджета"><button className="button secondary" onClick={exportJSON}><Download size={16}/>JSON</button></Setting>
          <Setting title="Экспорт операций" description="Все месяцы, формат CSV для Excel"><button className="button secondary" onClick={()=>download(transactionsCSV(data.transactions),"lifehub-transactions.csv","text/csv;charset=utf-8")}><Download size={16}/>CSV</button></Setting>
          <Setting title="Импорт JSON" description="Добавление записей из резервной копии. Текущие записи и лимит не заменяются."><input ref={fileInput} type="file" accept=".json,application/json" className="sr-only" aria-label="Файл резервной копии" onChange={e=>void prepareImport(e.target.files?.[0])}/><button className="button secondary" disabled={unavailable||!online} onClick={()=>fileInput.current?.click()}><Upload size={16}/>Выбрать файл</button></Setting>
          <Setting title="Примеры" description="Добавить несколько демонстрационных записей, не удаляя свои"><button className="button secondary" disabled={unavailable||!online} onClick={addExamples}>Добавить примеры</button></Setting>
          </SettingsGroup><SettingsGroup title="Аккаунт и синхронизация"><Setting title="Аккаунт" description={user.email??"Личный аккаунт"}><button className="button secondary" disabled={unavailable} onClick={()=>void signOut()}>Выйти</button></Setting>
          <Setting title="Синхронизация" description="Облачное хранение Sites. После изменений на другом устройстве нажми «Обновить»"><button className="button secondary" disabled={unavailable||!online} onClick={()=>void reload()}><RefreshCw size={16}/>Обновить</button></Setting>
          </SettingsGroup><SettingsGroup title="Приложение"><Setting title="Установить на iPhone" description="Открой опубликованный HTTPS-сайт в Safari → Поделиться → На экран «Домой». Без интернета доступна страница подключения."><Heart size={20} aria-hidden="true"/></Setting>
        </SettingsGroup></div></>}
        <div className="notice" role="status" aria-live="polite">{busy?<RefreshCw size={16} aria-hidden="true"/>:<Cloud size={16} aria-hidden="true"/>}<span>{busy?"Сохранение…":status}</span></div>
      </div>
    </main>
    <nav className="bottomnav" aria-label="Мобильная навигация">{nav.slice(0,2).map(n=><Link key={n.id} aria-current={current===n.id?"page":undefined} href={n.id==="dashboard"?"/":"/"+n.id} className={current===n.id?"active":""}><n.icon size={21}/><span>{n.name}</span></Link>)}<button className="addnav" aria-label="Создать" disabled={unavailable} onClick={()=>setCapture(true)}><Plus size={23}/><span>Добавить</span></button>{nav.slice(2,4).map(n=><Link key={n.id} aria-current={current===n.id?"page":undefined} href={"/"+n.id} className={current===n.id?"active":""}><n.icon size={21}/><span>{n.name}</span></Link>)}</nav>
    {capture&&<Dialog title="Быстрый ввод" busy={busy} close={()=>setCapture(false)}><form onSubmit={e=>{e.preventDefault();void saveCapture();}}><div className="field"><label htmlFor="quick-capture">Что добавить?</label><input id="quick-capture" data-autofocus value={captureText} onChange={e=>{setCaptureText(e.target.value);setCaptureError("");}} placeholder="Купить SSD завтра или Такси 2500" maxLength={150}/></div><Segmented label="Тип записи" value={captureKind} onChange={value=>setCaptureKind(value as "auto"|Kind)} options={[{value:"auto",label:"Определить"},{value:"task",label:"Задача"},{value:"note",label:"Заметка"},{value:"tx",label:"Расход"}]}/><p className="hint">Будет создана {inferredKind==="task"?"задача":inferredKind==="tx"?"расход":"заметка"}. Перед сохранением можно выбрать тип вручную.</p>{captureError&&<p className="field-error" role="alert">{captureError}</p>}<div className="modalactions"><button type="button" className="button secondary" onClick={()=>{setCapture(false);setChoose(true);}}>Подробная форма</button><button type="submit" className="button" disabled={unavailable||!online}>Добавить</button></div></form></Dialog>}
    {choose&&<Dialog title="Что создать?" busy={busy} close={()=>setChoose(false)}><div className="choose-actions">{[{kind:"task",label:"Задача",icon:ListTodo},{kind:"note",label:"Заметка",icon:NotebookPen},{kind:"tx",label:"Финансовая операция",icon:Wallet}].map(a=><button className="button secondary" key={a.kind} onClick={()=>{setChoose(false);open(a.kind as Kind);}}><a.icon size={20}/>{a.label}<ArrowRight size={18}/></button>)}</div></Dialog>}
    {editor&&<RecordEditor editor={editor} busy={busy} error={error} onSave={save} onDelete={remove} onClose={closeEditor} onDirty={value=>{dirty.current=value;}} accounts={(data.extras??[]).filter(item=>item.kind==="account")}/>}
    {pendingImport&&<Dialog title="Подтвердить импорт" busy={busy} close={()=>setPendingImport(null)}><p className="hint">{importName}</p><ul className="import-summary"><li>Задач: {pendingImport.tasks.length}</li><li>Заметок: {pendingImport.notes.length}</li><li>Операций: {pendingImport.transactions.length}</li></ul><p className="hint">Записи добавятся с новыми идентификаторами. Повторный импорт того же содержимого будет пропущен. Текущий лимит бюджета останется прежним.</p>{error&&<div className="authalert" role="alert">{error}</div>}<div className="modalactions"><button className="button secondary" disabled={unavailable} onClick={()=>setPendingImport(null)}>Отмена</button><button className="button" disabled={unavailable||!online} onClick={()=>void confirmImport()}>{busy?"Импорт…":"Добавить записи"}</button></div></Dialog>}
  </div>;
}
function Setting({title,description,children}:{title:string;description:string;children:ReactNode}) {
  return <div className="settingrow"><div><b>{title}</b><div className="hint">{description}</div></div>{children}</div>;
}
