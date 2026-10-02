'use client';
import {useState} from 'react';
import {api} from '../lib/api';
import {ErrorMessage} from './ui';
type Job={id:string;appointment_version:number;preference_version:number;channel:string;starts_at:string;due_at:string;timezone:string;state:'held'|'canceled'|'expired'};
export function ReminderQueue({patientId}:{patientId:string}){
 const [data,setData]=useState<{items:Job[];hasMore:boolean}|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function load(){setBusy(true);setError('');setData(null);try{setData(await api('patients/'+patientId+'/reminder-preferences/queue','GET',undefined,15000));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 const labels={held:'Preparado · envío deshabilitado',canceled:'Invalidado por cambios en la cita, contactos o preferencias',expired:'Vencido · no se enviará retroactivamente'};
 return <div className="panel"><h3>Cola de recordatorios</h3><p>Las citas y preferencias generan registros automáticamente para 24 horas antes. Los envíos están detenidos hasta conectar los proveedores.</p><button className="button secondary" disabled={busy} aria-busy={busy} onClick={()=>void load()}>{busy?'Consultando cola…':'Consultar cola de recordatorios'}</button><ErrorMessage message={error}/>{data&&<><p role="status">Consulta actualizada. No se enviaron mensajes.</p>{!data.items.length&&<p>No hay registros en la cola de este paciente.</p>}{data.items.map(j=><article className="clinical-entry" key={j.id}><h4>{j.channel==='email'?'Correo electrónico':'WhatsApp'} · {labels[j.state]}</h4><p>Cita: {new Date(j.starts_at).toLocaleString('es-MX',{timeZone:j.timezone})}<br/>Recordatorio: {new Date(j.due_at).toLocaleString('es-MX',{timeZone:j.timezone})}<br/>{j.timezone} · Cita versión {j.appointment_version} · Preferencias versión {j.preference_version}</p></article>)}{data.hasMore&&<p>Se muestran los últimos 50 registros. El resto se conserva.</p>}<small>Vuelve a consultar después de cambiar una cita. Los registros invalidados conservan el historial.</small></>}</div>;
}
