import {it,expect} from 'vitest';
import {paymentReceiptHtml,type PaymentReceipt} from '../apps/web/lib/payment-receipt';
it('escapes receipt details and separates historical balances from canceled and legacy records',()=>{
 const r:PaymentReceipt={id:'folio',amount_minor:12345,kind:'advance',method:'cash',branch_name:'<img src=x>',reference:'<script>bad()</script>',created_at:'2026-09-30T12:00:00Z',version:1,currency:'MXN',legacy:false,voided_at:null,void_reason:null,voided_by:null,consulted_at:'2026-09-30T13:00:00Z',context:{patient:{first_name:'A',last_name:'B',record_number:'TEST'},organization:{name:'Clinic',address:'Street',phone:'',timezone:'America/Mexico_City'},recorded_by:'Staff',balance_after_minor:10000}};
 const html=paymentReceiptHtml(r);expect(html).toContain('$123.45');expect(html).toContain('$100.00');expect(html).toContain('saldo histórico');expect(html).not.toContain('<script>');expect(html).toContain('&lt;img src=x&gt;');expect(html).toContain('No es factura fiscal');
 const canceled=paymentReceiptHtml({...r,voided_at:r.consulted_at,void_reason:'<b>Corrección</b>',voided_by:'Staff'});expect(canceled).toContain('ANULADO');expect(canceled).not.toContain('$100.00');expect(canceled).toContain('&lt;b&gt;Corrección&lt;/b&gt;');
 const legacy=paymentReceiptHtml({...r,legacy:true,context:{...r.context,balance_after_minor:null}});expect(legacy).toContain('No se reconstruye un saldo histórico');expect(legacy).not.toContain('$100.00');
});
