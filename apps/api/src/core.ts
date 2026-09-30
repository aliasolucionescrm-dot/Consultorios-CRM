import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Injectable, BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { z } from 'zod';
import { query, type Connection } from '../../../packages/database/src/client';
export type AuthRequest = Request & { actor?: Actor };
export interface Actor {id:string;name:string;email:string;sessionId:string;csrf:string;organizationId?:string;permissions:string[]}
export const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
export const token=()=>randomBytes(32).toString('base64url');
export const uuid=z.string().uuid();
export const password=z.string().min(12,'Usa al menos 12 caracteres.').max(128);
export const email=z.email().max(254).transform(v=>v.toLowerCase());
export function parse<T>(schema:z.ZodType<T>,value:unknown):T { const result=schema.safeParse(value);if(!result.success)throw new BadRequestException(result.error.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join(' · '));return result.data; }
export function encrypt(value:string) {const iv=randomBytes(12);const cipher=createCipheriv('aes-256-gcm',Buffer.from(process.env.MFA_ENCRYPTION_KEY!,'hex'),iv);const data=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),data]).toString('base64');}
export function decrypt(value:string) {const data=Buffer.from(value,'base64');const cipher=createDecipheriv('aes-256-gcm',Buffer.from(process.env.MFA_ENCRYPTION_KEY!,'hex'),data.subarray(0,12));cipher.setAuthTag(data.subarray(12,28));return Buffer.concat([cipher.update(data.subarray(28)),cipher.final()]).toString('utf8');}
export async function audit(req:Request,action:string,entity:string,entityId:string|null,organizationId:string|null,userId:string|null,details:{before?:unknown;after?:unknown;reason?:string}={},c?:Connection) {
 await query('INSERT INTO audit_logs(organization_id,user_id,action,entity,entity_id,ip,user_agent,before,after,reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[organizationId,userId,action,entity,entityId,req.ip?.replace('::ffff:','')||null,(req.get('user-agent')||'').slice(0,500),details.before?JSON.stringify(details.before):null,details.after?JSON.stringify(details.after):null,details.reason||null],c);
}
@Injectable()
export class Access {
 async session(req:AuthRequest):Promise<Actor> {
  if(req.actor)return req.actor;
  const raw=req.cookies?.alia_session;
  if(typeof raw!=='string')throw new UnauthorizedException('Inicia sesión para continuar.');
  const [row]=await query('SELECT u.id,u.name,u.email,s.id AS session_id,s.csrf_token FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>now() AND u.active',[digest(raw)]);
  if(!row)throw new UnauthorizedException('Tu sesión terminó. Vuelve a iniciar sesión.');
  if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.get('x-csrf-token')!==row.csrf_token)throw new ForbiddenException('La solicitud no pudo verificarse. Recarga la página.');
  await query("UPDATE sessions SET last_seen_at=now() WHERE id=$1 AND last_seen_at<now()-interval '5 minutes'",[row.session_id]);
  req.actor={id:row.id,name:row.name,email:row.email,sessionId:row.session_id,csrf:row.csrf_token,permissions:[]};return req.actor!;
 }
 async tenant(req:AuthRequest,permission='organizations.view'):Promise<Actor> {
  const actor=await this.session(req);const id=parse(uuid,req.get('x-organization-id'));
  const [member]=await query('SELECT m.role_id FROM memberships m WHERE m.user_id=$1 AND m.organization_id=$2 AND m.active',[actor.id,id]);
  if(!member)throw new ForbiddenException('No tienes acceso a esta organización.');
  const permissions=(await query<{permission_code:string}>('SELECT permission_code FROM role_permissions WHERE organization_id=$1 AND role_id=$2',[id,member.role_id])).map(p=>p.permission_code);
  if(!permissions.includes(permission))throw new ForbiddenException('Tu rol no permite realizar esta acción.');
  actor.organizationId=id;actor.permissions=permissions;return actor;
 }
 async rate(key:string,limit:number,seconds:number) {
  const [row]=await query("INSERT INTO rate_limits(key,count,expires_at) VALUES($1,1,now()+$2*interval '1 second') ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate_limits.expires_at<now() THEN 1 ELSE rate_limits.count+1 END,expires_at=CASE WHEN rate_limits.expires_at<now() THEN EXCLUDED.expires_at ELSE rate_limits.expires_at END RETURNING count",[digest(key),seconds]);
  if(row.count>limit)throw new HttpException('Demasiados intentos. Espera unos minutos y vuelve a intentar.',429);
 }
}
@Catch()
export class Errors implements ExceptionFilter {
 catch(error:unknown,host:ArgumentsHost){
  const res=host.switchToHttp().getResponse<Response>();const request=host.switchToHttp().getRequest<Request>();
  let status=error instanceof HttpException?error.getStatus():500;
  let message=error instanceof HttpException?error.message:'No pudimos completar la operación. Inténtalo de nuevo.';
  const code=(error as {code?:string}).code;
  if(code==='23505'){status=409;message='Ya existe un registro con esos datos.';}
  if(code==='23503'){status=409;message='El registro está relacionado con información que debe conservarse.';}
  if(status>=500)console.error(JSON.stringify({level:'error',event:'request.failed',method:request.method,path:request.path,status,code:code||'internal'}));
  res.status(status).json({message,statusCode:status});
 }
}
