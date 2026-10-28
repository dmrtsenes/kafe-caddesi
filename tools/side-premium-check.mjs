import {chromium} from 'playwright';
import {mkdir, writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='.devshots/side-premium-2026-09-08/after'; await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:390,height:844},locale:'tr-TR'});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
await page.goto('http://127.0.0.1:5173/');await page.waitForFunction(()=>!!window.__fincan,undefined,{timeout:90000});
await page.locator('#boot-screen').waitFor({state:'detached',timeout:90000});
await page.evaluate(()=>{const g=window.__fincan;g.stop();g.persistDisabled=true;g.state.tutorialStep=99;g.ui.setTutorial(null);g.ui.closePanels();for(const zone of g.world.loc.zones)if(!g.world.zoneUnlocked(zone.id))g.world.unlockZone(zone.id);g.world.sideActivities.depositPurchase('garden',800,g.world.menuItems());g.world.sideActivities.depositPurchase('courtyard',2200,g.world.menuItems());g.world.syncSideArchitecture();g.world.rebuildNav();g.world.customers.length=0;g.player.dropAll();});
const walk=await page.evaluate(()=>{const g=window.__fincan,w=g.world,p=g.player;const results=[];
for(const id of ['garden','courtyard']){
const sign=id==='garden'?-1:1;const points=[{x:sign*7.9,z:-7},{x:sign*11.4,z:-8.6},...(id==='garden'?[-13,-4.1,4.7].flatMap(z=>[-10,-12].map(x=>({x,z}))):[-13,-4.1,4.7].flatMap(z=>[10,14.5].map(x=>({x,z})))),{x:sign*11.4,z:-8.6},{x:sign*7.9,z:-7}];p.setPosition(points[0].x,points[0].z);
for(const goal of points.slice(1)){const path=[];if(!w.nav.findPath(p.x,p.z,goal.x,goal.z,path))throw new Error('No path '+id+JSON.stringify(goal));let index=0,t=0;const start={x:p.x,z:p.z};
for(;t<45;t+=1/30){while(index<path.length&&Math.hypot(path[index]-p.x,path[index+1]-p.z)<.12)index+=2;const tx=index<path.length?path[index]:goal.x,tz=index<path.length?path[index+1]:goal.z;const dx=tx-p.x,dz=tz-p.z,d=Math.hypot(dx,dz);if(Math.hypot(goal.x-p.x,goal.z-p.z)<.12)break;p.update(1/30,{x:dx/Math.max(.001,d),y:-dz/Math.max(.001,d),mag:Math.min(1,d/.5),active:true},w.nav,w.loc.bounds);if(w.nav.solidBlocked(p.x,p.z,.315))throw new Error('Player entered geometry '+id);}
const gap=Math.hypot(goal.x-p.x,goal.z-p.z);if(gap>=.12)throw new Error('Walk stalled '+JSON.stringify({id,start,goal,gap,p:{x:p.x,z:p.z},path}));results.push({id,goal,seconds:+t.toFixed(2),gap:+gap.toFixed(3)});
}}
return {results,layout:w.validateLayout()};});
const report={walk,views:[],errors};
for(const size of [{width:390,height:844},{width:320,height:740}]){await page.setViewportSize(size);
for(const [name,x,z] of [['garden-work',-11.4,-8.6],['courtyard-work',11.4,-8.6],['garden-north',-12,-13],['courtyard-north',14.5,-13]]){
const view=await page.evaluate(async({x,z,name,width,height})=>{const THREE=await import('/node_modules/three/build/three.module.js');const g=window.__fincan;g.player.setPosition(x,z);g.scene3d.setOpeningFrame(false);g.scene3d.resize();g.scene3d.snapTo(x,z);for(let i=0;i<60;i++){g.stepVisual(1/60);g.world.updateSideActivities(1/60,g.player);}g.scene3d.invalidateStatic();g.scene3d.invalidateShadows();g.scene3d.render();const root=g.world.sideWorkViews.get(name.startsWith('garden')?'garden':'courtyard').root;const board=root.getObjectByName('sideActivityBoard');const camera=g.scene3d.camera;const points=[[-1.3,-.65],[1.3,-.65],[-1.3,.65],[1.3,.65]].map(([x,y])=>{const v=new THREE.Vector3(x,y,0).applyMatrix4(board.matrixWorld).project(camera);return{x:(v.x+1)*width/2,y:(1-v.y)*height/2};});const bounds={x0:Math.min(...points.map(p=>p.x)),x1:Math.max(...points.map(p=>p.x)),y0:Math.min(...points.map(p=>p.y)),y1:Math.max(...points.map(p=>p.y))};const head=new THREE.Vector3(x,1.6,z).project(camera);return {name,width,cast:g.player.char.root.userData.characterPack,draw:{...g.scene3d.renderer.info.render},board:bounds,head:{x:(head.x+1)*width/2,y:(1-head.y)*height/2},scale:board.scale.toArray(),texture:board.material.map.repeat.toArray()};},{x,z,name,...size});
assert.equal(view.cast,'cleanit-apk-local-test');if(name.endsWith('work'))assert.ok(view.board.y1<view.head.y-5,`${name} ${size.width} board covers player head: `+JSON.stringify(view));if(name.endsWith('work'))assert.ok(view.board.x0>=8 && view.board.x1<=size.width-8, name+' card must stay within phone edges');report.views.push(view);await page.screenshot({path:`${out}/${name}-${size.width}.png`});}}
assert.deepEqual(walk.layout,[]);assert.deepEqual(errors,[]);await writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
