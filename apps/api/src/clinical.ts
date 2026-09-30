import { BadRequestException,Body,ConflictException,Controller,Get,Inject,NotFoundException,Param,Post,Query,Req } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Access,type AuthRequest,audit,parse,uuid } from './core';
import { patientTransaction } from './patients';
import { query } from '../../../packages/database/src/client';
const condition=z.object({status:z.enum(['unknown','none_reported','reported']),detail:z.string().trim().max(1500)}).strict().refine(v=>v.status==='reported'?!!v.detail:!v.detail,'Indica el detalle de la condición reportada.');
const conditions=z.object({dietary:condition.optional(),pharmacological:condition.optional(),systemic:condition.optional(),infectious:condition.optional()}).strict();
const summary=z.object({allergy_status:z.enum(['unknown','none_reported','reported']),allergies:z.string().trim().max(3000),history:z.string().trim().max(6000),medications:z.string().trim().max(3000),conditions:conditions.optional()}).strict().refine(p=>p.allergy_status==='reported'?!!p.allergies:!p.allergies,'Indica las alergias reportadas o deja el detalle vacío para el estado seleccionado.');
const note=z.object({appointment_id:uuid.optional(),content:z.string().trim().min(1).max(10000)}).strict();
const inputSchema=z.discriminatedUnion('kind',[z.object({kind:z.literal('summary'),request_id:uuid,version:z.number().int().nonnegative(),payload:summary}).strict(),z.object({kind:z.literal('note'),request_id:uuid,payload:note}).strict()]);
@Controller('api/patients/:patientId/clinical')
export class ClinicalController{
 constructor(@Inject(Access)private access:Access){}
 @Get('appointments') async appointments(@Param('patientId')patientId:string,@Query()raw:unknown,@Req()req:AuthRequest){
  const a=await this.access.tenant(req,'patients.view');await this.access.tenant(req,'clinical_records.view');parse(uuid,patientId);const input=parse(z.object({page:z.coerce.number().int().min(1).max(10000).default(1)}).strict(),raw);
  return patientTransaction(a.organizationId!,async c=>{
   if(!(await query('SELECT id FROM patients WHERE organization_id=$1 AND id=$2',[a.organizationId,patientId],c)).length)throw new NotFoundException('No encontramos al paciente.');
   const items=await query('SELECT a.id,a.starts_at,a.timezone,a.status,p.name AS professional_name,s.name AS service_name FROM appointments a JOIN professionals p ON p.id=a.professional_id AND p.organization_id=a.organization_id JOIN services s ON s.id=a.service_id AND s.organization_id=a.organization_id WHERE a.organization_id=$1 AND a.patient_id=$2 ORDER BY a.starts_at DESC,a.id DESC LIMIT 21 OFFSET $3',[a.organizationId,patientId,(input.page-1)*20],c);
   await audit(req,'clinical.appointments_viewed','patient',patientId,a.organizationId!,a.id,{},c);return {items:items.slice(0,20),hasMore:items.length>20};
  });
 }
 @Get() async read(@Param('patientId')patientId:string,@Query()raw:unknown,@Req()req:AuthRequest){
  const a=await this.access.tenant(req,'patients.view');await this.access.tenant(req,'clinical_records.view');parse(uuid,patientId);const input=parse(z.object({page:z.coerce.number().int().min(1).max(10000).default(1)}).strict(),raw);
  return patientTransaction(a.organizationId!,async c=>{
   if(!(await query('SELECT id FROM patients WHERE organization_id=$1 AND id=$2',[a.organizationId,patientId],c)).length)throw new NotFoundException('No encontramos al paciente.');
   const [current]=await query("SELECT e.*,u.name AS author FROM clinical_entries e JOIN users u ON u.id=e.created_by WHERE e.organization_id=$1 AND e.patient_id=$2 AND kind='summary' ORDER BY version DESC LIMIT 1",[a.organizationId,patientId],c);
   const entries=await query('SELECT e.*,u.name AS author FROM clinical_entries e JOIN users u ON u.id=e.created_by WHERE e.organization_id=$1 AND e.patient_id=$2 ORDER BY created_at DESC,id DESC LIMIT 21 OFFSET $3',[a.organizationId,patientId,(input.page-1)*20],c);
   await audit(req,'clinical.record_viewed','patient',patientId,a.organizationId!,a.id,{},c);return {current:current||null,entries:entries.slice(0,20),hasMore:entries.length>20};
  });
 }
 @Post() async save(@Param('patientId')patientId:string,@Body()body:unknown,@Req()req:AuthRequest){
  const a=await this.access.tenant(req,'patients.view');await this.access.tenant(req,'clinical_records.view');await this.access.tenant(req,'clinical_records.edit');parse(uuid,patientId);const input=parse(inputSchema,body);
  return patientTransaction(a.organizationId!,async c=>{
   await query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[a.organizationId+':clinical:'+patientId],c);
   const [patient]=await query('SELECT active FROM patients WHERE organization_id=$1 AND id=$2 FOR SHARE',[a.organizationId,patientId],c);if(!patient)throw new NotFoundException('No encontramos al paciente.');
   const [existing]=await query('SELECT * FROM clinical_entries WHERE organization_id=$1 AND request_id=$2',[a.organizationId,input.request_id],c);
   if(existing){if(existing.patient_id!==patientId||existing.kind!==input.kind)throw new ConflictException('La solicitud ya se utilizó.');const payload=input.kind==='summary'?parse(summary,existing.payload):parse(note,{content:existing.payload.content,...(existing.payload.appointment_id?{appointment_id:existing.payload.appointment_id}:{})});if(JSON.stringify(payload)!==JSON.stringify(input.payload))throw new ConflictException('La solicitud ya se utilizó con otro contenido.');return {id:existing.id,version:existing.version};}
   if(!patient.active)throw new BadRequestException('La ficha está inactiva.');
   const [last]=await query('SELECT version FROM clinical_entries WHERE organization_id=$1 AND patient_id=$2 AND kind=$3 ORDER BY version DESC LIMIT 1',[a.organizationId,patientId,input.kind],c);const version=(last?.version||0)+1;
   if(input.kind==='summary'&&input.version!==version-1)throw new ConflictException('Los antecedentes cambiaron en otra sesión. Conserva tu texto y actualiza la ficha antes de guardar.');
   let payload:unknown=input.payload;
   if(input.kind==='note'&&input.payload.appointment_id){
    const [appointment]=await query('SELECT a.id,a.starts_at,a.timezone,a.status,p.name AS professional_name,s.name AS service_name FROM appointments a JOIN professionals p ON p.id=a.professional_id AND p.organization_id=a.organization_id JOIN services s ON s.id=a.service_id AND s.organization_id=a.organization_id WHERE a.organization_id=$1 AND a.patient_id=$2 AND a.id=$3 FOR SHARE OF a,p,s',[a.organizationId,patientId,input.payload.appointment_id],c);
    if(!appointment)throw new BadRequestException('La cita debe pertenecer a este paciente.');payload={...input.payload,appointment};
   }
   const id=randomUUID();await query('INSERT INTO clinical_entries(id,organization_id,patient_id,kind,version,request_id,payload,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[id,a.organizationId,patientId,input.kind,version,input.request_id,JSON.stringify(payload),a.id],c);
   await audit(req,'clinical.entry_created','patient',patientId,a.organizationId!,a.id,{after:{entry_id:id,kind:input.kind,version}},c);return {id,version};
  });
 }
}
