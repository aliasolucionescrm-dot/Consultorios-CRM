import { Temporal } from '@js-temporal/polyfill';
type Navigation={branch?:string;date?:string;view?:'day'|'week'|'month'};
export function navigationKey(user:string,organization:string){return `alia:agenda:${user}:${organization}`;}
export function readNavigation(key:string):Navigation{
 try{
  const raw=JSON.parse(sessionStorage.getItem(key)||'{}');
  const result:Navigation={};
  if(typeof raw.branch==='string'&&/^[a-f0-9-]{36}$/i.test(raw.branch))result.branch=raw.branch;
  if(typeof raw.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(raw.date)){
   try{if(Temporal.PlainDate.from(raw.date).toString()===raw.date)result.date=raw.date;}catch{/* Ignore malformed stored dates. */}
  }
  if(['day','week','month'].includes(raw.view))result.view=raw.view;
  return result;
 }catch{return {};}
}
export function saveNavigation(key:string,update:Navigation){
 try{sessionStorage.setItem(key,JSON.stringify({...readNavigation(key),...update}));}catch{/* Storage may be disabled; navigation remains usable. */}
}
