import {chromium} from 'playwright';
import {preview} from 'vite';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const args=Object.fromEntries(process.argv.slice(2).map(x=>x.replace(/^--/,'').split('=')));
const output=args.output??'.devshots/release-fixes-2026-09-06/progression';
await mkdir(output,{recursive:true});
const minutes=Number(args.minutes??90);if(!(minutes>=1&&minutes<=1440))throw Error('Invalid minutes');
const policies=(args.policy??'guide,investor,cleaner').split(',');const seeds=(args.seed??'417,808,1206').split(',').map(Number);
const server=await preview({preview:{host:'127.0.0.1',port:5323,strictPort:true,open:false}});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
const source=await readFile('tools/balance-bot.js','utf8');
const buildHash=createHash('sha256').update(await readFile('dist/index.html')).digest('hex');
const results=[];
try{
 for(const policy of policies)for(const seed of seeds){
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'tr-TR'});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(({seed})=>{
   // Allow the real boot frame, then stop at one fixed simulation step.
   // Asset/browser timing must not consume random frames before a seeded run.
   let game;
   Object.defineProperty(window,'__fincan',{configurable:true,get:()=>game,set:value=>{
     game=value;const tick=value.tick;
     value.tick=function(){value.tick=tick;tick.call(value,1/30);value.stop();};
   }});
   localStorage.setItem('fincan-sokagi:language:v1','tr');
   localStorage.setItem('fincan-sokagi:settings:v2',JSON.stringify({quality:'low',qualityAuto:false,muted:true,music:false,fps:30}));
   let a=seed>>>0;Math.random=()=>{a=(a+0x6d2b79f5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};
  },{seed});
  await page.goto('http://127.0.0.1:5323/',{waitUntil:'commit',timeout:90000});
  await page.waitForFunction(()=>!!window.__fincan,{},{timeout:90000});
  await page.locator('#boot-screen').waitFor({state:'detached',timeout:90000});
  await page.addScriptTag({content:source});
  const balance=await page.evaluate(({minutes,policy})=>window.__runBalanceBot({minutes,policy,sync:true}),{minutes,policy});
  const final=await page.evaluate(()=>{const g=window.__fincan;g.stop();g.persist();g.scene3d.render();return{state:g.state.save(),layout:g.world.validateLayout(),save:g.exportSave(),diagnostics:JSON.parse(g.exportDiagnostics())};});
  const result={policy,seed,buildHash,balance,final,errors};
  await writeFile(output+'/'+policy+'-'+seed+'.json',JSON.stringify(result,null,2));
  await page.screenshot({path:output+'/'+policy+'-'+seed+'.png'});
  assert.equal(balance.error,undefined,balance.error);assert.deepEqual(errors,[]);assert.deepEqual(final.layout,[]);
  assert.equal(balance.tutorialComplete,true);assert.ok(balance.served>0);assert.ok(balance.longestInactivity<180);
  results.push({policy,seed,minutes,served:balance.served,earned:balance.finalEarned,goal:balance.goalIndex,zones:balance.zoneTimes,locations:balance.locationTimes,hygiene:balance.hygiene,tail:balance.trailingPurchaseGap,maxInactivity:balance.longestInactivity,recoveries:balance.staffRecovery.count});
  console.log(JSON.stringify(results.at(-1)));
  await writeFile(output+'/summary.json',JSON.stringify({buildHash,results},null,2));await context.close();
 }
 assert.equal(buildHash,createHash('sha256').update(await readFile('dist/index.html')).digest('hex'),'Build changed during progression matrix');
}finally{await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));}
