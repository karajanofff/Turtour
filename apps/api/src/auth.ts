import {BadRequestException,CanActivate,ConflictException,ExecutionContext,ForbiddenException,Inject,Injectable,UnauthorizedException} from '@nestjs/common';
import {createHash,randomBytes,scrypt,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {Request,Response} from 'express';
import {z} from 'zod';
import {Db} from './db';
import {env} from './env';
const scryptAsync=promisify(scrypt);
export const hashToken=(s:string)=>createHash('sha256').update(s).digest('hex');
export async function hashPassword(password:string){const salt=randomBytes(16).toString('hex');const hash=await scryptAsync(password,salt,64) as Buffer;return `scrypt:${salt}:${hash.toString('hex')}`;}
export async function verifyPassword(password:string,stored:string){const [method,salt,h]=stored.split(':');if(method!=='scrypt'||!salt||!h)return false;const actual=await scryptAsync(password,salt,64) as Buffer;const expected=Buffer.from(h,'hex');return expected.length===actual.length&&timingSafeEqual(expected,actual);}
export const credentials=z.object({email:z.string().email().max(254).transform(x=>x.toLowerCase()),password:z.string().min(12).max(128),name:z.string().trim().min(2).max(100).optional()}).strict();
export type AuthRequest=Request&{account?:{id:string;email:string;name:string;role:'CUSTOMER'|'OPERATOR'|'ADMIN'};sessionId?:string};
function tokenFrom(req:Request){const cookie=req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith('kt_session='));return cookie?.slice('kt_session='.length);}
@Injectable()
export class Auth {
 constructor(@Inject(Db) private db:Db){}
 async register(body:unknown,res:Response){const b=credentials.parse(body);if(!b.name)throw new BadRequestException('Name is required');try{const u=await this.db.user.create({data:{email:b.email,name:b.name,passwordHash:await hashPassword(b.password)}});return this.issue(u.id,res);}catch(e){if((e as {code?:string}).code==='P2002')throw new ConflictException('Account cannot be created with these details');throw e;}}
 async login(body:unknown,res:Response){const b=credentials.parse(body);const u=await this.db.user.findUnique({where:{email:b.email}});const stored=u?.passwordHash??'scrypt:00000000000000000000000000000000:'+ '00'.repeat(64);if(!(await verifyPassword(b.password,stored))||!u)throw new UnauthorizedException('Invalid credentials');return this.issue(u.id,res);}
 async issue(userId:string,res:Response){const token=randomBytes(32).toString('hex');const csrfToken=randomBytes(32).toString('hex');const expiresAt=new Date(Date.now()+env.SESSION_DAYS*86400000);await this.db.session.create({data:{userId,tokenHash:hashToken(token),csrfToken,expiresAt}});res.cookie('kt_session',token,{httpOnly:true,secure:env.NODE_ENV==='production',sameSite:'lax',expires:expiresAt,path:'/'});return this.sessionByToken(token);}
 private async sessionByToken(token:string){const s=await this.db.session.findUnique({where:{tokenHash:hashToken(token)},include:{user:{select:{id:true,email:true,name:true,role:true}}}});if(!s||s.expiresAt<new Date())throw new UnauthorizedException();return {id:s.id,user:s.user,csrfToken:s.csrfToken};}
 async session(req:Request){const token=tokenFrom(req);if(!token||!/^[a-f0-9]{64}$/.test(token))throw new UnauthorizedException();return this.sessionByToken(token);}
 async logout(req:AuthRequest,res:Response){if(req.sessionId)await this.db.session.deleteMany({where:{id:req.sessionId}});res.clearCookie('kt_session',{path:'/',httpOnly:true,secure:env.NODE_ENV==='production',sameSite:'lax'});return {ok:true};}
}
@Injectable()
export class SessionGuard implements CanActivate{
 constructor(@Inject(Auth) private auth:Auth){}
 async canActivate(ctx:ExecutionContext){const r=ctx.switchToHttp().getRequest<AuthRequest>();const s=await this.auth.session(r);r.account=s.user;r.sessionId=s.id;if(!['GET','HEAD','OPTIONS'].includes(r.method)&&r.headers['x-csrf-token']!==s.csrfToken)throw new ForbiddenException('Invalid CSRF token');return true;}
}
@Injectable()
export class StaffGuard implements CanActivate{canActivate(ctx:ExecutionContext){const r=ctx.switchToHttp().getRequest<AuthRequest>();if(!r.account||!['OPERATOR','ADMIN'].includes(r.account.role))throw new ForbiddenException();return true;}}
@Injectable()
export class AdminGuard implements CanActivate{canActivate(ctx:ExecutionContext){if(ctx.switchToHttp().getRequest<AuthRequest>().account?.role!=='ADMIN')throw new ForbiddenException();return true;}}
