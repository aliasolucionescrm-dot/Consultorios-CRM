import 'dotenv/config';
import {beforeAll,afterAll,it,expect} from 'vitest';
import type {INestApplication} from '@nestjs/common';
import request from 'supertest';
import {randomUUID} from 'node:crypto';
import {createApp} from '../apps/api/src/app';
import {hashPassword} from '../apps/api/src/auth';
import {patientTransaction} from '../apps/api/src/patients';
import {query,pool} from '../packages/database/src/client';
let app:INestApplication,cookie:string,csrf:string,org:string,other:string,patient:string,branch:string,branch2:string;
const origin=process.env.APP_ORIGIN!;
function call(method:'get'|'post'|'patch',path:string,tenant=org){return request(app.getHttpServer())[method]('/api/'+path).set('Origin',origin).set('Cookie',cookie).set('X-CSRF-Token',csrf||'').set('X-Organization-Id',tenant||'');}
beforeAll(async()=>{if(!/^alia_test_[a-f0-9]{12}$/.test(process.env.TEST_DATABASE_NAME||''))throw new Error('Run npm test');app=await createApp();await app.init();const email=randomUUID()+'@alia.example',password='Operations-test-only-2026!';await query('INSERT INTO users(email,name,password_hash) VALUES($1,$2,$3) RETURNING id',[email,'Operations owner',await hashPassword(password)]);const login=await request(app.getHttpServer()).post('/api/auth/login').set('Origin',origin).send({email,password});cookie=login.headers['set-cookie'][0].split(';')[0];csrf=(await call('get','auth/me')).body.csrf;org=(await call('post','organizations').send({name:'Operations test',branch:'Principal'})).body.id;other=(await call('post','organizations').send({name:'Other test',branch:'Principal'})).body.id;branch=(await call('get','organization')).body.branches[0].id;branch2=(await call('post','branches').send({name:'Segunda',address:'',phone:'',active:true})).body.id;patient=(await call('post','patients').send({request_id:randomUUID(),first_name:'Prueba',last_name:'Operación'})).body.id;});
afterAll(async()=>{await app?.close();await pool.end();});
it('preserves referral corrections and rejects stale, foreign and invalid transitions',async()=>{
 const external=(await call('post','catalogs/professionals').send({name:'Externo',relationship:'external',branch_ids:[]})).body.id,base='patients/'+patient+'/referrals';
 const input={request_id:randomUUID(),version:0,professional_id:external,reason:'Valoración solicitada',state:'requested',notes:'Entregado al paciente'};const r=await call('post',base).send(input);expect(r.status,r.text).toBe(201);expect((await call('post',base).send(input)).body.id).toBe(r.body.id);
 expect((await call('post',base).send({request_id:randomUUID(),id:r.body.id,version:1,state:'returned',notes:'Regreso'})).status).toBe(409);
 const next={request_id:randomUUID(),id:r.body.id,version:1,state:'returned',notes:'Informe recibido',report:'Resultado transcrito por el profesional'};const concurrent=await Promise.all([call('post',base).send(next),call('post',base).send({...next,request_id:randomUUID()})]);expect(concurrent.map(r=>r.status).sort()).toEqual([201,409]);expect((await call('get',base+'/'+r.body.id+'/history')).body.items).toHaveLength(2);expect((await call('get',base,other)).status).toBe(404);expect((await call('post',base).send({...next,request_id:randomUUID(),version:2,state:'canceled'})).status).toBe(409);
 await expect(patientTransaction(org,c=>query('DELETE FROM patient_referral_versions',[],c))).rejects.toMatchObject({code:'42501'});
});
it('keeps stock separate per branch, retries once and prevents concurrent negative stock',async()=>{
 const i=await call('post','inventory').send({request_id:randomUUID(),sku:'GUANTES',name:'Guantes',unit:'caja',minimum:2});expect(i.status,i.text).toBe(201);const base='inventory/'+i.body.id+'/movements',entry={request_id:randomUUID(),branch_id:branch,quantity:10,kind:'entry',reason:'Compra'};
 expect((await call('post',base).send(entry)).status).toBe(201);expect((await call('post',base).send(entry)).status).toBe(201);
 expect((await call('get','inventory?branch_id='+branch2)).body.items[0].stock).toBe(0);expect((await call('get','inventory?branch_id='+branch)).body.items[0].stock).toBe(10);
 const result=await Promise.all([1,2].map(()=>call('post',base).send({request_id:randomUUID(),branch_id:branch,quantity:-7,kind:'exit',reason:'Consumo'})));expect(result.map(r=>r.status).sort()).toEqual([201,409]);expect((await call('get','inventory?branch_id='+branch)).body.items[0].stock).toBe(3);
 expect((await call('post',base,other).send(entry)).status).toBe(409);expect(await patientTransaction(other,c=>query('SELECT id FROM inventory_movements',[],c))).toHaveLength(0);
});
it('tracks lab request, delivery and result while preserving all versions',async()=>{
 const l=await call('post','laboratories').send({name:'Laboratorio prueba',contact:'Contacto',phone:'9991234567'});expect(l.status,l.text).toBe(201);const base='patients/'+patient+'/laboratory-orders';const r=await call('post',base).send({request_id:randomUUID(),version:0,laboratory_id:l.body.id,branch_id:branch,description:'Trabajo manual',due_date:'2030-02-01',state:'requested',notes:'Solicitud'});expect(r.status,r.text).toBe(201);
 expect((await call('post',base).send({request_id:randomUUID(),id:r.body.id,version:1,state:'received',notes:'No enviado',report:'Resultado'})).status).toBe(409);
 for(const [index,state] of ['sent','received','delivered'].entries()){const next=await call('post',base).send({request_id:randomUUID(),id:r.body.id,version:index+1,state,notes:'Seguimiento',report:state==='received'?'Trabajo revisado':''});expect(next.status,next.text).toBe(201);}
 expect((await call('get',base)).body.items[0].report).toBe('Trabajo revisado');expect((await call('get',base+'/'+r.body.id+'/history')).body.items).toHaveLength(4);expect((await call('get',base,other)).status).toBe(404);
});
it('carries net abonos, keeps excess credit, records refunds in cash and blocks duplicate over-refunds',async()=>{
 const item=randomUUID(),base='patients/'+patient;expect((await call('post',base+'/treatment-plan').send({version:0,items:[{id:item,title:'Tratamiento',tooth:'',status:'proposed',notes:''}]})).status).toBe(201);
 async function budget(version:number,total:number){return call('post',base+'/budget').send({request_id:randomUUID(),version,plan_version:1,title:'Acuerdo '+version,currency:'MXN',items:[{plan_item_id:item,quantity:1,unit_minor:total,discount_minor:0}]});}
 expect((await budget(0,10000)).status).toBe(201);const accepted=await call('post',base+'/budget/accept').send({request_id:randomUUID(),version:1,accepted_by:'Paciente',relationship:'Titular',notes:'',reviewed:true});expect(accepted.status,accepted.text).toBe(201);
 const pay=await call('post',base+'/payments').send({request_id:randomUUID(),acceptance_id:accepted.body.id,amount_minor:8000,kind:'advance',method:'cash',branch_id:branch,reference:'',notes:''});expect(pay.status,pay.text).toBe(201);
 expect((await budget(1,6000)).status).toBe(201);const acceptInput={request_id:randomUUID(),version:2,accepted_by:'Paciente',relationship:'Titular',notes:'Menos procedimientos acordados',reviewed:true};expect((await call('post',base+'/budget/accept').send(acceptInput)).status).toBe(409);expect((await call('post',base+'/budget/accept').send({...acceptInput,carry_payments:true})).status).toBe(201);
 let balance=(await call('get',base+'/payments')).body.agreement;expect(balance.paid_minor).toBe(8000);expect(balance.credit_minor).toBe(2000);expect(balance.balance_minor).toBe(0);
 const refund={request_id:randomUUID(),payment_id:pay.body.id,amount_minor:2000,method:'cash',branch_id:branch,reference:'Entrega efectivo',reason:'Devolver excedente',reviewed:true};expect((await call('post',base+'/refunds').send(refund)).status).toBe(201);expect((await call('post',base+'/refunds').send(refund)).status).toBe(201);
 balance=(await call('get',base+'/payments')).body.agreement;expect(balance.paid_minor).toBe(6000);expect(balance.credit_minor).toBe(0);expect(balance.balance_minor).toBe(0);
 expect((await call('post',base+'/payments/'+pay.body.id+'/void').send({request_id:randomUUID(),reason:'No permitido',reviewed:true})).status).toBe(409);
 const options=(await call('get','cash-closures/options')).body,preview=(await call('get','cash-closures/preview?'+new URLSearchParams({from:options.today,to:options.today,branch_id:branch}))).body.snapshot;expect(preview.schema_version).toBe(3);expect(preview.events.some((e:{type:string;amount_minor:number})=>e.type==='refund'&&e.amount_minor===-2000)).toBe(true);expect(preview.totals[0].paid_minor).toBe(2000);expect(preview.totals[0].net_minor).toBe(6000);
 const results=await Promise.all([1,2].map(()=>call('post',base+'/refunds').send({...refund,request_id:randomUUID(),amount_minor:5000})));expect(results.map(r=>r.status).sort()).toEqual([201,409]);expect((await call('get',base+'/payments')).body.agreement.balance_minor).toBe(5000);
 const filters={from:options.today,to:options.today,branch_id:branch},cutPreview=(await call('get','cash-closures/preview?'+new URLSearchParams(filters))).body;const cut=await call('post','cash-closures').send({request_id:randomUUID(),filters,token:cutPreview.token,notes:'Con devoluciones',reviewed:true});expect(cut.status).toBe(201);
 const count=await call('post','cash-closures/'+cut.body.id+'/counts').send({request_id:randomUUID(),version:0,lines:[{currency:'MXN',opening_minor:0,counted_minor:1000,adjustments:[],difference_reason:''}],notes:'',reviewed:true,professional_payments_reviewed:true});expect(count.status,count.text).toBe(201);expect((await call('get','cash-closures/'+cut.body.id+'/counts')).body.items[0].result[0].expected_minor).toBe(1000);
 expect((await call('get',base+'/refunds',other)).status).toBe(404);expect(await patientTransaction(other,c=>query('SELECT id FROM patient_refunds',[],c))).toHaveLength(0);expect((await call('get',base+'/payments/'+pay.body.id+'/receipt')).body.context.balance_after_minor).toBe(2000);
});
it('separates inventory operations, clinical access and accounting consultation',async()=>{
 for(const roleName of ['Inventario','Contabilidad','Recepción']){
  const email=randomUUID()+'@alia.example',password='Role-operations-only-2026!';const [u]=await query('INSERT INTO users(email,name,password_hash) VALUES($1,$2,$3) RETURNING id',[email,roleName,await hashPassword(password)]);const [role]=await query('SELECT id FROM roles WHERE organization_id=$1 AND name=$2',[org,roleName]);await query('INSERT INTO memberships(organization_id,user_id,role_id) VALUES($1,$2,$3)',[org,u.id,role.id]);const login=await request(app.getHttpServer()).post('/api/auth/login').set('Origin',origin).send({email,password}),session=login.headers['set-cookie'][0].split(';')[0],me=(await request(app.getHttpServer()).get('/api/auth/me').set('Cookie',session)).body;
  const get=(path:string)=>request(app.getHttpServer()).get('/api/'+path).set('Cookie',session).set('X-Organization-Id',org);
  expect((await get('inventory?branch_id='+branch)).status).toBe(roleName==='Inventario'?200:403);expect((await get('patients/'+patient+'/referrals')).status).toBe(403);expect((await get('patients/'+patient+'/laboratory-orders')).status).toBe(403);
  expect((await request(app.getHttpServer()).post('/api/patients/'+patient+'/refunds').set('Origin',origin).set('Cookie',session).set('X-CSRF-Token',me.csrf).set('X-Organization-Id',org).send({})).status).toBe(403);
 }
});
