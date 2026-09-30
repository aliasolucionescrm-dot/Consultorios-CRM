import 'dotenv/config';
import { test,expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
test('drag proposes a move, rejects a conflicting slot and persists an available slot',async({page},info)=>{
 test.skip(info.project.name!=='desktop','Mouse drag is tested on desktop; mobile keeps the reprogramming form.');
 await page.goto('/');await page.getByLabel('Correo electrónico',{exact:true}).fill('ana@alia.example');await page.getByLabel('Contraseña',{exact:true}).fill(process.env.DEMO_PASSWORD!);await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();await expect(page.getByRole('heading',{name:'Hola, Ana.'})).toBeVisible();
 const me=await (await page.request.get('/api/auth/me')).json();const org=me.organizations.find((o:{name:string})=>o.name==='Clínica Dental Alia').id;
 const headers={'Origin':process.env.APP_ORIGIN!,'X-CSRF-Token':me.csrf,'X-Organization-Id':org};
 const context=await (await page.request.get('/api/organization',{headers})).json();const branch=context.branches.find((b:{name:string})=>b.name==='Altabrisa').id;
 const create=async(path:string,data:unknown)=>{const r=await page.request.post('/api/'+path,{headers,data});expect(r.ok(),await r.text()).toBe(true);return r.json();};
 const suffix=Date.now(),professional=await create('catalogs/professionals',{name:`Drag profesional ${suffix}`,branch_ids:[branch]}),room=await create('catalogs/rooms',{name:`Drag sala ${suffix}`,branch_id:branch}),patient=await create('patients',{request_id:randomUUID(),first_name:`Arrastre ${suffix}`,last_name:'Ficticio'});
 const services=await (await page.request.get('/api/catalogs/services',{headers})).json();const payload={branch_id:branch,patient_id:patient.id,professional_id:professional.id,room_id:room.id,service_id:services.items[0].id,duration_minutes:30};
 const first=await create('appointments',{...payload,request_id:randomUUID(),start_local:'2044-04-04T09:00'});const second=await create('appointments',{...payload,request_id:randomUUID(),start_local:'2044-04-04T10:00'});
 await page.goto('/#agenda');await page.getByLabel('Fecha de la agenda',{exact:true}).fill('2044-04-04');
 await page.getByRole('combobox',{name:/Filtrar profesional/}).fill(`Drag profesional ${suffix}`);await page.getByRole('listbox').getByRole('option').first().click();
 const event=page.locator(`[data-appointment-id="${first.id}"]`);
 async function drag(hours:number){await event.evaluate(el=>el.scrollIntoView({block:"center"}));await page.waitForTimeout(100);const box=await event.boundingBox();const slot1=await page.locator('.alia-time-slot[data-time="09:00:00"]').boundingBox(),slot2=await page.locator('.alia-time-slot[data-time="10:00:00"]').boundingBox();expect(box).not.toBeNull();expect(slot1).not.toBeNull();expect(slot2).not.toBeNull();await page.mouse.move(box!.x+box!.width/2,box!.y+8);await page.mouse.down();await page.waitForTimeout(200);await page.mouse.move(box!.x+box!.width/2,box!.y+8+(slot2!.y-slot1!.y)*hours,{steps:15});await page.waitForTimeout(200);await page.mouse.up();await page.screenshot({path:"test-results/drag-debug.png",fullPage:true});await expect(page.getByRole('heading',{name:'Confirmar reprogramación'})).toBeVisible();}
 await drag(1);await page.getByLabel('Motivo del movimiento',{exact:true}).fill('Prueba de conflicto');await page.getByRole('button',{name:'Validar y reprogramar',exact:true}).click();await expect(page.getByText(/Ese horario se cruza/)).toBeVisible();
 let data=await (await page.request.get(`/api/appointments/events?date=2044-04-04&days=1&branch_id=${branch}`,{headers})).json();expect(data.items.find((a:{id:string})=>a.id===first.id).starts_at).toBe('2044-04-04T15:00:00.000Z');
 await page.getByRole('button',{name:'Cerrar formulario',exact:true}).click();await drag(2);await page.getByLabel('Motivo del movimiento',{exact:true}).fill('Reprogramación válida');await page.getByRole('button',{name:'Validar y reprogramar',exact:true}).click();await expect(page.getByRole('heading',{name:'Confirmar reprogramación'})).toHaveCount(0);
 data=await (await page.request.get(`/api/appointments/events?date=2044-04-04&days=1&branch_id=${branch}`,{headers})).json();expect(data.items.find((a:{id:string})=>a.id===first.id).starts_at).toBe('2044-04-04T17:00:00.000Z');
 await page.screenshot({path:'test-results/desktop-hourly-calendar.png',fullPage:true});
 for(const [id,version] of [[first.id,2],[second.id,1]])expect((await page.request.patch(`/api/appointments/${id}/status`,{headers,data:{version,status:'canceled',reason:'Fin de prueba ficticia'}})).ok()).toBe(true);
});
