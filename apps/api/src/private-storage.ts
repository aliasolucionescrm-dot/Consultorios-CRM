import { createCipheriv,createDecipheriv,randomBytes } from 'node:crypto';
import { mkdir,readFile,writeFile,unlink } from 'node:fs/promises';
import { isAbsolute,join,resolve } from 'node:path';

export const MAX_PRIVATE_FILE_BYTES=10*1024*1024;
const identifier=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const header=Buffer.from('ALIAFILE1');

/** Internal adapter. Callers must authorize the tenant and file before every operation. */
export interface PrivateStorage {
 put(organizationId:string,fileId:string,content:Buffer):Promise<void>;
 get(organizationId:string,fileId:string):Promise<Buffer>;
 remove(organizationId:string,fileId:string):Promise<void>;
}

export class LocalPrivateStorage implements PrivateStorage {
 private readonly root:string;
 private readonly key:Buffer;
 constructor(root:string,keyHex:string){
  if(!isAbsolute(root))throw new Error('Private storage requires an absolute directory');
  if(!/^[a-f0-9]{64}$/i.test(keyHex))throw new Error('Private storage requires a dedicated 32-byte encryption key');
  this.root=resolve(root);this.key=Buffer.from(keyHex,'hex');
 }
 private location(organizationId:string,fileId:string){
  if(!identifier.test(organizationId)||!identifier.test(fileId))throw new Error('Invalid private storage identifier');
  const org=organizationId.toLowerCase(),id=fileId.toLowerCase();
  return {directory:join(this.root,org),path:join(this.root,org,id+'.enc'),aad:Buffer.from(org+'/'+id)};
 }
 async put(organizationId:string,fileId:string,content:Buffer){
  const target=this.location(organizationId,fileId);
  if(!Buffer.isBuffer(content)||!content.length||content.length>MAX_PRIVATE_FILE_BYTES)throw new Error('Private file must contain 1–10485760 bytes');
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',this.key,iv);cipher.setAAD(target.aad);
  const encrypted=Buffer.concat([cipher.update(content),cipher.final()]);
  await mkdir(target.directory,{recursive:true,mode:0o700});
  // Exclusive creation prevents accidental replacement of an existing file.
  await writeFile(target.path,Buffer.concat([header,iv,cipher.getAuthTag(),encrypted]),{flag:'wx',mode:0o600});
 }
 async get(organizationId:string,fileId:string){
  const target=this.location(organizationId,fileId),data=await readFile(target.path);
  if(data.length<=header.length+28||data.length>MAX_PRIVATE_FILE_BYTES+header.length+28||!data.subarray(0,header.length).equals(header))throw new Error('Invalid private file envelope');
  const offset=header.length,decipher=createDecipheriv('aes-256-gcm',this.key,data.subarray(offset,offset+12));
  decipher.setAAD(target.aad);decipher.setAuthTag(data.subarray(offset+12,offset+28));
  return Buffer.concat([decipher.update(data.subarray(offset+28)),decipher.final()]);
 }
 async remove(organizationId:string,fileId:string){
  const target=this.location(organizationId,fileId);
  try{await unlink(target.path);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 }
}

/** Explicit opt-in: no generated keys and no fallback to the MFA key. */
export function configuredPrivateStorage():PrivateStorage {
 const directory=process.env.PRIVATE_STORAGE_DIR,key=process.env.PRIVATE_STORAGE_KEY;
 if(!directory||!key)throw new Error('PRIVATE_STORAGE_DIR and PRIVATE_STORAGE_KEY required');
 return new LocalPrivateStorage(directory,key);
}
