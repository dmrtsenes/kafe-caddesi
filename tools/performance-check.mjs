import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const args=Object.fromEntries(process.argv.slice(2).map(s=>s.replace(/^--/,'').split('=')));
const phase=args.phase??'check',out=`.devshots/premium-performance/${phase}`;
await mkdir(out,{recursive:true});
const server=args.url?null:await createServer({configFile:false,root:process.cwd(),optimizeDeps:{noDiscovery:true},server:{host:'127.0.0.1',port:0,open:false,hmr:false,watch:null}});if(server)await server.listen();
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
const reports=[];
try {
 for(const tier of (args.tiers??'low,medium,high').split(',')) {
  const mobile=tier!=='high';
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:mobile,hasTouch:mobile,storageState:{cookies:[],origins:[]},...(mobile?{userAgent:'Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'}:{})});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.addInitScript(tier=>{
   localStorage.setItem('fincan-sokagi:settings:v2',JSON.stringify({quality:tier,qualityAuto:false,muted:true,music:false,fps:30}));
   let seed=417;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
   let game;Object.defineProperty(window,'__fincan',{configurable:true,get:()=>game,set:g=>{game=g;g.persistDisabled=true;}});
  },tier);
  await page.goto((args.url??server.resolvedUrls.local[0])+'?characters=quaternius',{waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForFunction(()=>window.__fincan,null,{timeout:120000});
  await page.locator('#boot-screen').waitFor({state:'detached',timeout:90000});
  await page.evaluate(()=>{const g=window.__fincan;g.stop();g.persistDisabled=true;g.ui.setTutorial(null);g.state.tutorialStep=99;g.ui.closePanels();});
  for(const stage of ['first','full']) {
   await page.evaluate(async stage=>{
    const g=window.__fincan,w=g.world;
    if(stage==='full') {
     for(const z of w.loc.zones)if(!w.zoneUnlocked(z.id))w.unlockZone(z.id);
     Object.assign(g.state.staffCount,{waiter:2,barista:2,cashier:2,busser:2});w.syncStaff();
     const {Customer}=await import('/src/entities/Customer.ts'),{Order}=await import('/src/sim/Orders.ts'),{CUSTOMER_ARCHETYPES}=await import('/src/data/customers.ts');
     const {markDynamic}=await import('/src/world/layers.ts');
     let sequence=0;
     for(const table of w.tables)for(let seat=0;seat<Math.min(table.seats,2);seat++){
      if(table.seatTaken[seat])continue;
      const c=new Customer(CUSTOMER_ARCHETYPES[sequence++%CUSTOMER_ARCHETYPES.length],'perf-'+sequence),item='cay';
      c.dineIn=true;c.table=table;c.counter=w.counters[0];c.order=new Order([{item,qty:1,served:0}]);c.patience=c.maxPatience=10000;
      table.takeSeat(seat);c.seatIndex=seat;table.seatedGuests.push(c);w.customers.push(c);markDynamic(c.char.root);w.root.add(c.char.root);
      const p={x:0,y:0,z:0};w.seatPoint(table,seat,p);c.setPosition(p.x,p.z);c.floorY=p.y-.6;w.sitOnChair(c,table);c.state='seated';w.quoteOrder(c);c.receiveItem(item);w.startEating(c);
      for(let n=0;n<45;n++)c.step(1/60,w.nav);
     }
    }
    for(const m of w.machines)if(!m.locked)m.output=m.outputCap;
    for(const p of w.pickups)if(!p.locked)while(p.output<p.outputCap)p.accept(p.def.item);
    g.ui.endCelebrate();
    for(let i=0;i<180;i++){g.stepVisual(1/60);w.updateVisuals(1/60);w.env.update(1/60);for(const s of w.staff)s.char.update(1/60,0,0);}
   },stage);
   for(const [name,x,z] of stage==='first'?[['counter',3,-6.2]]:[['production',-3.4,-8.7],['tables',0,4.1],['lounge',13.1,13.5]]) {
    const result=await page.evaluate(async({name,x,z})=>{
     const g=window.__fincan,w=g.world,s=g.scene3d,r=s.renderer;
     const {floorLiftAt}=await import('/src/data/layouts.ts');
     g.player.setPosition(x,z);g.player.floorY=floorLiftAt(w.loc,x,z);g.player.char.root.position.y=g.player.floorY;
     s.setOpeningFrame(false);s.resize();s.snapTo(x,z);w.focusX=x;w.focusZ=z;
     for(let n=0;n<90;n++){g.stepVisual(1/60);w.updateVisuals(1/60);}
     // The prepared scene does not advance orders during a render sample. Apply
     // the same visibility predicate that live customer/staff updates use.
     for(const actor of [...w.staff,...w.customers]){
       const visible=w.isNearCamera(actor.x,actor.z);actor.char.root.visible=visible;
       w.syncActorRender?.(actor.char.root,visible);
     }
     s.invalidateStatic();s.invalidateShadows();s.render();
     const summarize=()=>({...r.info.render,path:s.renderPath});
     const first=summarize(), histogram={},restore=[];
     w.env.root.userData.profile='environment';
     for(const [id,v]of w.stationVisuals)v.root.userData.profile=id;
     for(const [id,v]of w.pickupVisuals)v.root.userData.profile=id;
     for(const a of [...w.staff,...w.customers,g.player])a.char.root.userData.profile=a===g.player?'player':w.staff.includes(a)?'staff':'customer';
     s.scene.traverse(o=>{if(!o.isMesh&&!o.isSprite)return;const old=o.onBeforeRender;restore.push(()=>o.onBeforeRender=old);o.onBeforeRender=function(...a){old?.apply(this,a);let p=o,key='effects';while(p){if(p.userData.profile){key=p.userData.profile;break;}p=p.parent;}const entry=histogram[key]??={calls:0,triangles:0};entry.calls++;entry.triangles+=o.geometry?((o.geometry.index?.count??o.geometry.attributes.position?.count??0)/3)*(o.isInstancedMesh?o.count:1):2;};});
     s.camera.position.x+=.01;s.render();const direct=summarize();restore.forEach(fn=>fn());
     s.render();s.render();const stationary=summarize();
     const samples=[];
     for(let i=0;i<30;i++){s.camera.position.x+=.001;const start=performance.now();s.render();samples.push(performance.now()-start);}
     samples.sort((a,b)=>a-b);
     let nodes=0,visible=0;s.scene.traverse(()=>nodes++);s.scene.traverseVisible(()=>visible++);
     const gl=r.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');
     return {name,first,direct,stationary,nodes,visible,histogram:Object.entries(histogram).sort((a,b)=>b[1].calls-a[1].calls),renderSubmitMedian:samples[15],renderSubmitP90:samples[27],pixels:r.domElement.width*r.domElement.height,dpr:r.getPixelRatio(),gpu:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):null,memory:{...r.info.memory},actors:1+w.staff.length+w.customers.length,layout:w.validateLayout()};
    },{name,x,z});
    assert.deepEqual(result.layout,[]);reports.push({tier,stage,...result});
    await page.screenshot({path:`${out}/${tier}-${stage}-${name}.png`});
    console.log(JSON.stringify({tier,stage,name,calls:result.direct.calls,triangles:result.direct.triangles,cachedCalls:result.stationary.calls,nodes:result.nodes,submit:result.renderSubmitMedian}));
   }
  }
  assert.deepEqual(errors,[]);await context.close();
 }
 await writeFile(out+'/profile.json',JSON.stringify({reports},null,2));
} finally {await browser.close();await server?.close();}
