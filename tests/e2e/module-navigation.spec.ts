import 'dotenv/config';
import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
test('module navigation opens existing patient tools and labels pending modules',async({page},info)=>{
 await page.goto('/');await page.getByLabel('Correo electrónico',{exact:true}).fill('ana@alia.example');await page.getByLabel('Contraseña',{exact:true}).fill(process.env.DEMO_PASSWORD!);await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();await expect(page.getByRole('heading',{name:'Hola, Ana.'})).toBeVisible();
 const me=await (await page.request.get('/api/auth/me')).json(),org=me.organizations.find((o:{name:string})=>o.name==='Clínica Dental Alia').id,headers={'Origin':process.env.APP_ORIGIN!,'X-CSRF-Token':me.csrf,'X-Organization-Id':org},name='Navegación '+randomUUID().slice(0,8);
 const result=await page.request.post('/api/patients',{headers,data:{request_id:randomUUID(),first_name:name,last_name:'Ficticio'}});expect(result.ok()).toBe(true);const patient=await result.json();
 async function navigate(label:string){const nav=page.getByRole('navigation',{name:'Navegación principal',exact:true});if(info.project.name==='mobile')await page.getByRole('button',{name:'Abrir navegación',exact:true}).click();await nav.getByRole('button',{name:label,exact:true}).click();}
 await navigate('Expedientes');await expect(page.getByRole('heading',{name:'Expedientes',exact:true})).toBeVisible();
 await page.getByLabel('Buscar paciente para expedientes',{exact:true}).fill(name);
 await page.getByRole('button',{name:new RegExp(name+'.*Abrir historia clínica')}).click();await expect(page).toHaveURL(new RegExp('patients/'+patient.id+'/clinical$'));await expect(page.locator('#patient-section-clinical')).toBeFocused();
 await navigate('Tratamientos');await page.getByRole('button',{name:/Presupuestos Versiones/}).click();await page.getByLabel('Buscar paciente para tratamientos',{exact:true}).fill(name);
 await page.getByRole('button',{name:new RegExp(name+'.*Abrir presupuestos')}).click();await expect(page.locator('#patient-section-budget')).toBeFocused();
 await navigate('Caja');await page.getByLabel('Buscar paciente para caja',{exact:true}).fill(name);await page.getByRole('button',{name:new RegExp(name+'.*Abrir pagos y recibos')}).click();await expect(page.locator('#patient-section-payments')).toBeFocused();
 await navigate('Caja');await page.getByRole('button',{name:'Abrir cortes y arqueos',exact:true}).click();await expect(page.getByRole('heading',{name:'Corte de caja',exact:true})).toBeVisible();
 await navigate('Reportes');await expect(page.getByRole('heading',{name:'Reporte de caja',exact:true})).toBeVisible();await expect(page.getByText('Los reportes generales clínicos, de productividad e inventario siguen pendientes.',{exact:false})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 if(info.project.name==='mobile')await page.getByRole('button',{name:'Abrir navegación',exact:true}).click();
 await expect(page.locator('.future-nav').getByText('Pendiente',{exact:true})).toHaveCount(2);
 await page.screenshot({path:'test-results/'+info.project.name+'-module-navigation.png'});
 await page.route('**/api/organization',async route=>{const response=await route.fetch();const body=await response.json();body.permissions=body.permissions.filter((p:string)=>!['clinical_records.view','budgets.view','payments.view','cash_closures.view'].includes(p));await route.fulfill({response,json:body});});
 await page.goto('/#records');await page.reload();await expect(page.getByRole('heading',{name:'Acceso restringido',exact:true})).toBeVisible();
 await expect(page.getByRole('navigation',{name:'Navegación principal',exact:true}).getByRole('button',{name:'Expedientes',exact:true})).toHaveCount(0);
});

