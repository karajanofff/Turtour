import {BadRequestException,ConflictException,Inject,Injectable,NotFoundException,ForbiddenException} from '@nestjs/common';
import {Prisma,BookingStatus} from '@prisma/client';
import {createHash} from 'node:crypto';
import {allowedTransitions,bookingInput,calculatePrice,occupiedStatuses,pricingSchema,quoteInput} from '../../../packages/domain/src';
import {Db} from './db';
type Tx=Prisma.TransactionClient;
export const serialize=<T>(value:T):T=>JSON.parse(JSON.stringify(value,(_,v)=>typeof v==='bigint'?v.toString():v));
@Injectable()
export class Bookings {
 constructor(@Inject(Db) private db:Db){}
 async quote(raw:unknown){const q=quoteInput.parse(raw);const d=await this.db.departure.findUnique({where:{id:q.departureId},include:{tour:true}});if(!d||!d.published||d.tour.status!=='PUBLISHED'||d.startsAt<=new Date())throw new NotFoundException('Departure unavailable');try{return {...calculatePrice(pricingSchema.parse(d.price),q),remaining:d.capacity-d.reserved};}catch(e){throw new BadRequestException((e as Error).message);}}
 async create(userId:string,key:string,raw:unknown){
  if(!/^[a-zA-Z0-9_-]{16,100}$/.test(key))throw new BadRequestException('Idempotency-Key must contain 16–100 safe characters');
  const b=bookingInput.parse(raw);const requestHash=createHash('sha256').update(JSON.stringify(b)).digest('hex');
  return this.db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM "Departure" WHERE id=${b.departureId}::uuid FOR UPDATE`;
   const previous=await tx.booking.findUnique({where:{userId_idempotencyKey:{userId,idempotencyKey:key}}});
   if(previous){if(previous.requestHash!==requestHash)throw new ConflictException('Idempotency key reused for another request');return serialize(previous);}
   const d=await tx.departure.findUnique({where:{id:b.departureId},include:{tour:true}});
   if(!d||!d.published||d.tour.status!=='PUBLISHED'||d.startsAt<=new Date())throw new NotFoundException('Departure unavailable');
   const p=pricingSchema.parse(d.price);if(!p.verified)throw new ConflictException('Operator must verify and publish the price before bookings open');
   const participants=b.adults+b.children;if(participants<d.tour.minParticipants||participants>d.tour.maxParticipants)throw new BadRequestException('Participant count outside tour limits');
   const seats=b.privateTour?d.capacity:participants;
   if(d.reserved+seats>d.capacity)throw new ConflictException('Insufficient remaining capacity');
   let price;try{price=calculatePrice(p,{departureId:b.departureId,adults:b.adults,children:b.children,extras:b.extras,promoCode:b.promoCode,privateTour:b.privateTour});}catch(e){throw new BadRequestException((e as Error).message);}
   const booking=await tx.booking.create({data:{userId,departureId:d.id,idempotencyKey:key,requestHash,name:b.name,phone:b.phone,locale:b.locale,adults:b.adults,children:b.children,seats,totalMinor:BigInt(price.totalMinor),priceSnapshot:price,extras:b.extras,privateTour:b.privateTour,history:{create:{actorId:userId,status:'PENDING'}}}});
   await tx.departure.update({where:{id:d.id},data:{reserved:{increment:seats}}});
   await this.event(tx,userId,booking.id,'PENDING',userId);
   return serialize(booking);
  });
 }
 async transition(actorId:string,id:string,status:BookingStatus,customer=false){return this.db.$transaction(async tx=>{
  const initial=await tx.booking.findUnique({where:{id}});if(!initial)throw new NotFoundException();
  await tx.$queryRaw`SELECT id FROM "Departure" WHERE id=${initial.departureId}::uuid FOR UPDATE`;
  const b=await tx.booking.findUniqueOrThrow({where:{id},include:{departure:true}});
  if(customer&&(b.userId!==actorId||status!=='CANCELLED'))throw new ForbiddenException();
  if(!allowedTransitions[b.status]?.includes(status))throw new ConflictException('Invalid booking status transition');
  if(customer&&b.departure.startsAt<=new Date())throw new ConflictException('Cancellation is closed after departure');
  if(status==='COMPLETED'&&b.departure.startsAt>new Date())throw new ConflictException('Tour has not started');
  if(occupiedStatuses.includes(b.status)&&!occupiedStatuses.includes(status))await tx.departure.update({where:{id:b.departureId},data:{reserved:{decrement:b.seats}}});
  const changed=await tx.booking.update({where:{id},data:{status,history:{create:{actorId,status}}}});
  await this.event(tx,b.userId,id,status,actorId);return serialize(changed);
 });}
 async event(tx:Tx,userId:string,bookingId:string,event:string,actorId:string){await tx.notification.create({data:{userId,bookingId,event}});await tx.outbox.create({data:{payload:{userId,bookingId,event}}});await tx.auditLog.create({data:{actorId,action:`booking.${event.toLowerCase()}`,entityId:bookingId,metadata:{}}});}
}
