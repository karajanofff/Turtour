import {Body,Controller,ForbiddenException,Get,Inject,Post,Req,UseGuards} from '@nestjs/common';
import {ApiCookieAuth,ApiTags} from '@nestjs/swagger';
import {z} from 'zod';
import {Db} from './db';
import {AuthRequest,SessionGuard} from './auth';
@ApiTags('Messages') @ApiCookieAuth() @UseGuards(SessionGuard) @Controller('messages')
export class MessagesController{
 constructor(@Inject(Db) private db:Db){}
 @Get() list(@Req() r:AuthRequest){return this.db.message.findMany({where:r.account!.role==='CUSTOMER'?{userId:r.account!.id}:{},select:{id:true,userId:true,senderId:true,body:true,createdAt:true,user:{select:{name:true,email:true}},sender:{select:{name:true,role:true}}},orderBy:{createdAt:'desc'},take:100});}
 @Post() create(@Req() r:AuthRequest,@Body() raw:unknown){const b=z.object({body:z.string().trim().min(2).max(4000),userId:z.string().uuid().optional()}).strict().parse(raw);const userId=b.userId??r.account!.id;if(userId!==r.account!.id&&r.account!.role==='CUSTOMER')throw new ForbiddenException();return this.db.message.create({data:{userId,senderId:r.account!.id,body:b.body}});}
}
