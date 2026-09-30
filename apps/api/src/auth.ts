import { Body, Controller, Get, Post, Delete, Param, Req, Res, Inject, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import type { Response } from 'express';
import { hash, verify, argon2id } from 'argon2';
import { TOTP, Secret } from 'otpauth';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { query, transaction, db, type Connection } from '../../../packages/database/src/client';
import { users } from '../../../packages/database/src/schema';
import { Access, type AuthRequest, parse, email, password, token, digest, audit, encrypt, decrypt, uuid } from './core';
import { enqueueMail } from './mail-worker';
const credentials=z.object({email,password:z.string().min(1).max(128),code:z.string().max(80).optional()}).strict();
export const hashPassword=(value:string)=>hash(value,{type:argon2id,memoryCost:65536,timeCost:3,parallelism:1});
export function totp(secret:string,email='') {return new TOTP({issuer:'ALIA DENTAL',label:email,algorithm:'SHA1',digits:6,period:30,secret:Secret.fromBase32(secret)});}
async function secondFactor(user:Record<string,unknown>,code:string|undefined,c:Connection) {
 if(!user.mfa_secret)return true;
 if(!code)return false;
 const [recovery]=await query('UPDATE recovery_codes SET used_at=now() WHERE user_id=$1 AND code_hash=$2 AND used_at IS NULL RETURNING code_hash',[user.id,digest(code)],c);
 if(recovery)return true;
 const delta=totp(decrypt(String(user.mfa_secret))).validate({token:code,window:1});
 if(delta===null)return false;
 const step=Math.floor(Date.now()/30000)+delta;
 if(user.mfa_last_step!==null&&Number(user.mfa_last_step)>=step)return false;
 await query('UPDATE users SET mfa_last_step=$2 WHERE id=$1',[user.id,step],c);return true;
}
@ApiTags('Autenticación y sesiones')
@Controller('api/auth')
export class AuthController {
 constructor(@Inject(Access) private access:Access){}
 @Post('login')
 @ApiOperation({summary:'Iniciar sesión con contraseña y TOTP/código de recuperación cuando esté habilitado'})
 @ApiBody({schema:{type:'object',required:['email','password'],properties:{email:{type:'string',format:'email'},password:{type:'string'},code:{type:'string'}}}})
 async login(@Body() body:unknown,@Req() req:AuthRequest,@Res({passthrough:true})res:Response){
  const input=parse(credentials,body);await this.access.rate(`login:${req.ip}`,30,900);await this.access.rate(`login-email:${input.email}`,15,900);
  const result=await transaction(async c=>{
   const [user]=await query('SELECT * FROM users WHERE email=$1 FOR UPDATE',[input.email],c);
   if(!user){await hashPassword('dummy-password-timing-only');return null;}
   if(!user.active||(user.locked_until&&new Date(user.locked_until)>new Date()))return null;
   if(!(await verify(user.password_hash,input.password))||!(await secondFactor(user,input.code,c))){
    await query("UPDATE users SET failed_attempts=failed_attempts+1,locked_until=CASE WHEN failed_attempts>=4 THEN now()+least(3600,power(2,least(failed_attempts-4,10))*30)*interval '1 second' ELSE NULL END WHERE id=$1",[user.id],c);
    await audit(req,'auth.login_failed','user',user.id,null,user.id,{},c);return null;
   }
   await query('UPDATE users SET failed_attempts=0,locked_until=NULL WHERE id=$1',[user.id],c);
   const raw=token(),csrf=token();
   await query("INSERT INTO sessions(user_id,token_hash,csrf_token,user_agent,ip,expires_at) VALUES($1,$2,$3,$4,$5,now()+$6*interval '1 hour')",[user.id,digest(raw),csrf,(req.get('user-agent')||'').slice(0,500),req.ip?.replace('::ffff:',''),Number(process.env.SESSION_HOURS||12)],c);
   await audit(req,'auth.login','user',user.id,null,user.id,{},c);return {raw};
  });
  if(!result)throw new UnauthorizedException('No pudimos iniciar sesión. Revisa tus datos y tu código de seguridad, o espera si hiciste varios intentos.');
  res.cookie('alia_session',result.raw,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:Number(process.env.SESSION_HOURS||12)*3600000});return {ok:true};
 }
 @Get('me') async me(@Req()req:AuthRequest){
  const actor=await this.access.session(req);
  const [user]=await db.select({id:users.id,name:users.name,email:users.email}).from(users).where(eq(users.id,actor.id));
  const organizations=await query('SELECT o.id,o.name,o.timezone,o.currency,r.name AS role FROM memberships m JOIN organizations o ON o.id=m.organization_id JOIN roles r ON r.id=m.role_id WHERE m.user_id=$1 AND m.active ORDER BY o.name',[actor.id]);
  const [mfa]=await query('SELECT mfa_secret IS NOT NULL AS enabled FROM users WHERE id=$1',[actor.id]);return {user,organizations,csrf:actor.csrf,mfaEnabled:mfa.enabled};
 }
 @Post('logout') async logout(@Req()req:AuthRequest,@Res({passthrough:true})res:Response){const a=await this.access.session(req);await transaction(async c=>{await query('UPDATE sessions SET revoked_at=now() WHERE id=$1',[a.sessionId],c);await audit(req,'auth.logout','session',a.sessionId,null,a.id,{},c);});res.clearCookie('alia_session',{path:'/',httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production'});return {ok:true};}
 @Post('forgot-password') async forgot(@Body()body:unknown,@Req()req:AuthRequest){
  const input=parse(z.object({email}).strict(),body);await this.access.rate(`forgot:${req.ip}`,5,900);await this.access.rate(`forgot:${input.email}`,3,900);
  const [user]=await query('SELECT id FROM users WHERE email=$1 AND active',[input.email]);
  if(user)await transaction(async c=>{const raw=token();const [reset]=await query("INSERT INTO password_resets(user_id,token_hash,expires_at) VALUES($1,$2,now()+interval '30 minutes') RETURNING id,expires_at",[user.id,digest(raw)],c);
   await enqueueMail(c,{userId:user.id,kind:'reset',entityId:reset.id,email:input.email,token:raw,expiresAt:reset.expires_at});
   await audit(req,'auth.reset_requested','user',user.id,null,user.id,{},c);
  });
  return {message:'Si el correo está registrado, recibirás instrucciones para recuperar tu acceso.'};
 }
 @Post('reset-password') async reset(@Body()body:unknown,@Req()req:AuthRequest){
  const input=parse(z.object({token:z.string().min(20).max(100),password,code:z.string().max(80).optional()}).strict(),body);await this.access.rate(`reset:${req.ip}`,10,900);
  const passwordHash=await hashPassword(input.password);
  await transaction(async c=>{
   const [reset]=await query('SELECT * FROM password_resets WHERE token_hash=$1 AND consumed_at IS NULL AND expires_at>now() FOR UPDATE',[digest(input.token)],c);
   if(!reset)throw new BadRequestException('Este enlace venció o ya fue utilizado. Solicita uno nuevo.');
   const [user]=await query('SELECT * FROM users WHERE id=$1 FOR UPDATE',[reset.user_id],c);
   if(!(await secondFactor(user,input.code,c)))throw new BadRequestException('Introduce un código de seguridad válido.');
   await query('UPDATE users SET password_hash=$2,failed_attempts=0,locked_until=NULL,updated_at=now() WHERE id=$1',[user.id,passwordHash],c);
   await query('UPDATE password_resets SET consumed_at=now() WHERE user_id=$1 AND consumed_at IS NULL',[user.id],c);
   await query('UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL',[user.id],c);
   await audit(req,'auth.password_reset','user',user.id,null,user.id,{},c);
  });return {ok:true};
 }
 @Post('change-password') async change(@Body()body:unknown,@Req()req:AuthRequest){
  const a=await this.access.session(req);const input=parse(z.object({current:z.string().max(128),password}).strict(),body);await this.access.rate(`password:${a.id}`,5,900);
  await transaction(async c=>{const [u]=await query('SELECT password_hash FROM users WHERE id=$1 FOR UPDATE',[a.id],c);if(!await verify(u.password_hash,input.current))throw new BadRequestException('La contraseña actual no es correcta.');await query('UPDATE users SET password_hash=$2,updated_at=now() WHERE id=$1',[a.id,await hashPassword(input.password)],c);await query('UPDATE sessions SET revoked_at=now() WHERE user_id=$1',[a.id],c);await audit(req,'auth.password_changed','user',a.id,null,a.id,{},c);});return {ok:true};
 }
 @Get('sessions') async sessions(@Req()req:AuthRequest){const a=await this.access.session(req);return query('SELECT id,user_agent,ip,created_at,last_seen_at,expires_at,(id=$2) AS current FROM sessions WHERE user_id=$1 AND revoked_at IS NULL AND expires_at>now() ORDER BY created_at DESC LIMIT 50',[a.id,a.sessionId]);}
 @Delete('sessions/:id') async revoke(@Param('id')id:string,@Req()req:AuthRequest){const a=await this.access.session(req);parse(uuid,id);await transaction(async c=>{await query('UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND id=$2',[a.id,id],c);await audit(req,'auth.session_revoked','session',id,null,a.id,{},c);});return {ok:true};}
 @Post('mfa/setup') async setup(@Body()body:unknown,@Req()req:AuthRequest){
  const a=await this.access.session(req);const input=parse(z.object({password:z.string().max(128)}).strict(),body);await this.access.rate(`mfa:${a.id}`,5,900);
  const secret=new Secret({size:20}).base32;
  await transaction(async c=>{const [u]=await query('SELECT password_hash,mfa_secret FROM users WHERE id=$1 FOR UPDATE',[a.id],c);if(u.mfa_secret)throw new BadRequestException('La verificación en dos pasos ya está activa.');if(!await verify(u.password_hash,input.password))throw new BadRequestException('La contraseña no es correcta.');await query('UPDATE users SET mfa_pending_secret=$2 WHERE id=$1',[a.id,encrypt(secret)],c);});return {secret,uri:totp(secret,a.email).toString()};
 }
 @Post('mfa/enable') async enable(@Body()body:unknown,@Req()req:AuthRequest){
  const a=await this.access.session(req);const input=parse(z.object({code:z.string().regex(/^\d{6}$/)}).strict(),body);await this.access.rate(`mfa-enable:${a.id}`,8,900);
  const codes=Array.from({length:8},()=>token().slice(0,16));
  await transaction(async c=>{const [u]=await query('SELECT mfa_pending_secret,mfa_secret FROM users WHERE id=$1 FOR UPDATE',[a.id],c);if(!u.mfa_pending_secret||u.mfa_secret)throw new BadRequestException('Inicia de nuevo la configuración.');const delta=totp(decrypt(u.mfa_pending_secret)).validate({token:input.code,window:1});if(delta===null)throw new BadRequestException('Código incorrecto. Revisa la hora de tu dispositivo.');await query('UPDATE users SET mfa_secret=mfa_pending_secret,mfa_pending_secret=NULL,mfa_last_step=$2 WHERE id=$1',[a.id,Math.floor(Date.now()/30000)+delta],c);for(const code of codes)await query('INSERT INTO recovery_codes(user_id,code_hash) VALUES($1,$2)',[a.id,digest(code)],c);await query('UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND id<>$2',[a.id,a.sessionId],c);await audit(req,'auth.mfa_enabled','user',a.id,null,a.id,{},c);});return {codes};
 }
 @Post('mfa/disable') async disable(@Body()body:unknown,@Req()req:AuthRequest){
  const a=await this.access.session(req);const input=parse(z.object({password:z.string().max(128),code:z.string().max(80)}).strict(),body);await this.access.rate(`mfa:${a.id}`,5,900);
  await transaction(async c=>{const [u]=await query('SELECT * FROM users WHERE id=$1 FOR UPDATE',[a.id],c);if(!await verify(u.password_hash,input.password)||!await secondFactor(u,input.code,c))throw new BadRequestException('Contraseña o código incorrecto.');await query('UPDATE users SET mfa_secret=NULL,mfa_pending_secret=NULL,mfa_last_step=NULL WHERE id=$1',[a.id],c);await query('DELETE FROM recovery_codes WHERE user_id=$1',[a.id],c);await query('UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND id<>$2',[a.id,a.sessionId],c);await audit(req,'auth.mfa_disabled','user',a.id,null,a.id,{},c);});return {ok:true};
 }
 @Post('accept-invitation') async accept(@Body()body:unknown,@Req()req:AuthRequest){
  const input=parse(z.object({token:z.string().min(20).max(100),name:z.string().trim().min(2).max(160).optional(),password:password.optional()}).strict(),body);await this.access.rate(`invite:${req.ip}`,10,900);
  await transaction(async c=>{const [invite]=await query('SELECT * FROM invitations WHERE token_hash=$1 AND expires_at>now() AND accepted_at IS NULL FOR UPDATE',[digest(input.token)],c);if(!invite)throw new BadRequestException('Invitación inválida o vencida. Solicita una nueva.');let [u]=await query('SELECT * FROM users WHERE email=$1 FOR UPDATE',[invite.email],c);if(u){const a=await this.access.session(req);if(a.id!==u.id)throw new BadRequestException('Inicia sesión con el correo invitado para aceptar.');}else{if(!input.name||!input.password)throw new BadRequestException('Introduce tu nombre y una contraseña de al menos 12 caracteres.');[u]=await query('INSERT INTO users(email,name,password_hash) VALUES($1,$2,$3) RETURNING id',[invite.email,input.name,await hashPassword(input.password)],c);}await query('INSERT INTO memberships(organization_id,user_id,role_id) VALUES($1,$2,$3) ON CONFLICT(organization_id,user_id) DO NOTHING',[invite.organization_id,u.id,invite.role_id],c);await query('UPDATE invitations SET accepted_at=now() WHERE id=$1',[invite.id],c);await audit(req,'membership.joined','user',u.id,invite.organization_id,u.id,{},c);});return {ok:true};
 }
}
