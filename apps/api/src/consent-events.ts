import {BadRequestException,Body,ConflictException,Controller,Get,Inject,NotFoundException,Param,Post,Req,Res,ServiceUnavailableException} from '@nestjs/common';
import {randomUUID,createHash} from 'node:crypto';
import type {Response} from 'express';
import {z} from 'zod';
import {Access,type AuthRequest,audit,parse,uuid,digest} from './core';
import {patientTransaction} from './patients';
import {query} from '../../../packages/database/src/client';
import {filename,decode} from './attachments';
import {configuredPrivateStorage} from './private-storage';
const evidenceSchema=z.object({filename,media_type:z.enum(['application/pdf','image/png','image/jpeg','image/webp']),content_base64:z.string().min(4).max(6990508)}).strict();
@Controller('api/patients/:patientId/consents/:consentId')
export class ConsentEventsController{
 constructor(@Inject(Access)private access:Access){}
 private async actor(req:AuthRequest,patientId:string,consentId:string,edit=false){const a=await this.access.tenant(req,'patients.view');await this.access.tenant(req,'clinical_records.view');if(edit)await this.access.tenant(req,'clinical_records.edit');parse(uuid,patientId);parse(uuid,consentId);return a;}
 @Get() async detail(@Param('patientId')patientId:string,@Param('consentId')consentId:string,@Req()req:AuthRequest){
  const a=await this.actor(req,patientId,consentId);return patientTransaction(a.organizationId!,async c=>{
   const [consent]=await query('SELECT pc.*,u.name AS author FROM patient_consents pc JOIN users u ON u.id=pc.created_by WHERE organization_id=$1 AND patient_id=$2 AND pc.id=$3',[a.organizationId,patientId,consentId],c);if(!consent)throw new NotFoundException('No encontramos el consentimiento.');
   const events=await query("SELECT e.id,e.version,e.status,e.reason,e.signer_name,e.signer_relationship,to_char(e.occurred_on,'YYYY-MM-DD') AS occurred_on,e.created_at,u.name AS author,CASE WHEN e.evidence IS NULL THEN NULL ELSE jsonb_build_object('filename',e.evidence->>'filename','media_type',e.evidence->>'media_type') END AS evidence FROM consent_events e JOIN users u ON u.id=e.created_by WHERE organization_id=$1 AND consent_id=$2 ORDER BY version DESC",[a.organizationId,consentId],c);
   await audit(req,'consent.detail_viewed','patient',patientId,a.organizationId!,a.id,{after:{consent_id:consentId}},c);return {consent,events,version:events[0]?.version||0,status:events[0]?.status||'pending'};
  });
 }
 @Post('events') async register(@Param('patientId')patientId:string,@Param('consentId')consentId:string,@Body()raw:unknown,@Req()req:AuthRequest){
  const a=await this.actor(req,patientId,consentId,true),input=parse(z.object({request_id:uuid,version:z.number().int().nonnegative(),status:z.enum(['accepted','rejected','voided']),reason:z.string().trim().min(1).max(2000),signer_name:z.string().trim().max(180).default(''),signer_relationship:z.string().trim().max(100).default(''),occurred_on:z.iso.date(),evidence:evidenceSchema.optional()}).strict(),raw);
  if(input.status==='accepted'&&(!input.evidence||!input.signer_name||!input.signer_relationship))throw new BadRequestException('La aceptación requiere firmante, relación y evidencia firmada.');
  const bytes=input.evidence?decode(input.evidence.content_base64,input.evidence.media_type,input.evidence.filename):null;if(bytes&&bytes.length>5*1024*1024)throw new BadRequestException('La evidencia no puede superar 5 MiB.');
  const sha=bytes?createHash('sha256').update(bytes).digest('hex'):null,hash=digest(JSON.stringify({...input,evidence:input.evidence?{filename:input.evidence.filename,media_type:input.evidence.media_type,sha}:null,patientId,consentId}));
  return patientTransaction(a.organizationId!,async c=>{
   await query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[a.organizationId+':consent-event:'+input.request_id],c);
   await query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[a.organizationId+':consent-status:'+consentId],c);
   const [consent]=await query('SELECT id FROM patient_consents WHERE organization_id=$1 AND patient_id=$2 AND id=$3',[a.organizationId,patientId,consentId],c);if(!consent)throw new NotFoundException('No encontramos el consentimiento.');
   const [existing]=await query('SELECT id,version,status,request_hash FROM consent_events WHERE organization_id=$1 AND request_id=$2',[a.organizationId,input.request_id],c);if(existing){if(existing.request_hash!==hash)throw new ConflictException('La solicitud ya se usó con otro contenido.');return {id:existing.id,version:existing.version,status:existing.status};}
   const [patient]=await query('SELECT active FROM patients WHERE organization_id=$1 AND id=$2 FOR SHARE',[a.organizationId,patientId],c);if(!patient?.active)throw new BadRequestException('La ficha está inactiva.');
   const [org]=await query('SELECT timezone FROM organizations WHERE id=$1',[a.organizationId],c);const today=new Intl.DateTimeFormat('en-CA',{timeZone:org.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());if(input.occurred_on>today||input.occurred_on<'1900-01-01')throw new BadRequestException('La fecha debe ser válida y no futura.');
   const [prior]=await query('SELECT version,status FROM consent_events WHERE organization_id=$1 AND consent_id=$2 ORDER BY version DESC LIMIT 1',[a.organizationId,consentId],c);if((prior?.version||0)!==input.version)throw new ConflictException('El consentimiento cambió. Actualiza el historial.');if(prior&&(prior.status==='voided'||input.status!=='voided'))throw new ConflictException('Solo puedes anular un consentimiento ya aceptado o rechazado. Prepara otro documento para una nueva decisión.');
   let evidence=null;if(bytes&&input.evidence){const fileId=randomUUID();try{await configuredPrivateStorage().put(a.organizationId!,fileId,bytes);}catch{throw new ServiceUnavailableException('No se pudo guardar la evidencia privada. Reintenta.');}evidence={id:fileId,filename:input.evidence.filename,media_type:input.evidence.media_type,byte_size:bytes.length,sha256:sha};}
   const [event]=await query('INSERT INTO consent_events(organization_id,consent_id,version,request_id,request_hash,status,reason,signer_name,signer_relationship,occurred_on,evidence,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id,version,status',[a.organizationId,consentId,input.version+1,input.request_id,hash,input.status,input.reason,input.signer_name,input.signer_relationship,input.occurred_on,evidence?JSON.stringify(evidence):null,a.id],c);
   await audit(req,'consent.status_recorded','patient',patientId,a.organizationId!,a.id,{after:{consent_id:consentId,event_id:event.id,status:input.status}},c);return event;
  });
 }
 @Get('events/:eventId/evidence') async download(@Param('patientId')patientId:string,@Param('consentId')consentId:string,@Param('eventId')eventId:string,@Req()req:AuthRequest,@Res()res:Response){
  const a=await this.actor(req,patientId,consentId);parse(uuid,eventId);const result=await patientTransaction(a.organizationId!,async c=>{
   const [row]=await query('SELECT e.evidence FROM consent_events e JOIN patient_consents pc ON pc.organization_id=e.organization_id AND pc.id=e.consent_id WHERE e.organization_id=$1 AND pc.patient_id=$2 AND e.consent_id=$3 AND e.id=$4',[a.organizationId,patientId,consentId,eventId],c);if(!row?.evidence)throw new NotFoundException('No encontramos la evidencia.');let bytes:Buffer;try{bytes=await configuredPrivateStorage().get(a.organizationId!,row.evidence.id);}catch{throw new ServiceUnavailableException('La evidencia no está disponible.');}if(bytes.length!==row.evidence.byte_size||createHash('sha256').update(bytes).digest('hex')!==row.evidence.sha256)throw new ServiceUnavailableException('No se pudo verificar la evidencia.');await audit(req,'consent.evidence_downloaded','patient',patientId,a.organizationId!,a.id,{after:{consent_id:consentId,event_id:eventId}},c);return {bytes,name:row.evidence.filename as string};
  });res.setHeader('Content-Type','application/octet-stream');res.setHeader('Content-Disposition',`attachment; filename="evidence"; filename*=UTF-8''${encodeURIComponent(result.name).replace(/['()*]/g,c=>'%'+c.charCodeAt(0).toString(16))}`);res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.send(result.bytes);
 }
}
