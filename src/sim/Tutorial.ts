import { tr } from '../core/I18n';
import type { GameState } from './GameState';
import type { World } from './World';
import type { Player } from '../entities/Player';
import { bus, sfx } from '../core/EventBus';

export interface TutorialStepDef {
  text: string;
  /**
   * İşaretçinin gösterileceği nokta (varsa). `null` dönmek oku KAPATIR ve
   * normal yönlendirme devralır — oyuncunun şu an yapamayacağı bir şeyi
   * göstermemek için (bkz. "MASAYI AÇ" adımındaki para kontrolü).
   */
  pointAt?: (w: World, state: GameState, player: Player) => { x: number; z: number } | null;
  /** 3D ok üzerindeki fiil plakası — "ÇAYI AL" gibi. pointAt varsa zorunlu say. */
  verb?: string | ((w: World, state: GameState, player: Player) => string);
  /** Adım tamamlandı mı */
  done: (ctx: TutorialCtx) => boolean;
}

export interface TutorialCtx {
  state: GameState;
  world: World;
  player: Player;
  movedDistance: number;
  saleCount: number;
  servedCount: number;
  collectedMoney: boolean;
  cleanedTable: boolean;
  /** Bu adımda geçen süre (sn) — kilitlenme kaçış kapıları için. */
  stepTime: number;
}

function servicePoint(st: World['stations'][number], w?: World, p?: Player): { x: number; z: number } {
  const point = { x: 0, z: 0 };
  st.servicePoint(point);
  if (w && p && (st.def.kind === 'table' || st.def.kind === 'bin') && Math.hypot(p.x - st.x, p.z - st.z) < 4) {
    const edge = { x: 0, z: 0 };
    st.playerPoint(p.x, p.z, edge);
    if (!w.nav.solidBlocked(edge.x, edge.z, .32) && w.nav.interactionLineClear(p.x, p.z, edge.x, edge.z)) return edge;
  }
  return point;
}
function station(w: World, id: string) {
  const st = w.byId.get(id);
  return st && !st.locked ? servicePoint(st) : null;
}

/** Read at display time for initial movement guidance. */
export function movementHint(): string {
  return tr('Ekrana bas ve sürükle.');
}

/** Aktif-idle çekirdeği: sipariş → hazırla → masaya servis → kasa → temizlik → büyütme. */
export const TUTORIAL_STEPS: TutorialStepDef[] = [
  {
    text: 'Ekrana bas ve sürükle.',
    pointAt: (w) => station(w, 'k_tezgah_1'),
    verb: 'KASAYA YÜRÜ',
    done: (c) => c.movedDistance > 3,
  },
  {
    text: 'Kasanın arkasında dur ve siparişi al.',
    pointAt: (w) => station(w, 'k_tezgah_1'),
    verb: 'SİPARİŞ AL',
    done: (c) => c.saleCount > 0 || c.world.pendingOrders > 0,
  },
  {
    text: 'Semaverin yanına git; kısa süre durunca çayı alırsın.',
    pointAt: (w) => station(w, 'k_semaver'),
    verb: 'ÇAYI AL',
    done: (c) => c.player.hasItem('cay'),
  },
  {
    text: 'Sipariş balonu olan masaya çayı götür.',
    pointAt: (w, _state, player) => {
      if (!player.hasItem('cay')) return station(w, 'k_semaver');
      for (const t of w.tables) if (!t.locked && t.guestNeeds('cay')) return servicePoint(t, w, player);
      return null;
    },
    verb: (_w, _state, p) => (p.hasItem('cay') ? 'MASAYA SERVİS' : 'ÇAYI AL'),
    done: (c) => c.servedCount > 0,
  },
  {
    text: 'Kasanın yanına dön ve paranı topla.',
    pointAt: (w) => {
      for (const co of w.counters) if (!co.locked && co.cash > 0) return servicePoint(co);
      return station(w, 'k_tezgah_1');
    },
    verb: 'PARAYI TOPLA',
    done: (c) => c.collectedMoney,
  },
  {
    text: 'Bulaşığı al, kovaya bırak; boş elle masayı sil.',
    pointAt: (w, _st, p) => {
      if (p.hasItem('bulasik')) {
        for (const b of w.bins) if (!b.locked) return servicePoint(b, w, p);
      }
      if (p.carryCount > 0) {
        for (const item of p.distinctItems()) {
          const target = w.bestConsumer(item, p.x, p.z, 'player');
          if (target) return servicePoint(target, w, p);
        }
        // No valid delivery: allow the regular guide to find useful work.
        // Valuable products must never be discarded just to finish a lesson.
        return null;
      }
      for (const t of w.tables) {
        if (!t.locked && !t.seatTaken.some(Boolean) && (t.dishes > 0 || t.soil > 0.02)) return servicePoint(t, w, p);
      }
      return null;
    },
    verb: (_w, _state, p) =>
      p.hasItem('bulasik') ? 'KOVAYA AT' : p.carryCount > 0 ? 'RAFA KOY' : 'MASAYI HAZIRLA',
    done: (c) => c.cleanedTable,
  },
  {
    text: 'İkinci masayı veya kahve bölümünü seç. Karede durarak ödeme yap.',
    pointAt: (w) => {
      const z = w.loc?.zones.find((x) => x.id === 't1' && !w.zoneUnlocked('t1'))
        ?? w.loc?.zones.find((x) => x.id === 'a3' && !w.zoneUnlocked('a3'));
      return z ? { x: z.padX, z: z.padZ } : null;
    },
    verb: 'BÖLÜMÜ AÇ',
    done: (c) => expansionStarted(c),
  },
];

/** Son ders, karede gerçek bir ödeme ya da a1 dışındaki bir açılımla biter.
 *  Kimse kareyi bulamazsa yaklaşık 20 sn sonra ders kapanır. */
function expansionStarted(c: TutorialCtx): boolean {
  if (c.stepTime >= 20) return true;
  const zones = c.world.loc?.zones;
  if (!zones) return false;
  for (const zone of zones) {
    if (zone.id !== 'a1' && c.world.zoneUnlocked(zone.id)) return true;
    if (!c.world.zoneUnlocked(zone.id) && c.world.padPaid(zone.id) > 0) return true;
  }
  return false;
}

/**
 * Öğretici adım sayısı. `state.tutorialStep >= TUTORIAL_STEP_COUNT` ise
 * öğretici bitmiştir. World bunu ek işletmelerin ve açılım pedlerinin
 * görünürlüğü için okur. Süpürge bu kapıya bağlı değildir.
 */
export const TUTORIAL_STEP_COUNT = TUTORIAL_STEPS.length;

/** Basit, atlanabilir ilk deneyim akışı. */
export class Tutorial {
  private state: GameState;
  private movedDistance = 0;
  private saleCount = 0;
  private servedCount = 0;
  private collectedMoney = false;
  private cleanedTable = false;
  private stepTime = 0;
  private lastX: number | null = null;
  private lastZ: number | null = null;
  private unsubs: (() => void)[] = [];

  /** İşaretçinin dünya konumu (yoksa null) */
  pointerTarget: { x: number; z: number } | null = null;
  /** İşaretçinin fiil plakası — 3D okun üstünde yazar. */
  pointerVerb: string | null = null;

  constructor(state: GameState) {
    this.state = state;
    this.unsubs.push(
      bus.on('table:cleaned', () => {
        this.cleanedTable = true;
      }),
      bus.on('sale:done', () => {
        this.saleCount++;
      }),
      bus.on('order:placed', () => {
        this.saleCount++;
      }),
      bus.on('item:served', () => {
        this.servedCount++;
      }),
      // Yalnız TEZGÂHTAN toplama sayılır; leke/bulaşık ödülü değil.
      bus.on('counter:collected', () => {
        this.collectedMoney = true;
      }),
    );
  }

  /** Customers and carried items are transient; resume at a usable saved task. */
  resume(world: World): void {
    const step = this.state.tutorialStep;
    if (step < 2 || step >= 6) return;
    if (step === 4 && world.counters.some((c) => !c.locked && c.cash > 0)) return;
    if (step === 5 && world.tables.some((t) => !t.locked && (t.dishes > 0 || t.soil > 0.02))) return;
    this.state.tutorialStep = 1;
  }

  get finished(): boolean {
    return this.state.tutorialStep >= TUTORIAL_STEPS.length;
  }

  get step(): number {
    return this.state.tutorialStep;
  }

  get total(): number {
    return TUTORIAL_STEPS.length;
  }

  get currentText(): string | null {
    if (this.finished) return null;
    return this.state.tutorialStep === 0 ? movementHint() : tr(TUTORIAL_STEPS[this.state.tutorialStep].text);
  }

  skip(): void {
    this.state.tutorialStep = TUTORIAL_STEPS.length;
    this.pointerTarget = null;
    this.pointerVerb = null;
    bus.emit('tutorial:step', { index: this.state.tutorialStep, skipped: true, complete: true });
  }

  update(dt: number, world: World, player: Player): void {
    if (this.finished) {
      this.pointerTarget = null;
      this.pointerVerb = null;
      return;
    }

    if (player.hasVacuum) {
      this.pointerTarget = null;
      this.pointerVerb = null;
      this.lastX = player.x; this.lastZ = player.z;
      return;
    }

    if (this.lastX !== null && this.lastZ !== null) {
      const moved = Math.hypot(player.x - this.lastX, player.z - this.lastZ);
      // Spawn, restored positions and branch teleports are not control input.
      if (moved <= Math.max(0.5, dt * 20)) this.movedDistance += moved;
    }
    this.lastX = player.x;
    this.lastZ = player.z;

    const def = TUTORIAL_STEPS[this.state.tutorialStep];
    this.pointerTarget = def.pointAt?.(world, this.state, player) ?? null;
    const rawVerb =
      typeof def.verb === 'function' ? def.verb(world, this.state, player) : (def.verb ?? null);
    this.pointerVerb = rawVerb ? tr(rawVerb) : null;
    this.stepTime += dt;

    const ctx: TutorialCtx = {
      state: this.state,
      world,
      player,
      movedDistance: this.movedDistance,
      saleCount: this.saleCount,
      servedCount: this.servedCount,
      collectedMoney: this.collectedMoney,
      cleanedTable: this.cleanedTable,
      stepTime: this.stepTime,
    };
    if (def.done(ctx)) this.advance();
  }

  private advance(): void {
    this.state.tutorialStep++;
    this.stepTime = 0;
    sfx('goal', 0.4);
    bus.emit('tutorial:step', { index: this.state.tutorialStep, complete: this.finished });
  }

  dispose(): void {
    for (const u of this.unsubs) u();
    this.unsubs.length = 0;
  }
}
