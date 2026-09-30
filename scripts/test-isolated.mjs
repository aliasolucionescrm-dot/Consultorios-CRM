import 'dotenv/config';
import { Pool } from 'pg';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
if(process.env.NODE_ENV==='production')throw new Error('Tests disabled in production');
const adminUrl=new URL(process.env.MIGRATION_DATABASE_URL);
if(!['localhost','127.0.0.1'].includes(adminUrl.hostname))throw new Error('Isolated tests require local PostgreSQL');
const name=`alia_test_${randomBytes(6).toString('hex')}`;
adminUrl.pathname='/postgres';
const admin=new Pool({connectionString:adminUrl.toString()});
let created=false;
try{
 await admin.query(`CREATE DATABASE "${name}"`);created=true;
 const migration=new URL(process.env.MIGRATION_DATABASE_URL);migration.pathname=`/${name}`;
 const runtime=new URL(process.env.DATABASE_URL);runtime.pathname=`/${name}`;
 const env={...process.env,NODE_ENV:'test',DATABASE_URL:runtime.toString(),MIGRATION_DATABASE_URL:migration.toString(),MAIL_WORKER_ENABLED:'false',TEST_DATABASE_NAME:name};
 for(const args of [['node_modules/tsx/dist/cli.mjs','packages/database/src/migrate.ts'],['node_modules/vitest/vitest.mjs','run']]){
  const result=spawnSync(process.execPath,args,{env,stdio:'inherit'});
  if(result.status!==0){process.exitCode=result.status||1;break;}
 }
}finally{
 // Only the unpredictable database created by this invocation can be removed.
 if(created&&/^alia_test_[a-f0-9]{12}$/.test(name))await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
 await admin.end();
}
