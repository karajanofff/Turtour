import type {MetadataRoute} from 'next';
import {serverApi} from '../lib/api';
export default async function sitemap():Promise<MetadataRoute.Sitemap>{if(!process.env.SITE_URL)return [];const base=process.env.SITE_URL;let tours:{slug:string}[]=[];try{tours=await serverApi('/tours');}catch{}return ['', '/tours','/destinations','/about','/contact','/faq','/articles',...tours.map(t=>`/tours/${t.slug}`)].map(path=>({url:base+path,changeFrequency:'weekly',priority:path===''?1:0.7}));}
