import {it,expect} from 'vitest';
import {consentHtml,type ConsentDocument} from '../apps/web/lib/consent-document';
it('escapes consent content and distinguishes copies from signed evidence',()=>{
 const row:ConsentDocument={id:'folio',template_version:1,plan_version:2,notes:'<script>alert(1)</script>',created_at:'2026-09-30T12:00:00Z',author:'Author',snapshot:{patient:{first_name:'A',last_name:'B',record_number:'TEST'},template:{title:'<img src=x>',content:'Own text'},procedure:{title:'Procedure',tooth:'11'},professional:{name:'Doctor'},organization:{name:'Clinic'}}};
 const pending=consentHtml(row,'pending');expect(pending).not.toContain('<script>');expect(pending).not.toContain('<img src=x>');expect(pending).toContain('&lt;script&gt;');expect(pending).toContain('Nombre y firma del paciente');
 const accepted=consentHtml(row,'accepted');expect(accepted).toContain('Aceptación registrada');expect(accepted).not.toContain('Nombre y firma del paciente');expect(accepted).toContain('no contiene firmas');expect(consentHtml(row,'voided')).toContain('Anulado');
});
