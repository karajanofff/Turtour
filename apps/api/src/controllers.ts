import {BadRequestException,Body,Controller,Delete,Get,Inject,NotFoundException,Param,Patch,Post,Query,Req,Res,UseGuards,ConflictException} from '@nestjs/common';
import {ApiCookieAuth,ApiOperation,ApiTags} from '@nestjs/swagger';
import {Response} from 'express';
import {z} from 'zod';
import {bookingInput,departureInput,pricingSchema,tourInput} from '../../../packages/domain/src';
import {Db} from './db';
import {AdminGuard,Auth,AuthRequest,SessionGuard,StaffGuard} from './auth';
import {Bookings,serialize} from './bookings';
const uuid=(s:string)=>z.string().uuid().parse(s);
const tourInclude={days:{orderBy:{day:'asc' as const},include:{waypoints:{orderBy:{position:'asc' as const},include:{attraction:true}}}},images:{orderBy:{position:'asc' as const}},departures:{where:{published:true,startsAt:{gt:new Date()}},orderBy:{startsAt:'asc' as const}},reviews:{where:{published:true},select:{id:true,rating:true,text:true,createdAt:true}}};
@ApiTags('Authentication') @Controller('auth')
export class AuthController{
 constructor(@Inject(Auth) private auth:Auth){}
 @Post('register') @ApiOperation({summary:'Register a customer and issue an HTTP-only session'}) register(@Body() b:unknown,@Res({passthrough:true}) res:Response){return this.auth.register(b,res);}
 @Post('login') login(@Body() b:unknown,@Res({passthrough:true}) res:Response){return this.auth.login(b,res);}
 @Get('session') session(@Req() r:AuthRequest){return this.auth.session(r);}
 @UseGuards(SessionGuard) @Post('logout') logout(@Req() r:AuthRequest,@Res({passthrough:true}) res:Response){return this.auth.logout(r,res);}
}
@ApiTags('Catalog') @Controller()
export class CatalogController{
 constructor(@Inject(Db) private db:Db,@Inject(Bookings) private bookings:Bookings){}
 @Get('tours') list(@Query('q') q='',@Query('category') category='',@Query('page') page='1'){
  const n=z.coerce.number().int().min(1).max(1000).parse(page); const search=z.string().max(100).parse(q);
  return this.db.tour.findMany({where:{status:'PUBLISHED',...(category?{category:z.string().max(100).parse(category)}:{}),...(search?{slug:{contains:search.toLowerCase()}}:{})},include:{images:true,departures:{where:{published:true,startsAt:{gt:new Date()}},orderBy:{startsAt:'asc'},take:1},_count:{select:{reviews:{where:{published:true}}}}},skip:(n-1)*12,take:12});
 }
 @Get('tours/:slug') async one(@Param('slug') slug:string){const t=await this.db.tour.findFirst({where:{slug,status:'PUBLISHED'},include:{...tourInclude,departures:{where:{published:true,startsAt:{gt:new Date()}},orderBy:{startsAt:'asc'}}}});if(!t)throw new NotFoundException();return t;}
 @Get('destinations') destinations(){return this.db.destination.findMany({include:{attractions:true}});}
 @Post('quotes') @ApiOperation({summary:'Calculate server-side UZS minor-unit pricing'}) quote(@Body() b:unknown){return this.bookings.quote(b);}
}
@ApiTags('Customer') @ApiCookieAuth() @UseGuards(SessionGuard) @Controller('me')
export class CustomerController{
 constructor(@Inject(Db) private db:Db,@Inject(Bookings) private bookings:Bookings){}
 @Get('bookings') async list(@Req() r:AuthRequest){return serialize(await this.db.booking.findMany({where:{userId:r.account!.id},include:{departure:{include:{tour:{select:{title:true,slug:true}}}},history:true},orderBy:{createdAt:'desc'},take:100}));}
 @Post('bookings') create(@Req() r:AuthRequest,@Body() b:unknown){return this.bookings.create(r.account!.id,String(r.headers['idempotency-key']??''),bookingInput.parse(b));}
 @Post('bookings/:id/cancel') cancel(@Req() r:AuthRequest,@Param('id') id:string){return this.bookings.transition(r.account!.id,uuid(id),'CANCELLED',true);}
 @Get('bookings/:id/confirmation') async confirmation(@Req() r:AuthRequest,@Param('id') id:string,@Res() res:Response){const b=await this.db.booking.findFirst({where:{id:uuid(id),userId:r.account!.id},include:{departure:{include:{tour:true}}}});if(!b)throw new NotFoundException();res.type('text/plain; charset=utf-8').setHeader('Content-Disposition',`attachment; filename="booking-${b.id}.txt"`);res.send(`Karakalpakstan Travel\nBooking: ${b.id}\nStatus: ${b.status}\nDeparture: ${b.departure.startsAt.toISOString()}\nParticipants: ${b.adults+b.children}\nTotal: ${Number(b.totalMinor)/100} UZS\nThis is a reservation record. It is not a payment receipt.`);}
 @Get('notifications') notifications(@Req() r:AuthRequest){return this.db.notification.findMany({where:{userId:r.account!.id},orderBy:{createdAt:'desc'},take:100});}
 @Patch('profile') profile(@Req() r:AuthRequest,@Body() body:unknown){const b=z.object({name:z.string().trim().min(2).max(100)}).strict().parse(body);return this.db.user.update({where:{id:r.account!.id},data:b,select:{id:true,name:true,email:true,role:true}});}
 @Post('reviews') async review(@Req() r:AuthRequest,@Body() body:unknown){const b=z.object({bookingId:z.string().uuid(),rating:z.number().int().min(1).max(5),text:z.string().trim().min(10).max(2000)}).strict().parse(body);const booking=await this.db.booking.findFirst({where:{id:b.bookingId,userId:r.account!.id,status:'COMPLETED'},include:{departure:true}});if(!booking)throw new BadRequestException('A completed booking is required');return this.db.review.create({data:{...b,userId:r.account!.id,tourId:booking.departure.tourId}});}
}
@ApiTags('Operations') @ApiCookieAuth() @UseGuards(SessionGuard,StaffGuard) @Controller('admin')
export class AdminController{
 constructor(@Inject(Db) private db:Db,@Inject(Bookings) private bookings:Bookings){}
 @Get('stats') async stats(){const [total,pending,confirmed,value,groups]=await Promise.all([this.db.booking.count(),this.db.booking.count({where:{status:'PENDING'}}),this.db.booking.count({where:{status:'CONFIRMED'}}),this.db.booking.aggregate({_sum:{totalMinor:true},where:{status:{in:['CONFIRMED','COMPLETED']}}}),this.db.departure.aggregate({_sum:{capacity:true,reserved:true}})]);return serialize({total,pending,confirmed,confirmedBookingValueMinor:value._sum.totalMinor??0n,capacity:groups._sum.capacity??0,reserved:groups._sum.reserved??0});}
 @Get('bookings') async list(@Query('page') page='1'){const p=z.coerce.number().int().min(1).max(10000).parse(page);return serialize(await this.db.booking.findMany({include:{departure:{include:{tour:{select:{title:true}}}}},orderBy:{createdAt:'desc'},take:50,skip:(p-1)*50}));}
 @Patch('bookings/:id/status') status(@Req() r:AuthRequest,@Param('id') id:string,@Body() body:unknown){const b=z.object({status:z.enum(['CONFIRMED','REJECTED','CANCELLED','COMPLETED'])}).strict().parse(body);return this.bookings.transition(r.account!.id,uuid(id),b.status);}
 @Get('tours') tours(){return this.db.tour.findMany({include:{days:{include:{waypoints:{include:{attraction:true},orderBy:{position:'asc'}}},orderBy:{day:'asc'}},departures:{orderBy:{startsAt:'asc'}}},orderBy:{createdAt:'desc'}});}
 @UseGuards(AdminGuard) @Post('tours') createTour(@Body() body:unknown){const b=tourInput.parse(body);if(b.minParticipants>b.maxParticipants)throw new BadRequestException();return this.db.tour.create({data:b});}
 @UseGuards(AdminGuard) @Patch('tours/:id') async editTour(@Req() r:AuthRequest,@Param('id') id:string,@Body() body:unknown){const b=tourInput.parse(body);if(b.minParticipants>b.maxParticipants)throw new BadRequestException();return this.db.$transaction(async tx=>{const t=await tx.tour.update({where:{id:uuid(id)},data:b});await tx.auditLog.create({data:{actorId:r.account!.id,action:'tour.update',entityId:t.id,metadata:{status:t.status}}});return t;});}
 @UseGuards(AdminGuard) @Post('tours/:id/duplicate') async duplicate(@Param('id') id:string){const t=await this.db.tour.findUnique({where:{id:uuid(id)},include:{images:true,days:{include:{waypoints:true}}}});if(!t)throw new NotFoundException();const {id:_,slug,createdAt,updatedAt,images,days,...data}=t;return this.db.tour.create({data:{...data,title:data.title as PrismaJson,description:data.description as PrismaJson,seoTitle:data.seoTitle as PrismaJson,cancellationPolicy:data.cancellationPolicy as PrismaJson,slug:`${slug.slice(0,65)}-${crypto.randomUUID().slice(0,8)}`,status:'DRAFT',images:{create:images.map(({path,alt,position})=>({path,alt:alt as PrismaJson,position}))},days:{create:days.map(d=>({day:d.day,title:d.title as PrismaJson,description:d.description as PrismaJson,waypoints:{create:d.waypoints.map(w=>({attractionId:w.attractionId,position:w.position}))}}))}}});}
 @UseGuards(AdminGuard) @Post('departures') async departure(@Body() body:unknown){const b=departureInput.parse(body);const t=await this.db.tour.findUnique({where:{id:b.tourId}});if(!t||b.capacity>t.maxParticipants||b.price.groupSize!==b.capacity||new Date(b.startsAt)<=new Date())throw new BadRequestException('Invalid departure capacity or date');if(b.published&&!b.price.verified)throw new BadRequestException('Verify pricing before publishing');return this.db.departure.create({data:{...b,startsAt:new Date(b.startsAt)}});}
 @UseGuards(AdminGuard) @Patch('departures/:id') async price(@Req() r:AuthRequest,@Param('id') id:string,@Body() body:unknown){const b=z.object({price:pricingSchema,published:z.boolean()}).strict().parse(body);return this.db.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM "Departure" WHERE id=${uuid(id)}::uuid FOR UPDATE`;const d=await tx.departure.findUniqueOrThrow({where:{id}});if(b.price.groupSize!==d.capacity)throw new BadRequestException('Price group size must equal departure capacity');if(b.published&&!b.price.verified)throw new ConflictException('Verify supplier estimates first');const updated=await tx.departure.update({where:{id},data:b});await tx.auditLog.create({data:{actorId:r.account!.id,action:'departure.price',entityId:id,metadata:b}});return updated;});}
 @UseGuards(AdminGuard) @Patch('days/:id/order') async order(@Param('id') id:string,@Body() raw:unknown){const b=z.object({waypointIds:z.array(z.string().uuid()).min(1).max(50)}).strict().parse(raw);if(new Set(b.waypointIds).size!==b.waypointIds.length)throw new BadRequestException();return this.db.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM "ItineraryDay" WHERE id=${uuid(id)}::uuid FOR UPDATE`;const current=await tx.waypoint.findMany({where:{dayId:id}});if(current.length!==b.waypointIds.length||!current.every(w=>b.waypointIds.includes(w.id)))throw new BadRequestException('Include exactly every waypoint in this day');for(let i=0;i<b.waypointIds.length;i++)await tx.waypoint.update({where:{id:b.waypointIds[i]},data:{position:-i-1}});for(let i=0;i<b.waypointIds.length;i++)await tx.waypoint.update({where:{id:b.waypointIds[i]},data:{position:i+1}});return {ok:true};});}
 @Get('customers') customers(){return this.db.user.findMany({select:{id:true,name:true,email:true,role:true,createdAt:true,_count:{select:{bookings:true}}},take:100,orderBy:{createdAt:'desc'}});}
 @UseGuards(AdminGuard) @Patch('customers/:id/role') async role(@Req() r:AuthRequest,@Param('id') id:string,@Body() raw:unknown){const b=z.object({role:z.enum(['CUSTOMER','OPERATOR','ADMIN'])}).strict().parse(raw);if(id===r.account!.id)throw new BadRequestException('Cannot change your own role');return this.db.$transaction(async tx=>{const user=await tx.user.update({where:{id:uuid(id)},data:b,select:{id:true,role:true}});await tx.session.deleteMany({where:{userId:id}});await tx.auditLog.create({data:{actorId:r.account!.id,action:'user.role',entityId:id,metadata:b}});return user;});}
 @Get('reviews') reviews(){return this.db.review.findMany({take:100,orderBy:{createdAt:'desc'}});}
 @UseGuards(AdminGuard) @Patch('reviews/:id') moderate(@Param('id') id:string,@Body() raw:unknown){return this.db.review.update({where:{id:uuid(id)},data:z.object({published:z.boolean()}).strict().parse(raw)});}
}
type PrismaJson=import('@prisma/client').Prisma.InputJsonValue;
