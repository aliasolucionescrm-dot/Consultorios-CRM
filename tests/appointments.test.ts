import 'dotenv/config';
import { beforeAll,afterAll,it,expect } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { createApp } from '../apps/api/src/app';
import { appointmentInstant } from '../apps/api/src/appointments';
import { hashPassword } from '../apps/api/src/auth';
import { query,pool } from '../packages/database/src/client';
import {patientTransaction} from '../apps/api/src/patients';
import {Temporal} from '@js-temporal/polyfill';
let app:INestApplication,cookie:string,csrf:string,org:string,other:string,branch:string,otherBranch:string,id:string;
let patients:string[],professionals:string[],rooms:string[],service:string;
const origin=process.env.APP_ORIGIN!,password='Appointment-test-only-2026!';
function call(method:'get'|'post'|'patch',path:string,tenant=org){return request(app.getHttpServer())[method](`/api/${path}`).set('Origin',origin).set('Cookie',cookie).set('X-CSRF-Token',csrf||'').set('X-Organization-Id',tenant||'');}
const booking=(start='2030-01-15T09:00')=>({branch_id:branch,patient_id:patients[0],professional_id:professionals[0],room_id:rooms[0],service_id:service,start_local:start,duration_minutes:30});
beforeAll(async()=>{
 if(!/^alia_test_[a-f0-9]{12}$/.test(process.env.TEST_DATABASE_NAME||''))throw new Error('Run npm test');
 app=await createApp();await app.init();const email=`appointments-${randomUUID()}@alia.example`;
 await query('INSERT INTO users(email,name,password_hash) VALUES($1,$2,$3)',[email,'Agenda owner',await hashPassword(password)]);
 const login=await request(app.getHttpServer()).post('/api/auth/login').set('Origin',origin).send({email,password});cookie=login.headers['set-cookie'][0].split(';')[0];csrf=(await call('get','auth/me')).body.csrf;
 org=(await call('post','organizations').send({name:'Agenda test',branch:'Central'})).body.id;other=(await call('post','organizations').send({name:'Other agenda',branch:'Other'})).body.id;
 branch=(await call('get','organization')).body.branches[0].id;otherBranch=(await call('get','organization',other)).body.branches[0].id;
 patients=[];professionals=[];rooms=[];
 for(let i=0;i<2;i++){
  patients.push((await call('post','patients').send({request_id:randomUUID(),first_name:`Paciente ${i}`,last_name:'Ficticio'})).body.id);
  professionals.push((await call('post','catalogs/professionals').send({name:`Doctor ${i}`,branch_ids:[branch]})).body.id);
  rooms.push((await call('post','catalogs/rooms').send({name:`Consultorio ${i}`,branch_id:branch})).body.id);
 }
 service=(await call('post','catalogs/services').send({name:'Valoración',code:'VAL',category:'Diagnóstico',duration_minutes:30,price_minor:50000,currency:'MXN'})).body.id;
});
afterAll(async()=>{await app?.close();await pool.end();});
it('creates an appointment once under concurrent retries and uses the organization timezone',async()=>{
 const input={...booking(),request_id:randomUUID()};const results=await Promise.all([call('post','appointments').send(input),call('post','appointments').send(input)]);
 expect(results.map(r=>r.status)).toEqual([201,201]);expect(results[0].body.id).toBe(results[1].body.id);id=results[0].body.id;
 const list=await call('get',`appointments?date=2030-01-15&branch_id=${branch}`);expect(list.body.items).toHaveLength(1);expect(list.body.items[0].starts_at).toBe('2030-01-15T15:00:00.000Z');
 expect((await call('post','appointments').send({...input,duration_minutes:45})).status).toBe(409);
});
it('rejects each independently conflicting resource',async()=>{
 for(const match of ['patient_id','professional_id','room_id']){
  const input={...booking('2030-01-15T09:15'),patient_id:patients[1],professional_id:professionals[1],room_id:rooms[1],request_id:randomUUID(),[match]:booking()[match as keyof ReturnType<typeof booking>]};
  expect((await call('post','appointments').send(input)).status,match).toBe(409);
 }
});
it('allows adjacent bookings but only one competing request for an empty slot',async()=>{
 expect((await call('post','appointments').send({...booking('2030-01-15T09:30'),request_id:randomUUID()})).status).toBe(201);
 const results=await Promise.all([0,1].map(()=>call('post','appointments').send({...booking('2030-01-15T10:00'),request_id:randomUUID()})));
 expect(results.map(r=>r.status).sort()).toEqual([201,409]);
});
it('isolates tenants and enforces room/professional branch assignment',async()=>{
 expect((await call('post','appointments',other).send({...booking(),branch_id:otherBranch,request_id:randomUUID()})).status).toBe(400);
 expect((await call('get',`appointments?date=2030-01-15&branch_id=${branch}`,other)).body.items).toHaveLength(0);
 expect((await call('get',`appointments/${id}/history`,other)).status).toBe(404);
 expect((await call('patch',`appointments/${id}`,other).send({...booking(),version:1,reason:'Mover'})).status).toBe(404);
 const localBranch=(await call('post','branches').send({name:'Segunda',address:'',phone:'',active:true})).body.id;
 expect((await call('post','appointments').send({...booking(),branch_id:localBranch,request_id:randomUUID()})).status).toBe(400);
});
it('reschedules atomically, preserves the prior slot on failure and detects stale versions',async()=>{
 expect((await call('patch',`appointments/${id}`).send({...booking('2030-01-15T09:45'),version:1,reason:'Cruce'})).status).toBe(409);
 expect((await call('patch',`appointments/${id}`).send({...booking('2030-01-15T11:00'),version:1,reason:'Petición del paciente'})).status).toBe(200);
 expect((await call('patch',`appointments/${id}`).send({...booking('2030-01-15T12:00'),version:1,reason:'Versión anterior'})).status).toBe(409);
 const history=await call('get',`appointments/${id}/history`);expect(history.body.map((h:{version:number})=>h.version)).toEqual([2,1]);
 expect(history.body[1].snapshot.starts_at).toBe('2030-01-15T15:00:00.000Z');
});
it('requires cancellation reasons, releases canceled slots, and prevents terminal-state reopening',async()=>{
 expect((await call('patch',`appointments/${id}/status`).send({status:'canceled',version:2})).status).toBe(400);
 expect((await call('patch',`appointments/${id}/status`).send({status:'canceled',version:2,reason:'Paciente canceló'})).status).toBe(200);
 expect((await call('post','appointments').send({...booking('2030-01-15T11:00'),request_id:randomUUID()})).status).toBe(201);
 expect((await call('patch',`appointments/${id}/status`).send({status:'confirmed',version:3})).status).toBe(409);
});
it('follows the attendance workflow and prevents moving an arrived appointment',async()=>{
 const result=await call('post','appointments').send({...booking('2030-01-15T14:00'),request_id:randomUUID()});const appointment=result.body.id;
 expect((await call('patch',`appointments/${appointment}/status`).send({status:'completed',version:1})).status).toBe(409);
 for(const [i,status] of ['confirmed','arrived','in_consultation','completed'].entries())expect((await call('patch',`appointments/${appointment}/status`).send({status,version:i+1})).status).toBe(200);
 expect((await call('patch',`appointments/${appointment}`).send({...booking('2030-01-15T15:00'),version:5,reason:'Mover completada'})).status).toBe(409);
});
it('validates dates, lengths and strict bodies; rejects DST gaps and repeated wall times',async()=>{
 for(const fields of [{duration_minutes:0},{duration_minutes:481},{start_local:'2030-02-30T10:00'},{organization_id:other}])expect((await call('post','appointments').send({...booking(),...fields,request_id:randomUUID()})).status).toBe(400);
 expect(()=>appointmentInstant('2026-03-08T02:30','America/New_York')).toThrow();expect(()=>appointmentInstant('2026-11-01T01:30','America/New_York')).toThrow();
});
it('forces RLS and prevents deleting reservations and modifying history',async()=>{
 expect(await query('SELECT id FROM appointments')).toHaveLength(0);expect(await query('SELECT id FROM appointment_history')).toHaveLength(0);
 await expect(query('DELETE FROM appointments WHERE false')).rejects.toMatchObject({code:'42501'});await expect(query('UPDATE appointment_history SET reason=reason WHERE false')).rejects.toMatchObject({code:'42501'});
});
it('summarizes calendar ranges with complete counts, bounded previews and tenant filters',async()=>{
 const day=await call('get',`appointments?date=2030-01-15&branch_id=${branch}`);
 const calendar=await call('get',`appointments/calendar?date=2030-01-14&days=7&branch_id=${branch}`);
 expect(calendar.status).toBe(200);expect(calendar.body.days).toHaveLength(7);
 const target=calendar.body.days.find((d:{date:string})=>d.date==='2030-01-15');expect(target.total).toBe(day.body.items.length);expect(target.previews).toHaveLength(3);
 const filtered=await call('get',`appointments/calendar?date=2030-01-15&days=1&branch_id=${branch}&professional_id=${professionals[1]}`);expect(filtered.body.days[0].total).toBe(0);
 const foreign=await call('get',`appointments/calendar?date=2030-01-15&days=1&branch_id=${branch}`,other);expect(foreign.body.days[0].total).toBe(0);
 expect((await call('get',`appointments/calendar?date=2030-01-15&days=43&branch_id=${branch}`)).status).toBe(400);
});
it('searches operational entities without leaking other tenants or cost fields',async()=>{
 const result=await call('get','search?q=valoracion');expect(result.status).toBe(200);
 expect(result.body.groups.find((g:{kind:string})=>g.kind==='services').items[0].id).toBe(service);
 expect(result.body.groups.find((g:{kind:string})=>g.kind==='appointments').items.length).toBeGreaterThan(0);
 expect(JSON.stringify(result.body)).not.toContain('cost_minor');
 const foreign=await call('get','search?q=valoracion',other);expect(foreign.body.groups.every((g:{items:unknown[]})=>g.items.length===0)).toBe(true);
 const wildcard=await call('get','search?q=%25_');expect(wildcard.body.groups.every((g:{items:unknown[]})=>g.items.length===0)).toBe(true);
 expect((await call('get','search?q=a')).status).toBe(400);
});
it('returns complete timed events with duration, versions and tenant filters',async()=>{
 const events=await call('get',`appointments/events?date=2030-01-15&days=7&branch_id=${branch}`);expect(events.status).toBe(200);expect(events.body.tooMany).toBe(false);expect(events.body.items.length).toBeGreaterThan(3);
 const found=events.body.items.find((e:{id:string})=>e.id===id);expect(found.starts_at).toBe('2030-01-15T17:00:00.000Z');expect(found.ends_at).toBe('2030-01-15T17:30:00.000Z');expect(found.version).toBe(3);
 expect((await call('get',`appointments/events?date=2030-01-15&days=7&branch_id=${branch}`,other)).body.items).toEqual([]);
 expect((await call('get',`appointments/events?date=2030-01-15&days=7&branch_id=${branch}&room_id=${rooms[1]}`)).body.items).toEqual([]);
 expect((await call('get',`appointments/events?date=2030-01-15&days=43&branch_id=${branch}`)).status).toBe(400);
});
it('configures weekly turns and enforces breaks and closed days',async()=>{
 const weekly=[{day:2,start:'09:00',end:'15:00'},{day:2,start:'16:00',end:'18:00'}];
 expect((await call('post','availability/schedule').send({professional_id:professionals[0],branch_id:branch,version:0,weekly,reason:'Horario inicial'})).status).toBe(201);
 expect((await call('post','appointments').send({...booking('2030-01-15T15:15'),request_id:randomUUID()})).status).toBe(409);
 expect((await call('post','appointments').send({...booking('2030-01-16T09:00'),request_id:randomUUID()})).status).toBe(409);
 expect((await call('post','appointments').send({...booking('2030-01-15T17:30'),request_id:randomUUID()})).status).toBe(201);
 expect((await call('post','availability/schedule').send({professional_id:professionals[0],branch_id:branch,version:0,weekly,reason:'Obsoleto'})).status).toBe(409);
 expect((await call('post','availability/schedule').send({professional_id:professionals[0],branch_id:branch,version:1,weekly:[],reason:'Cierre'})).status).toBe(409);
 expect((await call('post','availability/schedule').send({professional_id:professionals[0],branch_id:branch,version:1,weekly:[...weekly,weekly[0]],reason:'Duplicado'})).status).toBe(400);
});
it('blocks resources, rejects collisions, releases with version and checks tenant scope',async()=>{
 const input={branch_id:branch,kind:'professional',resource_id:professionals[0],start_local:'2030-01-15T16:00',end_local:'2030-01-15T17:00',reason:'Descanso'};
 const block=await call('post','availability/blocks').send(input);expect(block.status).toBe(201);
 const calendar=await call('get','appointments/events?date=2030-01-15&days=7&branch_id='+branch);expect(calendar.body.blocks.some((b:{id:string;reason:string})=>b.id===block.body.id&&b.reason==='Descanso')).toBe(true);
 expect((await call('get','appointments/events?date=2030-01-15&days=7&branch_id='+branch,other)).body.blocks).toEqual([]);
 expect((await call('get','appointments/events?date=2030-01-16&days=1&branch_id='+branch)).body.blocks.some((b:{id:string})=>b.id===block.body.id)).toBe(false);

 expect((await call('post','appointments').send({...booking('2030-01-15T16:30'),request_id:randomUUID()})).status).toBe(409);
 expect((await call('post','availability/blocks').send(input)).status).toBe(409);
 expect((await call('post','availability/blocks').send({...input,start_local:'2030-01-15T17:30',end_local:'2030-01-15T18:00'})).status).toBe(409);
 expect((await call('get',`availability/blocks?date=2030-01-15&branch_id=${branch}`)).body.items).toHaveLength(1);
 expect((await call('get',`availability/blocks?date=2030-01-15&branch_id=${branch}`,other)).body.items).toHaveLength(0);
 expect((await call('patch',`availability/blocks/${block.body.id}/release`,other).send({version:1,reason:'No'})).status).toBe(404);
 expect((await call('patch',`availability/blocks/${block.body.id}/release`).send({version:1,reason:'Fin de descanso'})).status).toBe(200);
 expect((await call('get','appointments/events?date=2030-01-15&days=7&branch_id='+branch)).body.blocks.some((b:{id:string})=>b.id===block.body.id)).toBe(false);
 expect((await call('patch',`availability/blocks/${block.body.id}/release`).send({version:1,reason:'Obsoleto'})).status).toBe(409);
 expect((await call('post','appointments').send({...booking('2030-01-15T16:30'),request_id:randomUUID()})).status).toBe(201);
 expect(await query('SELECT * FROM professional_schedules')).toHaveLength(0);expect(await query('SELECT * FROM availability_blocks')).toHaveLength(0);
});
it('serializes a concurrent room block and appointment so exactly one succeeds',async()=>{
 const results=await Promise.all([call('post','availability/blocks').send({branch_id:branch,kind:'room',resource_id:rooms[1],start_local:'2030-01-17T09:00',end_local:'2030-01-17T10:00',reason:'Mantenimiento'}),call('post','appointments').send({...booking('2030-01-17T09:00'),professional_id:professionals[1],room_id:rooms[1],request_id:randomUUID()})]);
 expect(results.map(r=>r.status).sort()).toEqual([201,409]);
});
it('reserves preparation for resources, checks blocks and preserves it when moving',async()=>{
 const base={...booking('2032-05-03T09:00'),professional_id:professionals[1],room_id:rooms[1],buffer_minutes:20};
 const created=await call('post','appointments').send({...base,request_id:randomUUID()});expect(created.status).toBe(201);
 const adjacent={...base,start_local:'2032-05-03T09:30',buffer_minutes:0,patient_id:patients[1]};
 expect((await call('post','appointments').send({...adjacent,request_id:randomUUID()})).status).toBe(409);
 expect((await call('post','appointments').send({...adjacent,start_local:'2032-05-03T09:50',request_id:randomUUID()})).status).toBe(201);
 expect((await call('post','availability/blocks').send({branch_id:branch,kind:'room',resource_id:rooms[1],start_local:'2032-05-03T09:35',end_local:'2032-05-03T09:45',reason:'Cruce con preparación'})).status).toBe(409);
 const {buffer_minutes:ignored,...move}=base;void ignored;
 expect((await call('patch',`appointments/${created.body.id}`).send({...move,start_local:'2032-05-03T11:00',version:1,reason:'Mover conservando margen'})).status).toBe(200);
 const events=await call('get',`appointments/events?date=2032-05-03&days=1&branch_id=${branch}`);const item=events.body.items.find((e:{id:string})=>e.id===created.body.id);expect(item.buffer_minutes).toBe(20);expect(item.occupied_until).toBe('2032-05-03T17:50:00.000Z');
 const history=await call('get',`appointments/${created.body.id}/history`);expect(history.body[0].snapshot.buffer_minutes).toBe(20);
 for(const buffer_minutes of [-1,121,1.5])expect((await call('post','appointments').send({...base,buffer_minutes,request_id:randomUUID()})).status).toBe(400);
 // A future block must also reject a new appointment whose preparation alone overlaps it.
 expect((await call('post','availability/blocks').send({branch_id:branch,kind:'room',resource_id:rooms[1],start_local:'2032-05-03T14:30',end_local:'2032-05-03T15:00',reason:'Mantenimiento'})).status).toBe(201);
 expect((await call('post','appointments').send({...base,start_local:'2032-05-03T14:00',request_id:randomUUID()})).status).toBe(409);
 expect((await call('post','appointments').send({...booking('2030-01-15T14:30'),buffer_minutes:20,request_id:randomUUID()})).status).toBe(409);
});
it('creates recurring series atomically with idempotent retries and preserved buffers',async()=>{
 const base={...booking('2035-03-01T09:00'),professional_id:professionals[1],room_id:rooms[1],buffer_minutes:15,count:3,interval_weeks:2,request_id:randomUUID()};
 const results=await Promise.all([call('post','appointments/series').send(base),call('post','appointments/series').send(base)]);expect(results.map(r=>r.status)).toEqual([201,201]);expect(results[0].body).toEqual(results[1].body);expect(results[0].body.appointment_ids).toHaveLength(3);
 const events=await call('get',`appointments/events?date=2035-03-01&days=42&branch_id=${branch}`);expect(events.body.items.map((r:{starts_at:string})=>r.starts_at)).toEqual(['2035-03-01T15:00:00.000Z','2035-03-15T15:00:00.000Z','2035-03-29T15:00:00.000Z']);expect(events.body.items.every((r:{buffer_minutes:number;series_id:string})=>r.buffer_minutes===15&&r.series_id===results[0].body.id)).toBe(true);
 expect((await call('post','appointments/series').send({...base,count:4})).status).toBe(409);
 const conflict=await call('post','appointments/series').send({...base,request_id:randomUUID(),start_local:'2035-02-15T09:00'});expect(conflict.status).toBe(409);expect(conflict.body.message).toContain('Cita 2');
 expect((await call('get',`appointments/events?date=2035-02-15&days=1&branch_id=${branch}`)).body.items).toHaveLength(0);
 expect(await query('SELECT * FROM appointment_series')).toHaveLength(0);
 expect((await call('post','appointments/series').send({...base,count:25})).status).toBe(400);
});
it('restricts professional services with versioning, tenant isolation and appointment protection',async()=>{
 const path='catalogs/professionals/'+professionals[1]+'/services';
 const initial=await call('get',path);expect(initial.status).toBe(200);expect(initial.body.restrict_services).toBe(false);
 expect((await call('get',path,other)).status).toBe(404);
 expect((await call('patch',path).send({version:initial.body.version,restrict_services:true,service_ids:[randomUUID()]})).status).toBe(400);
 expect((await call('patch',path).send({version:initial.body.version,restrict_services:true,service_ids:[]})).status).toBe(409);
 const serviceId=booking().service_id;
 expect((await call('patch',path).send({version:initial.body.version,restrict_services:true,service_ids:[serviceId]})).status).toBe(200);
 expect((await call('patch',path).send({version:initial.body.version,restrict_services:false,service_ids:[]})).status).toBe(409);
 const extra=await call('post','catalogs/services').send({name:'Servicio restringido',code:'RESTRICTED',category:'Preventiva',duration_minutes:30,price_minor:100,currency:'MXN'});expect(extra.status).toBe(201);
 const options=await call('get','appointments/options?branch_id='+branch+'&professional_id='+professionals[1]);expect(options.body.services.map((r:{id:string})=>r.id)).toEqual([serviceId]);
 const invalid=await call('get','appointments/options?branch_id='+branch+'&professional_id='+randomUUID());expect(invalid.body.services).toEqual([]);
 const payload={...booking('2038-03-01T09:00'),professional_id:professionals[1],room_id:rooms[1],service_id:extra.body.id,request_id:randomUUID()};
 expect((await call('post','appointments').send(payload)).status).toBe(400);
 expect((await call('post','appointments/series').send({...payload,count:2,interval_weeks:1})).status).toBe(409);
 expect((await call('get','appointments/events?date=2038-03-01&days=14&branch_id='+branch)).body.items).toHaveLength(0);
 expect((await call('post','appointments').send({...payload,service_id:serviceId})).status).toBe(201);
 expect(await query('SELECT * FROM professional_services')).toHaveLength(0);
});
it('enforces professional rooms for options, bookings and series while protecting pending appointments',async()=>{
 const path='catalogs/professionals/'+professionals[1]+'/rooms';
 const initial=await call('get',path);expect(initial.status).toBe(200);expect(initial.body.restrict_rooms).toBe(false);
 expect((await call('get',path,other)).status).toBe(404);
 expect((await call('patch',path,other).send({version:initial.body.version,restrict_rooms:true,room_ids:[]})).status).toBe(404);
 expect((await call('patch',path).send({version:initial.body.version,restrict_rooms:true,room_ids:[randomUUID()]})).status).toBe(400);
 expect((await call('patch',path).send({version:initial.body.version,restrict_rooms:true,room_ids:[]})).status).toBe(409);
 expect((await call('patch',path).send({version:initial.body.version,restrict_rooms:true,room_ids:rooms})).status).toBe(200);
 expect((await call('patch',path).send({version:initial.body.version,restrict_rooms:false,room_ids:[]})).status).toBe(409);
 const extra=await call('post','catalogs/rooms').send({name:'Consultorio no asignado',branch_id:branch});expect(extra.status).toBe(201);
 const options=await call('get','appointments/options?branch_id='+branch+'&professional_id='+professionals[1]);expect(options.body.rooms.map((r:{id:string})=>r.id).sort()).toEqual([...rooms].sort());
 expect((await call('get','appointments/options?branch_id='+branch+'&professional_id='+randomUUID())).body.rooms).toEqual([]);
 const payload={...booking('2039-03-01T09:00'),professional_id:professionals[1],room_id:extra.body.id,request_id:randomUUID()};
 expect((await call('post','appointments').send(payload)).status).toBe(400);
 expect((await call('post','appointments/series').send({...payload,count:2,interval_weeks:1})).status).toBe(409);
 expect((await call('get','appointments/events?date=2039-03-01&days=14&branch_id='+branch)).body.items).toHaveLength(0);
 const created=await call('post','appointments').send({...payload,room_id:rooms[1]});expect(created.status).toBe(201);
 const {request_id,...move}=payload;void request_id;
 expect((await call('patch','appointments/'+created.body.id).send({...move,version:1,reason:'Consultorio incompatible'})).status).toBe(400);
 expect(await query('SELECT * FROM professional_rooms')).toHaveLength(0);
 const updated=await call('get',path);
 expect((await call('patch',path).send({version:updated.body.version,restrict_rooms:false,room_ids:[]})).status).toBe(200);
 expect((await call('get','appointments/options?branch_id='+branch+'&professional_id='+professionals[1])).body.rooms.some((r:{id:string})=>r.id===extra.body.id)).toBe(true);
});
it('returns the earliest future pending appointment and skips canceled appointments',async()=>{
 const patient=await call('post','patients').send({first_name:'Próxima',last_name:'Cita',request_id:randomUUID()});expect(patient.status).toBe(201);
 const path='patients/'+patient.body.id+'/next-appointment';expect((await call('get',path)).body.appointment).toBeNull();
 expect((await call('get',path,other)).status).toBe(404);
 const base={...booking('2042-03-01T09:00'),patient_id:patient.body.id,professional_id:professionals[1],room_id:rooms[1]};
 const later=await call('post','appointments').send({...base,start_local:'2042-03-02T09:00',request_id:randomUUID()});expect(later.status).toBe(201);
 const earlier=await call('post','appointments').send({...base,request_id:randomUUID()});expect(earlier.status).toBe(201);
 const next=await call('get',path);expect(next.body.appointment.id).toBe(earlier.body.id);expect(next.body.appointment.branch_id).toBe(branch);expect(next.body.appointment.service_name).toBeTruthy();
 expect((await call('patch','appointments/'+earlier.body.id+'/status').send({version:1,status:'canceled',reason:'Prueba'})).status).toBe(200);
 expect((await call('get',path)).body.appointment.id).toBe(later.body.id);
 expect((await call('patch','appointments/'+later.body.id+'/status').send({version:1,status:'canceled',reason:'Prueba'})).status).toBe(200);
 expect((await call('get',path)).body.appointment).toBeNull();
});
it('suggests slots respecting preparation, blocks, schedule and rescheduling exclusions',async()=>{
 const professional=await call('post','catalogs/professionals').send({name:'Sugerencias',branch_ids:[branch]});
 const room=await call('post','catalogs/rooms').send({name:'Sala sugerencias',branch_id:branch});
 const patient=await call('post','patients').send({first_name:'Sugerencias',last_name:'Paciente',request_id:randomUUID()});
 const base={...booking('2040-01-03T09:00'),professional_id:professional.body.id,room_id:room.body.id,patient_id:patient.body.id,buffer_minutes:15};
 const created=await call('post','appointments').send({...base,request_id:randomUUID()});expect(created.status).toBe(201);
 expect((await call('post','availability/blocks').send({branch_id:branch,kind:'room',resource_id:room.body.id,start_local:'2040-01-03T10:00',end_local:'2040-01-03T11:00',reason:'Bloqueo'})).status).toBe(201);
 expect((await call('post','availability/schedule').send({professional_id:professional.body.id,branch_id:branch,version:0,weekly:[{day:2,start:'09:00',end:'12:00'}],reason:'Turno'})).status).toBe(201);
 const result=await call('post','appointments/suggestions').send(base);expect(result.status).toBe(201);expect(result.body.items.map((r:{start_local:string})=>r.start_local)).toEqual(['2040-01-03T11:00','2040-01-03T11:15']);
 const moving=await call('post','appointments/suggestions').send({...base,exclude_id:created.body.id});expect(moving.body.items[0].start_local).toBe(base.start_local);
 expect((await call('post','appointments/suggestions').send({...base,start_local:'2040-01-04T09:00'})).body.items).toEqual([]);
 expect((await call('post','appointments/suggestions',other).send(base)).status).toBe(400);
 expect((await call('post','appointments/suggestions').send({...base,exclude_id:randomUUID()})).status).toBe(400);
 expect((await call('post','appointments/suggestions').send({...base,duration_minutes:0})).status).toBe(400);
});
it('enforces room hours for booking, preparation, suggestions and protected schedule edits',async()=>{
 const room=await call('post','catalogs/rooms').send({name:'Sala con turnos',branch_id:branch});
 const base={...booking('2041-01-01T09:00'),professional_id:professionals[1],room_id:room.body.id,buffer_minutes:15};
 const path='availability/room-schedule',schedule={room_id:room.body.id,branch_id:branch,version:0,weekly:[{day:2,start:'10:00',end:'12:00'}],reason:'Turno del consultorio'};
 expect((await call('get',path+'?branch_id='+branch+'&room_id='+room.body.id)).body.version).toBe(0);
 expect((await call('get',path+'?branch_id='+branch+'&room_id='+room.body.id,other)).status).toBe(404);
 expect((await call('post',path).send(schedule)).status).toBe(201);
 expect((await call('post',path).send(schedule)).status).toBe(409);
 expect((await call('post','appointments').send({...base,request_id:randomUUID()})).status).toBe(409);
 expect((await call('post','appointments').send({...base,start_local:'2041-01-01T11:30',request_id:randomUUID()})).status).toBe(409);
 const suggestions=await call('post','appointments/suggestions').send(base);expect(suggestions.body.items[0].start_local).toBe('2041-01-01T10:00');expect(suggestions.body.items.at(-1).start_local).toBe('2041-01-01T11:15');
 const created=await call('post','appointments').send({...base,start_local:'2041-01-01T10:00',request_id:randomUUID()});expect(created.status).toBe(201);
 expect((await call('post',path).send({...schedule,version:1,weekly:[]})).status).toBe(409);
 expect((await call('post','appointments/series').send({...base,start_local:'2041-01-02T10:00',count:2,interval_weeks:1,request_id:randomUUID()})).status).toBe(409);
 expect((await call('patch','appointments/'+created.body.id+'/status').send({version:1,status:'canceled',reason:'Prueba'})).status).toBe(200);
 expect((await call('post',path).send({...schedule,version:1,weekly:[]})).status).toBe(201);
 expect((await call('post','appointments/suggestions').send(base)).body.items).toEqual([]);
 expect(await query('SELECT * FROM room_schedules')).toHaveLength(0);
});
it('denies scheduling to a read-only member',async()=>{
 const email=`agenda-reader-${randomUUID()}@alia.example`;const [u]=await query('INSERT INTO users(email,name,password_hash) VALUES($1,$2,$3) RETURNING id',[email,'Reader',await hashPassword(password)]);const [role]=await query("SELECT id FROM roles WHERE organization_id=$1 AND name='Solo lectura'",[org]);await query('INSERT INTO memberships(organization_id,user_id,role_id) VALUES($1,$2,$3)',[org,u.id,role.id]);
 const login=await request(app.getHttpServer()).post('/api/auth/login').set('Origin',origin).send({email,password});const c=login.headers['set-cookie'][0].split(';')[0];const me=await request(app.getHttpServer()).get('/api/auth/me').set('Cookie',c);
 expect((await request(app.getHttpServer()).post('/api/appointments').set('Origin',origin).set('Cookie',c).set('X-CSRF-Token',me.body.csrf).set('X-Organization-Id',org).send({...booking(),request_id:randomUUID()})).status).toBe(403);
 expect((await request(app.getHttpServer()).patch('/api/catalogs/professionals/'+professionals[1]+'/rooms').set('Origin',origin).set('Cookie',c).set('X-CSRF-Token',me.body.csrf).set('X-Organization-Id',org).send({version:1,restrict_rooms:true,room_ids:[]})).status).toBe(403);
 expect((await request(app.getHttpServer()).get('/api/patients/'+patients[0]+'/next-appointment').set('Cookie',c).set('X-Organization-Id',org)).status).toBe(403);
 const search=await request(app.getHttpServer()).get('/api/search?q=valoracion').set('Cookie',c).set('X-Organization-Id',org);expect(search.status).toBe(200);expect(search.body.groups).toEqual([]);
});

it('reception can register a caller and manage the appointment lifecycle without catalog administration',async()=>{
 const email='reception-'+randomUUID()+'@alia.example';
 const [user]=await query('INSERT INTO users(email,name,password_hash) VALUES($1,$2,$3) RETURNING id',[email,'Recepción de prueba',await hashPassword(password)]);
 const [role]=await query("SELECT id FROM roles WHERE organization_id=$1 AND name='Recepción'",[org]);
 await query('INSERT INTO memberships(organization_id,user_id,role_id) VALUES($1,$2,$3)',[org,user.id,role.id]);
 const login=await request(app.getHttpServer()).post('/api/auth/login').set('Origin',origin).send({email,password});expect(login.status).toBe(201);
 const receptionCookie=login.headers['set-cookie'][0].split(';')[0];
 const me=await request(app.getHttpServer()).get('/api/auth/me').set('Cookie',receptionCookie);
 const reception=(method:'get'|'post'|'patch',path:string)=>request(app.getHttpServer())[method]('/api/'+path).set('Origin',origin).set('Cookie',receptionCookie).set('X-CSRF-Token',me.body.csrf).set('X-Organization-Id',org);
 const patient=await reception('post','patients').send({request_id:randomUUID(),first_name:'Llamada',last_name:'Recepción',phone:'9991112233'});expect(patient.status).toBe(201);
 expect((await reception('get','patients?q=9991112233')).body.items.some((p:{id:string})=>p.id===patient.body.id)).toBe(true);
 const payload={...booking('2046-02-02T10:00'),professional_id:professionals[1],room_id:rooms[1],patient_id:patient.body.id};
 expect((await reception('post','appointments/suggestions').send(payload)).status).toBe(201);
 const appointment=await reception('post','appointments').send({...payload,request_id:randomUUID()});expect(appointment.status).toBe(201);
 expect((await reception('get','patients/'+patient.body.id+'/next-appointment')).body.appointment.id).toBe(appointment.body.id);
 expect((await reception('patch','appointments/'+appointment.body.id).send({...payload,start_local:'2046-02-02T11:00',version:1,reason:'Cambio solicitado por llamada'})).status).toBe(200);
 let version=2;for(const status of ['confirmed','arrived','in_consultation','completed'])expect((await reception('patch','appointments/'+appointment.body.id+'/status').send({version:version++,status})).status).toBe(200);
 expect((await reception('get','patients/'+patient.body.id+'/next-appointment')).body.appointment).toBeNull();
 expect((await reception('post','catalogs/rooms').send({name:'No autorizado',branch_id:branch})).status).toBe(403);
 expect((await reception('post','availability/room-schedule').send({room_id:rooms[1],branch_id:branch,version:0,weekly:[],reason:'No autorizado'})).status).toBe(403);
 expect((await reception('get','appointments/'+appointment.body.id+'/history')).body).toHaveLength(6);
});

it('prevents converting a booked professional to an external contact without branches',async()=>{
 const professional=(await call('post','catalogs/professionals').send({name:'Visitante de prueba',relationship:'external',branch_ids:[branch]})).body.id;
 const reserved=await call('post','appointments').send({...booking('2031-01-15T09:00'),professional_id:professional,request_id:randomUUID()});expect(reserved.status).toBe(201);
 expect((await call('patch','catalogs/professionals/'+professional).send({name:'Visitante de prueba',relationship:'external',branch_ids:[],version:1})).status).toBe(409);
 expect((await call('get','catalogs/professionals?id='+professional)).body.items[0].branch_ids).toEqual([branch]);
});

it('maintains a durable held reminder queue through preferences, retries, moves, contact changes and cancellation',async()=>{
 const p=(await call('post','patients').send({request_id:randomUUID(),first_name:'Recordatorio',last_name:'Cola',email:'cola@example.invalid',whatsapp:'+529991234567'})).body.id;
 const professional=(await call('post','catalogs/professionals').send({name:'Doctor cola',branch_ids:[branch]})).body.id;
 const room=(await call('post','catalogs/rooms').send({name:'Sala cola',branch_id:branch})).body.id;
 const base='patients/'+p+'/reminder-preferences',fields={...booking('2047-06-03T09:00'),patient_id:p,professional_id:professional,room_id:room},payload={...fields,request_id:randomUUID()};
 const booked=await call('post','appointments').send(payload);expect(booked.status).toBe(201);const appt=booked.body.id;
 const pref={version:0,email_enabled:true,whatsapp_enabled:true,email:'cola@example.invalid',whatsapp:'+529991234567',offsets_hours:[24],notes:'Paciente ficticio autoriza',reviewed:true};
 expect((await call('post',base).send(pref)).status).toBe(201);
 let jobs=(await call('get',base+'/queue')).body;expect(jobs.delivery_enabled).toBe(false);expect(jobs.items).toHaveLength(2);expect(jobs.items.every((j:{state:string})=>j.state==='held')).toBe(true);
 expect(new Date(jobs.items[0].starts_at).getTime()-new Date(jobs.items[0].due_at).getTime()).toBe(86400000);
 expect((await call('post','appointments').send(payload)).status).toBe(201);expect((await call('get',base+'/queue')).body.items).toHaveLength(2);
 expect((await call('patch','appointments/'+appt).send({...fields,start_local:'2047-06-03T11:00',version:1,reason:'Reprogramación de prueba'})).status).toBe(200);
 jobs=(await call('get',base+'/queue')).body;expect(jobs.items).toHaveLength(4);expect(jobs.items.filter((j:{state:string})=>j.state==='held')).toHaveLength(2);expect(jobs.items.filter((j:{state:string})=>j.state==='canceled')).toHaveLength(2);
 expect((await call('post',base).send({...pref,version:1,whatsapp_enabled:false})).status).toBe(201);
 expect((await call('get',base+'/queue')).body.items.filter((j:{state:string})=>j.state==='held')).toHaveLength(1);
 expect((await call('patch','patients/'+p).send({version:1,first_name:'Recordatorio',last_name:'Cola',email:'nuevo@example.invalid',whatsapp:'+529991234567'})).status).toBe(200);
 expect((await call('get',base+'/queue')).body.items.filter((j:{state:string})=>j.state==='held')).toHaveLength(0);
 expect((await call('post',base).send({...pref,version:2,email:'nuevo@example.invalid'})).status).toBe(201);
 const results=await Promise.all([call('post',base).send({...pref,version:3,email:'nuevo@example.invalid'}),call('patch','appointments/'+appt+'/status').send({version:2,status:'confirmed'})]);expect(results.map(r=>r.status).sort()).toEqual([200,201]);
 jobs=(await call('get',base+'/queue')).body;const held=jobs.items.filter((j:{state:string})=>j.state==='held');expect(held).toHaveLength(2);expect(held.every((j:{appointment_version:number;preference_version:number})=>j.appointment_version===3&&j.preference_version===4)).toBe(true);
 expect((await call('get',base+'/queue',other)).status).toBe(404);expect(await patientTransaction(other,c=>query('SELECT id FROM appointment_reminders WHERE patient_id=$1',[p],c))).toHaveLength(0);
 await expect(patientTransaction(org,c=>query('DELETE FROM appointment_reminders WHERE patient_id=$1',[p],c))).rejects.toMatchObject({code:'42501'});
 expect((await call('patch','appointments/'+appt+'/status').send({version:3,status:'canceled',reason:'Paciente cancela'})).status).toBe(200);expect((await call('get',base+'/queue')).body.items.every((j:{state:string})=>j.state==='canceled')).toBe(true);
});

it('prepares manual WhatsApp without sending and rejects stale or unauthorized drafts',async()=>{
 const p=(await call('post','patients').send({request_id:randomUUID(),first_name:'WhatsApp',last_name:'Manual',whatsapp:'+52 (999) 123-4567'})).body.id;
 const doctor=(await call('post','catalogs/professionals').send({name:'Doctor WhatsApp',branch_ids:[branch]})).body.id,room=(await call('post','catalogs/rooms').send({name:'Sala WhatsApp',branch_id:branch})).body.id;
 const fields={...booking('2048-02-04T10:00'),patient_id:p,professional_id:doctor,room_id:room};const booked=await call('post','appointments').send({...fields,request_id:randomUUID()});expect(booked.status).toBe(201);const a=booked.body.id,base='patients/'+p+'/whatsapp-reminders',path=base+'/'+a;
 expect((await call('get',base)).body.items.map((r:{id:string})=>r.id)).toContain(a);expect((await call('post',path+'/draft').send({})).status).toBe(409);
 const pref={version:0,email_enabled:false,whatsapp_enabled:true,email:'',whatsapp:'+529991234567',offsets_hours:[24],notes:'Autorización ficticia',reviewed:true};expect((await call('post','patients/'+p+'/reminder-preferences').send(pref)).status).toBe(201);
 const draft=await call('post',path+'/draft').send({});expect(draft.status).toBe(201);expect(draft.body.number).toBe('+529991234567');expect(draft.body.message).toContain('WhatsApp');
 const input={review_token:draft.body.review_token,message:'Mensaje editado & ¿confirmas?\n¡Gracias!'};const linked=await call('post',path+'/link').send(input);expect(linked.status).toBe(201);expect(linked.body.sent).toBe(false);expect(new URL(linked.body.url).searchParams.get('text')).toBe(input.message);
 expect((await call('post',path+'/link').send({...input,message:''})).status).toBe(400);expect((await call('post',path+'/link').send({...input,review_token:'0'.repeat(64)})).status).toBe(409);
 expect((await call('post',path+'/draft',other).send({})).status).toBe(404);expect((await call('post','patients/'+patients[0]+'/whatsapp-reminders/'+a+'/draft').send({})).status).toBe(404);
 const queue=(await call('get','patients/'+p+'/reminder-preferences/queue')).body.items;expect(queue.every((j:{state:string})=>j.state==='held')).toBe(true);
 expect((await call('patch','appointments/'+a).send({...fields,start_local:'2048-02-04T11:00',version:1,reason:'Nueva hora'})).status).toBe(200);expect((await call('post',path+'/link').send(input)).status).toBe(409);
 const fresh=(await call('post',path+'/draft').send({})).body;expect((await call('patch','patients/'+p).send({version:1,first_name:'WhatsApp',last_name:'Manual',whatsapp:'+529997654321'})).status).toBe(200);expect((await call('post',path+'/link').send({...input,review_token:fresh.review_token})).status).toBe(409);
 expect((await call('patch','appointments/'+a+'/status').send({version:2,status:'canceled',reason:'Cancelar prueba'})).status).toBe(200);expect((await call('post',path+'/draft').send({})).status).toBe(404);
 const logs=await query("SELECT action,\"after\",\"before\" FROM audit_logs WHERE organization_id=$1 AND entity_id=$2 AND action LIKE 'reminder.whatsapp_%'",[org,a]);expect(logs.some(l=>l.action==='reminder.whatsapp_link_prepared')).toBe(true);expect(logs.every(l=>l.after===null&&l.before===null)).toBe(true);
 expect((await call('post','patients/'+p+'/reminder-preferences').send({...pref,version:1,whatsapp:'+529997654321'})).status).toBe(201);
 const soon=await call('post','appointments').send({...fields,request_id:randomUUID(),start_local:Temporal.Now.zonedDateTimeISO('America/Mexico_City').add({hours:2}).toPlainDateTime().toString().slice(0,16)});expect(soon.status).toBe(201);
 expect((await call('get','patients/'+p+'/reminder-preferences/queue')).body.items.filter((j:{appointment_id:string})=>j.appointment_id===soon.body.id)).toHaveLength(0);
 expect((await call('post',base+'/'+soon.body.id+'/draft').send({})).status).toBe(201);
});
