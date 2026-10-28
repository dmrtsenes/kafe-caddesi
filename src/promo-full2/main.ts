/** The shipped World, map, cast, interactions and rendering; no concept venue.
 * This separate entry deliberately never imports Game, Settings or SaveManager.
 * Fixtures live only in this document's memory. All filmed work runs through
 * Player.update + World.update at the normal 60 Hz simulation step.
 */
import { installCanvasCompat } from '../core/CanvasCompat';
import { composeGameplayFrame, assetsReady } from './titles';
const W = 1080, H = 1920, FPS = 30;
const manual = new URLSearchParams(location.search).has('capture');
let randomSeed = 20260913;
Math.random = () => ((randomSeed = (Math.imul(randomSeed, 1664525) + 1013904223) >>> 0) / 4294967296);
installCanvasCompat();

async function boot() {
  const [T, { Scene3D }, { World }, { GameState }, { Player }, { Customer }, { Order },
    { CUSTOMER_ARCHETYPES }, { createVFX }, { markDynamic }, { loadPacks }, { loadCharacterPack },
    { bus }, { BALANCE }, { applyTier }] = await Promise.all([
    import('three'), import('../world/Scene3D'), import('../sim/World'), import('../sim/GameState'),
    import('../entities/Player'), import('../entities/Customer'), import('../sim/Orders'),
    import('../data/customers'), import('../world/VFX'), import('../world/layers'),
    import('../world/packs/library'), import('../chars'), import('../core/EventBus'),
    import('../data/balance'), import('../core/Quality'),
  ]);
  applyTier('high');
  await Promise.all([loadPacks(), loadCharacterPack()]);
  await Promise.all([document.fonts.load('57px Paytone'),document.fonts.load('700 36px Barlow')]);
  await document.fonts.ready;
  await assetsReady;
  const canvas = document.querySelector<HTMLCanvasElement>('#stage')!;
  const film = document.querySelector<HTMLCanvasElement>('#film')!;
  const ctx = film.getContext('2d', { alpha: false })!;
  const scene = new Scene3D(canvas, 'high', false);
  scene.renderer.setPixelRatio(1);
  scene.renderer.setSize(W, H, false);
  scene.camera.aspect = W / H;
  scene.camera.clearViewOffset();
  scene.camera.fov = 38;
  scene.camera.updateProjectionMatrix();

  const state = new GameState();
  state.tutorialStep = 99;
  // A plausible mid-session fixture, not the user's save or a new balance rule.
  state.money = 300;
  state.upgrades.speed = 2;
  state.upgrades.hands = 2;
  for (const zone of ['a1', 't1', 'a3', 't2', 'a4', 't3', 'a5', 't4', 'a6', 't5'])
    state.unlockedZones.add('kose:' + zone);
  const vfx = createVFX();
  // Use the game's own effects at a restrained density for the close camera.
  const puff=vfx.puff,coinBurst=vfx.coinBurst;
  vfx.puff=(x,y,z,color,count)=>puff(x,y,z,color,Math.min(1,count??1));
  let coinAt=-1;
  vfx.coinBurst=(x,y,z,count)=>{
    if(state.playTime-coinAt<.12)return;coinAt=state.playTime;
    coinBurst(x,y,z,Math.min(4,count??4));
  };
  markDynamic(vfx.root);
  scene.scene.add(vfx.root);
  const world = new World('kose', state, vfx);
  world.setActive(true);
  scene.scene.add(world.root);
  scene.applyPalette(world.loc.palette);
  const b = world.loc.bounds;
  scene.setVenueCenter((b.x0+b.x1)/2, (b.z0+b.z1)/2);
  const player = new Player();
  player.speed = state.playerSpeed;
  player.setCapacity(state.playerCapacity);
  player.setCarrierLevel(state.upgrades.capacity);
  player.setLocomotionLevel(state.upgrades.speed);
  player.setUpgradeMilestones(state.upgrades.speed,state.upgrades.hands,state.upgrades.charm);
  markDynamic(player.char.root);
  scene.scene.add(player.char.root);
  const table = world.byId.get('k_masa_1')!;
  const dirty = world.byId.get('k_masa_2')!;
  const machine = world.byId.get('k_semaver')!;
  // Mid-session stock is ready before recording. Actual hand contacts remove
  // each product, and the normal production loop continues throughout the film.
  machine.output = 3;
  const counter = world.counters[0];
  // Real leftover dishes make the first frame readable before the wipe stage.
  dirty.dishes = 2;
  dirty.soil = dirty.cleanStartSoil = 0.98;
  dirty.cleanValue = 2;
  // The till starts empty: only deliveries shown in this film fund collection.
  counter.cash = counter.cashValue = 0;
  const initialLayout = world.stations.map(s => ({ id:s.id,x:s.x,z:s.z,rot:s.def.rot,kind:s.def.kind }));
  const fixture = world as unknown as {
    quoteOrder(c: InstanceType<typeof Customer>): void;
    startEating(c: InstanceType<typeof Customer>): void;
    guide: {root: import('three').Object3D} | null;
  };
  function guest(t: typeof table, seat: number, qty: number, served = false) {
    const i = world.customers.length;
    const c = new Customer(CUSTOMER_ARCHETYPES[i % CUSTOMER_ARCHETYPES.length], 'ad-guest-' + i);
    c.table = t; c.counter = counter; c.dineIn = true;
    c.serviceCode = t.def.serviceCode ?? '';
    c.order = new Order([{item:'cay',qty,served:0}]);
    c.patience = c.maxPatience = 65;
    t.takeSeat(seat); c.seatIndex = seat; t.seatedGuests.push(c);
    markDynamic(c.char.root);
    world.customers.push(c); world.root.add(c.char.root);
    const p = {x:0,y:0,z:0}; world.seatPoint(t,seat,p);
    c.setPosition(p.x,p.z); world.sitOnChair(c,t); c.state = 'seated';
    fixture.quoteOrder(c);
    c.showItem('cay',qty);c.showBubble(true);
    if (served) { for(let n=0;n<qty;n++)c.receiveItem('cay'); fixture.startEating(c); }
    for(let n=0;n<30;n++)c.step(1/60,world.nav);
    return c;
  }
  guest(table,0,2); guest(table,1,1);
  const point = (s: typeof table) => {const p={x:0,z:0};s.servicePoint(p);return p;};
  const cleanPoint = point(dirty), prepPoint = point(machine), servePoint = point(table), cashPoint = point(counter);
  const bin=world.byId.get('k_kova_1')!,binPoint=point(bin);
  const hirePoint = world.loc.staffHirePads.waiter;
  const mods = {spawnMult:0,valueMult:1,patienceMult:1,tipMult:1};
  let frame=0,time=0,phase=-1,phaseAt=0,task='',collected=0,badge='',badgeAt=-10,lastAction='',done=false;
  let completeAt:number|null=null;
  let path:number[]=[],waypoint=0,prepDone=false;
  const events:Array<{time:number;kind:string;data:any}>=[];
  const log=(kind:string,data:unknown)=>events.push({time:+time.toFixed(4),kind,data});
  const flash=(text:string)=>{badge=text;badgeAt=time;};
  bus.on('sfx',e=>log('sfx',e));
  bus.on('item:picked',e=>log('picked',e));
  bus.on('item:produced',e=>log('produced',e));
  bus.on('item:stocked',e=>log('stocked',e));
  bus.on('item:served',e=>{log('served',e);flash('Servis tamam!');});
  bus.on('table:cleaned',e=>{log('cleaned',e);flash('Pırıl pırıl!');});
  bus.on('counter:collected',e=>{collected+=e.amount;log('collected',e);flash('+₺'+Math.round(collected));});
  bus.on('staff:hired',e=>{
    log('hired',e);const existing=new Set(world.staff);world.syncStaff();
    for(const staff of world.staff)if(!existing.has(staff)){
      staff.char.setState('idle');
      for(let n=0;n<45;n++)staff.char.update(1/60,0,0);
    }
    flash('Ekibin büyüyor!');
  });
  bus.on('render:structure',()=>{scene.invalidateStatic();scene.invalidateShadows();});
  const move={x:0,y:0,mag:0,active:false},yaw=BALANCE.camera.yaw*Math.PI/180;
  const focus=new T.Vector3(),goal=new T.Vector3();
  let distance=17;
  function target(key:string,x:number,z:number) {
    if(task===key)return;task=key;path=[];waypoint=0;
    if(!world.nav.findPath(player.x,player.z,x,z,path))throw new Error('Çekim yolu bulunamadı: '+key);
    if(!path.length)path.push(x,z);
    log('task',{key,x,z});
  }
  function cut(next:number) {
    phase=next;phaseAt=time;completeAt=null;task='';path=[];waypoint=0;
    move.active=false;move.mag=0;move.x=move.y=0;
    // Editorial jump cuts remove walking between rooms. No inventory, work,
    // payment, customer, station, speed or map mutation occurs at a cut.
    if(next===0)player.setPosition(cleanPoint.x,cleanPoint.z);
    if(next===8)player.setPosition(binPoint.x,binPoint.z);
    if(next===1)player.setPosition(cleanPoint.x,cleanPoint.z);
    if(next===2)player.setPosition(prepPoint.x,prepPoint.z);
    if(next===3)player.setPosition(servePoint.x+1.1,servePoint.z+0.3);
    if(next===4)player.setPosition(cashPoint.x-0.8,cashPoint.z-0.1);
    if(next===5)player.setPosition(hirePoint.x+0.6,hirePoint.z+0.7);
    player.noTakeFrom=player.noDropTo=null;
    badgeAt=-10;log('cut',{phase:next});
    camera(true);
  }
  function autoInput() {
    if(phase===0)target('clear-dishes',cleanPoint.x,cleanPoint.z);
    if(phase===8)target('dispose-dishes',binPoint.x,binPoint.z);
    if(phase===1)target('clean',cleanPoint.x,cleanPoint.z);
    if(phase===2) {
      if(player.carryCount>=3)prepDone=true;
      if(!prepDone)target('prepare',prepPoint.x,prepPoint.z);
      else target('carry',prepPoint.x,prepPoint.z);
    }
    if(phase===3)target('serve',servePoint.x,servePoint.z);
    if(phase===4)target('collect',cashPoint.x,cashPoint.z);
    if(phase===5)target('hire',hirePoint.x,hirePoint.z);
    if(phase===6||phase===7)target('leave-workspace',-6.2,-7.1);
    move.x=move.y=move.mag=0;move.active=false;
    if(waypoint>=path.length/2)return;
    let dx=path[waypoint*2]-player.x,dz=path[waypoint*2+1]-player.z,d=Math.hypot(dx,dz);
    if(d<(waypoint===path.length/2-1?0.10:0.22))waypoint++;
    if(waypoint>=path.length/2)return;
    dx=path[waypoint*2]-player.x;dz=path[waypoint*2+1]-player.z;d=Math.hypot(dx,dz);
    move.x=Math.cos(yaw)*dx-Math.sin(yaw)*dz;
    move.y=-Math.sin(yaw)*dx-Math.cos(yaw)*dz;
    move.mag=Math.min(1,d*3);move.active=true;
  }
  function tick() {
    // Cuts follow game completion and its visible animation tail. Watchdogs fail
    // instead of silently producing padded or misleading footage.
    const finished=phase===0?dirty.dishes===0:
      phase===8?player.carryCount===0:
      phase===1?dirty.soil<=.001:
      phase===2?player.carryCount>=3:
      phase===3?state.stats.served>=3:
      phase===4?collected>0&&counter.cash<=.001:
      phase===5?world.staff.length>0:
      phase===6?events.some(e=>e.kind==='stocked'&&e.time>=phaseAt):false;
    if(finished&&completeAt===null)completeAt=time;
    const tail=phase===3?.65:phase===5?.45:phase===6?.5:.35;
    const nextShot:Record<number,number>={2:3,3:0,0:8,8:1,1:4,4:5,5:6,6:7};
    if(phase!==7&&completeAt!==null&&time-completeAt>=tail)cut(nextShot[phase]);
    if(phase!==7&&time-phaseAt>12)throw new Error('Action did not finish: '+phase);
    if(phase===7&&time-phaseAt>=3.2){done=true;return;}
    autoInput();state.playTime+=1/60;
    player.update(1/60,move,world.nav,world.loc.bounds);
    world.setViewFromCamera(scene.camera);world.setCameraQuat(scene.camera.quaternion);
    world.update(1/60,player,mods);
    const action=player.interacting?player.interactionKind:'';
    if(action!==lastAction){log('action',{kind:action});lastAction=action;}
    vfx.update(1/60,scene.camera.quaternion);time+=1/60;
  }
  function camera(snap=false) {
    let d=15.9;
    if(phase===0){goal.set(dirty.x+0.2,0.45,dirty.z+0.25);d=13.7;}
    else if(phase===8){goal.set(bin.x+0.7,0.5,bin.z);d=14.2;}
    else if(phase===1){goal.set(dirty.x+0.2,0.45,dirty.z+0.25);d=13.7;}
    else if(phase===2){goal.set(machine.x+0.45,0.55,machine.z+1.2);d=13.7;}
    else if(phase===3){goal.set(table.x+0.1,0.45,table.z+0.1);d=14.0;}
    else if(phase===4){goal.set(counter.x-0.1,0.55,counter.z-0.65);d=15.7;}
    else if(phase===5){goal.set(hirePoint.x+0.4,0.3,hirePoint.z-0.1);d=15.4;}
    else {
      const staff=world.staff[0];
      goal.set(staff?staff.x+0.4:-6.5,0.5,staff?staff.z:-8);d=phase===7?18.5:16.2;
    }
    const k=snap?1:1-Math.exp(-1/30*4);
    focus.lerp(goal,k);distance+=(d-distance)*k;
    // Small fixed yaw. Camera never spins around the action.
    const pitch=48*Math.PI/180,az=8*Math.PI/180;
    scene.camera.position.set(focus.x+Math.sin(az)*Math.cos(pitch)*distance,
      focus.y+Math.sin(pitch)*distance,focus.z+Math.cos(az)*Math.cos(pitch)*distance);
    scene.camera.lookAt(focus);scene.camera.updateMatrixWorld();
    scene.setFocus(focus.x,focus.z,0,player.x,player.z);
    world.focusX=focus.x;world.focusZ=focus.z;
    world.setViewFromCamera(scene.camera);world.setCameraQuat(scene.camera.quaternion);
  }
  function hideClutter() {
    if(fixture.guide)fixture.guide.root.visible=false;
    // World-space purchase signs are unnecessary except the real hiring square.
    world.root.traverse(o=>{
      if(o.name==='armRing'||o.name.startsWith('zonePad_')||o.name.startsWith('sidePurchase_'))o.visible=false;
      if(o.name.startsWith('staffHirePad:') && !(phase===5&&world.staff.length===0&&o.name==='staffHirePad:waiter'))o.visible=false;
      if(o.name.startsWith('station_')){
        const st=world.byId.get(o.name.slice(8));
        if(st?.def.kind==='machine'||st?.def.kind==='counter')
          for(const child of o.children)if(child.name!=='stationBody')child.visible=false;
      }
    });
  }
  function draw() {
    hideClutter();scene.render();
    composeGameplayFrame(ctx,canvas,{time,phase,phaseAt,badge,badgeAt,served:state.stats.served,money:state.money,hired:world.staff.length>0});
  }
  function framing() {
    const a=(phase===6||phase===7)&&world.staff.length?world.staff[0]:player;
    return {phase,check:true,head:a.char.headTop.getWorldPosition(new T.Vector3()).project(scene.camera).toArray(),
      feet:a.char.root.getWorldPosition(new T.Vector3()).project(scene.camera).toArray()};
  }
  function report() {
    return {frame,time,phase,phaseAt,done,task,stats:{...state.stats},collected,money:state.money,initialMoney:300,
      dirty:{soil:dirty.soil,dishes:dirty.dishes},events,layout:initialLayout,
      layoutUnchanged:JSON.stringify(initialLayout)===JSON.stringify(world.stations.map(s=>({id:s.id,x:s.x,z:s.z,rot:s.def.rot,kind:s.def.kind}))),
      layoutProblems:world.validateLayout(),player:{x:player.x,z:player.z,held:[...player.slots],model:player.char.root.userData.characterModel},
      staff:world.staff.map(s=>({role:s.role,x:s.x,z:s.z,job:s.job,held:s.carryCount})),
      resolution:[canvas.width,canvas.height],storage:'memory-only',concept:false,source:'src/sim/World.ts + src/world/Scene3D.ts'};
  }
  cut(2);player.angle=Math.atan2(machine.x-player.x,machine.z-player.z);
  world.update(0,null,mods);camera(true);hideClutter();
  await scene.prepareForPlay();
  // Settle the shipped idle blend before frame zero; never capture the bind pose.
  for(let n=0;n<45;n++)player.update(1/60,move,world.nav,world.loc.bounds);
  draw();
  const controller={
    stepFrame(render=true){if(done)return false;tick();if(!done)tick();camera();if(render)draw();frame++;return true;},
    draw,report,framing,png:()=>film.toDataURL('image/png').split(',')[1],
    raw:()=>canvas.toDataURL('image/png').split(',')[1],
  };
  Object.assign(window,{__campaign:controller});
  document.querySelector('#status')!.remove();
  if(!manual){let last=performance.now(),acc=0;const loop=(now:number)=>{acc+=Math.min(.2,(now-last)/1000);last=now;
    while(acc>=1/FPS&&!done){controller.stepFrame(false);acc-=1/FPS;}draw();
    if(!done)requestAnimationFrame(loop);else document.querySelector('#replay')!.removeAttribute('hidden');};requestAnimationFrame(loop);}
}
void boot().catch(error=>{console.error(error);document.querySelector('#status')!.textContent='Çekim açılamadı: '+error.message;});
