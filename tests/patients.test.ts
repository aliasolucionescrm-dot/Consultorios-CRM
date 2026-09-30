import 'dotenv/config';
import { beforeAll,afterAll,describe,it,expect } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../apps/api/src/app';
import { hashPassword } from '../apps/api/src/auth';
import { patientTransaction } from '../apps/api/src/patients';
import { query,pool } from '../packages/database/src/client';
let app:INestApplication,cookie:string,csrf:string,orgA:string,orgB:string,patientId:string,readerCookie:string,readerCsrf:string;
const suffix=randomUUID().slice(0,8),password='Patients-test-only-2026!',origin=process.env.APP_ORIGIN!;
function call(method:'get'|'post'|'patch',path:string,org=orgA){return request(app.getHttpServer())[method](`/api/${path}`).set('Origin',origin).set('Cookie',cookie).set('X-CSRF-Token',csrf||'').set('X-Organization-Id',org||'');}
beforeAll(async()=>{
 if(!/^alia_test_[a-f0-9]{12}$/.test(process.env.TEST_DATABASE_NAME||''))throw new Error('Run npm test');
 app=await createApp();await app.init();const email=`patients-${suffix}@alia.example`;
 await query('INSERT INTO users(email,name,password_hash) VALUES($1,$2,$3)',[email,'Patient Test Owner',await hashPassword(password)]);
 const login=await request(app.getHttpServer()).post('/api/auth/login').set('Origin',origin).send({email,password});cookie=login.headers['set-cookie'][0].split(';')[0];csrf=(await call('get','auth/me')).body.csrf;
 orgA=(await call('post','organizations').send({name:`Patients A ${suffix}`,branch:'Principal'})).body.id;
 orgB=(await call('post','organizations').send({name:`Patients B ${suffix}`,branch:'Secundaria'})).body.id;
 const [role]=await query("SELECT id FROM roles WHERE organization_id=$1 AND name='Solo lectura'",[orgA]);
 const readerEmail=`patient-reader-${suffix}@alia.example`;
 const [u]=await query('INSERT INTO users(email,name,password_hash) VALUES($1,$2,$3) RETURNING id',[readerEmail,'Reader',await hashPassword(password)]);
 await query('INSERT INTO memberships(organization_id,user_id,role_id) VALUES($1,$2,$3)',[orgA,u.id,role.id]);
 const r=await request(app.getHttpServer()).post('/api/auth/login').set('Origin',origin).send({email:readerEmail,password});readerCookie=r.headers['set-cookie'][0].split(';')[0];readerCsrf=(await request(app.getHttpServer()).get('/api/auth/me').set('Cookie',readerCookie)).body.csrf;
});
afterAll(async()=>{await app?.close();await pool.end();});
describe('Patients: persistence, permissions, RLS and concurrency',()=>{
 it('creates a patient with organization-issued folio and persists all administrative fields',async()=>{
  const result=await call('post','patients').send({request_id:randomUUID(),first_name:'María Fernanda',last_name:'López Navarro',birth_date:'1991-05-09',phone:'999 123 4567',email:'maria.ficticia@example.invalid',emergency_name:'Contacto ficticio',tags:['Primera visita']});
  expect(result.status).toBe(201);patientId=result.body.id;const detail=await call('get',`patients/${patientId}`);expect(detail.status).toBe(200);expect(detail.body.record_number).toBe('P000001');expect(detail.body.birth_date).toBe('1991-05-09');expect(detail.body.emergency_name).toBe('Contacto ficticio');expect(detail.body.request_hash).toBeUndefined();
 });
 it('denies cross-tenant reads and writes even to a user in both organizations',async()=>{
  expect((await call('get',`patients/${patientId}`,orgB)).status).toBe(404);
  expect((await call('patch',`patients/${patientId}`,orgB).send({first_name:'Bad',last_name:'Access',version:1})).status).toBe(404);
  expect((await call('get','patients',orgB)).body.items).toHaveLength(0);
 });
 it('enforces RLS even when the SQL query omits organization filtering',async()=>{
  expect(await query('SELECT id FROM patients')).toHaveLength(0);
  const rows=await patientTransaction(orgB,c=>query('SELECT id FROM patients',[],c));expect(rows).toHaveLength(0);
  const own=await patientTransaction(orgA,c=>query('SELECT id FROM patients',[],c));expect(own).toHaveLength(1);
  await expect(patientTransaction(orgB,c=>query("INSERT INTO patients(organization_id,request_id,request_hash,record_number,first_name,last_name) VALUES($1,$2,'hash','FOREIGN','Cross','Tenant')",[orgA,randomUUID()],c))).rejects.toMatchObject({code:'42501'});
  expect(await query('SELECT id FROM patients')).toHaveLength(0); // SET LOCAL did not leak to pooled connections.
 });
 it('denies users without patient permissions at the API',async()=>{
  expect((await request(app.getHttpServer()).get('/api/patients').set('Cookie',readerCookie).set('X-Organization-Id',orgA)).status).toBe(403);
  expect((await request(app.getHttpServer()).post('/api/patients').set('Origin',origin).set('Cookie',readerCookie).set('X-CSRF-Token',readerCsrf).set('X-Organization-Id',orgA).send({request_id:randomUUID(),first_name:'No',last_name:'Access'})).status).toBe(403);
 });
 it('finds names without accents, partial words, typos, phone, email and folio',async()=>{
  for(const q of ['maria lopez','mar fer','loepz','999123','maria.ficticia@','P000001']){
   const result=await call('get',`patients?q=${encodeURIComponent(q)}`);expect(result.status).toBe(200);expect(result.body.items.map((p:{id:string})=>p.id),q).toContain(patientId);
  }
 });
 it('treats SQL and LIKE wildcard input as data',async()=>{
  for(const q of ["' OR 1=1 --",'%','_'])expect((await call('get',`patients?q=${encodeURIComponent(q)}`)).body.items).toHaveLength(0);
 });
 it('rejects invalid dates and caller-supplied tenant/folio fields',async()=>{
  const base={request_id:randomUUID(),first_name:'Test',last_name:'Validation'};
  for(const extra of [{birth_date:'2099-01-01'},{birth_date:'2023-02-29'},{organization_id:orgB},{record_number:'P100000'}])expect((await call('post','patients').send({...base,...extra})).status).toBe(400);
 });
 it('retries concurrent patient creation idempotently and rejects changed payloads',async()=>{
  const input={request_id:randomUUID(),first_name:'Request',last_name:'Retry'};
  const [a,b]=await Promise.all([call('post','patients').send(input),call('post','patients').send(input)]);expect(a.status).toBe(201);expect(b.status).toBe(201);expect(a.body.id).toBe(b.body.id);
  expect((await call('post','patients').send({...input,first_name:'Changed'})).status).toBe(409);
 });
 it('assigns distinct folios to concurrent creates',async()=>{
  const results=await Promise.all(Array.from({length:6},(_,i)=>call('post','patients').send({request_id:randomUUID(),first_name:`Concurrent ${i}`,last_name:'Test'})));
  expect(results.every(r=>r.status===201)).toBe(true);
  const rows=await patientTransaction(orgA,c=>query('SELECT record_number FROM patients WHERE organization_id=$1',[orgA],c));expect(new Set(rows.map(p=>p.record_number)).size).toBe(rows.length);
 });
 it('paginates without duplicates and refuses cursor reuse across tenants/queries',async()=>{
  const first=await call('get','patients?limit=3');expect(first.body.items).toHaveLength(3);expect(first.body.nextCursor).toBeTruthy();const encoded=encodeURIComponent(first.body.nextCursor);
  const second=await call('get',`patients?limit=3&cursor=${encoded}`);expect(second.status).toBe(200);const ids=new Set(first.body.items.map((p:{id:string})=>p.id));expect(second.body.items.some((p:{id:string})=>ids.has(p.id))).toBe(false);
  expect((await call('get',`patients?cursor=${encoded}`,orgB)).status).toBe(400);expect((await call('get',`patients?q=other&cursor=${encoded}`)).status).toBe(400);
 });
 it('rejects stale edits and requires a reason for deactivation',async()=>{
  const input={first_name:'María Fernanda',last_name:'López Navarro',version:1,phone:'999 123 4567'};
  expect((await call('patch',`patients/${patientId}`).send({...input,occupation:'Prueba ficticia'})).status).toBe(200);
  expect((await call('patch',`patients/${patientId}`).send(input)).status).toBe(409);
  expect((await call('patch',`patients/${patientId}`).send({...input,version:2,active:false})).status).toBe(400);
  expect((await call('patch',`patients/${patientId}`).send({...input,version:2,active:false,reason:'Registro de prueba'})).status).toBe(200);
  expect((await call('get','patients?status=inactive')).body.items.map((p:{id:string})=>p.id)).toContain(patientId);
 });
 it('audits creation, access and changed fields without storing patient details in logs',async()=>{
  const events=await query('SELECT action,before,after FROM audit_logs WHERE organization_id=$1 AND entity_id=$2',[orgA,patientId]);expect(events.map(e=>e.action)).toEqual(expect.arrayContaining(['patient.created','patient.viewed','patient.updated']));expect(JSON.stringify(events)).not.toContain('María');expect(JSON.stringify(events)).not.toContain('999 123');
 });
});

it('links family bidirectionally, prevents duplicate pairs and removes with version checks',async()=>{
 const a=(await call('post','patients').send({request_id:randomUUID(),first_name:'Hija',last_name:'Familia'})).body.id;
 const b=(await call('post','patients').send({request_id:randomUUID(),first_name:'Madre',last_name:'Familia'})).body.id;
 const foreign=(await call('post','patients',orgB).send({request_id:randomUUID(),first_name:'Otra',last_name:'Organización'})).body.id;
 expect((await call('post','patients/'+a+'/relatives').send({relative_id:a,relationship:'parent'})).status).toBe(400);
 expect((await call('post','patients/'+a+'/relatives').send({relative_id:foreign,relationship:'parent'})).status).toBe(404);
 const results=await Promise.all([call('post','patients/'+a+'/relatives').send({relative_id:b,relationship:'parent'}),call('post','patients/'+b+'/relatives').send({relative_id:a,relationship:'child'})]);expect(results.map(r=>r.status).sort()).toEqual([201,409]);
 const left=await call('get','patients/'+a+'/relatives'),right=await call('get','patients/'+b+'/relatives');expect(left.body.items[0].relationship).toBe('parent');expect(right.body.items[0].relationship).toBe('child');
 expect(left.body.items[0].relative_id).toBe(b);expect(right.body.items[0].relative_id).toBe(a);
 expect((await call('get','patients/'+a+'/relatives',orgB)).status).toBe(404);
 expect(await query('SELECT * FROM patient_relations')).toHaveLength(0);
 const id=left.body.items[0].id;
 expect((await call('patch','patients/'+a+'/relatives/'+id+'/remove').send({version:1,reason:''})).status).toBe(400);
 expect((await call('patch','patients/'+a+'/relatives/'+id+'/remove',orgB).send({version:1,reason:'No'})).status).toBe(404);
 expect((await call('patch','patients/'+b+'/relatives/'+id+'/remove').send({version:1,reason:'Corrección'})).status).toBe(200);
 expect((await call('patch','patients/'+a+'/relatives/'+id+'/remove').send({version:1,reason:'Obsoleto'})).status).toBe(409);
 expect((await call('get','patients/'+a+'/relatives')).body.items).toHaveLength(0);expect((await call('get','patients/'+b+'/relatives')).body.items).toHaveLength(0);
 expect((await call('post','patients/'+a+'/relatives').send({relative_id:b,relationship:'other'})).status).toBe(201);
 expect((await request(app.getHttpServer()).post('/api/patients/'+a+'/relatives').set('Origin',origin).set('Cookie',readerCookie).set('X-CSRF-Token',readerCsrf).set('X-Organization-Id',orgA).send({relative_id:b,relationship:'parent'})).status).toBe(403);
});
