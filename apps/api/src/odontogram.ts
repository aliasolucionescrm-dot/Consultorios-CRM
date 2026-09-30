import { BadRequestException,Body,ConflictException,Controller,Get,Inject,NotFoundException,Param,Post,Query,Req } from '@nestjs/common';
import { z } from 'zod';
import { Access,type AuthRequest,audit,parse,uuid } from './core';
import { patientTransaction } from './patients';
import { query } from '../../../packages/database/src/client';
const mark=z.object({tooth:z.string().regex(/^[1-4][1-8]$|^[5-8][1-5]$/),surface:z.enum(['whole','mesial','distal','vestibular','oral','occlusal_incisal']).optional(),photo_id:uuid.optional(),text:z.string().trim().max(1500),diagnosis:z.string().trim().max(1500).optional()}).strict().refine(m=>!!m.text||!!m.diagnosis,'Escribe una observación o diagnóstico.');
@Controller('api/patients/:patientId/odontogram')
export class OdontogramController {
 constructor(@Inject(Access)private access:Access){}
 @Get() async read(@Param('patientId')patientId:string,@Query()raw:unknown,@Req()req:AuthRequest){
  const a=await this.access.tenant(req,'patients.view');await this.access.tenant(req,'clinical_records.view');parse(uuid,patientId);
  const input=parse(z.object({version:z.coerce.number().int().positive().optional()}).strict(),raw);
  return patientTransaction(a.organizationId!,async c=>{
   if(!(await query('SELECT id FROM patients WHERE organization_id=$1 AND id=$2',[a.organizationId,patientId],c)).length)throw new NotFoundException('No encontramos la ficha del paciente.');
   const history=await query('SELECT a.version,a.created_at,u.name AS author FROM odontogram_versions a JOIN users u ON u.id=a.created_by WHERE a.organization_id=$1 AND a.patient_id=$2 ORDER BY a.version DESC LIMIT 25',[a.organizationId,patientId],c);
   const latest=history[0]?.version||0;
   const [row]=await query('SELECT version,marks,diagnosis FROM odontogram_versions WHERE organization_id=$1 AND patient_id=$2 AND version=$3',[a.organizationId,patientId,input.version||latest],c);
   if(input.version&&!row)throw new NotFoundException('No encontramos esa versión.');
   await audit(req,'odontogram_viewed','patient',patientId,a.organizationId!,a.id,{after:{version:row?.version||0}},c);
   return {version:row?.version||0,marks:row?.marks||[],diagnosis:row?.diagnosis||'',latest,history};
  });
 }
 @Post() async save(@Param('patientId')patientId:string,@Body()raw:unknown,@Req()req:AuthRequest){
  const a=await this.access.tenant(req,'patients.view');await this.access.tenant(req,'clinical_records.view');await this.access.tenant(req,'clinical_records.edit');parse(uuid,patientId);
  const input=parse(z.object({version:z.number().int().min(0),marks:z.array(mark).max(312),diagnosis:z.string().trim().max(3000).default('')}).strict(),raw);
  if(new Set(input.marks.map(m=>m.tooth+':'+(m.surface||'whole'))).size!==input.marks.length)throw new BadRequestException('Hay marcas duplicadas.');
  return patientTransaction(a.organizationId!,async c=>{
   await query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[a.organizationId+':odontogram:'+patientId],c);
   const [photo]=await query('SELECT active FROM patients WHERE organization_id=$1 AND id=$2 FOR SHARE',[a.organizationId,patientId],c);
   if(!photo)throw new NotFoundException('No encontramos la ficha del paciente.');if(!photo.active)throw new BadRequestException('La ficha está inactiva.');
   const [before]=await query('SELECT version,marks,diagnosis FROM odontogram_versions WHERE organization_id=$1 AND patient_id=$2 ORDER BY version DESC LIMIT 1',[a.organizationId,patientId],c);
   if((before?.version||0)!==input.version){
    if(before?.version===input.version+1&&before.diagnosis===input.diagnosis&&JSON.stringify(parse(z.array(mark),before.marks))===JSON.stringify(input.marks))return {version:before.version};
    throw new ConflictException('Otra persona guardó una versión nueva. Conserva tus notas y vuelve a abrir la ficha.');
   }
   const photos=[...new Set(input.marks.flatMap(m=>m.photo_id?[m.photo_id]:[]))];
   if(photos.length){const found=await query('SELECT id FROM patient_attachments WHERE organization_id=$1 AND patient_id=$2 AND clinical AND id=ANY($3::uuid[])',[a.organizationId,patientId,photos],c);if(found.length!==photos.length)throw new BadRequestException('La fotografía debe ser clínica y pertenecer a este paciente.');}
   const version=input.version+1;
   await query('INSERT INTO odontogram_versions(organization_id,patient_id,version,marks,created_by,diagnosis) VALUES($1,$2,$3,$4,$5,$6)',[a.organizationId,patientId,version,JSON.stringify(input.marks),a.id,input.diagnosis],c);
   await audit(req,'odontogram_saved','patient',patientId,a.organizationId!,a.id,{after:{version,count:input.marks.length}},c);return {version};
  });
 }
}
