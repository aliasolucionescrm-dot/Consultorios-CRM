import { Body,Controller,Get,Inject,Param,Patch,Post,Query,Req,NotFoundException,BadRequestException,ConflictException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { PoolClient } from 'pg';
import { Access,type AuthRequest,parse,uuid,email,audit } from './core';
import { query,transaction } from '../../../packages/database/src/client';
import { lockAvailability } from './availability';
const short=(max:number)=>z.string().trim().max(max).default('');
const base={name:z.string().trim().min(2).max(160),active:z.boolean().default(true)};
const categories=['Preventiva','Restaurativa','Endodoncia','Cirugía','Ortodoncia','Periodoncia','Implantología','Prótesis','Estética','Diagnóstico','Otros'] as const;
const definitions={
 professionals:{schema:z.object({...base,specialty:short(120),license:short(50),specialty_license:short(50),email:z.union([z.literal(''),email]).default(''),phone:short(30),relationship:z.enum(['unspecified','internal','external']).default('unspecified'),professional_title:short(80),training_institution:short(160),external_organization:short(160),practice_address:short(500),branch_ids:z.array(uuid).max(100).transform(v=>[...new Set(v)])}).strict(),columns:['name','active','specialty','license','specialty_license','email','phone','relationship','professional_title','training_institution','external_organization','practice_address']},
 rooms:{schema:z.object({...base,branch_id:uuid,number:short(30),chair:short(80),equipment:short(1000),notes:short(2000)}).strict(),columns:['name','active','branch_id','number','chair','equipment','notes']},
 services:{schema:z.object({...base,code:z.string().trim().min(1).max(30).regex(/^[A-Z0-9_-]+$/),category:z.enum(categories),specialty:short(120),duration_minutes:z.number().int().min(5).max(480),price_minor:z.number().int().min(0).max(100000000),cost_minor:z.number().int().min(0).max(100000000).default(0),currency:z.enum(['MXN','USD','EUR']),requires_tooth:z.boolean().default(false),requires_consent:z.boolean().default(false)}).strict(),columns:['name','active','code','category','specialty','duration_minutes','price_minor','cost_minor','currency','requires_tooth','requires_consent']}
};
type Kind=keyof typeof definitions;
function kind(value:string):Kind{return parse(z.enum(['professionals','rooms','services']),value);}
async function scope<T>(org:string,work:(c:PoolClient)=>Promise<T>){return transaction(async c=>{await c.query("SELECT set_config('app.organization_id',$1,true)",[org]);return work(c);});}
function projection(k:Kind){return `t.id,t.version,t.created_at,t.updated_at,${definitions[k].columns.map(x=>`t.${x}`).join(',')}${k==='professionals'?",coalesce((SELECT array_agg(pb.branch_id ORDER BY pb.branch_id) FROM professional_branches pb WHERE pb.organization_id=t.organization_id AND pb.professional_id=t.id),'{}') AS branch_ids":''}`;}

@ApiTags('Catálogos operativos')
@Controller('api/catalogs')
export class CatalogsController {
 constructor(@Inject(Access)private access:Access){}
 @Get('professionals/:id/services') async professionalServices(@Param('id')id:string,@Req()req:AuthRequest){
  const a=await this.access.tenant(req,'catalogs.view');parse(uuid,id);
  return scope(a.organizationId!,async c=>{
   const [p]=await query('SELECT version,restrict_services FROM professionals WHERE organization_id=$1 AND id=$2',[a.organizationId,id],c);
   if(!p)throw new NotFoundException('No encontramos el profesional.');
   const services=await query('SELECT s.id,s.name,s.active FROM professional_services ps JOIN services s ON s.organization_id=ps.organization_id AND s.id=ps.service_id WHERE ps.organization_id=$1 AND ps.professional_id=$2 ORDER BY s.name,s.id',[a.organizationId,id],c);
   return {...p,services};
  });
 }
 @Patch('professionals/:id/services') async saveProfessionalServices(@Param('id')id:string,@Body()body:unknown,@Req()req:AuthRequest){
  const a=await this.access.tenant(req,'catalogs.manage');parse(uuid,id);
  const input=parse(z.object({version:z.number().int().positive(),restrict_services:z.boolean(),service_ids:z.array(uuid).max(500).transform(v=>[...new Set(v)])}).strict(),body);
  return scope(a.organizationId!,async c=>{
   await lockAvailability(a.organizationId!,c);
   const [p]=await query('SELECT version FROM professionals WHERE organization_id=$1 AND id=$2 FOR UPDATE',[a.organizationId,id],c);
   if(!p)throw new NotFoundException('No encontramos el profesional.');
   if(p.version!==input.version)throw new ConflictException('El profesional cambió. Vuelve a abrir su configuración.');
   const ids=input.restrict_services?input.service_ids:[];
   const selected=await query('SELECT id FROM services WHERE organization_id=$1 AND id=ANY($2::uuid[]) FOR SHARE',[a.organizationId,ids],c);
   if(selected.length!==ids.length)throw new BadRequestException('Selecciona servicios de esta organización.');
   if(input.restrict_services&&(await query("SELECT id FROM appointments WHERE organization_id=$1 AND professional_id=$2 AND occupied_until>now() AND status IN ('pending','confirmed','arrived','in_consultation') AND NOT(service_id=ANY($3::uuid[])) LIMIT 1",[a.organizationId,id,ids],c)).length)throw new ConflictException('Hay citas pendientes con servicios que intentas retirar. Reasígnalas o cancélalas primero.');
   await query('DELETE FROM professional_services WHERE organization_id=$1 AND professional_id=$2',[a.organizationId,id],c);
   for(const service of ids)await query('INSERT INTO professional_services VALUES($1,$2,$3)',[a.organizationId,id,service],c);
   const [result]=await query('UPDATE professionals SET restrict_services=$3,version=version+1,updated_at=now() WHERE organization_id=$1 AND id=$2 RETURNING version',[a.organizationId,id,input.restrict_services],c);
   await audit(req,'professionals.services_updated','professionals',id,a.organizationId!,a.id,{before:{version:p.version},after:{version:result.version,restrict_services:input.restrict_services,service_ids:ids}},c);
   return result;
  });
 }
 @Get('professionals/:id/rooms') async professionalRooms(@Param('id')id:string,@Req()req:AuthRequest){
  const a=await this.access.tenant(req,'catalogs.view');parse(uuid,id);
  return scope(a.organizationId!,async c=>{
   const [p]=await query('SELECT version,restrict_rooms FROM professionals WHERE organization_id=$1 AND id=$2',[a.organizationId,id],c);
   if(!p)throw new NotFoundException('No encontramos el profesional.');
   const rooms=await query('SELECT s.id,s.name,s.active,s.branch_id FROM professional_rooms ps JOIN rooms s ON s.organization_id=ps.organization_id AND s.id=ps.room_id WHERE ps.organization_id=$1 AND ps.professional_id=$2 ORDER BY s.name,s.id',[a.organizationId,id],c);
   return {...p,rooms};
  });
 }
 @Patch('professionals/:id/rooms') async saveProfessionalRooms(@Param('id')id:string,@Body()body:unknown,@Req()req:AuthRequest){
  const a=await this.access.tenant(req,'catalogs.manage');parse(uuid,id);
  const input=parse(z.object({version:z.number().int().positive(),restrict_rooms:z.boolean(),room_ids:z.array(uuid).max(500).transform(v=>[...new Set(v)])}).strict(),body);
  return scope(a.organizationId!,async c=>{
   await lockAvailability(a.organizationId!,c);
   const [p]=await query('SELECT version FROM professionals WHERE organization_id=$1 AND id=$2 FOR UPDATE',[a.organizationId,id],c);
   if(!p)throw new NotFoundException('No encontramos el profesional.');
   if(p.version!==input.version)throw new ConflictException('El profesional cambió. Vuelve a abrir su configuración.');
   const ids=input.restrict_rooms?input.room_ids:[];
   const selected=await query('SELECT r.id FROM rooms r JOIN professional_branches pb ON pb.organization_id=r.organization_id AND pb.branch_id=r.branch_id WHERE r.organization_id=$1 AND r.id=ANY($2::uuid[]) AND pb.professional_id=$3 FOR SHARE OF r',[a.organizationId,ids,id],c);
   if(selected.length!==ids.length)throw new BadRequestException('Selecciona consultorios de las sucursales del profesional.');
   if(input.restrict_rooms&&(await query("SELECT id FROM appointments WHERE organization_id=$1 AND professional_id=$2 AND occupied_until>now() AND status IN ('pending','confirmed','arrived','in_consultation') AND NOT(room_id=ANY($3::uuid[])) LIMIT 1",[a.organizationId,id,ids],c)).length)throw new ConflictException('Hay citas pendientes con consultorios que intentas retirar. Reasígnalas o cancélalas primero.');
   await query('DELETE FROM professional_rooms WHERE organization_id=$1 AND professional_id=$2',[a.organizationId,id],c);
   for(const service of ids)await query('INSERT INTO professional_rooms VALUES($1,$2,$3)',[a.organizationId,id,service],c);
   const [result]=await query('UPDATE professionals SET restrict_rooms=$3,version=version+1,updated_at=now() WHERE organization_id=$1 AND id=$2 RETURNING version',[a.organizationId,id,input.restrict_rooms],c);
   await audit(req,'professionals.rooms_updated','professionals',id,a.organizationId!,a.id,{before:{version:p.version},after:{version:result.version,restrict_rooms:input.restrict_rooms,room_ids:ids}},c);
   return result;
  });
 }
 @Get(':kind') async list(@Param('kind')rawKind:string,@Query()raw:unknown,@Req()req:AuthRequest){
  const k=kind(rawKind),a=await this.access.tenant(req,'catalogs.view');
  const input=parse(z.object({relationship:z.enum(['all','unspecified','internal','external']).default('all'),id:uuid.optional(),q:z.string().trim().max(100).default(''),status:z.enum(['active','inactive','all']).default('active'),page:z.coerce.number().int().min(1).max(10000).default(1)}).strict(),raw);
  return scope(a.organizationId!,async c=>{
   const args:unknown[]=[a.organizationId],where=['t.organization_id=$1'];
   if(input.relationship!=='all'){if(k!=='professionals')throw new BadRequestException('El filtro de relación solo aplica a profesionales.');args.push(input.relationship);where.push(`t.relationship=$${args.length}`);}
   if(input.id){args.push(input.id);where.push(`t.id=$${args.length}`);}
   if(input.status!=='all'){args.push(input.status==='active');where.push(`t.active=$${args.length}`);}
   if(input.q){args.push(`%${input.q.replace(/[\\%_]/g,'\\$&')}%`);where.push(`t.name ILIKE $${args.length}`);}
   args.push((input.page-1)*25);const rows=await query(`SELECT ${projection(k)} FROM ${k} t WHERE ${where.join(' AND ')} ORDER BY t.name,t.id LIMIT 26 OFFSET $${args.length}`,args,c);
   return {items:rows.slice(0,25),hasMore:rows.length>25};
  });
 }
 @Get('services/:id/prices') async prices(@Param('id')id:string,@Req()req:AuthRequest){
  const a=await this.access.tenant(req,'catalogs.manage');parse(uuid,id);
  return scope(a.organizationId!,async c=>{
   if(!(await query('SELECT id FROM services WHERE id=$1 AND organization_id=$2',[id,a.organizationId],c)).length)throw new NotFoundException('No encontramos el servicio.');
   return query('SELECT price_minor,cost_minor,currency,version,created_at FROM service_price_history WHERE organization_id=$1 AND service_id=$2 ORDER BY version DESC LIMIT 100',[a.organizationId,id],c);
  });
 }
 @Post(':kind') async create(@Param('kind')k:string,@Body()body:unknown,@Req()req:AuthRequest){return this.save(kind(k),null,body,req);}
 @Patch(':kind/:id') async update(@Param('kind')k:string,@Param('id')id:string,@Body()body:unknown,@Req()req:AuthRequest){parse(uuid,id);return this.save(kind(k),id,body,req);}
 private async save(k:Kind,id:string|null,body:unknown,req:AuthRequest){
  const a=await this.access.tenant(req,'catalogs.manage'),definition=definitions[k];
  const raw=parse(z.record(z.string(),z.unknown()),body),{version,reason,...fields}=raw;
  if(id)parse(z.number().int().positive(),version);else if(version!==undefined)throw new BadRequestException('La versión se asigna al crear el registro.');
  const reasonText=reason===undefined?undefined:parse(z.string().trim().min(1).max(500),reason);
  const input=parse(definition.schema as z.ZodType<Record<string,unknown>>,fields);
  return scope(a.organizationId!,async c=>{
   if(k==='professionals')await lockAvailability(a.organizationId!,c);
   let before:Record<string,unknown>|undefined;
   if(id){[before]=await query(`SELECT ${projection(k)} FROM ${k} t WHERE t.id=$1 AND t.organization_id=$2 FOR UPDATE OF t`,[id,a.organizationId],c);
    if(!before)throw new NotFoundException('No encontramos este registro en la organización.');
    if(before.version!==version)throw new ConflictException('El registro cambió. Cierra el formulario y vuelve a abrirlo para editar la versión actual.');
    if(before.active!==input.active&&!reasonText)throw new BadRequestException('Indica el motivo del cambio de estado.');
   }
   const branchIds=k==='professionals'?input.branch_ids as string[]:k==='rooms'?[input.branch_id as string]:[];
   if(k==='professionals'){
    if(!branchIds.length&&input.relationship!=='external')throw new BadRequestException('Selecciona al menos una sucursal para este profesional.');
    if(id&&(await query("SELECT id FROM appointments WHERE organization_id=$1 AND professional_id=$2 AND occupied_until>now() AND status IN ('pending','confirmed','arrived','in_consultation') AND NOT(branch_id=ANY($3::uuid[])) LIMIT 1",[a.organizationId,id,branchIds],c)).length)throw new ConflictException('Hay citas pendientes en sucursales que intentas retirar. Reasígnalas o cancélalas primero.');
   }
   for(const branchId of branchIds){
    const [branch]=await query('SELECT active FROM branches WHERE organization_id=$1 AND id=$2 FOR SHARE',[a.organizationId,branchId],c);
    if(!branch||(!branch.active&&input.active))throw new BadRequestException('Selecciona sucursales activas de esta organización.');
   }
   if(k==='services'){
    const [org]=await query('SELECT currency FROM organizations WHERE id=$1 FOR SHARE',[a.organizationId],c);
    if(input.currency!==org.currency)throw new BadRequestException('La moneda debe coincidir con la organización.');
   }
   let result;
   if(id){const values=[id,a.organizationId,...definition.columns.map(key=>input[key])];[result]=await query(`UPDATE ${k} SET ${definition.columns.map((key,i)=>`${key}=$${i+3}`).join(',')},version=version+1,updated_at=now() WHERE id=$1 AND organization_id=$2 RETURNING id,version`,values,c);}
   else{const values=[a.organizationId,...definition.columns.map(key=>input[key])];[result]=await query(`INSERT INTO ${k}(organization_id,${definition.columns.join(',')}) VALUES(${values.map((_,i)=>`$${i+1}`).join(',')}) RETURNING id,version`,values,c);}
   if(k==='professionals'){
    await query('DELETE FROM professional_branches WHERE organization_id=$1 AND professional_id=$2',[a.organizationId,result.id],c);
    for(const branch of branchIds)await query('INSERT INTO professional_branches VALUES($1,$2,$3)',[a.organizationId,result.id,branch],c);
   }
   if(k==='services'&&(!before||['price_minor','cost_minor','currency'].some(key=>before![key]!==input[key])))await query('INSERT INTO service_price_history(organization_id,service_id,user_id,price_minor,cost_minor,currency,version) VALUES($1,$2,$3,$4,$5,$6,$7)',[a.organizationId,result.id,a.id,input.price_minor,input.cost_minor,input.currency,result.version],c);
   await audit(req,`${k}.${id?'updated':'created'}`,k,result.id,a.organizationId!,a.id,{before:before?{version:before.version}:undefined,after:{version:result.version,fields:Object.keys(input)},reason:reasonText},c);
   return result;
  });
 }
}
