import { tr } from "../core/I18n";
import * as THREE from 'three';
import { BALANCE } from '../data/balance';
import { bus, sfx } from '../core/EventBus';
import { Rng } from '../core/Rng';
import { clamp01, dist } from '../core/MathUtils';
import type { World, EventModifiers } from './World';
import type { GameState } from './GameState';
import type { Player } from '../entities/Player';
import type { VFXSystem } from '../world/VFX';
import { createCrateMesh } from '../world/ProductMesh';
import type { ItemId } from '../data/items';
import type { StationEntity } from './Station';

export type ChaosEventId = 'rush' | 'dasher' | 'delivery' | 'breakdown' | 'influencer' | 'investor';

interface ActiveEvent {
  id: ChaosEventId;
  remaining: number;
  duration: number;
}

interface DeliveryCrate {
  mesh: THREE.Group;
  x: number;
  z: number;
  taken: boolean;
  bob: number;
}

const EVENT_INFO: Record<ChaosEventId, { title: string; desc: string; glyph: string; tone: 'good' | 'bad' | 'info' }> = {
  // Metin kodla eşit: rushValueMult 1,5 → %50 (eskiden %40 yazıyordu).
  rush: { title: tr("YOĞUN SAAT!"), desc: tr("Müşteri akını başladı — hesaplar %50 daha değerli."), glyph: '🔥', tone: 'good' },
  dasher: { title: tr("KAÇAK MÜŞTERİ!"), desc: tr("Kapüşonlu tip vitrini boşaltıyor. Üstüne koş, yakala!"), glyph: '🕵️', tone: 'bad' },
  delivery: { title: tr("TEDARİK SÜRPRİZİ"), desc: tr("Kapıya kasa bırakıldı. Süre dolmadan topla!"), glyph: '📦', tone: 'good' },
  breakdown: { title: tr("MAKİNE ARIZASI"), desc: tr("Bir istasyon durdu. Yanına git, tamir et."), glyph: '🔧', tone: 'bad' },
  influencer: {
    title: tr("SOSYAL MEDYA FENOMENİ"),
    desc: tr("Siparişini zamanında yetiştir — itibar patlar, yetiştiremezsen çakılır."),
    glyph: '⭐',
    tone: 'info',
  },
  investor: {
    title: tr("ZENGİN YATIRIMCI"),
    desc: tr("VIP yatırımcı kafeni ziyaret etti! Cömert bir hibe teklifi var."),
    glyph: '💰',
    tone: 'good',
  },
};

/** Arcade kaos sistemi: yoğun saat, hırsız, kargo, arıza. */
export class EventManager {
  readonly mods: EventModifiers = { spawnMult: 1, valueMult: 1, patienceMult: 1, tipMult: 1 };

  private state: GameState;
  private rng = new Rng((Math.random() * 0xffffffff) >>> 0);
  private active = new Map<ChaosEventId, ActiveEvent>();
  private timers: Record<ChaosEventId, number>;
  private elapsed = 0;

  private crates: DeliveryCrate[] = [];
  private crateRoot = new THREE.Group();
  private crateReward = 0;

  private brokenStation: StationEntity | null = null;
  private repairProgress = 0;

  constructor(state: GameState) {
    this.state = state;
    const e = BALANCE.events;
    this.timers = {
      rush: this.rng.range(e.rushInterval[0], e.rushInterval[1]) * 0.55,
      dasher: this.rng.range(e.dasherInterval[0], e.dasherInterval[1]),
      delivery: this.rng.range(e.deliveryInterval[0], e.deliveryInterval[1]) * 0.7,
      breakdown: this.rng.range(e.breakdownInterval[0], e.breakdownInterval[1]),
      influencer: this.rng.range(e.influencerInterval[0], e.influencerInterval[1]),
      investor: this.rng.range(e.investorInterval[0], e.investorInterval[1]),
    };
  }

  isActive(id: ChaosEventId): boolean {
    return this.active.has(id);
  }

  update(dt: number, world: World, player: Player | null, vfx: VFXSystem | null): void {
    this.elapsed += dt;
    this.mods.spawnMult = 1;
    this.mods.valueMult = 1;
    this.mods.patienceMult = 1;
    this.mods.tipMult = 1;
    if (this.breakdownShield > 0) this.breakdownShield -= dt;

    if (this.crateRoot.parent !== world.root) {
      this.crateRoot.removeFromParent();
      world.root.add(this.crateRoot);
    }

    // Aktif olayları ilerlet
    for (const [id, ev] of [...this.active]) {
      ev.remaining -= dt;
      if (id === 'rush') {
        this.mods.spawnMult = BALANCE.events.rushSpawnMult;
        this.mods.valueMult = BALANCE.events.rushValueMult;
      }
      if (ev.remaining <= 0) this.endEvent(id, world);
    }

    this.updateDelivery(dt, player, vfx);
    this.updateBreakdown(dt, player, vfx);
    this.updateDasher(world);
    this.updateInvestor(world);

    if (this.elapsed < BALANCE.events.warmup) return;

    for (const id of ['rush', 'dasher', 'delivery', 'breakdown', 'influencer', 'investor'] as ChaosEventId[]) {
      if (this.active.has(id)) continue;
      this.timers[id] -= dt;
      if (this.timers[id] > 0) continue;
      this.resetTimer(id);
      if (this.canTrigger(id, world)) this.startEvent(id, world, player, vfx);
    }
  }

  private canTrigger(id: ChaosEventId, world: World): boolean {
    switch (id) {
      case 'rush':
        return world.openMachines().some((s) => s.output > 0);
      /**
       * Hırsız BANKODAN çalar, makineden değil. Koşul makine çıkışına
       * bakıyordu: oyuncu makineden doğrudan masaya taşıyorsa (önerilen
       * oynanış, banko boş) olay yine doğuyor, "vitrini boşaltıyor" banner'ı
       * yalan söylüyor, hırsız boş rafa yürüyüp saniyeler içinde kaçıyor ve
       * yetişilemezse oyuncunun elinde olmayan −3 itibar kesiliyordu —
       * "asla cezalandırma" ilkesinin ihlali.
       */
      case 'dasher':
        return world.openPickups().some((s) => s.output >= 3) && !world.hasDasher();
      case 'delivery':
        return true;
      case 'breakdown':
        return (
          this.breakdownShield <= 0 &&
          world.zoneUnlocked(BALANCE.events.breakdownAfterZone) &&
          world.machines.some((p) => !p.locked && p.def.kind === 'machine')
        );
      case 'influencer':
        // Fenomen ancak oturulacak masa ve dolu vitrin varken gelir; aksi
        // hâlde olay oyuncunun elinde olmayan bir sebeple itibar yakardı.
        return (
          world.zoneUnlocked(BALANCE.events.influencerAfterZone) &&
          world.salonOpen &&
          world.openMachines().some((s) => s.output > 0)
        );
      case 'investor':
        return (
          !world.hasInvestor() &&
          world.openCounters().length > 0 &&
          world.zoneUnlocked(BALANCE.events.investorAfterZone ?? 'a1')
        );
      default:
        return false;
    }
  }

  private resetTimer(id: ChaosEventId): void {
    const e = BALANCE.events;
    const range =
      id === 'rush'
        ? e.rushInterval
        : id === 'dasher'
          ? e.dasherInterval
          : id === 'delivery'
            ? e.deliveryInterval
            : id === 'influencer'
              ? e.influencerInterval
              : id === 'investor'
                ? e.investorInterval
                : e.breakdownInterval;
    this.timers[id] = this.rng.range(range[0], range[1]);
  }

  private startEvent(id: ChaosEventId, world: World, player: Player | null, vfx: VFXSystem | null): void {
    const info = EVENT_INFO[id];
    let duration = 20;

    switch (id) {
      case 'rush':
        duration = BALANCE.events.rushDuration;
        break;
      case 'dasher': {
        const t = world.spawnCustomer('dasher');
        if (!t) return;
        duration = 30;
        bus.emit('dasher:spawn', {});
        break;
      }
      case 'delivery':
        duration = BALANCE.events.deliveryDuration;
        this.spawnCrates(world, vfx);
        break;
      case 'breakdown': {
        const candidates = world.machines.filter((p) => !p.locked && p.def.kind === 'machine' && !p.broken);
        if (candidates.length === 0) return;
        const st = candidates[this.rng.int(0, candidates.length - 1)];
        st.broken = true;
        this.brokenStation = st;
        this.repairProgress = 0;
        duration = 75;
        break;
      }
      case 'influencer': {
        const c = world.spawnCustomer('influencer');
        if (!c) return;
        duration = BALANCE.events.influencerDuration;
        break;
      }
      case 'investor': {
        const inv = world.spawnCustomer('investor');
        if (!inv) return;
        duration = BALANCE.events.investorDuration;
        bus.emit('investor:spawn', { x: inv.x, z: inv.z });
        break;
      }
    }

    this.active.set(id, { id, remaining: duration, duration });
    bus.emit('event:start', {
      id,
      title: info.title,
      desc: info.desc,
      duration,
      glyph: info.glyph,
    });
    sfx('event_alarm', 0.7);
    if (player) void player;
  }

  endEvent(id: ChaosEventId, world: World): void {
    this.active.delete(id);
    bus.emit('event:end', { id });
    if (id === 'delivery') this.clearCrates();
    if (id === 'breakdown' && this.brokenStation) {
      this.brokenStation.broken = false;
      this.brokenStation = null;
    }
    if (id === 'investor') {
      world.dismissInvestor();
    }
    void world;
  }

  private updateInvestor(world: World): void {
    if (!this.active.has('investor')) return;
    if (!world.hasInvestor()) {
      const ev = this.active.get('investor');
      if (ev) ev.remaining = Math.min(ev.remaining, 0.05);
    }
  }

  /* ---------------- kargo ---------------- */

  private spawnCrates(world: World, vfx: VFXSystem | null): void {
    this.clearCrates();
    const door = world.loc.door;
    const n = BALANCE.events.deliveryCrates;
    const displays = world.openMachines();
    const income = Math.max(200, world.estimateIncomePerSecond() * 26);
    this.crateReward = income / n;

    for (let i = 0; i < n; i++) {
      const item: ItemId = displays.length > 0 ? displays[i % displays.length].def.item! : 'cay';
      const mesh = createCrateMesh(item);
      const a = (i / n) * Math.PI * 2;
      const rad = 1.5 + (i % 2) * 0.9;
      const x = door.x - 2.2 + Math.cos(a) * rad;
      const z = door.z - 2.6 + Math.sin(a) * rad * 0.6;
      mesh.position.set(x, 0, z);
      mesh.rotation.y = this.rng.range(0, Math.PI * 2);
      this.crateRoot.add(mesh);
      this.crates.push({ mesh, x, z, taken: false, bob: this.rng.range(0, 6.28) });
      vfx?.puff(x, 0.4, z, 0xd8b98a, 5);
    }
  }

  private updateDelivery(dt: number, player: Player | null, vfx: VFXSystem | null): void {
    if (this.crates.length === 0) return;
    let remaining = 0;
    for (const c of this.crates) {
      if (c.taken) continue;
      remaining++;
      c.bob += dt * 3;
      c.mesh.position.y = Math.sin(c.bob) * 0.06 + 0.06;
      c.mesh.rotation.y += dt * 0.5;
      if (player && dist(player.x, player.z, c.x, c.z) < 1.5) {
        c.taken = true;
        c.mesh.visible = false;
        this.state.grant(this.crateReward, c.x, c.z, 1.2);
        vfx?.coinBurst(c.x, 1.0, c.z, 5);
        vfx?.ring(c.x, 0.15, c.z, 0xffc84a, 1.8);
        sfx('coin', 0.7);
        remaining--;
      }
    }
    if (remaining === 0) {
      const ev = this.active.get('delivery');
      if (ev) ev.remaining = Math.min(ev.remaining, 0.05);
    }
  }

  private clearCrates(): void {
    for (const c of this.crates) c.mesh.removeFromParent();
    this.crates.length = 0;
  }

  /* ---------------- arıza ---------------- */

  private updateBreakdown(dt: number, player: Player | null, vfx: VFXSystem | null): void {
    const st = this.brokenStation;
    if (!st) return;
    if (!player) return;
    if (dist(player.x, player.z, st.x, st.z) > BALANCE.player.interactRadius + 0.5) {
      this.repairProgress = Math.max(0, this.repairProgress - dt * 0.6);
      return;
    }
    player.interacting = true;
    this.repairProgress += dt;
    if (this.repairProgress % 0.35 < dt) {
      vfx?.sparkle(st.x + this.rng.range(-0.6, 0.6), 1.4, st.z + this.rng.range(-0.4, 0.4), 0xffc84a);
      sfx('repair', 0.4);
    }
    if (this.repairProgress >= BALANCE.events.breakdownRepairTime) {
      st.broken = false;
      this.brokenStation = null;
      this.repairProgress = 0;
      vfx?.ring(st.x, 0.2, st.z, 0x4fb59a, 2.4);
      bus.emit('station:repaired', { stationId: st.id });
      bus.emit('toast', { text: tr("{0} tamir edildi!", st.def.name), glyph: '🔧', tone: 'good' });
      const ev = this.active.get('breakdown');
      if (ev) ev.remaining = 0.05;
      sfx('goal', 0.6);
    }
  }

  get repairRatio(): number {
    return clamp01(this.repairProgress / BALANCE.events.breakdownRepairTime);
  }

  /* ---------------- v5.1: arıza sigortası (reklam ödülü) ---------------- */

  /** Kalan bağışıklık süresi (sn) — bu süre boyunca yeni arıza doğmaz. */
  private breakdownShield = 0;

  /** Aktif arızayı anında bitirir; `true` = gerçekten bir şey tamir edildi. */
  fixBreakdown(): boolean {
    if (!this.brokenStation) return false;
    const st = this.brokenStation;
    st.broken = false;
    this.brokenStation = null;
    this.repairProgress = 0;
    bus.emit('station:repaired', { stationId: st.id });
    const ev = this.active.get('breakdown');
    if (ev) ev.remaining = 0.05;
    return true;
  }

  /** Arıza bağışıklığı başlat (repair_shield reklam ödülü). */
  setBreakdownShield(seconds: number): void {
    this.breakdownShield = Math.max(this.breakdownShield, seconds);
  }

  get breakdownShieldLeft(): number {
    return Math.max(0, this.breakdownShield);
  }

  /* ---------------- hırsız ---------------- */

  private updateDasher(world: World): void {
    if (!this.active.has('dasher')) return;
    if (!world.hasDasher()) {
      const ev = this.active.get('dasher');
      if (ev) ev.remaining = Math.min(ev.remaining, 0.05);
    }
  }

  activeBanners(): { id: string; remaining: number; duration: number }[] {
    BANNER_SCRATCH.length = 0;
    for (const ev of this.active.values()) {
      BANNER_SCRATCH.push({ id: ev.id, remaining: ev.remaining, duration: ev.duration });
    }
    return BANNER_SCRATCH;
  }

  info(id: ChaosEventId) {
    return EVENT_INFO[id];
  }

  reset(): void {
    for (const id of [...this.active.keys()]) {
      this.active.delete(id);
      bus.emit('event:end', { id });
    }
    this.clearCrates();
    if (this.brokenStation) {
      this.brokenStation.broken = false;
      this.brokenStation = null;
    }
    this.elapsed = 0;
  }

  dispose(): void {
    this.clearCrates();
    this.crateRoot.removeFromParent();
  }
}

const BANNER_SCRATCH: { id: string; remaining: number; duration: number }[] = [];
