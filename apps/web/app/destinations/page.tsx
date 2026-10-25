import {Destinations} from '../../components/destinations';
import {serverApi} from '../../lib/api';
import {Attraction} from '../../lib/types';
export const metadata={title:'Manzillar'};
export default async function Page(){let points:Attraction[]=[];let error=false;try{points=(await serverApi<{attractions:Attraction[]}[]>('/destinations')).flatMap(d=>d.attractions);}catch{error=true;}return <Destinations points={points} error={error}/>;}
