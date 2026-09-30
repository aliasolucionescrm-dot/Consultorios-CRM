import { BadRequestException,Body,ConflictException,Controller,Get,Inject,NotFoundException,Param,Post,Query,Req } from '@nestjs/common';
import { z } from 'zod';
import { Access,type AuthRequest,audit,parse,uuid } from './core';
import { patientTransaction } from './patients';
import { query } from '../../../packages/database/src/client';
const coordinate=z.number().min(0).max(1);
const mark=z.object({id:uuid,kind:z.enum(['arrow','circle','text']),x:coordinate,y:coordinate,x2:coordinate,y2:coordinate,label:z.object({x:coordinate,y:coordinate}).strict().optional(),text:z.string().trim().max(300),tooth:z.string().regex(/^$|^[1-4][1-8]$|^[5-8][1-5]$/)}).strict();
@Controller('api/patients/:patientId/photos/:id/annotations')
export class PhotoAnnotationsController {
 constructor(@Inject(Access)private access:Access){}
 @Get() async read(@Param('patientId')patientId:string,@Param('id')id:string,@Query()raw:unknown,@Req()req:AuthRequest){
  const a=await this.access.tenant(req,'patients.view');await this.access.tenant(req,'clinical_records.view');parse(uuid,id);parse(uuid,patientId);
  const input=parse(z.object({version:z.coerce.number().int().positive().optional()}).strict(),raw);
  return patientTransaction(a.organizationId!,async c=>{
   if(!(await query('SELECT id FROM patient_attachments WHERE organization_id=$1 AND patient_id=$2 AND id=$3 AND clinical',[a.organizationId,patientId,id],c)).length)throw new NotFoundException('No encontramos la fotografía clínica.');
   const history=await query('SELECT a.version,a.created_at,u.name AS author FROM photo_annotations a JOIN users u ON u.id=a.created_by WHERE a.organization_id=$1 AND a.attachment_id=$2 ORDER BY a.version DESC LIMIT 25',[a.organizationId,id],c);
   const latest=history[0]?.version||0;
   const [row]=await query('SELECT version,marks FROM photo_annotations WHERE organization_id=$1 AND attachment_id=$2 AND version=$3',[a.organizationId,id,input.version||latest],c);
   if(input.version&&!row)throw new NotFoundException('No encontramos esa versión.');
   await audit(req,'photo.annotations_viewed','patient',patientId,a.organizationId!,a.id,{after:{attachment_id:id,version:row?.version||0}},c);
   return {version:row?.version||0,marks:row?.marks||[],latest,history};
  });
 }
 @Post() async save(@Param('patientId')patientId:string,@Param('id')id:string,@Body()raw:unknown,@Req()req:AuthRequest){
  const a=await this.access.tenant(req,'patients.edit');await this.access.tenant(req,'clinical_records.edit');parse(uuid,id);parse(uuid,patientId);
  const input=parse(z.object({version:z.number().int().min(0),marks:z.array(mark).max(100)}).strict(),raw);
  if(new Set(input.marks.map(m=>m.id)).size!==input.marks.length)throw new BadRequestException('Hay marcas duplicadas.');
  return patientTransaction(a.organizationId!,async c=>{
   await query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[a.organizationId+':photo:'+id],c);
   const [photo]=await query('SELECT p.active FROM patient_attachments a JOIN patients p ON p.organization_id=a.organization_id AND p.id=a.patient_id WHERE a.organization_id=$1 AND a.patient_id=$2 AND a.id=$3 AND a.clinical FOR SHARE OF p',[a.organizationId,patientId,id],c);
   if(!photo)throw new NotFoundException('No encontramos la fotografía clínica.');if(!photo.active)throw new BadRequestException('La ficha está inactiva.');
   const [before]=await query('SELECT version,marks FROM photo_annotations WHERE organization_id=$1 AND attachment_id=$2 ORDER BY version DESC LIMIT 1',[a.organizationId,id],c);
   if((before?.version||0)!==input.version){
    if(before?.version===input.version+1&&JSON.stringify(parse(z.array(mark),before.marks))===JSON.stringify(input.marks))return {version:before.version};
    throw new ConflictException('Otra persona guardó una versión nueva. Conserva tus notas y vuelve a abrir la fotografía.');
   }
   const version=input.version+1;
   await query('INSERT INTO photo_annotations(organization_id,attachment_id,version,marks,created_by) VALUES($1,$2,$3,$4,$5)',[a.organizationId,id,version,JSON.stringify(input.marks),a.id],c);
   await audit(req,'photo.annotations_saved','patient',patientId,a.organizationId!,a.id,{after:{attachment_id:id,version,count:input.marks.length}},c);return {version};
  });
 }
}
