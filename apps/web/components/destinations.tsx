'use client';
import dynamic from 'next/dynamic';
import {Attraction} from '../lib/types';
import {useI18n} from './providers';
const Map=dynamic(()=>import('./route-map'),{ssr:false});
export function Destinations({points,error}:{points:Attraction[];error:boolean}){const {t,locale}=useI18n();return <section className="section"><span className="eyebrow">QORAQALPOG‘ISTON</span><h1 className="page-title">{t('places')}</h1>{error&&<p role="alert">{t('unavailable')}</p>}<Map points={points}/><div className="destination-directory">{points.map(p=><article id={p.slug} key={p.id}><img src={p.image} alt={p.title[locale]} loading="lazy"/><div><h2>{p.title[locale]}</h2><p>{p.description[locale]}</p></div></article>)}</div></section>;}
