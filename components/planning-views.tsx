"use client";

import {useEffect,useState} from "react";
import {eventOccurs,formatMoney,isISODate,localDate,parseMoney,type Data} from "@/lib/domain";
import type {ExtraRecord} from "@/lib/extra-domain";

type Props={data:Data;busy:boolean;online:boolean;save:(item:ExtraRecord,isNew:boolean)=>Promise<boolean>;remove:(item:ExtraRecord)=>Promise<boolean>};
const monthOf=(date:string)=>date.slice(0,7);
const addDays=(date:string,days:number)=>{const d=new Date(date+'T12:00:00');d.setDate(d.getDate()+days);return localDate(d);};
const addMonths=(date:string,months:number)=>{const source=new Date(date+'T12:00:00');const target=new Date(source.getFullYear(),source.getMonth()+months,1,12);const last=new Date(target.getFullYear(),target.getMonth()+1,0).getDate();target.setDate(Math.min(source.getDate(),last));return localDate(target);};

export function CalendarView({data,busy,online,save,remove}:Props){
  const [selected,setSelected]=useState(localDate),[view,setView]=useState<'month'|'week'|'day'>('month');
  useEffect(()=>{
    const syncDate=()=>{const date=new URLSearchParams(window.location.search).get('date');if(date&&isISODate(date))setSelected(date);};
    syncDate();
    window.addEventListener('popstate',syncDate);
    window.addEventListener('lifehub:navigate',syncDate);
    return()=>{window.removeEventListener('popstate',syncDate);window.removeEventListener('lifehub:navigate',syncDate);};
  },[]);
  const [title,setTitle]=useState(''),[note,setNote]=useState(''),[repeat,setRepeat]=useState<'none'|'weekly'|'monthly'>('none'),[error,setError]=useState('');
  const events=(data.extras??[]).filter(item=>item.kind==='event');
  const month=monthOf(selected);
  const first=new Date(month+'-01T12:00:00');
  const offset=(first.getDay()+6)%7;
  const cells=Array.from({length:42},(_,index)=>addDays(month+'-01',index-offset));
  const weekStart=addDays(selected,-(new Date(selected+'T12:00:00').getDay()+6)%7);
  const visible=view==='day'?[selected]:view==='week'?Array.from({length:7},(_,index)=>addDays(weekStart,index)):cells;
  const entries=(date:string)=>[
    ...data.tasks.filter(task=>task.date===date).map(task=>({id:task.id,title:task.title,done:task.done,kind:'task' as const})),
    ...events.filter(event=>eventOccurs(event,date)).map(event=>({id:event.id,title:event.title,done:false,kind:'event' as const})),
  ];
  const submit=async(event:React.FormEvent)=>{
    event.preventDefault();setError('');
    if(!title.trim()||!isISODate(selected)){setError('Укажи название и дату.');return;}
    const item:ExtraRecord={id:crypto.randomUUID(),kind:'event',title:title.trim(),date:selected,note:note.trim(),repeat,version:0};
    if(await save(item,true)){setTitle('');setNote('');}
  };
  return <><div className="sectionheader"><div><h1 className="headline">Календарь</h1><p className="subtitle">Дела и события в одном месте.</p></div></div>
    <div className="toolbar"><button className="button secondary" onClick={()=>setSelected(view==='month'?addMonths(selected,-1):addDays(selected,view==='week'?-7:-1))}>← Назад</button><input type="date" aria-label="Выбранная дата" value={selected} onChange={e=>isISODate(e.target.value)&&setSelected(e.target.value)}/><button className="button secondary" onClick={()=>setSelected(view==='month'?addMonths(selected,1):addDays(selected,view==='week'?7:1))}>Вперёд →</button><button className="button secondary" onClick={()=>setSelected(localDate())}>Сегодня</button><div className="segmented" role="group" aria-label="Вид календаря">{(['month','week','day'] as const).map(item=><button key={item} aria-pressed={view===item} onClick={()=>setView(item)}>{item==='month'?'Месяц':item==='week'?'Неделя':'День'}</button>)}</div></div>
    <div className="calendar-grid" style={view==="day"?{gridTemplateColumns:"1fr"}:undefined}>{visible.map(date=><button key={date} className={'calendar-day card '+(date===selected?'selected ':'')+(monthOf(date)!==month?'outside':'')} onClick={()=>setSelected(date)} aria-pressed={date===selected}><b>{new Intl.DateTimeFormat('ru-RU',{weekday:'short',day:'numeric',month:view==='month'?undefined:'short'}).format(new Date(date+'T12:00:00'))}</b><span>{entries(date).length?`${entries(date).length} записей`:'—'}</span></button>)}</div>
    <div className="grid2"><section className="card"><h2 className="cardtitle">План на {selected.split('-').reverse().join('.')}</h2>{entries(selected).length?entries(selected).map(item=><div className="line" key={item.kind+item.id}><span>{item.kind==='task'?'Задача':'Событие'}: {item.title}{item.done?' ✓':''}</span>{item.kind==='event'&&<button className="quietlink" disabled={busy||!online} onClick={()=>{const record=events.find(event=>event.id===item.id);if(record&&confirm('Удалить событие?'))void remove(record);}}>Удалить</button>}</div>):<p className="hint">На этот день записей нет.</p>}</section><section className="card"><h2 className="cardtitle">Новое событие</h2><form onSubmit={submit}><div className="field"><label htmlFor="event-title">Название</label><input id="event-title" value={title} maxLength={150} onChange={e=>setTitle(e.target.value)} required/></div><div className="field"><label htmlFor="event-note">Описание</label><textarea id="event-note" value={note} maxLength={2000} onChange={e=>setNote(e.target.value)}/></div><div className="field"><label htmlFor="event-repeat">Повторять</label><select id="event-repeat" value={repeat} onChange={e=>setRepeat(e.target.value as typeof repeat)}><option value="none">Не повторять</option><option value="weekly">Каждую неделю</option><option value="monthly">Каждый месяц</option></select></div>{error&&<p className="field-error" role="alert">{error}</p>}<button className="button" disabled={busy||!online}>Сохранить событие</button></form></section></div>
  </>;
}

export function WishlistView({data,busy,online,save,remove}:Props){
  const [title,setTitle]=useState(''),[amount,setAmount]=useState(''),[need,setNeed]=useState('want'),[when,setWhen]=useState('today'),[error,setError]=useState('');
  const wishes=(data.extras??[]).filter(item=>item.kind==='wish');
  const price=Number(amount.replace(',','.'))||0;
  const share=data.budget>0?price/data.budget:0;
  const waiting=need==='want'&&when==='today';
  const insight=waiting?'Покупка появилась сегодня и не обязательна. Можно вернуться к ней через 24 часа.':share>.5?'Покупка займёт более половины месячного лимита. Проверь другие планы.':'Сравни цену с доступным остатком бюджета и приоритетами.';
  const submit=async(event:React.FormEvent)=>{
    event.preventDefault();setError('');
    try{
      if(!title.trim()||title.length>150)throw new Error('Укажи название покупки.');
      const item:ExtraRecord={id:crypto.randomUUID(),kind:'wish',title:title.trim(),date:localDate(),amount:parseMoney(amount),status:'planned',note:`Необходимость: ${need}; желание: ${when}`,version:0};
      if(await save(item,true)){setTitle('');setAmount('');}
    }catch(e){setError((e as Error).message);}
  };
  const update=(item:ExtraRecord,status:'bought'|'declined')=>void save({...item,status},false);
  const avoided=wishes.filter(item=>item.status==='declined').reduce((sum,item)=>sum+(item.amount??0),0);
  return <><div className="sectionheader"><div><h1 className="headline">Список желаний</h1><p className="subtitle">Оцени покупку до того, как потратишь деньги.</p></div></div><div className="grid2"><section className="card"><h2 className="cardtitle">Стоит ли покупать?</h2><form onSubmit={submit}><div className="field"><label htmlFor="wish-title">Покупка</label><input id="wish-title" value={title} onChange={e=>setTitle(e.target.value)} maxLength={150} required/></div><div className="field"><label htmlFor="wish-price">Стоимость, ₸</label><input id="wish-price" inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} required/></div><div className="field"><label htmlFor="wish-need">Насколько нужна?</label><select id="wish-need" value={need} onChange={e=>setNeed(e.target.value)}><option value="essential">Необходима</option><option value="useful">Полезна, но не срочно</option><option value="want">Просто захотелось</option></select></div><div className="field"><label htmlFor="wish-when">Как давно хочешь?</label><select id="wish-when" value={when} onChange={e=>setWhen(e.target.value)}><option value="today">Решил сегодня</option><option value="days">Несколько дней</option><option value="month">Больше месяца</option></select></div><p className="hint">{price>0?`Это ${Math.round(share*100)}% месячного лимита. `:''}{insight}</p>{error&&<p className="field-error" role="alert">{error}</p>}<button className="button" disabled={busy||!online}>Добавить в список желаний</button></form></section><section className="card"><h2 className="cardtitle">Твои решения</h2><p className="hint">Отказался от покупок на {formatMoney(avoided)}. Это потенциально не потраченная сумма, а не накопления.</p>{wishes.length?wishes.map(item=><div className="wish-row" key={item.id}><div><b>{item.title}</b><div className="smallmuted">{formatMoney(item.amount??0)} · {item.status==='planned'?'Раздумываю':item.status==='declined'?'Отказался':'Купил'}</div></div><div className="wish-actions">{item.status==='planned'&&<><button className="quietlink" disabled={busy||!online} onClick={()=>update(item,'declined')}>Отказался</button><button className="quietlink" disabled={busy||!online} onClick={()=>update(item,'bought')}>Купил</button></>}<button className="quietlink" disabled={busy||!online} onClick={()=>{if(confirm('Удалить из списка?'))void remove(item);}}>Удалить</button></div></div>):<p className="hint">Пока нет покупок для оценки.</p>}</section></div></>;
}
