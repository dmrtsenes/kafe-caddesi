import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
const adb='C:/Windows/adb.exe',serial='R6CY402VZ5L',app='com.fincansokagi.game.preview',port='9228';
const run=(...args)=>execFileSync(adb,['-s',serial,...args],{encoding:'utf8'}).trim();
let browser;
try{
 const pid=run('shell','pidof',app);if(!/^\d+$/.test(pid))throw Error('Preview is not running');
 run('forward','tcp:'+port,'localabstract:webview_devtools_remote_'+pid);
 browser=await chromium.connectOverCDP('http://127.0.0.1:'+port);
 const page=browser.contexts().flatMap(c=>c.pages()).find(p=>/^https?:\/\/localhost/.test(p.url()));
 if(!page)throw Error('Preview WebView missing');
 if(process.argv.includes('--restore')){
  const original=JSON.parse(await readFile('.devshots/mobile-parity-2026-09-10/a35-quality/before.json','utf8'));
  await Promise.all([page.waitForEvent('domcontentloaded'),page.evaluate(async original=>{
   const g=window.__fincan;g.stop();
   for(const [key,value] of Object.entries(original.settings))g.settings.set(key,value);
   await g.importSave(original.save);
  },original)]);
  await page.waitForFunction(()=>!!window.__fincan);
 }
 const result=await page.evaluate(async()=>{
  const g=window.__fincan,s=g.scene3d,wasRunning=g.running;
  const sample=()=>new Promise(resolve=>{
   const values=[];let previous=0;
   const frame=at=>{if(previous)values.push(at-previous);previous=at;if(values.length<90)requestAnimationFrame(frame);else{values.sort((a,b)=>a-b);resolve({p10:values[9],median:values[45],p90:values[81]});}};
   requestAnimationFrame(frame);
  });
  const running=await sample();g.stop();
  try{
   const idle=await sample();
   const thermal=await window.Capacitor?.Plugins?.DeviceThermal?.getStatus?.();
   return {running,idle,thermal,settings:g.settings.all,estimatedHz:g.refreshHz,measuredFps:g.measuredFps,
    deviceDpr:devicePixelRatio,cores:navigator.hardwareConcurrency,memory:navigator.deviceMemory,
    pixels:[s.renderer.domElement.width,s.renderer.domElement.height],shadows:s.renderer.shadowMap.enabled,
    currentDpr:s.renderer.getPixelRatio(),cast:g.player.char.root.userData.characterPack};
  }finally{if(wasRunning)g.start();}
 });
 await mkdir('.devshots/mobile-parity-2026-09-10/a35-probe',{recursive:true});
 await writeFile('.devshots/mobile-parity-2026-09-10/a35-probe/result.json',JSON.stringify(result,null,2));
 console.log(JSON.stringify(result,null,2));
}finally{await browser?.close();try{run('forward','--remove','tcp:'+port);}catch{}}
