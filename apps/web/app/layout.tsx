import type {Metadata} from 'next';
import {Providers} from '../components/providers';
import {Header,Footer} from '../components/chrome';
import './globals.css';
export const metadata:Metadata={title:{default:'Karakalpakstan Travel — Qadimgi qal’alar sari',template:'%s | Karakalpakstan Travel'},description:'Qoraqalpog‘istonning tarixiy qal’alari bo‘ylab sayohatlar. Nukus, Chilpiq, Ayozqal’a va Mizdaxkon.',metadataBase:new URL(process.env.SITE_URL??'http://localhost:3000'),openGraph:{title:'Karakalpakstan Travel',description:'Qoraqalpog‘istonning tarixiy qal’alari bo‘ylab sayohatlar.',images:['/images/image18.jpeg']}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="uz" data-scroll-behavior="smooth"><body><Providers><a href="#main" className="skip-link">Asosiy tarkibga o‘tish</a><Header/><main id="main">{children}</main><Footer/></Providers></body></html>;}
