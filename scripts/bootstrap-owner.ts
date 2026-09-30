import 'dotenv/config';
import { Pool } from 'pg';
import { hash,argon2id } from 'argon2';
import { z } from 'zod';
async function main(){
 const input=z.object({email:z.email(),name:z.string().min(2).max(160),password:z.string().min(16).max(128)}).parse({email:process.env.BOOTSTRAP_EMAIL,name:process.env.BOOTSTRAP_NAME,password:process.env.BOOTSTRAP_PASSWORD});
 if(!process.env.MIGRATION_DATABASE_URL)throw new Error('Migration credentials required');
 const pool=new Pool({connectionString:process.env.MIGRATION_DATABASE_URL});const c=await pool.connect();
 try{
  await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(819276)');
  if((await c.query('SELECT id FROM users LIMIT 1')).rowCount)throw new Error('Bootstrap only allowed in an empty installation');
  const passwordHash=await hash(input.password,{type:argon2id,memoryCost:65536,timeCost:3,parallelism:1});
  const user=(await c.query('INSERT INTO users(email,name,password_hash) VALUES($1,$2,$3) RETURNING id',[input.email.toLowerCase(),input.name,passwordHash])).rows[0];
  await c.query("INSERT INTO audit_logs(user_id,action,entity,entity_id) VALUES($1::uuid,'installation.bootstrap','user',$1::text)",[user.id]);
  await c.query('COMMIT');console.log('Initial account created. Sign in, create your organization and activate MFA.');
 }catch(error){await c.query('ROLLBACK');throw error;}finally{c.release();await pool.end();}
}
main().catch(()=>{console.error('Bootstrap refused. Check fields, credentials and that the installation has no users.');process.exitCode=1;});
