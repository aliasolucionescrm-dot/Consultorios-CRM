import 'dotenv/config';
import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
test('reviews, saves and reloads a cash report',async({page},info)=>{
 await page.goto('/');await page.getByLabel('Correo electrónico',{exact:true}).fill('ana@alia.example');await page.getByLabel('Contraseña',{exact:true}).fill(process.env.DEMO_PASSWORD!);await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();await expect(page.getByRole('heading',{name:'Hola, Ana.'})).toBeVisible();
 const me=await (await page.request.get('/api/auth/me')).json(),org=me.organizations.find((o:{name:string})=>o.name==='Clínica Dental Alia').id,headers={'Origin':process.env.APP_ORIGIN!,'X-CSRF-Token':me.csrf,'X-Organization-Id':org};
 await page.goto('/#cash-closures');await expect(page.getByRole('heading',{name:'Corte de caja',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Consultar corte',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Vista previa del corte',exact:true})).toBeVisible();
 await page.getByLabel('Observaciones del corte',{exact:true}).fill('Revisión ficticia '+randomUUID().slice(0,8));
 await page.getByRole('checkbox',{name:/Revisé periodo, responsables y movimientos/}).check();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.locator('section.panel:not(.cash-count)').screenshot({path:'test-results/'+info.project.name+'-cash-preview.png'});
 const saveResponse=page.waitForResponse(r=>r.url().endsWith('/api/cash-closures')&&r.request().method()==='POST');
 await page.getByRole('button',{name:'Guardar corte revisado',exact:true}).click();const response=await saveResponse;expect(response.ok()).toBe(true);const {id}=await response.json();
 await expect(page.getByRole('status').filter({hasText:'Corte conservado'})).toContainText('Corte conservado');
 const before=await (await page.request.get('/api/cash-closures/'+id,{headers})).json();
 await page.reload();await page.getByRole('button',{name:'Ver corte guardado',exact:true}).first().click();
 await expect(page.getByRole('status').filter({hasText:'Corte conservado'})).toContainText(id);expect((await (await page.request.get('/api/cash-closures/'+id,{headers})).json()).snapshot).toEqual(before.snapshot);
 await page.locator('section.panel:not(.cash-count)').screenshot({path:'test-results/'+info.project.name+'-cash-saved.png'});
 const count=page.locator('.cash-count');await count.getByRole('button',{name:'Registrar arqueo',exact:true}).click();
 if(await page.getByLabel('Fondo inicial (MXN)',{exact:true}).count()===0)await page.getByRole('button',{name:'Añadir moneda al arqueo',exact:true}).click();
 const detail=await (await page.request.get('/api/cash-closures/'+id+'/counts',{headers})).json();const received=detail.totals.find((t:{currency:string;method:string})=>t.currency==='MXN'&&t.method==='cash')?.received_minor||0;
 await page.getByLabel('Fondo inicial (MXN)',{exact:true}).fill('100');
 await page.getByLabel('Efectivo contado (MXN)',{exact:true}).fill(((received+9000)/100).toFixed(2));
 await page.getByRole('button',{name:'Añadir ajuste (MXN)',exact:true}).click();
 await page.getByLabel('Importe del ajuste 1 (MXN)',{exact:true}).fill('10');
 await page.getByLabel('Motivo del ajuste 1 (MXN)',{exact:true}).fill('Salida ficticia documentada');
 await page.getByRole('checkbox',{name:/Revisé el efectivo, fondo, ajustes/}).check();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await count.screenshot({path:'test-results/'+info.project.name+'-cash-count-form.png'});
 await page.getByRole('button',{name:'Guardar arqueo',exact:true}).click();
 await expect(count.getByRole('status').filter({hasText:'Arqueo guardado'})).toHaveText('Arqueo guardado. El cálculo y su versión se conservan.');
 await expect(count.getByText('Sin diferencia',{exact:false})).toBeVisible();
 await count.getByRole('button',{name:'Corregir arqueo con nueva versión',exact:true}).click();
 await page.getByLabel('Efectivo contado (MXN)',{exact:true}).fill(((received+8900)/100).toFixed(2));
 await page.getByLabel('Explicación de la diferencia (MXN)',{exact:true}).fill('Faltante ficticio por revisar');
 await page.getByLabel('Motivo de corrección del arqueo',{exact:true}).fill('Recuento de prueba');
 await page.getByRole('checkbox',{name:/Revisé el efectivo, fondo, ajustes/}).check();
 await page.getByRole('button',{name:'Guardar arqueo',exact:true}).click();
 await expect(count.locator('summary').filter({hasText:'Arqueo versión 2'})).toBeVisible();
 await page.reload();await page.getByRole('button',{name:'Ver corte guardado',exact:true}).first().click();
 await expect(count.locator('summary').filter({hasText:'Arqueo versión 2'})).toBeVisible();await expect(count.locator('summary').filter({hasText:'Arqueo versión 1'})).toBeVisible();
 await expect(count.getByText('Faltante ficticio por revisar',{exact:false})).toBeVisible();
 await count.screenshot({path:'test-results/'+info.project.name+'-cash-count-history.png'});
});




