import 'dotenv/config';
import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
async function main(){
 if(process.env.NODE_ENV==='production')throw new Error('Local development only');
 const url=new URL(process.env.MIGRATION_DATABASE_URL||process.env.DATABASE_URL!);
 if(!['localhost','127.0.0.1'].includes(url.hostname))throw new Error('Local database URL required');
 const databaseDir=resolve('.local/postgres');
 const pg=new EmbeddedPostgres({databaseDir,user:decodeURIComponent(url.username),password:decodeURIComponent(url.password),port:Number(url.port),persistent:true,authMethod:'scram-sha-256',postgresFlags:['-h','127.0.0.1'],onLog:()=>{},onError:message=>console.error(String(message))});
 if(!existsSync(resolve(databaseDir,'PG_VERSION')))await pg.initialise();
 await pg.start();
 const client=pg.getPgClient();await client.connect();
 const name=url.pathname.slice(1);if(!/^[a-z_]+$/.test(name))throw new Error('Invalid local database name');
 if(!(await client.query('SELECT 1 FROM pg_database WHERE datname=$1',[name])).rowCount)await client.query(`CREATE DATABASE "${name}"`);
 await client.end();console.log(`PostgreSQL ready on localhost:${url.port}/${name}`);
 const stop=async()=>{await pg.stop();process.exit();};process.on('SIGINT',stop);process.on('SIGTERM',stop);
 setInterval(()=>{},60000);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
