import {it,expect} from 'vitest';
import {budgetHtml,type BudgetDocument} from '../apps/web/lib/budget-document';
it('prints budget amounts and escapes all supplied text with honest document states',()=>{
 const data:BudgetDocument={latest:1,current_accepted_version:null,acceptance:null,snapshot:{budget:{version:1,plan_version:1,title:'<script>bad()</script>',currency:'MXN',created_at:'2026-09-30T12:00:00Z',total_minor:12345,items:[{title:'<img src=x>',tooth:'11',quantity:2,unit_minor:7000,discount_minor:1655,total_minor:12345}]},patient:{first_name:'A',last_name:'B',record_number:'123'},organization:{name:'Clinic',address:'Street',phone:'',timezone:'America/Mexico_City'}}};
 const proposal=budgetHtml(data);expect(proposal).toContain('$123.45');expect(proposal).toContain('$16.55');expect(proposal).not.toContain('<script>');expect(proposal).toContain('&lt;img src=x&gt;');expect(proposal).toContain('SIN ACEPTACIÓN REGISTRADA');
 const accepted={...data,current_accepted_version:1,acceptance:{id:'folio',version:1,accepted_by:'Paciente',relationship:'Propio paciente',notes:'<b>note</b>',created_at:'2026-09-30T12:00:00Z',author:'Staff'}};
 expect(budgetHtml(accepted)).toContain('ACEPTACIÓN REGISTRADA');expect(budgetHtml(accepted)).toContain('&lt;b&gt;note&lt;/b&gt;');expect(budgetHtml({...accepted,current_accepted_version:2})).toContain('SUSTITUIDO');expect(budgetHtml(accepted)).toContain('no es comprobante de pago');
});
