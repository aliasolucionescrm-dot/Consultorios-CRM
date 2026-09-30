import 'dotenv/config';
import { test,expect } from '@playwright/test';
test('navigate week and month and filter the calendar',async({page},info)=>{
 await page.goto('/');await page.getByLabel('Correo electrónico',{exact:true}).fill('ana@alia.example');await page.getByLabel('Contraseña',{exact:true}).fill(process.env.DEMO_PASSWORD!);await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();await expect(page.getByRole('heading',{name:'Hola, Ana.'})).toBeVisible();
 await page.goto('/#agenda');await page.getByLabel('Fecha de la agenda',{exact:true}).fill('2040-06-14');await page.getByRole('button',{name:'Semana',exact:true}).click();
 const week=page.getByRole('region',{name:'Calendario semanal'});await expect(week.locator('.calendar-canvas')).toHaveCount(1);await expect(page.getByLabel('Fecha de la agenda',{exact:true})).toHaveValue('2040-06-14');
 await page.getByRole('button',{name:'Mes',exact:true}).click();const month=page.getByRole('region',{name:'Calendario mensual'});await expect(month.locator('.calendar-canvas')).toHaveCount(1);
 await page.getByRole('combobox',{name:/Filtrar profesional/}).fill('Carlos');await page.getByRole('listbox').getByRole('option',{name:/Carlos/}).click();await expect(month.locator('.calendar-canvas')).toHaveCount(1);
 await page.getByRole('button',{name:'Quitar filtros',exact:true}).click();await expect(page.getByRole('combobox',{name:/Filtrar profesional/})).toHaveValue('');
 await page.getByRole('button',{name:'Mes siguiente',exact:true}).click();await expect(page.getByLabel('Fecha de la agenda',{exact:true})).toHaveValue('2040-07-14');await expect(month.locator('.calendar-canvas')).toHaveCount(1);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.screenshot({path:`test-results/${info.project.name}-calendar.png`,fullPage:true});
 await page.getByRole('button',{name:'Día',exact:true}).click();await expect(month).toHaveCount(0);
});
