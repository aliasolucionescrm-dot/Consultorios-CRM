import { Controller,Get,Inject,Query,Req } from '@nestjs/common';
import { z } from 'zod';
import { Access,type AuthRequest,parse,audit } from './core';
import { patientTransaction } from './patients';
import { query } from '../../../packages/database/src/client';
@Controller('api/search')
export class SearchController {
 constructor(@Inject(Access)private access:Access){}
 @Get() async search(@Query()raw:unknown,@Req()req:AuthRequest){
  const a=await this.access.tenant(req),{q}=parse(z.object({q:z.string().trim().min(2).max(100)}).strict(),raw);
  return patientTransaction(a.organizationId!,async c=>{
   const groups:{kind:string;items:Record<string,unknown>[];hasMore:boolean}[]=[];
   const pattern='%'+q.replace(/[\\%_]/g,'\\$&')+'%';
   if(a.permissions.includes('catalogs.view'))for(const kind of ['professionals','rooms','services']){
    const rows=await query(`SELECT id,name,active FROM ${kind} WHERE organization_id=$1 AND (patient_search_normalize(name) LIKE patient_search_normalize($2)${kind==='services'?' OR patient_search_normalize(code) LIKE patient_search_normalize($2)':''}) ORDER BY active DESC,name,id LIMIT 6`,[a.organizationId,pattern],c);
    groups.push({kind,items:rows.slice(0,5),hasMore:rows.length>5});
   }
   if(a.permissions.includes('appointments.view')){
    const rows=await query(`SELECT a.id,a.branch_id,b.name AS branch_name,p.first_name||' '||p.last_name AS name,s.name AS service_name,a.status,a.starts_at,to_char(a.starts_at AT TIME ZONE o.timezone,'YYYY-MM-DD') AS date FROM appointments a JOIN patients p ON p.id=a.patient_id JOIN services s ON s.id=a.service_id JOIN professionals pr ON pr.id=a.professional_id JOIN rooms r ON r.id=a.room_id JOIN branches b ON b.id=a.branch_id JOIN organizations o ON o.id=a.organization_id WHERE a.organization_id=$1 AND (patient_search_normalize(p.first_name||' '||p.last_name) LIKE patient_search_normalize($2) OR patient_search_normalize(p.record_number) LIKE patient_search_normalize($2) OR patient_search_normalize(s.name) LIKE patient_search_normalize($2) OR patient_search_normalize(pr.name) LIKE patient_search_normalize($2) OR patient_search_normalize(r.name) LIKE patient_search_normalize($2)) ORDER BY (a.starts_at>=now()) DESC,abs(extract(epoch FROM a.starts_at-now())),a.id LIMIT 6`,[a.organizationId,pattern],c);
    groups.push({kind:'appointments',items:rows.slice(0,5),hasMore:rows.length>5});
   }
   await audit(req,'search.operational','search',null,a.organizationId!,a.id,{after:{count:groups.reduce((n,g)=>n+g.items.length,0)}},c);
   return {groups};
  });
 }
}
