import 'dotenv/config';
import { test,expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
test('upload, retry, persist and download a private patient file',async({page},info)=>{
 await page.goto('/');await page.getByLabel('Correo electrónico',{exact:true}).fill('ana@alia.example');await page.getByLabel('Contraseña',{exact:true}).fill(process.env.DEMO_PASSWORD!);await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();await expect(page.getByRole('heading',{name:'Hola, Ana.'})).toBeVisible();
 const me=await (await page.request.get('/api/auth/me')).json();const org=me.organizations.find((o:{name:string})=>o.name==='Clínica Dental Alia').id;
 const headers={'Origin':process.env.APP_ORIGIN!,'X-CSRF-Token':me.csrf,'X-Organization-Id':org};

 const name='Adjuntos '+randomUUID().slice(0,8),response=await page.request.post('/api/patients',{headers,data:{request_id:randomUUID(),first_name:name,last_name:'Ficticio'}});expect(response.ok()).toBe(true);const patient=await response.json();
 await page.goto('/#patients/'+patient.id);await expect(page.getByRole('heading',{name:'Archivos del paciente',exact:true})).toBeVisible();
 const picker=page.getByLabel('Seleccionar archivo',{exact:true}),bytes=Buffer.from('%PDF-1.7\nArchivo ficticio\n%%EOF');
 await picker.setInputFiles({name:'rechazado.html',mimeType:'text/html',buffer:Buffer.from('<html>test</html>')});await page.getByRole('button',{name:'Subir archivo',exact:true}).click();await expect(page.getByText('Selecciona un PNG, JPEG, WebP o PDF de hasta 10 MiB, que no esté vacío.',{exact:true})).toBeVisible();
 await picker.setInputFiles({name:'Documento ficticio.pdf',mimeType:'application/pdf',buffer:bytes});
 const route='/api/patients/'+patient.id+'/attachments';let firstRequest='';
 await page.route('**'+route,async r=>{if(r.request().method()==='POST'){firstRequest=r.request().postDataJSON().request_id;await r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Fallo simulado de prueba'})});}else await r.continue();});
 await page.getByRole('button',{name:'Subir archivo',exact:true}).click();await expect(page.getByText('Fallo simulado de prueba',{exact:true})).toBeVisible();await page.unroute('**'+route);
 const upload=page.waitForRequest(r=>r.url().endsWith(route)&&r.method()==='POST');await page.getByRole('button',{name:'Subir archivo',exact:true}).click();expect((await upload).postDataJSON().request_id).toBe(firstRequest);
 await expect(page.getByText('Archivo guardado correctamente.',{exact:true})).toBeVisible();await page.reload();await expect(page.getByText('Documento ficticio.pdf',{exact:true})).toBeVisible();
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Descargar',exact:true}).click();const download=await downloadPromise;expect(download.suggestedFilename()).toBe('Documento ficticio.pdf');expect(await readFile((await download.path())!)).toEqual(bytes);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.getByRole('heading',{name:'Archivos del paciente',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:'test-results/'+info.project.name+'-attachments.png'});
});
