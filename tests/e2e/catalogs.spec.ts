import 'dotenv/config';
import { test,expect } from '@playwright/test';
test('create operational catalogs and inspect service price history',async({page},info)=>{
 const suffix=Date.now().toString().slice(-8)+info.project.name;
 await page.goto('/');await page.getByLabel('Correo electrónico',{exact:true}).fill('ana@alia.example');await page.getByLabel('Contraseña',{exact:true}).fill(process.env.DEMO_PASSWORD!);await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();await expect(page.getByRole('heading',{name:'Hola, Ana.'})).toBeVisible();
 for(const [kind,label,name] of [['professionals','profesional',`Dra. Ficticia ${suffix}`],['rooms','consultorio',`Consultorio prueba ${suffix}`],['services','servicio',`Servicio prueba ${suffix}`]]){
  await page.goto(`/#${kind}`);await page.getByRole('button',{name:`Nuevo ${label}`,exact:true}).click();await page.getByLabel('Nombre',{exact:true}).fill(name);
  if(kind==='professionals'){await page.getByLabel('Tipo de relación',{exact:true}).selectOption('external');await page.getByLabel('Consultorio o institución externa',{exact:true}).fill('Centro externo ficticio');await page.getByLabel('Institución de formación',{exact:true}).fill('Institución ficticia');}
  if(kind==='services'){await page.getByLabel('Código',{exact:true}).fill(`E2E-${suffix.toUpperCase()}`);await page.getByLabel('Precio (MXN)',{exact:true}).fill('850.25');}
  await page.getByRole('button',{name:`Crear ${label}`,exact:true}).click();await page.getByRole('textbox',{name:new RegExp('Buscar')}).fill(name);await expect(page.getByRole('heading',{name:new RegExp(name)})).toBeVisible();
  if(kind==='professionals'){
   await page.getByLabel('Relación con el consultorio',{exact:true}).selectOption('internal');await expect(page.getByRole('heading',{name:new RegExp(name)})).toHaveCount(0);await page.getByLabel('Relación con el consultorio',{exact:true}).selectOption('external');await expect(page.getByRole('heading',{name:new RegExp(name)})).toBeVisible();await expect(page.locator('article').filter({hasText:name}).getByText('Centro externo ficticio',{exact:true})).toBeVisible();
   await page.locator('article').filter({hasText:name}).getByRole('button',{name:'Consultorios habilitados',exact:true}).click();
   await page.getByLabel('Consultorios que puede utilizar').selectOption('true');
   await page.getByRole('combobox',{name:'Añadir consultorio',exact:true}).fill('Consultorio 1');
   await page.getByRole('option').filter({hasText:'Consultorio 1'}).first().click();
   await page.getByRole('button',{name:'Guardar consultorios',exact:true}).click();
   await expect(page.getByRole('heading',{name:'Consultorios de '+name,exact:true})).toHaveCount(0);
   await page.locator('article').filter({hasText:name}).getByRole('button',{name:'Consultorios habilitados',exact:true}).click();
   await expect(page.getByLabel('Consultorios que puede utilizar')).toHaveValue('true');
   await expect(page.getByRole('button',{name:/Quitar Consultorio 1/})).toBeVisible();
   await page.screenshot({path:'test-results/'+info.project.name+'-professional-rooms.png',fullPage:true});
   await page.getByRole('button',{name:'Cerrar formulario'}).click();
   await page.locator('article').filter({hasText:name}).getByRole('button',{name:'Servicios habilitados',exact:true}).click();
   await page.getByLabel('Servicios que puede atender').selectOption('true');
   await page.getByRole('combobox',{name:'Añadir servicio',exact:true}).fill('Limpieza');
   await page.getByRole('option').filter({hasText:'Limpieza'}).first().click();
   await expect(page.getByRole('button',{name:/Quitar Limpieza/})).toBeVisible();
   await page.getByRole('button',{name:'Guardar servicios',exact:true}).click();
   await expect(page.getByRole('heading',{name:'Servicios de '+name,exact:true})).toHaveCount(0);
   await page.locator('article').filter({hasText:name}).getByRole('button',{name:'Servicios habilitados',exact:true}).click();
   await expect(page.getByLabel('Servicios que puede atender')).toHaveValue('true');
   await expect(page.getByRole('button',{name:/Quitar Limpieza/})).toBeVisible();
   await page.screenshot({path:'test-results/'+info.project.name+'-professional-services.png',fullPage:true});
   await page.getByRole('button',{name:'Cerrar formulario'}).click();
  }
  if(kind==='services'){await page.locator('article').filter({hasText:name}).getByRole('button',{name:'Historial de precios',exact:true}).click();await expect(page.getByRole('heading',{name:'Historial de precios'})).toBeVisible();await expect(page.getByText('$850.25',{exact:true}).first()).toBeVisible();await page.getByRole('button',{name:'Cerrar formulario'}).click();}
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:`test-results/${info.project.name}-${kind}.png`,fullPage:true});
  await page.locator('article').filter({hasText:name}).getByRole('button',{name:`Editar ${label}`,exact:true}).click();await page.getByRole('combobox',{name:'Estado del registro',exact:true}).selectOption('false');await page.getByLabel('Motivo del cambio de estado',{exact:true}).fill('Fin de prueba ficticia');await page.getByRole('button',{name:'Guardar cambios',exact:true}).click();await expect(page.getByRole('heading',{name:new RegExp(name)})).toHaveCount(0);
 }
});
