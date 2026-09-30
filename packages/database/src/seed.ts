import 'dotenv/config';
import { hash, argon2id } from 'argon2';
import { pool,query,transaction } from './client';
import { rolePermissions } from './roles';
async function seed() {
 if(process.env.NODE_ENV==='production'||process.env.ALLOW_DEMO_SEED!=='true') throw new Error('Demo seed requires explicit ALLOW_DEMO_SEED=true outside production');
 const password=process.env.DEMO_PASSWORD;
 if(!password||password.length<12)throw new Error('Set DEMO_PASSWORD with at least 12 characters');
 const passwordHash=await hash(password,{type:argon2id,memoryCost:65536,timeCost:3});
 await transaction(async c=>{
  if((await query('SELECT id FROM users WHERE email=$1',['ana@alia.example'],c)).length) {console.log('Seed already present');return;}
  const [account]=await query("INSERT INTO accounts(name) VALUES('Cuenta demostración Alia') RETURNING id",[],c);
  const [org]=await query("INSERT INTO organizations(account_id,name) VALUES($1,'Clínica Dental Alia') RETURNING id",[account.id],c);
  await query("INSERT INTO branches(organization_id,name,address) VALUES($1,'Altabrisa','Mérida, Yucatán · Datos ficticios')",[org.id],c);
  const all=(await query<{code:string}>('SELECT code FROM permissions',[],c)).map(r=>r.code);
  const roles:Record<string,string>={};
  for(const [name,permissions] of Object.entries(rolePermissions)){
   const [role]=await query('INSERT INTO roles(organization_id,name,system) VALUES($1,$2,true) RETURNING id',[org.id,name],c);roles[name]=role.id;
   for(const permission of permissions[0]==='*'?all:permissions)await query('INSERT INTO role_permissions VALUES($1,$2,$3)',[org.id,role.id,permission],c);
  }
  for(const [name,email,role] of [['Dra. Ana Martínez','ana@alia.example','Propietario'],['Dr. Carlos Pérez','carlos@alia.example','Odontólogo']]){
   const [user]=await query('INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3) RETURNING id',[name,email,passwordHash],c);
   await query('INSERT INTO memberships(organization_id,user_id,role_id) VALUES($1,$2,$3)',[org.id,user.id,roles[role]],c);
  }
  await query("INSERT INTO audit_logs(organization_id,action,entity,entity_id,metadata) VALUES($1::uuid,'demo.seed','organization',$1::text,'{\"fictional\":true}')",[org.id],c);
 });
 console.log('Fictional foundation seeded; no phase 2 data created.');
}
seed().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>pool.end());
