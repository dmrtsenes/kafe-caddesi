import { detectTier, type QualityTier } from './Quality';
import { mirrorStorage } from './Native';
import type { FpsPreference } from './framePolicy';

export interface SettingsData {
  muted: boolean;
  music: boolean;
  reducedMotion: boolean;
  lowQuality: boolean;
  /**
   * Ses efekti ve müzik seviyeleri, 0..1.
   *
   * Tek "sessiz" anahtarı yetmiyordu: oyuncuların çoğu müziği kapatmak
   * değil KISMAK ister. Kayıt anahtarı v2'de KALIR — `load()` alan alan
   * okuduğu için eski kayıtta bu alanlar yoksa varsayılan devreye girer;
   * sürüm yükseltmek eski kayıtları gereksiz yere ıskartaya çıkarırdı.
   */
  sfxVolume: number;
  musicVolume: number;
  /** Titreşim. Eskiden "sessiz" anahtarına bağlıydı; artık kendi ayarı var. */
  haptics: boolean;
  /** Otomatik saptanan (veya oyuncunun seçtiği) grafik kademesi. */
  quality: QualityTier;
  /**
   * Grafik "Otomatik" modu: ısı merdiveni etkin, taban kademe cihaz
   * saptamasından gelir. Oyuncu seçiciden sabit kademe seçince kapanır.
   */
  qualityAuto: boolean;
  /** Oyuncunun seçtiği kare hızı; `auto` mevcut cihaz politikasını korur. */
  fps: FpsPreference | 'auto';
}

const DEFAULTS: SettingsData = {
  muted: false,
  music: true,
  reducedMotion: false,
  lowQuality: false,
  sfxVolume: 0.85,
  musicVolume: 0.7,
  haptics: true,
  quality: 'medium',
  qualityAuto: true,
  fps: 'auto',
};

/** Ayarlar kayıttan bağımsız tutulur — sıfırlama ilerlemeyi siler, ayarları değil. */
export class Settings {
  private data: SettingsData = { ...DEFAULTS };
  /**
   * v2: v1'de `quality` alanı olmadan yazılmış eski kayıtlar vardı ve
   * ilk-açılış cihaz saptaması yalnız HİÇ kayıt yokken koşuyordu — yani
   * eski oyuncular sessizce 'high' varsayılanına düşüyordu. v2 göçü bu
   * kayıtları taşırken eksik `quality` alanını ŞİMDİ saptar.
   */
  private key = 'fincan-sokagi:settings:v2';
  private legacyKey = 'fincan-sokagi:settings:v1';
  private listeners: ((s: SettingsData, key?: keyof SettingsData) => void)[] = [];
  /** load() sırasında kayıtta geçerli bir `quality` alanı var mıydı. */
  private hadQuality = false;

  constructor() {
    const source = this.load();
    if (source === 'none') {
      // İlk açılış: cihaz sınıfına göre kademe seç; sonrasında oyuncunun
      // kaydettiği seçim geçerlidir.
      this.data.quality = detectTier();
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        this.data.reducedMotion = true;
      }
    } else if (!this.hadQuality) {
      this.data.quality = detectTier();
    }
    if (source === 'legacy') {
      // Göç tek seferlik: v2'ye hemen yazılır. v1 anahtarı yerinde kalır
      // (eski sürüme dönüş zararsız olsun); yeni yazımlar hep v2'ye gider.
      this.save();
    }
    // Oyuncunun manuel grafik tercihi kalıcıdır. Otomatik mod yalnız ilk
    // kurulumda cihazı seçer; sonraki açılışta kullanıcının kararını ezmez.
  }

  get all(): SettingsData {
    return this.data;
  }

  get<K extends keyof SettingsData>(k: K): SettingsData[K] {
    return this.data[k];
  }

  set<K extends keyof SettingsData>(k: K, v: SettingsData[K]): void {
    if (this.data[k] === v) return;
    this.data[k] = v;
    this.save();
    for (const l of this.listeners) l(this.data, k);
  }

  onChange(fn: (s: SettingsData, key?: keyof SettingsData) => void): () => void {
    this.listeners.push(fn);
    return () => {
      const i = this.listeners.indexOf(fn);
      if (i >= 0) this.listeners.splice(i, 1);
    };
  }

  /** v2'yi, yoksa v1'i okur. Bozuk kayıt = hiç kayıt yok sayılır. */
  private load(): 'v2' | 'legacy' | 'none' {
    const read = (key: string): string | null => {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    };
    for (const [key, source] of [[this.key, 'v2'], [this.legacyKey, 'legacy']] as const) {
      const raw = read(key);
      if (raw === null) continue;
      try {
        const parsed: unknown = JSON.parse(raw);
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
        const fields = parsed as Partial<SettingsData>;
        for (const k of Object.keys(DEFAULTS) as (keyof SettingsData)[]) {
          const v = fields[k];
          if (k === 'quality') {
            if (v === 'high' || v === 'medium' || v === 'low') {
              this.data.quality = v;
              this.hadQuality = true;
            }
          } else if (k === 'sfxVolume' || k === 'musicVolume') {
            if (typeof v === 'number' && v >= 0 && v <= 1) (this.data[k] as number) = v;
          } else if (k === 'fps') {
            if (v === 'auto' || v === 30 || v === 45 || v === 60) this.data.fps = v;
          } else if (typeof v === 'boolean') {
            (this.data[k] as boolean) = v;
          }
        }
        return source;
      } catch {
        // A damaged v2 value can still recover the user's valid v1 choices.
      }
    }
    return 'none';
  }

  private save(): void {
    try {
      const value=JSON.stringify(this.data);
      localStorage.setItem(this.key,value);
      void mirrorStorage(this.key,value);
    } catch {
      /* kota dolu / gizli mod */
    }
  }
}
