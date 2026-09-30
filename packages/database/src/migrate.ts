import 'dotenv/config';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { Pool } from 'pg';
async function migrate() {
 const pool = new Pool({connectionString:process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL});
 const client = await pool.connect();
 try {
  await client.query("SELECT pg_advisory_lock(819274)");
  await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
  const dir=resolve('packages/database/migrations');
  for(const name of (await readdir(dir)).filter(n=>n.endsWith('.sql')).sort()) {
   const content=await readFile(resolve(dir,name),'utf8'); const checksum=createHash('sha256').update(content).digest('hex');
   const prior=await client.query('SELECT checksum FROM schema_migrations WHERE name=$1',[name]);
   if(prior.rows.length) {if(prior.rows[0].checksum!==checksum) throw new Error(`Migration altered: ${name}`); continue;}
   await client.query('BEGIN');
   try {await client.query(content); await client.query('INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)',[name,checksum]); await client.query('COMMIT'); console.log(`Applied ${name}`);}
   catch(error){await client.query('ROLLBACK');throw error;}
  }
 } finally {await client.query('SELECT pg_advisory_unlock(819274)');client.release();await pool.end();}
}
migrate().catch(error=>{console.error(error);process.exitCode=1;});
