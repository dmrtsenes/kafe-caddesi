import { chromium } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.env.GAME_URL??'http://127.0.0.1:5288/';
const out='.devshots/hybrid-cafe';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1080,height:1920},locale:'tr-TR'});
 await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__fincan,null,{timeout:180000});
 const result=await page.evaluate(async()=>{
  const g=window.__fincan,w=g.world;g.stop();g.persistDisabled=true;g.ui.closePanels();g.ui.setTutorial(null);g.state.tutorialStep=99;
  for(const z of w.loc.zones)if(!w.zoneUnlocked(z.id))w.unlockZone(z.id);
  const [{THREE:T},{Customer},{Order},{CUSTOMER_ARCHETYPES}]=await Promise.all([import('/tools/browser-render.ts'),import('/src/entities/Customer.ts'),import('/src/sim/Orders.ts'),import('/src/data/customers.ts')]);
  Object.assign(g.state.staffCount,{waiter:2,barista:2,cashier:2});w.syncStaff();
  for(const m of w.machines)m.output=m.outputCap;
  for(const s of w.pickups)while(s.output<s.outputCap)s.accept(s.def.item);
  let seq=0;
  for(const t of w.tables)for(let n=0;n<Math.min(t.seats,3);n++){
   if(t.seatTaken[n])continue;
   const item=['cay','latte','tost','waffle','frappe'][seq%5];
   const c=new Customer(CUSTOMER_ARCHETYPES[seq%CUSTOMER_ARCHETYPES.length],'hybrid-shot-'+seq++);
   c.dineIn=true;c.table=t;c.counter=w.counters[0];c.order=new Order([{item,qty:1,served:0}]);c.patience=c.maxPatience=60;
   t.takeSeat(n);c.seatIndex=n;t.seatedGuests.push(c);w.customers.push(c);w.root.add(c.char.root);
   const p={x:0,y:0,z:0};w.seatPoint(t,n,p);c.setPosition(p.x,p.z);c.floorY=p.y-.6;w.sitOnChair(c,t);c.state='seated';w.quoteOrder(c);c.receiveItem(item);w.startEating(c);
   for(let i=0;i<45;i++)c.step(1/60,w.nav);
  }
  g.player.setPosition(0,4.15);g.player.give('cay');g.player.give('latte');
  for(let i=0;i<150;i++){g.player.update(1/60,{x:0,y:0,mag:0,active:false},w.nav,w.loc.bounds);w.update(1/60,g.player,{spawnMult:0,valueMult:1,patienceMult:1,tipMult:1});g.stepVisual(1/60);for(const v of w.stationVisuals.values())v.update(1/60);w.updateVisuals(1/60);w.env.update(1/60);}
  const normalMap=w.stationVisuals.get('k_masa_1').root.getObjectByName('tableFurniture').material[1].map;
  const own=JSON.stringify([...g.state.cosmeticsOwned]);const coins=g.state.money;
  g.previewCosmetic('table','ceviz');
  const changed=w.stationVisuals.get('k_masa_1').root.getObjectByName('tableFurniture').material[1].map!==normalMap;
  g.cancelCosmeticPreview();
  const restored=w.stationVisuals.get('k_masa_1').root.getObjectByName('tableFurniture').material[1].map===normalMap;
  const retained=own===JSON.stringify([...g.state.cosmeticsOwned])&&g.state.money===coins;
  document.getElementById('ui-root').style.visibility='hidden';
  g.scene3d.renderer.setPixelRatio(1);g.scene3d.renderer.setSize(1080,1920,false);
  const camera=g.scene3d.camera;camera.clearViewOffset();camera.aspect=1080/1920;camera.fov=38;camera.updateProjectionMatrix();
  camera.position.set(0,38,37);camera.lookAt(0,.7,-.5);camera.updateMatrixWorld();w.setViewFromCamera(camera);w.setCameraQuat(camera.quaternion);w.focusX=0;w.focusZ=0;
  g.scene3d.setFocus(0,0,0,0,4.15);g.scene3d.invalidateStatic();g.scene3d.invalidateShadows();g.scene3d.render();
  window.__hybridShot={g,w,camera};
  return {customers:w.customers.length,tables:w.tables.length,staff:w.staff.length,layout:w.validateLayout(),changed,restored,retained};
 });
 assert.ok(result.changed&&result.restored&&result.retained);assert.deepEqual(result.layout,[]);
 await page.screenshot({path:out+'/hybrid-overview.png'});
 await page.evaluate(()=>{const {g,w,camera}=window.__hybridShot;camera.position.set(-.6,14.8,16.0);camera.lookAt(0,.7,3.2);camera.updateMatrixWorld();w.setViewFromCamera(camera);w.setCameraQuat(camera.quaternion);g.scene3d.setFocus(0,3.2,0,0,4.15);g.scene3d.invalidateStatic();g.scene3d.invalidateShadows();g.scene3d.render();});
 await page.screenshot({path:out+'/hybrid-detail.png'});
 await writeFile(out+'/showcase.json',JSON.stringify({passed:true,preparedPreview:true,...result},null,2));console.log(JSON.stringify(result));
}finally{await browser.close();}
