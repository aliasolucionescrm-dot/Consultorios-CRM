import 'dotenv/config';
import { test, expect } from '@playwright/test';
test('sign in, navigate foundation, command palette, and sign out',async({page},info)=>{
 await page.goto('/');await page.getByLabel('Correo electrónico',{exact:true}).fill('ana@alia.example');await page.getByLabel('Contraseña',{exact:true}).fill(process.env.DEMO_PASSWORD!);await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Hola, Ana.'})).toBeVisible();
 await page.screenshot({path:`test-results/${info.project.name}-home.png`,fullPage:true});
 await page.getByRole('button',{name:'Configurar mi organización',exact:true}).click();await expect(page.getByRole('heading',{name:'Tu organización',exact:true})).toBeVisible();await expect(page.getByLabel('Nombre comercial')).toHaveValue('Clínica Dental Alia');
 await page.getByRole('button',{name:'Abrir seguridad de mi cuenta'}).click();await expect(page.getByRole('heading',{name:'Seguridad y acceso'})).toBeVisible();await expect(page.getByText('Esta sesión',{exact:true})).toBeVisible();
 if(info.project.name==='desktop'){await page.keyboard.press('Control+k');await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('dialog').getByRole('button',{name:'Equipo',exact:true}).click();await expect(page.getByRole('heading',{name:'Tu equipo',exact:true})).toBeVisible();}
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.getByRole('button',{name:'Cerrar sesión',exact:true}).first().click();await expect(page.getByRole('heading',{name:'Tu día comienza aquí.'})).toBeVisible();
});
