import {readFile,writeFile,readdir,stat,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {chromium} from 'playwright';
const root=resolve('store-assets/global-v2'),hash=b=>createHash('sha256').update(b).digest('hex');
const before=JSON.parse(await readFile(root+'/research/project-before.json','utf8'));
const changed=[];for(const [file,digest]of Object.entries(before)){if(hash(await readFile(file))!==digest)changed.push(file);}assert.deepEqual(changed,[],'Protected project files changed');
const files=[];async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){const file=dir+'/'+e.name;if(e.isDirectory())await walk(file);else files.push(file);}}
await walk(root+'/final');const manifest=[];
for(const file of files){const bytes=await readFile(file);const entry={file:file.slice(root.length+1).replaceAll('\\','/'),bytes:bytes.length,sha256:hash(bytes)};
 if(file.endsWith('.png')){const m=await sharp(bytes).metadata();Object.assign(entry,{width:m.width,height:m.height,channels:m.channels,space:m.space});assert.equal(m.space,'srgb');
 if(file.includes('/screenshots/')){assert.equal(m.width,1080);assert.equal(m.height,1920);assert.equal(m.channels,3);}
 if(file.includes('feature-graphic')){assert.equal(m.width,1024);assert.equal(m.height,500);assert.equal(m.channels,3);}
 if(file.includes('icon-google')){assert.equal(m.width,512);assert.equal(m.height,512);assert.equal(m.channels,4);assert(bytes.length<=1024*1024);}
 if(file.includes('logo-transparent')){assert.equal(m.channels,4);const s=await sharp(bytes).stats();assert(s.channels[3].min===0&&s.channels[3].max===255);entry.hasTrueTransparency=true;}
 }manifest.push(entry);
}
// Validate actual Unicode coverage in the shipped font cmap rather than relying on silent fallback.
function hasGlyph(buffer,cp){
 let cmap;for(let i=0,n=buffer.readUInt16BE(4);i<n;i++){const p=12+i*16;if(buffer.toString('ascii',p,p+4)==='cmap')cmap=buffer.readUInt32BE(p+8);}
 assert(cmap!==undefined);for(let i=0,n=buffer.readUInt16BE(cmap+2);i<n;i++){
  const off=cmap+buffer.readUInt32BE(cmap+4+i*8+4),fmt=buffer.readUInt16BE(off);
  if(fmt===12){for(let j=0,n=buffer.readUInt32BE(off+12);j<n;j++){const p=off+16+j*12,a=buffer.readUInt32BE(p),z=buffer.readUInt32BE(p+4);if(cp>=a&&cp<=z)return buffer.readUInt32BE(p+8)+cp-a!==0;}}
  if(fmt===4&&cp<=65535){const n=buffer.readUInt16BE(off+6)/2,ends=off+14,starts=ends+n*2+2,deltas=starts+n*2,ranges=deltas+n*2;for(let j=0;j<n;j++){const a=buffer.readUInt16BE(starts+j*2),z=buffer.readUInt16BE(ends+j*2);if(cp<a||cp>z)continue;const delta=buffer.readInt16BE(deltas+j*2),range=buffer.readUInt16BE(ranges+j*2);if(!range)return((cp+delta)&65535)!==0;const g=buffer.readUInt16BE(ranges+j*2+range+(cp-a)*2);return g!==0&&((g+delta)&65535)!==0;}}
 }return false;
}
const glyphAudit=[];for(const name of ['paytoneone-PaytoneOne-Regular.ttf','barlowcondensed-BarlowCondensed-Bold.ttf']){const bytes=await readFile(root+'/source/fonts/'+name);const chars=[...'ÇĞİÖŞÜçğıöşüÉé'];const missing=chars.filter(c=>!hasGlyph(bytes,c.codePointAt(0)));assert.deepEqual(missing,[],name+' missing glyphs');glyphAudit.push({font:name,checked:chars.join(''),missing});}
const captureAudit=[];for(const lang of ['tr','en']){const r=JSON.parse(await readFile(root+`/research/capture-${lang}.json`,'utf8'));assert.equal(r.captures.length,6);assert.deepEqual(r.errors,[]);assert.deepEqual(r.failedRequests,[]);for(const c of r.captures){assert.equal(c.locale,lang);assert.equal(c.overflow,false);assert.equal(c.debugHud,false);}captureAudit.push({lang,count:r.captures.length,errors:r.errors,failedRequests:r.failedRequests,nativeLanguage:true});}
const browser=await chromium.launch({channel:'chrome',headless:true});const galleryAudit=[];
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.goto('http://127.0.0.1:5187/store-assets/global-v2/',{waitUntil:'networkidle'});for(const lang of ['tr','en']){await page.locator(`[data-lang="${lang}"]`).click();await page.locator(`[data-panel="${lang}"]`).waitFor({state:'visible'});await page.evaluate(async()=>{const imgs=[...document.images];await Promise.all(imgs.map(i=>{i.loading='eager';return i.decode();}));await document.fonts.ready;});const r=await page.evaluate(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,language:document.documentElement.lang,brokenImages:[...document.images].filter(i=>!i.naturalWidth).map(i=>i.src)}));assert.equal(r.overflow,false);assert.deepEqual(r.brokenImages,[]);assert.equal(r.language,lang);galleryAudit.push(r);if(width===1440&&lang==='tr')await page.screenshot({path:root+'/previews/gallery-desktop.png'});}}
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
const renderAudit=JSON.parse(await readFile(root+'/research/render-audit.json','utf8'));
assert.equal(renderAudit.pixelIdentityVerified,true);assert(renderAudit.headlineBandRatio<.2);
await writeFile(root+'/research/verification.json',JSON.stringify({checkedAt:new Date().toISOString(),protectedProjectFiles:Object.keys(before).length,changedProjectFiles:changed,gameCodeUnchanged:true,gameIdentifiersUnchanged:true,captures:captureAudit,glyphs:glyphAudit,gallery:galleryAudit,captionCoverage:renderAudit.headlineBandRatio,gameplayPixelIdentityVerified:true,finalFiles:manifest,rightsStatus:'CONDITIONAL: current cast distribution rights unverified per docs/KARAKTER-KAYNAGI.md',asoStatus:'Prelaunch qualitative recommendation; no measured keyword volume, difficulty or conversion lift.'},null,2));
await writeFile(root+'/research/final-files.sha256',manifest.map(e=>`${e.sha256}  ${e.file}`).join('\n')+'\n');
console.log(JSON.stringify({protectedFiles:Object.keys(before).length,changed:changed.length,finalFiles:manifest.length,passed:true}));
