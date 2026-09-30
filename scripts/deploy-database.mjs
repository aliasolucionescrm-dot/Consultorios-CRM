import { spawnSync } from 'node:child_process';
for(const file of ['packages/database/src/migrate.ts','scripts/provision-runtime.ts']){
 const result=spawnSync(process.execPath,['node_modules/tsx/dist/cli.mjs',file],{stdio:'inherit'});
 if(result.status!==0)process.exit(result.status||1);
}
