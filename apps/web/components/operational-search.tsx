'use client';
import { useEffect,useState } from 'react';
import { api } from '../lib/api';
import { ErrorMessage } from './ui';
export type SearchResult={id:string;name:string;active?:boolean;branch_id?:string;branch_name?:string;date?:string;service_name?:string;status?:string;starts_at?:string};
type Group={kind:'professionals'|'rooms'|'services'|'appointments';items:SearchResult[];hasMore:boolean};
const statuses:Record<string,string>={pending:'Pendiente',confirmed:'Confirmada',arrived:'En espera',in_consultation:'En consulta',completed:'Completada',canceled:'Cancelada',no_show:'No asistió'};
const titles={professionals:'Profesionales',rooms:'Consultorios',services:'Servicios',appointments:'Citas'};
export function OperationalSearch({search,zone,open}:{search:string;zone:string;open:(kind:Group['kind'],item:SearchResult)=>void}){
 const [groups,setGroups]=useState<Group[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 useEffect(()=>{let live=true;setGroups([]);setError('');setLoading(search.trim().length>=2);if(search.trim().length<2)return;
  const timer=setTimeout(()=>{api<{groups:Group[]}>(`search?q=${encodeURIComponent(search.trim())}`).then(r=>{if(live)setGroups(r.groups);}).catch(e=>{if(live)setError(e.message);}).finally(()=>{if(live)setLoading(false);});},250);return()=>{live=false;clearTimeout(timer);};
 },[search]);
 if(search.trim().length<2)return <p className="search-hint">Escribe al menos dos caracteres para buscar en los catálogos y las citas.</p>;
 return <div className="operational-search"><ErrorMessage message={error}/>{loading&&<p role="status">Buscando en tu organización…</p>}{groups.map(g=>g.items.length>0&&<section key={g.kind} aria-label={titles[g.kind]}><h3>{titles[g.kind]}</h3>{g.items.map(item=><button key={item.id} onClick={()=>open(g.kind,item)}><span><strong>{item.name}</strong><small>{g.kind==='appointments'?`${new Intl.DateTimeFormat('es-MX',{timeZone:zone,dateStyle:'short',timeStyle:'short'}).format(new Date(item.starts_at!))} · ${item.branch_name} · ${item.service_name} · ${statuses[item.status!]||item.status} · Abrir día`:item.active?'Activo':'Inactivo'}</small></span></button>)}{g.hasMore&&<p>Hay más resultados. Escribe un nombre más específico.</p>}</section>)}{!loading&&!error&&groups.length>0&&groups.every(g=>g.items.length===0)&&<p>No hay coincidencias en catálogos ni citas.</p>}</div>;
}
