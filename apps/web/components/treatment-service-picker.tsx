'use client';
import { useEffect,useState } from 'react';
import { api } from '../lib/api';
import { ErrorMessage } from './ui';
type Service={id:string;name:string;requires_tooth:boolean};
export function TreatmentServicePicker({patientId,onSelect}:{patientId:string;onSelect:(service:Service)=>void}){
 const [q,setQ]=useState(''),[items,setItems]=useState<Service[]>([]),[more,setMore]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{let live=true;const timer=setTimeout(()=>{setLoading(true);api<{items:Service[];hasMore:boolean}>('patients/'+patientId+'/treatment-plan/services?q='+encodeURIComponent(q),'GET',undefined,15000).then(r=>{if(live){setItems(r.items);setMore(r.hasMore);setError('');}}).catch(e=>{if(live)setError(e.message);}).finally(()=>{if(live)setLoading(false);});},200);return()=>{live=false;clearTimeout(timer);};},[patientId,q]);
 return <div className="treatment-services"><label className="field"><span>Buscar servicio del catálogo</span><input aria-label="Buscar servicio del catálogo" value={q} maxLength={150} onChange={e=>{setQ(e.target.value);setItems([]);setLoading(true);}} placeholder="Escribe para filtrar servicios…"/></label><ErrorMessage message={error}/>{loading?<p role="status">Buscando servicios…</p>:items.map(s=><button type="button" className="treatment-service-choice" key={s.id} onClick={()=>onSelect(s)}><strong>{s.name}</strong><small>{s.requires_tooth?'Requiere pieza dental':'Pieza opcional'}</small></button>)}{!loading&&!items.length&&!error&&<p>No encontramos servicios activos. Puedes escribir un procedimiento manual.</p>}{more&&<small>Escribe más para acotar los resultados.</small>}</div>;
}
