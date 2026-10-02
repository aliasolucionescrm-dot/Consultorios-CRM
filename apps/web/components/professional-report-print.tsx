'use client';
import {useRef,useState} from 'react';
import {professionalReportHtml,type ProfessionalReportData} from '../lib/professional-report-document';
import {ErrorMessage} from './ui';
export function ProfessionalReportPrint({data,close}:{data:ProfessionalReportData;close:()=>void}){
 const frame=useRef<HTMLIFrameElement>(null),[ready,setReady]=useState(false),[error,setError]=useState('');
 return <section className="panel consent-detail"><div className="form-actions"><h3>Documento del reporte profesional</h3><button className="text-button" onClick={close}>Cerrar documento profesional</button></div><p>Imprime la consulta que estás revisando, con todos los movimientos. Datos del {new Date(data.consulted_at).toLocaleString('es-MX',{timeZone:data.timezone})} ({data.timezone}). Para obtener datos más recientes, cierra esta vista y vuelve a consultar el reporte.</p><ErrorMessage message={error}/><button className="button primary" disabled={!ready} onClick={()=>{setError('');try{if(!frame.current?.contentWindow)throw new Error();frame.current.contentWindow.focus();frame.current.contentWindow.print();}catch{setError('No se pudo abrir la impresión. Prueba en un navegador de escritorio.');}}}>Imprimir reporte profesional / guardar PDF</button><p>Elige “Guardar como PDF” en el diálogo de impresión para descargarlo.</p><iframe ref={frame} className="prescription-frame" title="Vista previa del reporte profesional" sandbox="allow-same-origin allow-modals" srcDoc={professionalReportHtml(data)} onLoad={()=>setReady(true)}/></section>;
}
