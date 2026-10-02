import {BadRequestException,Body,ConflictException,Controller,Get,Inject,NotFoundException,Param,Post,Req} from '@nestjs/common';
import {z} from 'zod';
import {Access,type AuthRequest,audit,digest,parse,uuid} from './core';
import {patientTransaction} from './patients';
import {query,type Connection} from '../../../packages/database/src/client';
export const whatsappNumber=(value:string)=>value.replace(/[\s().-]/g,'');
export function whatsappLink(number:string,message:string){
 if(!/^\+[1-9]\d{7,14}$/.test(number))throw new BadRequestException('Revisa el WhatsApp con código de país en la ficha.');
 return 'https://wa.me/'+number.slice(1)+'?text='+encodeURIComponent(message);
}
export function whatsappMessage(data:{first_name:string;clinic:string;branch:string;starts_at:Date|string;timezone:string}){
 const date=new Date(data.starts_at).toLocaleString('es-MX',{timeZone:data.timezone,dateStyle:'full',timeStyle:'short'});
 return `Hola, ${data.first_name}. Te recordamos tu cita en ${data.clinic}, sucursal ${data.branch}, el ${date} (${data.timezone}).\n\n¿Nos confirmas tu asistencia respondiendo a este mensaje? Si necesitas cambiar la cita, avísanos por aquí. ¡Gracias!`;
}
@Controller('api/patients/:patientId/whatsapp-reminders')
export class WhatsappRemindersController{
 constructor(@Inject(Access)private access:Access){}
 private async actor(req:AuthRequest,id:string,edit=false){const a=await this.access.tenant(req,'patients.view');await this.access.tenant(req,'appointments.view');if(edit)await this.access.tenant(req,'patients.edit');parse(uuid,id);return a;}
 @Get() async list(@Param('patientId')id:string,@Req()req:AuthRequest){const a=await this.actor(req,id);return patientTransaction(a.organizationId!,async c=>{
  if(!(await query('SELECT id FROM patients WHERE organization_id=$1 AND id=$2',[a.organizationId,id],c)).length)throw new NotFoundException('No encontramos al paciente.');
  const rows=await query("SELECT id,version,starts_at,timezone,status FROM appointments WHERE organization_id=$1 AND patient_id=$2 AND starts_at>now() AND status IN ('pending','confirmed') ORDER BY starts_at,id LIMIT 21",[a.organizationId,id],c);
  return {items:rows.slice(0,20),hasMore:rows.length>20};
 });}
 private async draft(org:string,patient:string,appointment:string,c:Connection){
  const [r]=await query(`SELECT a.id,a.version,a.starts_at,a.timezone,a.status,p.first_name,p.active,p.whatsapp,
   pref.version AS preference_version,pref.whatsapp_enabled,pref.whatsapp AS authorized_whatsapp,o.name AS clinic,b.name AS branch
   FROM appointments a JOIN patients p ON p.organization_id=a.organization_id AND p.id=a.patient_id
   JOIN organizations o ON o.id=a.organization_id JOIN branches b ON b.organization_id=a.organization_id AND b.id=a.branch_id
   LEFT JOIN LATERAL (SELECT version,whatsapp_enabled,whatsapp FROM patient_reminder_preferences WHERE organization_id=a.organization_id AND patient_id=a.patient_id ORDER BY version DESC LIMIT 1) pref ON true
   WHERE a.organization_id=$1 AND a.patient_id=$2 AND a.id=$3 AND a.starts_at>clock_timestamp() AND a.status IN ('pending','confirmed')`,[org,patient,appointment],c);
  if(!r)throw new NotFoundException('La cita ya no está disponible. Actualiza las próximas citas.');
  if(!r.active)throw new ConflictException('El paciente está inactivo.');
  if(!r.whatsapp_enabled)throw new ConflictException('Registra primero la autorización de WhatsApp en las preferencias del paciente.');
  const number=whatsappNumber(r.whatsapp);
  if(!/^\+[1-9]\d{7,14}$/.test(number)||number!==r.authorized_whatsapp)throw new ConflictException('El WhatsApp cambió o no tiene código de país. Revisa la ficha y guarda nuevamente las preferencias.');
  return {appointment_id:r.id,number,starts_at:r.starts_at,timezone:r.timezone,message:whatsappMessage(r as Parameters<typeof whatsappMessage>[0]),review_token:digest(JSON.stringify(r))};
 }
 @Post(':appointmentId/draft') async prepare(@Param('patientId')id:string,@Param('appointmentId')appointment:string,@Body()raw:unknown,@Req()req:AuthRequest){
  const a=await this.actor(req,id,true);parse(uuid,appointment);parse(z.object({}).strict(),raw);
  return patientTransaction(a.organizationId!,async c=>{const result=await this.draft(a.organizationId!,id,appointment,c);await audit(req,'reminder.whatsapp_draft_prepared','appointments',appointment,a.organizationId!,a.id,{},c);return result;});
 }
 @Post(':appointmentId/link') async link(@Param('patientId')id:string,@Param('appointmentId')appointment:string,@Body()raw:unknown,@Req()req:AuthRequest){
  const a=await this.actor(req,id,true);parse(uuid,appointment);const input=parse(z.object({review_token:z.string().regex(/^[a-f0-9]{64}$/),message:z.string().trim().min(1).max(2000)}).strict(),raw);
  return patientTransaction(a.organizationId!,async c=>{const current=await this.draft(a.organizationId!,id,appointment,c);if(input.review_token!==current.review_token)throw new ConflictException('La cita, el contacto o las preferencias cambiaron. Cierra el borrador y prepara un mensaje actualizado.');const url=whatsappLink(current.number,input.message);await audit(req,'reminder.whatsapp_link_prepared','appointments',appointment,a.organizationId!,a.id,{},c);return {url,sent:false};});
 }
}
