import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const adb='C:/Windows/adb.exe',serial='R6CY402VZ5L',app='com.fincansokagi.game.preview',port='9228';
const run=(...args)=>execFileSync(adb,['-s',serial,...args],{encoding:'utf8'}).trim();
const out='.devshots/mobile-parity-2026-09-10/a35-quality';
await mkdir(out,{recursive:true});
let browser,page,original;
const report={modes:[]};
try{
 const pid=run('shell','pidof',app);if(!/^\d+$/.test(pid))throw Error('Preview is not running');
 run('forward','tcp:'+port,'localabstract:webview_devtools_remote_'+pid);
 browser=await chromium.connectOverCDP('http://127.0.0.1:'+port);
 page=browser.contexts().flatMap(c=>c.pages()).find(p=>/^https?:\/\/localhost/.test(p.url()));
 if(!page)throw Error('Preview WebView missing');
 original=await page.evaluate(()=>{const g=window.__fincan;return {save:g.exportSave(),settings:{...g.settings.all}};});
 await writeFile(out+'/before.json',JSON.stringify(original,null,2));
 for(const full of [false,true]){
  await page.evaluate(full=>{
   const g=window.__fincan,s=g.scene3d,w=g.world;g.stop();g.persistDisabled=true;
   g.ui.closePanels();g.ui.setTutorial(null);g.state.tutorialStep=99;
   g.setQualityTier('high');g.setFps(60);
   if(full){
    for(const zone of w.loc.zones)if(!w.zoneUnlocked(zone.id))w.unlockZone(zone.id);
    Object.assign(g.state.staffCount,{waiter:2,cashier:2,barista:2,busser:2});w.syncStaff();g.ui.endCelebrate();
    const render=s.render.bind(s);s.render=()=>{};for(let n=0;n<1200;n++)g.tick(1/30);s.render=render;
   }
   g.player.setPosition(0,full?3:-8);s.snapTo(g.player.x,g.player.z);
   s.qualityDprCap=Math.min(devicePixelRatio,3);s.renderPixelBudget=3000000;s.resize();
   s.framing={...s.framing,distance:27.5,fov:40,offsetY:0,maxLead:1.1};
   s.distanceTarget=s.distance=27.5;s.camera.fov=40;s.camera.clearViewOffset();s.camera.updateProjectionMatrix();
   window.__qualityInput??=g.input.update.bind(g.input);
   g.input.update=()=>{Object.assign(g.input.move,{x:Math.sin(performance.now()/1800)>0?.8:-.8,y:0,mag:.8,active:true});return g.input.move;};
   if(!window.__qualityRender){
    window.__qualityRender=s.render.bind(s);
    s.render=()=>{const at=performance.now();window.__qualityRender();if(window.__qualityFrames.length<10000)window.__qualityFrames.push({at,ms:performance.now()-at});};
   }
   window.__qualityFrames=[];g.start();
  },full);
  await page.waitForTimeout(3000);
  await page.evaluate(()=>{window.__qualityFrames=[];window.__qualityStart=performance.now();});
  await page.waitForTimeout(20000);
  const result=await page.evaluate(async()=>{
   const g=window.__fincan,s=g.scene3d,f=window.__qualityFrames;g.stop();
   const elapsed=performance.now()-window.__qualityStart;
   const gaps=f.slice(1).map((x,i)=>x.at-f[i].at).sort((a,b)=>a-b),work=f.map(x=>x.ms).sort((a,b)=>a-b);
   return {fps:f.length*1000/elapsed,frameP95:gaps[Math.floor(gaps.length*.95)],renderMedian:work[Math.floor(work.length*.5)],renderP95:work[Math.floor(work.length*.95)],
    over100ms:gaps.filter(x=>x>100).length,pixels:[s.renderer.domElement.width,s.renderer.domElement.height],shadows:s.renderer.shadowMap.enabled,
    calls:s.renderer.info.render.calls,triangles:s.renderer.info.render.triangles,customers:g.world.customers.length,staff:g.world.staff.length,
    thermal:await window.Capacitor.Plugins.DeviceThermal.getStatus(),camera:s.framing};
  });
  report.modes.push({full,...result});console.log(JSON.stringify(report.modes.at(-1)));
  await page.screenshot({path:out+'/'+(full?'full':'opening')+'.png'});
 }
}finally{
 if(page&&original){
  try{
   await Promise.all([page.waitForEvent('domcontentloaded'),page.evaluate(async original=>{
    const g=window.__fincan;g.stop();if(window.__qualityInput)g.input.update=window.__qualityInput;
    for(const [key,value] of Object.entries(original.settings))g.settings.set(key,value);
    await g.importSave(original.save);
   },original)]);
   await page.waitForFunction(()=>!!window.__fincan);report.restored=true;
  }catch(e){report.restoreError=String(e);}
 }
 await writeFile(out+'/result.json',JSON.stringify(report,null,2));
 await browser?.close();try{run('forward','--remove','tcp:'+port);}catch{}
}
