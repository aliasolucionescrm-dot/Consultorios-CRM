import 'dotenv/config';
import { createHash } from 'node:crypto';
import { pool,query,transaction } from './client';
const fictional=[
 ['María Fernanda','López Navarro','1991-05-09','maria.fernanda@example.invalid'],
 ['Diego','Ramírez Solís','1988-11-22','diego.ramirez@example.invalid'],
 ['Valentina','Castillo Méndez','2002-02-14','valentina.castillo@example.invalid'],
 ['Alejandro','Pech Medina','1979-08-30','alejandro.pech@example.invalid'],
 ['Sofía','Hernández Cruz','2014-03-12',''],
 ['Lucía','García Torres','1997-06-18','lucia.garcia@example.invalid']
];
async function main(){
 if(process.env.NODE_ENV==='production'||process.env.ALLOW_DEMO_SEED!=='true')throw new Error('Demo seed must be explicitly enabled outside production');
 await transaction(async c=>{
  const [org]=await query("SELECT o.id FROM organizations o JOIN accounts a ON a.id=o.account_id WHERE o.name='Clínica Dental Alia' AND a.name='Cuenta demostración Alia' FOR UPDATE OF o",[],c);
  if(!org)throw new Error('Foundation demo organization required');
  await c.query("SELECT set_config('app.organization_id',$1,true)",[org.id]);
  for(const [index,row] of fictional.entries()){
   const requestId=`da000000-0000-4000-8000-${String(index+1).padStart(12,'0')}`;
   if((await query('SELECT id FROM patients WHERE organization_id=$1 AND request_id=$2',[org.id,requestId],c)).length)continue;
   const [sequence]=await query('UPDATE organizations SET record_sequence=record_sequence+1 WHERE id=$1 RETURNING record_prefix,record_sequence',[org.id],c);
   const record=`${sequence.record_prefix}${String(sequence.record_sequence).padStart(6,'0')}`;
   const [patient]=await query("INSERT INTO patients(organization_id,request_id,request_hash,record_number,first_name,last_name,birth_date,email,tags,administrative_notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,ARRAY['Demostración'],'Paciente ficticio para probar ALIA DENTAL. No utilizar para atención real.') RETURNING id",[org.id,requestId,createHash('sha256').update(JSON.stringify(row)).digest('hex'),record,...row],c);
   await query("INSERT INTO audit_logs(organization_id,action,entity,entity_id,metadata) VALUES($1,'patient.demo_created','patient',$2,'{\"fictional\":true}')",[org.id,patient.id],c);
  }
 });console.log('Fictional patient seed ready (idempotent).');
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>pool.end());
