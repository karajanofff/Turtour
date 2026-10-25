import {spawnSync} from 'node:child_process';
const url=new URL(process.env.DATABASE_URL);url.pathname='/kttravel_test';
process.env.DATABASE_URL=process.env.TEST_DATABASE_URL??url.toString();
if(!new URL(process.env.DATABASE_URL).pathname.endsWith('_test'))throw new Error('Integration tests require a database ending in _test');
const run=args=>{const r=spawnSync(process.execPath,args,{stdio:'inherit',env:process.env});if(r.status!==0)process.exit(r.status??1);};
run(['node_modules/typescript/bin/tsc','-p','apps/api/tsconfig.json']);
run(['node_modules/prisma/build/index.js','migrate','deploy','--schema','apps/api/prisma/schema.prisma']);
run(['node_modules/vitest/vitest.mjs','run','--config','vitest.integration.config.ts']);
