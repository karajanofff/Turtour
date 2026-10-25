import {serverApi} from '../lib/api';
import {Home} from '../components/catalog';
import type {Tour,Attraction} from '../lib/types';
export default async function Page(){let tours:Tour[]=[];let attractions:Attraction[]=[];let error=false;try{const [ts,ds]=await Promise.all([serverApi<Tour[]>('/tours'),serverApi<{attractions:Attraction[]}[]>('/destinations')]);tours=ts;attractions=ds.flatMap(d=>d.attractions);}catch{error=true;}return <Home tours={tours} attractions={attractions} error={error}/>;}
