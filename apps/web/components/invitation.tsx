'use client';
import { useState } from 'react';
import { api } from '../lib/api';
import { Form, InlinePanel } from './ui';
export function InvitationAcceptance({refresh}:{refresh:()=>Promise<void>}){
 const [invitation,setInvitation]=useState(()=>{
  const params=new URLSearchParams(window.location.search);
  return params.get('flow')==='invite'?params.get('token'):null;
 });
 if(!invitation)return null;
 function close(){window.history.replaceState(null,'',`/${window.location.hash}`);setInvitation(null);}
 return <InlinePanel title="Tienes una invitación a otra organización" onClose={close}>
  <p className="muted">Acepta con la cuenta cuyo correo recibió la invitación. Tus organizaciones actuales se conservarán.</p>
  <Form label="Aceptar invitación" onSubmit={async()=>{await api('auth/accept-invitation','POST',{token:invitation});await refresh();close();}}><span/></Form>
 </InlinePanel>;
}
