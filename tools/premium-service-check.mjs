import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const tag = process.argv[2] || 'before';
const output = `.devshots/premium-service-${tag}`;
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
const report={errors:[],views:[]};
try{
 const page=await browser.newPage({viewport:{width:900,height:1100},locale:'tr-TR'});
 page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto('http://127.0.0.1:5173/',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!!window.__fincan,undefined,{timeout:90000});
 await page.locator('#boot-screen').waitFor({state:'detached',timeout:90000});
 await page.evaluate(()=>{const g=window.__fincan;g.stop();g.ui.setTutorial(null);g.ui.closePanels();g.state.tutorialStep=99;document.getElementById('ui-root').style.display='none';g.scene3d.setOpeningFrame(false);});
 for(const pos of [{name:'west',x:-7.4,z:-1},{name:'east',x:7.4,z:-1},{name:'north',x:0,z:-13},{name:'west-room',x:-7.4,z:13.7},{name:'east-room',x:7.4,z:13.7}]){
  const result=await page.evaluate(({x,z,name})=>{
   const g=window.__fincan;g.player.setPosition(x,z);g.scene3d.snapTo(x,z);
   for(let i=0;i<75;i++){g.stepVisual(1/60);g.world.updateVisuals(1/60);}
   g.scene3d.invalidateStatic();g.scene3d.invalidateShadows();g.scene3d.render();
   return {name,layout:g.world.validateLayout(),render:{...g.scene3d.renderer.info.render},memory:{...g.scene3d.renderer.info.memory},cast:g.player.char.root.userData.characterPack};
  },pos);
  assert.deepEqual(result.layout,[],pos.name+' navigation');
  assert.equal(result.cast,'cleanit-apk-local-test','existing preview cast stays selected');
  report.views.push(result);await page.screenshot({path:`${output}/${pos.name}.png`});
 }
 if(tag!=='before'){
  const rooms=await page.evaluate(()=>{const g=window.__fincan;for(const z of g.world.loc.zones)if(!g.world.zoneUnlocked(z.id))g.world.unlockZone(z.id);return {layout:g.world.validateLayout(),r1:g.world.zoneUnlocked('r1'),r2:g.world.zoneUnlocked('r2')};});
  report.openRooms=rooms;assert.deepEqual(rooms.layout,[],'all unlocked navigation');
  assert.ok(rooms.r1&&rooms.r2,'both rooms open');
  await page.setViewportSize({width:390,height:844});
  for(const [name,x,z] of [['mobile-west',-7.4,-1],['mobile-east',7.4,-1],['mobile-open-west',-7.4,13.7],['mobile-open-east',7.4,13.7]]){
   await page.evaluate(({x,z})=>{const g=window.__fincan;g.player.setPosition(x,z);g.scene3d.resize();g.scene3d.snapTo(x,z);for(let i=0;i<60;i++)g.stepVisual(1/60);g.scene3d.invalidateStatic();g.scene3d.invalidateShadows();g.scene3d.render();},{x,z});
   await page.screenshot({path:`${output}/${name}.png`});
  }
 }
 assert.deepEqual(report.errors,[],'browser errors');
 await writeFile(output+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
