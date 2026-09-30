import { BadRequestException,Body,ConflictException,Controller,Get,Inject,NotFoundException,Param,Post,Query,Req } from '@nestjs/common';
import { z } from 'zod';
import { Access,type AuthRequest,audit,parse,uuid } from './core';
import { patientTransaction } from './patients';
import { query } from '../../../packages/database/src/client';
const mark=z.object({id:uuid,service_id:uuid.optional(),service_requires_tooth:z.boolean().optional(),service_name:z.string().trim().min(1).max(160).optional(),tooth:z.string().regex(/^$|^[1-4][1-8]$|^[5-8][1-5]$/),title:z.string().trim().min(1).max(160),status:z.enum(['proposed','in_progress','completed','cancelled']),notes:z.string().trim().max(500)}).strict();
@Controller('api/patients/:patientId/treatment-plan')
export class TreatmentPlanController {
 constructor(@Inject(Access)private access:Access){}
 @Get('services') async services(@Param('patientId')patientId:string,@Query()raw:unknown,@Req()req:AuthRequest){
  const a=await this.access.tenant(req,'patients.view');await this.access.tenant(req,'clinical_records.view');const input=parse(z.object({q:z.string().trim().max(160).default('')}).strict(),raw);parse(uuid,patientId);
  return patientTransaction(a.organizationId!,async c=>{if(!(await query('SELECT id FROM patients WHERE organization_id=$1 AND id=$2',[a.organizationId,patientId],c)).length)throw new NotFoundException('No encontramos al paciente.');const rows=await query('SELECT id,name,requires_tooth FROM services WHERE organization_id=$1 AND active AND strpos(lower(name),lower($2))>0 ORDER BY name,id LIMIT 21',[a.organizationId,input.q],c);return {items:rows.slice(0,20),hasMore:rows.length>20};});
 }
 @Get() async read(@Param('patientId')patientId:string,@Query()raw:unknown,@Req()req:AuthRequest){
  const a=await this.access.tenant(req,'patients.view');await this.access.tenant(req,'clinical_records.view');parse(uuid,patientId);
  const input=parse(z.object({version:z.coerce.number().int().positive().optional()}).strict(),raw);
  return patientTransaction(a.organizationId!,async c=>{
   if(!(await query('SELECT id FROM patients WHERE organization_id=$1 AND id=$2',[a.organizationId,patientId],c)).length)throw new NotFoundException('No encontramos la ficha del paciente.');
   const history=await query('SELECT a.version,a.created_at,u.name AS author FROM treatment_plan_versions a JOIN users u ON u.id=a.created_by WHERE a.organization_id=$1 AND a.patient_id=$2 ORDER BY a.version DESC LIMIT 25',[a.organizationId,patientId],c);
   const latest=history[0]?.version||0;
   const [row]=await query('SELECT version,items FROM treatment_plan_versions WHERE organization_id=$1 AND patient_id=$2 AND version=$3',[a.organizationId,patientId,input.version||latest],c);
   if(input.version&&!row)throw new NotFoundException('No encontramos esa versión.');
   await audit(req,'treatment-plan_viewed','patient',patientId,a.organizationId!,a.id,{after:{version:row?.version||0}},c);
   return {version:row?.version||0,items:row?.items||[],latest,history};
  });
 }
 @Post() async save(@Param('patientId')patientId:string,@Body()raw:unknown,@Req()req:AuthRequest){
  const a=await this.access.tenant(req,'patients.view');await this.access.tenant(req,'clinical_records.view');await this.access.tenant(req,'clinical_records.edit');parse(uuid,patientId);
  const input=parse(z.object({version:z.number().int().min(0),items:z.array(mark).max(100)}).strict(),raw);
  if(new Set(input.items.map(m=>m.id)).size!==input.items.length)throw new BadRequestException('Hay procedimientos duplicados.');
  return patientTransaction(a.organizationId!,async c=>{
   await query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[a.organizationId+':treatment-plan:'+patientId],c);
   const [photo]=await query('SELECT active FROM patients WHERE organization_id=$1 AND id=$2 FOR SHARE',[a.organizationId,patientId],c);
   if(!photo)throw new NotFoundException('No encontramos la ficha del paciente.');if(!photo.active)throw new BadRequestException('La ficha está inactiva.');
   const [before]=await query('SELECT version,items FROM treatment_plan_versions WHERE organization_id=$1 AND patient_id=$2 ORDER BY version DESC LIMIT 1',[a.organizationId,patientId],c);
   if((before?.version||0)!==input.version){
    if(before?.version===input.version+1&&JSON.stringify(parse(z.array(mark),before.items))===JSON.stringify(input.items))return {version:before.version};
    throw new ConflictException('Otra persona guardó una versión nueva. Conserva tus notas y vuelve a abrir la ficha.');
   }
   for(const item of input.items){
    if(!item.service_id){if(item.service_name||item.service_requires_tooth!==undefined)throw new BadRequestException('El nombre del servicio requiere un vínculo.');continue;}
    const old=before?.items?.find((i:{id:string;service_id?:string})=>i.id===item.id&&i.service_id===item.service_id);
    if(item.service_requires_tooth&&!item.tooth)throw new BadRequestException('Este servicio requiere una pieza dental.');
    if(old){if(item.service_name!==old.service_name||item.service_requires_tooth!==old.service_requires_tooth)throw new BadRequestException('El nombre histórico del servicio no puede cambiar.');continue;}
    const [service]=await query('SELECT name,requires_tooth FROM services WHERE organization_id=$1 AND id=$2 AND active FOR SHARE',[a.organizationId,item.service_id],c);
    if(!service)throw new BadRequestException('El servicio no está disponible en esta organización.');
    if(item.service_requires_tooth!==service.requires_tooth)throw new ConflictException('Los requisitos del servicio cambiaron. Selecciónalo nuevamente.');
    if(item.service_name!==service.name)throw new ConflictException('El servicio cambió de nombre. Selecciónalo nuevamente.');
    if(service.requires_tooth&&!item.tooth)throw new BadRequestException('Este servicio requiere una pieza dental.');
   }
   const version=input.version+1;
   await query('INSERT INTO treatment_plan_versions(organization_id,patient_id,version,items,created_by) VALUES($1,$2,$3,$4,$5)',[a.organizationId,patientId,version,JSON.stringify(input.items),a.id],c);
   await audit(req,'treatment-plan_saved','patient',patientId,a.organizationId!,a.id,{after:{version,count:input.items.length}},c);return {version};
  });
 }
}
