import {it,expect} from 'vitest';
import {calculateCount,countLine} from '../apps/api/src/cash-counts';
it('calculates physical cash separately from record reversals and other payment methods',()=>{
 const totals=[{currency:'MXN',method:'cash',received_minor:10000,voided_minor:3000},{currency:'MXN',method:'card',received_minor:50000,voided_minor:0},{currency:'USD',method:'cash',received_minor:2000,voided_minor:0}];
 const mx={currency:'MXN' as const,opening_minor:1000,counted_minor:8500,adjustments:[{direction:'out' as const,amount_minor:3000,reason:'Captura sin entrada real'}],difference_reason:'Sobrante por revisar'},usd={currency:'USD' as const,opening_minor:0,counted_minor:2000,adjustments:[],difference_reason:''};
 const result=calculateCount([mx,usd],totals);expect(result[0].expected_minor).toBe(8000);expect(result[0].difference_minor).toBe(500);expect(result[0].voided_records_minor).toBe(3000);expect(result[1].expected_minor).toBe(2000);
 expect(calculateCount([{...mx,adjustments:[],counted_minor:11000,difference_reason:''},usd],totals)[0].expected_minor).toBe(11000);
 expect(()=>calculateCount([{...mx,difference_reason:''},usd],totals)).toThrow();expect(()=>calculateCount([mx],totals)).toThrow();expect(()=>calculateCount([mx,mx,usd],totals)).toThrow();expect(()=>calculateCount([{...mx,adjustments:[{direction:'out',amount_minor:12000,reason:'Exceso'}]},usd],totals)).toThrow();
 expect(countLine.safeParse({...mx,opening_minor:1.1}).success).toBe(false);expect(countLine.safeParse({...mx,counted_minor:-1}).success).toBe(false);expect(countLine.safeParse({...mx,expected_minor:0}).success).toBe(false);
});
it('deducts professional cash payments but keeps reversals as reference and ignores transfers',()=>{
 const line={currency:'MXN' as const,opening_minor:5000,counted_minor:4000,adjustments:[],difference_reason:''};
 const totals=[{currency:'MXN',method:'cash',received_minor:1000,voided_minor:500,paid_minor:2000,payout_voided_minor:700},{currency:'MXN',method:'transfer',received_minor:0,voided_minor:0,paid_minor:9000,payout_voided_minor:0}];
 const result=calculateCount([line],totals)[0];expect(result.expected_minor).toBe(4000);expect(result.paid_minor).toBe(2000);expect(result.payout_voided_records_minor).toBe(700);expect(result.difference_minor).toBe(0);
 expect(calculateCount([{...line,counted_minor:6000}],totals.map(t=>({...t,paid_minor:undefined,payout_voided_minor:undefined})))[0].expected_minor).toBe(6000);
 expect(()=>calculateCount([],totals)).toThrow();expect(()=>calculateCount([{...line,opening_minor:0}],totals)).toThrow();
});
