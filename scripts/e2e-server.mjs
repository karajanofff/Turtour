import {spawn} from 'node:child_process';
const api=process.argv[2]==='api';process.env.NODE_ENV=api?'test':'development';process.env.PORT=api?'4100':'3100';process.env.WEB_ORIGIN='http://localhost:3100';process.env.API_INTERNAL_URL='http://127.0.0.1:4100';
if(!new URL(process.env.DATABASE_URL).pathname.endsWith('_test'))throw new Error('E2E test DB required');
const child=spawn(process.execPath,api?['apps/api/dist/apps/api/src/main.js']:['node_modules/next/dist/bin/next','dev','apps/web','--hostname','127.0.0.1','--port','3100'],{stdio:'inherit',env:process.env});
for(const s of ['SIGINT','SIGTERM'])process.on(s,()=>child.kill());child.on('exit',c=>{process.exitCode=c??1;});
