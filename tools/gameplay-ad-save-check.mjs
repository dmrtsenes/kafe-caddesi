import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const server=await createServer({server:{host:'127.0.0.1',port:0,open:false,hmr:false,watch:null}});
await server.listen();let browser;
try{
  browser=await chromium.launch({channel:process.env.AD_BROWSER||'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
  const context=await browser.newContext({viewport:{width:540,height:960},locale:'tr-TR'});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(180000);
  const base=server.resolvedUrls.local[0];
  await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__fincan);
  // Reproduce a queued RAF timestamp older than the start/resume clock. The
  // normal game must still be able to save valid nonnegative progression.
  const clockCheck=await page.evaluate(async()=>{const g=window.__fincan;g.stop();
    const before=g.state.playTime;g.start();g.lastTime=performance.now()+250;
    await new Promise(ok=>requestAnimationFrame(ok));g.stop();
    return{before,after:g.state.playTime,progress:g.world.machines.map(s=>s.progress)};});
  assert.ok(clockCheck.after>=clockCheck.before);assert.ok(clockCheck.progress.every(p=>p>=0));
  const normal=await page.evaluate(async()=>{const g=window.__fincan;g.stop();g.state.money=76543;g.state.upgrades.capacity=2;g.state.tutorialStep=99;g.persist();
    const {validSavedState,validSavedWorlds}=await import('/src/core/SaveValidation.ts');
    const payload={state:g.state.save(),worlds:Object.fromEntries([...g.worlds].map(([id,w])=>[id,w.save()]))};
    return{money:g.state.money,capacity:g.state.upgrades.capacity,saved:localStorage.getItem('fincan-sokagi:save:v8'),model:g.player.char.root.userData.characterModel,
      payload,validState:validSavedState(payload.state),validWorld:validSavedWorlds(payload.worlds),
      layout:g.world.stations.map(s=>({id:s.id,x:s.x,z:s.z,rot:s.def.rot,kind:s.def.kind}))};});
  await mkdir('.devshots/reklam-full',{recursive:true});
  await writeFile('.devshots/reklam-full/save-fixture.json',JSON.stringify(normal,null,2));
  assert.equal(JSON.parse(normal.saved??'null')?.state?.money,normal.money,'Fixture must be saved before navigating away');
  console.log('Normal game save created in a temporary browser profile.');
  await page.goto(base+'reklam-full.html?capture=1',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__gameplayAd);
  const before=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage)));
  for(let n=0;n<15;n++)await page.evaluate(()=>{for(let i=0;i<50;i++)window.__gameplayAd.stepFrame(false);});
  const after=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage)));
  const film=await page.evaluate(()=>window.__gameplayAd.report());
  assert.deepEqual(after,before);assert.deepEqual(film.layout,normal.layout);assert.equal(film.player.model,normal.model);
  assert.equal(film.frame,750);assert.equal(film.layoutUnchanged,true);
  console.log('All 750 film frames preserve storage and the normal game map.');
  await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__fincan);
  const resumed=await page.evaluate(()=>{const g=window.__fincan;g.stop();return{money:g.state.money,capacity:g.state.upgrades.capacity,
    tutorial:g.state.tutorialStep,film:!!window.__gameplayAd,ui:!!document.querySelector('#ui-root')?.children.length,model:g.player.char.root.userData.characterModel};});
  assert.equal(resumed.money,normal.money);assert.equal(resumed.capacity,normal.capacity);assert.equal(resumed.tutorial,99);
  assert.equal(resumed.model,normal.model);assert.equal(resumed.film,false);assert.equal(resumed.ui,true);assert.deepEqual(errors,[]);
  await mkdir('.devshots/reklam-full',{recursive:true});
  await writeFile('.devshots/reklam-full/save-regression.json',JSON.stringify({passed:true,allStorageUnchanged:true,normalMapAndCastIdentical:true,clockCheck,resumed,errors},null,2));
  console.log('Passed: normal save → full advertisement → normal play with saved progress and UI.');
}finally{await browser?.close();await server.close();}
