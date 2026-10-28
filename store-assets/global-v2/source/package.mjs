import {readFile,writeFile,readdir,stat,rename} from 'node:fs/promises';
import {resolve} from 'node:path';
import {deflateRawSync,inflateRawSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=resolve('store-assets/global-v2'),filename='cafe-avenue-kafe-caddesi-store-kit.zip',target=root+'/'+filename;
const hash=b=>createHash('sha256').update(b).digest('hex');
const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(bytes){let c=0xffffffff;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
const paths=[];async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){const path=dir+'/'+e.name,relative=path.slice(root.length+1).replaceAll('\\','/');if(relative.startsWith('previews/report/')||relative.startsWith('previews/pdf/')||e.name===filename||e.name==='zip-audit.json'||e.name.endsWith('.zip.tmp'))continue;if(e.isDirectory())await walk(path);else paths.push({path,relative});}}
await walk(root);paths.sort((a,b)=>a.relative.localeCompare(b.relative,'en'));assert(paths.length<65535);
const local=[],central=[],index=new Map();let offset=0,centralBytes=0;
// Deterministic DOS date; UTF-8 filenames; standard ZIP32, method 8.
const date=((2026-1980)<<9)|(9<<5)|13;
for(const {path,relative}of paths){
 const bytes=await readFile(path),compressed=deflateRawSync(bytes,{level:7}),name=Buffer.from(relative),crc=crc32(bytes);
 assert(bytes.length<0xffffffff&&offset<0xffffffff);const h=Buffer.alloc(30);h.writeUInt32LE(0x04034b50);h.writeUInt16LE(20,4);h.writeUInt16LE(0x800,6);h.writeUInt16LE(8,8);h.writeUInt16LE(date,12);h.writeUInt32LE(crc,14);h.writeUInt32LE(compressed.length,18);h.writeUInt32LE(bytes.length,22);h.writeUInt16LE(name.length,26);
 local.push(h,name,compressed);const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(0x800,8);c.writeUInt16LE(8,10);c.writeUInt16LE(date,14);c.writeUInt32LE(crc,16);c.writeUInt32LE(compressed.length,20);c.writeUInt32LE(bytes.length,24);c.writeUInt16LE(name.length,28);c.writeUInt32LE(offset,42);central.push(c,name);centralBytes+=c.length+name.length;
 index.set(relative,{offset,length:compressed.length,nameLength:name.length,crc,sha256:hash(bytes)});offset+=h.length+name.length+compressed.length;
}
const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(paths.length,8);end.writeUInt16LE(paths.length,10);end.writeUInt32LE(centralBytes,12);end.writeUInt32LE(offset,16);
const zip=Buffer.concat([...local,...central,end]);const temp=target+'.tmp';await writeFile(temp,zip);
// Read back compressed entries and compare to the independent final asset manifest.
const final=JSON.parse(await readFile(root+'/research/verification.json','utf8'));
for(const f of final.finalFiles){const e=index.get(f.file);assert(e,'Missing final file '+f.file);const start=e.offset+30+e.nameLength,bytes=inflateRawSync(zip.subarray(start,start+e.length));assert.equal(crc32(bytes),e.crc);assert.equal(hash(bytes),f.sha256);}
await rename(temp,target);
const audit={file:filename,bytes:zip.length,entries:paths.length,finalAssetHashesVerified:final.finalFiles.length,sha256:hash(zip)};await writeFile(root+'/research/zip-audit.json',JSON.stringify(audit,null,2));console.log(JSON.stringify(audit));
