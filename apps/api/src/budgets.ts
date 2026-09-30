import { BadRequestException,Body,ConflictException,Controller,Get,Inject,NotFoundException,Param,Post,Query,Req } from '@nestjs/common';
import { z } from 'zod';
import { Access,type AuthRequest,audit,parse,uuid } from './core';
import { patientTransaction } from './patients';
import { query } from '../../../packages/database/src/client';
const line=z.object({plan_item_id:uuid,quantity:z.number().int().min(1).max(100),unit_minor:z.number().int().min(0).max(100000000),discount_minor:z.number().int().min(0).max(10000000000)}).strict();
const inputSchema=z.object({request_id:uuid,version:z.number().int().nonnegative(),plan_version:z.number().int().positive(),currency:z.enum(['MXN','USD','EUR']),title:z.string().trim().min(1).max(120),items:z.array(line).min(1).max(100)}).strict();
type PlanItem={id:string;title:string;tooth:string;status:string;service_id?:string};
@Controller('api/patients/:patientId/budget')
export class BudgetsController {
 constructor(@Inject(Access)private access:Access){}
 @Get('source') async source(@Param('patientId')patientId:string,@Req()req:AuthRequest){
  const a=await this.access.tenant(req,'patients.view');await this.access.tenant(req,'budgets.manage');await this.access.tenant(req,'clinical_records.view');parse(uuid,patientId);
  return patientTransaction(a.organizationId!,async c=>{
   const [patient]=await query('SELECT active FROM patients WHERE organization_id=$1 AND id=$2',[a.organizationId,patientId],c);if(!patient)throw new NotFoundException('No encontramos al paciente.');if(!patient.active)throw new BadRequestException('La ficha está inactiva.');
   const [org]=await query('SELECT currency FROM organizations WHERE id=$1',[a.organizationId],c);
   const [plan]=await query('SELECT version,items FROM treatment_plan_versions WHERE organization_id=$1 AND patient_id=$2 ORDER BY version DESC LIMIT 1',[a.organizationId,patientId],c);
   const services=await query('SELECT id,price_minor,currency FROM services WHERE organization_id=$1 AND active',[a.organizationId],c);
   const items=(plan?.items||[]).filter((i:PlanItem)=>i.status!=='cancelled').map((i:PlanItem)=>{const service=services.find(s=>s.id===i.service_id&&s.currency===org.currency);return {plan_item_id:i.id,title:i.title,tooth:i.tooth,quantity:1,unit_minor:service?.price_minor??null,discount_minor:0};});
   await audit(req,'budget.source_viewed','patient',patientId,a.organizationId!,a.id,{},c);return {plan_version:plan?.version||0,currency:org.currency,items};
  });
 }
 @Get() async read(@Param('patientId')patientId:string,@Query()raw:unknown,@Req()req:AuthRequest){
  const a=await this.access.tenant(req,'patients.view');await this.access.tenant(req,'budgets.view');parse(uuid,patientId);const input=parse(z.object({version:z.coerce.number().int().positive().optional()}).strict(),raw);
  return patientTransaction(a.organizationId!,async c=>{
   if(!(await query('SELECT id FROM patients WHERE organization_id=$1 AND id=$2',[a.organizationId,patientId],c)).length)throw new NotFoundException('No encontramos al paciente.');
   const history=await query('SELECT b.version,b.title,b.created_at,u.name AS author FROM patient_budget_versions b JOIN users u ON u.id=b.created_by WHERE b.organization_id=$1 AND b.patient_id=$2 ORDER BY b.version DESC LIMIT 25',[a.organizationId,patientId],c),latest=history[0]?.version||0;
   const [budget]=await query('SELECT version,plan_version,currency,title,items,total_minor::float8 AS total_minor FROM patient_budget_versions WHERE organization_id=$1 AND patient_id=$2 AND version=$3',[a.organizationId,patientId,input.version||latest],c);
   if(input.version&&!budget)throw new NotFoundException('No encontramos esa versión.');await audit(req,'budget.viewed','patient',patientId,a.organizationId!,a.id,{},c);const [accepted]=await query('SELECT version FROM budget_acceptances WHERE organization_id=$1 AND patient_id=$2 ORDER BY version DESC LIMIT 1',[a.organizationId,patientId],c);return {budget:budget||null,latest,history,accepted_version:accepted?.version||null};
  });
 }
 @Post() async save(@Param('patientId')patientId:string,@Body()body:unknown,@Req()req:AuthRequest){
  const a=await this.access.tenant(req,'patients.view');await this.access.tenant(req,'budgets.view');await this.access.tenant(req,'budgets.manage');await this.access.tenant(req,'clinical_records.view');parse(uuid,patientId);const input=parse(inputSchema,body);
  if(new Set(input.items.map(i=>i.plan_item_id)).size!==input.items.length)throw new BadRequestException('Hay procedimientos repetidos.');
  return patientTransaction(a.organizationId!,async c=>{
   await query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[a.organizationId+':budget:'+patientId],c);
   const [prior]=await query('SELECT * FROM patient_budget_versions WHERE organization_id=$1 AND request_id=$2',[a.organizationId,input.request_id],c);
   if(prior){const same=prior.patient_id===patientId&&prior.version===input.version+1&&prior.title===input.title&&prior.currency===input.currency&&prior.plan_version===input.plan_version&&JSON.stringify(prior.items.map((i:z.infer<typeof line>)=>({plan_item_id:i.plan_item_id,quantity:i.quantity,unit_minor:i.unit_minor,discount_minor:i.discount_minor})))===JSON.stringify(input.items);if(!same)throw new ConflictException('La solicitud ya se utilizó con otro contenido.');return {version:prior.version};}
   const [patient]=await query('SELECT active FROM patients WHERE organization_id=$1 AND id=$2 FOR SHARE',[a.organizationId,patientId],c);if(!patient)throw new NotFoundException('No encontramos al paciente.');if(!patient.active)throw new BadRequestException('La ficha está inactiva.');
   const [last]=await query('SELECT version FROM patient_budget_versions WHERE organization_id=$1 AND patient_id=$2 ORDER BY version DESC LIMIT 1',[a.organizationId,patientId],c);if((last?.version||0)!==input.version)throw new ConflictException('El presupuesto cambió en otra sesión. Conserva tus importes y vuelve a cargarlo.');
   const [org]=await query('SELECT currency FROM organizations WHERE id=$1 FOR SHARE',[a.organizationId],c);if(input.currency!==org.currency)throw new ConflictException('La moneda de la organización cambió. Prepara una nueva versión.');
   const [plan]=await query('SELECT items FROM treatment_plan_versions WHERE organization_id=$1 AND patient_id=$2 AND version=$3',[a.organizationId,patientId,input.plan_version],c);if(!plan)throw new BadRequestException('No encontramos el plan de origen.');
   const items=input.items.map(i=>{const original=(plan.items as PlanItem[]).find(p=>p.id===i.plan_item_id&&p.status!=='cancelled');if(!original)throw new BadRequestException('El procedimiento no pertenece a esta versión del plan.');const total=i.quantity*i.unit_minor-i.discount_minor;if(total<0)throw new BadRequestException('El descuento supera el importe del procedimiento.');return {...i,title:original.title,tooth:original.tooth,total_minor:total};});
   const total=items.reduce((n,i)=>n+i.total_minor,0),version=input.version+1;
   await query('INSERT INTO patient_budget_versions(organization_id,patient_id,version,request_id,plan_version,currency,title,items,total_minor,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[a.organizationId,patientId,version,input.request_id,input.plan_version,input.currency,input.title,JSON.stringify(items),total,a.id],c);
   await audit(req,'budget.saved','patient',patientId,a.organizationId!,a.id,{after:{version,plan_version:input.plan_version}},c);return {version};
  });
 }
}

