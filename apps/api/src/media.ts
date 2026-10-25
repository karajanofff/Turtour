import {BadRequestException,Body,Controller,Get,Inject,NotFoundException,Param,Post,Req,Res,ServiceUnavailableException,UploadedFile,UseGuards,UseInterceptors} from '@nestjs/common';
import {FileInterceptor} from '@nestjs/platform-express';
import {ApiConsumes,ApiTags} from '@nestjs/swagger';
import {S3Client,PutObjectCommand,GetObjectCommand,DeleteObjectCommand} from '@aws-sdk/client-s3';
import {getSignedUrl} from '@aws-sdk/s3-request-presigner';
import sharp from 'sharp';
import {randomUUID} from 'node:crypto';
import {Response} from 'express';
import {z} from 'zod';
import {translated} from '../../../packages/domain/src';
import {Db} from './db';
import {AuthRequest,SessionGuard,StaffGuard,AdminGuard} from './auth';
function storage(){const endpoint=process.env.S3_ENDPOINT,bucket=process.env.S3_BUCKET,key=process.env.S3_ACCESS_KEY_ID,secret=process.env.S3_SECRET_ACCESS_KEY;if(!endpoint||!bucket||!key||!secret)throw new ServiceUnavailableException('S3 storage is not configured');const url=z.url().parse(endpoint);if(process.env.NODE_ENV==='production'&&!url.startsWith('https://'))throw new ServiceUnavailableException('S3 endpoint requires HTTPS');return {bucket,client:new S3Client({endpoint:url,region:process.env.S3_REGION??'auto',forcePathStyle:true,credentials:{accessKeyId:key,secretAccessKey:secret}})};}
@ApiTags('Media') @Controller()
export class MediaController{
 constructor(@Inject(Db) private db:Db){}
 @Get('media/:id') async image(@Param('id') raw:string,@Res() res:Response){const id=z.string().uuid().parse(raw);const image=await this.db.media.findUnique({where:{id}});if(!image)throw new NotFoundException();const {bucket,client}=storage();const url=await getSignedUrl(client,new GetObjectCommand({Bucket:bucket,Key:image.objectKey,ResponseContentType:'image/webp'}),{expiresIn:300});res.redirect(302,url);}
 @UseGuards(SessionGuard,StaffGuard,AdminGuard) @Get('admin/media') async list(){const media=await this.db.media.findMany({take:100,orderBy:{createdAt:'desc'},select:{id:true,alt:true,width:true,height:true,sizeBytes:true}});return media.map(m=>({...m,path:`/api/media/${m.id}`}));}
 @UseGuards(SessionGuard,StaffGuard,AdminGuard) @Post('admin/media') @ApiConsumes('multipart/form-data')
 @UseInterceptors(FileInterceptor('file',{limits:{fileSize:8*1024*1024,files:1,fields:1},fileFilter:(_req,file,callback)=>callback(null,['image/jpeg','image/png','image/webp'].includes(file.mimetype))}))
 async upload(@Req() r:AuthRequest,@UploadedFile() file:Express.Multer.File,@Body('alt') raw:string){if(!file)throw new BadRequestException('A JPEG, PNG, or WebP image up to 8 MB is required');let alt;try{alt=translated.parse(JSON.parse(raw));}catch{throw new BadRequestException('Provide image descriptions in all four languages');}let output;try{output=await sharp(file.buffer,{limitInputPixels:40000000,failOn:'warning'}).rotate().resize({width:2560,height:2560,fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer({resolveWithObject:true});}catch{throw new BadRequestException('Invalid image data');}const {bucket,client}=storage();const key=`tour-media/${randomUUID()}.webp`;await client.send(new PutObjectCommand({Bucket:bucket,Key:key,Body:output.data,ContentType:'image/webp'}));try{const item=await this.db.media.create({data:{objectKey:key,alt,width:output.info.width,height:output.info.height,sizeBytes:output.data.length,uploaderId:r.account!.id}});return {...item,objectKey:undefined,path:`/api/media/${item.id}`};}catch(e){await client.send(new DeleteObjectCommand({Bucket:bucket,Key:key})).catch(()=>{});throw e;}}
}
