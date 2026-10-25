import { z } from 'zod';
export const locales = ['uz', 'kaa', 'ru', 'en'] as const;
export type Locale = typeof locales[number];
export const translated = z.object({uz:z.string().min(1).max(10000),kaa:z.string().min(1).max(10000),ru:z.string().min(1).max(10000),en:z.string().min(1).max(10000)});
const money = z.number().int().min(0).max(1_000_000_000_000);
export const pricingSchema = z.object({
  costs: z.array(z.object({label:z.string().min(1).max(100),amountMinor:money})).min(1).max(30),
  groupSize:z.number().int().min(1).max(100), markupBps:z.number().int().min(0).max(100000),
  childBps:z.number().int().min(0).max(10000), taxBps:z.number().int().min(0).max(10000), serviceFeeMinor:money,
  seasonalBps:z.number().int().min(1000).max(100000),
  extras:z.array(z.object({id:z.string().regex(/^[a-z0-9-]+$/),label:z.string().max(100),amountMinor:money})).max(20),
  promo:z.object({code:z.string().min(1).max(30),discountBps:z.number().int().min(0).max(10000)}).nullable(),
  verified:z.boolean()
});
export type Pricing = z.infer<typeof pricingSchema>;
export const bookingInput = z.object({departureId:z.string().uuid(),adults:z.number().int().min(1).max(100),children:z.number().int().min(0).max(100),extras:z.array(z.string().max(50)).max(20).default([]),promoCode:z.string().max(30).default(''),privateTour:z.boolean().default(false),name:z.string().trim().min(2).max(100),phone:z.string().regex(/^\+?[0-9 ()-]{7,25}$/),locale:z.enum(locales).default('uz')}).strict();
export const quoteInput=bookingInput.omit({name:true,phone:true,locale:true});
export type BookingInput=z.infer<typeof bookingInput>;
export function calculatePrice(raw: Pricing, input: z.infer<typeof quoteInput>) {
  const p=pricingSchema.parse(raw); const q=quoteInput.parse(input);
  if(new Set(q.extras).size!==q.extras.length) throw new Error('Duplicate extras');
  const ceil=(n:bigint,d:bigint)=>(n+d-1n)/d;
  const cost=p.costs.reduce((s,c)=>s+BigInt(c.amountMinor),0n);
  const group=ceil(cost*BigInt(10000+p.markupBps)*BigInt(p.seasonalBps),100_000_000n);
  const adult=ceil(group,BigInt(p.groupSize));
  const child=ceil(adult*BigInt(p.childBps),10000n);
  const extra=q.extras.reduce((s,id)=>{const e=p.extras.find(x=>x.id===id);if(!e)throw new Error('Unknown extra');return s+BigInt(e.amountMinor);},0n);
  if(q.adults+q.children>p.groupSize)throw new Error('Group capacity exceeded');
  let subtotal=(q.privateTour?group:adult*BigInt(q.adults)+child*BigInt(q.children))+extra*BigInt(q.adults+q.children);
  if(q.promoCode){if(!p.promo||p.promo.code.toUpperCase()!==q.promoCode.toUpperCase())throw new Error('Invalid promotion');subtotal-=subtotal*BigInt(p.promo.discountBps)/10000n;}
  const tax=ceil(subtotal*BigInt(p.taxBps),10000n); const total=subtotal+tax+BigInt(p.serviceFeeMinor);
  if(total>BigInt(Number.MAX_SAFE_INTEGER))throw new Error('Price overflow');
  return {currency:'UZS' as const,totalMinor:Number(total),adultMinor:Number(adult),groupMinor:Number(group),costMinor:Number(cost),taxMinor:Number(tax),serviceFeeMinor:p.serviceFeeMinor,provisional:!p.verified};
}
export const samplePricing:Pricing={costs:[['Transport',9000000],['Gid',1650000],['Mehmonlar ovqati',10400000],['Xodimlar ovqati',1040000],['Suv',500000],['Kirish chiptalari',1800000],['Xodimlar tunashi',600000],['O‘tovlarda tunash',5500000]].map(([label,n])=>({label:String(label),amountMinor:Number(n)*100})),groupSize:20,markupBps:2000,childBps:10000,taxBps:0,serviceFeeMinor:0,seasonalBps:10000,extras:[],promo:null,verified:false};
export const allowedTransitions:Record<string,readonly string[]>={PENDING:['CONFIRMED','REJECTED','CANCELLED'],CONFIRMED:['COMPLETED','CANCELLED'],CANCELLED:[],REJECTED:[],COMPLETED:[]};
export const occupiedStatuses=['PENDING','CONFIRMED','COMPLETED'];
export const imagePath=z.string().regex(/^(?:\/images\/[a-zA-Z0-9._-]+|\/api\/media\/[a-f0-9-]{36})$/);
export const tourInput=z.object({slug:z.string().regex(/^[a-z0-9-]{3,100}$/),title:translated,description:translated,durationDays:z.number().int().min(1).max(30),nights:z.number().int().min(0).max(29),minParticipants:z.number().int().min(1).max(100),maxParticipants:z.number().int().min(1).max(100),category:z.string().min(1).max(100),status:z.enum(['DRAFT','PUBLISHED','ARCHIVED']),featuredImage:imagePath,included:z.array(z.string().max(200)).max(30),excluded:z.array(z.string().max(200)).max(30),requirements:z.array(z.string().max(200)).max(30),cancellationPolicy:translated,seoTitle:translated}).strict();
export const departureInput=z.object({tourId:z.string().uuid(),startsAt:z.string().datetime({offset:true}),capacity:z.number().int().min(1).max(100),price:pricingSchema,published:z.boolean().default(false)}).strict();
