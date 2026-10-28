/** Adaptive visual budgets. Simulation capacity never changes with device speed. */
import { fpsSampleIsBad, fpsSampleIsGood, playFps } from "./framePolicy.ts";
import { thermalBudgetLevel } from './thermal';

export type QualityTier = "high" | "medium" | "low";

export interface QualityDeviceProfile {
  mobile: boolean;
  native: boolean;
}

/** Maximum 3D pixel ratio; active tier and pixel budget may reduce it. */
export const DPR_CAP = 2.0;

/**
 * Mobil cihazlarda gölge anahtarı. `false` yapılırsa telefon/tablette güneş
 * gölgesi tamamen kapanır (gölge haritası zaten dondurulmuş olduğundan
 * kazanç yalnızca fragment tarafındaki gölge örneklemesidir).
 */
export const MOBILE_SHADOWS = true;

/** Mobilde gölge haritası bu boyutu aşmaz (1024² ≈ 4 MB depth RT). */
export const MOBILE_SHADOW_MAP_MAX = 1024;

/** Doku anizotropi tavanı: eğik zeminlerde 16x örnekleme entegre GPU'da pahalıdır. */
export const ANISOTROPY_CAP_DESKTOP = 4;
export const ANISOTROPY_CAP_MOBILE = 2;

export interface TierSettings {
  /** Karakterler sade LOD'da daha az parça ile kurulur — kazanç mesh sayısı değil vertex sayısı ve doğum maliyeti (bkz. TIERS notu). */
  charLod: boolean;
  /** Aynı anda dükkândaki simülasyon müşteri tavanı. */
  maxCustomers: number;
  /** Aynı anda görünür müşteri tavanı. */
  customerVisualCap: number;
  shadows: boolean;
  shadowMapSize: number;
  /** Gerçek cihaz piksel oranı tavanı; ekonomi ve sahne içeriğini değiştirmez. */
  dprCap: number;
  pixelBudget: number;
  targetFps: 30 | 60;
  fxaa: boolean;
  outline: boolean;
}

export interface QualitySettings extends TierSettings {
  tier: QualityTier;
  /** Isı merdiveni kademesi 0..5 — bkz. evaluateHeat. */
  heatLevel: number;
  /** Merdiven kendi kendine inip çıkabilir mi (Ayarlar'daki "Otomatik"). */
  auto: boolean;
}

/** Device budgets reduce pixel and shadow work, preserving characters and simulation capacity. */
export const TIER_SETTINGS: Record<QualityTier, TierSettings> = {
  high: {
    charLod: false,
    maxCustomers: 26,
    customerVisualCap: 24,
    shadows: true,
    shadowMapSize: 1024,
    dprCap: 2.0,
    pixelBudget: 2_200_000,
    targetFps: 60,
    fxaa: false,
    outline: false,
  },
  medium: {
    charLod: false,
    maxCustomers: 26,
    customerVisualCap: 16,
    shadows: true,
    shadowMapSize: 1024,
    dprCap: 1.5,
    pixelBudget: 1_350_000,
    targetFps: 60,
    fxaa: false,
    outline: false,
  },
  low: {
    charLod: false,
    maxCustomers: 26,
    customerVisualCap: 10,
    shadows: false,
    shadowMapSize: 0,
    dprCap: 1.35,
    pixelBudget: 750_000,
    targetFps: 60,
    fxaa: false,
    outline: false,
  },
};

const TIERS = TIER_SETTINGS;

/**
 * ETKİN ayarlar: taban kademe ⊕ ısı. Alanlar her değişimde TABANDAN
 * yeniden türetilir (birikimli mutasyon sürüklenmesi yok) — merdiven
 * inince etkiler aynen geri alınır.
 */
export const QUALITY: QualitySettings = {
  tier: "high",
  heatLevel: 0,
  auto: true,
  ...TIER_SETTINGS.high,
};

/** Taban kademe — QUALITY etkin (ısı bindirilmiş) değerleri taşıdığı için ayrı tutulur. */
let baseTier: QualityTier = "high";

export type HeatListener = (level: number) => void;

const listeners = new Set<HeatListener>();

/**
 * Etkin ayarlar her değiştiğinde çağrılır — kaynak kademe de olabilir ısı
 * da. Dinleyici (Game) `heatSettings()`'i okuyup Scene3D'ye uygular.
 * Kare tavanı `targetFps()` ile seçilir.
 */
export function onHeatChange(fn: HeatListener): () => void {
  // Each subscription owns its registration, even when callbacks are shared.
  const listener: HeatListener = level => fn(level);
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Apply reversible pressure reductions from the base tier; never change the economy. */
export function composeQuality(tier: QualityTier, heat: number): TierSettings {
  const out = { ...TIER_SETTINGS[tier] };
  const level = Number.isFinite(heat) ? Math.max(0,Math.min(5,Math.floor(heat))) : 0;
  // Preserve label sharpness under light/moderate pressure. Image reductions
  // begin at severe pressure; the automatic frame budget responds first.
  const scale = [1,1,1,.85,.7,.6][level];
  out.dprCap *= Math.sqrt(scale);
  out.pixelBudget = Math.floor(out.pixelBudget * scale);
  if(level>=1 && out.shadowMapSize>0)out.shadowMapSize=Math.min(out.shadowMapSize,1024);
  if(level>=3 && out.shadowMapSize>0)out.shadowMapSize=Math.min(out.shadowMapSize,512);
  if(level>=4)out.shadows=false;
  return out;
}

export interface FpsTargetInput {
  native: boolean;
  mobile?: boolean;
  heat: number;
  tier: QualityTier;
  /** Kullanıcının ayarlardan seçtiği kare hızı; verilmezse cihaz varsayılanı. */
  preference?: 30 | 45 | 60;
}

/**
 * Oyun sırasında kullanılacak kare tavanı.
 *
 * Otomatik hedef her kademede 60'tır; düşük kademe ilk sürekli kare kaybında
 * (ısı 1) 30'a iner. vsync adımı
 * 90 Hz'de 45'e inebilir, 60 Hz ve 120 Hz'de 60 kalır.
 * Kullanıcı Ayarlar panelinden açıkça 60 seçtiyse termal tehlike (heat >= 4)
 * olmadıkça low katmanında bile 60 FPS korunur.
 */
export function targetFps(input: FpsTargetInput): number {
  if (input.preference === 60) {
    return input.heat < 4 ? 60 : 30;
  }
  return playFps({
    native: input.native,
    mobile: input.mobile === true,
    heat: input.heat,
    tier: input.tier,
    preference: input.preference,
  });
}

/**
 * Kullanıcının açık FPS tercihini ısı ve katmanla birleştirir.
 * Kullanıcı açıkça `'60'` (veya `60`) seçtiyse `heat < 4` olduğu sürece `low`
 * katmanında bile `60` FPS döner.
 */
export function effectiveTargetFps(
  userFpsPreference: 'auto' | '30' | '45' | '60' | 30 | 45 | 60 = 'auto',
  heat: number = QUALITY.heatLevel,
  tier: QualityTier = QUALITY.tier,
): number {
  if (userFpsPreference === '60' || userFpsPreference === 60) {
    return heat < 4 ? 60 : 30;
  }
  if (userFpsPreference === '45' || userFpsPreference === 45) {
    return heat < 3 ? 45 : 30;
  }
  if (userFpsPreference === '30' || userFpsPreference === 30) {
    return 30;
  }
  if (heat >= 3 || (tier === 'low' && heat >= 1)) return 30;
  return TIER_SETTINGS[tier].targetFps;
}

/** Anlık etkin ayarlar — Scene3D.applyQuality'ye verilecek biçimde. */
export function heatSettings(): TierSettings {
  return composeQuality(baseTier, QUALITY.heatLevel);
}

/** QUALITY'yi tabandan yeniden kurar; etkin ayar değiştiyse haber verir. */
function refresh(forceNotify = false): boolean {
  const s = composeQuality(baseTier, QUALITY.heatLevel);
  const changed =
    QUALITY.tier !== baseTier ||
    QUALITY.charLod !== s.charLod ||
    QUALITY.maxCustomers !== s.maxCustomers ||
    QUALITY.customerVisualCap !== s.customerVisualCap ||
    QUALITY.shadows !== s.shadows ||
    QUALITY.shadowMapSize !== s.shadowMapSize ||
    QUALITY.dprCap !== s.dprCap ||
    QUALITY.pixelBudget !== s.pixelBudget ||
    QUALITY.targetFps !== s.targetFps ||
    QUALITY.fxaa !== s.fxaa ||
    QUALITY.outline !== s.outline;
  QUALITY.tier = baseTier;
  Object.assign(QUALITY, s);
  if (changed || forceNotify) {
    for (const fn of listeners) fn(QUALITY.heatLevel);
  }
  return changed;
}

/**
 * Taban kademeyi uygular; değiştiyse (veya `force` ise) true döner.
 *
 * `force`, değer aynıyken bile yeniden uygulanmayı ve dinleyicilerin
 * tetiklenmesini garanti eder. Eski erken-dönüş ("kademe zaten bu") tam
 * bir hataydı: açılışta saptanan kademe 'high' çıkınca Scene3D'nin geçici
 * varsayılanları (1,5 DPR tavanı) hiç düzeltilmiyordu.
 */
export function applyTier(tier: QualityTier, force = false): boolean {
  baseTier = tier;
  const changed = refresh(force);
  return changed || force;
}

/** Karakter kurulumunda okunur. */
export function charLod(): boolean {
  return QUALITY.charLod;
}

let cachedTier: QualityTier | null = null;

const LOW_GPU = /Mali-4|Mali-T|Mali-G31|Mali-G51|Mali-G52|Mali-G57|Adreno (?:\(TM\) )?(?:3|4|504|505|506|610|612|616)\b|PowerVR/i;
const CAPABLE_GPU = /apple gpu|apple m[1-9]|adreno \(tm\) [678]\d\d|adreno [678]\d\d|mali-g[789]\d/i;

/**
 * Cihaz sınıfı tahmini. Kesin değil ama ilk kademeyi seçmeye yeter;
 * oyuncu Ayarlar'dan her zaman değiştirebilir ve seçimi kalıcıdır.
 */
export function detectTier(): QualityTier {
  if (cachedTier !== null) return cachedTier;
  const nav = navigator as Navigator & { deviceMemory?: number };
  const mem = typeof nav.deviceMemory === "number" ? nav.deviceMemory : 0;
  const cores = navigator.hardwareConcurrency ?? 4;
  const ua = navigator.userAgent || "";
  const maxTouch = navigator.maxTouchPoints ?? 0;
  const mobile =
    /Android|iPhone|iPad|iPod/i.test(ua) ||
    (maxTouch > 1 && /Macintosh|Mac OS X/i.test(ua));
  const isAppleDevice = /iPhone|iPad|iPod|Macintosh|Mac OS X/i.test(ua);
  const dpr = window.devicePixelRatio || 1;
  // Küçük ekran + yüksek DPR = piksel yükü yüksek, GPU büyük ihtimalle orta.
  const pixels = window.innerWidth * window.innerHeight * dpr * dpr;

  let g = "";
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const gl = canvas.getContext("webgl", { powerPreference: "low-power" });
    if (gl) {
      try {
        const ext = gl.getExtension("WEBGL_debug_renderer_info");
        if (ext) {
          g = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || "");
        }
      } finally {
        gl.getExtension("WEBGL_lose_context")?.loseContext();
      }
    }
  } catch {
    /* yok say */
  }

  // Gerçek düşük seviye GPU'lar doğrudan 'low' alır
  if (g && LOW_GPU.test(g)) {
    cachedTier = "low";
    return cachedTier;
  }

  const isCapableGPU = CAPABLE_GPU.test(g);
  const isAppleGPU = isAppleDevice || /apple gpu|apple m[1-9]/i.test(g);

  if (!mobile) {
    cachedTier =
      (cores > 0 && cores <= 2 && !isAppleGPU && !isCapableGPU) ||
      (mem > 0 && mem <= 2)
        ? "medium"
        : "high";
    return cachedTier;
  }

  // iOS Safari / WKWebView üzerinde Apple A14–A17 Pro iPhone'larda bile
  // hardwareConcurrency 4 dönebilir; isAppleGPU veya güçlü GPU saptandıysa
  // cores <= 4 kuralıyla 'low' katmanına düşürme.
  if ((mem > 0 && mem <= 3) || (cores > 0 && cores <= 4 && !isAppleGPU && !isCapableGPU)) {
    cachedTier = "low";
    return cachedTier;
  }

  if (isAppleGPU || isCapableGPU) {
    const highEndMobile =
      /apple m[1-9]|adreno (?:\(tm\) )?[78]\d\d|mali-g[89]\d/i.test(g) ||
      (isAppleGPU && pixels <= 3_800_000) ||
      (cores >= 6 && mem >= 8 && pixels <= 3_500_000);
    cachedTier = highEndMobile ? "high" : "medium";
    return cachedTier;
  }

  if (pixels > 4_500_000 || (mem > 0 && mem <= 6)) {
    cachedTier = "medium";
    return cachedTier;
  }
  // A Full HD device with this measured profile need not start blurry.
  if (cores >= 6 && mem >= 8 && pixels <= 3_500_000) {
    cachedTier = "high";
    return cachedTier;
  }
  cachedTier = "medium";
  return cachedTier;
}

/* ================================================================ *
 *  Isı merdiveni — çalışma anı uyarlaması
 * ================================================================ */

let ewma = 8;
let cooldown = 0;
let lastHeatAt = 0;
let adaptiveHeat = 0;
let thermalFloor = 0;
let thermalTarget = 0;
let thermalRecovery = 0;
let badSeconds = 0;
let goodSeconds = 0;
/**
 * Comfortable seconds required before a step back up. A device that fails
 * again within a minute of recovering (e.g. 60 → 30 → 60 → 30) waits twice
 * as long next time, so the frame rate does not visibly flip every minute.
 */
let recoveryHold = 20;
let heatClock = 0;
let lastRecoveryAt = -Infinity;
/** Per-second "below 93%" verdicts of the low-tier 60 FPS trial (last 5 s). */
let trialBits = 0;
let trialTimer = 0;
function popcount5(bits: number): number {
  return (bits & 1) + ((bits >> 1) & 1) + ((bits >> 2) & 1) + ((bits >> 3) & 1) + ((bits >> 4) & 1);
}

/** OS severity remains a protection floor even when a visual preset is manual. */
export function setNativeThermalStatus(status:number):void {
  const level=thermalBudgetLevel(status);
  if(level===thermalTarget)return;
  thermalTarget=level;
  if(level>=thermalFloor){thermalFloor=level;thermalRecovery=0;}
  else thermalRecovery=45;
  setHeat(adaptiveHeat);
}

function setHeat(level: number): void {
  adaptiveHeat = Math.max(0, Math.min(5, level));
  const l = Math.max(adaptiveHeat,thermalFloor);
  if (l === QUALITY.heatLevel) return;
  QUALITY.heatLevel = l;
  // L4→L5 gibi alan değiştirmeyen geçişlerde de dinleyici tetiklenmeli
  // (kare hedefi heatLevel'dan okunur) — o yüzden forceNotify.
  refresh(true);
}

/** Merdivenin bulunduğu basamak (0..5) — PerfHud ve dış okuma için. */
export function currentHeat(): number {
  return QUALITY.heatLevel;
}

/**
 * Otomatik yönetim anahtarı.
 *
 * KAPATMAK otomatik performans basamaklarını temizler. Android'in
 * bildirdiği ısı koruması manuel kalite seçiminde de geçerlidir.
 * (Çağıran ardından `applyTier(t)` ile kademeyi sabitler.)
 * AÇMAK taban kademeyi cihaz tahminine döndürür; merdiven sıfırdan ölçer.
 */
export function setAutoQuality(on: boolean): void {
  if (QUALITY.auto === on) return;
  QUALITY.auto = on;
  adaptiveHeat = 0;
  QUALITY.heatLevel = thermalFloor;
  ewma = 8;
  cooldown = 0;
  lastHeatAt = 0;
  badSeconds=goodSeconds=0;
  if (on) applyTier(detectTier(), true);
  else refresh(true);
}

/**
 * Kare başına İŞ SÜRESİNİ (tick+render CPU maliyeti) ve gerçekleşen fps'i
 * izleyip ısı merdivenini bir basamak çıkarır/indirir.
 *
 * `detectTier()` tek seferlik bir TAHMİNDİR; bu döngü ölçer. Eski sistem
 * doğrudan KADEME değiştiriyordu (high→medium→low) — üç kaba basamak ya
 * hiç inmiyor ya da bir seferde çok şey kaybettiriyordu. Merdivenin altı
 * ince basamağı tek tek iner ve AYNI SIRADAN geri çıkar; taban kademe
 * ayarları hiç mutasyona uğramadığı için iniş-çıkış kayıpsızdır.
 *
 * Yük 0,75 saniye sürerse azaltılır; sonraki azaltma 6 saniye bekler.
 * Kalitenin yükselmesi 20 saniye rahat çalışma ve ardından 45 saniye
 * bekleme ister. fps ≤ 0 bilinmiyor sayılır. CPU baskısı doğrudan
 * azaltma başlatabilir; Android ısı durumu ayrıca asgari koruma koyar.
 */
export function evaluateHeat(
  workMs: number,
  fps: number,
  target = 0,
  extra?: { pressureHot?: boolean; dt?: number; samplingPaused?: boolean },
): void {
  const now = typeof performance !== "undefined" ? performance.now() : 0;
  const dt =
    extra?.dt ??
    (lastHeatAt > 0
      ? Math.min(0.25, Math.max(0, (now - lastHeatAt) / 1000))
      : 1 / 60);
  lastHeatAt = now;
  heatClock += dt;
  if (recoveryHold > 20 && adaptiveHeat === 0 && heatClock - lastRecoveryAt > 300) recoveryHold = 20;
  if(thermalRecovery>0){
    thermalRecovery-=dt;
    if(thermalRecovery<=0){thermalFloor=thermalTarget;setHeat(adaptiveHeat);}
  }
  // Menus intentionally stop simulation/rendering. Their frame count and UI
  // work are not gameplay load, while OS thermal protection stays effective.
  if (extra?.samplingPaused) {
    ewma = 8;
    badSeconds = goodSeconds = 0;
    trialBits = trialTimer = 0;
    cooldown = Math.max(0, cooldown - dt);
    return;
  }
  // Sekme arka plandan dönerken gelen dev kareler ölçümü bozmasın.
  ewma += (Math.min(workMs, 80) - ewma) * 0.05;
  if (!QUALITY.auto) return;
  if (cooldown > 0) {
    cooldown -= dt;
    return;
  }
  const fpsBad = fpsSampleIsBad(fps, target);
  // Low devices only try 60: an uneven 45-58 is worse than a steady 30. The
  // trial fails when 3 of the last 5 seconds fell below 93% of the target —
  // a single boot or GC hitch does not count, sustained unevenness does.
  const lowTrial = QUALITY.tier === 'low' && target >= 55;
  if (lowTrial) {
    trialTimer += dt;
    if (trialTimer >= 1) {
      trialTimer -= 1;
      trialBits = ((trialBits << 1) | (fps > 0 && fps < target * 0.93 ? 1 : 0)) & 31;
    }
  } else trialBits = trialTimer = 0;
  const lowTrialFailed = lowTrial && popcount5(trialBits) >= 3;
  const fpsOk = fpsSampleIsGood(fps, target) || QUALITY.heatLevel >= 5;
  const pressureHot = extra?.pressureHot === true;
  const workBudget=target>0?Math.min(22,1000/target*.7):22;
  // Work above the soft budget only counts once frames are actually being
  // missed: a phone holding its target is not degraded to 30 FPS for the
  // session. Missed frames and OS thermal pressure still step down at once.
  // The low-tier 60 trial is judged only by its 3-of-5-seconds rule above.
  const busy=lowTrial?false:fpsBad||(ewma>workBudget&&!fpsOk);
  badSeconds=busy?badSeconds+dt:Math.max(0,badSeconds-dt*2);
  goodSeconds=!busy&&fpsOk&&!pressureHot?goodSeconds+dt:0;
  if ((badSeconds >= .75 || pressureHot || lowTrialFailed) && QUALITY.heatLevel < 5) {
    if (heatClock - lastRecoveryAt < 60) recoveryHold = Math.min(320, recoveryHold * 2);
    setHeat(QUALITY.heatLevel + 1);
    ewma = 8;
    badSeconds=goodSeconds=0;
    trialBits = trialTimer = 0;
    cooldown = 6;
  } else if (ewma < 8 && goodSeconds>=recoveryHold && adaptiveHeat > 0 && !pressureHot) {
    setHeat(adaptiveHeat - 1);
    ewma = 8;
    goodSeconds=0;
    cooldown = 45;
    lastRecoveryAt = heatClock;
  }
}

/** Merdiven sayaçlarını sıfırlar (test). */
export function resetHeat(): void {
  adaptiveHeat=thermalFloor=thermalTarget=thermalRecovery=badSeconds=goodSeconds=heatClock=0;
  recoveryHold = 20;
  lastRecoveryAt = -Infinity;
  trialBits = trialTimer = 0;
  QUALITY.heatLevel = 0;
  QUALITY.auto = true;
  ewma = 8;
  cooldown = 0;
  lastHeatAt = 0;
}
