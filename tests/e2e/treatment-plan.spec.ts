import 'dotenv/config';
import { test,expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
test('treatment plan persists procedures and status history',async({page},info)=>{
 await page.goto('/');await page.getByLabel('Correo electrónico',{exact:true}).fill('ana@alia.example');await page.getByLabel('Contraseña',{exact:true}).fill(process.env.DEMO_PASSWORD!);await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();await expect(page.getByRole('heading',{name:'Hola, Ana.'})).toBeVisible();
 const me=await (await page.request.get('/api/auth/me')).json(),org=me.organizations.find((o:{name:string})=>o.name==='Clínica Dental Alia').id;
 const headers={'Origin':process.env.APP_ORIGIN!,'X-CSRF-Token':me.csrf,'X-Organization-Id':org};
 const response=await page.request.post('/api/patients',{headers,data:{request_id:randomUUID(),first_name:'Fotografía '+randomUUID().slice(0,8),last_name:'Ficticio'}});expect(response.ok()).toBe(true);const patient=await response.json();
 const serviceName='Catálogo '+randomUUID().slice(0,8);
 const service=await page.request.post('/api/catalogs/services',{headers,data:{name:serviceName,code:'E2E_'+randomUUID().slice(0,8).toUpperCase(),category:'Otros',duration_minutes:30,price_minor:0,currency:'MXN',requires_tooth:true}});expect(service.ok()).toBe(true);
 await page.goto('/#patients/'+patient.id);
 await page.getByRole('button',{name:'Añadir procedimiento',exact:true}).click();
 await page.getByRole('button',{name:'Elegir del catálogo',exact:true}).click();
 await page.getByLabel('Buscar servicio del catálogo',{exact:true}).fill(serviceName);
 await page.getByRole('button',{name:serviceName+' Requiere pieza dental',exact:true}).click();
 await expect(page.getByLabel('Procedimiento',{exact:true})).toHaveValue(serviceName);
 await expect(page.getByLabel('Pieza del procedimiento')).toHaveAttribute('required','');
 await page.getByLabel('Pieza del procedimiento').fill('12');
 await page.getByRole('button',{name:'Aplicar al plan',exact:true}).click();
 await page.getByRole('button',{name:'Guardar plan',exact:true}).click();
 await expect(page.getByText('Plan de tratamiento guardado.',{exact:true})).toBeVisible();
 await page.reload();
 await expect(page.getByRole('heading',{name:'1. '+serviceName,exact:true})).toBeVisible();


 await page.getByRole('button',{name:'Añadir procedimiento',exact:true}).click();await page.getByLabel('Procedimiento',{exact:true}).fill('Procedimiento ficticio');await page.getByLabel('Pieza del procedimiento').fill('11');await page.getByLabel('Notas del procedimiento').fill('Nota de prueba');await page.getByRole('button',{name:'Aplicar al plan',exact:true}).click();await page.getByRole('button',{name:'Guardar plan',exact:true}).click();await expect(page.getByText('Plan de tratamiento guardado.',{exact:true})).toBeVisible();await page.reload();await expect(page.getByRole('heading',{name:'2. Procedimiento ficticio',exact:true})).toBeVisible();await page.getByRole('button',{name:'Editar procedimiento 2',exact:true}).click();await page.getByLabel('Estado del procedimiento').selectOption('completed');await page.getByRole('button',{name:'Aplicar al plan',exact:true}).click();await page.getByRole('button',{name:'Guardar plan',exact:true}).click();await expect(page.getByText('Plan de tratamiento guardado.',{exact:true})).toBeVisible();await expect(page.getByText('Realizado',{exact:true})).toBeVisible();await page.getByText('Historial del plan',{exact:true}).click();await page.getByLabel('Versión del plan',{exact:true}).selectOption('2');await expect(page.getByText('Propuesto',{exact:true})).toHaveCount(2);await expect(page.getByRole('button',{name:'Editar procedimiento 2',exact:true})).toHaveCount(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.locator('.section').filter({has:page.getByRole('heading',{name:'Plan de tratamiento',exact:true})}).screenshot({path:'test-results/'+info.project.name+'-treatment-plan.png'});
});
