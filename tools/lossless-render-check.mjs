import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';

const out='.devshots/lossless-render-2026-09-12';
const files=['src/world/Environment.ts','src/world/StationView.ts','src/world/PickupView.ts','src/world/VisibilityRoot.ts','src/entities/CarryStack.ts',
  'src/chars/CafeCharacters.ts','src/chars/CafeCustomers.ts'];
const originals=new Map(await Promise.all(files.map(async file=>[
  resolve(file).replaceAll('\\','/'),await readFile(out+'/before/'+file,'utf8')])));
let reference=true;
const server=await createServer({configFile:false,root:process.cwd(),optimizeDeps:{noDiscovery:true},
  plugins:[{name:'lossless-reference',enforce:'pre',load(id){if(reference)return originals.get(id.split('?')[0]);},
    transform(code,id){
      // Allocation count changes UUID generation. Isolate these renderer IDs
      // from gameplay randomness so both fixtures receive identical orders.
      if(id.replaceAll('\\','/').endsWith('/three/build/three.module.js'))
        return 'let fixtureUuid=0;\n'+code.replace(/function generateUUID\(\) \{[\s\S]*?\n\}/,
          "function generateUUID() { return '00000000-0000-4000-8000-'+(++fixtureUuid).toString(16).padStart(12,'0'); }");
    }}],
  server:{host:'127.0.0.1',port:0,open:false,hmr:false,watch:null}});
await server.listen();
const browser=await chromium.launch({channel:'chrome',headless:true});
const reports=[];
const pages=[];
try {
 for(const mode of ['reference','optimized']) {
  reference=mode==='reference';server.moduleGraph.invalidateAll();
  const context=await browser.newContext({viewport:{width:384,height:832},deviceScaleFactor:2.8125,isMobile:true,hasTouch:true});
  const page=await context.newPage(),errors=[];
  pages.push(page);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.addInitScript(()=>{
   localStorage.setItem('fincan-sokagi:settings:v2',JSON.stringify({quality:'high',qualityAuto:false,fps:60,muted:true,music:false}));
   Date.now=()=>1789171200000;
   let seed=417;window.__seedReset=()=>{seed=417;};Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
   let game;Object.defineProperty(window,'__fincan',{get:()=>game,set:g=>{game=g;g.persistDisabled=true;g.stop();g.ui.hideBoot();}});
  });
  await page.goto(server.resolvedUrls.local[0],{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__fincan,null,{timeout:90000});
  const prep=await page.evaluate(()=>{
   const g=window.__fincan,w=g.world,s=g.scene3d;g.state.tutorialStep=99;g.ui.setTutorial(null);g.ui.closePanels();
   for(const zone of w.loc.zones)if(!w.zoneUnlocked(zone.id))w.unlockZone(zone.id);
   Object.assign(g.state.staffCount,{waiter:2,barista:2,cashier:2,busser:2});w.syncStaff();g.ui.endCelebrate();
   g.player.setPosition(-3,-6);s.snapTo(-3,-6);window.__seedReset();
   const draw=s.render;s.render=()=>{};for(let i=0;i<1800;i++)g.tick(1/30);s.render=draw;
   return {money:g.state.money,stats:g.state.stats,customers:w.customers.map(c=>({x:c.x,z:c.z,state:c.state})),staff:w.staff.length};
  });
  const frames=[];
  for(const tier of ['high','medium','low']) {
   const pictures=await page.evaluate(async tier=>{
    const g=window.__fincan,w=g.world,s=g.scene3d,r=s.renderer,T=await import('/node_modules/three/build/three.module.js');
    g.setQualityTier(tier);const pictures=[];
    const snap=async name=>{
     s.invalidateStatic();s.invalidateShadows();s.haveCacheView=false;
     for(let i=0;i<8;i++){s.haveCacheView=false;s.render();}
     const gl=r.getContext(),data=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);
     gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,data);
     const zipped=new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
     let raw='';for(let i=0;i<zipped.length;i+=8192)raw+=String.fromCharCode(...zipped.subarray(i,i+8192));
     pictures.push({name:tier+'-'+name,data:btoa(raw),calls:r.info.render.calls,triangles:r.info.render.triangles,width:gl.drawingBufferWidth,height:gl.drawingBufferHeight});
    };
    for(const [name,x,z]of [['production',-3,-6],['tables',0,4],['lounge',13,13.5]]) {
     s.snapTo(x,z);w.setViewFromCamera(s.camera);w.updateVisuals(0);await snap(name);
    }
    const counter=w.stationVisuals.get(w.counters[0].id);
    counter.setLocked(false);counter.update(1);s.snapTo(counter.root.position.x,counter.root.position.z+2);
    for(const count of [0,1,3,6]){counter.setOutput(count,100,null);await snap('cash-'+count);}
    const machine=w.machines.find(st=>st.def.item==='cay'),view=w.stationVisuals.get(machine.id);
    view.setLocked(false);view.update(1);s.snapTo(view.root.position.x,view.root.position.z+2);
    for(const count of [0,1,2,3]){view.setOutput(count,machine.outputCap,'cay');await snap('output-'+count);}
    view.playUnlock(.1);view.update(.2);await snap('machine-unlock');view.update(1);
    for(const item of ['latte','tost','waffle','frappe']){
     const st=w.machines.find(st=>st.def.item===item),v=w.stationVisuals.get(st.id);
     v.setLocked(false);v.update(1);s.snapTo(v.root.position.x,v.root.position.z+2);
     for(const count of [0,3]){v.setOutput(count,st.outputCap,item);await snap(item+'-output-'+count);}
    }
    // Return to each carrier repeatedly, including empty and overflow states.
    const stack=g.player.stack;s.snapTo(g.player.x,g.player.z);
    for(const [level,count]of [[0,3],[4,6],[8,15],[8,21],[0,0]]){
     stack.setPresentationStage(level);stack.setSlots(Array.from({length:count},(_,i)=>['cay','latte','tost'][i%3]));
     g.player.char.setCarryCount(count);g.player.char.setCarryMode(count?(level>=8?'cart':'tray'):'none');
     for(let i=0;i<12;i++){g.player.char.update(1/60,1.5);stack.update(1/60,.5,1.5);stack.fitCartGrip(g.player.char.handMidLocal(new T.Vector3()),g.player.char.handSpanLocal(new T.Vector3()));}
     await snap('carry-'+level+'-'+count);
    }
    for(const state of ['idle','work','walk','idle','cheer','angry','walk']){
     g.player.char.setState(state);g.player.char.setWorkKind('cash');
     for(let i=0;i<30;i++)g.player.char.update(1/60,state==='walk'?1.5:0);
     await snap('pose-'+state+'-'+pictures.length);
    }
    for(const state of ['work','idle','cheer','angry','walk','idle','work']){
     g.player.char.setState(state);g.player.char.setWorkKind('cash');
     for(let i=0;i<2;i++)g.player.char.update(1/60,state==='walk'?1.5:0);
     await snap('rapid-'+state+'-'+pictures.length);
    }
    return pictures;
   },tier);
   await mkdir(out+'/'+mode,{recursive:true});
   for(const picture of pictures){const {data,...meta}=picture;await writeFile(out+'/'+mode+'/'+picture.name+'.rgba.gz',Buffer.from(data,'base64'));frames.push(meta);}
   await page.screenshot({path:out+'/'+mode+'/'+tier+'.png'});
  }
  const metrics=await page.evaluate(async()=>{
   const g=window.__fincan,w=g.world,s=g.scene3d,T=await import('/node_modules/three/build/three.module.js');
   const summary=values=>{values.sort((a,b)=>a-b);return {medianMs:values[Math.floor(values.length*.5)],p90Ms:values[Math.floor(values.length*.9)],meanMs:values.reduce((a,b)=>a+b,0)/values.length};};
   g.setQualityTier('high');s.snapTo(-3,-6);g.player.stack.clear();
   const stack=g.player.stack,sequence=Array.from({length:21},(_,i)=>['cay','latte','tost'][i%3]);
   stack.setPresentationStage(8);
   for(let i=0;i<40;i++)stack.setSlots(sequence.slice(0,i%22));
   let bounds=0;const oldBounds=T.Box3.prototype.setFromObject;
   T.Box3.prototype.setFromObject=function(...args){bounds++;return oldBounds.apply(this,args);};
   const layout=[];
   try{for(let i=0;i<440;i++){const at=performance.now();stack.setSlots(sequence.slice(0,i%22));layout.push(performance.now()-at);}}
   finally{T.Box3.prototype.setFromObject=oldBounds;}
   stack.clear();
   const player=g.player.char,oldUpdate=player.update.bind(player),samples=[];
   // Representative clip history before measuring; no skipped animation frames.
   for(const state of ['idle','work','walk','cheer','angry','idle']){player.setState(state);for(let n=0;n<60;n++)oldUpdate(1/60,state==='walk'?1.5:0);}
   for(let block=0;block<100;block++){const at=performance.now();for(let n=0;n<120;n++)oldUpdate(1/60,0);samples.push((performance.now()-at)/120);}
   const move=g.input.move;g.input.update=()=>move;const tick=[];
   for(let i=0;i<900;i++){Object.assign(move,{x:Math.sin(i/45)>0?.8:-.8,y:0,mag:.8,active:true});const at=performance.now();g.tick(1/30);if(i>=120)tick.push(performance.now()-at);}
   const gl=s.renderer.getContext(),gpuExt=gl.getExtension('WEBGL_debug_renderer_info');
   const timer=gl.getExtension('EXT_disjoint_timer_query_webgl2'),gpuSamples=[];
   if(timer){
    const pending=[];s.snapTo(-3,-6);
    const poll=()=>{
     const invalid=gl.getParameter(timer.GPU_DISJOINT_EXT);
     for(let i=pending.length-1;i>=0;i--){const query=pending[i];
      if(invalid||gl.getQueryParameter(query,gl.QUERY_RESULT_AVAILABLE)){
       if(!invalid)gpuSamples.push(gl.getQueryParameter(query,gl.QUERY_RESULT)/1e6);
       gl.deleteQuery(query);pending.splice(i,1);
      }
     }
    };
    try{
     for(let i=0;i<96;i++){
      await new Promise(requestAnimationFrame);poll();s.haveCacheView=false;
      const query=pending.length<8?gl.createQuery():null;
      if(query)gl.beginQuery(timer.TIME_ELAPSED_EXT,query);
      try{s.render();}finally{if(query){gl.endQuery(timer.TIME_ELAPSED_EXT);pending.push(query);}}
     }
     for(let i=0;i<8&&pending.length;i++){await new Promise(requestAnimationFrame);poll();}
    }finally{for(const query of pending)gl.deleteQuery(query);}
   }
   return {layout:summary(layout),boundsCalls:bounds,animation:summary(samples),activeActions:player.mixer.stats.actions.inUse,
    gpuTime:gpuSamples.length?{samples:gpuSamples.length,...summary(gpuSamples)}:null,
    tick:summary(tick),pixels:gl.drawingBufferWidth*gl.drawingBufferHeight,memory:{...s.renderer.info.memory},
    layoutErrors:w.validateLayout(),glError:gl.getError(),gpu:gpuExt?gl.getParameter(gpuExt.UNMASKED_RENDERER_WEBGL):null};
  });
  reports.push({mode,prep,frames,metrics,errors});console.log(JSON.stringify({mode,metrics,errors}));
 }
 const pairedGpu=[];
 for(let round=0;round<4;round++)for(const index of round%2?[1,0]:[0,1]){
  const sample=await pages[index].evaluate(async()=>{
   const g=window.__fincan,s=g.scene3d,gl=s.renderer.getContext();
   const timer=gl.getExtension('EXT_disjoint_timer_query_webgl2');
   if(!timer)return null;
   const pending=[],samples=[];s.snapTo(-3,-6);
   const poll=()=>{const invalid=gl.getParameter(timer.GPU_DISJOINT_EXT);
    for(let i=pending.length-1;i>=0;i--){const q=pending[i];
     if(invalid||gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE)){
      if(!invalid)samples.push(gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6);
      gl.deleteQuery(q);pending.splice(i,1);
     }
    }
   };
   try{
    for(let frame=0;frame<72;frame++){
     await new Promise(requestAnimationFrame);poll();s.haveCacheView=false;
     const q=frame>=12&&pending.length<8?gl.createQuery():null;
     if(q)gl.beginQuery(timer.TIME_ELAPSED_EXT,q);
     try{s.render();}finally{if(q){gl.endQuery(timer.TIME_ELAPSED_EXT);pending.push(q);}}
    }
    for(let n=0;n<8&&pending.length;n++){await new Promise(requestAnimationFrame);poll();}
   }finally{for(const q of pending)gl.deleteQuery(q);}
   samples.sort((a,b)=>a-b);
   return {medianMs:samples[Math.floor(samples.length*.5)],meanMs:samples.reduce((a,b)=>a+b,0)/samples.length,
    samples:samples.length,calls:s.renderer.info.render.calls,triangles:s.renderer.info.render.triangles,
    actors:g.world.customers.map(c=>({x:c.x,z:c.z,state:c.state})),player:{x:g.player.x,z:g.player.z}};
  });
  pairedGpu.push({round,mode:index?'optimized':'reference',...sample});
 }
 const pairs=[];
 assert.deepEqual(reports[1].prep,reports[0].prep,'Gameplay differs before visual fixture');
 for(const frame of reports[0].frames){
  const next=reports[1].frames.find(f=>f.name===frame.name);assert.ok(next);assert.equal(next.width,frame.width);assert.equal(next.height,frame.height);
  const a=gunzipSync(await readFile(out+'/reference/'+frame.name+'.rgba.gz')),b=gunzipSync(await readFile(out+'/optimized/'+frame.name+'.rgba.gz'));
  let max=0,changed=0,over4=0,sum=0;
  for(let i=0;i<a.length;i+=4){let d=0;for(let c=0;c<3;c++)d=Math.max(d,Math.abs(a[i+c]-b[i+c]));if(d)changed++;if(d>4)over4++;max=Math.max(max,d);sum+=d;}
  pairs.push({name:frame.name,max,changedPixels:changed,over4Fraction:over4/(a.length/4),meanMaxChannelDelta:sum/(a.length/4),beforeCalls:frame.calls,afterCalls:next.calls,beforeTriangles:frame.triangles,afterTriangles:next.triangles});
 }
 await writeFile(out+'/result.json',JSON.stringify({reports,pairs,pairedGpu},null,2));
 for(const report of reports){assert.deepEqual(report.errors,[]);assert.deepEqual(report.metrics.layoutErrors,[]);assert.equal(report.metrics.glError,0);}
 assert.ok(pairs.every(p=>p.over4Fraction<.0001),JSON.stringify(pairs.filter(p=>p.over4Fraction>=.0001)));
 console.log(JSON.stringify({pairs:pairs.length,worst:pairs.toSorted((a,b)=>b.over4Fraction-a.over4Fraction).slice(0,4)}));
 console.log(JSON.stringify({pairedGpu:pairedGpu.map(({actors,player,...m})=>m),sameActors:JSON.stringify(pairedGpu[0].actors)===JSON.stringify(pairedGpu[1].actors)}));
}finally{await browser.close();await server.close();}
