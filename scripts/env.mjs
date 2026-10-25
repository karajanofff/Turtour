import {existsSync,writeFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
if(existsSync('.env'))throw new Error('.env already exists; preserve existing secrets');
const postgres=randomBytes(24).toString('hex'),redis=randomBytes(24).toString('hex');
writeFileSync('.env',`NODE_ENV=development\nPORT=4000\nWEB_ORIGIN=http://localhost:3000\nAPI_INTERNAL_URL=http://127.0.0.1:4000\nSITE_URL=http://localhost:3000\nPOSTGRES_PASSWORD=${postgres}\nREDIS_PASSWORD=${redis}\nDATABASE_URL=postgresql://kttravel:${postgres}@127.0.0.1:55432/kttravel?schema=public\nREDIS_URL=redis://:${redis}@127.0.0.1:56379\nNOTIFICATIONS_ENABLED=0\n`,{mode:0o600,flag:'wx'});
console.log('Created local .env with generated infrastructure credentials. No admin account created.');
