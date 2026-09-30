import { BadRequestException,Body,ConflictException,Controller,Get,Inject,NotFoundException,Param,Post,Query,Req } from '@nestjs/common';
import { z } from 'zod';
import { Access,type AuthRequest,audit,parse,uuid } from './core';
import { patientTransaction } from './patients';
import { query } from '../../../packages/database/src/client';
const category=z.enum(['orthodontics','endodontics','surgery','extraction','other']);
const template=z.object({title:z.string().trim().min(1).max(160),category,status:z.enum(['draft','available','retired']),content:z.string().trim().min(20).max(20000)}).strict();
@Controller('api/consent-templates')
export class ConsentTemplatesController{
 constructor(@Inject(Access)private access:Access){}
 @Get() async list(@Query()raw:unknown,@Req()req:AuthRequest){
  const a=await this.access.tenant(req,'catalogs.view'),input=parse(z.object({id:uuid.optional(),page:z.coerce.number().int().min(1).max(10000).default(1)}).strict(),raw);
  return patientTransaction(a.organizationId!,async c=>{const rows=input.id?await query('SELECT t.*,u.name AS author FROM consent_template_versions t JOIN users u ON u.id=t.created_by WHERE organization_id=$1 AND t.id=$2 ORDER BY version DESC LIMIT 21 OFFSET $3',[a.organizationId,input.id,(input.page-1)*20],c):await query('SELECT t.*,u.name AS author FROM (SELECT DISTINCT ON(id) * FROM consent_template_versions WHERE organization_id=$1 ORDER BY id,version DESC) t JOIN users u ON u.id=t.created_by ORDER BY t.created_at DESC,t.id LIMIT 21 OFFSET $2',[a.organizationId,(input.page-1)*20],c);return {items:rows.slice(0,20),hasMore:rows.length>20};});
 }
 @Post() async save(@Body()raw:unknown,@Req()req:AuthRequest){
  const a=await this.access.tenant(req,'catalogs.manage'),input=parse(z.object({id:uuid,version:z.number().int().nonnegative(),data:template,reviewed:z.boolean().default(false)}).strict(),raw);
  if(input.data.status==='available'&&!input.reviewed)throw new BadRequestException('Confirma la revisión del texto antes de habilitar la plantilla.');
  return patientTransaction(a.organizationId!,async c=>{
   await query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[a.organizationId+':consent-template:'+input.id],c);
   const [prior]=await query('SELECT * FROM consent_template_versions WHERE organization_id=$1 AND id=$2 ORDER BY version DESC LIMIT 1',[a.organizationId,input.id],c);
   if((prior?.version||0)!==input.version){if(prior?.version===input.version+1&&JSON.stringify(parse(template,{title:prior.title,category:prior.category,status:prior.status,content:prior.content}))===JSON.stringify(input.data))return {id:input.id,version:prior.version};throw new ConflictException('La plantilla cambió. Abre su última versión.');}
   const version=input.version+1;await query('INSERT INTO consent_template_versions(organization_id,id,version,title,category,status,content,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[a.organizationId,input.id,version,input.data.title,input.data.category,input.data.status,input.data.content,a.id],c);
   await audit(req,'consent-template.saved','consent-template',input.id,a.organizationId!,a.id,{after:{version,status:input.data.status}},c);return {id:input.id,version};
  });
 }
}
@Controller('api/patients/:patientId/consents')
export class PatientConsentsController{
 constructor(@Inject(Access)private access:Access){}
 private async actor(req:AuthRequest,id:string,edit=false){const a=await this.access.tenant(req,'patients.view');await this.access.tenant(req,'clinical_records.view');if(edit)await this.access.tenant(req,'clinical_records.edit');parse(uuid,id);return a;}
 @Get('options') async options(@Param('patientId')patientId:string,@Query()raw:unknown,@Req()req:AuthRequest){
  const a=await this.actor(req,patientId);const input=parse(z.object({template_q:z.string().trim().max(160).default(''),professional_q:z.string().trim().max(160).default('')}).strict(),raw);
  return patientTransaction(a.organizationId!,async c=>{
   if(!(await query('SELECT id FROM patients WHERE organization_id=$1 AND id=$2',[a.organizationId,patientId],c)).length)throw new NotFoundException('No encontramos al paciente.');
   const templates=await query("SELECT id,version,title,category,content FROM (SELECT DISTINCT ON(id) * FROM consent_template_versions WHERE organization_id=$1 ORDER BY id,version DESC) t WHERE status='available' AND strpos(lower(title),lower($2))>0 ORDER BY title,id LIMIT 21",[a.organizationId,input.template_q],c);
   const professionals=await query('SELECT id,name,specialty FROM professionals WHERE organization_id=$1 AND active AND strpos(lower(name),lower($2))>0 ORDER BY name,id LIMIT 21',[a.organizationId,input.professional_q],c);
   const [plan]=await query('SELECT version,items FROM treatment_plan_versions WHERE organization_id=$1 AND patient_id=$2 ORDER BY version DESC LIMIT 1',[a.organizationId,patientId],c);
   return {templates:templates.slice(0,20),moreTemplates:templates.length>20,professionals:professionals.slice(0,20),moreProfessionals:professionals.length>20,plan:plan?{version:plan.version,items:plan.items.filter((i:{status:string})=>i.status!=='cancelled')}:null};
  });
 }
 @Get() async list(@Param('patientId')patientId:string,@Query()raw:unknown,@Req()req:AuthRequest){
  const a=await this.actor(req,patientId),input=parse(z.object({page:z.coerce.number().int().min(1).max(10000).default(1)}).strict(),raw);
  return patientTransaction(a.organizationId!,async c=>{if(!(await query('SELECT id FROM patients WHERE organization_id=$1 AND id=$2',[a.organizationId,patientId],c)).length)throw new NotFoundException('No encontramos al paciente.');const rows=await query('SELECT pc.*,u.name AS author,(SELECT status FROM consent_events e WHERE e.organization_id=pc.organization_id AND e.consent_id=pc.id ORDER BY version DESC LIMIT 1) AS status FROM patient_consents pc JOIN users u ON u.id=pc.created_by WHERE organization_id=$1 AND patient_id=$2 ORDER BY created_at DESC,pc.id DESC LIMIT 21 OFFSET $3',[a.organizationId,patientId,(input.page-1)*20],c);await audit(req,'consents.viewed','patient',patientId,a.organizationId!,a.id,{},c);return {items:rows.slice(0,20),hasMore:rows.length>20};});
 }
 @Post() async create(@Param('patientId')patientId:string,@Body()raw:unknown,@Req()req:AuthRequest){
  const a=await this.actor(req,patientId,true),input=parse(z.object({request_id:uuid,template_id:uuid,template_version:z.number().int().positive(),plan_version:z.number().int().positive(),plan_item_id:uuid,professional_id:uuid,notes:z.string().trim().max(3000)}).strict(),raw);
  return patientTransaction(a.organizationId!,async c=>{
   await query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[a.organizationId+':consent-request:'+input.request_id],c);
   const [existing]=await query('SELECT * FROM patient_consents WHERE organization_id=$1 AND request_id=$2',[a.organizationId,input.request_id],c);if(existing){if(existing.patient_id!==patientId||['template_id','template_version','plan_version','plan_item_id','professional_id','notes'].some(k=>existing[k]!==input[k as keyof typeof input]))throw new ConflictException('Esta solicitud ya se usó con otro contenido.');return {id:existing.id};}
   await query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[a.organizationId+':consent-template:'+input.template_id],c);
   const [patient]=await query('SELECT first_name,last_name,record_number,birth_date,guardian_name,guardian_relationship,active FROM patients WHERE organization_id=$1 AND id=$2 FOR SHARE',[a.organizationId,patientId],c);if(!patient)throw new NotFoundException('No encontramos al paciente.');if(!patient.active)throw new BadRequestException('La ficha está inactiva.');
   const [templateRow]=await query('SELECT title,category,status,content,version FROM consent_template_versions WHERE organization_id=$1 AND id=$2 ORDER BY version DESC LIMIT 1',[a.organizationId,input.template_id],c);if(!templateRow||templateRow.status!=='available'||templateRow.version!==input.template_version)throw new ConflictException('La plantilla cambió o ya no está disponible. Vuelve a seleccionarla.');
   const [plan]=await query('SELECT items FROM treatment_plan_versions WHERE organization_id=$1 AND patient_id=$2 AND version=$3',[a.organizationId,patientId,input.plan_version],c);const procedure=plan?.items.find((i:{id:string;status:string})=>i.id===input.plan_item_id&&i.status!=='cancelled');if(!procedure)throw new BadRequestException('Selecciona un procedimiento de este paciente.');
   const [professional]=await query('SELECT id,name,license,specialty FROM professionals WHERE organization_id=$1 AND id=$2 AND active FOR SHARE',[a.organizationId,input.professional_id],c);if(!professional)throw new BadRequestException('Selecciona un profesional activo de esta clínica.');
   const [organization]=await query('SELECT name,address,phone,timezone FROM organizations WHERE id=$1',[a.organizationId],c);
   const [row]=await query('INSERT INTO patient_consents(organization_id,patient_id,request_id,template_id,template_version,plan_version,plan_item_id,professional_id,snapshot,notes,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id',[a.organizationId,patientId,input.request_id,input.template_id,input.template_version,input.plan_version,input.plan_item_id,input.professional_id,JSON.stringify({patient,template:templateRow,procedure:{id:procedure.id,title:procedure.title,tooth:procedure.tooth},professional,organization}),input.notes,a.id],c);
   await audit(req,'consent.prepared','patient',patientId,a.organizationId!,a.id,{after:{consent_id:row.id,template_version:input.template_version}},c);return row;
  });
 }
}
