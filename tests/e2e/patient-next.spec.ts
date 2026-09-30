import 'dotenv/config';
import { test,expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
test('patient profile opens the next appointment day and refreshes after cancellation',async({page},info)=>{
 await page.goto('/');await page.getByLabel('Correo electrónico',{exact:true}).fill('ana@alia.example');await page.getByLabel('Contraseña',{exact:true}).fill(process.env.DEMO_PASSWORD!);await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();await expect(page.getByRole('heading',{name:'Hola, Ana.'})).toBeVisible();
 const me=await (await page.request.get('/api/auth/me')).json();const org=me.organizations.find((o:{name:string})=>o.name==='Clínica Dental Alia').id;
 const headers={'Origin':process.env.APP_ORIGIN!,'X-CSRF-Token':me.csrf,'X-Organization-Id':org};
 const context=await (await page.request.get('/api/organization',{headers})).json();const branch=context.branches.find((b:{name:string})=>b.name==='Altabrisa').id;
 const create=async(path:string,data:unknown)=>{const r=await page.request.post('/api/'+path,{headers,data});expect(r.ok(),await r.text()).toBe(true);return r.json();};
 const suffix=Date.now(),professional=await create('catalogs/professionals',{name:`Drag profesional ${suffix}`,branch_ids:[branch]}),room=await create('catalogs/rooms',{name:`Drag sala ${suffix}`,branch_id:branch}),patient=await create('patients',{request_id:randomUUID(),first_name:`Arrastre ${suffix}`,last_name:'Ficticio'});
 const services=await (await page.request.get('/api/catalogs/services',{headers})).json();const payload={branch_id:branch,patient_id:patient.id,professional_id:professional.id,room_id:room.id,service_id:services.items[0].id,duration_minutes:30};

 const first=await create('appointments',{...payload,request_id:randomUUID(),start_local:'2048-04-04T09:00'});
 await page.goto('/#patients/'+patient.id);
 await expect(page.getByRole('heading',{name:'Próxima cita',exact:true})).toBeVisible();
 await expect(page.getByText('Drag profesional '+suffix+' · Drag sala '+suffix+' · Altabrisa',{exact:true})).toBeVisible();
 await page.screenshot({path:'test-results/'+info.project.name+'-patient-next.png',fullPage:true});
 await page.getByRole('button',{name:'Ver cita en agenda',exact:true}).click();
 await expect(page.getByLabel('Fecha de la agenda',{exact:true})).toHaveValue('2048-04-04');
 await expect(page.locator('article').filter({hasText:'Drag profesional '+suffix})).toBeVisible();
 expect((await page.request.patch('/api/appointments/'+first.id+'/status',{headers,data:{version:1,status:'canceled',reason:'Fin de prueba ficticia'}})).ok()).toBe(true);
 await page.goto('/#patients/'+patient.id);
 await expect(page.getByText('No tiene citas futuras pendientes.',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
