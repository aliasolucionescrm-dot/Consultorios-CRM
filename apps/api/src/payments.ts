import {BadRequestException,Body,ConflictException,Controller,Get,Inject,NotFoundException,Param,Post,Query,Req} from '@nestjs/common';
import {z} from 'zod';
import {Access,type AuthRequest,audit,digest,parse,uuid} from './core';
import {patientTransaction} from './patients';
import {query} from '../../../packages/database/src/client';
@Controller('api/patients/:patientId/payments')
export class PaymentsController{
 constructor(@Inject(Access)private access:Access){}
 private async actor(req:AuthRequest,patientId:string,permission='payments.view'){const a=await this.access.tenant(req,'patients.view');await this.access.tenant(req,'payments.view');await this.access.tenant(req,permission);parse(uuid,patientId);return a;}
 @Get() async read(@Param('patientId')patientId:string,@Query()raw:unknown,@Req()req:AuthRequest){
  const a=await this.actor(req,patientId),{page}=parse(z.object({page:z.coerce.number().int().min(1).max(100000).default(1)}).strict(),raw);
  return patientTransaction(a.organizationId!,async c=>{
   if(!(await query('SELECT id FROM patients WHERE organization_id=$1 AND id=$2',[a.organizationId,patientId],c)).length)throw new NotFoundException('No encontramos al paciente.');
   const [agreement]=await query("SELECT id,version,snapshot->'budget'->>'title' AS title,snapshot->'budget'->>'currency' AS currency,(snapshot->'budget'->>'total_minor')::float8 AS total_minor FROM budget_acceptances WHERE organization_id=$1 AND patient_id=$2 ORDER BY version DESC LIMIT 1",[a.organizationId,patientId],c);
   const [paid]=await query('SELECT coalesce(sum(p.amount_minor),0)::float8 AS total FROM patient_payments p WHERE p.organization_id=$1 AND p.patient_id=$2 AND p.acceptance_id=$3 AND NOT EXISTS(SELECT 1 FROM payment_voids v WHERE v.organization_id=p.organization_id AND v.payment_id=p.id)',[a.organizationId,patientId,agreement?.id||null],c);
   const items=await query("SELECT p.id,p.amount_minor::float8 AS amount_minor,p.kind,p.method,p.branch_name,p.reference,p.notes,p.created_at,u.name AS author,b.version,b.snapshot->'budget'->>'currency' AS currency,v.reason AS void_reason,v.created_at AS voided_at,vu.name AS voided_by FROM patient_payments p JOIN budget_acceptances b ON b.organization_id=p.organization_id AND b.id=p.acceptance_id JOIN users u ON u.id=p.created_by LEFT JOIN payment_voids v ON v.organization_id=p.organization_id AND v.payment_id=p.id LEFT JOIN users vu ON vu.id=v.created_by WHERE p.organization_id=$1 AND p.patient_id=$2 ORDER BY p.created_at DESC,p.id DESC LIMIT 21 OFFSET $3",[a.organizationId,patientId,(page-1)*20],c);
   const branches=await query('SELECT id,name FROM branches WHERE organization_id=$1 AND active ORDER BY name,id',[a.organizationId],c);
   await audit(req,'payments.viewed','patient',patientId,a.organizationId!,a.id,{},c);return {agreement:agreement?{...agreement,paid_minor:paid.total,balance_minor:agreement.total_minor-paid.total}:null,items:items.slice(0,20),hasMore:items.length>20,branches};
  });
 }
 @Get(':paymentId/receipt') async receipt(@Param('patientId')patientId:string,@Param('paymentId')paymentId:string,@Req()req:AuthRequest){
  const a=await this.actor(req,patientId);parse(uuid,paymentId);
  return patientTransaction(a.organizationId!,async c=>{
   const [p]=await query("SELECT p.id,p.amount_minor::float8 AS amount_minor,p.kind,p.method,p.branch_name,p.reference,p.created_at,p.receipt_context,u.name AS author,b.version,b.snapshot->'budget'->>'currency' AS currency,b.snapshot->'patient' AS patient,b.snapshot->'organization' AS organization,v.reason AS void_reason,v.created_at AS voided_at,vu.name AS voided_by FROM patient_payments p JOIN budget_acceptances b ON b.organization_id=p.organization_id AND b.id=p.acceptance_id JOIN users u ON u.id=p.created_by LEFT JOIN payment_voids v ON v.organization_id=p.organization_id AND v.payment_id=p.id LEFT JOIN users vu ON vu.id=v.created_by WHERE p.organization_id=$1 AND p.patient_id=$2 AND p.id=$3",[a.organizationId,patientId,paymentId],c);
   if(!p)throw new NotFoundException('No encontramos el recibo de este paciente.');
   const context=p.receipt_context||{patient:p.patient,organization:p.organization,recorded_by:p.author,balance_after_minor:null};
   await audit(req,'payment.receipt_viewed','patient',patientId,a.organizationId!,a.id,{after:{payment_id:paymentId}},c);
   return {id:p.id,amount_minor:p.amount_minor,kind:p.kind,method:p.method,branch_name:p.branch_name,reference:p.reference,created_at:p.created_at,version:p.version,currency:p.currency,context,legacy:!p.receipt_context,voided_at:p.voided_at,void_reason:p.void_reason,voided_by:p.voided_by,consulted_at:new Date().toISOString()};
  });
 }
 @Post() async create(@Param('patientId')patientId:string,@Body()raw:unknown,@Req()req:AuthRequest){
  const a=await this.actor(req,patientId,'payments.create'),input=parse(z.object({request_id:uuid,acceptance_id:uuid,amount_minor:z.number().int().positive().max(1000000000000),kind:z.enum(['advance','installment','settlement']),method:z.enum(['cash','card','transfer','other']),branch_id:uuid,reference:z.string().trim().max(160),notes:z.string().trim().max(2000)}).strict(),raw),hash=digest(JSON.stringify({...input,patientId}));
  return patientTransaction(a.organizationId!,async c=>{
   await query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[a.organizationId+':payment-request:'+input.request_id],c);
   await query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[a.organizationId+':budget:'+patientId],c);
   const [prior]=await query('SELECT id,request_hash FROM patient_payments WHERE organization_id=$1 AND request_id=$2',[a.organizationId,input.request_id],c);if(prior){if(prior.request_hash!==hash)throw new ConflictException('La solicitud ya se utilizó con otro contenido.');return {id:prior.id};}
   const [patient]=await query('SELECT active FROM patients WHERE organization_id=$1 AND id=$2 FOR SHARE',[a.organizationId,patientId],c);if(!patient)throw new NotFoundException('No encontramos al paciente.');if(!patient.active)throw new BadRequestException('La ficha está inactiva.');
   const [agreement]=await query("SELECT id,version,snapshot,(snapshot->'budget'->>'total_minor')::float8 AS total FROM budget_acceptances WHERE organization_id=$1 AND patient_id=$2 ORDER BY version DESC LIMIT 1",[a.organizationId,patientId],c);if(!agreement||agreement.id!==input.acceptance_id)throw new ConflictException('El acuerdo cambió o no está aceptado. Actualiza los pagos antes de continuar.');
   const [branch]=await query('SELECT name FROM branches WHERE organization_id=$1 AND id=$2 AND active FOR SHARE',[a.organizationId,input.branch_id],c);if(!branch)throw new BadRequestException('Selecciona una sucursal activa de esta clínica.');
   const [paid]=await query('SELECT coalesce(sum(p.amount_minor),0)::float8 AS total FROM patient_payments p WHERE p.organization_id=$1 AND p.acceptance_id=$2 AND NOT EXISTS(SELECT 1 FROM payment_voids v WHERE v.organization_id=p.organization_id AND v.payment_id=p.id)',[a.organizationId,agreement.id],c);
   const balance=agreement.total-paid.total;if(input.amount_minor>balance)throw new ConflictException('El importe supera el saldo pendiente. Actualiza los pagos.');if(input.kind==='settlement'&&input.amount_minor!==balance)throw new BadRequestException('La liquidación debe cubrir exactamente el saldo pendiente.');
   const [row]=await query('INSERT INTO patient_payments(organization_id,patient_id,acceptance_id,request_id,request_hash,amount_minor,kind,method,branch_id,branch_name,reference,notes,created_by,receipt_context) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id',[a.organizationId,patientId,agreement.id,input.request_id,hash,input.amount_minor,input.kind,input.method,input.branch_id,branch.name,input.reference,input.notes,a.id,JSON.stringify({patient:agreement.snapshot.patient,organization:agreement.snapshot.organization,recorded_by:a.name,balance_after_minor:balance-input.amount_minor})],c);
   await audit(req,'payment.recorded','patient',patientId,a.organizationId!,a.id,{after:{payment_id:row.id,acceptance_id:agreement.id}},c);return row;
  });
 }
 @Post(':paymentId/void') async void(@Param('patientId')patientId:string,@Param('paymentId')paymentId:string,@Body()raw:unknown,@Req()req:AuthRequest){
  const a=await this.actor(req,patientId,'payments.void');parse(uuid,paymentId);const input=parse(z.object({request_id:uuid,reason:z.string().trim().min(1).max(2000),reviewed:z.literal(true)}).strict(),raw),hash=digest(JSON.stringify({...input,patientId,paymentId}));
  return patientTransaction(a.organizationId!,async c=>{
   await query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[a.organizationId+':payment-void:'+input.request_id],c);await query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[a.organizationId+':budget:'+patientId],c);
   const [p]=await query('SELECT id FROM patient_payments WHERE organization_id=$1 AND patient_id=$2 AND id=$3',[a.organizationId,patientId,paymentId],c);if(!p)throw new NotFoundException('No encontramos el pago.');
   const [retry]=await query('SELECT id,request_hash FROM payment_voids WHERE organization_id=$1 AND request_id=$2',[a.organizationId,input.request_id],c);if(retry){if(retry.request_hash!==hash)throw new ConflictException('La solicitud ya se utilizó con otro contenido.');return {id:retry.id};}
   if((await query('SELECT id FROM payment_voids WHERE organization_id=$1 AND payment_id=$2',[a.organizationId,paymentId],c)).length)throw new ConflictException('El registro ya está anulado. Actualiza los pagos.');
   const [row]=await query('INSERT INTO payment_voids(organization_id,payment_id,request_id,request_hash,reason,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',[a.organizationId,paymentId,input.request_id,hash,input.reason,a.id],c);await audit(req,'payment.voided','patient',patientId,a.organizationId!,a.id,{after:{payment_id:paymentId,void_id:row.id}},c);return row;
  });
 }
}

