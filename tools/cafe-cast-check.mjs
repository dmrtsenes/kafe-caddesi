
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const output = '.devshots/cafe-cast-2026-09-06';
await mkdir(output, {recursive:true});
const server = await createServer({server:{host:'127.0.0.1',port:5240,strictPort:true,open:false,hmr:false}});
let browser;
const report = {characters:[], rooms:[]};
try {
 await server.listen();
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
 for(const mode of ['release']) {
  const context=await browser.newContext({viewport:{width:540,height:540},locale:'tr-TR'});
  const page=await context.newPage(); const errors=[]; console.log('Starting '+mode); page.on('console',m=>{if(m.type()==='error')console.log(m.text().slice(0,300));}); page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>localStorage.setItem('fincan-sokagi:settings:v2',JSON.stringify({quality:'medium',qualityAuto:false,muted:true,music:false})));
  await page.goto('http://127.0.0.1:5240/'+(mode==='procedural'?'?characters=procedural':'?characters=quaternius'),{waitUntil:'domcontentloaded',timeout:90000});
  await page.waitForFunction(()=>!!window.__fincan,undefined,{timeout:90000});
  await page.locator('#boot-screen').waitFor({state:'detached'});
  await page.evaluate(async()=>{
   const game=window.__fincan;game.stop();document.getElementById('ui-root').style.display='none';
   const [{THREE:T},{Player},{NavGrid}]=await Promise.all([import('/tools/browser-render.ts'),import('/src/entities/Player.ts'),import('/src/sim/Navigation.ts')]);
   const scene=new T.Scene();scene.background=new T.Color(0xeee4d3);
   scene.add(new T.HemisphereLight(0xffffff,0x978979,2.5));
   const sun=new T.DirectionalLight(0xfff3df,3);sun.position.set(-3,6,4);scene.add(sun);
   const floor=new T.Mesh(new T.PlaneGeometry(12,12),new T.MeshStandardMaterial({color:0xd2bc96}));floor.rotation.x=-Math.PI/2;floor.position.y=-.01;scene.add(floor);
   const p=new Player();p.setCapacity(15);scene.add(p.char.root);
   const bounds={x0:-20,z0:-20,x1:20,z1:20};const nav=new NavGrid(bounds);
   const camera=new T.PerspectiveCamera(35,1,.1,50);camera.layers.enableAll();
   const renderer=game.scene3d.renderer;renderer.setPixelRatio(1);renderer.setSize(540,540,false);
   const idle={x:0,y:0,mag:0,active:false};
   function step(moving=false,mop=false){
    p.interacting=mop;p.interactionKind=mop?'mop':'generic';
    p.update(1/60,moving?{x:0,y:-1,mag:.7,active:true}:idle,nav,bounds);
    p.setPosition(0,0);p.angle=0;p.char.root.rotation.y=0;p.char.root.updateMatrixWorld(true);
   }
   function render(view='side'){
    camera.position.set(view==='front'?0:4.3,2.6,view==='front'?5.2:2.4);camera.lookAt(0,.85,.3);renderer.render(scene,camera);
   }
   function metrics(){
    const inverse=new T.Matrix4().copy(p.char.root.matrixWorld).invert();
    const bounds=new T.Box3().makeEmpty(), productBounds=[];
    p.stack.root.traverseVisible(o=>{
      if(!o.isMesh)return;
      o.geometry.computeBoundingBox();
      const b=o.geometry.boundingBox.clone().applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,o.matrixWorld));
      bounds.union(b);
    });
    for(const m of p.stack.root.children.filter(o=>o.name==='carriedProduct')){
     const b=new T.Box3().makeEmpty();
     m.traverseVisible(o=>{if(o.isMesh){o.geometry.computeBoundingBox();b.union(o.geometry.boundingBox.clone().applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,o.matrixWorld)));}});
     productBounds.push({min:b.min.toArray(),max:b.max.toArray()});
    }
    const h=p.char.handMidLocal(new T.Vector3()),a=p.stack.root.getWorldPosition(new T.Vector3()).applyMatrix4(inverse);
    const grip=p.floorMop.grip.getWorldPosition(new T.Vector3()).applyMatrix4(inverse);
    const brush=game.world.brushPoint(p,false), head=p.floorMop.root.getObjectByName('mopHead').getWorldPosition(new T.Vector3());
    return {hand:h.toArray(),tray:a.toArray(),min:bounds.min.toArray(),max:bounds.max.toArray(),productBounds,
      mopVisible:p.floorMop.root.visible,clothVisible:p.cleaningCloth.visible,
      mopGripError:h.distanceTo(grip),mopBrushError:Math.hypot(brush.x-head.x,brush.z-head.z),mopHeadY:head.y,cartGripError:p.stack.cartGrip.getWorldPosition(new T.Vector3()).applyMatrix4(inverse).distanceTo(h)};
   }
   window.__presentation={game,T,p,step,render,metrics};
  });
  await page.evaluate(()=>{const c=window.__presentation;for(let i=0;i<90;i++)c.step();c.render('front');});
  await page.screenshot({path:output+'/cast-front.png'});
  console.log(JSON.stringify(await page.evaluate(()=>({preparation:window.__fincan.scene3d.preparation,boot:performance.getEntriesByType('measure').map(e=>({name:e.name,duration:e.duration}))}))));
  const animationMatrix=await page.evaluate(async()=>{
   const c=window.__presentation,T=c.T,{createPackCharacter}=await import('/src/chars/PackCharacters.ts');
   const rows=[];
   for(const role of ['player','waiter','cashier','barista','busser','customer']) {
    const actor=createPackCharacter(role,{seed:417,level:10});let meshes=0;actor.root.traverse(o=>{if(o.isSkinnedMesh)meshes++;});
    for(const fps of [30,60])for(const level of [0,5,10])for(const state of ['idle','walk','work','sit','angry','cheer','panic']) {
     actor.setLocomotionLevel(level);actor.setState(state);actor.setCarryCount(0);actor.setPush(false);actor.setWorkKind('reach');
     for(let frame=0;frame<fps;frame++){actor.setWorkPhase(state==='work'?(frame%12)/12:-1);actor.update(1/fps,state==='walk'||state==='panic'?3.8+level*.47:0,Math.sin(frame)*3);}
     actor.root.updateMatrixWorld(true);let finite=true;actor.root.traverse(o=>{if(o.matrixWorld.elements.some(v=>!Number.isFinite(v)))finite=false;});
     rows.push({role,fps,level,state,finite,meshes,hand:actor.handMidLocal(new T.Vector3()).toArray(),head:actor.headTop.getWorldPosition(new T.Vector3()).toArray()});
    }
    actor.dispose();actor.dispose();
   }
   return rows;
  });
  assert.ok(animationMatrix.every(r=>r.finite&&r.meshes===1),'every role/state must keep a single finite skin');
  report.animationMatrix=animationMatrix;
  await page.evaluate(()=>{const c=window.__presentation;c.p.char.setState('sit');for(let i=0;i<90;i++)c.p.char.update(1/60,0);c.render('side');});
  await page.screenshot({path:output+'/release-sit.png'});
  await page.evaluate(()=>{const c=window.__presentation;for(let i=0;i<90;i++)c.step();});
  const cases=[];
  for(const level of [0,4,8])for(const count of [1,3,6,9,12,15]){
   if(count>3&&level===0||count>9&&level===4)continue;
   for(const moving of [false,true]){
    const result=await page.evaluate(({level,count,moving})=>{
     const c=window.__presentation;c.p.dropAll();c.p.setCarrierLevel(level);
     const products=['cay','latte','tost'];
     for(let i=0;i<count;i++)c.p.give(products[i%3]);
     for(let i=0;i<120;i++)c.step(moving);
     c.render();return c.metrics();
    },{level,count,moving});
    cases.push({level,count,moving,...result});
    if((level===0&&count===3)||(level===8&&count===15))await page.screenshot({path:output+'/'+mode+'-carry-'+level+'-'+count+'-'+(moving?'walk':'idle')+'.png'});
   }
  }
  const transition=await page.evaluate(()=>{
   const c=window.__presentation;c.p.dropAll();c.p.setCarrierLevel(0);for(let i=0;i<60;i++)c.step();
   for(const item of ['cay','latte','tost'])c.p.give(item);
   let tray=Infinity,product=Infinity;
   for(let i=0;i<150;i++){c.step(i>=30&&i<100);const m=c.metrics();tray=Math.min(tray,m.min[2]);for(const b of m.productBounds)product=Math.min(product,b.min[2]);}
   return {minTray:tray,minProduct:product};
  });
  const mop=await page.evaluate(()=>{const c=window.__presentation;c.p.dropAll();for(let i=0;i<90;i++)c.step(false,true);c.render();return c.metrics();});
  await page.screenshot({path:output+'/'+mode+'-mop.png'});
  const fullHands=await page.evaluate(()=>{const c=window.__presentation;c.p.give('cay');c.step(false,true);return c.metrics();});
  report.characters.push({mode,cases,transition,mop,fullHands,errors});
  await writeFile(output+'/results.json',JSON.stringify(report,null,2));
  assert.deepEqual(errors,[]);
  assert.ok(transition.minTray>.18&&transition.minProduct>.28,'pickup/start/stop must keep products clear: '+JSON.stringify({mode,transition}));
  for(const c of cases.filter(c=>c.level===8))assert.ok(c.cartGripError<.001,'cart handle must meet hands');
  assert.ok(mop.mopVisible&&!mop.clothVisible);
  assert.ok(mop.mopGripError<.001&&mop.mopBrushError<.001);
  assert.ok(!fullHands.mopVisible&&!fullHands.clothVisible);
  for(const c of cases.filter(c=>c.level<8)) {
    assert.ok(c.min[2]>.18,mode+' tray crosses torso: '+JSON.stringify(c));
    for(const p of c.productBounds)assert.ok(p.min[2]>.3,mode+' product crosses torso: '+JSON.stringify(c));
  }
  // Environment: validate every opening, then inspect both entrances in real camera framing.
  await page.evaluate(()=>{
   const c=window.__presentation;c.p.dispose();
   c.game.ui.setTutorial(null);c.game.ui.closePanels();c.game.state.tutorialStep=99;
  });
  for(const stage of ['closed','open','inside']){
   const open=stage!=='closed';
   for(const size of [{width:838,height:532},{width:390,height:844}]){
    await page.setViewportSize(size);
    for(const id of ['r1','r2']){
     const room=await page.evaluate(async({id,open,stage})=>{
      const g=window.__fincan,w=g.world;
      if(open)for(const z of w.loc.zones)if(!w.zoneUnlocked(z.id))w.unlockZone(z.id);
      const z=w.loc.zones.find(z=>z.id===id),r=z.room;
      g.player.dropAll();g.player.setPosition(id==='r1'?r.x0+(stage==='inside'?1.2:-.8):r.x1+(stage==='inside'?-1.2:.8),r.door.pos);
      const {floorLiftAt}=await import('/src/data/layouts.ts');
      g.player.floorY=floorLiftAt(w.loc,g.player.x,g.player.z);g.player.char.root.position.y=g.player.floorY;
      g.player.angle=id==='r1'?Math.PI/2:-Math.PI/2;g.player.char.root.rotation.y=g.player.angle;
      g.scene3d.resize();g.scene3d.snapTo(g.player.x,g.player.z);
      for(let i=0;i<70;i++){g.stepVisual(1/60);w.updateVisuals(1/60);w.env.update(1/60);}
      g.scene3d.invalidateStatic();g.scene3d.invalidateShadows();g.scene3d.render();
      const head=g.player.char.headTop.getWorldPosition(new window.__presentation.T.Vector3()).project(g.scene3d.camera);
      const title=w.root.getObjectByName('roomFloorTitle_'+id);
      const corners=[new window.__presentation.T.Vector3(-1.7,0,0),new window.__presentation.T.Vector3(1.7,0,0)].map(v=>title.localToWorld(v).project(g.scene3d.camera).toArray());
      const T=window.__presentation.T;
      const ray=new T.Raycaster();ray.layers.enableAll();const origin=g.scene3d.camera.getWorldPosition(new T.Vector3());
      const occlusion=[];w.root.updateMatrixWorld(true);
      for(const y of [.8,1.35]){
       const target=new T.Vector3(g.player.x,g.player.floorY+y,g.player.z),direction=target.clone().sub(origin);
       ray.set(origin,direction.clone().normalize());ray.far=direction.length()-.1;
       const blockers=[];w.env.root.traverseVisible(o=>{if(o.isMesh)blockers.push(o);});
       const hits=ray.intersectObjects(blockers,false);if(hits.length)occlusion.push({y,object:hits[0].object.name,distance:hits[0].distance});
      }
      return {id,stage,open,actualOpen:w.zoneUnlocked(id),head:head.toArray(),titleCorners:corners,occlusion,floorY:g.player.floorY,layout:w.validateLayout(),focus:g.scene3d.focus.toArray()};
     },{id,open,stage});
     report.rooms.push({mode,size,...room});
     await page.screenshot({path:output+'/'+mode+'-'+id+'-'+stage+'-'+size.width+'.png'});
     assert.deepEqual(room.layout,[],id+' layout');
     assert.equal(room.actualOpen,open,'closed and open fixtures must match');
     assert.deepEqual(room.occlusion,[],'architecture must not cover the player: '+JSON.stringify(room));
     for(const corner of room.titleCorners)assert.ok(Math.abs(corner[0])<.98,'full room name stays in view: '+JSON.stringify(room));
     assert.ok(Math.abs(room.head[0])<.8&&Math.abs(room.head[1])<.85,'player remains in view');
    }
   }
  }
  await context.close();
 }
 await writeFile(output+'/results.json',JSON.stringify(report,null,2));
 console.log('Presentation checks passed: '+report.characters.length+' character systems, '+report.rooms.length+' room views.');
} finally {await browser?.close();await server.close();}
