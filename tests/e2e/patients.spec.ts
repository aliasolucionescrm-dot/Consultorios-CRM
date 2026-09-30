import 'dotenv/config';
import { test,expect } from '@playwright/test';
test('patient registration, search, edit and persistent profile',async({page},info)=>{
 test.setTimeout(60000);
 const unique=`Ficticio${Date.now()}${info.project.name}`;
 await page.goto('/');await page.getByLabel('Correo electrónico',{exact:true}).fill('ana@alia.example');await page.getByLabel('Contraseña',{exact:true}).fill(process.env.DEMO_PASSWORD!);await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();await expect(page.getByRole('heading',{name:'Hola, Ana.'})).toBeVisible();
 await page.goto('/#patients');await expect(page.getByRole('heading',{name:'Personas, antes que expedientes.'})).toBeVisible();
 await page.getByRole('button',{name:'Nuevo paciente',exact:true}).click();await page.getByLabel('Nombre(s)',{exact:true}).fill(unique);await page.getByLabel('Apellidos',{exact:true}).fill('Prueba Automatizada');await page.getByLabel('Fecha de nacimiento',{exact:true}).fill('1990-02-20');await page.getByLabel('Correo electrónico',{exact:true}).fill(`${unique.toLowerCase()}@example.invalid`);
 await page.getByRole('button',{name:'Registrar paciente',exact:true}).click();await expect(page.getByRole('heading',{name:`${unique} Prueba Automatizada`,exact:true})).toBeVisible();
 const profileUrl=page.url();await page.getByRole('button',{name:'Editar datos',exact:true}).click();await page.getByLabel('Ocupación',{exact:true}).fill('Paciente ficticio E2E');await page.getByRole('button',{name:'Guardar cambios',exact:true}).click();await expect(page.getByText('Paciente ficticio E2E',{exact:true})).toBeVisible();
 await page.reload();await expect(page.getByText('Paciente ficticio E2E',{exact:true})).toBeVisible();
 await page.screenshot({path:`test-results/${info.project.name}-patient.png`,fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.getByRole('button',{name:'Volver a pacientes',exact:true}).click();await page.getByLabel('Buscar pacientes',{exact:true}).fill(unique);await expect(page.getByRole('button',{name:new RegExp(unique)})).toBeVisible();
 await page.getByRole('button',{name:new RegExp(unique)}).click();await expect(page).toHaveURL(profileUrl);
 // Preserve audit history but keep the active demo directory clean.
 await page.getByRole('button',{name:'Editar datos',exact:true}).click();await page.getByRole('combobox',{name:'Estado del paciente',exact:true}).selectOption('false');await page.getByLabel('Motivo del cambio de estado',{exact:true}).fill('Fin de prueba automatizada con datos ficticios');await page.getByRole('button',{name:'Guardar cambios',exact:true}).click();await expect(page.getByText('Inactivo',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Cerrar sesión',exact:true}).first().click();
});
