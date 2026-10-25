import {PrismaClient} from '@prisma/client';
import {Queue,Worker} from 'bullmq';
import Redis from 'ioredis';
import nodemailer from 'nodemailer';
import {env} from './env';
const db=new PrismaClient();
const textByLocale={uz:'Bron holati',kaa:'Bron jaǵdayı',ru:'Статус бронирования',en:'Booking status'};
async function main(){const external=env.NOTIFICATIONS_ENABLED==='1';if(!external)console.log('External deliveries disabled. In-app reminders remain active.');
 if(external&&!(env.SMTP_HOST&&env.MAIL_FROM)&&!(env.TELEGRAM_BOT_TOKEN&&env.TELEGRAM_OPERATOR_CHAT_ID))throw new Error('Configure at least one delivery channel');
 const connection=new Redis(env.REDIS_URL,{maxRetriesPerRequest:null});
 const queue=new Queue('kt-notifications',{connection});
 const worker=new Worker('kt-notifications',async job=>{
  const item=await db.outbox.findUniqueOrThrow({where:{id:job.data.outboxId}});if(item.deliveredAt)return;
  const event=item.payload as {userId:string;bookingId:string;event:string};const user=await db.user.findUniqueOrThrow({where:{id:event.userId}});const booking=await db.booking.findUniqueOrThrow({where:{id:event.bookingId}});
  const subject=`${textByLocale[booking.locale as keyof typeof textByLocale]??textByLocale.uz}: ${event.event}`;
  const text=`${subject}\n${event.bookingId}\n${env.WEB_ORIGIN}/account`;
  if(env.SMTP_HOST){if(!env.MAIL_FROM)throw new Error('MAIL_FROM required');const transport=nodemailer.createTransport({host:env.SMTP_HOST,port:env.SMTP_PORT,secure:env.SMTP_PORT===465,requireTLS:true,auth:env.SMTP_USER?{user:env.SMTP_USER,pass:env.SMTP_PASSWORD}:undefined,connectionTimeout:10000,socketTimeout:15000});await transport.sendMail({from:env.MAIL_FROM,to:user.email,subject,text,messageId:`<${item.id}@karakalpakstan-travel.local>`});if(event.event==='PENDING'){const staff=await db.user.findMany({where:{role:{in:['ADMIN','OPERATOR']}},select:{email:true}});for(const operator of staff)await transport.sendMail({from:env.MAIL_FROM,to:operator.email,subject:'New booking request',text:`${event.bookingId}\n${env.WEB_ORIGIN}/admin`});}}
  if(env.TELEGRAM_BOT_TOKEN&&env.TELEGRAM_OPERATOR_CHAT_ID){const result=await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:env.TELEGRAM_OPERATOR_CHAT_ID,text:`Karakalpakstan Travel: ${event.event}\n${event.bookingId}`}),signal:AbortSignal.timeout(10000)});if(!result.ok)throw new Error('Telegram delivery failed');}
  await db.outbox.update({where:{id:item.id},data:{deliveredAt:new Date()}});
 },{connection,concurrency:3,autorun:external});
 worker.on('failed',job=>console.error(JSON.stringify({event:'notification_failed',jobId:job?.id})));
 let active=false;const dispatch=async()=>{if(active)return;active=true;try{const upcoming=await db.$queryRaw<{id:string;userId:string}[]>`SELECT b.id,b."userId" FROM "Booking" b JOIN "Departure" d ON d.id=b."departureId" WHERE b.status='CONFIRMED' AND d."startsAt">NOW() AND d."startsAt"<=NOW()+INTERVAL '1 day' AND NOT EXISTS (SELECT 1 FROM "Notification" n WHERE n."bookingId"=b.id AND n.event='UPCOMING') ORDER BY d."startsAt" LIMIT 100`;for(const booking of upcoming){try{await db.$transaction(async tx=>{await tx.notification.create({data:{userId:booking.userId,bookingId:booking.id,event:'UPCOMING'}});await tx.outbox.create({data:{payload:{userId:booking.userId,bookingId:booking.id,event:'UPCOMING'}}});});}catch(e){if((e as {code?:string}).code!=='P2002')throw e;}}if(!external)return;const rows=await db.outbox.findMany({where:{deliveredAt:null},take:100,orderBy:{createdAt:'asc'}});for(const row of rows)await queue.add('deliver',{outboxId:row.id},{jobId:row.id,attempts:5,backoff:{type:'exponential',delay:5000},removeOnComplete:{age:86400},removeOnFail:false});}catch{console.error('{"event":"outbox_dispatch_failed"}');}finally{active=false;}};
 const timer=setInterval(dispatch,5000);await dispatch();const stop=async()=>{clearInterval(timer);await worker.close();await queue.close();await connection.quit();await db.$disconnect();};process.on('SIGTERM',()=>void stop());process.on('SIGINT',()=>void stop());
}
main().catch(()=>{console.error('Notification worker failed; check environment.');process.exitCode=1;});
