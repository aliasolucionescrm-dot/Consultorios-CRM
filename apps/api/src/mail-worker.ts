import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { transaction, query, type Connection } from '../../../packages/database/src/client';
import { encrypt, decrypt } from './core';
import { sendLink } from './mail';

export async function enqueueMail(c:Connection,input:{organizationId?:string;userId:string;kind:'reset'|'invite';entityId:string;email:string;token:string;expiresAt:Date}) {
 await query('INSERT INTO mail_outbox(organization_id,user_id,kind,entity_id,payload_ciphertext,expires_at) VALUES($1,$2,$3,$4,$5,$6)',[input.organizationId||null,input.userId,input.kind,input.entityId,encrypt(JSON.stringify({email:input.email,token:input.token})),input.expiresAt],c);
}

// Row lock + SKIP LOCKED permit multiple API instances without simultaneous delivery.
// SMTP is at-least-once: a crash after SMTP acceptance may resend the same Message-ID.
export async function deliverOne():Promise<boolean>{
 return transaction(async c=>{
  const [job]=await query("SELECT * FROM mail_outbox WHERE status='pending' AND available_at<=now() ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED",[],c);
  if(!job)return false;
  const table=job.kind==='reset'?'password_resets':'invitations';
  const consumed=job.kind==='reset'?'consumed_at':'accepted_at';
  const [valid]=await query(`SELECT id FROM ${table} WHERE id=$1 AND expires_at>now() AND ${consumed} IS NULL`,[job.entity_id],c);
  if(!valid||new Date(job.expires_at)<=new Date()){
   await query("UPDATE mail_outbox SET status='cancelled',payload_ciphertext=NULL WHERE id=$1",[job.id],c);return true;
  }
  try{
   const payload=JSON.parse(decrypt(job.payload_ciphertext)) as {email:string;token:string};
   await sendLink(payload.email,job.kind,payload.token,job.id);
  }catch{
   const attempts=Number(job.attempts)+1;
   await query("UPDATE mail_outbox SET attempts=$2,last_error_code='delivery_failed',available_at=now()+$3*interval '1 second',status=CASE WHEN $2>=6 THEN 'failed' ELSE 'pending' END,payload_ciphertext=CASE WHEN $2>=6 THEN NULL ELSE payload_ciphertext END WHERE id=$1",[job.id,attempts,Math.min(300,5*2**attempts)],c);
   console.warn(JSON.stringify({level:'warn',event:'mail.delivery_failed',jobId:job.id,attempts}));return true;
  }
  await query("UPDATE mail_outbox SET status='sent',attempts=attempts+1,sent_at=now(),payload_ciphertext=NULL,last_error_code=NULL WHERE id=$1",[job.id],c);
  await query("INSERT INTO audit_logs(organization_id,user_id,action,entity,entity_id) VALUES($1,$2,$3,'mail',$4)",[job.organization_id,job.user_id,`${job.kind}.email_sent`,job.id],c);
  return true;
 });
}

@Injectable()
export class MailWorker implements OnModuleInit,OnModuleDestroy {
 private timer?:ReturnType<typeof setInterval>;
 private running:Promise<void>|null=null;
 onModuleInit(){
  if(process.env.MAIL_WORKER_ENABLED==='false')return;
  this.timer=setInterval(()=>{
   if(this.running)return;
   this.running=this.batch().finally(()=>{this.running=null;});
  },2000);this.timer.unref();
 }
 private async batch(){try{for(let i=0;i<10;i++){if(!await deliverOne())break;}}catch{console.error(JSON.stringify({level:'error',event:'mail.worker_failed'}));}}
 async onModuleDestroy(){if(this.timer)clearInterval(this.timer);await this.running;}
}
