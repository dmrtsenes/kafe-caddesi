import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const args=Object.fromEntries(process.argv.slice(2).map(s=>s.replace(/^--/,'').split('=')));
const pack=args.pack??'quaternius';
assert.ok(['quaternius','cleanit'].includes(pack));
const phase=args.phase??'check',base=pack==='cleanit'?'.devshots/cleanit-optimization/':'.devshots/character-optimization/',out=base+phase;
assert.ok(/^[a-z0-9-]+$/.test(phase));
if(args.compare)assert.ok(/^[a-z0-9-]+$/.test(args.compare));
await mkdir(out,{recursive:true});
const server=args.url?null:await createServer({configFile:false,root:process.cwd(),optimizeDeps:{noDiscovery:true},server:{host:'127.0.0.1',port:5364,strictPort:true,hmr:false,watch:null,open:false}});
await server?.listen();
assert.ok(pack!=='cleanit'||args.url,'CleanIt checks require the local asset server URL');
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:256,height:320}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(new URL('/tools/character-benchmark.html',args.url??'http://127.0.0.1:5364').href);
 const result=await page.evaluate(async(pack)=>{
  const T=await import('/node_modules/three/build/three.module.js');
  let createPackCharacter;
  if(pack==='cleanit'){
    const actors=await import('/src/chars/CafeCharacters.ts'),customers=await import('/src/chars/CafeCustomers.ts');
    await Promise.all([actors.loadCafeCharacterPack(),customers.loadCafeCustomerPack()]);
    createPackCharacter=(role,opts)=>role==='customer'||role==='dasher'?customers.createCafeCustomer(role,opts):actors.createCafeCharacter(role,opts);
  }else{
   const actors=await import('/src/chars/PackCharacters.ts');await actors.loadCharacterPack();createPackCharacter=actors.createPackCharacter;
  }
  const renderer=new T.WebGLRenderer({antialias:false,preserveDrawingBuffer:true});renderer.setSize(256,320);
  renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.NeutralToneMapping;renderer.toneMappingExposure=1.04;
  document.body.appendChild(renderer.domElement);
  const scene=new T.Scene();scene.background=new T.Color('#ede7df');
  const light=new T.DirectionalLight(0xffffff,2.4);light.position.set(-2,4,5);scene.add(light,new T.HemisphereLight(0xffffff,0x75664d,1.2));
  const camera=new T.PerspectiveCamera(32,.8,.1,20);camera.position.set(2.2,2.0,4.6);camera.lookAt(0,.9,0);
  const fixtures=[];
  const represented=new Set(),roles=new Set();
  for(const role of ['player','customer','barista','waiter','cashier','busser','dasher','runner']){
   const limit=role==='customer'?30:role==='barista'?10:1;
   for(let n=417;n<417+limit;n++){
    const seed=Math.imul(n,2654435761)>>>0;
    const c=createPackCharacter(role,{seed}),id=c.root.userData.characterModel;
    const needed=pack==='cleanit'?(!represented.has(id)||!roles.has(role)):(!represented.has(id)||!['customer','barista'].includes(role));
    if(needed){fixtures.push({role,seed,id});represented.add(id);roles.add(role);}
    c.dispose();
   }
  }
  const pixels=[],statistics=[];
  const poses=pack==='cleanit'?['idle','walk','run','sit','carry','work','push','cheer','angry']:['idle','walk','sit','carry','work'];
  for(const fixture of fixtures)for(const pose of poses){
   const c=createPackCharacter(fixture.role,{seed:fixture.seed});scene.add(c.root);
   c.setState(['carry','run','push'].includes(pose)?'walk':pose);if(pose==='carry'){c.setCarryCount(3);c.setCarryMode('tray');}
   if(pose==='push')c.setPush(true,true);
   if(pose==='work'){c.setWorkKind('reach');c.setWorkPhase(.48);}
   for(let i=0;i<60;i++)c.update(1/60,pose==='run'?3.1:['walk','carry','push'].includes(pose)?1.7:0,.2);
   renderer.render(scene,camera);
   const data=new Uint8Array(256*320*4),gl=renderer.getContext();gl.readPixels(0,0,256,320,gl.RGBA,gl.UNSIGNED_BYTE,data);
   const key=fixture.role+'-'+fixture.seed+'-'+pose,skins=[];
   c.root.traverse(o=>{if(o.isSkinnedMesh)skins.push({vertices:o.geometry.attributes.position.count,triangles:o.geometry.index.count/3,bones:o.skeleton.bones.length});});
   statistics.push({key,model:c.root.userData.characterModel,height:c.height,hand:c.handMidLocal(new T.Vector3()).toArray(),span:c.handSpanLocal(new T.Vector3()).toArray(),skins});
   let binary='';for(let i=0;i<data.length;i+=8192)binary+=String.fromCharCode(...data.subarray(i,i+8192));
   pixels.push({key,data:btoa(binary)});c.dispose();
  }
  const live=[],times=[];
  for(let n=0;n<48;n++){const fixture=fixtures[n%fixtures.length],start=performance.now();const c=createPackCharacter(fixture.role,{seed:fixture.seed});times.push(performance.now()-start);live.push(c);scene.add(c.root);c.update(1/30,0);}
  renderer.render(scene,camera);
  const geometries=new Set(),attributes=new Set();
  for(const c of live)c.root.traverse(o=>{if(o.isSkinnedMesh){geometries.add(o.geometry);Object.values(o.geometry.attributes).forEach(a=>attributes.add(a));if(o.geometry.index)attributes.add(o.geometry.index);}});
  const liveBytes=[...attributes].reduce((n,a)=>n+a.array.byteLength,0),memoryBefore={...renderer.info.memory};
  // Dispose one shared-model peer and verify survivors still render identically.
  const target=live.pop();target.root.visible=false;renderer.render(scene,camera);
  const read=()=>{const d=new Uint8Array(256*320*4),gl=renderer.getContext();gl.readPixels(0,0,256,320,gl.RGBA,gl.UNSIGNED_BYTE,d);return d;};
  const survivorsBefore=read();target.dispose();renderer.render(scene,camera);const survivorsAfter=read();
  let survivorPixelDifference=0;for(let i=0;i<survivorsAfter.length;i++)survivorPixelDifference=Math.max(survivorPixelDifference,Math.abs(survivorsBefore[i]-survivorsAfter[i]));
  const cleanupError=renderer.getContext().getError();
  for(const c of live)c.dispose();renderer.render(scene,camera);
  times.sort((a,b)=>a-b);
  const report={fixtures,statistics,pixels,liveCount:live.length+1,uniqueGeometries:geometries.size,liveBytes,createMedian:times[Math.floor(times.length/2)],createP95:times[Math.floor(times.length*.95)],memoryBefore,memoryAfter:{...renderer.info.memory},cleanupError,survivorPixelDifference};
  renderer.dispose();return report;
 },pack);
 const pairs=[];
 for(const p of result.pixels){
  const data=Buffer.from(p.data,'base64');await writeFile(out+'/'+p.key+'.rgba',data);
  if(args.compare){const before=await readFile(base+args.compare+'/'+p.key+'.rgba');let bad=0,max=0;assert.equal(data.length,before.length);for(let i=0;i<data.length;i+=4){let d=0;for(let c=0;c<3;c++)d=Math.max(d,Math.abs(data[i+c]-before[i+c]));max=Math.max(max,d);if(d>4)bad++;}pairs.push({key:p.key,max,badFraction:bad/(data.length/4)});}
 }
 delete result.pixels;await writeFile(out+'/result.json',JSON.stringify({result,pairs,errors},null,2));
 assert.deepEqual(errors,[]);assert.equal(result.cleanupError,0);
 assert.equal(result.survivorPixelDifference,0);
 assert.equal(new Set(result.fixtures.map(f=>f.id)).size,pack==='cleanit'?3:7);
 if(args.compare){
  const baseline=JSON.parse(await readFile(base+args.compare+'/result.json','utf8')).result;
  for(const stat of result.statistics){const old=baseline.statistics.find(s=>s.key===stat.key);assert.equal(stat.model,old.model);assert.equal(stat.height,old.height);for(const field of ['hand','span'])for(let i=0;i<3;i++)assert.ok(Math.abs(stat[field][i]-old[field][i])<1e-5,stat.key+' '+field);}
 }
 assert.ok(pairs.every(p=>p.badFraction<.001),JSON.stringify(pairs.filter(p=>p.badFraction>=.001)));
 if(pack==='cleanit'&&args.compare)assert.ok(pairs.every(p=>p.max===0),'Current cast must remain pixel-identical');
 console.log(JSON.stringify({fixtures:result.fixtures,poses:result.statistics.length,liveCount:result.liveCount,uniqueGeometries:result.uniqueGeometries,liveBytes:result.liveBytes,createMedian:result.createMedian,createP95:result.createP95,worstPixelDifference:Math.max(0,...pairs.map(p=>p.max))}));
}finally{await browser.close();await server?.close();}
