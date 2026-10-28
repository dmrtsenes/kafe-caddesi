import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const phase=process.argv.includes('--before')?'before':'after',out='.devshots/premium-phone-2026-09-08/'+phase;
await mkdir(out,{recursive:true});
const server=await createServer({server:{host:'127.0.0.1',port:5356,strictPort:true,hmr:false,open:false}});let browser;const results=[];
try{await server.listen();browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
for(const fixture of [{w:320,h:568,lang:'tr'},{w:390,h:844,lang:'en'},{w:844,h:390,lang:'tr',safe:true}]){
const ctx=await browser.newContext({viewport:{width:fixture.w,height:fixture.h},isMobile:true,hasTouch:true});const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(lang=>localStorage.setItem('fincan-sokagi:language:v1',lang),fixture.lang);
await page.goto('http://127.0.0.1:5356/',{waitUntil:'commit'});await page.waitForFunction(()=>!!window.__fincan,undefined,{timeout:90000});await page.locator('#boot-screen').waitFor({state:'detached',timeout:90000});
await page.evaluate(safe=>{const g=window.__fincan;g.stop();g.persistDisabled=true;if(safe)for(const [k,v]of Object.entries({'--sa-t':'0px','--sa-l':'44px','--sa-r':'44px','--sa-b':'21px'}))document.querySelector('.ui').style.setProperty(k,v);},fixture.safe);
for(const stage of ['tutorial-long','hud','jobs','upgrades','stations','staff','locations','settings','goals','decor']){
await page.evaluate(async stage=>{const g=window.__fincan,w=g.world,p=g.player;g.ui.closePanels();if(stage==='tutorial-long'){const {TUTORIAL_STEPS}=await import('/src/sim/Tutorial.ts');g.ui.setTutorial({index:5,total:TUTORIAL_STEPS.length,text:TUTORIAL_STEPS[5].text});}else{g.state.tutorialStep=99;g.ui.setTutorial(null);g.state.money=100000;for(const zone of w.loc.zones)if(!w.zoneUnlocked(zone.id))w.unlockZone(zone.id);g.ui.endCelebrate();p.setPosition(-2,-2);p.give('cay');w.updateGuide(.3,p);if(stage!=='hud'&&stage!=='jobs')g.ui.openPanel(stage);g.scene3d.snapTo(p.x,p.z);for(let n=0;n<60;n++)g.stepVisual(1/60);g.scene3d.render();}},stage);
if(stage==='jobs')await page.locator('.side-jobs-toggle').click();
await page.waitForTimeout(330);
const layout=await page.evaluate(()=>{const g=window.__fincan;const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom,text:e.textContent}};const sels=['.hud-stack','.tut.on','.side','.carry','.side-jobs:not(.collapsed)','.pw.open .panel','.pw.open .panel-head','.pw.open .panel-body'];const boxes=Object.fromEntries(sels.map(s=>[s,document.querySelector(s)?rect(document.querySelector(s)):null]));const panel=document.querySelector('.pw.open');const buttons=panel?[...panel.querySelectorAll('button,select')].filter(e=>e.getClientRects().length).map(rect):[];return{boxes,buttons,overflows:panel?[...panel.querySelectorAll('*')].filter(e=>e.clientWidth>0&&e.scrollWidth>e.clientWidth+2&&!['panel-body'].some(c=>e.classList.contains(c))).map(e=>({tag:e.tagName,c:e.className,text:e.textContent})):[],docOverflow:document.documentElement.scrollWidth>innerWidth+1,character:g.player.char.constructor.name,head:g.scene3d.project(g.player.x,g.player.floorY+g.player.char.height,g.player.z,{x:0,y:0,behind:false}),foot:g.scene3d.project(g.player.x,g.player.floorY,g.player.z,{x:0,y:0,behind:false})};});
await page.screenshot({path:out+'/'+fixture.w+'-'+stage+'.png'});results.push({fixture,stage,layout,errors});await writeFile(out+'/results.json',JSON.stringify(results,null,2));
if(phase==='after') {
 assert.equal(layout.docOverflow,false);
 assert.deepEqual(layout.overflows.filter(entry=>!String(entry.c).startsWith('dept ')),[],'no cropped panel text '+fixture.w+' '+stage);
 assert.ok(layout.buttons.every(b=>b.w>=43.9&&b.h>=43.9),'44px controls '+fixture.w+' '+stage);
 const tut=layout.boxes['.tut.on'];
 if(tut) { assert.ok(tut.h<=104,'instruction is readable without a tall column');assert.ok(tut.y>layout.foot.y+6 || tut.right<layout.head.x-12 || tut.x>layout.head.x+12,'tutorial clears the player'); }
 const panel=layout.boxes['.pw.open .panel'];if(panel)assert.ok(panel.y>=0&&panel.bottom<=fixture.h&&panel.x>=(fixture.safe?44:0)&&panel.right<=fixture.w-(fixture.safe?44:0),'panel inside safe area');
}
console.log(fixture.w+' '+stage+' inspected');
}
if(phase==='after') {
 await page.evaluate(()=>{const g=window.__fincan;g.ui.closePanels();g.ui.showAdChip('happy_hour','☕','Kısa mola','İsteğe bağlı bir teklif');});
 await page.waitForTimeout(300);
 for(const selector of ['.adchip-go','.adchip-x']){const r=await page.locator(selector).boundingBox();assert.ok(r&&r.width>=44&&r.height>=44,'offer controls are touchable');}
 await page.screenshot({path:out+'/'+fixture.w+'-optional-offer.png'});await page.locator('.adchip-x').click();assert.equal(await page.locator('.adchip').isVisible(),false);
 await page.evaluate(()=>{const g=window.__fincan;g.ui.closePanels();document.querySelector('.side-btn').focus();g.ui.openPanel('upgrades');});
 assert.equal(await page.locator('.panel-x').evaluate(e=>e===document.activeElement),true,'sheet starts on close button');
 assert.equal(await page.locator('.hud').evaluate(e=>e.inert),true,'background is inactive');
 await page.locator('.tab[aria-selected="true"]').focus();await page.keyboard.press('ArrowRight');
 assert.equal(await page.locator('.tab[aria-selected="true"]').getAttribute('id'),'fincan-tab-stations');
 await page.keyboard.press('ArrowLeft');
 const purchase=await page.evaluate(()=>{const g=window.__fincan,u=g.getPlayerUpgrades().find(u=>!u.maxed&&u.affordable);const button=document.querySelector('[data-ui-key="player-'+u.id+'"] button');button.focus();const cash=g.state.money;button.click();document.querySelector('[data-ui-key="player-'+u.id+'"] button').click();return {id:u.id,cash,cost:u.cost,level:u.level,key:button.dataset.focusKey};});
 await page.waitForTimeout(310);
 const bought=await page.evaluate(id=>{const g=window.__fincan;return {money:g.state.money,level:g.getPlayerUpgrades().find(u=>u.id===id).level,key:document.activeElement.dataset.focusKey}},purchase.id);
 assert.equal(purchase.cash-bought.money,purchase.cost,'one payment per double activation');assert.equal(bought.level,purchase.level+1);assert.equal(bought.key,purchase.key,'purchase keeps the same control focused');
 await page.evaluate(()=>{const panel=document.querySelector('.pw.open'),buttons=[...panel.querySelectorAll('button,a[href],input,select,textarea,summary')].filter(e=>!e.disabled&&e.tabIndex>=0&&e.getClientRects().length);buttons.at(-1).focus();});
 await page.keyboard.press('Tab');assert.equal(await page.locator('.panel-x').evaluate(e=>e===document.activeElement),true,'Tab wraps inside sheet');
 await page.keyboard.press('Shift+Tab');const backFocus=await page.evaluate(()=>{const r=document.activeElement.getBoundingClientRect(),p=document.querySelector('.pw.open .panel-body').getBoundingClientRect();return {bottom:r.bottom,top:r.top,pBottom:p.bottom,pTop:p.top};});assert.ok(backFocus.top>=backFocus.pTop-1&&backFocus.bottom<=backFocus.pBottom+1,'backward tab keeps the last control visible');
 await page.keyboard.press('Escape');assert.equal(await page.locator('.side-btn').first().evaluate(e=>e===document.activeElement),true,'close returns to launcher');assert.equal(await page.locator('.hud').evaluate(e=>e.inert),false);
 await page.evaluate(()=>window.__fincan.ui.showOffline({seconds:600,stocked:6,machines:1,lines:[],comebackReady:false}));
 await page.waitForTimeout(330);const offbox=await page.locator('.mw.open .modal').boundingBox();assert.ok(offbox&&offbox.x>=(fixture.safe?44:0)&&offbox.y>=0&&offbox.x+offbox.width<=fixture.w-(fixture.safe?44:0)&&offbox.y+offbox.height<=fixture.h-(fixture.safe?21:0),'return modal safe area');
 assert.equal(await page.locator('.mw.open [role="dialog"]').count(),1);assert.equal(await page.locator('#fincan-offline-title').evaluate(e=>e===document.activeElement),true,'return starts with its summary');await page.keyboard.press('Tab');assert.equal(await page.locator('.mw.open button:not([style*="display: none"])').last().evaluate(e=>e===document.activeElement),true);
 await page.keyboard.press('Enter');assert.equal(await page.locator('.mw.open').count(),0);
 await page.setViewportSize({width:667,height:375});await page.evaluate(()=>{const g=window.__fincan;g.ui.openPanel('settings');for(let n=0;n<2;n++)g.stepVisual(1/60);});await page.waitForTimeout(350);
 const rotate=await page.locator('.pw.open .panel').evaluate(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:innerWidth,h:innerHeight}});
 assert.ok(rotate.y>=0&&rotate.bottom<=rotate.h&&rotate.x>=0&&rotate.right<=rotate.w,'rotated live sheet fits');
 results.push({fixture,interactive:{purchase,bought,rotate,focus:true}});console.log(fixture.w+' focus, purchase and live rotation passed');
}
assert.deepEqual(errors,[]);await ctx.close();}
await writeFile(out+'/results.json',JSON.stringify(results,null,2));}finally{await browser?.close();await server.close();}
