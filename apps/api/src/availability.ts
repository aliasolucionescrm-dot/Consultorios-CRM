import { Body,Controller,Get,Inject,Param,Patch,Post,Query,Req,BadRequestException,ConflictException,NotFoundException } from '@nestjs/common';
import { Temporal } from '@js-temporal/polyfill';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { Access,type AuthRequest,parse,uuid,audit } from './core';
import { patientTransaction as scope } from './patients';
import { query } from '../../../packages/database/src/client';
const wall=z.string().regex(/^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}$/);
const clock=z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const slot=z.object({day:z.number().int().min(1).max(7),start:clock,end:clock}).strict().refine(s=>s.start<s.end,'La hora final debe ser posterior al inicio.');
const weekly=z.array(slot).max(28).superRefine((slots,ctx)=>{
 for(let i=0;i<slots.length;i++)for(let j=i+1;j<slots.length;j++)if(slots[i].day===slots[j].day&&slots[i].start<slots[j].end&&slots[j].start<slots[i].end)ctx.addIssue({code:'custom',message:'Los turnos del mismo día no pueden superponerse.'});
});
type Slot=z.infer<typeof slot>;
export async function lockAvailability(org:string,c:PoolClient){await query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[`availability:${org}`],c);}
export function withinSchedule(slots:Slot[],start:string,end:string,zone:string){
 const a=Temporal.Instant.from(start).toZonedDateTimeISO(zone),b=Temporal.Instant.from(end).toZonedDateTimeISO(zone);
 if(a.toPlainDate().toString()!==b.toPlainDate().toString())return false;
 const from=a.toPlainTime().toString(),to=b.toPlainTime().toString();
 return slots.some(s=>s.day===a.dayOfWeek&&from>=s.start+':00'&&to<=s.end+':00');
}
export function localInstant(local:string,zone:string){try{return Temporal.PlainDateTime.from(local).toZonedDateTime(zone,{disambiguation:'reject'}).toInstant().toString();}catch{throw new BadRequestException('Fecha u hora inválida o ambigua en la zona de la organización.');}}
export async function assertAvailability(org:string,branch:string,professional:string,room:string,start:string,end:string,zone:string,c:PoolClient){
 const [schedule]=await query('SELECT weekly FROM professional_schedules WHERE organization_id=$1 AND professional_id=$2 AND branch_id=$3',[org,professional,branch],c);
 if(schedule&&!withinSchedule(schedule.weekly,start,end,zone))throw new ConflictException('La cita queda fuera del horario de atención del profesional. Revisa sus turnos y descansos.');
 const [roomSchedule]=await query('SELECT weekly FROM room_schedules WHERE organization_id=$1 AND room_id=$2',[org,room],c);
 if(roomSchedule&&!withinSchedule(roomSchedule.weekly,start,end,zone))throw new ConflictException('La cita queda fuera del horario del consultorio.');
 const [block]=await query('SELECT id FROM availability_blocks WHERE organization_id=$1 AND active AND starts_at<$5 AND ends_at>$4 AND (professional_id=$2 OR room_id=$3) LIMIT 1',[org,professional,room,start,end],c);
 if(block)throw new ConflictException('El profesional o consultorio tiene un bloqueo en ese periodo. Elige otro horario o recurso.');
}
@Controller('api/availability')
export class AvailabilityController {
 constructor(@Inject(Access)private access:Access){}
 @Get('schedule') async schedule(@Query()raw:unknown,@Req()req:AuthRequest){
  const a=await this.access.tenant(req,'appointments.view'),input=parse(z.object({professional_id:uuid,branch_id:uuid}).strict(),raw);
  return scope(a.organizationId!,async c=>{const [p]=await query('SELECT professional_id FROM professional_branches WHERE organization_id=$1 AND professional_id=$2 AND branch_id=$3',[a.organizationId,input.professional_id,input.branch_id],c);if(!p)throw new NotFoundException('Profesional no asignado a esta sucursal.');const [row]=await query('SELECT weekly,version FROM professional_schedules WHERE organization_id=$1 AND professional_id=$2 AND branch_id=$3',[a.organizationId,input.professional_id,input.branch_id],c);return row||{weekly:[],version:0};});
 }
 @Post('schedule') async saveSchedule(@Body()body:unknown,@Req()req:AuthRequest){
  const a=await this.access.tenant(req,'catalogs.manage'),input=parse(z.object({professional_id:uuid,branch_id:uuid,version:z.number().int().min(0),weekly,reason:z.string().trim().min(1).max(500)}).strict(),body);
  return scope(a.organizationId!,async c=>{
   await lockAvailability(a.organizationId!,c);
   const [org]=await query('SELECT timezone FROM organizations WHERE id=$1 FOR SHARE',[a.organizationId],c);
   const [p]=await query('SELECT p.id FROM professionals p JOIN professional_branches b ON b.professional_id=p.id AND b.organization_id=p.organization_id JOIN branches br ON br.id=b.branch_id AND br.organization_id=b.organization_id WHERE p.organization_id=$1 AND p.id=$2 AND b.branch_id=$3 AND p.active AND br.active FOR SHARE OF p,br',[a.organizationId,input.professional_id,input.branch_id],c);
   if(!p)throw new BadRequestException('Selecciona un profesional activo asignado a esta sucursal.');
   const [before]=await query('SELECT weekly,version FROM professional_schedules WHERE organization_id=$1 AND professional_id=$2 AND branch_id=$3',[a.organizationId,input.professional_id,input.branch_id],c);
   if((before?.version||0)!==input.version)throw new ConflictException('El horario cambió. Vuelve a seleccionar al profesional para recargarlo.');
   // Check all future reservations, including those crossing now; no silent truncation.
   const appointments=await query('SELECT starts_at,occupied_until AS ends_at FROM appointments WHERE organization_id=$1 AND professional_id=$2 AND branch_id=$3 AND occupied_until>now() AND status NOT IN (\'canceled\',\'no_show\')',[a.organizationId,input.professional_id,input.branch_id],c);
   if(appointments.some(r=>!withinSchedule(input.weekly,r.starts_at.toISOString(),r.ends_at.toISOString(),org.timezone)))throw new ConflictException('Hay citas futuras fuera de este horario. Reprográmalas o cancélalas antes de modificar los turnos.');
   const [result]=await query('INSERT INTO professional_schedules(organization_id,professional_id,branch_id,weekly) VALUES($1,$2,$3,$4) ON CONFLICT(organization_id,professional_id,branch_id) DO UPDATE SET weekly=EXCLUDED.weekly,version=professional_schedules.version+1,updated_at=now() RETURNING version',[a.organizationId,input.professional_id,input.branch_id,JSON.stringify(input.weekly)],c);
   await audit(req,'availability.schedule_updated','professional',input.professional_id,a.organizationId!,a.id,{before,after:{...input,version:result.version},reason:input.reason},c);return result;
  });
 }
 @Get('room-schedule') async roomSchedule(@Query()raw:unknown,@Req()req:AuthRequest){
  const a=await this.access.tenant(req,'appointments.view'),input=parse(z.object({room_id:uuid,branch_id:uuid}).strict(),raw);
  return scope(a.organizationId!,async c=>{const [p]=await query('SELECT id FROM rooms WHERE organization_id=$1 AND id=$2 AND branch_id=$3',[a.organizationId,input.room_id,input.branch_id],c);if(!p)throw new NotFoundException('Consultorio no encontrado en esta sucursal.');const [row]=await query('SELECT weekly,version FROM room_schedules WHERE organization_id=$1 AND room_id=$2',[a.organizationId,input.room_id],c);return row||{weekly:[],version:0};});
 }
 @Post('room-schedule') async saveRoomSchedule(@Body()body:unknown,@Req()req:AuthRequest){
  const a=await this.access.tenant(req,'catalogs.manage'),input=parse(z.object({room_id:uuid,branch_id:uuid,version:z.number().int().min(0),weekly,reason:z.string().trim().min(1).max(500)}).strict(),body);
  return scope(a.organizationId!,async c=>{
   await lockAvailability(a.organizationId!,c);
   const [org]=await query('SELECT timezone FROM organizations WHERE id=$1 FOR SHARE',[a.organizationId],c);
   const [p]=await query('SELECT r.id FROM rooms r JOIN branches br ON br.organization_id=r.organization_id AND br.id=r.branch_id WHERE r.organization_id=$1 AND r.id=$2 AND r.branch_id=$3 AND r.active AND br.active FOR SHARE OF r,br',[a.organizationId,input.room_id,input.branch_id],c);
   if(!p)throw new BadRequestException('Selecciona un consultorio activo asignado a esta sucursal.');
   const [before]=await query('SELECT weekly,version FROM room_schedules WHERE organization_id=$1 AND room_id=$2',[a.organizationId,input.room_id],c);
   if((before?.version||0)!==input.version)throw new ConflictException('El horario cambió. Vuelve a seleccionar al consultorio para recargarlo.');
   // Check all future reservations, including those crossing now; no silent truncation.
   const appointments=await query('SELECT starts_at,occupied_until AS ends_at FROM appointments WHERE organization_id=$1 AND room_id=$2 AND occupied_until>now() AND status NOT IN (\'canceled\',\'no_show\')',[a.organizationId,input.room_id],c);
   if(appointments.some(r=>!withinSchedule(input.weekly,r.starts_at.toISOString(),r.ends_at.toISOString(),org.timezone)))throw new ConflictException('Hay citas futuras fuera de este horario. Reprográmalas o cancélalas antes de modificar los turnos.');
   const [result]=await query('INSERT INTO room_schedules(organization_id,room_id,weekly) VALUES($1,$2,$3) ON CONFLICT(organization_id,room_id) DO UPDATE SET weekly=EXCLUDED.weekly,version=room_schedules.version+1,updated_at=now() RETURNING version',[a.organizationId,input.room_id,JSON.stringify(input.weekly)],c);
   await audit(req,'availability.room_schedule_updated','room',input.room_id,a.organizationId!,a.id,{before,after:{...input,version:result.version},reason:input.reason},c);return result;
  });
 }
 @Get('blocks') async blocks(@Query()raw:unknown,@Req()req:AuthRequest){
  const a=await this.access.tenant(req,'appointments.view'),input=parse(z.object({branch_id:uuid,date:z.iso.date(),page:z.coerce.number().int().min(1).default(1)}).strict(),raw);
  return scope(a.organizationId!,async c=>{const [org]=await query('SELECT timezone FROM organizations WHERE id=$1',[a.organizationId],c);const start=Temporal.PlainDate.from(input.date).toZonedDateTime(org.timezone),end=start.add({days:1});const rows=await query(`SELECT b.id,b.professional_id,b.room_id,b.starts_at,b.ends_at,b.reason,b.version,coalesce(p.name,r.name) AS resource_name FROM availability_blocks b LEFT JOIN professionals p ON p.id=b.professional_id LEFT JOIN rooms r ON r.id=b.room_id WHERE b.organization_id=$1 AND b.active AND b.starts_at<$4 AND b.ends_at>$3 AND (b.branch_id=$2 OR EXISTS(SELECT 1 FROM professional_branches pb WHERE pb.organization_id=b.organization_id AND pb.professional_id=b.professional_id AND pb.branch_id=$2)) ORDER BY b.starts_at,b.id LIMIT 51 OFFSET $5`,[a.organizationId,input.branch_id,start.toInstant().toString(),end.toInstant().toString(),(input.page-1)*50],c);return {items:rows.slice(0,50),hasMore:rows.length>50};});
 }
 @Post('blocks') async createBlock(@Body()body:unknown,@Req()req:AuthRequest){
  const a=await this.access.tenant(req,'appointments.edit'),input=parse(z.object({branch_id:uuid,kind:z.enum(['professional','room']),resource_id:uuid,start_local:wall,end_local:wall,reason:z.string().trim().min(1).max(500)}).strict(),body);
  return scope(a.organizationId!,async c=>{
   await lockAvailability(a.organizationId!,c);const [org]=await query('SELECT timezone FROM organizations WHERE id=$1 FOR SHARE',[a.organizationId],c);
   const start=localInstant(input.start_local,org.timezone),end=localInstant(input.end_local,org.timezone);
   if(Temporal.Instant.compare(start,end)>=0)throw new BadRequestException('El final debe ser posterior al inicio.');
   const column=input.kind==='professional'?'professional_id':'room_id';
   const [resource]=input.kind==='professional'?await query('SELECT p.id FROM professionals p JOIN professional_branches b ON b.professional_id=p.id AND b.organization_id=p.organization_id WHERE p.organization_id=$1 AND p.id=$2 AND b.branch_id=$3 AND p.active FOR SHARE OF p',[a.organizationId,input.resource_id,input.branch_id],c):await query('SELECT id FROM rooms WHERE organization_id=$1 AND id=$2 AND branch_id=$3 AND active FOR SHARE',[a.organizationId,input.resource_id,input.branch_id],c);
   const [branch]=await query('SELECT id FROM branches WHERE organization_id=$1 AND id=$2 AND active FOR SHARE',[a.organizationId,input.branch_id],c);
   if(!resource||!branch)throw new BadRequestException('Selecciona un recurso activo de esta sucursal.');
   const [conflict]=await query(`SELECT id FROM appointments WHERE organization_id=$1 AND ${column}=$2 AND starts_at<$4 AND occupied_until>$3 AND status NOT IN ('canceled','no_show') LIMIT 1`,[a.organizationId,input.resource_id,start,end],c);
   if(conflict)throw new ConflictException('Hay citas en ese periodo. Reprográmalas o cancélalas antes de bloquearlo.');
   const [duplicate]=await query(`SELECT id FROM availability_blocks WHERE organization_id=$1 AND ${column}=$2 AND active AND starts_at<$4 AND ends_at>$3 LIMIT 1`,[a.organizationId,input.resource_id,start,end],c);
   if(duplicate)throw new ConflictException('Ya existe un bloqueo que se cruza con ese periodo.');
   const [result]=await query(`INSERT INTO availability_blocks(organization_id,branch_id,${column},starts_at,ends_at,reason) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,version`,[a.organizationId,input.branch_id,input.resource_id,start,end,input.reason],c);
   await audit(req,'availability.block_created','availability_block',result.id,a.organizationId!,a.id,{after:input},c);return result;
  });
 }
 @Patch('blocks/:id/release') async release(@Param('id')id:string,@Body()body:unknown,@Req()req:AuthRequest){
  const a=await this.access.tenant(req,'appointments.edit');parse(uuid,id);const input=parse(z.object({version:z.number().int().positive(),reason:z.string().trim().min(1).max(500)}).strict(),body);
  return scope(a.organizationId!,async c=>{await lockAvailability(a.organizationId!,c);const [before]=await query('SELECT version,active FROM availability_blocks WHERE organization_id=$1 AND id=$2',[a.organizationId,id],c);if(!before)throw new NotFoundException('No encontramos el bloqueo.');if(before.version!==input.version||!before.active)throw new ConflictException('El bloqueo cambió. Actualiza la agenda.');await query('UPDATE availability_blocks SET active=false,version=version+1 WHERE organization_id=$1 AND id=$2',[a.organizationId,id],c);await audit(req,'availability.block_released','availability_block',id,a.organizationId!,a.id,{before,after:{active:false,version:input.version+1},reason:input.reason},c);return {ok:true};});
 }
}
