import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createServer} from 'vite';
const origin='http://127.0.0.1:5221', output='.devshots/ui-contract-2026-09-06';
await mkdir(output,{recursive:true});const report={scenarios:[],scope:'Isolated desktop browser at phone CSS sizes; no physical device claim'};
const server=await createServer({server:{host:'127.0.0.1',port:5221,strictPort:true,open:false,hmr:false}});await server.listen();
let browser;
try {
  browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
  for(const fixture of [{language:'tr',width:320,height:740},{language:'en',width:390,height:844}]) {
    const context=await browser.newContext({viewport:{width:fixture.width,height:fixture.height},deviceScaleFactor:1,isMobile:true,hasTouch:true});
    const page=await context.newPage(),errors=[],remote=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url())&&new URL(r.url()).origin!==origin)remote.push(r.url())});
    await page.addInitScript(language=>localStorage.setItem('fincan-sokagi:language:v1',language),fixture.language);
    await page.goto(origin+'/',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>!!window.__fincan,undefined,{timeout:90000});
    await page.locator('#boot-screen').waitFor({state:'detached',timeout:90000});
    const result=await page.evaluate(async()=>{
      const g=window.__fincan;g.stop();g.state.tutorialStep=99;g.ui.setTutorial(null);g.state.money=1e9;
      const {COSMETIC_AXIS_DEFS,cosmeticOptions}=await import('/src/data/cosmetics.ts');
      const {couponPrice}=await import('/src/ui/api.ts');
      const snapshot=()=>JSON.stringify(g.state.save());
      const uniform=cosmeticOptions('uniform').find(o=>o.cost>0&&!g.state.ownsCosmetic('uniform',o.id));
      if(!uniform)throw new Error('No paid uniform fixture');
      g.ui.openPanel('decor');const before=snapshot(), original=g.state.cosmetics.uniform;
      const preview=g.previewCosmetic('uniform',uniform.id),during=snapshot(),rendered=g.world.appliedUniform;
      g.ui.closePanels();const canceled=snapshot(),restored=g.world.appliedUniform;
      g.ui.openPanel('decor');g.previewCosmetic('uniform',uniform.id);g.ui.openPanel('locations');
      const backRestored=g.world.appliedUniform;
      g.ui.openPanel('decor');g.state.coupons=1;g.previewCosmetic('uniform',uniform.id);
      const cash=g.state.money;const buy=g.buyCosmeticCoupon('uniform',uniform.id);const paid=cash-g.state.money;
      g.ui.closePanels();const boughtPersisted=g.state.cosmetics.uniform===uniform.id&&g.world.appliedUniform===uniform.id;
      const invalid=snapshot();const invalidAccepted=g.previewCosmetic('uniform','missing');const invalidAfter=snapshot();
      for(const st of g.world.stations){st.locked=false;g.state.unlockedZones.add(g.world.loc.id+':'+st.def.zone);}
      const toilet=g.world.stations.find(s=>s.def.kind==='toilet');
      const toiletRow=g.getStations().find(s=>s.id===toilet.id);
      const supplies=toilet.def.supplies.map(s=>({item:s.item,now:toilet.supplyCap(s.item),next:toilet.supplyCapAt(s.item,toilet.capLevel+1)}));
      const counter=g.world.counters[0],counterRow=g.getStations().find(s=>s.id===counter.id);
      const speedBefore=counter.counterOrderTime('player'),cashBefore=g.state.money;
      const upgrade=g.buyStationUpgrade(counter.id,'speed');
      const speedAfter=counter.counterOrderTime('player');
      const staff=g.getStaff();
      return {preview,unchanged:before===during&&before===canceled,rendered,uniform:uniform.id,original,restored,backRestored,buy,paid,expectedPrice:couponPrice(uniform.cost),boughtPersisted,coupons:g.state.coupons,invalidAccepted,invalidUnchanged:invalid===invalidAfter,toiletRow,supplies,counterRow,speedBefore,speedAfter,upgrade,upgradePaid:cashBefore-g.state.money,staff};
    });
    assert.equal(result.preview,true);assert.equal(result.unchanged,true);assert.equal(result.rendered,result.uniform);assert.equal(result.restored,result.original);assert.equal(result.backRestored,result.original);
    assert.equal(result.buy,true);assert.equal(result.paid,result.expectedPrice);assert.equal(result.coupons,0);assert.equal(result.boughtPersisted,true);assert.equal(result.invalidAccepted,false);assert.equal(result.invalidUnchanged,true);
    assert.match(result.toiletRow.capText,/6/);assert.match(result.toiletRow.nextCapText,/7/);assert.ok(!result.toiletRow.capText.startsWith('0'));
    assert.equal(result.upgrade,true);assert.ok(result.speedAfter<result.speedBefore);assert.ok(result.upgradePaid>0);
    assert.ok(result.staff.every(row=>row.effectText&&row.nextEffectText));
    const panels=[];
    for(const id of ['upgrades','stations','staff','decor','prestige','settings','goals']) {
      await page.evaluate(id=>window.__fincan.ui.openPanel(id),id);
      const layout=await page.evaluate(()=>{
        const panel=document.querySelector('.pw.open');
        const buttons=[...panel.querySelectorAll('button')].filter(b=>{const r=b.getBoundingClientRect();return r.height>0&&r.top<innerHeight&&r.bottom>0&&getComputedStyle(b).visibility!=='hidden'});
        return {overflow:document.documentElement.scrollWidth>innerWidth+1,tooSmall:buttons.filter(b=>b.getBoundingClientRect().height<43.5).map(b=>b.textContent),svg:panel.querySelectorAll('svg.cafe-icon').length,text:panel.textContent};
      });
      assert.equal(layout.overflow,false,id+' horizontal overflow');assert.deepEqual(layout.tooSmall,[],id+' touch targets');
      if(['upgrades','staff','settings'].includes(id))assert.ok(layout.svg>0,id+' icon family');
      if(id==='stations')assert.match(layout.text,/→/);if(id==='staff')assert.match(layout.text,/→/);
      await page.screenshot({path:output+'/'+fixture.language+'-'+id+'.png'});panels.push({id,overflow:layout.overflow,svg:layout.svg});
    }
    const modal=await page.evaluate(()=>{
      const g=window.__fincan;g.ui.openPanel('decor');g.ui.celebrate('Test','Reward','🎁');
      const overlap=document.querySelector('.cel.on')!==null;
      g.ui.closePanels();
      for(const [id,tone] of [['low','good'],['urgent','bad'],['next','info']])g.ui.showEvent({id,title:id,desc:'Event',glyph:'!',tone,remaining:30,duration:30});
      g.ui.update(.1);
      const visible=[...document.querySelectorAll('.ev')].filter(e=>getComputedStyle(e).display!=='none').map(e=>e.textContent);
      g.ui.hideEvent('urgent');g.ui.update(.1);g.ui.update(.1);g.ui.update(.1);
      const next=[...document.querySelectorAll('.ev')].filter(e=>getComputedStyle(e).display!=='none').map(e=>e.textContent);
      const original=g.getAdOffers.bind(g);g.getAdOffers=()=>{const o=original();o.happyHour.ready=true;o.robotVacuum.ready=true;return o;};g.ui.openPanel('upgrades');
      return {overlap,visible,next,offers:document.querySelectorAll('.pw.open .offer').length};
    });
    assert.equal(modal.overlap,false);assert.equal(modal.visible.length,1);assert.match(modal.visible[0],/urgent/);assert.equal(modal.next.length,1);assert.match(modal.next[0],/next/);assert.equal(modal.offers,1);
    const retention = await page.evaluate(async()=>{
      const g=window.__fincan;
      const {GameState}=await import('/src/sim/GameState.ts');
      const s=new GameState();s.stats.sale.cay=151;s.stats.sale.latte=50;s.seenLocations.add('sahil');
      const loaded=new GameState();loaded.load(s.save());loaded.prestigeReset(1);
      const saved = loaded.save();
      const cash=g.state.money, paid=g.state.revenueEarned;
      g.state.stats.sale.cay=151;g.state.stats.sale.latte=50;g.state.seenLocations.add('sahil');
      const album=g.getCollection();g.ui.openPanel('goals');
      const details=document.querySelector('.collection');details.open=true;
      const albumText=details.textContent;
      const nonEconomic=g.state.money===cash&&g.state.revenueEarned===paid;
      g.ui.closePanels();g.ui.showOffline({seconds:600,stocked:6,machines:1,lines:[{glyph:'🍵',text:'6 · Tea'}],comebackReady:false,nextGoal:'Next cafe room'});
      const returnText=document.querySelector('.mw.open').textContent;
      const returnHasGoal=returnText.includes('Next cafe room');
      g.ui.closePanels();const returnClosed=!g.ui.isPanelOpen();
      g.setSetting('reducedMotion',true);g.setSetting('muted',true);g.setSetting('haptics',false);
      g.ui.openPanel('upgrades');g.ui.update(.1);
      const settings=g.getSettings();const reducedClass=document.querySelector('.ui').classList.contains('reduced-motion');
      const fx=document.querySelector('.pw.open .btn');fx.classList.add('fx-shake-a');
      const shakeAnimation=getComputedStyle(fx).animationName;
      const before=g.getPrestige().canPrestige;g.state.seenLocations.delete('sahil');
      const eligibilityUnchanged=g.getPrestige().canPrestige===before;
      const tooWide=[...document.querySelectorAll('.pw.open .tag')].filter(e=>e.scrollWidth>e.clientWidth+2).map(e=>e.textContent);
      return {savedSales:saved.stats.sale,seen:saved.seenLocations,album,albumText,nonEconomic,returnText,returnHasGoal,returnClosed,settings,reducedClass,shakeAnimation,eligibilityUnchanged,tooWide};
    });
    assert.equal(retention.savedSales.cay,151);assert.ok(retention.seen.includes('sahil'));assert.equal(retention.album.recipes.find(r=>r.id==='cay').stars,3);assert.equal(retention.album.recipes.find(r=>r.id==='latte').stars,2);assert.equal(retention.nonEconomic,true);
    assert.equal(retention.returnHasGoal,true);assert.equal(retention.returnClosed,true);assert.equal(retention.reducedClass,true);assert.equal(retention.shakeAnimation,'none');assert.equal(retention.settings.muted,true);assert.equal(retention.settings.haptics,false);assert.equal(retention.eligibilityUnchanged,true);assert.deepEqual(retention.tooWide,[]);
    assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);report.scenarios.push({...fixture,result,panels,modal,retention,errors,remote});
    await context.close();console.log(fixture.language+' UI transaction/layout/event checks passed');
  }
  await writeFile(output+'/results.json',JSON.stringify(report,null,2));
}finally{await browser?.close();await server.close();}
