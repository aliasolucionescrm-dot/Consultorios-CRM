import 'dotenv/config';
import { test,expect } from '@playwright/test';
test('agenda preserves session context across reload and profile navigation',async({page})=>{
 await page.goto('/');await page.getByLabel('Correo electrónico',{exact:true}).fill('ana@alia.example');await page.getByLabel('Contraseña',{exact:true}).fill(process.env.DEMO_PASSWORD!);await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();await expect(page.getByRole('heading',{name:'Hola, Ana.'})).toBeVisible();
 const me=await (await page.request.get('/api/auth/me')).json();const org=me.organizations.find((o:{name:string})=>o.name==='Clínica Dental Alia').id;
 const headers={'Origin':process.env.APP_ORIGIN!,'X-CSRF-Token':me.csrf,'X-Organization-Id':org};
 const context=await (await page.request.get('/api/organization',{headers})).json();const branch=context.branches.find((b:{name:string})=>b.name==='Altabrisa').id;

 const key='alia:agenda:'+me.user.id+':'+org;
 await page.evaluate(({key,branch})=>sessionStorage.setItem(key,JSON.stringify({branch,date:'2049-03-14',view:'week'})),{key,branch});
 await page.goto('/#agenda');await page.reload();
 await expect(page.getByLabel('Fecha de la agenda',{exact:true})).toHaveValue('2049-03-14');
 await expect(page.getByRole('button',{name:'Semana',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.getByLabel('Sucursal activa',{exact:true})).toHaveValue(branch);
 await page.getByLabel('Fecha de la agenda',{exact:true}).fill('2049-04-20');
 await page.getByRole('button',{name:'Mes',exact:true}).click();
 await page.goto('/#patients');await expect(page.getByRole('heading',{name:'Personas, antes que expedientes.'})).toBeVisible();
 await page.goto('/#agenda');await expect(page.getByLabel('Fecha de la agenda',{exact:true})).toHaveValue('2049-04-20');
 await page.reload();await expect(page.getByLabel('Fecha de la agenda',{exact:true})).toHaveValue('2049-04-20');await expect(page.getByRole('button',{name:'Mes',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.evaluate(key=>sessionStorage.setItem(key,JSON.stringify({branch:'00000000-0000-0000-0000-000000000000',date:'2049-02-31',view:'bad'})),key);
 await page.reload();await expect(page.getByLabel('Sucursal activa',{exact:true})).toHaveValue(branch);await expect(page.getByRole('button',{name:'Día',exact:true})).toHaveAttribute('aria-pressed','true');await expect(page.getByLabel('Fecha de la agenda',{exact:true})).not.toHaveValue('2049-02-31');
});
