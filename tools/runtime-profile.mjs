import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
const args=Object.fromEntries(process.argv.slice(2).map(s=>s.replace(/^--/,'').split('=')));
const out='.devshots/premium-performance/'+(args.phase??'runtime-check');
await mkdir(out,{recursive:true});
const server=args.url?null:await createServer({configFile:false,root:process.cwd(),optimizeDeps:{noDiscovery:true},server:{host:'127.0.0.1',port:0,open:false,hmr:false,watch:null}});
if(server)await server.listen();
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
try {
 const context=await browser.newContext({viewport:{width:384,height:832},deviceScaleFactor:2.8125,isMobile:true,hasTouch:true,storageState:{cookies:[],origins:[]}});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.addInitScript(quality=>{
  localStorage.setItem('fincan-sokagi:settings:v2',JSON.stringify({quality,qualityAuto:false,fps:60,music:false,muted:true}));
  let instance;Object.defineProperty(window,'__fincan',{get:()=>instance,set:g=>{instance=g;g.persistDisabled=true;}});
  let seed=417;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 },args.quality??'high');
 await page.goto(args.url??server.resolvedUrls.local[0],{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>window.__fincan,null,{timeout:90000});
 await page.locator('#boot-screen').waitFor({state:'detached',timeout:90000});
 await page.evaluate(()=>{
  const g=window.__fincan,w=g.world;g.stop();g.ui.setTutorial(null);g.state.tutorialStep=99;g.ui.closePanels();
  for(const z of w.loc.zones)if(!w.zoneUnlocked(z.id))w.unlockZone(z.id);
  Object.assign(g.state.staffCount,{waiter:2,barista:2,cashier:2,busser:2});w.syncStaff();g.ui.endCelebrate();
  g.player.setPosition(-3,-6);g.scene3d.snapTo(-3,-6);
  const draw=g.scene3d.render.bind(g.scene3d);g.scene3d.render=()=>{};
  for(let i=0;i<3600;i++)g.tick(1/30);
  g.scene3d.render=draw;g.scene3d.render();
 });
 const cdp=await context.newCDPSession(page);
 await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:200});await cdp.send('Profiler.start');
 const metrics=await page.evaluate(()=>{
  const g=window.__fincan,samples=[];
  const move=g.input.move;g.input.update=()=>move;
  for(let i=0;i<900;i++){
   Object.assign(move,{x:Math.sin(i/45)>.0?.8:-.8,y:0,mag:.8,active:true});
   const start=performance.now();g.tick(1/30);samples.push(performance.now()-start);
  }
  samples.sort((a,b)=>a-b);
  const skins=[];g.world.root.traverse(o=>{if(o.isSkinnedMesh)skins.push({vertices:o.geometry.attributes.position.count,indices:o.geometry.index?.count??0,bones:o.skeleton.bones.length,bytes:Object.values(o.geometry.attributes).reduce((sum,a)=>sum+a.array.byteLength,0)+(o.geometry.index?.array.byteLength??0),boneTextureBytes:o.skeleton.boneTexture?.image.data.byteLength??0});});
  return {median:samples[450],p90:samples[810],p99:samples[891],mean:samples.reduce((a,b)=>a+b,0)/samples.length,customers:g.world.customers.length,staff:g.world.staff.length,skins,layout:g.world.validateLayout(),glError:g.scene3d.renderer.getContext().getError(),memory:{...g.scene3d.renderer.info.memory}};
 });
 const {profile}=await cdp.send('Profiler.stop');
 await writeFile(out+'/cpu.cpuprofile',JSON.stringify(profile));
 const nodes=new Map(profile.nodes.map(n=>[n.id,n])),time=new Map();
 for(let i=0;i<(profile.samples?.length??0);i++){const node=nodes.get(profile.samples[i]),key=node.callFrame.functionName+' '+node.callFrame.url.split('/').slice(-2).join('/');time.set(key,(time.get(key)??0)+(profile.timeDeltas[i]??0));}
 const top=[...time].sort((a,b)=>b[1]-a[1]).slice(0,30).map(([name,us])=>({name,ms:us/1000}));
 const report={metrics,top,errors};await writeFile(out+'/runtime.json',JSON.stringify(report,null,2));
 assert.deepEqual(errors,[]);assert.deepEqual(metrics.layout,[]);assert.equal(metrics.glError,0);
 console.log(JSON.stringify(report));
} finally {await browser.close();await server?.close();}
