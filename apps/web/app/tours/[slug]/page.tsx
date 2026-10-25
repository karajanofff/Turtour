import {notFound} from 'next/navigation';
import {TourDetail} from '../../../components/tour-detail';
import {serverApi} from '../../../lib/api';
import {Tour} from '../../../lib/types';
export async function generateMetadata({params}:{params:Promise<{slug:string}>}){const {slug}=await params;try{const t=await serverApi<Tour>(`/tours/${encodeURIComponent(slug)}`);return {title:t.seoTitle.uz,description:t.description.uz,alternates:process.env.SITE_URL?{canonical:`${process.env.SITE_URL}/tours/${t.slug}`}:{}};}catch{return {title:'Sayohat'};}}
export default async function Page({params}:{params:Promise<{slug:string}>}){const {slug}=await params;let tour:Tour;try{tour=await serverApi<Tour>(`/tours/${encodeURIComponent(slug)}`);}catch{notFound();}const structured={'@context':'https://schema.org','@type':'TouristTrip',name:tour.title.uz,description:tour.description.uz,itinerary:{'@type':'ItemList',itemListElement:tour.days.flatMap(d=>d.waypoints).map((w,i)=>({'@type':'ListItem',position:i+1,name:w.attraction.title.uz}))}};return <><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(structured).replace(/</g,'\\u003c')}}/><TourDetail tour={tour}/></>;}
