import { Body,Controller,Get,Inject,Param,Patch,Post,Query,Req,BadRequestException,NotFoundException,ConflictException } from '@nestjs/common';
import { ApiTags,ApiOperation } from '@nestjs/swagger';
import { z } from 'zod';
import type { PoolClient } from 'pg';
import { Access,type AuthRequest,parse,uuid,email,audit,digest } from './core';
import { transaction,query } from '../../../packages/database/src/client';

const text=(max:number)=>z.string().trim().max(max).default('');
const phone=z.string().trim().max(30).refine(v=>v===''||(/^[+()\d\s.-]+$/.test(v)&&v.replace(/\D/g,'').length>=7),'Introduce un teléfono válido.').default('');
const birthDate=z.union([z.literal(''),z.iso.date()]).refine(v=>!v||(v>='1850-01-01'&&v<=new Date().toISOString().slice(0,10)&&new Date(`${v}T12:00:00Z`).toISOString().slice(0,10)===v),'La fecha de nacimiento no es válida.').default('');
export const patientInput=z.object({
 first_name:z.string().trim().min(1).max(100),last_name:z.string().trim().min(1).max(150),
 birth_date:birthDate,sex:z.enum(['female','male','other','not_specified']).default('not_specified'),
 phone,whatsapp:phone,email:z.union([z.literal(''),email]).default(''),address:text(500),occupation:text(120),
 emergency_name:text(180),emergency_phone:phone,guardian_name:text(180),guardian_relationship:text(80),
 fiscal_name:text(200),fiscal_rfc:z.string().trim().max(13).regex(/^[A-ZÑ&0-9]*$/).default(''),
 fiscal_postal_code:z.string().regex(/^(\d{5})?$/).default(''),administrative_notes:text(2000),
 tags:z.array(z.string().trim().min(1).max(30)).max(10).transform(v=>[...new Set(v)]).default([]),active:z.boolean().default(true)
}).strict();
const cursorSchema=z.object({last:z.string().max(150),first:z.string().max(100),id:uuid,org:uuid,q:z.string().max(100),status:z.enum(['active','inactive','all'])}).strict();
const listSchema=z.object({q:z.string().trim().max(100).default(''),status:z.enum(['active','inactive','all']).default('active'),cursor:z.string().max(2000).optional(),limit:z.coerce.number().int().min(1).max(50).default(20)}).strict();
const columns=['first_name','last_name','birth_date','sex','phone','whatsapp','email','address','occupation','emergency_name','emergency_phone','guardian_name','guardian_relationship','fiscal_name','fiscal_rfc','fiscal_postal_code','administrative_notes','tags','active'] as const;
const summary='id,record_number,first_name,last_name,to_char(birth_date,\'YYYY-MM-DD\') AS birth_date,phone,email,tags,active,version';
const detail=`${summary},sex,whatsapp,address,occupation,emergency_name,emergency_phone,guardian_name,guardian_relationship,fiscal_name,fiscal_rfc,fiscal_postal_code,administrative_notes,created_at,updated_at`;
export async function patientTransaction<T>(org:string,work:(c:PoolClient)=>Promise<T>):Promise<T>{
 return transaction(async c=>{await c.query("SELECT set_config('app.organization_id',$1,true)",[org]);return work(c);});
}
function normalize(value:string){const normalized=value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();return /^[+()\d\s.-]+$/.test(normalized)?normalized.replace(/\D/g,''):normalized;}

@ApiTags('Pacientes')
@Controller('api/patients')
export class PatientsController {
 constructor(@Inject(Access)private access:Access){}

 @Get(':id/relatives') async relatives(@Param('id')id:string,@Req()req:AuthRequest){
  const a=await this.access.tenant(req,'patients.view');parse(uuid,id);
  return patientTransaction(a.organizationId!,async c=>{
   if(!(await query('SELECT id FROM patients WHERE organization_id=$1 AND id=$2',[a.organizationId,id],c)).length)throw new NotFoundException('No encontramos al paciente.');
   const rows=await query(`SELECT r.id,r.version,r.patient_id,r.relationship,p.id AS relative_id,p.first_name,p.last_name,p.record_number,p.active FROM patient_relations r JOIN patients p ON p.organization_id=r.organization_id AND p.id=CASE WHEN r.patient_id=$2 THEN r.relative_id ELSE r.patient_id END WHERE r.organization_id=$1 AND (r.patient_id=$2 OR r.relative_id=$2) AND r.active ORDER BY p.last_name,p.first_name,r.id`,[a.organizationId,id],c);
   const inverse:Record<string,string>={parent:'child',child:'parent',sibling:'sibling',partner:'partner',grandparent:'grandchild',grandchild:'grandparent',other:'other'};
   return {items:rows.map(r=>({...r,relationship:r.patient_id===id?r.relationship:inverse[r.relationship]}))};
  });
 }
 @Post(':id/relatives') async addRelative(@Param('id')id:string,@Body()body:unknown,@Req()req:AuthRequest){
  const a=await this.access.tenant(req,'patients.edit');parse(uuid,id);
  const input=parse(z.object({relative_id:uuid,relationship:z.enum(['parent','child','sibling','partner','grandparent','grandchild','other'])}).strict(),body);
  if(id===input.relative_id)throw new BadRequestException('Selecciona otra persona.');
  return patientTransaction(a.organizationId!,async c=>{
   const patients=await query('SELECT id FROM patients WHERE organization_id=$1 AND id=ANY($2::uuid[]) ORDER BY id FOR SHARE',[a.organizationId,[id,input.relative_id]],c);
   if(patients.length!==2)throw new NotFoundException('Ambos pacientes deben pertenecer a esta organización.');
   const [result]=await query('INSERT INTO patient_relations(organization_id,patient_id,relative_id,relationship) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING id,version',[a.organizationId,id,input.relative_id,input.relationship],c);
   if(!result)throw new ConflictException('Estas personas ya están vinculadas.');
   await audit(req,'patient.relative_added','patient',id,a.organizationId!,a.id,{after:{relation_id:result.id,relative_id:input.relative_id,relationship:input.relationship}},c);return result;
  });
 }
 @Patch(':id/relatives/:relationId/remove') async removeRelative(@Param('id')id:string,@Param('relationId')relationId:string,@Body()body:unknown,@Req()req:AuthRequest){
  const a=await this.access.tenant(req,'patients.edit');parse(uuid,id);parse(uuid,relationId);
  const input=parse(z.object({version:z.number().int().positive(),reason:z.string().trim().min(1).max(500)}).strict(),body);
  return patientTransaction(a.organizationId!,async c=>{
   const [before]=await query('SELECT version,active FROM patient_relations WHERE organization_id=$1 AND id=$2 AND (patient_id=$3 OR relative_id=$3) FOR UPDATE',[a.organizationId,relationId,id],c);
   if(!before)throw new NotFoundException('No encontramos el vínculo.');
   if(!before.active||before.version!==input.version)throw new ConflictException('El vínculo cambió. Actualiza la ficha.');
   await query('UPDATE patient_relations SET active=false,version=version+1 WHERE organization_id=$1 AND id=$2',[a.organizationId,relationId],c);
   await audit(req,'patient.relative_removed','patient',id,a.organizationId!,a.id,{after:{relation_id:relationId},reason:input.reason},c);return {id:relationId};
  });
 }

 @Get(':id/next-appointment') async nextAppointment(@Param('id')id:string,@Req()req:AuthRequest){
  const a=await this.access.tenant(req,'patients.view');await this.access.tenant(req,'appointments.view');parse(uuid,id);
  return patientTransaction(a.organizationId!,async c=>{
   if(!(await query('SELECT id FROM patients WHERE organization_id=$1 AND id=$2',[a.organizationId,id],c)).length)throw new NotFoundException('No encontramos a ese paciente en esta organización.');
   const [appointment]=await query(`SELECT a.id,a.branch_id,a.starts_at,a.ends_at,a.timezone,a.status,s.name AS service_name,pr.name AS professional_name,r.name AS room_name,b.name AS branch_name FROM appointments a JOIN services s ON s.id=a.service_id JOIN professionals pr ON pr.id=a.professional_id JOIN rooms r ON r.id=a.room_id JOIN branches b ON b.id=a.branch_id WHERE a.organization_id=$1 AND a.patient_id=$2 AND a.starts_at>=now() AND a.status IN ('pending','confirmed','arrived','in_consultation') ORDER BY a.starts_at,a.id LIMIT 1`,[a.organizationId,id],c);
   return {appointment:appointment||null};
  });
 }

 @Get()
 @ApiOperation({summary:'Buscar pacientes por nombre, teléfono, correo o expediente; paginación por cursor'})
 async list(@Query()raw:unknown,@Req()req:AuthRequest){
  const a=await this.access.tenant(req,'patients.view'),input=parse(listSchema,raw),normalized=normalize(input.q);
  let cursor:z.infer<typeof cursorSchema>|undefined;
  if(input.cursor){try{cursor=parse(cursorSchema,JSON.parse(Buffer.from(input.cursor,'base64url').toString('utf8')));}catch{throw new BadRequestException('La página solicitada no es válida. Reinicia la búsqueda.');}
   if(cursor.org!==a.organizationId||cursor.q!==normalized||cursor.status!==input.status)throw new BadRequestException('La búsqueda cambió. Vuelve a la primera página.');}
  return patientTransaction(a.organizationId!,async c=>{
   await c.query("SELECT set_config('pg_trgm.word_similarity_threshold','0.3',true)");
   const args:unknown[]=[a.organizationId];const where=['organization_id=$1'];
   if(input.status!=='all'){args.push(input.status==='active');where.push(`active=$${args.length}`);}
   const tokens=normalized.split(/\s+/).filter(Boolean).slice(0,8);
   for(const word of tokens){const escaped=word.replace(/[\\%_]/g,'\\$&');args.push(`%${escaped}%`);let condition=`search_text LIKE $${args.length}`;
    if(/^[a-z]{4,}$/.test(word)){args.push(word);condition+=` OR search_text %> $${args.length}`;}
    where.push(`(${condition})`);
   }
   if(cursor){args.push(cursor.last,cursor.first,cursor.id);where.push(`(last_name,first_name,id)>($${args.length-2},$${args.length-1},$${args.length}::uuid)`);}
   args.push(input.limit+1);
   const rows=await query(`SELECT ${summary} FROM patients WHERE ${where.join(' AND ')} ORDER BY last_name,first_name,id LIMIT $${args.length}`,args,c);
   const items=rows.slice(0,input.limit),last=items.at(-1);
   await audit(req,'patients.searched','patient',null,a.organizationId!,a.id,{after:{count:items.length,filtered:!!normalized}},c);
   return {items,nextCursor:rows.length>input.limit&&last?Buffer.from(JSON.stringify({last:last.last_name,first:last.first_name,id:last.id,org:a.organizationId,q:normalized,status:input.status})).toString('base64url'):null};
  });
 }

 @Get(':id') async get(@Param('id')id:string,@Req()req:AuthRequest){
  const a=await this.access.tenant(req,'patients.view');parse(uuid,id);
  return patientTransaction(a.organizationId!,async c=>{const [patient]=await query(`SELECT ${detail} FROM patients WHERE id=$1 AND organization_id=$2`,[id,a.organizationId],c);
   if(!patient)throw new NotFoundException('No encontramos a ese paciente en esta organización.');
   await audit(req,'patient.viewed','patient',id,a.organizationId!,a.id,{},c);return patient;
  });
 }

 @Post() async create(@Body()raw:unknown,@Req()req:AuthRequest){
  const a=await this.access.tenant(req,'patients.create');const input=parse(patientInput.extend({request_id:uuid}),raw);
  const {request_id,...data}=input,hash=digest(JSON.stringify(data));
  return patientTransaction(a.organizationId!,async c=>{
   // Serializes folio allocation and retries per organization, never across organizations.
   await query('SELECT id FROM organizations WHERE id=$1 FOR UPDATE',[a.organizationId],c);
   const [existing]=await query('SELECT id,request_hash FROM patients WHERE organization_id=$1 AND request_id=$2',[a.organizationId,request_id],c);
   if(existing){if(existing.request_hash!==hash)throw new ConflictException('Esta solicitud ya se usó con otros datos. Abre un nuevo registro.');return {id:existing.id};}
   const [org]=await query('UPDATE organizations SET record_sequence=record_sequence+1 WHERE id=$1 RETURNING record_prefix,record_sequence',[a.organizationId],c);
   const record=`${org.record_prefix}${String(org.record_sequence).padStart(6,'0')}`;
   const values:unknown[]=[a.organizationId,request_id,hash,record,...columns.map(k=>k==='birth_date'?(data[k]||null):data[k])];
   const [patient]=await query(`INSERT INTO patients(organization_id,request_id,request_hash,record_number,${columns.join(',')}) VALUES(${values.map((_,i)=>`$${i+1}`).join(',')}) RETURNING id`,values,c);
   await audit(req,'patient.created','patient',patient.id,a.organizationId!,a.id,{after:{version:1}},c);return patient;
  });
 }

 @Patch(':id') async update(@Param('id')id:string,@Body()raw:unknown,@Req()req:AuthRequest){
  const a=await this.access.tenant(req,'patients.edit');parse(uuid,id);
  const input=parse(patientInput.extend({version:z.number().int().positive(),reason:z.string().trim().max(500).optional()}),raw);
  return patientTransaction(a.organizationId!,async c=>{
   const [before]=await query(`SELECT ${detail} FROM patients WHERE id=$1 AND organization_id=$2 FOR UPDATE`,[id,a.organizationId],c);
   if(!before)throw new NotFoundException('No encontramos a ese paciente en esta organización.');
   if(before.version!==input.version)throw new ConflictException('Otra persona modificó esta ficha. Tus cambios no se guardaron. Conserva lo que necesites y vuelve a abrir la ficha actualizada.');
   if(before.active!==input.active&&!input.reason)throw new BadRequestException('Indica el motivo del cambio de estado.');
   const values:unknown[]=[id,a.organizationId,...columns.map(k=>k==='birth_date'?(input[k]||null):input[k])];
   await query(`UPDATE patients SET ${columns.map((key,i)=>`${key}=$${i+3}`).join(',')},version=version+1,updated_at=now() WHERE id=$1 AND organization_id=$2`,values,c);
   const changed=columns.filter(k=>JSON.stringify(before[k]??'')!==JSON.stringify(input[k]));
   await audit(req,'patient.updated','patient',id,a.organizationId!,a.id,{before:{version:before.version},after:{version:before.version+1,fields:changed},reason:input.reason},c);
   return {id,version:before.version+1};
  });
 }
}
