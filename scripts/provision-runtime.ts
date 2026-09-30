import 'dotenv/config';
import { Pool } from 'pg';
import { randomBytes, pbkdf2Sync, createHmac, createHash } from 'node:crypto';
// SCRAM verifier keeps the clear-text password out of SQL/logs.
export function scramVerifier(password:string):string {
 const salt=randomBytes(16),iterations=4096;
 const salted=pbkdf2Sync(password,salt,iterations,32,'sha256');
 const client=createHmac('sha256',salted).update('Client Key').digest();
 const stored=createHash('sha256').update(client).digest('base64');
 const server=createHmac('sha256',salted).update('Server Key').digest('base64');
 return `SCRAM-SHA-256$${iterations}:${salt.toString('base64')}$${stored}:${server}`;
}
async function main(){
 const password=process.env.APP_DB_PASSWORD;
 if(!password||!/^[a-f0-9]{48,128}$/i.test(password))throw new Error('APP_DB_PASSWORD must be 24+ random bytes in hexadecimal');
 if(!process.env.MIGRATION_DATABASE_URL)throw new Error('MIGRATION_DATABASE_URL required');
 const pool=new Pool({connectionString:process.env.MIGRATION_DATABASE_URL});
 const c=await pool.connect();
 try{
  await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(819275)');
  const existing=await c.query("SELECT rolsuper,rolcreatedb,rolcreaterole,rolbypassrls FROM pg_roles WHERE rolname='alia_runtime'");
  if(!existing.rowCount)await c.query('CREATE ROLE alia_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS');
  else if(Object.values(existing.rows[0]).some(Boolean))throw new Error('Refusing to repurpose an elevated role');
  const verifier=scramVerifier(password);
  await c.query(`ALTER ROLE alia_runtime PASSWORD '${verifier}'`);
  await c.query('GRANT alia_app TO alia_runtime');
  await c.query('COMMIT');console.log('Runtime role provisioned. No schema ownership or DDL granted.');
 }catch(error){await c.query('ROLLBACK');throw error;}finally{c.release();await pool.end();}
}
main().catch(()=>{console.error('Runtime provisioning failed. Check migration credentials, privileges and APP_DB_PASSWORD.');process.exitCode=1;});
