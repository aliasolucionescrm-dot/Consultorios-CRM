import { BadRequestException,Body,ConflictException,Controller,Get,Inject,NotFoundException,Param,Post,Query,Req } from '@nestjs/common';
import { z } from 'zod';
import { Access,type AuthRequest,audit,parse,uuid } from './core';
import { prescriptionMissing,type ReviewRow } from './prescription-review';
import { patientTransaction } from './patients';
import { query } from '../../../packages/database/src/client';
const text=(max:number)=>z.string().trim().max(max);
const inputSchema=z.object({professional_id:uuid,title:text(120).min(1),medications:z.array(z.object({name:text(160).min(1),presentation:text(160),dose:text(160),route:text(100),frequency:text(160),duration:text(160),instructions:text(1000)}).strict()).min(1).max(20),notes:text(3000)}).strict();
const professionalColumns='id,name,specialty,license,specialty_license,professional_title,training_institution,practice_address,phone,relationship';
@Controller('api/patients/:patientId/prescription-drafts')
export class PrescriptionDraftsController{
 constructor(@Inject(Access)private access:Access){}
 private async accessPatient(req:AuthRequest,patientId:string,edit=false){const a=await this.access.tenant(req,'patients.view');await this.access.tenant(req,'clinical_records.view');if(edit)await this.access.tenant(req,'clinical_records.edit');parse(uuid,patientId);return a;}
 @Get('professionals') async professionals(@Param('patientId')patientId:string,@Query()raw:unknown,@Req()req:AuthRequest){
  const a=await this.accessPatient(req,patientId);const input=parse(z.object({q:text(160).default('')}).strict(),raw);
  return patientTransaction(a.organizationId!,async c=>{if(!(await query('SELECT id FROM patients WHERE organization_id=$1 AND id=$2',[a.organizationId,patientId],c)).length)throw new NotFoundException('No encontramos al paciente.');const rows=await query(`SELECT ${professionalColumns} FROM professionals WHERE organization_id=$1 AND active AND strpos(lower(name),lower($2))>0 ORDER BY name,id LIMIT 21`,[a.organizationId,input.q],c);return {items:rows.slice(0,20),hasMore:rows.length>20};});
 }
 @Get() async list(@Param('patientId')patientId:string,@Query()raw:unknown,@Req()req:AuthRequest){
  const a=await this.accessPatient(req,patientId);const input=parse(z.object({page:z.coerce.number().int().min(1).max(10000).default(1)}).strict(),raw);
  return patientTransaction(a.organizationId!,async c=>{if(!(await query('SELECT id FROM patients WHERE organization_id=$1 AND id=$2',[a.organizationId,patientId],c)).length)throw new NotFoundException('No encontramos al paciente.');const rows=await query('SELECT d.*,u.name AS author,(SELECT version FROM prescription_preparations pp WHERE pp.organization_id=d.organization_id AND pp.patient_id=d.patient_id AND pp.draft_id=d.id) AS prepared_version FROM prescription_drafts d JOIN users u ON u.id=d.created_by WHERE organization_id=$1 AND patient_id=$2 ORDER BY created_at DESC,id DESC,version DESC LIMIT 21 OFFSET $3',[a.organizationId,patientId,(input.page-1)*20],c);await audit(req,'prescription-draft.viewed','patient',patientId,a.organizationId!,a.id,{},c);return {items:rows.slice(0,20),hasMore:rows.length>20};});
 }
 @Get(':id/:version/review') async review(@Param('patientId')patientId:string,@Param('id')id:string,@Param('version')versionRaw:string,@Req()req:AuthRequest){
  const a=await this.accessPatient(req,patientId);parse(uuid,id);const version=parse(z.coerce.number().int().positive(),versionRaw);
  return patientTransaction(a.organizationId!,async c=>{
   const [row]=await query('SELECT d.*,u.name AS author FROM prescription_drafts d JOIN users u ON u.id=d.created_by WHERE organization_id=$1 AND patient_id=$2 AND d.id=$3 AND version=$4',[a.organizationId,patientId,id,version],c);if(!row)throw new NotFoundException('No encontramos esta versión del borrador.');
   const [latest]=await query('SELECT max(version)::int AS version FROM prescription_drafts WHERE organization_id=$1 AND patient_id=$2 AND id=$3',[a.organizationId,patientId,id],c);
   const [prepared]=await query('SELECT p.*,u.name AS prepared_by_name FROM prescription_preparations p JOIN users u ON u.id=p.prepared_by WHERE organization_id=$1 AND patient_id=$2 AND draft_id=$3',[a.organizationId,patientId,id],c);
   await audit(req,'prescription.reviewed','patient',patientId,a.organizationId!,a.id,{after:{draft_id:id,version}},c);return {row,latest:latest.version,missing:prescriptionMissing(row as ReviewRow),prepared:prepared||null};
  });
 }
 @Post(':id/prepare') async prepare(@Param('patientId')patientId:string,@Param('id')id:string,@Body()raw:unknown,@Req()req:AuthRequest){
  const a=await this.accessPatient(req,patientId,true);parse(uuid,id);const input=parse(z.object({version:z.number().int().positive(),reviewed:z.literal(true)}).strict(),raw);
  return patientTransaction(a.organizationId!,async c=>{
   await query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[a.organizationId+':prescription:'+patientId+':'+id],c);
   const [prepared]=await query('SELECT * FROM prescription_preparations WHERE organization_id=$1 AND patient_id=$2 AND draft_id=$3',[a.organizationId,patientId,id],c);if(prepared){if(prepared.version!==input.version)throw new ConflictException('Ya se preparó otra versión.');return prepared;}
   const [row]=await query('SELECT * FROM prescription_drafts WHERE organization_id=$1 AND patient_id=$2 AND id=$3 ORDER BY version DESC LIMIT 1',[a.organizationId,patientId,id],c);if(!row)throw new NotFoundException('No encontramos el borrador.');if(row.version!==input.version)throw new ConflictException('Revisa la última versión antes de preparar.');
   const [patient]=await query('SELECT active FROM patients WHERE organization_id=$1 AND id=$2 FOR SHARE',[a.organizationId,patientId],c);if(!patient?.active)throw new BadRequestException('La ficha está inactiva.');
   const [professional]=await query('SELECT active FROM professionals WHERE organization_id=$1 AND id=$2 FOR SHARE',[a.organizationId,row.input.professional_id],c);if(!professional?.active)throw new BadRequestException('El profesional está inactivo.');
   const missing=prescriptionMissing(row as ReviewRow);if(missing.length)throw new BadRequestException('Completa antes de preparar: '+missing.join(', '));
   const [result]=await query('INSERT INTO prescription_preparations(organization_id,patient_id,draft_id,version,prepared_by) VALUES($1,$2,$3,$4,$5) RETURNING *',[a.organizationId,patientId,id,input.version,a.id],c);
   await audit(req,'prescription.prepared_for_signature','patient',patientId,a.organizationId!,a.id,{after:{draft_id:id,version:input.version,document_id:result.id}},c);return result;
  });
 }
 @Post() async save(@Param('patientId')patientId:string,@Body()raw:unknown,@Req()req:AuthRequest){
  const a=await this.accessPatient(req,patientId,true);const input=parse(z.object({id:uuid,request_id:uuid,version:z.number().int().nonnegative(),data:inputSchema}).strict(),raw);
  return patientTransaction(a.organizationId!,async c=>{
   await query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[a.organizationId+':prescription:'+patientId+':'+input.id],c);
   const [existing]=await query('SELECT * FROM prescription_drafts WHERE organization_id=$1 AND request_id=$2',[a.organizationId,input.request_id],c);
   if(existing){if(existing.patient_id!==patientId||existing.id!==input.id||existing.version!==input.version+1||JSON.stringify(parse(inputSchema,existing.input))!==JSON.stringify(input.data))throw new ConflictException('Esta solicitud ya se utilizó con otro contenido.');return {id:existing.id,version:existing.version};}
   if((await query('SELECT id FROM prescription_preparations WHERE organization_id=$1 AND patient_id=$2 AND draft_id=$3',[a.organizationId,patientId,input.id],c)).length)throw new ConflictException('Este borrador ya se preparó para firma. Crea uno nuevo para corregirlo.');
   const [patient]=await query('SELECT first_name,last_name,record_number,birth_date,active FROM patients WHERE organization_id=$1 AND id=$2 FOR SHARE',[a.organizationId,patientId],c);if(!patient)throw new NotFoundException('No encontramos al paciente.');if(!patient.active)throw new BadRequestException('La ficha está inactiva.');
   const [prior]=await query('SELECT version FROM prescription_drafts WHERE organization_id=$1 AND patient_id=$2 AND id=$3 ORDER BY version DESC LIMIT 1',[a.organizationId,patientId,input.id],c);if((prior?.version||0)!==input.version)throw new ConflictException('El borrador cambió. Consulta la última versión antes de editar.');
   const [professional]=await query(`SELECT ${professionalColumns} FROM professionals WHERE organization_id=$1 AND id=$2 AND active FOR SHARE`,[a.organizationId,input.data.professional_id],c);if(!professional)throw new BadRequestException('Selecciona un profesional activo de esta clínica.');
   const [organization]=await query('SELECT name,address,phone,timezone FROM organizations WHERE id=$1 FOR SHARE',[a.organizationId],c);
   const version=input.version+1;await query('INSERT INTO prescription_drafts(organization_id,patient_id,id,version,request_id,input,snapshot,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[a.organizationId,patientId,input.id,version,input.request_id,JSON.stringify(input.data),JSON.stringify({patient,professional,organization}),a.id],c);
   await audit(req,'prescription-draft.saved','patient',patientId,a.organizationId!,a.id,{after:{draft_id:input.id,version}},c);return {id:input.id,version};
  });
 }
}
