"use client";

import {useState} from 'react';
import {formatMoney,localDate,parseMoney,type Data} from '@/lib/domain';
import type {ExtraRecord} from '@/lib/extra-domain';

type Props={data:Data;busy:boolean;online:boolean;save:(item:ExtraRecord,isNew:boolean)=>Promise<boolean>;remove:(item:ExtraRecord)=>Promise<boolean>};
export default function FinanceAccounts({data,busy,online,save,remove}:Props){
  const [accountName,setAccountName]=useState(''),[opening,setOpening]=useState('0');
  const [from,setFrom]=useState(''),[to,setTo]=useState(''),[transferAmount,setTransferAmount]=useState('');
  const [subscription,setSubscription]=useState(''),[subscriptionAmount,setSubscriptionAmount]=useState(''),[subscriptionDate,setSubscriptionDate]=useState(localDate);
  const [error,setError]=useState('');
  const accounts=(data.extras??[]).filter(item=>item.kind==='account');
  const transfers=(data.extras??[]).filter(item=>item.kind==='transfer');
  const subscriptions=(data.extras??[]).filter(item=>item.kind==='subscription');
  const balance=(account:ExtraRecord)=>{
    const transactions=data.transactions.filter(tx=>tx.accountId===account.id).reduce((sum,tx)=>sum+(tx.type==='income'?tx.amount:-tx.amount),0);
    const movement=transfers.reduce((sum,item)=>sum+(item.toAccountId===account.id?(item.amount??0):0)-(item.accountId===account.id?(item.amount??0):0),0);
    return Math.round(((account.amount??0)+transactions+movement)*100)/100;
  };
  const submitAccount=async(event:React.FormEvent)=>{event.preventDefault();setError('');try{
    const amount=opening.trim()==='0'?0:parseMoney(opening);
    const record:ExtraRecord={id:crypto.randomUUID(),kind:'account',title:accountName.trim(),date:localDate(),amount,version:0};
    if(await save(record,true)){setAccountName('');setOpening('0');}
  }catch(e){setError((e as Error).message);}};
  const submitTransfer=async(event:React.FormEvent)=>{event.preventDefault();setError('');try{
    if(!accounts.some(item=>item.id===from)||!accounts.some(item=>item.id===to)||from===to)throw new Error('Выбери два разных счета.');
    const record:ExtraRecord={id:crypto.randomUUID(),kind:'transfer',title:'Перевод',date:localDate(),amount:parseMoney(transferAmount),accountId:from,toAccountId:to,version:0};
    if(await save(record,true))setTransferAmount('');
  }catch(e){setError((e as Error).message);}};
  const submitSubscription=async(event:React.FormEvent)=>{event.preventDefault();setError('');try{
    const record:ExtraRecord={id:crypto.randomUUID(),kind:'subscription',title:subscription.trim(),date:subscriptionDate,amount:parseMoney(subscriptionAmount),version:0};
    if(await save(record,true)){setSubscription('');setSubscriptionAmount('');}
  }catch(e){setError((e as Error).message);}};
  return <section className="card spaced"><div className="cardhead"><h2 className="cardtitle">Счета и регулярные платежи</h2></div><div className="grid2"><div><h3 className="cardtitle">Мои счета</h3>{accounts.length?accounts.map(account=><div className="line" key={account.id}><span>{account.title}</span><b>{formatMoney(balance(account))}</b></div>):<p className="hint">Добавь Kaspi, Halyk или наличные, чтобы видеть отдельные остатки.</p>}<form onSubmit={submitAccount} className="inline-form"><div className="field"><label htmlFor="account-name">Название счета</label><input id="account-name" value={accountName} onChange={e=>setAccountName(e.target.value)} maxLength={150} required/></div><div className="field"><label htmlFor="account-opening">Начальный остаток, ₸</label><input id="account-opening" value={opening} onChange={e=>setOpening(e.target.value)} inputMode="decimal" required/></div><button className="button secondary" disabled={busy||!online}>Добавить счет</button></form></div><div><h3 className="cardtitle">Перевод между счетами</h3><form onSubmit={submitTransfer} className="inline-form"><div className="field"><label htmlFor="transfer-from">Откуда</label><select id="transfer-from" value={from} onChange={e=>setFrom(e.target.value)} required><option value="">Выбери счет</option>{accounts.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select></div><div className="field"><label htmlFor="transfer-to">Куда</label><select id="transfer-to" value={to} onChange={e=>setTo(e.target.value)} required><option value="">Выбери счет</option>{accounts.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select></div><div className="field"><label htmlFor="transfer-amount">Сумма, ₸</label><input id="transfer-amount" value={transferAmount} onChange={e=>setTransferAmount(e.target.value)} inputMode="decimal" required/></div><button className="button secondary" disabled={busy||!online||accounts.length<2}>Перевести</button></form><p className="hint">Перевод меняет остатки счетов, но не считается доходом или расходом.</p></div></div>
    <div className="grid2"><div><h3 className="cardtitle">Запланированные подписки</h3><p className="hint">Показываем следующую дату платежа. Фактический расход добавляется после оплаты.</p>{subscriptions.map(item=><div className="line" key={item.id}><span>{item.title}<small className="smallmuted"> · {item.date}</small></span><b>{formatMoney(item.amount??0)}</b><button className="quietlink" disabled={busy||!online} onClick={()=>{if(confirm('Удалить подписку?'))void remove(item);}}>Удалить</button></div>)}</div><form onSubmit={submitSubscription}><div className="field"><label htmlFor="subscription-title">Подписка</label><input id="subscription-title" value={subscription} onChange={e=>setSubscription(e.target.value)} maxLength={150} required/></div><div className="field"><label htmlFor="subscription-amount">Платёж, ₸</label><input id="subscription-amount" value={subscriptionAmount} onChange={e=>setSubscriptionAmount(e.target.value)} inputMode="decimal" required/></div><div className="field"><label htmlFor="subscription-date">Следующий платеж</label><input id="subscription-date" type="date" value={subscriptionDate} onChange={e=>setSubscriptionDate(e.target.value)} required/></div><button className="button secondary" disabled={busy||!online}>Добавить подписку</button></form></div>{error&&<p className="field-error" role="alert">{error}</p>}</section>;
}
