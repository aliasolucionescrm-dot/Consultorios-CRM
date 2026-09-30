import 'dotenv/config';
import { test,expect,type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
async function bookingResources(page:Page){
 const me=await (await page.request.get('/api/auth/me')).json();const org=me.organizations.find((o:{name:string})=>o.name==='Clínica Dental Alia').id;
 const headers={'Origin':process.env.APP_ORIGIN!,'X-CSRF-Token':me.csrf,'X-Organization-Id':org};
 const context=await (await page.request.get('/api/organization',{headers})).json();const branch=context.branches.find((b:{name:string})=>b.name==='Altabrisa').id;
 const suffix=randomUUID().slice(0,8),professional='Recepción profesional '+suffix,room='Recepción sala '+suffix,service='Recepción servicio '+suffix;
 for(const [kind,data] of [['professionals',{name:professional,branch_ids:[branch]}],['rooms',{name:room,branch_id:branch}],['services',{name:service,code:'RX-'+suffix.toUpperCase(),category:'Diagnóstico',duration_minutes:30,price_minor:50000,currency:'MXN'}]] as const){const r=await page.request.post('/api/catalogs/'+kind,{headers,data});expect(r.ok(),await r.text()).toBe(true);}
 return [['Profesional',professional],['Consultorio',room],['Servicio',service]];
}

test('register a new caller without losing the booking draft',async({page},info)=>{
 const name=`Llamada${Date.now()}${info.project.name}`,day='2041-07-16';
 await page.goto('/');await page.getByLabel('Correo electrónico',{exact:true}).fill('ana@alia.example');await page.getByLabel('Contraseña',{exact:true}).fill(process.env.DEMO_PASSWORD!);await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();await expect(page.getByRole('heading',{name:'Hola, Ana.'})).toBeVisible();
 const resources=await bookingResources(page);
 await page.goto('/#agenda');await page.getByLabel('Fecha de la agenda',{exact:true}).fill(day);await page.getByRole('button',{name:'Nueva cita',exact:true}).click();
 await page.getByLabel('Inicio de la cita',{exact:true}).fill(`${day}T16:00`);
 for(const [name,search] of resources){await page.getByRole('combobox',{name:name+' *',exact:true}).fill(search);await page.getByRole('listbox').getByRole('option').first().click();}
 await page.getByRole('combobox',{name:/Paciente/}).fill('000000001234567890');await expect(page.getByText(/No encontramos coincidencias/)).toBeVisible();
 await page.getByRole('button',{name:'+ Registrar paciente nuevo',exact:true}).click();await page.getByLabel('Nombre del paciente',{exact:true}).fill(name);await page.getByLabel('Apellidos del paciente',{exact:true}).fill('Prueba ficticia');
 await page.getByRole('button',{name:'Registrar y continuar',exact:true}).click();await expect(page.getByRole('combobox',{name:/Paciente/})).toHaveValue(`${name} Prueba ficticia`);await expect(page.getByLabel('Inicio de la cita',{exact:true})).toHaveValue(`${day}T16:00`);
 await page.screenshot({path:`test-results/${info.project.name}-quick-patient.png`,fullPage:true});
 await page.getByRole('button',{name:'Reservar cita',exact:true}).click();const card=page.locator('article').filter({hasText:name});await expect(card).toBeVisible();
 await card.getByRole('button',{name:'Ver cita',exact:true}).click();await page.getByRole('combobox',{name:'Nuevo estado',exact:true}).selectOption('canceled');await page.getByLabel('Motivo del cambio',{exact:true}).fill('Fin de prueba ficticia');await page.getByRole('button',{name:'Cambiar estado',exact:true}).click();await expect(card).toContainText('Cancelada');
});
test('reserve, reschedule and cancel a persisted appointment',async({page},info)=>{
 const day=`2040-06-${info.project.name==='desktop'?'14':'15'}`;
 await page.goto('/');await page.getByLabel('Correo electrónico',{exact:true}).fill('ana@alia.example');await page.getByLabel('Contraseña',{exact:true}).fill(process.env.DEMO_PASSWORD!);await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();await expect(page.getByRole('heading',{name:'Hola, Ana.'})).toBeVisible();
 await page.goto('/#agenda');await expect(page.getByRole('heading',{name:'Agenda',exact:true})).toBeVisible();await page.getByLabel('Fecha de la agenda',{exact:true}).fill(day);
 await page.getByRole('button',{name:'Nueva cita',exact:true}).click();
 await page.getByRole('combobox',{name:'Paciente',exact:false}).fill('María Fernanda');
 await page.getByRole('option',{name:/María Fernanda/}).click();
 for(const name of ['Profesional','Consultorio','Servicio']){
  await page.getByRole('combobox',{name:name+' *',exact:true}).click();await page.getByRole('listbox').getByRole('option').first().click();
 }
 await page.getByLabel('Inicio de la cita',{exact:true}).fill(`${day}T09:00`);await page.getByLabel('Duración en minutos',{exact:true}).fill('30');await page.getByLabel('Tiempo entre pacientes (minutos)',{exact:true}).fill('15');
 await page.screenshot({path:`test-results/${info.project.name}-appointment-form.png`,fullPage:true});
 await page.getByRole('button',{name:'Reservar cita',exact:true}).click();await expect(page.getByRole('heading',{name:'Nueva cita',exact:true})).toHaveCount(0);
 const card=page.locator('article').filter({has:page.getByRole('button',{name:'Reprogramar',exact:true})});await expect(card).toHaveCount(1);await expect(card).toContainText('09:00');
 await card.getByRole('button',{name:'Reprogramar',exact:true}).click();await page.getByLabel('Inicio de la cita',{exact:true}).fill(`${day}T11:00`);await page.getByLabel('Motivo de reprogramación',{exact:true}).fill('Prueba ficticia de reprogramación');await page.getByRole('button',{name:'Guardar reprogramación',exact:true}).click();await expect(card).toContainText('11:00');await expect(card).toContainText('Preparación: 15 min');
 await page.reload();await page.getByLabel('Fecha de la agenda',{exact:true}).fill(day);await expect(card).toContainText('11:00');
 await card.getByRole('button',{name:'Ver cita',exact:true}).click();await expect(page.getByText('Prueba ficticia de reprogramación',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.screenshot({path:`test-results/${info.project.name}-agenda.png`,fullPage:true});
 await page.getByRole('combobox',{name:'Nuevo estado',exact:true}).selectOption('canceled');await page.getByLabel('Motivo del cambio',{exact:true}).fill('Fin de prueba ficticia');await page.getByRole('button',{name:'Cambiar estado',exact:true}).click();await expect(card).toHaveCount(0);await expect(page.locator('article').filter({hasText:'Cancelada'}).first()).toBeVisible();
});
