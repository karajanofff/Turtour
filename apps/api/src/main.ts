import 'reflect-metadata';
import {ArgumentsHost,Catch,ExceptionFilter,HttpException,Module} from '@nestjs/common';
import {NestFactory} from '@nestjs/core';
import {DocumentBuilder,SwaggerModule} from '@nestjs/swagger';
import {Request,Response,NextFunction,json} from 'express';
import helmet from 'helmet';
import Redis from 'ioredis';
import {randomUUID} from 'node:crypto';
import {ZodError} from 'zod';
import {Db} from './db';
import {AdminGuard,Auth,SessionGuard,StaffGuard} from './auth';
import {Bookings} from './bookings';
import {AdminController,AuthController,CatalogController,CustomerController} from './controllers';
import {env} from './env';
import {MessagesController} from './messages';
import {ContentController} from './content';
import {MediaController} from './media';
@Catch()
class Errors implements ExceptionFilter{catch(error:unknown,host:ArgumentsHost){const res=host.switchToHttp().getResponse<Response>();let status=500;let message='Internal server error';if(error instanceof ZodError){status=400;message=error.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; ');}else if(error instanceof HttpException){status=error.getStatus();message=error.message;}else if((error as {code?:string}).code==='P2002'){status=409;message='Record already exists';}else if((error as {code?:string}).code==='P2025'){status=404;message='Record not found';}if(status===500)console.error(JSON.stringify({level:'error',requestId:res.getHeader('X-Request-Id'),error:error instanceof Error?error.name:'Unknown'}));res.status(status).json({statusCode:status,message,requestId:res.getHeader('X-Request-Id')});}}
@Module({controllers:[AuthController,CatalogController,CustomerController,AdminController,MessagesController,ContentController,MediaController],providers:[Db,Auth,SessionGuard,StaffGuard,AdminGuard,Bookings]})
class AppModule{}
export async function createApp(){
 const app=await NestFactory.create(AppModule,{bodyParser:false});const express=app.getHttpAdapter().getInstance();
 express.disable('x-powered-by');express.set('trust proxy',env.TRUST_PROXY==='1'?1:false);
 app.use(helmet({crossOriginResourcePolicy:{policy:'cross-origin'}}));app.use(json({limit:'128kb'}));
 app.enableCors({origin:env.WEB_ORIGIN,credentials:true,methods:['GET','POST','PATCH','DELETE','OPTIONS'],allowedHeaders:['Content-Type','Idempotency-Key','X-CSRF-Token']});
 const redis=new Redis(env.REDIS_URL,{maxRetriesPerRequest:1,lazyConnect:true});await redis.connect();
 app.use(async(req:Request,res:Response,next:NextFunction)=>{res.setHeader('X-Request-Id',randomUUID());res.setHeader('Cache-Control','no-store');
  if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.headers.origin!==env.WEB_ORIGIN){res.status(403).json({message:'Origin not allowed'});return;}
  if(req.method==='OPTIONS'){next();return;}
  const auth=req.method==='POST'&&['/auth/login','/auth/register'].includes(req.path); const key=`kt:${env.NODE_ENV}:${env.PORT}:rate:${auth?'auth':'api'}:${req.ip}:${Math.floor(Date.now()/60000)}`;
  try{const count=await redis.incr(key);if(count===1)await redis.expire(key,65);if(count>(auth?20:180)){res.setHeader('Retry-After','60');res.status(429).json({message:'Too many requests'});return;}next();}catch{res.status(503).json({message:'Rate limit service unavailable'});}
 });
 express.get('/health/live',(_req:Request,res:Response)=>res.json({status:'ok'}));
 express.get('/health/ready',async(_req:Request,res:Response)=>{try{await app.get(Db).$queryRaw`SELECT 1`;await redis.ping();res.json({status:'ok'});}catch{res.status(503).json({status:'unavailable'});}});
 app.useGlobalFilters(new Errors());
 const document=SwaggerModule.createDocument(app,new DocumentBuilder().setTitle('Karakalpakstan Travel API').setVersion('0.1.0').addCookieAuth('kt_session').addGlobalParameters({in:'header',name:'X-CSRF-Token',required:false,schema:{type:'string'}}).build());
 SwaggerModule.setup('docs',app,document);app.enableShutdownHooks();
 const close=app.close.bind(app);app.close=async()=>{await redis.quit();await close();};
 return app;
}
if(require.main===module)createApp().then(app=>app.listen(env.PORT,'0.0.0.0')).catch(()=>{console.error('API startup failed. Check database, Redis, and validated environment.');process.exitCode=1;});
