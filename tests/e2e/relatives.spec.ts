import 'dotenv/config';
import { test,expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
test('links relatives, opens the inverse relationship and removes it',async({page},info)=>{
 await page.goto('/');await page.getByLabel('Correo electrónico',{exact:true}).fill('ana@alia.example');await page.getByLabel('Contraseña',{exact:true}).fill(process.env.DEMO_PASSWORD!);await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();await expect(page.getByRole('heading',{name:'Hola, Ana.'})).toBeVisible();
 const me=await (await page.request.get('/api/auth/me')).json();const org=me.organizations.find((o:{name:string})=>o.name==='Clínica Dental Alia').id;
 const headers={'Origin':process.env.APP_ORIGIN!,'X-CSRF-Token':me.csrf,'X-Organization-Id':org};

 const create=async(first_name:string)=>{const r=await page.request.post('/api/patients',{headers,data:{request_id:randomUUID(),first_name,last_name:'Ficticio'}});expect(r.ok()).toBe(true);return r.json();};
 const suffix=Date.now(),child=await create('Hija '+suffix),parent=await create('Madre '+suffix);
 await page.goto('/#patients/'+child.id);
 await page.getByRole('button',{name:'Vincular familiar',exact:true}).click();
 await page.getByRole('combobox',{name:'Paciente familiar *',exact:true}).fill('Madre '+suffix);
 await page.getByRole('listbox').getByRole('option').first().click();
 await page.getByRole('combobox',{name:'Esta persona es su',exact:true}).selectOption('parent');
 await page.getByRole('button',{name:'Guardar vínculo',exact:true}).click();
 await expect(page.getByText(new RegExp('Madre / padre · P'))).toBeVisible();
 await page.screenshot({path:'test-results/'+info.project.name+'-relatives.png',fullPage:true});
 await page.getByRole('button',{name:'Abrir ficha de Madre '+suffix,exact:true}).click();
 await expect(page).toHaveURL(new RegExp('patients/'+parent.id));
 await expect(page.getByRole('heading',{name:'Madre '+suffix+' Ficticio',exact:true})).toBeVisible();
 await expect(page.getByText(new RegExp('Hija / hijo · P'))).toBeVisible();
 await page.getByRole('button',{name:'Quitar vínculo',exact:true}).click();
 await page.getByLabel('Motivo del retiro',{exact:true}).fill('Fin de prueba ficticia');
 await page.getByRole('button',{name:'Confirmar retiro del vínculo',exact:true}).click();
 await expect(page.getByText('Aún no hay familiares vinculados.',{exact:true})).toBeVisible();
 await page.goto('/#patients/'+child.id);await expect(page.getByText('Aún no hay familiares vinculados.',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});



