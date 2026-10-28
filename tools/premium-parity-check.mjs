import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const out='.devshots/reklam-game-parity';
const base=process.env.GAME_URL ?? 'http://127.0.0.1:5173/';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
// Explicit disposable storage: no persistent browser profile or player save is opened.
const context=await browser.newContext({viewport:{width:540,height:960},locale:'tr-TR',storageState:{cookies:[],origins:[]}});
const report={preparedPreview:true,errors:[],requests:[],views:[]};
try {
 const page=await context.newPage();
 await page.addInitScript(()=>{
   let instance;
   Object.defineProperty(window,'__fincan',{configurable:true,get:()=>instance,set:g=>{instance=g;g.persistDisabled=true;}});
 });
 page.on('pageerror',e=>report.errors.push(e.message));
 page.on('response',r=>{if(r.status()>=400)report.requests.push({url:r.url(),status:r.status()});});
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__fincan,null,{timeout:90000});
 await page.locator('#boot-screen').waitFor({state:'detached'});
 const baseline=await page.evaluate(()=>{
   const g=window.__fincan;g.stop();g.ui.closePanels();g.ui.setTutorial(null);g.state.tutorialStep=99;
   g.persistDisabled=true;
   return {money:g.state.money,capacity:g.state.upgrades.capacity};
 });
 report.presentation=await page.evaluate(async()=>{
   const g=window.__fincan,w=g.world;
   const check=(ok,message)=>{if(!ok)throw new Error(message);};
   for(const z of w.loc.zones)if(!w.zoneUnlocked(z.id))w.unlockZone(z.id);
   for(let n=0;n<150;n++){for(const v of w.stationVisuals.values())v.update(1/60);w.updateVisuals(1/60);}
   check(w.validateLayout().length===0,'all unlocked routes');
   const T=await import('/node_modules/three/build/three.module.js');
   const records=[];
   for(const st of w.pickups) {
     const v=w.pickupVisuals.get(st.id);check(!!v.root.getObjectByName('premiumDisplay'),'shared display missing');
     for(const count of [0,1,6,8]) {
       v.setContents(Array(count).fill(st.def.item),8);v.setLocked(false);v.update(1);
       const meshes=[];v.root.traverse(o=>{if(o.isInstancedMesh&&o.count)meshes.push(o);});
       check(meshes.every(o=>Number.isFinite(o.count)),'invalid stock instances');
       if(count>0) {
         v.root.updateMatrixWorld(true);
         const bounds=new T.Box3().setFromObject(v.root.getObjectByName('displayProducts'));
         check(bounds.max.y-v.root.position.y<1.6175,'stock protrudes through the display canopy: '+st.id);
       }
       records.push({station:st.id,count,visible:v.root.visible});
     }
     v.setLocked(true);check(!v.root.visible,'locked display leaked');
     v.setLocked(false);check(v.root.visible,'display failed to reopen');
     while(st.output<st.outputCap)st.accept(st.def.item);
   }
   for(const st of w.machines)if(st.def.kind==='machine') {
     st.output=st.outputCap;
     const v=w.stationVisuals.get(st.id);check(!!v.root.getObjectByName('premiumMachine'),'film machine missing');
     v.setOutput(0,st.outputCap,st.def.item);
     check(!v.root.getObjectByName('premiumMachineOutput').visible,'empty machine shows output');
     v.setOutput(3,st.outputCap,st.def.item);
     check(v.root.getObjectByName('premiumMachineOutput').visible,'produced output is missing');
   }
   const table=w.stationVisuals.get('k_masa_1').root.getObjectByName('tableFurniture');
   const map=table.material.map, coins=g.state.money,owned=JSON.stringify([...g.state.cosmeticsOwned]);
   g.previewCosmetic('table','ceviz');check(table.material.map!==map,'table finish preview');
   g.cancelCosmeticPreview();check(table.material.map===map,'table finish cancellation');
   check(g.state.money===coins&&JSON.stringify([...g.state.cosmeticsOwned])===owned,'preview changed purchases');
   check(!!w.env.root.getObjectByName('premiumBackbar'),'shared architecture missing');
   check(g.scene3d.renderer.toneMappingExposure===1.04,'film exposure missing');
   check(g.scene3d.hemi.intensity===.98,'film fill light missing');
   const {Customer}=await import('/src/entities/Customer.ts');
   const {Order}=await import('/src/sim/Orders.ts');
   const {CUSTOMER_ARCHETYPES}=await import('/src/data/customers.ts');
   Object.assign(g.state.staffCount,{waiter:2,barista:2,cashier:2});w.syncStaff();
   let seq=0;
   for(const t of w.tables)for(let n=0;n<Math.min(t.seats,3);n++) {
     if(t.seatTaken[n])continue;
     const item=['cay','latte','tost','waffle','frappe'][seq%5];
     const c=new Customer(CUSTOMER_ARCHETYPES[seq%CUSTOMER_ARCHETYPES.length],'premium-preview-'+seq++);
     c.dineIn=true;c.table=t;c.counter=w.counters[0];c.order=new Order([{item,qty:1,served:0}]);c.patience=c.maxPatience=60;
     t.takeSeat(n);c.seatIndex=n;t.seatedGuests.push(c);w.customers.push(c);w.root.add(c.char.root);
     const p={x:0,y:0,z:0};w.seatPoint(t,n,p);c.setPosition(p.x,p.z);c.floorY=p.y-.6;w.sitOnChair(c,t);
     c.state='seated';w.quoteOrder(c);c.receiveItem(item);w.startEating(c);
     for(let i=0;i<45;i++)c.step(1/60,w.nav);
   }
   g.player.setPosition(-3.1,3.3);g.player.give('cay');g.player.give('latte');
   g.player.setCapacity(g.state.playerCapacity);g.ui.endCelebrate();
   for(let i=0;i<150;i++){
     g.player.update(1/60,{x:0,y:0,mag:0,active:false},w.nav,w.loc.bounds);
     w.update(1/60,g.player,{spawnMult:0,valueMult:1,patienceMult:1,tipMult:1});
     g.stepVisual(1/60);w.updateVisuals(1/60);w.env.update(1/60);
   }
   g.updateUiFrame(1);
   document.querySelectorAll('.toast').forEach(n=>n.style.display='none');
   return {records,tableCosmetics:true,layout:w.validateLayout(),cast:g.player.char.root.userData.characterPack,customers:w.customers.length,staff:w.staff.length,tables:w.tables.length};
 });
 // Same scene, using both the normal phone controls and film-style inspection framing.
 for(const view of [
   {name:'phone-service',w:390,h:844,x:-3,z:-1.3,normal:true},
   {name:'phone-tables',w:390,h:844,x:-3.1,z:3.3,normal:true},
   {name:'phone-lounge',w:390,h:844,x:13.2,z:13.6,normal:true},
   {name:'premium-detail',w:1080,h:1920,x:0,z:1.8,d:18},
   {name:'premium-overview',w:1080,h:1920,x:0,z:0,d:39},
   {name:'desktop',w:1440,h:900,x:0,z:1.8,normal:true},
 ]) {
   await page.setViewportSize({width:view.w,height:view.h});
   const result=await page.evaluate(async view=>{
     const g=window.__fincan,w=g.world,s=g.scene3d,c=s.camera;
     const {floorLiftAt}=await import('/src/data/layouts.ts');
     g.player.setPosition(view.x,view.z);g.player.floorY=floorLiftAt(w.loc,view.x,view.z);g.player.char.root.position.y=g.player.floorY;
     s.setOpeningFrame(false);s.resize();s.snapTo(view.x,view.z);
     document.getElementById('ui-root').style.visibility=view.normal?'visible':'hidden';
     for(let i=0;i<90;i++)g.stepVisual(1/60);
     if(!view.normal){s.renderer.setPixelRatio(1);s.renderer.setSize(view.w,view.h,false);c.clearViewOffset();c.aspect=view.w/view.h;c.fov=38;c.updateProjectionMatrix();c.position.set(view.x,view.d,view.z+view.d*.85);c.lookAt(view.x,.7,view.z);c.updateMatrixWorld();}
     w.setViewFromCamera(c);w.setCameraQuat(c.quaternion);w.updateVisuals(1/60);s.invalidateStatic();s.invalidateShadows();s.render();
     return {name:view.name,render:{...s.renderer.info.render},layout:w.validateLayout()};
   },view);
   assert.deepEqual(result.layout,[]);report.views.push(result);
   await page.screenshot({path:out+'/'+view.name+'.png'});
 }
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__fincan,null,{timeout:90000});
 report.restored=await page.evaluate(()=>{const g=window.__fincan;g.stop();return {money:g.state.money,capacity:g.state.upgrades.capacity,unlocked:g.state.unlockedZones.size,layout:g.world.validateLayout()};});
 assert.equal(report.restored.money,baseline.money);assert.equal(report.restored.capacity,baseline.capacity);assert.deepEqual(report.restored.layout,[]);
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.requests,[]);
 await writeFile(out+'/presentation.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify({passed:true,views:report.views.length,restored:report.restored,errors:report.errors}));
} finally {await context.close();await browser.close();}
