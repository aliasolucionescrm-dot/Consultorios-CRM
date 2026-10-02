import 'dotenv/config';
import { beforeAll,afterAll,it,expect,vi } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../apps/api/src/app';
import { hashPassword } from '../apps/api/src/auth';
import { LocalPrivateStorage } from '../apps/api/src/private-storage';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,resolve,dirname,basename } from 'node:path';
import { randomBytes } from 'node:crypto';
let storageRoot:string;
import { query,pool } from '../packages/database/src/client';
let app:INestApplication,cookie:string,csrf:string,orgA:string,orgB:string,patientId:string,readerCookie:string,readerCsrf:string;
const suffix=randomUUID().slice(0,8),password='Patients-test-only-2026!',origin=process.env.APP_ORIGIN!;
function call(method:'get'|'post'|'patch',path:string,org=orgA){return request(app.getHttpServer())[method](`/api/${path}`).set('Origin',origin).set('Cookie',cookie).set('X-CSRF-Token',csrf||'').set('X-Organization-Id',org||'');}
beforeAll(async()=>{
 if(!/^alia_test_[a-f0-9]{12}$/.test(process.env.TEST_DATABASE_NAME||''))throw new Error('Run npm test');
 storageRoot=await mkdtemp(join(tmpdir(),'alia-attachment-api-'));process.env.PRIVATE_STORAGE_DIR=storageRoot;process.env.PRIVATE_STORAGE_KEY=randomBytes(32).toString('hex');
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
afterAll(async()=>{await app?.close();await pool.end();if(storageRoot&&dirname(resolve(storageRoot))===resolve(tmpdir())&&basename(storageRoot).startsWith('alia-attachment-api-'))await rm(storageRoot,{recursive:true,force:true});});

const content=Buffer.from('%PDF-1.7\nFictitious attachment test\n%%EOF');
const input=()=>({request_id:randomUUID(),filename:'Documento de prueba.pdf',media_type:'application/pdf',content_base64:content.toString('base64')});
let attachmentId:string;
it('persists encrypted attachments idempotently and serves protected downloads',async()=>{
 patientId=(await call('post','patients').send({request_id:randomUUID(),first_name:'Adjuntos',last_name:'Ficticios'})).body.id;
 const path='patients/'+patientId+'/attachments',body=input();
 const responses=await Promise.all([call('post',path).send(body),call('post',path).send(body)]);expect(responses.map(r=>r.status)).toEqual([201,201]);expect(responses[0].body).toEqual(responses[1].body);attachmentId=responses[0].body.id;
 expect((await call('post',path).send({...body,filename:'Otro.pdf'})).status).toBe(409);
 const list=await call('get',path);expect(list.body.items).toHaveLength(1);expect(list.body.items[0].byte_size).toBe(content.length);expect(list.body.items[0].sha256).toBeUndefined();
 const download=await call('get',path+'/'+attachmentId+'/content');expect(download.status).toBe(200);expect(download.body).toEqual(content);expect(download.headers['content-disposition']).toContain('attachment;');expect(download.headers['cache-control']).toBe('no-store');expect(download.headers['x-content-type-options']).toBe('nosniff');
 expect(await query('SELECT * FROM patient_attachments')).toHaveLength(0);
});
it('denies cross-tenant, wrong-patient, anonymous, read-only and CSRF access',async()=>{
 const path='patients/'+patientId+'/attachments';
 expect((await call('get',path,orgB)).status).toBe(404);expect((await call('get',path+'/'+attachmentId+'/content',orgB)).status).toBe(404);
 expect((await call('post',path,orgB).send(input())).status).toBe(404);
 expect((await call('get','patients/'+randomUUID()+'/attachments/'+attachmentId+'/content')).status).toBe(404);
 expect((await request(app.getHttpServer()).get('/api/'+path+'/'+attachmentId+'/content')).status).toBe(401);
 expect((await request(app.getHttpServer()).post('/api/'+path).set('Origin',origin).set('Cookie',readerCookie).set('X-CSRF-Token',readerCsrf).set('X-Organization-Id',orgA).send(input())).status).toBe(403);
 expect((await call('post',path).set('X-CSRF-Token','wrong').send(input())).status).toBe(403);
});
it('rejects unsafe names, signatures, base64 and sizes without publishing metadata',async()=>{
 const path='patients/'+patientId+'/attachments';
 for(const change of [{filename:'../test.pdf'},{filename:'test.html'},{media_type:'image/png'},{filename:'falso.webp',media_type:'image/webp'},{filename:'falso.webp',media_type:'image/webp',content_base64:Buffer.from('RIFFxxxxWEBPVP8 fake').toString('base64')},{content_base64:'not base64'},{content_base64:Buffer.from('<html>bad</html>').toString('base64')}])expect((await call('post',path).send({...input(),...change})).status).toBe(400);
 const large=Buffer.alloc(10*1024*1024+1,32);large.write('%PDF-');expect((await call('post',path).send({...input(),content_base64:large.toString('base64')})).status).toBe(400);
 expect((await call('post',path).send({...input(),content_base64:'A'.repeat(15*1024*1024)})).status).toBe(413);
 expect((await call('get',path)).body.items).toHaveLength(1);
});
it('accepts bodies above default JSON limits and contains storage failures',async()=>{
 const path='patients/'+patientId+'/attachments',large=Buffer.alloc(200000,32);large.write('%PDF-1.7');
 expect((await call('post',path).send({...input(),content_base64:large.toString('base64')})).status).toBe(201);
 const put=vi.spyOn(LocalPrivateStorage.prototype,'put').mockRejectedValueOnce(new Error('simulated disk failure'));
 try{expect((await call('post',path).send(input())).status).toBe(503);}finally{put.mockRestore();}
 expect((await call('get',path)).body.items).toHaveLength(2);
 const get=vi.spyOn(LocalPrivateStorage.prototype,'get').mockResolvedValueOnce(Buffer.from('corrupted'));
 try{expect((await call('get',path+'/'+attachmentId+'/content')).status).toBe(503);}finally{get.mockRestore();}
 const key=process.env.PRIVATE_STORAGE_KEY;delete process.env.PRIVATE_STORAGE_KEY;
 try{expect((await call('post',path).send(input())).status).toBe(503);}finally{process.env.PRIVATE_STORAGE_KEY=key;}
});

it('protects clinical photos and immutable annotation versions with optimistic concurrency',async()=>{
 const path='patients/'+patientId+'/attachments';
 const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXioAAAAASUVORK5CYII=','base64');
 const uploaded=await call('post',path).send({request_id:randomUUID(),filename:'Boca ficticia.png',media_type:'image/png',clinical:true,content_base64:image.toString('base64')});expect(uploaded.status).toBe(201);
 const id=uploaded.body.id,annotations='patients/'+patientId+'/photos/'+id+'/annotations';
 expect((await call('get',path)).body.items.some((r:{id:string})=>r.id===id)).toBe(false);expect((await call('get',path+'?clinical=true')).body.items[0].id).toBe(id);
 expect((await call('get',path+'/'+id)).body.clinical).toBe(true);expect((await call('get',path+'/'+id,orgB)).status).toBe(404);
 const profile=path+'/profile-photo';expect((await call('get',profile)).body.version).toBe(0);
 expect((await call('patch',profile).send({version:0,attachment_id:id})).status).toBe(400);
 const avatar=await call('post',path).send({request_id:randomUUID(),filename:'Perfil.png',media_type:'image/png',content_base64:image.toString('base64')});expect(avatar.status).toBe(201);
 expect((await call('patch',profile).send({version:0,attachment_id:avatar.body.id})).status).toBe(200);
 expect((await call('get',profile)).body.attachment_id).toBe(avatar.body.id);
 expect((await call('patch',profile,orgB).send({version:0,attachment_id:avatar.body.id})).status).toBe(404);
 expect((await call('patch',profile).send({version:0,attachment_id:null})).status).toBe(409);
 expect((await call('patch',profile).send({version:1,attachment_id:null})).status).toBe(200);expect((await call('get',profile)).body.attachment_id).toBeNull();
 const renamed=await call('patch',path+'/'+id+'/name').send({display_name:'Vista frontal'});expect(renamed.status).toBe(200);expect(renamed.body.display_name).toBe('Vista frontal');expect(renamed.body.filename).toBe('Boca ficticia.png');
 expect((await call('patch',path+'/'+id+'/name',orgB).send({display_name:'Otra'})).status).toBe(404);
 expect((await call('patch',path+'/'+id+'/name').send({display_name:' '})).status).toBe(400);
 const initial=await call('get',annotations);expect(initial.body.version).toBe(0);
 const marks=[{id:randomUUID(),kind:'arrow',x:0.2,y:0.3,x2:0.5,y2:0.6,text:'Observación ficticia',tooth:'51'}];
 const results=await Promise.all([call('post',annotations).send({version:0,marks}),call('post',annotations).send({version:0,marks})]);expect(results.map(r=>r.status)).toEqual([201,201]);expect(results.map(r=>r.body.version)).toEqual([1,1]);
 expect((await call('post',annotations).send({version:0,marks:[]})).status).toBe(409);
 expect((await call('post',annotations).send({version:1,marks:[{...marks[0],tooth:'59'}]})).status).toBe(400);
 expect((await call('post',annotations).send({version:1,marks:[{...marks[0],x:1.1}]})).status).toBe(400);
 expect((await call('post',annotations).send({version:1,marks:[]})).status).toBe(201);
 const old=await call('get',annotations+'?version=1');expect(old.body.marks[0].tooth).toBe('51');expect(old.body.latest).toBe(2);expect(old.body.history).toHaveLength(2);
 expect((await call('get',annotations,orgB)).status).toBe(404);expect(await query('SELECT * FROM photo_annotations')).toHaveLength(0);
 expect((await call('get',path+'/'+id+'/content')).body).toEqual(image);
 // Give this existing test member patient permissions only: clinical access must still be denied.
 const [readerRole]=await query("SELECT id FROM roles WHERE organization_id=$1 AND name='Solo lectura'",[orgA]);
 for(const permission of ['patients.view','patients.edit'])await query('INSERT INTO role_permissions(organization_id,role_id,permission_code) VALUES($1,$2,$3)',[orgA,readerRole.id,permission]);
 const restricted=(method:'get'|'post'|'patch',url:string)=>request(app.getHttpServer())[method]('/api/'+url).set('Origin',origin).set('Cookie',readerCookie).set('X-CSRF-Token',readerCsrf).set('X-Organization-Id',orgA);
 expect((await restricted('get',path+'/'+id)).status).toBe(403);
 expect((await restricted('get',path+'?clinical=true')).status).toBe(403);expect((await restricted('get',path+'/'+id+'/content')).status).toBe(403);expect((await restricted('get',annotations)).status).toBe(403);
 expect((await restricted('patch',path+'/'+id+'/name').send({display_name:'Prohibido'})).status).toBe(403);
 expect((await restricted('post',annotations).send({version:2,marks})).status).toBe(403);
 expect((await restricted('post',path).send({request_id:randomUUID(),filename:'Boca.png',media_type:'image/png',clinical:true,content_base64:image.toString('base64')})).status).toBe(403);
});

it('versions clinical history, preserves notes and denies administrative roles',async()=>{
 const path='patients/'+patientId+'/clinical',payload={allergy_status:'reported',allergies:'Alergia ficticia',history:'Antecedente de prueba',medications:''},requestId=randomUUID();
 expect((await call('get',path)).body.current).toBeNull();
 const body={kind:'summary',version:0,request_id:requestId,payload};const replies=await Promise.all([call('post',path).send(body),call('post',path).send(body)]);expect(replies.map(r=>r.status)).toEqual([201,201]);expect(replies[0].body.id).toBe(replies[1].body.id);
 expect((await call('post',path).send({...body,request_id:randomUUID()})).status).toBe(409);
 expect((await call('post',path).send({...body,request_id:randomUUID(),version:1,payload:{...payload,allergies:''}})).status).toBe(400);
 expect((await call('post',path).send({...body,request_id:randomUUID(),version:1,payload:{...payload,history:'Antecedente actualizado'}})).status).toBe(201);
 const n={kind:'note',request_id:randomUUID(),payload:{content:'Consulta ficticia'}};expect((await call('post',path).send(n)).status).toBe(201);expect((await call('post',path).send(n)).status).toBe(201);
 const result=await call('get',path);expect(result.body.current.version).toBe(2);expect(result.body.entries).toHaveLength(3);expect(result.body.entries.some((e:{payload:{history:string}})=>e.payload.history==='Antecedente de prueba')).toBe(true);
 expect((await call('get',path,orgB)).status).toBe(404);expect(await query('SELECT * FROM clinical_entries')).toHaveLength(0);
 for(const method of ['get','post'] as const){const req=request(app.getHttpServer())[method]('/api/'+path).set('Origin',origin).set('Cookie',readerCookie).set('X-CSRF-Token',readerCsrf).set('X-Organization-Id',orgA);expect((await(method==='post'?req.send(n):req)).status).toBe(403);}
});

it('protects and versions permanent and primary odontogram observations',async()=>{
 const path='patients/'+patientId+'/odontogram',marks=[{tooth:'11',text:'Observación permanente'},{tooth:'51',text:'Observación temporal'}];
 expect((await call('get',path)).body.version).toBe(0);const replies=await Promise.all([call('post',path).send({version:0,marks}),call('post',path).send({version:0,marks})]);expect(replies.map(r=>r.status)).toEqual([201,201]);
 expect((await call('post',path).send({version:0,marks:[]})).status).toBe(409);expect((await call('post',path).send({version:1,marks:[{tooth:'59',text:'No válida'}]})).status).toBe(400);expect((await call('post',path).send({version:1,marks:[marks[0],marks[0]]})).status).toBe(400);
 expect((await call('post',path).send({version:1,marks:[]})).status).toBe(201);const old=await call('get',path+'?version=1');expect(old.body.marks).toEqual(marks);expect(old.body.latest).toBe(2);expect((await call('get',path,orgB)).status).toBe(404);expect(await query('SELECT * FROM odontogram_versions')).toHaveLength(0);
 for(const method of ['get','post'] as const){const r=request(app.getHttpServer())[method]('/api/'+path).set('Origin',origin).set('Cookie',readerCookie).set('X-CSRF-Token',readerCsrf).set('X-Organization-Id',orgA);expect((await(method==='post'?r.send({version:2,marks}):r)).status).toBe(403);}
});

it('keeps surface observations distinct and validates photo references',async()=>{
 const path='patients/'+patientId+'/odontogram',before=(await call('get',path)).body.version;
 const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXioAAAAASUVORK5CYII=','base64');
 const photo=await call('post','patients/'+patientId+'/attachments').send({request_id:randomUUID(),filename:'Superficie.png',clinical:true,media_type:'image/png',content_base64:image.toString('base64')});expect(photo.status).toBe(201);
 const marks=[{tooth:'11',surface:'mesial',text:'Mesial',photo_id:photo.body.id},{tooth:'11',surface:'distal',text:'Distal'}];expect((await call('post',path).send({version:before,marks})).status).toBe(201);expect((await call('get',path)).body.marks).toEqual(marks);
 expect((await call('post',path).send({version:before+1,marks:[{...marks[0],photo_id:randomUUID()}]})).status).toBe(400);
 expect((await call('post',path).send({version:before+1,marks:[{tooth:'11',text:'A'},{tooth:'11',surface:'whole',text:'B'}]})).status).toBe(400);
});

it('versions treatment plans and protects clinical access',async()=>{
 const path='patients/'+patientId+'/treatment-plan',items=[{id:randomUUID(),tooth:'11',title:'Procedimiento ficticio',status:'proposed',notes:'Nota de prueba'}];expect((await call('get',path)).body.version).toBe(0);
 const result=await Promise.all([call('post',path).send({version:0,items}),call('post',path).send({version:0,items})]);expect(result.map(r=>r.status)).toEqual([201,201]);
 expect((await call('post',path).send({version:0,items:[]})).status).toBe(409);expect((await call('post',path).send({version:1,items:[items[0],items[0]]})).status).toBe(400);expect((await call('post',path).send({version:1,items:[{...items[0],tooth:'59'}]})).status).toBe(400);
 expect((await call('post',path).send({version:1,items:[{...items[0],status:'completed'}]})).status).toBe(201);const old=await call('get',path+'?version=1');expect(old.body.items[0].status).toBe('proposed');expect(old.body.latest).toBe(2);
 expect((await call('get',path,orgB)).status).toBe(404);expect(await query('SELECT * FROM treatment_plan_versions')).toHaveLength(0);
 for(const method of ['get','post'] as const){const r=request(app.getHttpServer())[method]('/api/'+path).set('Origin',origin).set('Cookie',readerCookie).set('X-CSRF-Token',readerCsrf).set('X-Organization-Id',orgA);expect((await(method==='post'?r.send({version:2,items}):r)).status).toBe(403);}
});

it('links active services and keeps their historical name',async()=>{
 const serviceFields={name:'Servicio para plan',code:'PLAN_'+randomUUID().slice(0,8).toUpperCase(),category:'Otros',duration_minutes:30,price_minor:0,currency:'MXN',requires_tooth:true};const service=await call('post','catalogs/services').send(serviceFields);expect(service.status).toBe(201);
 const path='patients/'+patientId+'/treatment-plan',version=(await call('get',path)).body.version,item={id:randomUUID(),service_id:service.body.id,service_name:'Servicio para plan',service_requires_tooth:true,title:'Procedimiento',tooth:'11',status:'proposed',notes:''};
 expect((await call('get',path+'/services?q=Servicio%20para%20plan')).body.items.some((s:{id:string})=>s.id===service.body.id)).toBe(true);
 expect((await call('post',path).send({version,items:[{...item,tooth:''}]})).status).toBe(400);
 expect((await call('post',path).send({version,items:[{...item,service_id:randomUUID()}]})).status).toBe(400);
 expect((await call('post',path).send({version,items:[item]})).status).toBe(201);
 expect((await call('post',path).send({version:version+1,items:[{...item,service_name:'Nombre alterado'}]})).status).toBe(400);
 expect((await call('patch','catalogs/services/'+service.body.id).send({...serviceFields,version:1,name:'Servicio renombrado',active:false,reason:'Prueba de historial'})).status).toBe(200);
 expect((await call('get',path+'/services?q=Servicio%20renombrado')).body.items).toEqual([]);
 expect((await call('post',path).send({version:version+1,items:[{...item,status:'completed'}]})).status).toBe(201);
 expect((await call('get',path)).body.items[0].service_name).toBe('Servicio para plan');
 expect((await call('post',path).send({version:version+2,items:[{...item,id:randomUUID()}]})).status).toBe(400);
});

it('preserves budget totals, source snapshots, permissions and concurrent retries',async()=>{
 const planPath='patients/'+patientId+'/treatment-plan',planVersion=(await call('get',planPath)).body.version+1;
 const item={id:randomUUID(),title:'Procedimiento presupuestable',tooth:'11',status:'proposed',notes:''};
 expect((await call('post',planPath).send({version:planVersion-1,items:[item]})).status).toBe(201);
 const path='patients/'+patientId+'/budget',source=await call('get',path+'/source');expect(source.status).toBe(200);expect(source.body.items[0].unit_minor).toBeNull();
 const body={request_id:randomUUID(),version:0,plan_version:planVersion,currency:'MXN',title:'Plan inicial',items:[{plan_item_id:item.id,quantity:3,unit_minor:10001,discount_minor:2}]};
 expect((await call('post',path).send({...body,items:[{...body.items[0],discount_minor:40000}]})).status).toBe(400);
 expect((await call('post',path).send({...body,items:[{...body.items[0],unit_minor:1.25}]})).status).toBe(400);
 expect((await call('post',path).send({...body,items:[{...body.items[0],plan_item_id:randomUUID()}]})).status).toBe(400);
 expect((await call('post',path).send({...body,currency:'USD'})).status).toBe(409);
 const saved=await Promise.all([call('post',path).send(body),call('post',path).send(body)]);expect(saved.map(r=>r.status)).toEqual([201,201]);expect(saved[0].body).toEqual(saved[1].body);
 expect((await call('get',path)).body.budget.total_minor).toBe(30001);
 expect((await call('post',path).send({...body,title:'Alterado'})).status).toBe(409);
 expect((await call('post',path).send({...body,request_id:randomUUID()})).status).toBe(409);
 expect((await call('post',path).send({...body,version:1,request_id:randomUUID(),items:[{...body.items[0],unit_minor:20000}]})).status).toBe(201);
 expect((await call('get',path+'?version=1')).body.budget.total_minor).toBe(30001);
 expect((await call('post',planPath).send({version:planVersion,items:[{...item,title:'Título cambiado'}]})).status).toBe(201);
 expect((await call('get',path)).body.budget.items[0].title).toBe(item.title);
 expect((await call('get',path,orgB)).status).toBe(404);expect(await query('SELECT * FROM patient_budget_versions')).toHaveLength(0);
 for(const suffix of ['', '/source'])expect((await request(app.getHttpServer()).get('/api/'+path+suffix).set('Cookie',readerCookie).set('X-Organization-Id',orgA)).status).toBe(403);
 expect((await request(app.getHttpServer()).post('/api/'+path).set('Origin',origin).set('Cookie',readerCookie).set('X-CSRF-Token',readerCsrf).set('X-Organization-Id',orgA).send(body)).status).toBe(403);
});

it('versions clinical categories and separate mouth and tooth diagnoses',async()=>{
 const path='patients/'+patientId+'/clinical',prior=(await call('get',path)).body.current;
 const payload={...prior.payload,conditions:{systemic:{status:'reported',detail:'Condición ficticia'},dietary:{status:'none_reported',detail:''}}};
 expect((await call('post',path).send({kind:'summary',version:prior.version,request_id:randomUUID(),payload:{...payload,conditions:{systemic:{status:'reported',detail:''}}}})).status).toBe(400);
 expect((await call('post',path).send({kind:'summary',version:prior.version,request_id:randomUUID(),payload})).status).toBe(201);
 expect((await call('get',path)).body.current.payload.conditions).toEqual(payload.conditions);
 const odonto='patients/'+patientId+'/odontogram',version=(await call('get',odonto)).body.version;
 const body={version,diagnosis:'Diagnóstico general ficticio',marks:[{tooth:'11',surface:'mesial',text:'',diagnosis:'Diagnóstico por superficie'}]};
 const results=await Promise.all([call('post',odonto).send(body),call('post',odonto).send(body)]);expect(results.map(r=>r.status)).toEqual([201,201]);
 expect((await call('get',odonto)).body.diagnosis).toBe(body.diagnosis);expect((await call('get',odonto+'?version='+version)).body.diagnosis).toBe('');
 expect((await call('post',odonto).send({...body,diagnosis:'Distinto'})).status).toBe(409);
 expect((await call('post',odonto).send({...body,version:version+1,marks:[{tooth:'11',text:'',diagnosis:''}]})).status).toBe(400);
});
it('links notes only to the patient appointments and preserves the appointment snapshot',async()=>{
 const branch=(await call('get','organization')).body.branches[0].id;
 const professional=(await call('post','catalogs/professionals').send({name:'Doctor notas',branch_ids:[branch]})).body.id;
 const room=(await call('post','catalogs/rooms').send({name:'Consultorio notas',branch_id:branch})).body.id;
 const service=(await call('post','catalogs/services').send({name:'Consulta notas',code:'NOTES',category:'Diagnóstico',duration_minutes:30,price_minor:0,currency:'MXN'})).body.id;
 const booking={branch_id:branch,patient_id:patientId,professional_id:professional,room_id:room,service_id:service,start_local:'2030-01-15T09:00',duration_minutes:30};
 const appointment=await call('post','appointments').send({...booking,request_id:randomUUID()});expect(appointment.status).toBe(201);
 const path='patients/'+patientId+'/clinical',list=await call('get',path+'/appointments');expect(list.body.items[0].id).toBe(appointment.body.id);
 const body={kind:'note',request_id:randomUUID(),payload:{appointment_id:appointment.body.id,content:'Nota vinculada'}};
 expect((await call('post',path).send(body)).status).toBe(201);
 expect((await call('patch','appointments/'+appointment.body.id).send({...booking,start_local:'2030-01-15T10:00',version:1,reason:'Prueba reprogramación'})).status).toBe(200);
 expect((await call('post',path).send(body)).status).toBe(201);
 const saved=(await call('get',path)).body.entries.find((e:{request_id:string})=>e.request_id===body.request_id);expect(saved.payload.appointment.starts_at).toBe(list.body.items[0].starts_at);
 const otherPatient=(await call('post','patients').send({request_id:randomUUID(),first_name:'Otro',last_name:'Paciente'})).body.id;
 expect((await call('post','patients/'+otherPatient+'/clinical').send({...body,request_id:randomUUID()})).status).toBe(400);
 expect((await call('get',path+'/appointments',orgB)).status).toBe(404);
 expect((await request(app.getHttpServer()).get('/api/'+path+'/appointments').set('Cookie',readerCookie).set('X-Organization-Id',orgA)).status).toBe(403);
});

it('versions prescription drafts with snapshots and clinical access',async()=>{
 const professional=await call('post','catalogs/professionals').send({name:'Doctor recetas',relationship:'external',branch_ids:[],license:'DRAFT-TEST'});expect(professional.status).toBe(201);
 const path='patients/'+patientId+'/prescription-drafts',body={id:randomUUID(),request_id:randomUUID(),version:0,data:{professional_id:professional.body.id,title:'Borrador ficticio',medications:[{name:'Medicamento ficticio',presentation:'',dose:'',route:'',frequency:'',duration:'',instructions:''}],notes:''}};
 expect((await call('get',path+'/professionals?q=Doctor%20recetas')).body.items[0].id).toBe(professional.body.id);
 const results=await Promise.all([call('post',path).send(body),call('post',path).send(body)]);expect(results.map(r=>r.status)).toEqual([201,201]);
 expect((await call('patch','catalogs/professionals/'+professional.body.id).send({name:'Doctor renombrado',relationship:'external',branch_ids:[],version:1})).status).toBe(200);
 const saved=(await call('get',path)).body.items[0];expect(saved.snapshot.professional.name).toBe('Doctor recetas');expect(saved.snapshot.patient.first_name).toBeTruthy();
 expect((await call('post',path).send(body)).status).toBe(201);
 expect((await call('post',path).send({...body,request_id:randomUUID()})).status).toBe(409);
 expect((await call('post',path).send({...body,request_id:randomUUID(),version:1,data:{...body.data,professional_id:randomUUID()}})).status).toBe(400);
 expect((await call('post',path).send({...body,request_id:randomUUID(),version:1})).status).toBe(201);
 expect((await call('get',path)).body.items.map((r:{version:number})=>r.version)).toEqual([2,1]);
 expect((await call('get',path,orgB)).status).toBe(404);expect(await query('SELECT * FROM prescription_drafts')).toHaveLength(0);
 expect((await request(app.getHttpServer()).get('/api/'+path).set('Cookie',readerCookie).set('X-Organization-Id',orgA)).status).toBe(403);
 expect((await call('post',path).send({...body,id:randomUUID(),request_id:randomUUID(),data:{...body.data,medications:[]}})).status).toBe(400);
});

it('checks prescription preparation fields and freezes the reviewed version idempotently',async()=>{
 const professional=(await call('post','catalogs/professionals').send({name:'Doctor preparación',relationship:'external',branch_ids:[],license:'PREP-TEST',practice_address:'Dirección ficticia',professional_title:'Título ficticio',training_institution:'Institución ficticia'})).body;
 const path='patients/'+patientId+'/prescription-drafts',id=randomUUID(),med={name:'Fármaco ficticio <script>',presentation:'Prueba',dose:'Texto de prueba',route:'Prueba',frequency:'Prueba',duration:'Prueba',instructions:'Sin uso clínico'},data={professional_id:professional.id,title:'Prueba de preparación',medications:[{...med,dose:''}],notes:''};
 expect((await call('post',path).send({id,request_id:randomUUID(),version:0,data})).status).toBe(201);
 expect((await call('get',path+'/'+id+'/1/review')).body.missing).toContain('Medicamento 1: dosis');
 expect((await call('post',path+'/'+id+'/prepare').send({version:1,reviewed:true})).status).toBe(400);
 expect((await call('post',path).send({id,request_id:randomUUID(),version:1,data:{...data,medications:[med]}})).status).toBe(201);
 expect((await call('post',path+'/'+id+'/prepare').send({version:1,reviewed:true})).status).toBe(409);
 expect((await call('post',path+'/'+id+'/prepare').send({version:2,reviewed:false})).status).toBe(400);
 const results=await Promise.all([call('post',path+'/'+id+'/prepare').send({version:2,reviewed:true}),call('post',path+'/'+id+'/prepare').send({version:2,reviewed:true})]);expect(results.map(r=>r.status)).toEqual([201,201]);expect(results[0].body.id).toBe(results[1].body.id);
 expect((await call('post',path).send({id,request_id:randomUUID(),version:2,data})).status).toBe(409);
 const review=await call('get',path+'/'+id+'/2/review');expect(review.body.prepared.id).toBe(results[0].body.id);expect(review.body.row.input.medications[0].name).toBe(med.name);
 expect((await call('get',path+'/'+id+'/2/review',orgB)).status).toBe(404);expect(await query('SELECT * FROM prescription_preparations')).toHaveLength(0);
 expect((await request(app.getHttpServer()).post('/api/'+path+'/'+id+'/prepare').set('Cookie',readerCookie).set('Origin',origin).set('X-CSRF-Token',readerCsrf).set('X-Organization-Id',orgA).send({version:2,reviewed:true})).status).toBe(403);
});

it('versions consent templates and preserves patient consent snapshots with isolated references',async()=>{
 const templateId=randomUUID(),templateData={title:'Consentimiento de prueba',category:'extraction',status:'available',content:'Texto ficticio para comprobar el historial. No utilizar clínicamente.'};
 expect((await call('post','consent-templates').send({id:templateId,version:0,data:templateData})).status).toBe(400);
 const savedTemplate=await call('post','consent-templates').send({id:templateId,version:0,data:templateData,reviewed:true});expect(savedTemplate.status).toBe(201);
 const planPath='patients/'+patientId+'/treatment-plan',version=(await call('get',planPath)).body.version,item={id:randomUUID(),title:'Extracción ficticia',tooth:'11',status:'proposed',notes:''};
 expect((await call('post',planPath).send({version,items:[item]})).status).toBe(201);
 const doctor=(await call('post','catalogs/professionals').send({name:'Doctor consentimiento',relationship:'external',branch_ids:[]})).body;
 const path='patients/'+patientId+'/consents',body={request_id:randomUUID(),template_id:templateId,template_version:1,plan_version:version+1,plan_item_id:item.id,professional_id:doctor.id,notes:'Prueba'};
 expect((await call('get',path+'/options?template_q=Consentimiento')).body.templates[0].id).toBe(templateId);
 expect((await call('post',path).send({...body,plan_item_id:randomUUID()})).status).toBe(400);
 expect((await call('post',path).send({...body,professional_id:randomUUID()})).status).toBe(400);
 const results=await Promise.all([call('post',path).send(body),call('post',path).send(body)]);expect(results.map(r=>r.status)).toEqual([201,201]);expect(results[0].body.id).toBe(results[1].body.id);
 expect((await call('post',path).send({...body,notes:'Cambio'})).status).toBe(409);
 expect((await call('post','consent-templates').send({id:templateId,version:1,data:{...templateData,status:'retired',content:'Texto retirado y cambiado para prueba de historial.'}})).status).toBe(201);
 expect((await call('get',path+'/options')).body.templates).toHaveLength(0);
 expect((await call('post',path).send({...body,request_id:randomUUID()})).status).toBe(409);
 expect((await call('post',path).send(body)).status).toBe(201);
 expect((await call('get',path)).body.items[0].snapshot.template.content).toBe(templateData.content);
 expect((await call('get','consent-templates?id='+templateId)).body.items.map((t:{version:number})=>t.version)).toEqual([2,1]);
 expect((await call('get',path,orgB)).status).toBe(404);expect((await call('get','consent-templates',orgB)).body.items).toHaveLength(0);
 expect(await query('SELECT * FROM patient_consents')).toHaveLength(0);expect(await query('SELECT * FROM consent_template_versions')).toHaveLength(0);
 expect((await request(app.getHttpServer()).get('/api/'+path).set('Cookie',readerCookie).set('X-Organization-Id',orgA)).status).toBe(403);
});
it('records consent decisions idempotently with private evidence and terminal history',async()=>{
 const consent=(await call('get','patients/'+patientId+'/consents')).body.items[0];
 const path='patients/'+patientId+'/consents/'+consent.id;
 expect((await call('get',path)).body.status).toBe('pending');
 const body={request_id:randomUUID(),version:0,status:'accepted',reason:'Constancia ficticia',signer_name:'Paciente ficticio',signer_relationship:'El propio paciente',occurred_on:'2026-01-01'};
 expect((await call('post',path+'/events').send(body)).status).toBe(400);
 const evidence={filename:'firmado.pdf',media_type:'application/pdf',content_base64:content.toString('base64')};
 expect((await call('post',path+'/events').send({...body,evidence:{...evidence,content_base64:Buffer.from('not a pdf').toString('base64')}})).status).toBe(400);
 expect((await call('post',path+'/events').send({...body,occurred_on:'2099-01-01',evidence})).status).toBe(400);
 const results=await Promise.all([call('post',path+'/events').send({...body,evidence}),call('post',path+'/events').send({...body,evidence})]);
 expect(results.map(r=>r.status)).toEqual([201,201]);expect(results[0].body.id).toBe(results[1].body.id);
 const detail=(await call('get',path)).body;expect(detail.status).toBe('accepted');expect(detail.events).toHaveLength(1);expect(detail.events[0].evidence).toEqual({filename:'firmado.pdf',media_type:'application/pdf'});
 const downloadPath=path+'/events/'+results[0].body.id+'/evidence';expect((await call('get',downloadPath)).body).toEqual(content);
 expect((await call('get',downloadPath,orgB)).status).toBe(404);expect((await call('get','patients/'+randomUUID()+'/consents/'+consent.id)).status).toBe(404);
 expect((await request(app.getHttpServer()).get('/api/'+downloadPath).set('Cookie',readerCookie).set('X-Organization-Id',orgA)).status).toBe(403);
 expect((await request(app.getHttpServer()).post('/api/'+path+'/events').set('Origin',origin).set('Cookie',readerCookie).set('X-CSRF-Token',readerCsrf).set('X-Organization-Id',orgA).send(body)).status).toBe(403);
 expect((await call('post',path+'/events').send({...body,evidence,reason:'Otro'})).status).toBe(409);
 expect((await call('post',path+'/events').send({...body,request_id:randomUUID(),status:'voided'})).status).toBe(409);
 expect((await call('post',path+'/events').send({...body,request_id:randomUUID(),version:1,status:'rejected'})).status).toBe(409);
 expect((await call('post',path+'/events').send({...body,request_id:randomUUID(),version:1,status:'voided'})).status).toBe(201);
 expect((await call('post',path+'/events').send({...body,request_id:randomUUID(),version:2,status:'voided'})).status).toBe(409);
 expect((await call('post',path+'/events').send({...body,evidence})).body.id).toBe(results[0].body.id);
 expect((await call('get',path)).body.events.map((e:{status:string})=>e.status)).toEqual(['voided','accepted']);
 expect((await call('get',downloadPath)).body).toEqual(content);expect(await query('SELECT * FROM consent_events')).toHaveLength(0);
});
it('handles rejection, large evidence and upload limits without sharing clinical files',async()=>{
 const prior=(await call('get','patients/'+patientId+'/consents')).body.items[0];
 const template=(await call('get','consent-templates?id='+prior.template_id)).body.items[0];
 expect((await call('post','consent-templates').send({id:template.id,version:template.version,reviewed:true,data:{title:template.title,category:template.category,content:template.content,status:'available'}})).status).toBe(201);
 const create=async()=>{const result=await call('post','patients/'+patientId+'/consents').send({request_id:randomUUID(),template_id:template.id,template_version:template.version+1,plan_version:prior.plan_version,plan_item_id:prior.plan_item_id,professional_id:prior.professional_id,notes:''});expect(result.status).toBe(201);return 'patients/'+patientId+'/consents/'+result.body.id;};
 const rejectedPath=await create(),body={request_id:randomUUID(),version:0,status:'rejected',reason:'Paciente declina, prueba ficticia',occurred_on:'2026-01-01'};
 expect((await call('post',rejectedPath+'/events').send(body)).status).toBe(201);expect((await call('get',rejectedPath)).body.status).toBe('rejected');
 const largePath=await create(),large=Buffer.alloc(1024*1024,32);content.copy(large);
 const evidence={filename:'evidencia.pdf',media_type:'application/pdf',content_base64:large.toString('base64')},accepted={...body,request_id:randomUUID(),status:'accepted',signer_name:'Ficticio',signer_relationship:'Paciente',evidence};
 const oversized=Buffer.alloc(5*1024*1024+1,32);content.copy(oversized);
 expect((await call('post',largePath+'/events').send({...accepted,evidence:{...evidence,content_base64:oversized.toString('base64')}})).status).toBe(400);
 const saved=await call('post',largePath+'/events').send(accepted);expect(saved.status).toBe(201);
 expect((await call('get',largePath+'/events/'+saved.body.id+'/evidence')).body).toEqual(large);
});

it('preserves accepted budget snapshots while later proposals await their own acceptance',async()=>{
 const path='patients/'+patientId+'/budget',current=(await call('get',path)).body.budget,body={version:current.version,request_id:randomUUID(),accepted_by:'Paciente ficticio',relationship:'El propio paciente',notes:'Acuerdo de prueba',reviewed:true};
 expect((await call('post',path+'/accept').send({...body,reviewed:false})).status).toBe(400);
 expect((await call('post',path+'/accept').send({...body,version:current.version-1})).status).toBe(409);
 const results=await Promise.all([call('post',path+'/accept').send(body),call('post',path+'/accept').send(body)]);expect(results.map(r=>r.status)).toEqual([201,201]);expect(results[0].body.id).toBe(results[1].body.id);
 expect((await call('post',path+'/accept').send({...body,accepted_by:'Otro'})).status).toBe(409);
 expect((await call('post',path+'/accept').send({...body,request_id:randomUUID()})).status).toBe(409);
 const original=(await call('get',path+'/'+current.version+'/document')).body;expect(original.acceptance.id).toBe(results[0].body.id);expect(original.snapshot.budget.total_minor).toBe(current.total_minor);
 const next={request_id:randomUUID(),version:current.version,plan_version:current.plan_version,title:'Nueva propuesta',currency:current.currency,items:current.items.map((i:{plan_item_id:string;quantity:number;unit_minor:number;discount_minor:number})=>({plan_item_id:i.plan_item_id,quantity:i.quantity,unit_minor:i.unit_minor+100,discount_minor:i.discount_minor}))};
 expect((await call('post',path).send(next)).status).toBe(201);expect((await call('get',path)).body.accepted_version).toBe(current.version);
 const proposed=(await call('get',path+'/'+(current.version+1)+'/document')).body;expect(proposed.acceptance).toBeNull();expect(proposed.current_accepted_version).toBe(current.version);
 expect((await call('post',path+'/accept').send({...body,request_id:randomUUID(),version:current.version+1})).status).toBe(201);
 const historical=(await call('get',path+'/'+current.version+'/document')).body;expect(historical.snapshot).toEqual(original.snapshot);expect(historical.current_accepted_version).toBe(current.version+1);
 expect((await call('post',path+'/accept').send(body)).body.id).toBe(results[0].body.id);
 expect((await call('get',path+'/'+current.version+'/document',orgB)).status).toBe(404);
 expect((await call('get','patients/'+randomUUID()+'/budget/'+current.version+'/document')).status).toBe(404);
 for(const method of ['get','post'] as const){const endpoint=method==='get'?path+'/'+current.version+'/document':path+'/accept';expect((await request(app.getHttpServer())[method]('/api/'+endpoint).set('Origin',origin).set('Cookie',readerCookie).set('X-CSRF-Token',readerCsrf).set('X-Organization-Id',orgA).send(method==='post'?body:undefined)).status).toBe(403);}
 expect(await query('SELECT * FROM budget_acceptances')).toHaveLength(0);
});
it('records payments once, prevents concurrent overpayments and preserves corrections',async()=>{
 const path='patients/'+patientId+'/payments',budgetPath='patients/'+patientId+'/budget',initial=(await call('get',path)).body;
 expect(initial.agreement.paid_minor).toBe(0);const a=initial.agreement;
 const body={request_id:randomUUID(),acceptance_id:a.id,amount_minor:10001,kind:'advance',method:'cash',branch_id:initial.branches[0].id,reference:'Prueba',notes:''};
 expect((await call('post',path).send({...body,amount_minor:0})).status).toBe(400);
 expect((await call('post',path).send({...body,amount_minor:1.5})).status).toBe(400);
 expect((await call('post',path).send({...body,branch_id:randomUUID()})).status).toBe(400);
 expect((await call('post',path).send({...body,acceptance_id:randomUUID()})).status).toBe(409);
 const result=await Promise.all([call('post',path).send(body),call('post',path).send(body)]);expect(result.map(r=>r.status)).toEqual([201,201]);expect(result[0].body.id).toBe(result[1].body.id);
 expect((await call('post',path).send({...body,amount_minor:123})).status).toBe(409);
 expect((await call('get',path)).body.agreement.balance_minor).toBe(a.total_minor-10001);
 const current=(await call('get',budgetPath)).body.budget;
 const proposed={request_id:randomUUID(),version:current.version,plan_version:current.plan_version,title:'Propuesta con pagos',currency:current.currency,items:current.items.map((i:{plan_item_id:string;quantity:number;unit_minor:number;discount_minor:number})=>({plan_item_id:i.plan_item_id,quantity:i.quantity,unit_minor:i.unit_minor+1,discount_minor:i.discount_minor}))};
 expect((await call('post',budgetPath).send(proposed)).status).toBe(201);
 expect((await call('post',budgetPath+'/accept').send({request_id:randomUUID(),version:current.version+1,accepted_by:'Prueba',relationship:'Paciente',notes:'',reviewed:true})).status).toBe(409);
 expect((await call('get',budgetPath+'/'+(current.version+1)+'/document')).body.has_patient_payments).toBe(true);
 expect((await call('post',path).send({...body,request_id:randomUUID(),kind:'settlement',amount_minor:1})).status).toBe(400);
 const remaining=a.total_minor-10001;
 const racing=await Promise.all([call('post',path).send({...body,request_id:randomUUID(),kind:'settlement',amount_minor:remaining}),call('post',path).send({...body,request_id:randomUUID(),kind:'settlement',amount_minor:remaining})]);expect(racing.map(r=>r.status).sort()).toEqual([201,409]);
 expect((await call('get',path)).body.agreement.balance_minor).toBe(0);
 const voidPath=path+'/'+result[0].body.id+'/void',v={request_id:randomUUID(),reason:'Captura duplicada ficticia',reviewed:true};
 expect((await call('post',voidPath).send({...v,reviewed:false})).status).toBe(400);
 const voids=await Promise.all([call('post',voidPath).send(v),call('post',voidPath).send(v)]);expect(voids.map(r=>r.status)).toEqual([201,201]);expect(voids[0].body.id).toBe(voids[1].body.id);
 expect((await call('post',voidPath).send({...v,request_id:randomUUID()})).status).toBe(409);
 const corrected=(await call('get',path)).body;expect(corrected.agreement.balance_minor).toBe(10001);expect(corrected.items.find((p:{id:string})=>p.id===result[0].body.id).void_reason).toBe(v.reason);
 expect((await call('post',path).send(body)).body.id).toBe(result[0].body.id);expect((await call('get',path)).body.agreement.balance_minor).toBe(10001);
 expect((await call('get',path,orgB)).status).toBe(404);expect((await call('post',path,orgB).send({...body,request_id:randomUUID()})).status).toBe(404);expect((await call('post','patients/'+randomUUID()+'/payments/'+result[0].body.id+'/void').send(v)).status).toBe(404);
 for(const [method,url,payload] of [['get',path,null],['post',path,body],['post',voidPath,v]] as const)expect((await request(app.getHttpServer())[method]('/api/'+url).set('Origin',origin).set('Cookie',readerCookie).set('X-CSRF-Token',readerCsrf).set('X-Organization-Id',orgA).send(payload||undefined)).status).toBe(403);
 expect(await query('SELECT * FROM patient_payments')).toHaveLength(0);expect(await query('SELECT * FROM payment_voids')).toHaveLength(0);
});
it('separates cashier recording, accounting consultation and privileged corrections',async()=>{
 const [member]=await query('SELECT m.user_id,m.role_id FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.organization_id=$1 AND u.email=$2',[orgA,`patient-reader-${suffix}@alia.example`]);
 const [cash]=await query("SELECT id FROM roles WHERE organization_id=$1 AND name='Caja'",[orgA]),[accounting]=await query("SELECT id FROM roles WHERE organization_id=$1 AND name='Contabilidad'",[orgA]);
 const path='patients/'+patientId+'/payments';
 const asReader=(method:'get'|'post',url:string)=>request(app.getHttpServer())[method]('/api/'+url).set('Origin',origin).set('Cookie',readerCookie).set('X-CSRF-Token',readerCsrf).set('X-Organization-Id',orgA);
 try{
  await query('UPDATE memberships SET role_id=$1 WHERE organization_id=$2 AND user_id=$3',[cash.id,orgA,member.user_id]);
  const result=await asReader('get',path);expect(result.status).toBe(200);expect((await asReader('get','patients/'+patientId)).status).toBe(200);expect((await asReader('get','patients/'+patientId+'/clinical')).status).toBe(403);
  const body={request_id:randomUUID(),acceptance_id:result.body.agreement.id,amount_minor:1,kind:'installment',method:'cash',branch_id:result.body.branches[0].id,reference:'',notes:''};
  const payment=await asReader('post',path).send(body);expect(payment.status).toBe(201);
  expect((await asReader('post',path+'/'+payment.body.id+'/void').send({request_id:randomUUID(),reason:'Prueba',reviewed:true})).status).toBe(403);
  await query('UPDATE memberships SET role_id=$1 WHERE organization_id=$2 AND user_id=$3',[accounting.id,orgA,member.user_id]);
  expect((await asReader('get',path)).status).toBe(200);expect((await asReader('post',path).send({...body,request_id:randomUUID()})).status).toBe(403);
  expect((await request(app.getHttpServer()).post('/api/'+path).set('Origin',origin).set('Cookie',cookie).set('X-Organization-Id',orgA).send(body)).status).toBe(403);
 }finally{await query('UPDATE memberships SET role_id=$1 WHERE organization_id=$2 AND user_id=$3',[member.role_id,orgA,member.user_id]);}
});
it('serves protected receipts with historical balances and live cancellation status',async()=>{
 const base='patients/'+patientId+'/payments',list=(await call('get',base)).body,active=list.items.find((p:{voided_at:string|null})=>!p.voided_at),path=base+'/'+active.id+'/receipt';
 const original=await call('get',path);expect(original.status).toBe(200);expect(original.body.legacy).toBe(false);expect(original.body.context.balance_after_minor).toBe(list.agreement.balance_minor);expect(original.body.notes).toBeUndefined();expect(original.body.request_hash).toBeUndefined();
 const extra=await call('post',base).send({request_id:randomUUID(),acceptance_id:list.agreement.id,amount_minor:1,kind:'installment',method:'cash',branch_id:list.branches[0].id,reference:'Recibo adicional',notes:'Nota interna que no va en el recibo'});expect(extra.status).toBe(201);
 expect((await call('get',path)).body.context).toEqual(original.body.context);
 expect((await call('post',base+'/'+active.id+'/void').send({request_id:randomUUID(),reason:'Anulación ficticia del recibo',reviewed:true})).status).toBe(201);
 const voided=(await call('get',path)).body;expect(voided.void_reason).toBe('Anulación ficticia del recibo');expect(voided.voided_at).toBeTruthy();expect(voided.context).toEqual(original.body.context);
 expect((await call('get',path,orgB)).status).toBe(404);expect((await call('get','patients/'+randomUUID()+'/payments/'+active.id+'/receipt')).status).toBe(404);
 expect((await request(app.getHttpServer()).get('/api/'+path).set('Cookie',readerCookie).set('X-Organization-Id',orgA)).status).toBe(403);
});
it('saves cash reports by event date with immutable totals and stale-preview protection',async()=>{
 const options=(await call('get','cash-closures/options')).body,branch=options.branches[0].id;
 const filters={from:options.today,to:options.today,branch_id:branch},url='cash-closures/preview?'+new URLSearchParams(filters);
 const preview=await call('get',url);expect(preview.status).toBe(200);expect(preview.body.snapshot.events.length).toBeGreaterThan(0);
 const expected=preview.body.snapshot.events.reduce((sum:number,e:{amount_minor:number})=>sum+e.amount_minor,0);expect(preview.body.snapshot.totals.reduce((sum:number,t:{net_minor:number})=>sum+t.net_minor,0)).toBe(expected);
 const body={request_id:randomUUID(),filters,token:preview.body.token,notes:'Corte ficticio',reviewed:true};
 expect((await call('post','cash-closures').send({...body,reviewed:false})).status).toBe(400);
 const saved=await Promise.all([call('post','cash-closures').send(body),call('post','cash-closures').send(body)]);expect(saved.map(r=>r.status)).toEqual([201,201]);expect(saved[0].body.id).toBe(saved[1].body.id);
 expect((await call('post','cash-closures').send({...body,notes:'Otra nota'})).status).toBe(409);
 const data=(await call('get','patients/'+patientId+'/payments')).body;
 const payment=await call('post','patients/'+patientId+'/payments').send({request_id:randomUUID(),acceptance_id:data.agreement.id,amount_minor:1,kind:'installment',method:'transfer',branch_id:branch,reference:'Corte prueba',notes:''});expect(payment.status).toBe(201);
 expect((await call('post','cash-closures').send({...body,request_id:randomUUID()})).status).toBe(409);
 const detail=(await call('get','cash-closures/'+saved[0].body.id)).body;expect(detail.snapshot).toEqual(preview.body.snapshot);
 expect((await call('get',url)).body.snapshot.events.length).toBe(preview.body.snapshot.events.length+1);
 expect((await call('post','cash-closures').send(body)).body.id).toBe(saved[0].body.id);
 expect((await call('get','cash-closures/'+saved[0].body.id,orgB)).status).toBe(404);
 expect((await call('get','cash-closures/preview?'+new URLSearchParams({...filters,branch_id:randomUUID()}))).status).toBe(400);
 expect((await call('get','cash-closures/preview?'+new URLSearchParams({...filters,from:'2020-01-01'}))).status).toBe(400);
 expect((await call('get','cash-closures/preview?'+new URLSearchParams({...filters,collector_id:randomUUID()}))).status).toBe(400);
 expect((await request(app.getHttpServer()).get('/api/cash-closures').set('Cookie',readerCookie).set('X-Organization-Id',orgA)).status).toBe(403);expect(await query('SELECT * FROM cash_closures')).toHaveLength(0);
 const filtered=(await call('get',url+'&collector_id='+options.collectors[0].id)).body.snapshot;expect(filtered.events.every((e:{collector:string})=>typeof e.collector==='string')).toBe(true);
});
it('assigns late corrections to their own local day and respects cashier versus accounting permissions',async()=>{
 const {patientTransaction}=await import('../apps/api/src/patients');
 const paymentId=randomUUID();let branchId='';
 await patientTransaction(orgA,async c=>{const [source]=await query('SELECT * FROM patient_payments WHERE organization_id=$1 AND patient_id=$2 LIMIT 1',[orgA,patientId],c);branchId=source.branch_id;
 await query("INSERT INTO patient_payments(organization_id,patient_id,id,acceptance_id,request_id,request_hash,amount_minor,kind,method,branch_id,branch_name,reference,notes,created_by,created_at) VALUES($1,$2,$3,$4,$5,'fixture',37,'installment','card',$6,'Histórica','','',$7,'2020-01-02T05:59:59Z')",[orgA,patientId,paymentId,source.acceptance_id,randomUUID(),branchId,source.created_by],c);
 await query("INSERT INTO payment_voids(organization_id,payment_id,request_id,request_hash,reason,created_by,created_at) VALUES($1,$2,$3,'fixture','Prueba cambio de día',$4,'2020-01-02T06:00:00Z')",[orgA,paymentId,randomUUID(),source.created_by],c);});
 const report=async(date:string)=>(await call('get','cash-closures/preview?'+new URLSearchParams({from:date,to:date,branch_id:branchId}))).body;
 const first=await report('2020-01-01'),second=await report('2020-01-02');
 expect(first.snapshot.events.map((e:{type:string})=>e.type)).toEqual(['payment']);expect(first.snapshot.totals[0].net_minor).toBe(37);
 expect(second.snapshot.events.map((e:{type:string})=>e.type)).toEqual(['void']);expect(second.snapshot.totals[0].net_minor).toBe(-37);
 const [member]=await query('SELECT m.user_id,m.role_id FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.organization_id=$1 AND u.email=$2',[orgA,`patient-reader-${suffix}@alia.example`]);
 const [cash]=await query("SELECT id FROM roles WHERE organization_id=$1 AND name='Caja'",[orgA]),[accounting]=await query("SELECT id FROM roles WHERE organization_id=$1 AND name='Contabilidad'",[orgA]);
 const req=(method:'get'|'post',path:string)=>request(app.getHttpServer())[method]('/api/'+path).set('Origin',origin).set('Cookie',readerCookie).set('X-CSRF-Token',readerCsrf).set('X-Organization-Id',orgA);
 try{await query('UPDATE memberships SET role_id=$1 WHERE organization_id=$2 AND user_id=$3',[cash.id,orgA,member.user_id]);expect((await req('get','cash-closures/options')).status).toBe(200);
 const body={request_id:randomUUID(),filters:{from:'2020-01-02',to:'2020-01-02',branch_id:branchId},token:second.token,notes:'Caja',reviewed:true};expect((await req('post','cash-closures').send(body)).status).toBe(201);
 await query('UPDATE memberships SET role_id=$1 WHERE organization_id=$2 AND user_id=$3',[accounting.id,orgA,member.user_id]);expect((await req('get','cash-closures')).status).toBe(200);expect((await req('post','cash-closures').send({...body,request_id:randomUUID()})).status).toBe(403);
 }finally{await query('UPDATE memberships SET role_id=$1 WHERE organization_id=$2 AND user_id=$3',[member.role_id,orgA,member.user_id]);}
});
it('versions cash counts immutably with server calculations, isolation and permissions',async()=>{
 const options=(await call('get','cash-closures/options')).body,list=(await call('get','cash-closures')).body.items,closure=list.find((r:{filters:{from:string}})=>r.filters.from===options.today),base='cash-closures/'+closure.id+'/counts';
 const initial=(await call('get',base)).body;expect(initial.version).toBe(0);
 const totals=initial.totals.filter((t:{method:string})=>t.method==='cash');
 const lines=totals.length?totals.map((t:{currency:string;received_minor:number})=>({currency:t.currency,opening_minor:100,counted_minor:t.received_minor+100,adjustments:[],difference_reason:''})):[{currency:'MXN',opening_minor:100,counted_minor:100,adjustments:[],difference_reason:''}];
 const body={request_id:randomUUID(),version:0,lines,notes:'Conteo ficticio',reviewed:true};
 expect((await call('post',base).send({...body,reviewed:false})).status).toBe(400);
 expect((await call('post',base).send({...body,lines:[{...lines[0],counted_minor:lines[0].counted_minor+1}]})).status).toBe(400);
 const results=await Promise.all([call('post',base).send(body),call('post',base).send(body)]);expect(results.map(r=>r.status)).toEqual([201,201]);expect(results[0].body.id).toBe(results[1].body.id);
 expect((await call('post',base).send({...body,notes:'Otro'})).status).toBe(409);expect((await call('post',base).send({...body,request_id:randomUUID()})).status).toBe(409);
 const correction={...body,request_id:randomUUID(),version:1,lines:lines.map((l:{counted_minor:number})=>({...l,counted_minor:l.counted_minor+1,difference_reason:'Conteo corregido'})),notes:'Corrección ficticia'};
 expect((await call('post',base).send({...correction,notes:''})).status).toBe(400);expect((await call('post',base).send(correction)).status).toBe(201);
 const history=(await call('get',base)).body;expect(history.version).toBe(2);expect(history.items.map((r:{version:number})=>r.version)).toEqual([2,1]);expect(history.items[0].result[0].difference_minor).toBe(1);expect(history.items[1].result[0].difference_minor).toBe(0);
 expect((await call('post',base).send(body)).body.id).toBe(results[0].body.id);expect((await call('get',base,orgB)).status).toBe(404);expect((await call('post',base,orgB).send(body)).status).toBe(404);expect(await query('SELECT * FROM cash_counts')).toHaveLength(0);
 const [member]=await query('SELECT m.user_id,m.role_id FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.organization_id=$1 AND u.email=$2',[orgA,`patient-reader-${suffix}@alia.example`]);const [accounting]=await query("SELECT id FROM roles WHERE organization_id=$1 AND name='Contabilidad'",[orgA]);
 const req=(method:'get'|'post')=>request(app.getHttpServer())[method]('/api/'+base).set('Origin',origin).set('Cookie',readerCookie).set('X-CSRF-Token',readerCsrf).set('X-Organization-Id',orgA);
 expect((await req('get')).status).toBe(403);
 try{await query('UPDATE memberships SET role_id=$1 WHERE organization_id=$2 AND user_id=$3',[accounting.id,orgA,member.user_id]);expect((await req('get')).status).toBe(200);expect((await req('post').send({...correction,request_id:randomUUID(),version:2})).status).toBe(403);}finally{await query('UPDATE memberships SET role_id=$1 WHERE organization_id=$2 AND user_id=$3',[member.role_id,orgA,member.user_id]);}
});
