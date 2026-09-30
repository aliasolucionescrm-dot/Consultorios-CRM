import { BadRequestException,Body,ConflictException,Controller,Get,Inject,NotFoundException,Param,Patch,Post,Query,Req,Res,ServiceUnavailableException } from '@nestjs/common';
import type { Response } from 'express';
import { createHash,randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Access,type AuthRequest,audit,digest,parse,uuid } from './core';
import { patientTransaction } from './patients';
import { query } from '../../../packages/database/src/client';
import { configuredPrivateStorage,MAX_PRIVATE_FILE_BYTES } from './private-storage';
export const filename=z.string().trim().min(1).max(180).refine(v=>![...v].some(c=>c.charCodeAt(0)<32||c.charCodeAt(0)===127||c==='/'||c==='\\')&&v!=='.'&&v!=='..','Nombre de archivo inválido.');
const upload=z.object({request_id:uuid,filename,display_name:z.string().trim().max(100).default(''),clinical:z.boolean().default(false),media_type:z.enum(['image/png','image/jpeg','image/webp','application/pdf']),content_base64:z.string().min(4).max(Math.ceil(MAX_PRIVATE_FILE_BYTES/3)*4)}).strict();
const projection='id,display_name,filename,media_type,byte_size,created_at,clinical';
function storage(){try{return configuredPrivateStorage();}catch{throw new ServiceUnavailableException('El almacenamiento privado no está configurado.');}}
export function decode(content:string,media:string,name:string){
 const bytes=Buffer.from(content,'base64');
 if(!bytes.length||bytes.length>MAX_PRIVATE_FILE_BYTES||bytes.toString('base64')!==content)throw new BadRequestException('Contenido inválido o superior a 10 MiB.');
 const valid=media==='image/png'?bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'))&&/\.png$/i.test(name):media==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255&&/\.jpe?g$/i.test(name):media==='image/webp'?bytes.length>=20&&bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP'&&['VP8 ','VP8L','VP8X'].includes(bytes.subarray(12,16).toString())&&bytes.readUInt32LE(4)===bytes.length-8&&/\.webp$/i.test(name):bytes.subarray(0,5).toString()==='%PDF-'&&/\.pdf$/i.test(name);
 if(!valid)throw new BadRequestException('El nombre, formato y firma del archivo no coinciden. Solo PNG, JPEG, WebP y PDF.');
 return bytes;
}
@Controller('api/patients/:patientId/attachments')
export class AttachmentsController {
 constructor(@Inject(Access)private access:Access){}
 @Get() async list(@Param('patientId')patientId:string,@Query()raw:unknown,@Req()req:AuthRequest){
  const a=await this.access.tenant(req,'patients.view');parse(uuid,patientId);
  const input=parse(z.object({clinical:z.enum(['true','false']).default('false'),page:z.coerce.number().int().min(1).max(10000).default(1)}).strict(),raw);
  if(input.clinical==='true')await this.access.tenant(req,'clinical_records.view');
  return patientTransaction(a.organizationId!,async c=>{
   if(!(await query('SELECT id FROM patients WHERE organization_id=$1 AND id=$2',[a.organizationId,patientId],c)).length)throw new NotFoundException('No encontramos al paciente.');
   const rows=await query(`SELECT ${projection} FROM patient_attachments WHERE organization_id=$1 AND patient_id=$2 AND clinical=$4 ORDER BY created_at DESC,id DESC LIMIT 26 OFFSET $3`,[a.organizationId,patientId,(input.page-1)*25,input.clinical==='true'],c);
   return {items:rows.slice(0,25),hasMore:rows.length>25};
  });
 }
 @Post() async upload(@Param('patientId')patientId:string,@Body()body:unknown,@Req()req:AuthRequest){
  const a=await this.access.tenant(req,'patients.edit');parse(uuid,patientId);
  const input=parse(upload,body);if(input.clinical){await this.access.tenant(req,'clinical_records.edit');if(input.media_type==='application/pdf')throw new BadRequestException('Las fotografías clínicas deben ser PNG, JPEG o WebP.');}
  const bytes=decode(input.content_base64,input.media_type,input.filename);
  const sha=createHash('sha256').update(bytes).digest('hex'),hash=digest(JSON.stringify([patientId,input.filename,input.media_type,sha,...(input.clinical?[true]:[]),...(input.display_name?[input.display_name]:[])]));
  return patientTransaction(a.organizationId!,async c=>{
   await query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[a.organizationId+':attachment:'+input.request_id],c);
   const [patient]=await query('SELECT active FROM patients WHERE organization_id=$1 AND id=$2 FOR SHARE',[a.organizationId,patientId],c);
   if(!patient)throw new NotFoundException('No encontramos al paciente.');
   const [existing]=await query(`SELECT ${projection},request_hash FROM patient_attachments WHERE organization_id=$1 AND request_id=$2`,[a.organizationId,input.request_id],c);
   if(existing){if(existing.request_hash!==hash)throw new ConflictException('Esta solicitud ya se utilizó con otro archivo.');const {request_hash,...result}=existing;void request_hash;return result;}
   if(!patient.active)throw new BadRequestException('No se pueden añadir archivos a un paciente inactivo.');
   const id=randomUUID();
   try{await storage().put(a.organizationId!,id,bytes);}catch(error){if(error instanceof ServiceUnavailableException)throw error;throw new ServiceUnavailableException('No se pudo guardar el archivo. Puedes reintentar.');}
   // A DB failure may leave an encrypted orphan, never a downloadable incomplete record.
   // Do not delete on ambiguous commit outcomes; reconciliation must verify metadata first.
   const [result]=await query(`INSERT INTO patient_attachments(id,organization_id,patient_id,request_id,request_hash,filename,media_type,byte_size,sha256,created_by,clinical,display_name) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING ${projection}`,[id,a.organizationId,patientId,input.request_id,hash,input.filename,input.media_type,bytes.length,sha,a.id,input.clinical,input.display_name],c);
   await audit(req,'patient.attachment_uploaded','patient',patientId,a.organizationId!,a.id,{after:{attachment_id:id,byte_size:bytes.length,media_type:input.media_type}},c);return result;
  });
 }
 @Get('profile-photo') async profilePhoto(@Param('patientId')patientId:string,@Req()req:AuthRequest){
  const a=await this.access.tenant(req,'patients.view');parse(uuid,patientId);
  return patientTransaction(a.organizationId!,async c=>{
   if(!(await query('SELECT id FROM patients WHERE organization_id=$1 AND id=$2',[a.organizationId,patientId],c)).length)throw new NotFoundException('No encontramos al paciente.');
   const [row]=await query('SELECT p.attachment_id,p.version,a.media_type FROM patient_profile_photos p LEFT JOIN patient_attachments a ON a.organization_id=p.organization_id AND a.id=p.attachment_id WHERE p.organization_id=$1 AND p.patient_id=$2',[a.organizationId,patientId],c);return row||{attachment_id:null,version:0};
  });
 }
 @Patch('profile-photo') async setProfilePhoto(@Param('patientId')patientId:string,@Body()body:unknown,@Req()req:AuthRequest){
  const a=await this.access.tenant(req,'patients.edit');parse(uuid,patientId);const input=parse(z.object({attachment_id:uuid.nullable(),version:z.number().int().nonnegative()}).strict(),body);
  return patientTransaction(a.organizationId!,async c=>{
   await query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[a.organizationId+':profile-photo:'+patientId],c);
   const [patient]=await query('SELECT active FROM patients WHERE organization_id=$1 AND id=$2 FOR SHARE',[a.organizationId,patientId],c);if(!patient)throw new NotFoundException('No encontramos al paciente.');if(!patient.active)throw new BadRequestException('La ficha está inactiva.');
   const [before]=await query('SELECT attachment_id,version FROM patient_profile_photos WHERE organization_id=$1 AND patient_id=$2',[a.organizationId,patientId],c);
   if((before?.version||0)!==input.version){if(before?.version===input.version+1&&before.attachment_id===input.attachment_id)return before;throw new ConflictException('La fotografía cambió en otra sesión. Actualiza la ficha.');}
   if(input.attachment_id&&!(await query("SELECT id FROM patient_attachments WHERE organization_id=$1 AND patient_id=$2 AND id=$3 AND NOT clinical AND media_type IN ('image/png','image/jpeg','image/webp')",[a.organizationId,patientId,input.attachment_id],c)).length)throw new BadRequestException('Selecciona una imagen administrativa de este paciente.');
   const [row]=await query('INSERT INTO patient_profile_photos(organization_id,patient_id,attachment_id,version) VALUES($1,$2,$3,1) ON CONFLICT(organization_id,patient_id) DO UPDATE SET attachment_id=EXCLUDED.attachment_id,version=patient_profile_photos.version+1 RETURNING attachment_id,version',[a.organizationId,patientId,input.attachment_id],c);
   await audit(req,'patient.profile_photo_changed','patient',patientId,a.organizationId!,a.id,{after:{attachment_id:input.attachment_id}},c);return row;
  });
 }
 @Patch(':id/name') async rename(@Param('patientId')patientId:string,@Param('id')id:string,@Body()body:unknown,@Req()req:AuthRequest){
  const a=await this.access.tenant(req,'patients.edit');parse(uuid,patientId);parse(uuid,id);
  const input=parse(z.object({display_name:z.string().trim().min(1).max(100)}).strict(),body);
  return patientTransaction(a.organizationId!,async c=>{
   const [row]=await query('SELECT clinical FROM patient_attachments WHERE organization_id=$1 AND patient_id=$2 AND id=$3',[a.organizationId,patientId,id],c);
   if(!row)throw new NotFoundException('No encontramos el archivo.');
   if(row.clinical)await this.access.tenant(req,'clinical_records.edit');
   const [patient]=await query('SELECT active FROM patients WHERE organization_id=$1 AND id=$2 FOR SHARE',[a.organizationId,patientId],c);
   if(!patient?.active)throw new BadRequestException('La ficha está inactiva.');
   const [result]=await query('UPDATE patient_attachments SET display_name=$4 WHERE organization_id=$1 AND patient_id=$2 AND id=$3 RETURNING '+projection,[a.organizationId,patientId,id,input.display_name],c);
   await audit(req,'patient.attachment_renamed','patient',patientId,a.organizationId!,a.id,{after:{attachment_id:id}},c);return result;
  });
 }
 @Get(':id') async metadata(@Param('patientId')patientId:string,@Param('id')id:string,@Req()req:AuthRequest){
  const a=await this.access.tenant(req,'patients.view');parse(uuid,patientId);parse(uuid,id);
  return patientTransaction(a.organizationId!,async c=>{
   const [row]=await query('SELECT '+projection+' FROM patient_attachments WHERE organization_id=$1 AND patient_id=$2 AND id=$3',[a.organizationId,patientId,id],c);
   if(!row)throw new NotFoundException('No encontramos el archivo.');if(row.clinical)await this.access.tenant(req,'clinical_records.view');
   await audit(req,'patient.attachment_viewed','patient',patientId,a.organizationId!,a.id,{after:{attachment_id:id}},c);return row;
  });
 }
 @Get(':id/content') async download(@Param('patientId')patientId:string,@Param('id')id:string,@Req()req:AuthRequest,@Res()res:Response){
  const a=await this.access.tenant(req,'patients.view');parse(uuid,patientId);parse(uuid,id);
  const result=await patientTransaction(a.organizationId!,async c=>{
   const [row]=await query('SELECT filename,byte_size,sha256,clinical FROM patient_attachments WHERE organization_id=$1 AND patient_id=$2 AND id=$3',[a.organizationId,patientId,id],c);
   if(!row)throw new NotFoundException('No encontramos el archivo.');
   if(row.clinical)await this.access.tenant(req,'clinical_records.view');
   let bytes:Buffer;try{bytes=await storage().get(a.organizationId!,id);}catch{throw new ServiceUnavailableException('El archivo no está disponible. Contacta a administración.');}
   if(bytes.length!==row.byte_size||createHash('sha256').update(bytes).digest('hex')!==row.sha256)throw new ServiceUnavailableException('No se pudo verificar la integridad del archivo.');
   await audit(req,'patient.attachment_downloaded','patient',patientId,a.organizationId!,a.id,{after:{attachment_id:id}},c);return {bytes,name:row.filename as string};
  });
  res.setHeader('Content-Type','application/octet-stream');res.setHeader('Content-Disposition',`attachment; filename="attachment"; filename*=UTF-8''${encodeURIComponent(result.name).replace(/['()*]/g,c=>'%'+c.charCodeAt(0).toString(16))}`);
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Length',result.bytes.length);res.send(result.bytes);
 }
}
