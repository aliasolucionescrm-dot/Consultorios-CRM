import 'dotenv/config';
import { test,expect } from '@playwright/test';
test('search operational entities and open their destinations',async({page},info)=>{
 await page.goto('/');await page.getByLabel('Correo electrónico',{exact:true}).fill('ana@alia.example');await page.getByLabel('Contraseña',{exact:true}).fill(process.env.DEMO_PASSWORD!);await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();await expect(page.getByRole('heading',{name:'Hola, Ana.'})).toBeVisible();
 await page.locator('.search-trigger').click();await page.getByRole('textbox',{name:'Buscar una acción',exact:true}).fill('Limpieza');const dialog=page.getByRole('dialog');await expect(dialog.getByRole('region',{name:'Servicios'}).getByRole('button',{name:/Limpieza dental/})).toBeVisible();
 await page.screenshot({path:`test-results/${info.project.name}-global-search.png`,fullPage:true});
 await dialog.getByRole('region',{name:'Servicios'}).getByRole('button',{name:/Limpieza dental/}).click();await expect(page.getByRole('heading',{name:'Servicios',exact:true})).toBeVisible();await expect(page.locator('article')).toHaveCount(1);await expect(page.locator('article')).toContainText('Limpieza dental');
 await page.locator('.search-trigger').click();await page.getByRole('textbox',{name:'Buscar una acción',exact:true}).fill('María Fernanda');const appointment=dialog.getByRole('region',{name:'Citas'}).getByRole('button').first();await expect(appointment).toBeVisible();await appointment.click();await expect(page.getByRole('heading',{name:'Agenda',exact:true})).toBeVisible();await expect(page.locator('article').filter({hasText:'María Fernanda'}).first()).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
