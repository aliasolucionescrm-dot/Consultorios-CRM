import {it,expect} from 'vitest';
import {prescriptionHtml,type PrescriptionRow} from '../apps/web/lib/prescription-document';
it('escapes clinical text in printable documents and keeps unsigned status',()=>{
 const attack='<img src=x onerror="alert(1)"><script>bad()</script>';
 const row:PrescriptionRow={id:'id',version:1,input:{title:attack,medications:[{name:attack,dose:'1 & 2',instructions:''}],notes:attack},snapshot:{patient:{first_name:attack,last_name:'Prueba',record_number:'1',birth_date:null},professional:{name:attack,license:'123',professional_title:'Doctor',practice_address:attack},organization:{name:attack,address:'',phone:'',timezone:'America/Mexico_City'}}};
 const html=prescriptionHtml(row,{id:'folio',version:1,prepared_at:'2026-09-30T16:00:00Z'});
 expect(html).not.toContain('<script>');expect(html).not.toContain('<img src=');expect(html).toContain('&lt;script&gt;');expect(html).toContain('1 &amp; 2');expect(html).toContain('PREPARADA PARA FIRMA AUTÓGRAFA · SIN FIRMA');expect(html).toContain('Folio: folio');expect(html).not.toContain('<dt>Indicaciones</dt>');
 expect(prescriptionHtml(row,null)).toContain('BORRADOR · NO VÁLIDO PARA DISPENSACIÓN');
});
