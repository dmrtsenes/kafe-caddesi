import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out=process.argv.find(a=>a.startsWith('--output='))?.slice(9)??'.devshots/premium-tray-2026-09-06';
await mkdir(out,{recursive:true});
const server=await createServer({configFile:false,optimizeDeps:{noDiscovery:true},server:{host:'127.0.0.1',port:5341,strictPort:true,hmr:false,watch:null}});
await server.listen();
let browser;
try{
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1100,height:780},deviceScaleFactor:1});
 await page.route('**/tray-fixture',r=>r.fulfill({contentType:'text/html',body:'<html><body style="margin:0"></body></html>'}));
 await page.goto('http://127.0.0.1:5341/tray-fixture');
 const metrics=await page.evaluate(async()=>{
  const [{THREE:T},{CarryStack},{ITEMS},{loadPacks},{loadCharacterPack},{Player}]=await Promise.all([import('/tools/browser-render.ts'),import('/src/entities/CarryStack.ts'),import('/src/data/items.ts'),import('/src/world/packs/library.ts'),import('/src/chars/index.ts'),import('/src/entities/Player.ts')]);
  await Promise.all([loadPacks(),loadCharacterPack()]);
  const errors=[],stages=[],root=new T.Group();
  const c=new CarryStack(root);
  const origin=new T.Vector3();
  let checks=0;
  for(const [stage,level,cap] of [[0,0,3],[1,4,6],[2,8,15]]){
   c.setPresentationStage(level);
   for(const item of Object.keys(ITEMS))for(let n=1;n<=cap;n++){
    c.setSlots(Array(n).fill(item));root.updateMatrixWorld(true);c.root.getWorldPosition(origin);
    const goods=c.root.children.filter(o=>o.name==='carriedProduct');
    for(let i=0;i<goods.length;i++){
     const b=new T.Box3().setFromObject(goods[i]);b.min.sub(origin);b.max.sub(origin);
     const lower=stage===2&&i>=9;
     const width=stage===0?1.04:stage===1?1.3:lower?.96:1.04;
     const depth=stage===0?.74:stage===1?.9:lower?.8:.94;
     const hx=(width-.114)/2,hz=(depth-.114)/2;
     if(b.min.x < -hx-1e-5||b.max.x >hx+1e-5||b.min.z < -hz-1e-5||b.max.z >hz+1e-5)errors.push({stage,n,item,i,kind:'rim',min:b.min.toArray(),max:b.max.toArray(),hx,hz});
     if(Math.abs(b.min.y-(lower?-.54:.04))>.0001)errors.push({stage,n,item,i,kind:'floor',y:b.min.y});
     for(let j=0;j<i;j++){
      if(stage===2&&(i>=9)!==(j>=9))continue;
      const other=new T.Box3().setFromObject(goods[j]);other.min.sub(origin);other.max.sub(origin);
      const overlapX=Math.min(b.max.x,other.max.x)-Math.max(b.min.x,other.min.x);
      const overlapZ=Math.min(b.max.z,other.max.z)-Math.max(b.min.z,other.min.z);
      if(overlapX>1e-5&&overlapZ>1e-5)errors.push({stage,n,item,i,j,kind:'product-overlap',overlapX,overlapZ});
     }
     checks++;
    }
   }
   let meshes=0,triangles=0;
   [c.smallTray,c.wideTray,c.cart][stage].traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});
   stages.push({stage,meshes,triangles});
  }
  c.clear();c.dispose();
  const scene=new T.Scene();scene.background=new T.Color(0xe6dcc9);
  scene.add(new T.HemisphereLight(0xffffff,0xada189,2.2));
  const sun=new T.DirectionalLight(0xfff3d9,3);sun.position.set(-3,7,4);scene.add(sun);
  const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1100,780);renderer.setPixelRatio(1);renderer.outputColorSpace=T.SRGBColorSpace;
  document.body.append(renderer.domElement);
  const camera=new T.PerspectiveCamera(32,1100/780,.1,40);camera.layers.enableAll();camera.position.set(3.7,5.3,6.8);camera.lookAt(0,0.65,0.1);
  const players=[];
  for(const [x,level,items] of [[-1.7,0,['latte','tost','cay']],[0,4,['latte','tost','cay','frappe','waffle','latte']],[1.8,8,Array.from({length:15},(_,i)=>['latte','cay','tost'][i%3])]]){
   const player=new Player();player.setPosition(x,0);player.stack.setPresentationStage(level);player.stack.setSlots(items);player.char.setCarryCount(items.length);player.char.setCarryMode(level>=8?'cart':'tray');for(let i=0;i<90;i++){player.char.update(1/60,0);player.stack.update(1/60,0);if(level>=8)player.stack.fitCartGrip(player.char.handMidLocal(new T.Vector3()),player.char.handSpanLocal(new T.Vector3()));}scene.add(player.char.root);players.push(player);
  }
  renderer.render(scene,camera);
  window.trayFixture={scene,camera,renderer,players};
  return{checks,errors,stages,render:renderer.info.render};
 });
 await page.screenshot({path:out+'/tray-family.png'});
 await writeFile(out+'/metrics.json',JSON.stringify(metrics,null,2));
 assert.deepEqual(metrics.errors, [], 'carried products must fit their tray/cart');
 console.log(JSON.stringify(metrics));
}finally{await browser?.close();await server.close();}
