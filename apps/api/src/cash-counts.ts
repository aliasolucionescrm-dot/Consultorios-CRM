import {BadRequestException,Body,ConflictException,Controller,Get,Inject,NotFoundException,Param,Post,Req} from '@nestjs/common';
import {z} from 'zod';
import {Access,type AuthRequest,audit,digest,parse,uuid} from './core';
import {patientTransaction} from './patients';
import {query} from '../../../packages/database/src/client';
const amount=z.number().int().min(0).max(1000000000000);
export const countLine=z.object({currency:z.enum(['MXN','USD','EUR']),opening_minor:amount,counted_minor:amount,adjustments:z.array(z.object({direction:z.enum(['in','out']),amount_minor:amount.refine(v=>v>0),reason:z.string().trim().min(1).max(500)}).strict()).max(20),difference_reason:z.string().trim().max(1000)}).strict();
type Total={currency:string;method:string;received_minor:number;voided_minor:number};
export function calculateCount(lines:z.infer<typeof countLine>[],totals:Total[]){
 if(new Set(lines.map(l=>l.currency)).size!==lines.length)throw new BadRequestException('No repitas monedas.');
 const cash=totals.filter(t=>t.method==='cash');if(cash.some(t=>!lines.some(l=>l.currency===t.currency)))throw new BadRequestException('Incluye todas las monedas con efectivo del corte.');
 return lines.map(l=>{const total=cash.find(t=>t.currency===l.currency),received=total?.received_minor||0,adjustment=l.adjustments.reduce((n,a)=>n+(a.direction==='in'?a.amount_minor:-a.amount_minor),0),expected=l.opening_minor+received+adjustment,difference=l.counted_minor-expected;
 if(!Number.isSafeInteger(expected)||expected<0)throw new BadRequestException('El efectivo esperado no puede ser negativo. Revisa fondo y ajustes.');if(difference&&!l.difference_reason)throw new BadRequestException('Explica cada faltante o sobrante antes de guardar.');
 return {...l,received_minor:received,voided_records_minor:total?.voided_minor||0,adjustment_minor:adjustment,expected_minor:expected,difference_minor:difference};});
}
@Controller('api/cash-closures/:closureId/counts')
export class CashCountsController{
 constructor(@Inject(Access)private access:Access){}
 @Get() async read(@Param('closureId')closureId:string,@Req()req:AuthRequest){const a=await this.access.tenant(req,'cash_closures.view');parse(uuid,closureId);return patientTransaction(a.organizationId!,async c=>{
 const [closure]=await query('SELECT snapshot FROM cash_closures WHERE organization_id=$1 AND id=$2',[a.organizationId,closureId],c);if(!closure)throw new NotFoundException('No encontramos ese corte.');
 const rows=await query('SELECT x.id,x.version,x.input,x.result,x.notes,x.created_at,u.name AS author FROM cash_counts x JOIN users u ON u.id=x.created_by WHERE organization_id=$1 AND closure_id=$2 ORDER BY version DESC LIMIT 25',[a.organizationId,closureId],c);
 await audit(req,'cash.count_viewed','cash-closure',closureId,a.organizationId!,a.id,{},c);return {items:rows,version:rows[0]?.version||0,totals:closure.snapshot.totals};
 });}
 @Post() async save(@Param('closureId')closureId:string,@Body()raw:unknown,@Req()req:AuthRequest){const a=await this.access.tenant(req,'cash_closures.view');await this.access.tenant(req,'cash_closures.create');parse(uuid,closureId);
 const input=parse(z.object({request_id:uuid,version:z.number().int().nonnegative(),lines:z.array(countLine).min(1).max(3),notes:z.string().trim().max(2000),reviewed:z.literal(true)}).strict(),raw),hash=digest(JSON.stringify({...input,closureId}));
 if(input.version>0&&!input.notes)throw new BadRequestException('Explica el motivo de la corrección del arqueo.');
 return patientTransaction(a.organizationId!,async c=>{
 await query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[a.organizationId+':cash-count-request:'+input.request_id],c);await query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[a.organizationId+':cash-count:'+closureId],c);
 const [closure]=await query('SELECT snapshot FROM cash_closures WHERE organization_id=$1 AND id=$2',[a.organizationId,closureId],c);if(!closure)throw new NotFoundException('No encontramos ese corte.');
 const [retry]=await query('SELECT id,version,request_hash FROM cash_counts WHERE organization_id=$1 AND request_id=$2',[a.organizationId,input.request_id],c);if(retry){if(retry.request_hash!==hash)throw new ConflictException('La solicitud ya se utilizó con otro contenido.');return {id:retry.id,version:retry.version};}
 const [last]=await query('SELECT max(version) AS version FROM cash_counts WHERE organization_id=$1 AND closure_id=$2',[a.organizationId,closureId],c);if((last.version||0)!==input.version)throw new ConflictException('El arqueo cambió en otra sesión. Actualiza antes de corregirlo.');
 const result=calculateCount(input.lines,closure.snapshot.totals),version=input.version+1;
 const [row]=await query('INSERT INTO cash_counts(organization_id,closure_id,version,request_id,request_hash,input,result,notes,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,version',[a.organizationId,closureId,version,input.request_id,hash,JSON.stringify(input.lines),JSON.stringify(result),input.notes,a.id],c);await audit(req,'cash.count_saved','cash-closure',closureId,a.organizationId!,a.id,{after:{version,id:row.id}},c);return row;
 });}
}
