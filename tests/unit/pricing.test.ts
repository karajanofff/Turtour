import {describe,it,expect} from 'vitest';
import {calculatePrice,samplePricing,quoteInput,allowedTransitions,bookingInput} from '../../packages/domain/src';
const input={departureId:'12345678-1234-4234-8234-123456789012',adults:1,children:0,extras:[],promoCode:'',privateTour:false};
describe('pricing in integer minor currency units',()=>{
 it('reproduces the supplied group cost and 20% markup',()=>{const p=calculatePrice(samplePricing,input);expect(p.costMinor).toBe(3049000000);expect(p.groupMinor).toBe(3658800000);expect(p.adultMinor).toBe(182940000);expect(p.provisional).toBe(true);});
 it('calculates all twenty seats without losing precision',()=>expect(calculatePrice(samplePricing,{...input,adults:20}).totalMinor).toBe(3658800000));
 it('applies child rates',()=>expect(calculatePrice({...samplePricing,childBps:5000},{...input,children:1}).totalMinor).toBe(274410000));
 it('applies configured seasonal pricing',()=>expect(calculatePrice({...samplePricing,seasonalBps:12000},input).adultMinor).toBe(219528000));
 it('charges full group cost for a private tour',()=>expect(calculatePrice(samplePricing,{...input,privateTour:true}).totalMinor).toBe(3658800000));
 it('applies optional per-participant extras before tax',()=>expect(calculatePrice({...samplePricing,extras:[{id:'lunch',label:'Lunch',amountMinor:10000}],taxBps:1000,serviceFeeMinor:1000},{...input,extras:['lunch']}).totalMinor).toBe(201246000));
 it('applies discounts to selling price, not supplier costs',()=>{const p=calculatePrice({...samplePricing,promo:{code:'SAVE10',discountBps:1000}},{...input,promoCode:'save10'});expect(p.totalMinor).toBe(164646000);expect(p.costMinor).toBe(3049000000);});
 it('rejects unknown extras',()=>expect(()=>calculatePrice(samplePricing,{...input,extras:['unknown']})).toThrow());
 it('rejects duplicate extras',()=>expect(()=>calculatePrice({...samplePricing,extras:[{id:'lunch',label:'Lunch',amountMinor:100}]},{...input,extras:['lunch','lunch']})).toThrow());
 it('rejects unrecognized promotions',()=>expect(()=>calculatePrice(samplePricing,{...input,promoCode:'FREE'})).toThrow());
 it('rejects fractional participants and excess capacity',()=>{expect(()=>quoteInput.parse({...input,adults:1.5})).toThrow();expect(()=>calculatePrice(samplePricing,{...input,adults:21})).toThrow();});
 it('rounds up fractional minor units deterministically',()=>{const p=calculatePrice({...samplePricing,costs:[{label:'Tiny',amountMinor:101}],markupBps:0,groupSize:3},input);expect(p.adultMinor).toBe(34);});
 it('rejects client-supplied price and unauthorized fields',()=>expect(()=>bookingInput.parse({...input,name:'Customer',phone:'+998901234567',totalMinor:1})).toThrow());
 it('does not permit terminal-state resurrection',()=>{for(const s of ['COMPLETED','REJECTED','CANCELLED'])expect(allowedTransitions[s]).toEqual([]);});
});
