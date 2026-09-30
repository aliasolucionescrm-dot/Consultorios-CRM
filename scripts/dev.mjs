import 'dotenv/config';
import { spawn } from 'node:child_process';
const processes=[spawn(process.execPath,['node_modules/tsx/dist/cli.mjs','watch','apps/api/src/main.ts'],{stdio:'inherit'}),spawn(process.execPath,['node_modules/next/dist/bin/next','dev','apps/web','--hostname','127.0.0.1'],{stdio:'inherit'})];
for(const child of processes)child.on('exit',()=>processes.forEach(p=>p.kill()));
process.on('SIGINT',()=>processes.forEach(p=>p.kill()));
