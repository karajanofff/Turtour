import {Body,Controller,Get,Inject,Param,Patch,Post,UseGuards,BadRequestException} from '@nestjs/common';
import {ApiCookieAuth,ApiTags} from '@nestjs/swagger';
import {z} from 'zod';
import {translated,imagePath} from '../../../packages/domain/src';
import {Db} from './db';
import {SessionGuard,StaffGuard,AdminGuard} from './auth';
const id=(v:string)=>z.string().uuid().parse(v);
const destination=z.object({slug:z.string().regex(/^[a-z0-9-]{3,100}$/),title:translated,description:translated}).strict();
const attraction=z.object({slug:z.string().regex(/^[a-z0-9-]{3,100}$/),title:translated,description:translated,latitude:z.number().min(-90).max(90),longitude:z.number().min(-180).max(180),destinationId:z.string().uuid(),image:imagePath,verified:z.boolean()}).strict();
@ApiTags('Content administration') @ApiCookieAuth() @UseGuards(SessionGuard,StaffGuard,AdminGuard) @Controller('admin/content')
export class ContentController{
 constructor(@Inject(Db) private db:Db){}
 @Get('destinations') list(){return this.db.destination.findMany({include:{attractions:true}});}
 @Post('destinations') createDestination(@Body() raw:unknown){return this.db.destination.create({data:destination.parse(raw)});}
 @Patch('destinations/:id') destination(@Param('id') value:string,@Body() raw:unknown){return this.db.destination.update({where:{id:id(value)},data:destination.parse(raw)});}
 @Post('attractions') createAttraction(@Body() raw:unknown){return this.db.attraction.create({data:attraction.parse(raw)});}
 @Patch('attractions/:id') attraction(@Param('id') value:string,@Body() raw:unknown){return this.db.attraction.update({where:{id:id(value)},data:attraction.parse(raw)});}
 @Post('days') day(@Body() raw:unknown){const b=z.object({tourId:z.string().uuid(),day:z.number().int().min(1).max(30),title:translated,description:translated,attractionIds:z.array(z.string().uuid()).min(1).max(30)}).strict().parse(raw);const {attractionIds,...data}=b;return this.db.itineraryDay.create({data:{...data,waypoints:{create:attractionIds.map((attractionId,n)=>({attractionId,position:n+1}))}}});}
 @Patch('tours/:id/gallery') gallery(@Param('id') value:string,@Body() raw:unknown){const images=z.array(z.object({path:imagePath,alt:translated}).strict()).max(30).parse(raw);return this.db.$transaction(async tx=>{await tx.tourImage.deleteMany({where:{tourId:id(value)}});await tx.tourImage.createMany({data:images.map((image,n)=>({...image,tourId:value,position:n+1}))});return {ok:true};});}
 @Patch('departures/:id/capacity') capacity(@Param('id') value:string,@Body() raw:unknown){const b=z.object({capacity:z.number().int().min(1).max(100)}).strict().parse(raw);return this.db.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM "Departure" WHERE id=${id(value)}::uuid FOR UPDATE`;const d=await tx.departure.findUniqueOrThrow({where:{id:value},include:{tour:true}});if(b.capacity<d.reserved||b.capacity>d.tour.maxParticipants)throw new BadRequestException('Capacity must cover reservations and respect tour limits');const price=d.price as Record<string,unknown>;return tx.departure.update({where:{id:value},data:{capacity:b.capacity,price:{...price,groupSize:b.capacity,verified:false} as import('@prisma/client').Prisma.InputJsonValue,published:false}});});}
 @Get('settings') settings(){return this.db.setting.findMany();}
 @Patch('settings/:key') setting(@Param('key') key:string,@Body() raw:unknown){const allowed=z.enum(['operatorContact','businessName','cancellationTerms']).parse(key);const value=z.object({text:translated}).strict().parse(raw);return this.db.setting.upsert({where:{key:allowed},create:{key:allowed,value},update:{value}});}
}
