import 'dotenv/config';
if(process.env.NODE_ENV==='production'||process.env.ALLOW_DEMO_SEED!=='true')throw new Error('Demo only');
let cookie='',csrf='',org='';
async function call(path,method='GET',body){
 const r=await fetch(`http://127.0.0.1:4000/api/${path}`,{method,headers:{'Content-Type':'application/json',Origin:process.env.APP_ORIGIN,Cookie:cookie,'X-CSRF-Token':csrf,'X-Organization-Id':org},body:body?JSON.stringify(body):undefined});
 if(path==='auth/login')cookie=r.headers.get('set-cookie')?.split(';')[0]||'';
 if(!r.ok)throw new Error(`Seed failed: ${path} (${r.status})`);return r.json();
}
await call('auth/login','POST',{email:'ana@alia.example',password:process.env.DEMO_PASSWORD});
try{
 const me=await call('auth/me');csrf=me.csrf;org=me.organizations.find(o=>o.name==='Clínica Dental Alia')?.id;
 if(!org)throw new Error('Demo organization required');
 const context=await call('organization'),branch=context.branches.find(b=>b.name==='Altabrisa')?.id;if(!branch)throw new Error('Demo branch required');
 const groups={professionals:[{name:'Dra. Ana Martínez',specialty:'Odontología general',branch_ids:[branch]},{name:'Dr. Carlos Pérez',specialty:'Endodoncia',branch_ids:[branch]}],rooms:[{name:'Consultorio 1',branch_id:branch,number:'01',chair:'Sillón 01'},{name:'Consultorio 2',branch_id:branch,number:'02',chair:'Sillón 02'}],services:[{name:'Valoración inicial',code:'DEMO-VAL',category:'Diagnóstico',duration_minutes:30,price_minor:50000,cost_minor:10000,currency:'MXN'},{name:'Limpieza dental',code:'DEMO-PROF',category:'Preventiva',duration_minutes:45,price_minor:85000,cost_minor:20000,currency:'MXN'},{name:'Restauración de resina',code:'DEMO-RES',category:'Restaurativa',duration_minutes:60,price_minor:120000,cost_minor:35000,currency:'MXN',requires_tooth:true,requires_consent:true}]};
 for(const [kind,entries] of Object.entries(groups))for(const item of entries){const found=await call(`catalogs/${kind}?status=all&q=${encodeURIComponent(item.name)}`);if(!found.items.some(r=>r.name===item.name))await call(`catalogs/${kind}`,'POST',item);}
 console.log('Fictional catalogs ready; existing records preserved.');
}finally{await call('auth/logout','POST');}
