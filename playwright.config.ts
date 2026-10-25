import {defineConfig,devices} from '@playwright/test';
process.loadEnvFile('.env');
const url=new URL(process.env.DATABASE_URL!);url.pathname='/kttravel_test';process.env.DATABASE_URL=url.toString();
process.env.WEB_ORIGIN='http://localhost:3100';process.env.API_INTERNAL_URL='http://127.0.0.1:4100';
export default defineConfig({testDir:'tests/e2e',timeout:60000,workers:1,fullyParallel:false,reporter:[['list'],['html',{open:'never'}]],use:{baseURL:'http://localhost:3100',channel:'msedge',trace:'retain-on-failure',screenshot:'only-on-failure'},projects:[{name:'desktop',use:{...devices['Desktop Edge']}},{name:'mobile',use:{viewport:{width:390,height:844},isMobile:true,hasTouch:true}}],webServer:[{command:'node scripts/e2e-server.mjs api',url:'http://127.0.0.1:4100/health/ready',reuseExistingServer:false,timeout:30000},{command:'node scripts/e2e-server.mjs web',url:'http://localhost:3100',reuseExistingServer:false,timeout:90000}]});
