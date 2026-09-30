import {BadRequestException,Body,ConflictException,Controller,Get,Inject,NotFoundException,Param,Post,Req} from '@nestjs/common';
import type {PoolClient} from 'pg';
import {z} from 'zod';
import {Access,type AuthRequest,audit,digest,parse,uuid} from './core';
import {patientTransaction} from './patients';
import {query} from '../../../packages/database/src/client';
async function snapshot(org:string,patientId:string,version:number,c:PoolClient){
 const [budget]=await query('SELECT version,plan_version,currency,title,items,total_minor::float8 AS total_minor,created_at FROM patient_budget_versions WHERE organization_id=$1 AND patient_id=$2 AND version=$3',[org,patientId,version],c);
 if(!budget)throw new NotFoundException('No encontramos esa versión del presupuesto.');
 const [patient]=await query('SELECT first_name,last_name,record_number FROM patients WHERE organization_id=$1 AND id=$2',[org,patientId],c);
 const [organization]=await query('SELECT name,address,phone,timezone FROM organizations WHERE id=$1',[org],c);return {budget,patient,organization};
}
@Controller('api/patients/:patientId/budget')
export class BudgetAcceptancesController{
 constructor(@Inject(Access)private access:Access){}
 @Get(':version/document') async document(@Param('patientId')patientId:string,@Param('version')raw:string,@Req()req:AuthRequest){
  const a=await this.access.tenant(req,'patients.view');await this.access.tenant(req,'budgets.view');parse(uuid,patientId);const version=parse(z.coerce.number().int().positive(),raw);
  return patientTransaction(a.organizationId!,async c=>{
   const [acceptance]=await query('SELECT b.id,b.version,b.accepted_by,b.relationship,b.notes,b.snapshot,b.created_at,u.name AS author FROM budget_acceptances b JOIN users u ON u.id=b.created_by WHERE organization_id=$1 AND patient_id=$2 AND version=$3',[a.organizationId,patientId,version],c);
   const data=acceptance?.snapshot||await snapshot(a.organizationId!,patientId,version,c);
   const [latest]=await query('SELECT max(version) AS version FROM patient_budget_versions WHERE organization_id=$1 AND patient_id=$2',[a.organizationId,patientId],c);
   const [current]=await query('SELECT version FROM budget_acceptances WHERE organization_id=$1 AND patient_id=$2 ORDER BY version DESC LIMIT 1',[a.organizationId,patientId],c);
   const paymentLocked=(await query('SELECT p.id FROM patient_payments p WHERE p.organization_id=$1 AND p.patient_id=$2 AND NOT EXISTS(SELECT 1 FROM payment_voids v WHERE v.organization_id=p.organization_id AND v.payment_id=p.id) LIMIT 1',[a.organizationId,patientId],c)).length>0;
   await audit(req,'budget.document_viewed','patient',patientId,a.organizationId!,a.id,{after:{version}},c);return {payment_locked:paymentLocked,snapshot:data,acceptance:acceptance?{...acceptance,snapshot:undefined}:null,latest:latest.version,current_accepted_version:current?.version||null};
  });
 }
 @Post('accept') async accept(@Param('patientId')patientId:string,@Body()raw:unknown,@Req()req:AuthRequest){
  const a=await this.access.tenant(req,'patients.view');await this.access.tenant(req,'budgets.view');await this.access.tenant(req,'budgets.manage');parse(uuid,patientId);
  const input=parse(z.object({request_id:uuid,version:z.number().int().positive(),accepted_by:z.string().trim().min(1).max(180),relationship:z.string().trim().min(1).max(100),notes:z.string().trim().max(2000),reviewed:z.literal(true)}).strict(),raw),hash=digest(JSON.stringify({...input,patientId}));
  return patientTransaction(a.organizationId!,async c=>{
   await query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[a.organizationId+':budget-acceptance:'+input.request_id],c);
   await query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[a.organizationId+':budget:'+patientId],c);
   const [retry]=await query('SELECT id,version,request_hash FROM budget_acceptances WHERE organization_id=$1 AND request_id=$2',[a.organizationId,input.request_id],c);
   if(retry){if(retry.request_hash!==hash)throw new ConflictException('La solicitud ya se utilizó con otro contenido.');return {id:retry.id,version:retry.version};}
   const [patient]=await query('SELECT active FROM patients WHERE organization_id=$1 AND id=$2 FOR SHARE',[a.organizationId,patientId],c);if(!patient)throw new NotFoundException('No encontramos al paciente.');if(!patient.active)throw new BadRequestException('La ficha está inactiva.');
   const [existing]=await query('SELECT version FROM budget_acceptances WHERE organization_id=$1 AND patient_id=$2 AND version=$3',[a.organizationId,patientId,input.version],c);if(existing)throw new ConflictException('Esta versión ya tiene aceptación registrada. Actualiza el documento.');
   const [latest]=await query('SELECT max(version) AS version FROM patient_budget_versions WHERE organization_id=$1 AND patient_id=$2',[a.organizationId,patientId],c);if(latest?.version!==input.version)throw new ConflictException('El presupuesto cambió. Revisa la última versión antes de registrar aceptación.');
   if((await query('SELECT p.id FROM patient_payments p WHERE p.organization_id=$1 AND p.patient_id=$2 AND NOT EXISTS(SELECT 1 FROM payment_voids v WHERE v.organization_id=p.organization_id AND v.payment_id=p.id) LIMIT 1',[a.organizationId,patientId],c)).length)throw new ConflictException('El acuerdo tiene pagos registrados. La sustitución requiere un ajuste financiero; conserva el acuerdo actual. No anules pagos reales para cambiarlo.');
   const data=await snapshot(a.organizationId!,patientId,input.version,c);
   const [row]=await query('INSERT INTO budget_acceptances(organization_id,patient_id,version,request_id,request_hash,accepted_by,relationship,notes,snapshot,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id,version',[a.organizationId,patientId,input.version,input.request_id,hash,input.accepted_by,input.relationship,input.notes,JSON.stringify(data),a.id],c);
   await audit(req,'budget.acceptance_recorded','patient',patientId,a.organizationId!,a.id,{after:{version:input.version,id:row.id}},c);return row;
  });
 }
}


