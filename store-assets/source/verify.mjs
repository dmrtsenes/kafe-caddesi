import sharp from 'sharp';
import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const root='store-assets';
const brand=JSON.parse(await readFile(root+'/source/brand.json','utf8'));
const result={date:'2026-09-13',passed:false,files:[],gameplayPixelChecks:[],textChecks:[],rightsStatus:'UNVERIFIED_EXISTING_CHARACTER_DISTRIBUTION_LICENSE'};
async function check(path,w,h,alpha){
 const full=root+'/'+path,b=await readFile(full),m=await sharp(b).metadata();
 assert.equal(m.width,w,path);assert.equal(m.height,h,path);assert.equal(m.format,'png',path);assert.equal(m.hasAlpha,alpha,path);assert.equal(m.depth,'uchar');assert.equal(m.space,'srgb');
 const colorType=b[25];assert.equal(colorType,alpha?6:2,'PNG color type '+path);
 result.files.push({path,width:w,height:h,bytes:b.length,channels:m.channels,pngColorType:colorType,hasAlpha:m.hasAlpha,sha256:createHash('sha256').update(b).digest('hex')});
 return b;
}
const icon=await check('google-play/icon-512.png',512,512,true);assert.ok(icon.length<=1024*1024);
await check('google-play/feature-1024x500.png',1024,500,false);
assert.equal(brand.screenshots.length,6);
for(const s of brand.screenshots){
 const file='google-play/screenshots/'+s.id+'.png';await check(file,1080,1920,false);
 const raw=await sharp(root+'/captures/'+s.id+'.png').removeAlpha().raw().toBuffer();
 const actual=await sharp(root+'/'+file).extract({left:0,top:280,width:1080,height:1640}).removeAlpha().raw().toBuffer();
 assert.equal(actual.length,raw.length);let changed=0,maxDelta=0;for(let i=0;i<raw.length;i++){const delta=Math.abs(raw[i]-actual[i]);if(delta)changed++;maxDelta=Math.max(maxDelta,delta);}
 result.gameplayPixelChecks.push({id:s.id,changedChannels:changed,maxDelta,oneToOne:true});
 assert.equal(changed,0,'Game pixels changed: '+s.id);
 for(const t of [s.title,s.subtitle,s.alt]){assert.ok(!t.includes('\uFFFD'));assert.equal(t,t.normalize('NFC'));}
 assert.ok(s.alt.length<=140);result.textChecks.push({id:s.id,altLength:s.alt.length,normalized:true});
}
for(const name of ['logo-transparent.png','logo-light-transparent.png']){
 await check('brand/'+name,1600,420,true);const stats=await sharp(root+'/brand/'+name).stats();assert.equal(stats.channels[3].min,0);assert.equal(stats.channels[3].max,255);
}
assert.ok(280/1920<=.2);
const before=JSON.parse(await readFile(root+'/audit/project-before.json','utf8')),changed=[];
for(const [path,hash]of Object.entries(before)){const now=createHash('sha256').update(await readFile(path)).digest('hex');if(now!==hash)changed.push(path);}
await writeFile(root+'/audit/project-integrity.json',JSON.stringify({checkedFiles:Object.keys(before).length,changedFiles:changed,unchanged:changed.length===0,note:'Comparison against the initial working tree, including pre-existing uncommitted changes. Excludes generated store-assets files.'},null,2));
assert.deepEqual(changed,[],'Existing project files changed');
const evidence=JSON.parse(await readFile(root+'/audit/capture-evidence.json','utf8'));
assert.deepEqual(evidence.errors,[]);assert.deepEqual(evidence.failedRequests,[]);
const cap=id=>evidence.captures.find(s=>s.id===id);
assert.equal(cap('03-clean').player.vacuum,true);assert.equal(cap('03-clean').player.interaction,'mop');assert.equal(cap('04-cash').player.interaction,'cash');
assert.ok(cap('01-serve').player.slots.some(s=>['cay','latte','tost','waffle','frappe'].includes(s)));
assert.ok(cap('06-growth').state.zones.includes('kose:r1'));
assert.ok(evidence.captures.every(c=>c.docOverflow===false&&c.debugHud===false));
result.passed=true;result.projectFilesUnchanged=Object.keys(before).length;
await writeFile(root+'/audit/verification.json',JSON.stringify(result,null,2));
console.log(JSON.stringify({passed:true,exportedFiles:result.files.length,screenshots:6,gameplayPixelsUnchanged:true,projectFilesUnchanged:result.projectFilesUnchanged}));
