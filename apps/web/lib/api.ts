export class ApiError extends Error {constructor(message:string,public status:number){super(message);}}
let csrf='';let organization='';
export function setContext(c:string,o:string){csrf=c;organization=o;}
export async function downloadFile(path:string,name:string){
 let response:Response;
 try{response=await fetch(`/api/${path}`,{credentials:'same-origin',headers:{'X-Organization-Id':organization}});}catch{throw new ApiError('No hay conexión. Intenta descargar de nuevo.',0);}
 if(!response.ok){const data=await response.json().catch(()=>({}));throw new ApiError(data.message||'No se pudo descargar el archivo.',response.status);}
 const url=URL.createObjectURL(await response.blob()),link=document.createElement('a');link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
export async function api<T=Record<string,unknown>>(path:string,method='GET',body?:unknown,timeoutMs?:number):Promise<T>{
 let response:Response;
 try{response=await fetch(`/api/${path}`,{method,signal:timeoutMs?AbortSignal.timeout(timeoutMs):undefined,credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf,'X-Organization-Id':organization},body:body===undefined?undefined:JSON.stringify(body)});}catch{throw new ApiError('No hay conexión. Revisa tu red y vuelve a intentar. Tus datos siguen en el formulario.',0);}
 const data=await response.json().catch(()=>{throw new ApiError('No pudimos confirmar la respuesta. Conserva tus cambios y vuelve a intentar.',response.status);});if(!response.ok)throw new ApiError(data.message||'No pudimos completar la operación.',response.status);return data;
}

export async function privateBlob(path:string):Promise<Blob>{
 const response=await fetch(`/api/${path}`,{signal:AbortSignal.timeout(15000),credentials:'same-origin',headers:{'X-Organization-Id':organization}});
 if(!response.ok){const data=await response.json().catch(()=>({}));throw new ApiError(data.message||'No se pudo cargar la imagen.',response.status);}
 return response.blob();
}
