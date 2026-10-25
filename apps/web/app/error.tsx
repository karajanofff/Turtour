'use client';
import {useI18n} from '../components/providers';
export default function ErrorPage({reset}:{reset:()=>void}){const {t}=useI18n();return <section className="section"><h1>{t('unavailable')}</h1><button className="button" onClick={reset}>{t('back')}</button></section>;}
