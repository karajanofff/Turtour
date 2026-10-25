import {Queue} from 'bullmq';
import Redis from 'ioredis';
const connection=new Redis(process.env.REDIS_URL,{maxRetriesPerRequest:null});const queue=new Queue('kt-notifications',{connection});
for(const job of await queue.getFailed(0,99))await job.retry();
await queue.close();await connection.quit();console.log('Retried up to 100 failed notification jobs.');
