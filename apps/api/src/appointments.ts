import { Body,Controller,Get,Inject,Param,Patch,Post,Query,Req,BadRequestException,ConflictException,NotFoundException } from '@nestjs/common';
import { Temporal } from '@js-temporal/polyfill';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { Access,type AuthRequest,parse,uuid,digest,audit } from './core';
import { patientTransaction as scope } from './patients';
import { query } from '../../../packages/database/src/client';
import { lockAvailability,assertAvailability,withinSchedule } from './availability';
const localTime=z.string().regex(/^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}$/);
const booking=z.object({branch_id:uuid,patient_id:uuid,professional_id:uuid,room_id:uuid,service_id:uuid,start_local:localTime,duration_minutes:z.number().int().min(5).max(480),buffer_minutes:z.number().int().min(0).max(120).optional()}).strict();
const transitions:Record<string,string[]>={pending:['confirmed','arrived','canceled','no_show'],confirmed:['arrived','canceled','no_show'],arrived:['in_consultation','canceled'],in_consultation:['completed'],completed:[],canceled:[],no_show:[]};
export function appointmentInstant(local:string,timezone:string){
 try{return Temporal.PlainDateTime.from(local).toZonedDateTime(timezone,{disambiguation:'reject'}).toInstant();}
 catch{throw new BadRequestException('Fecha u hora inválida o ambigua en la zona horaria de la organización. Elige otra hora.');}
}
const columns='a.id,a.series_id,a.branch_id,a.patient_id,a.professional_id,a.room_id,a.service_id,a.starts_at,a.ends_at,a.buffer_minutes,a.occupied_until,a.timezone,a.status,a.version';
@Controller('api/appointments')
export class AppointmentsController {
 constructor(@Inject(Access)private access:Access){}
 @Post('suggestions') async suggestions(@Body()body:unknown,@Req()req:AuthRequest){
  const a=await this.access.tenant(req,'appointments.view'),input=parse(booking.extend({exclude_id:uuid.optional()}),body);
  return scope(a.organizationId!,async c=>{
   const [org]=await query('SELECT timezone FROM organizations WHERE id=$1',[a.organizationId],c);
   const start=appointmentInstant(input.start_local,org.timezone),date=Temporal.PlainDateTime.from(input.start_local).toPlainDate();
   const [valid]=await query(`SELECT p.id FROM professionals p JOIN professional_branches pb ON pb.organization_id=p.organization_id AND pb.professional_id=p.id JOIN branches b ON b.organization_id=pb.organization_id AND b.id=pb.branch_id JOIN rooms r ON r.organization_id=p.organization_id AND r.id=$4 AND r.branch_id=b.id JOIN services s ON s.organization_id=p.organization_id AND s.id=$5 JOIN patients pt ON pt.organization_id=p.organization_id AND pt.id=$6 WHERE p.organization_id=$1 AND p.id=$2 AND b.id=$3 AND p.active AND b.active AND r.active AND s.active AND pt.active AND (NOT p.restrict_services OR EXISTS(SELECT 1 FROM professional_services ps WHERE ps.organization_id=p.organization_id AND ps.professional_id=p.id AND ps.service_id=s.id)) AND (NOT p.restrict_rooms OR EXISTS(SELECT 1 FROM professional_rooms pr WHERE pr.organization_id=p.organization_id AND pr.professional_id=p.id AND pr.room_id=r.id))`,[a.organizationId,input.professional_id,input.branch_id,input.room_id,input.service_id,input.patient_id],c);
   if(!valid)throw new BadRequestException('Selecciona un paciente y recursos activos compatibles de esta sucursal.');
   if(input.exclude_id&&!(await query("SELECT id FROM appointments WHERE organization_id=$1 AND id=$2 AND patient_id=$3 AND status IN ('pending','confirmed')",[a.organizationId,input.exclude_id,input.patient_id],c)).length)throw new BadRequestException('La cita a reprogramar no está disponible.');
   const until=date.add({days:1}).toZonedDateTime(org.timezone).toInstant().add({hours:10}).toString();
   const reservations=await query("SELECT patient_id,professional_id,room_id,starts_at,ends_at,occupied_until FROM appointments WHERE organization_id=$1 AND status NOT IN ('canceled','no_show') AND ($7::uuid IS NULL OR id<>$7) AND (patient_id=$2 OR professional_id=$3 OR room_id=$4) AND starts_at<$6 AND occupied_until>$5",[a.organizationId,input.patient_id,input.professional_id,input.room_id,start.toString(),until,input.exclude_id||null],c);
   const blocks=await query('SELECT starts_at,ends_at FROM availability_blocks WHERE organization_id=$1 AND active AND (professional_id=$2 OR room_id=$3) AND starts_at<$5 AND ends_at>$4',[a.organizationId,input.professional_id,input.room_id,start.toString(),until],c);
   const [schedule]=await query('SELECT weekly FROM professional_schedules WHERE organization_id=$1 AND professional_id=$2 AND branch_id=$3',[a.organizationId,input.professional_id,input.branch_id],c);
   const [roomSchedule]=await query('SELECT weekly FROM room_schedules WHERE organization_id=$1 AND room_id=$2',[a.organizationId,input.room_id],c);
   const items:{start_local:string}[]=[],now=Temporal.Now.instant();
   for(let local=Temporal.PlainDateTime.from(input.start_local);local.toPlainDate().equals(date);local=local.add({minutes:15})){
    let candidate;try{candidate=appointmentInstant(local.toString().slice(0,16),org.timezone);}catch{continue;}
    if(Temporal.Instant.compare(candidate,now)<0)continue;
    const end=candidate.add({minutes:input.duration_minutes}),occupied=end.add({minutes:input.buffer_minutes||0});
    if(schedule&&!withinSchedule(schedule.weekly,candidate.toString(),occupied.toString(),org.timezone))continue;
    if(roomSchedule&&!withinSchedule(roomSchedule.weekly,candidate.toString(),occupied.toString(),org.timezone))continue;
    const from=Number(candidate.epochMilliseconds),to=Number(end.epochMilliseconds),resourceEnd=Number(occupied.epochMilliseconds);
    if(blocks.some(b=>+new Date(b.starts_at)<resourceEnd&&+new Date(b.ends_at)>from))continue;
    if(reservations.some(r=>(r.patient_id===input.patient_id&&+new Date(r.starts_at)<to&&+new Date(r.ends_at)>from)||((r.professional_id===input.professional_id||r.room_id===input.room_id)&&+new Date(r.starts_at)<resourceEnd&&+new Date(r.occupied_until)>from)))continue;
    items.push({start_local:local.toString().slice(0,16)});if(items.length===12)break;
   }
   return {items,timezone:org.timezone,schedule_configured:!!schedule};
  });
 }
 @Get('events') async events(@Query()raw:unknown,@Req()req:AuthRequest){
  const a=await this.access.tenant(req,'appointments.view');
  const input=parse(z.object({date:z.iso.date(),days:z.coerce.number().int().min(1).max(42),branch_id:uuid,professional_id:uuid.optional(),room_id:uuid.optional()}).strict(),raw);
  return scope(a.organizationId!,async c=>{
   const [org]=await query('SELECT timezone FROM organizations WHERE id=$1',[a.organizationId],c);
   const start=Temporal.PlainDate.from(input.date).toZonedDateTime(org.timezone),end=start.add({days:input.days});
   const rows=await query(`SELECT ${columns},p.first_name||' '||p.last_name AS patient_name,p.record_number,pr.name AS professional_name,r.name AS room_name,s.name AS service_name FROM appointments a JOIN patients p ON p.id=a.patient_id JOIN professionals pr ON pr.id=a.professional_id JOIN rooms r ON r.id=a.room_id JOIN services s ON s.id=a.service_id WHERE a.organization_id=$1 AND a.branch_id=$2 AND a.starts_at<$4 AND a.occupied_until>$3 AND ($5::uuid IS NULL OR a.professional_id=$5) AND ($6::uuid IS NULL OR a.room_id=$6) ORDER BY a.starts_at,a.id LIMIT 1001`,[a.organizationId,input.branch_id,start.toInstant().toString(),end.toInstant().toString(),input.professional_id||null,input.room_id||null],c);
   const blocks=await query("SELECT b.id,b.professional_id,b.room_id,b.starts_at,b.ends_at,b.reason,b.version,coalesce(p.name,r.name) AS resource_name FROM availability_blocks b LEFT JOIN professionals p ON p.organization_id=b.organization_id AND p.id=b.professional_id LEFT JOIN rooms r ON r.organization_id=b.organization_id AND r.id=b.room_id WHERE b.organization_id=$1 AND b.active AND b.starts_at<$4 AND b.ends_at>$3 AND (b.branch_id=$2 OR EXISTS(SELECT 1 FROM professional_branches pb WHERE pb.organization_id=b.organization_id AND pb.professional_id=b.professional_id AND pb.branch_id=$2)) ORDER BY b.starts_at,b.id LIMIT 1001",[a.organizationId,input.branch_id,start.toInstant().toString(),end.toInstant().toString()],c);
   // Do not display an incomplete calendar as if the rest of the slots were free.
   return {items:rows.length>1000||blocks.length>1000?[]:rows,blocks:rows.length>1000||blocks.length>1000?[]:blocks,tooMany:rows.length>1000||blocks.length>1000,timezone:org.timezone};
  });
 }
 @Get('calendar') async calendar(@Query()raw:unknown,@Req()req:AuthRequest){
  const a=await this.access.tenant(req,'appointments.view');
  const input=parse(z.object({date:z.iso.date(),days:z.coerce.number().int().min(1).max(42),branch_id:uuid,professional_id:uuid.optional(),room_id:uuid.optional()}).strict(),raw);
  return scope(a.organizationId!,async c=>{
   const [org]=await query('SELECT timezone FROM organizations WHERE id=$1',[a.organizationId],c);
   // Aggregate each local day in SQL: previews are bounded, counts include every match.
   const rows=await query(`WITH days AS (
    SELECT ($2::date+n)::text AS date, (($2::date+n)::timestamp AT TIME ZONE $4) AS starts, (($2::date+n+1)::timestamp AT TIME ZONE $4) AS ends FROM generate_series(0,$3::int-1) n
   ) SELECT d.date,coalesce(x.total,0)::int AS total,coalesce(x.previews,'[]'::jsonb) AS previews FROM days d
   LEFT JOIN LATERAL (
    SELECT count(*) AS total,jsonb_agg(jsonb_build_object('id',id,'name',name,'starts_at',starts_at,'status',status) ORDER BY starts_at,id) FILTER(WHERE position<=3) AS previews FROM (
     SELECT a.id,p.first_name||' '||p.last_name AS name,a.starts_at,a.status,row_number() OVER(ORDER BY a.starts_at,a.id) AS position
     FROM appointments a JOIN patients p ON p.id=a.patient_id
     WHERE a.organization_id=$1 AND a.branch_id=$5 AND a.starts_at<d.ends AND a.ends_at>d.starts AND ($6::uuid IS NULL OR a.professional_id=$6) AND ($7::uuid IS NULL OR a.room_id=$7)
    ) matches
   ) x ON true ORDER BY d.date`,[a.organizationId,input.date,input.days,org.timezone,input.branch_id,input.professional_id||null,input.room_id||null],c);
   return {days:rows,timezone:org.timezone};
  });
 }
 @Get() async list(@Query()raw:unknown,@Req()req:AuthRequest){
  const actor=await this.access.tenant(req,'appointments.view');
  const input=parse(z.object({date:z.iso.date(),branch_id:uuid,professional_id:uuid.optional(),room_id:uuid.optional(),page:z.coerce.number().int().min(1).max(10000).default(1)}).strict(),raw);
  return scope(actor.organizationId!,async c=>{
   const [org]=await query('SELECT timezone FROM organizations WHERE id=$1',[actor.organizationId],c);
   const start=Temporal.PlainDate.from(input.date).toZonedDateTime(org.timezone),end=start.add({days:1});
   const args:unknown[]=[actor.organizationId,input.branch_id,start.toInstant().toString(),end.toInstant().toString()];
   const where=['a.organization_id=$1','a.branch_id=$2','a.ends_at>$3','a.starts_at<$4'];
   for(const key of ['professional_id','room_id'] as const)if(input[key]){args.push(input[key]);where.push(`a.${key}=$${args.length}`);}
   args.push((input.page-1)*100);
   const rows=await query(`SELECT ${columns},p.first_name||' '||p.last_name AS patient_name,p.record_number,pr.name AS professional_name,r.name AS room_name,s.name AS service_name FROM appointments a JOIN patients p ON p.id=a.patient_id JOIN professionals pr ON pr.id=a.professional_id JOIN rooms r ON r.id=a.room_id JOIN services s ON s.id=a.service_id WHERE ${where.join(' AND ')} ORDER BY a.starts_at,a.id LIMIT 101 OFFSET $${args.length}`,args,c);
   return {items:rows.slice(0,100),hasMore:rows.length>100,timezone:org.timezone};
  });
 }
 @Get('options') async options(@Query()raw:unknown,@Req()req:AuthRequest){
  const a=await this.access.tenant(req,'appointments.view');const input=parse(z.object({branch_id:uuid,professional_id:uuid.optional(),q:z.string().trim().max(100).default('')}).strict(),raw);
  return scope(a.organizationId!,async c=>{
   const search=`%${input.q.replace(/[\\%_]/g,'\\$&')}%`;
   // Bounded, searchable choices avoid silently dropping resources beyond the first catalog page.
   const professionals=await query('SELECT p.id,p.name FROM professionals p JOIN professional_branches b ON b.professional_id=p.id AND b.organization_id=p.organization_id WHERE p.organization_id=$1 AND b.branch_id=$2 AND p.active AND p.name ILIKE $3 ORDER BY p.name,p.id LIMIT 51',[a.organizationId,input.branch_id,search],c);
   const rooms=await query('SELECT r.id,r.name FROM rooms r WHERE r.organization_id=$1 AND r.branch_id=$2 AND r.active AND r.name ILIKE $3 AND ($4::uuid IS NULL OR EXISTS(SELECT 1 FROM professionals p JOIN professional_branches pb ON pb.organization_id=p.organization_id AND pb.professional_id=p.id WHERE p.organization_id=r.organization_id AND p.id=$4 AND p.active AND pb.branch_id=r.branch_id AND (NOT p.restrict_rooms OR EXISTS(SELECT 1 FROM professional_rooms pr WHERE pr.organization_id=p.organization_id AND pr.professional_id=p.id AND pr.room_id=r.id)))) ORDER BY r.name,r.id LIMIT 51',[a.organizationId,input.branch_id,search,input.professional_id||null],c);
   const services=await query('SELECT s.id,s.name,s.duration_minutes FROM services s WHERE s.organization_id=$1 AND s.active AND s.name ILIKE $2 AND ($3::uuid IS NULL OR EXISTS(SELECT 1 FROM professionals p JOIN professional_branches pb ON pb.organization_id=p.organization_id AND pb.professional_id=p.id WHERE p.organization_id=s.organization_id AND p.id=$3 AND p.active AND pb.branch_id=$4 AND (NOT p.restrict_services OR EXISTS(SELECT 1 FROM professional_services ps WHERE ps.organization_id=p.organization_id AND ps.professional_id=p.id AND ps.service_id=s.id)))) ORDER BY s.name,s.id LIMIT 51',[a.organizationId,search,input.professional_id||null,input.branch_id],c);
   return {professionals:professionals.slice(0,50),rooms:rooms.slice(0,50),services:services.slice(0,50),hasMore:[professionals,rooms,services].some(x=>x.length>50)};
  });
 }
 @Get(':id/history') async history(@Param('id')id:string,@Req()req:AuthRequest){
  const a=await this.access.tenant(req,'appointments.view');parse(uuid,id);
  return scope(a.organizationId!,async c=>{
   if(!(await query('SELECT id FROM appointments WHERE organization_id=$1 AND id=$2',[a.organizationId,id],c)).length)throw new NotFoundException('No encontramos la cita.');
   return query('SELECT version,action,reason,snapshot,created_at FROM appointment_history WHERE organization_id=$1 AND appointment_id=$2 ORDER BY version DESC LIMIT 100',[a.organizationId,id],c);
  });
 }
 @Post() async create(@Body()body:unknown,@Req()req:AuthRequest){return this.save(null,body,req);}
 @Post('series') async series(@Body()body:unknown,@Req()req:AuthRequest){
  const a=await this.access.tenant(req,'appointments.create');
  const input=parse(booking.extend({request_id:uuid,count:z.number().int().min(2).max(24),interval_weeks:z.union([z.literal(1),z.literal(2)])}),body);
  const hash=digest(JSON.stringify(input));
  return scope(a.organizationId!,async c=>{
   await lockAvailability(a.organizationId!,c);
   const [prior]=await query('SELECT id,request_hash,appointment_ids FROM appointment_series WHERE organization_id=$1 AND request_id=$2',[a.organizationId,input.request_id],c);
   if(prior){if(prior.request_hash!==hash)throw new ConflictException('La solicitud de serie ya se utilizó con otros datos.');return {id:prior.id,appointment_ids:prior.appointment_ids};}
   const {count,interval_weeks,request_id,...fields}=input;void request_id;
   const ids:string[]=[];
   for(let index=0;index<count;index++){
    let local:string;try{local=Temporal.PlainDateTime.from(input.start_local).add({weeks:index*interval_weeks}).toString().slice(0,16);}catch{throw new BadRequestException('La fecha inicial no es válida.');}
    try{const result=await this.save(null,{...fields,start_local:local,request_id:randomUUID()},req,c);ids.push(result.id);}
    catch(error){if(error instanceof BadRequestException||error instanceof ConflictException)throw new ConflictException(`No se creó la serie. Cita ${index+1} (${local.replace('T',' ')}): ${error.message}`);throw error;}
   }
   const [series]=await query('INSERT INTO appointment_series(organization_id,request_id,request_hash,appointment_ids) VALUES($1,$2,$3,$4) RETURNING id',[a.organizationId,input.request_id,hash,ids],c);
   await query('UPDATE appointments SET series_id=$3 WHERE organization_id=$1 AND id=ANY($2::uuid[])',[a.organizationId,ids,series.id],c);
   await audit(req,'appointments.series_created','appointment_series',series.id,a.organizationId!,a.id,{after:{count,interval_weeks,appointment_ids:ids}},c);
   return {id:series.id,appointment_ids:ids};
  });
 }
 @Patch(':id') async reschedule(@Param('id')id:string,@Body()body:unknown,@Req()req:AuthRequest){parse(uuid,id);return this.save(id,body,req);}
 private async save(id:string|null,body:unknown,req:AuthRequest,connection?:PoolClient){
  const a=await this.access.tenant(req,id?'appointments.edit':'appointments.create');
  const input=id?parse(booking.extend({version:z.number().int().positive(),reason:z.string().trim().min(1).max(500)}),body):parse(booking.extend({request_id:uuid}),body);
  const hash=digest(JSON.stringify(input));
  const run=<T>(work:(c:PoolClient)=>Promise<T>)=>connection?work(connection):scope(a.organizationId!,work);
  try{return await run(async c=>{
   await lockAvailability(a.organizationId!,c);
   if('request_id' in input){
    await query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`${a.organizationId}:${input.request_id}`],c);
    const [prior]=await query('SELECT id,version,request_hash FROM appointments WHERE organization_id=$1 AND request_id=$2',[a.organizationId,input.request_id],c);
    if(prior){if(prior.request_hash!==hash)throw new ConflictException('La solicitud ya se utilizó con otros datos.');return {id:prior.id,version:prior.version};}
   }
   const [org]=await query('SELECT timezone FROM organizations WHERE id=$1 FOR SHARE',[a.organizationId],c);
   const start=appointmentInstant(input.start_local,org.timezone),end=start.add({minutes:input.duration_minutes});
   let before;
   if(id){
    [before]=await query(`SELECT ${columns} FROM appointments a WHERE a.organization_id=$1 AND a.id=$2 FOR UPDATE`,[a.organizationId,id],c);
    if(!before)throw new NotFoundException('No encontramos la cita.');
    if(before.version!==('version' in input?input.version:0))throw new ConflictException('La cita cambió. Cierra el formulario y vuelve a abrirla.');
    if(!['pending','confirmed'].includes(before.status))throw new ConflictException('Solo puedes reprogramar citas pendientes o confirmadas.');
    if(before.patient_id!==input.patient_id)throw new BadRequestException('No puedes sustituir al paciente de una cita.');
   }
   const [branch]=await query('SELECT id FROM branches WHERE organization_id=$1 AND id=$2 AND active FOR SHARE',[a.organizationId,input.branch_id],c);
   const [patient]=await query('SELECT id FROM patients WHERE organization_id=$1 AND id=$2 AND active FOR SHARE',[a.organizationId,input.patient_id],c);
   const [professional]=await query('SELECT p.id,p.restrict_services,p.restrict_rooms FROM professionals p JOIN professional_branches b ON b.organization_id=p.organization_id AND b.professional_id=p.id WHERE p.organization_id=$1 AND p.id=$2 AND p.active AND b.branch_id=$3 FOR SHARE OF p',[a.organizationId,input.professional_id,input.branch_id],c);
   const [room]=await query('SELECT id FROM rooms WHERE organization_id=$1 AND id=$2 AND branch_id=$3 AND active FOR SHARE',[a.organizationId,input.room_id,input.branch_id],c);
   const [service]=await query('SELECT id FROM services WHERE organization_id=$1 AND id=$2 AND active FOR SHARE',[a.organizationId,input.service_id],c);
   if(!branch||!patient||!professional||!room||!service)throw new BadRequestException('Selecciona un paciente y recursos activos de esta organización y sucursal.');
   const buffer=input.buffer_minutes??before?.buffer_minutes??0;
   const occupied=end.add({minutes:buffer});
   await assertAvailability(a.organizationId!,input.branch_id,input.professional_id,input.room_id,start.toString(),occupied.toString(),org.timezone,c);
   if(professional.restrict_services&&!(await query('SELECT service_id FROM professional_services WHERE organization_id=$1 AND professional_id=$2 AND service_id=$3',[a.organizationId,input.professional_id,input.service_id],c)).length)throw new BadRequestException('Este profesional no tiene habilitado el servicio seleccionado.');
   if(professional.restrict_rooms&&!(await query('SELECT room_id FROM professional_rooms WHERE organization_id=$1 AND professional_id=$2 AND room_id=$3',[a.organizationId,input.professional_id,input.room_id],c)).length)throw new BadRequestException('Este profesional no tiene habilitado el consultorio seleccionado.');
   const values=[a.organizationId,input.branch_id,input.patient_id,input.professional_id,input.room_id,input.service_id,start.toString(),end.toString(),org.timezone];
   let result;
   if(id)[result]=await query("UPDATE appointments SET branch_id=$2,patient_id=$3,professional_id=$4,room_id=$5,service_id=$6,starts_at=$7,ends_at=$8,timezone=$9,buffer_minutes=$11,status='pending',version=version+1,updated_at=now() WHERE organization_id=$1 AND id=$10 RETURNING *",[...values,id,buffer],c);
   else [result]=await query('INSERT INTO appointments(organization_id,branch_id,patient_id,professional_id,room_id,service_id,starts_at,ends_at,timezone,request_id,request_hash,buffer_minutes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *',[...values,'request_id' in input?input.request_id:null,hash,buffer],c);
   const action=id?'rescheduled':'created',reason='reason' in input?input.reason:'';
   const snapshot={branch_id:result.branch_id,patient_id:result.patient_id,professional_id:result.professional_id,room_id:result.room_id,service_id:result.service_id,starts_at:result.starts_at,ends_at:result.ends_at,buffer_minutes:result.buffer_minutes,occupied_until:result.occupied_until,timezone:result.timezone,status:result.status};
   await query('INSERT INTO appointment_history(organization_id,appointment_id,user_id,version,action,reason,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7)',[a.organizationId,result.id,a.id,result.version,action,reason,JSON.stringify(snapshot)],c);
   await audit(req,`appointments.${action}`,'appointments',result.id,a.organizationId!,a.id,{before:before?{version:before.version}:undefined,after:{version:result.version},reason},c);
   return {id:result.id,version:result.version};
  });}catch(error){if((error as {code?:string}).code==='23P01')throw new ConflictException('Ese horario se cruza con otra cita del paciente, profesional o consultorio. Selecciona otro horario o recurso.');throw error;}
 }
 @Patch(':id/status') async status(@Param('id')id:string,@Body()body:unknown,@Req()req:AuthRequest){
  const a=await this.access.tenant(req,'appointments.edit');parse(uuid,id);
  const input=parse(z.object({version:z.number().int().positive(),status:z.enum(['confirmed','arrived','in_consultation','completed','canceled','no_show']),reason:z.string().trim().max(500).default('')}).strict(),body);
  if(['canceled','no_show'].includes(input.status)&&!input.reason)throw new BadRequestException('Indica el motivo del cambio de estado.');
  return scope(a.organizationId!,async c=>{
   const [before]=await query(`SELECT ${columns} FROM appointments a WHERE a.organization_id=$1 AND a.id=$2 FOR UPDATE`,[a.organizationId,id],c);
   if(!before)throw new NotFoundException('No encontramos la cita.');
   if(before.version!==input.version)throw new ConflictException('La cita cambió. Cierra el formulario y vuelve a abrirla.');
   if(!transitions[before.status].includes(input.status))throw new ConflictException('Este cambio de estado no está permitido.');
   const [result]=await query('UPDATE appointments SET status=$3,version=version+1,updated_at=now() WHERE organization_id=$1 AND id=$2 RETURNING version',[a.organizationId,id,input.status],c);
   await query('INSERT INTO appointment_history(organization_id,appointment_id,user_id,version,action,reason,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7)',[a.organizationId,id,a.id,result.version,'status_changed',input.reason,JSON.stringify({...before,status:input.status,version:result.version})],c);
   await audit(req,'appointments.status_changed','appointments',id,a.organizationId!,a.id,{before:{status:before.status,version:before.version},after:{status:input.status,version:result.version},reason:input.reason},c);
   return {id,version:result.version};
  });
 }
}
