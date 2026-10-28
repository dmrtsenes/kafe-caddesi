import * as THREE from 'three';

/**
 * Karakter sistemi — ortak sözleşme.
 *
 * YÖN KURALI: Tüm karakterler **+Z**'ye bakacak şekilde kurulur.
 * Actor `rotation.y = atan2(dx, dz)` kullandığı için bu doğrudan uyumludur.
 * Ayaklar y=0'dadır; sahibi yalnızca `root.position` ve `root.rotation.y` yazar.
 */

export type CharRole =
  | 'player'
  | 'runner'
  | 'waiter'
  | 'cashier'
  | 'barista'
  | 'busser'
  | 'customer'
  | 'dasher'
  | 'investor';
/**
 * `sit` — idle gibi **tutulan** bir durumdur (cheer/angry gibi tek atımlık değil):
 * sahibi oturduğu her karede `setState('sit')`, kalkarken `setState('idle')` yollar.
 * Kalça rig orijininde kalır; sahibi `root.position.y`'yi oturma yüksekliğine ayarlar.
 */
export type AnimState = 'idle' | 'walk' | 'work' | 'cheer' | 'angry' | 'panic' | 'sit';
export type WorkKind = 'generic' | 'reach' | 'wipe' | 'mop' | 'cash' | 'machine';
export type CarryMode = 'none' | 'tray' | 'cart';

export interface CharacterOpts {
  /** Müşteri arketipi 0..8, ya da personel üye indeksi. */
  variant?: number;
  /** Genel boy çarpanı, varsayılan 1. */
  scale?: number;
  /** Gövde genişlik çarpanı, varsayılan 1. */
  girth?: number;
  /** Rastgele renk varyasyonu için tohum. */
  seed?: number;
  /** Personel seviyesi 0..8 → omuzda rütbe çizgisi. */
  level?: number;
  /**
   * ÜNİFORMA KOZMETİĞİ (yalnız personel rolleri). `data/cosmetics.ts`
   * içindeki `UniformSkin.id`. Verilmezse şubenin klasik renkleri kullanılır.
   * Tamamen görseldir; hiçbir istatistiğe dokunmaz.
   */
  uniform?: string;
}

export interface CharacterHandle {
  /** Sahneye eklenir. Sahibi position ve rotation.y'yi kontrol eder. Ayakları y=0'da. */
  root: THREE.Group;
  /** Taşınan kasa yığınının bağlandığı nokta (göğüs önü, kollar arası). */
  carryAnchor: THREE.Object3D;
  /** Tek bir eşyanın tutulduğu sağ el noktası. */
  handAnchor: THREE.Object3D;
  /** Kafanın hemen üstü — istek balonu / sabır göstergesi buraya bağlanır. */
  headTop: THREE.Object3D;
  /** Toplam boy (dünya birimi). */
  height: number;
  setState(s: AnimState): void;
  getState(): AnimState;
  /** Yapılan işin kol/gövde dilini seçer; bütün işler aynı poza düşmez. */
  setWorkKind(kind: WorkKind): void;
  /** Ayrık el işinin 0..1 anticipation→contact→recovery fazı. */
  setWorkPhase(phase: number): void;
  /** Kaç kasa taşıdığı — duruşu ve yürüyüşü etkiler. */
  setCarryCount(n: number): void;
  /** Tepsi ile taşıma ve servis arabası itme farklı kol/gövde pozlarıdır. */
  setCarryMode(mode: CarryMode): void;
  /** Oyuncunun hız gelişimine bağlı yürüyüş → hafif koşu → koşu kademesi. */
  setLocomotionLevel(level: number): void;
  /**
   * Elde İTİLEN bir alet (süpürge) var mı ve şu an süpürüyor mu.
   * İki kolu da kabzaya kilitleyen "itme katmanı"nı açar.
   */
  setPush(on: boolean, sweeping?: boolean): void;
  /**
   * İki elin ORTA noktası, karakterin KÖKÜNE göre. Elde tutulan aletin
   * sapı buraya nişan alır: poz değişse bile sap elleri takip eder, yani
   * "el ile kabza arasında boşluk" hatası yapısal olarak oluşamaz.
   */
  handMidLocal(out: THREE.Vector3): THREE.Vector3;
  /** Kök yerel uzayında sağ el eksi sol el; yön ve el açıklığını birlikte taşır. */
  handSpanLocal(out: THREE.Vector3): THREE.Vector3;
  /** planarSpeed: dünya birimi/sn cinsinden yatay hız. Animatör idle↔walk geçişini bundan üretir. */
  /** `turnRate` (rad/sn, isteğe bağlı) — gövde viraja yatar. */
  update(dt: number, planarSpeed: number, turnRate?: number): void;
  dispose(): void;
}
