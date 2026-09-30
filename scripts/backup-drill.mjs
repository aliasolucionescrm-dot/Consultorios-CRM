import 'dotenv/config';
import { Pool } from 'pg';
import { spawn } from 'node:child_process';
import { randomBytes,createCipheriv,createDecipheriv,createHash } from 'node:crypto';
import { mkdir,readFile,writeFile,unlink } from 'node:fs/promises';
import { resolve,join } from 'node:path';

// Local restore rehearsal only: never restores into an existing or user-named DB.
if(process.env.NODE_ENV==='production')throw new Error('Run restore drills on an isolated local host');
const sourceUrl=new URL(process.env.MIGRATION_DATABASE_URL);
if(!['localhost','127.0.0.1'].includes(sourceUrl.hostname))throw new Error('Local database required');
if(!/^[a-f0-9]{64}$/i.test(process.env.BACKUP_ENCRYPTION_KEY||''))throw new Error('Set BACKUP_ENCRYPTION_KEY to 32 random bytes encoded as hex');
const suffix=randomBytes(6).toString('hex'),name=`alia_restore_${suffix}`;
const dir=resolve('.local/backups');await mkdir(dir,{recursive:true});
const archive=join(dir,`${name}.dump`),encrypted=`${archive}.aes`,reportPath=join(dir,`${name}.json`);
const key=Buffer.from(process.env.BACKUP_ENCRYPTION_KEY,'hex');
const adminUrl=new URL(sourceUrl);adminUrl.pathname='/postgres';
const admin=new Pool({connectionString:adminUrl.toString()}),source=new Pool({connectionString:sourceUrl.toString()});
const restoredUrl=new URL(sourceUrl);restoredUrl.pathname=`/${name}`;
const restored=new Pool({connectionString:restoredUrl.toString()});
let created=false,plainCreated=false;
const sourceClient=await source.connect();
function run(tool,args,url){
 const executable=process.env.PG_BIN?join(process.env.PG_BIN,`${tool}${process.platform==='win32'?'.exe':''}`):tool;
 const env={...process.env,PGHOST:url.hostname,PGPORT:url.port||'5432',PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password),PGDATABASE:url.pathname.slice(1)};
 return new Promise((resolveRun,reject)=>{
  const child=spawn(executable,args,{env,windowsHide:true,stdio:['ignore','ignore','pipe']});let diagnostic='';
  child.stderr.on('data',chunk=>{diagnostic+=chunk.toString();});
  child.on('error',()=>reject(new Error(`${tool} could not start; check PG_BIN`)));
  child.on('exit',code=>code===0?resolveRun():reject(new Error(`${tool} failed (exit ${code}); ${diagnostic.replaceAll(decodeURIComponent(url.password),'[redacted]')}`)));
 });
}
async function fingerprint(connection){
 const tables=(await connection.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows;
 const result={};
 for(const {tablename} of tables){
  if(!/^[a-z_]+$/.test(tablename))throw new Error('Unexpected table name');
  const [row]=(await connection.query(`SELECT count(*)::int AS rows,md5(coalesce(string_agg(row_hash,'' ORDER BY row_hash),'')) AS checksum FROM (SELECT md5(to_jsonb(t)::text) AS row_hash FROM public."${tablename}" t) hashes`)).rows;
  result[tablename]=row;
 }
 return result;
}
try{
 await sourceClient.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 const snapshot=(await sourceClient.query('SELECT pg_export_snapshot() AS snapshot')).rows[0].snapshot;
 const expected=await fingerprint(sourceClient);
 await run('pg_dump',['--format=custom','--no-owner',`--snapshot=${snapshot}`,'--file',archive],sourceUrl);plainCreated=true;
 await sourceClient.query('COMMIT');
 const raw=await readFile(archive),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
 const ciphertext=Buffer.concat([cipher.update(raw),cipher.final()]);
 const envelope=Buffer.concat([Buffer.from('ALIA1'),iv,cipher.getAuthTag(),ciphertext]);
 await writeFile(encrypted,envelope,{mode:0o600,flag:'wx'});await unlink(archive);plainCreated=false;
 // Restore from the encrypted artifact rather than the original dump.
 const saved=await readFile(encrypted);if(saved.subarray(0,5).toString()!=='ALIA1')throw new Error('Invalid backup format');
 const decipher=createDecipheriv('aes-256-gcm',key,saved.subarray(5,17));decipher.setAuthTag(saved.subarray(17,33));
 await writeFile(archive,Buffer.concat([decipher.update(saved.subarray(33)),decipher.final()]),{mode:0o600,flag:'wx'});plainCreated=true;
 await admin.query(`CREATE DATABASE "${name}"`);created=true;
 await run('pg_restore',['--exit-on-error','--single-transaction','--no-owner','--dbname',name,archive],restoredUrl);
 const actual=await fingerprint(restored);
 if(JSON.stringify(expected)!==JSON.stringify(actual))throw new Error('Restored table counts/checksums differ from the source snapshot');
 const runtimeUrl=new URL(process.env.DATABASE_URL);runtimeUrl.pathname=`/${name}`;
 const runtime=new Pool({connectionString:runtimeUrl.toString()});
 try{
  await runtime.query('SELECT id FROM organizations LIMIT 1');
  try{await runtime.query('DELETE FROM audit_logs WHERE false');throw new Error('Audit privilege unexpectedly granted');}
  catch(error){if(error.code!=='42501')throw error;}
 }finally{await runtime.end();}
 await writeFile(reportPath,JSON.stringify({verified:true,at:new Date().toISOString(),tables:actual,encryptedArchive:encrypted,archiveSha256:createHash('sha256').update(saved).digest('hex'),runtimeRead:true,auditMutationDenied:true},null,2));
 console.log(`Restore verified: ${Object.keys(actual).length} tables; counts and content checksums match; runtime ACL preserved.`);
 console.log(`Evidence: ${reportPath}`);
}finally{
 await sourceClient.query('ROLLBACK').catch(()=>{});sourceClient.release();
 await source.end();await restored.end();
 if(created&&/^alia_restore_[a-f0-9]{12}$/.test(name))await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
 await admin.end();if(plainCreated)await unlink(archive);
}
