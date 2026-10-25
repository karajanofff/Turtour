import type {Locale,Pricing} from '@kt/domain';
export type Text=Record<Locale,string>;
export type Attraction={id:string;slug:string;title:Text;description:Text;image:string;latitude:number;longitude:number;verified:boolean};
export type Departure={id:string;startsAt:string;capacity:number;reserved:number;price:Pricing;published:boolean};
export type Day={id:string;day:number;title:Text;description:Text;waypoints:{id:string;position:number;attraction:Attraction}[]};
export type Tour={id:string;slug:string;title:Text;description:Text;category:string;durationDays:number;nights:number;maxParticipants:number;minParticipants:number;featuredImage:string;images:{path:string;alt:Text}[];included:string[];excluded:string[];requirements:string[];cancellationPolicy:Text;seoTitle:Text;status:'DRAFT'|'PUBLISHED'|'ARCHIVED';departures:Departure[];days:Day[];reviews:{id:string;text:string;rating:number}[]};
export type User={id:string;name:string;email:string;role:'CUSTOMER'|'OPERATOR'|'ADMIN'};
export type Booking={id:string;status:string;name:string;phone:string;adults:number;children:number;totalMinor:string;departure:{startsAt:string;tour:{title:Text}}};
