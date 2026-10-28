import { chromium } from 'playwright';
import { mkdir,writeFile } from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
const results=[];
try{
 for(const id of ['garden','courtyard']){
  const context=await browser.newContext();const page=await context.newPage();
  await page.goto('http://127.0.0.1:5173/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!!window.__fincan,undefined,{timeout:90000});
  const result=await page.evaluate(({id})=>{
   const g=window.__fincan,w=g.world,p=g.player;g.stop();g.persistDisabled=true;g.state.tutorialStep=99;g.ui.setTutorial(null);g.ui.closePanels();
   for(const zone of id==='garden'?['a3']:['a3','a4','a5'])w.unlockZone(zone);
   w.sideActivities.depositPurchase(id,id==='garden'?800:2200,w.menuItems());w.syncSideArchitecture();w.rebuildNav();w.selectedSideActivity=id;
   p.dropAll();p.setPosition(0,-6.8);const mods={spawnMult:0,valueMult:1,patienceMult:1,tipMult:1};
   const DT=1/30,path=[];let key='',index=0,refresh=0,lastCompleted=0,lastWork=0,longest=0;
   const orders=[];let t=0;
   for(;t<240;t+=DT){
    const goal=w.pickGuideTarget(p);const move={x:0,y:0,mag:0,active:false};
    if(goal){const nextKey=goal.x.toFixed(2)+':'+goal.z.toFixed(2);refresh-=DT;
     if(nextKey!==key||refresh<=0){key=nextKey;refresh=.75;index=0;path.length=0;if(!w.nav.findPath(p.x,p.z,goal.x,goal.z,path))throw new Error('Unreachable '+JSON.stringify(goal));}
     while(index<path.length&&Math.hypot(path[index]-p.x,path[index+1]-p.z)<.24)index+=2;
     const tx=index<path.length?path[index]:goal.x,tz=index<path.length?path[index+1]:goal.z;
     const dx=tx-p.x,dz=tz-p.z,d=Math.hypot(dx,dz);
     if(Math.hypot(goal.x-p.x,goal.z-p.z)>.27&&d>.02){move.x=dx/d;move.y=-dz/d;move.mag=Math.min(1,d/.62);move.active=true;}
    }
    p.update(DT,move,w.nav,w.loc.bounds);w.update(DT,p,mods);
    const state=w.sideActivities.get(id);
    if(state.completed!==lastCompleted){lastCompleted=state.completed;orders.push({at:+t.toFixed(2),amount:state.reward,lines:state.lines});}
    if(p.interacting||p.carryCount>0){longest=Math.max(longest,t-lastWork);lastWork=t;}
    if(lastCompleted>=3)break;
   }
   if(lastCompleted<3)throw new Error('Loop stalled: '+JSON.stringify({id,t,p:{x:p.x,z:p.z,items:p.slots},state:w.sideActivities.get(id),goal:w.pickGuideTarget(p)}));
   return {id,simulationSeconds:+t.toFixed(2),orders,inventorySource:'real production machines',longestGap:+longest.toFixed(2)};
  },{id});results.push(result);console.log(JSON.stringify(result));await context.close();
 }
 await mkdir('.devshots/side-activities-integration-2026-09-07',{recursive:true});await writeFile('.devshots/side-activities-integration-2026-09-07/real-routes.json',JSON.stringify(results,null,2));
}finally{await browser.close();}
