'use client';
import {useState} from 'react';
import {api} from '../lib/api';
import {ErrorMessage} from './ui';
type Appointment={id:string;starts_at:string;timezone:string};
type Draft={appointment_id:string;number:string;starts_at:string;timezone:string;message:string;review_token:string};
export function WhatsappReminder({patientId}:{patientId:string}){
 const base='patients/'+patientId+'/whatsapp-reminders';
 const [items,setItems]=useState<Appointment[]|null>(null),[hasMore,setHasMore]=useState(false),[draft,setDraft]=useState<Draft|null>(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const canDiscard=()=>!draft||message===draft.message||window.confirm('¿Descartar los cambios del mensaje?');
 async function load(){if(!canDiscard())return;setBusy(true);setError('');setDraft(null);setNotice('');try{const r=await api<{items:Appointment[];hasMore:boolean}>(base,'GET',undefined,15000);setItems(r.items);setHasMore(r.hasMore);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function prepare(id:string){if(!canDiscard())return;setBusy(true);setError('');setNotice('');setDraft(null);try{const r=await api<Draft>(base+'/'+id+'/draft','POST',{},15000);setDraft(r);setMessage(r.message);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function open(){if(!draft||busy||!message.trim())return;
  // Reserve the tab in the click gesture so mobile browsers do not block an async popup.
  const target=window.open('about:blank','_blank');
  if(!target){setError('El navegador bloqueó la ventana. Permite ventanas emergentes para este sitio y vuelve a pulsar Abrir WhatsApp.');return;}
  target.opener=null;setBusy(true);setError('');setNotice('');
  try{const result=await api<{url:string}>(base+'/'+draft.appointment_id+'/link','POST',{review_token:draft.review_token,message},15000);if(target.closed){setError('La ventana se cerró. Vuelve a pulsar Abrir WhatsApp cuando estés listo.');return;}target.location.replace(result.url);setNotice('Se solicitó abrir WhatsApp. Revisa el mensaje y pulsa Enviar allí. El sistema no puede comprobar si lo enviaste.');}
  catch(e){target.close();setError((e as Error).message);}finally{setBusy(false);}
 }
 const date=(a:Appointment|Draft)=>new Date(a.starts_at).toLocaleString('es-MX',{timeZone:a.timezone});
 return <section className="panel"><h3>WhatsApp manual</h3><p>Prepara un mensaje y ábrelo en WhatsApp para enviarlo tú. También puedes hacerlo si faltan menos de 24 horas para la cita.</p><button className="button secondary" disabled={busy} onClick={()=>void load()}>Ver próximas citas para WhatsApp</button><ErrorMessage message={error}/>{notice&&<p role="status">{notice}</p>}{items&&<>{!items.length&&<p>No hay próximas citas pendientes o confirmadas.</p>}{items.map(a=><article className="clinical-entry" key={a.id}><p>Cita: {date(a)} · {a.timezone}</p><button className="button secondary" disabled={busy} onClick={()=>void prepare(a.id)}>Preparar mensaje para {date(a)}</button></article>)}{hasMore&&<p>Se muestran las próximas 20 citas.</p>}</>}{draft&&<div className="form panel" aria-label="Borrador de WhatsApp"><h4>Revisa tu mensaje</h4><p>Para: <strong>{draft.number}</strong><br/>Cita: {date(draft)} · {draft.timezone}</p><label className="field"><span>Mensaje de WhatsApp</span><textarea aria-label="Mensaje de WhatsApp" rows={8} maxLength={2000} disabled={busy} value={message} onChange={e=>{setMessage(e.target.value);setNotice('');}}/></label><small>{message.length}/2000 caracteres. Este borrador no se guarda en el expediente.</small><div className="form-actions"><button className="button primary" disabled={busy||!message.trim()} onClick={()=>void open()}>{busy?'Revisando cita…':'Abrir WhatsApp con este mensaje'}</button><button className="text-button" disabled={busy} onClick={()=>{if(canDiscard())setMessage(draft.message);}}>Restablecer mensaje</button><button className="text-button" disabled={busy} onClick={()=>{if(canDiscard())setDraft(null);}}>Cerrar borrador</button></div><small>Se abrirá WhatsApp con la cuenta que tengas iniciada. Abrirlo no confirma la cita ni marca el mensaje como enviado.</small></div>}</section>;
}
