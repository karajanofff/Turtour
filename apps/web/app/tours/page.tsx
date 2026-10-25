import {Catalog} from '../../components/catalog';
import {serverApi} from '../../lib/api';
import type {Tour} from '../../lib/types';
export const metadata={title:'Sayohatlar'};
export default async function Page(){let tours:Tour[]=[];let error=false;try{tours=await serverApi<Tour[]>('/tours');}catch{error=true;}return <Catalog tours={tours} error={error}/>;}
