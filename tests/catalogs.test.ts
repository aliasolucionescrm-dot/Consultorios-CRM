import 'dotenv/config';
import { beforeAll,afterAll,it,expect } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { createApp } from '../apps/api/src/app';
import { hashPassword } from '../apps/api/src/auth';
import { query,pool } from '../packages/database/src/client';
let app:INestApplication,cookie:string,csrf:string,org:string,other:string,branch:string,foreignBranch:string,serviceId:string,professionalId:string,roomId:string;
const origin=process.env.APP_ORIGIN!,password='Catalog-test-only-2026!';
const service={name:'Limpieza ficticia',code:'TEST-PROF',category:'Preventiva',duration_minutes:45,price_minor:85050,cost_minor:20000,currency:'MXN',requires_tooth:false,requires_consent:false,active:true};
function call(method:'get'|'post'|'patch',path:string,tenant=org){return request(app.getHttpServer())[method](`/api/${path}`).set('Origin',origin).set('Cookie',cookie).set('X-CSRF-Token',csrf||'').set('X-Organization-Id',tenant||'');}
beforeAll(async()=>{
 if(!/^alia_test_[a-f0-9]{12}$/.test(process.env.TEST_DATABASE_NAME||''))throw new Error('Run npm test');
 app=await createApp();await app.init();const email=`catalog-${randomUUID()}@alia.example`;
 await query('INSERT INTO users(email,name,password_hash) VALUES($1,$2,$3)',[email,'Catalog owner',await hashPassword(password)]);
 const login=await request(app.getHttpServer()).post('/api/auth/login').set('Origin',origin).send({email,password});cookie=login.headers['set-cookie'][0].split(';')[0];csrf=(await call('get','auth/me')).body.csrf;
 org=(await call('post','organizations').send({name:'Catalog test',branch:'Central'})).body.id;
 other=(await call('post','organizations').send({name:'Other catalog',branch:'Foreign'})).body.id;
 branch=(await call('get','organization')).body.branches[0].id;foreignBranch=(await call('get','organization',other)).body.branches[0].id;
});
afterAll(async()=>{await app?.close();await pool.end();});
it('creates a professional without a user account, a room and a service',async()=>{
 const p=await call('post','catalogs/professionals').send({name:'Dra. Ficticia',license:'TEST123',branch_ids:[branch]});expect(p.status).toBe(201);professionalId=p.body.id;
 const r=await call('post','catalogs/rooms').send({name:'Consultorio 1',branch_id:branch,chair:'Sillón A'});expect(r.status).toBe(201);roomId=r.body.id;
 const s=await call('post','catalogs/services').send(service);expect(s.status).toBe(201);serviceId=s.body.id;
 expect((await call('get','catalogs/professionals')).body.items[0].branch_ids).toEqual([branch]);
});
it('rejects foreign branch assignment and cross-tenant changes',async()=>{
 expect((await call('post','catalogs/rooms').send({name:'Wrong',branch_id:foreignBranch})).status).toBe(400);
 expect((await call('post','catalogs/professionals').send({name:'Wrong',branch_ids:[foreignBranch]})).status).toBe(400);
 expect((await call('patch',`catalogs/services/${serviceId}`,other).send({...service,version:1})).status).toBe(404);
 expect((await call('get','catalogs/services',other)).body.items).toHaveLength(0);
});
it('restricts all catalog tables with RLS without session tenant',async()=>{
 for(const table of ['professionals','professional_branches','rooms','services','service_price_history'])expect(await query(`SELECT 1 FROM ${table}`)).toHaveLength(0);
});
it('validates integer monetary amounts, currency, duration and strict fields',async()=>{
 for(const input of [{price_minor:100.1},{price_minor:-1},{duration_minutes:0},{currency:'USD'},{organization_id:other}])expect((await call('post','catalogs/services').send({...service,code:randomUUID().slice(0,8).toUpperCase(),...input})).status).toBe(400);
});
it('persists price history and rejects stale edits',async()=>{
 expect((await call('patch',`catalogs/services/${serviceId}`).send({...service,price_minor:90025,version:1})).status).toBe(200);
 expect((await call('patch',`catalogs/services/${serviceId}`).send({...service,version:1})).status).toBe(409);
 const prices=await call('get',`catalogs/services/${serviceId}/prices`);expect(prices.status).toBe(200);expect(prices.body.map((p:{price_minor:number})=>p.price_minor)).toEqual([90025,85050]);
 await expect(query('DELETE FROM service_price_history WHERE false')).rejects.toMatchObject({code:'42501'});
});
it('preserves identity and requires reason for deactivation',async()=>{
 const input={name:'Consultorio 1',branch_id:branch,active:false,version:1};
 expect((await call('patch',`catalogs/rooms/${roomId}`).send(input)).status).toBe(400);
 expect((await call('patch',`catalogs/rooms/${roomId}`).send({...input,reason:'Mantenimiento'})).status).toBe(200);
 expect((await call('get','catalogs/rooms?status=inactive')).body.items[0].id).toBe(roomId);
});
it('grants catalog read to reception but denies write and cost history',async()=>{
 const email=`reception-${randomUUID()}@alia.example`;const [u]=await query('INSERT INTO users(email,name,password_hash) VALUES($1,$2,$3) RETURNING id',[email,'Reception',await hashPassword(password)]);const [r]=await query("SELECT id FROM roles WHERE organization_id=$1 AND name='Recepción'",[org]);await query('INSERT INTO memberships VALUES($1,$2,$3,true,now())',[org,u.id,r.id]);
 const login=await request(app.getHttpServer()).post('/api/auth/login').set('Origin',origin).send({email,password});const c=login.headers['set-cookie'][0].split(';')[0];const me=await request(app.getHttpServer()).get('/api/auth/me').set('Cookie',c);
 expect((await request(app.getHttpServer()).get('/api/catalogs/services').set('Cookie',c).set('X-Organization-Id',org)).status).toBe(200);
 expect((await request(app.getHttpServer()).post('/api/catalogs/services').set('Cookie',c).set('X-Organization-Id',org).set('Origin',origin).set('X-CSRF-Token',me.body.csrf).send(service)).status).toBe(403);
 expect((await request(app.getHttpServer()).get(`/api/catalogs/services/${serviceId}/prices`).set('Cookie',c).set('X-Organization-Id',org)).status).toBe(403);
});
it('writes audit events for catalog mutations',async()=>{
 const events=await query('SELECT action FROM audit_logs WHERE organization_id=$1 AND entity_id=$2',[org,professionalId]);expect(events.map(e=>e.action)).toContain('professionals.created');
});

it('stores external professional data and filters without creating local branch access',async()=>{
 const input={name:'Especialista externo ficticio',relationship:'external',professional_title:'Título de prueba',training_institution:'Institución de prueba',external_organization:'Consultorio externo',practice_address:'Dirección ficticia',branch_ids:[]};
 const created=await call('post','catalogs/professionals').send(input);expect(created.status).toBe(201);
 const list=await call('get','catalogs/professionals?relationship=external');expect(list.body.items.find((p:{id:string})=>p.id===created.body.id)).toMatchObject(input);
 expect((await call('get','catalogs/professionals?relationship=internal')).body.items).toHaveLength(0);
 expect((await call('get','catalogs/professionals?relationship=invalid')).status).toBe(400);
 expect((await call('post','catalogs/professionals').send({...input,relationship:'internal'})).status).toBe(400);
 expect((await call('patch','catalogs/professionals/'+created.body.id).send({...input,relationship:'internal',branch_ids:[branch],version:1})).status).toBe(200);
 expect((await call('get','catalogs/professionals?relationship=internal')).body.items[0].id).toBe(created.body.id);
 expect((await call('patch','catalogs/professionals/'+created.body.id).send({...input,version:1})).status).toBe(409);
 expect((await call('get','catalogs/professionals?relationship=external',other)).body.items).toHaveLength(0);
});
