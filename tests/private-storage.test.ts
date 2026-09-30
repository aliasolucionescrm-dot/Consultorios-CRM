import { afterEach,it,expect } from 'vitest';
import { mkdtemp,readFile,writeFile,copyFile,mkdir,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,dirname,basename,resolve } from 'node:path';
import { randomBytes,randomUUID } from 'node:crypto';
import { LocalPrivateStorage,MAX_PRIVATE_FILE_BYTES } from '../apps/api/src/private-storage';
const directories:string[]=[];
async function fixture(){const root=await mkdtemp(join(tmpdir(),'alia-private-test-'));directories.push(root);return {root,storage:new LocalPrivateStorage(root,randomBytes(32).toString('hex')),org:randomUUID(),id:randomUUID()};}
afterEach(async()=>{for(const root of directories.splice(0)){
 if(dirname(resolve(root))!==resolve(tmpdir())||!basename(root).startsWith('alia-private-test-'))throw new Error('Unsafe test cleanup path');
 await rm(root,{recursive:true,force:true});
}});
it('encrypts bytes, preserves exact contents and prevents overwriting',async()=>{
 const {root,storage,org,id}=await fixture(),content=Buffer.from('Private patient attachment');
 await storage.put(org,id,content);expect(await storage.get(org,id)).toEqual(content);
 expect((await readFile(join(root,org,id+'.enc'))).includes(content)).toBe(false);
 await expect(storage.put(org,id,Buffer.from('replacement'))).rejects.toMatchObject({code:'EEXIST'});
 expect(await storage.get(org,id)).toEqual(content);
 await storage.remove(org,id);await storage.remove(org,id);await expect(storage.get(org,id)).rejects.toMatchObject({code:'ENOENT'});
});
it('rejects traversal, invalid configuration and excessive sizes',async()=>{
 const {root,storage,org,id}=await fixture();
 expect(()=>new LocalPrivateStorage('relative','a'.repeat(64))).toThrow();expect(()=>new LocalPrivateStorage(root,'short')).toThrow();
 await expect(storage.put('../escape',id,Buffer.from('x'))).rejects.toThrow();
 await expect(storage.get(org,'../../secret')).rejects.toThrow();
 await expect(storage.remove(org,'../../secret')).rejects.toThrow();
 await expect(storage.put(org,id,Buffer.alloc(0))).rejects.toThrow();
 await expect(storage.put(org,id,Buffer.alloc(MAX_PRIVATE_FILE_BYTES+1))).rejects.toThrow();
});
it('detects tampering, wrong keys and substitution across organizations or file IDs',async()=>{
 const {root,storage,org,id}=await fixture();await storage.put(org,id,randomBytes(128));
 const path=join(root,org,id+'.enc'),other= randomUUID(),otherId=randomUUID();
 await expect(storage.get(other,id)).rejects.toMatchObject({code:'ENOENT'});
 await mkdir(join(root,other));await copyFile(path,join(root,other,id+'.enc'));await expect(storage.get(other,id)).rejects.toThrow();
 await copyFile(path,join(root,org,otherId+'.enc'));await expect(storage.get(org,otherId)).rejects.toThrow();
 await expect(new LocalPrivateStorage(root,randomBytes(32).toString('hex')).get(org,id)).rejects.toThrow();
 const bytes=await readFile(path);bytes[bytes.length-1]^=1;await writeFile(path,bytes);await expect(storage.get(org,id)).rejects.toThrow();
});
