import 'dotenv/config';
import { afterAll,beforeAll,describe,expect,it } from 'vitest';
import { SMTPServer } from 'smtp-server';
import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../apps/api/src/app';
import { hashPassword } from '../apps/api/src/auth';
import { decrypt,digest } from '../apps/api/src/core';
import { deliverOne,enqueueMail } from '../apps/api/src/mail-worker';
import { pool,query,transaction } from '../packages/database/src/client';
let app:INestApplication,server:SMTPServer,cookie:string,csrf:string,userId:string,org:string,role:string;
const messages:string[]=[];
const suffix=randomUUID().slice(0,8),email=`mail-owner-${suffix}@alia.example`,password='Fictional-mail-test-2026!';
let smtpPort:string;
const origin=process.env.APP_ORIGIN!;
function call(path:string,body:unknown){return request(app.getHttpServer()).post(`/api/${path}`).set('Origin',origin).set('Cookie',cookie).set('X-CSRF-Token',csrf).set('X-Organization-Id',org||'').send(body);}
beforeAll(async()=>{
 if(!/^alia_test_[a-f0-9]{12}$/.test(process.env.TEST_DATABASE_NAME||''))throw new Error('Run npm test');
 server=new SMTPServer({authOptional:true,disabledCommands:['AUTH','STARTTLS'],onData(stream,_session,done){let raw='';stream.on('data',chunk=>{raw+=chunk.toString();});stream.on('end',()=>{messages.push(raw.replace(/=\r?\n/g,'').replace(/=3D/g,'='));done();});}});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 smtpPort=String((server.server.address() as AddressInfo).port);process.env.SMTP_HOST='127.0.0.1';process.env.SMTP_PORT=smtpPort;process.env.SMTP_SECURE='false';
 app=await createApp();await app.init();
 const [u]=await query('INSERT INTO users(email,name,password_hash) VALUES($1,$2,$3) RETURNING id',[email,'Mail Owner',await hashPassword(password)]);userId=u.id;
 const login=await request(app.getHttpServer()).post('/api/auth/login').set('Origin',origin).send({email,password});cookie=login.headers['set-cookie'][0].split(';')[0];
 csrf=(await request(app.getHttpServer()).get('/api/auth/me').set('Cookie',cookie)).body.csrf;
 org=(await call('organizations',{name:`Mail test ${suffix}`,branch:'Principal'})).body.id;
 const [r]=await query("SELECT id FROM roles WHERE organization_id=$1 AND name='Solo lectura'",[org]);role=r.id;
});
afterAll(async()=>{await app?.close();if(server)await new Promise<void>(resolve=>server.close(resolve));await pool.end();});
describe('Least-privilege runtime and durable email',()=>{
 it('runs without superuser, database creation, role management or table ownership',async()=>{
  const [r]=await query('SELECT current_user,rolsuper,rolcreatedb,rolcreaterole,rolbypassrls FROM pg_roles WHERE rolname=current_user');expect(r.current_user).toBe('alia_runtime');for(const key of ['rolsuper','rolcreatedb','rolcreaterole','rolbypassrls'])expect(r[key]).toBe(false);
  await expect(query('CREATE TABLE public.forbidden_runtime_table(id int)')).rejects.toMatchObject({code:'42501'});
  await expect(query('ALTER TABLE audit_logs DISABLE TRIGGER audit_immutable')).rejects.toMatchObject({code:'42501'});
  await expect(query('UPDATE permissions SET description=description')).rejects.toMatchObject({code:'42501'});
 });
 it('commits invitation, encrypted email and audit together, then delivers SMTP',async()=>{
  const recipient=`invite-${suffix}@alia.example`;
  expect((await call('invitations',{email:recipient,role_id:role})).status).toBe(201);
  const [job]=await query("SELECT * FROM mail_outbox WHERE organization_id=$1 AND kind='invite'",[org]);expect(job.status).toBe('pending');expect(job.payload_ciphertext).not.toContain(recipient);
  const payload=JSON.parse(decrypt(job.payload_ciphertext));const [inv]=await query('SELECT token_hash FROM invitations WHERE id=$1',[job.entity_id]);expect(inv.token_hash).toBe(digest(payload.token));
  const [event]=await query("SELECT id FROM audit_logs WHERE entity_id=$1 AND action='invitation.queued'",[job.entity_id]);expect(event).toBeTruthy();
  expect(await deliverOne()).toBe(true);expect(messages.at(-1)).toContain(payload.token);expect(messages.at(-1)).toContain(recipient);
  const [sent]=await query('SELECT status,payload_ciphertext,sent_at FROM mail_outbox WHERE id=$1',[job.id]);expect(sent.status).toBe('sent');expect(sent.payload_ciphertext).toBeNull();expect(sent.sent_at).toBeTruthy();
  const accepted=await request(app.getHttpServer()).post('/api/auth/accept-invitation').set('Origin',origin).send({token:payload.token,name:'Invited Person',password});expect(accepted.status).toBe(201);
  const replay=await request(app.getHttpServer()).post('/api/auth/accept-invitation').set('Origin',origin).send({token:payload.token,name:'Invited Person',password});expect(replay.status).toBe(400);
 });
 it('rolls back queued email with its originating transaction',async()=>{
  const id=randomUUID();await expect(transaction(async c=>{await enqueueMail(c,{userId,kind:'reset',entityId:id,email,token:'not-for-delivery',expiresAt:new Date(Date.now()+60000)});throw new Error('rollback-test');})).rejects.toThrow('rollback-test');
  expect(await query('SELECT id FROM mail_outbox WHERE entity_id=$1',[id])).toHaveLength(0);
 });
 it('lets an existing authenticated account accept without resubmitting a password',async()=>{
  await call('invitations',{email,role_id:role});
  const [job]=await query("SELECT m.* FROM mail_outbox m JOIN invitations i ON i.id=m.entity_id WHERE i.email=$1 ORDER BY m.created_at DESC LIMIT 1",[email]);
  const payload=JSON.parse(decrypt(job.payload_ciphertext));
  expect((await call('auth/accept-invitation',{token:payload.token})).status).toBe(201);
  const [membership]=await query('SELECT r.name FROM memberships m JOIN roles r ON r.id=m.role_id WHERE m.user_id=$1 AND m.organization_id=$2',[userId,org]);
  expect(membership.name).toBe('Propietario'); // An invitation must not overwrite existing access.
  await deliverOne();
 });
 it('retries an SMTP failure and erases token after successful delivery',async()=>{
  const response=await request(app.getHttpServer()).post('/api/auth/forgot-password').set('Origin',origin).send({email});expect(response.status).toBe(201);
  const [job]=await query("SELECT * FROM mail_outbox WHERE user_id=$1 AND kind='reset' ORDER BY created_at DESC LIMIT 1",[userId]);
  process.env.SMTP_PORT='1';try{expect(await deliverOne()).toBe(true);}finally{process.env.SMTP_PORT=smtpPort;}
  const [retry]=await query('SELECT status,attempts,payload_ciphertext,last_error_code FROM mail_outbox WHERE id=$1',[job.id]);expect(retry.status).toBe('pending');expect(retry.attempts).toBe(1);expect(retry.payload_ciphertext).toBeTruthy();expect(retry.last_error_code).toBe('delivery_failed');
  await query('UPDATE mail_outbox SET available_at=now() WHERE id=$1',[job.id]);await deliverOne();const [sent]=await query('SELECT status,payload_ciphertext FROM mail_outbox WHERE id=$1',[job.id]);expect(sent.status).toBe('sent');expect(sent.payload_ciphertext).toBeNull();
 });
 it('cancels a revoked invitation before delivery',async()=>{
  const recipient=`revoked-${suffix}@alia.example`;await call('invitations',{email:recipient,role_id:role});const [inv]=await query('SELECT id FROM invitations WHERE email=$1',[recipient]);
  await request(app.getHttpServer()).delete(`/api/invitations/${inv.id}`).set('Origin',origin).set('Cookie',cookie).set('X-CSRF-Token',csrf).set('X-Organization-Id',org);
  const count=messages.length;await deliverOne();expect(messages).toHaveLength(count);const [job]=await query('SELECT status,payload_ciphertext FROM mail_outbox WHERE entity_id=$1',[inv.id]);expect(job.status).toBe('cancelled');expect(job.payload_ciphertext).toBeNull();
 });
});
