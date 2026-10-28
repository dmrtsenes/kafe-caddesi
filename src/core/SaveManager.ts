import type { GameStateSave } from '../sim/GameState';
import type { WorldSave } from '../sim/World';
import { clearStorage, mirrorStorage } from './Native';
import { validSavedState, validSavedWorlds } from './SaveValidation';

/**
 * v8 save schema, retained by 1.2.0: active table service and takeaway shelves.
 * Customers and carried items are transient; stations, cash and progress persist.
 * Earlier storage keys belonged to incompatible world layouts.
 */
export const SAVE_VERSION = 8;
export const SAVE_KEY = 'fincan-sokagi:save:v8';
/** Ana kayıt bozulursa dönülecek ikinci yuva. */
export const BACKUP_KEY = 'fincan-sokagi:save:v8:bak';
/** Hydrate edilmesi gereken anahtarlar (bkz. Native.hydrateStorage). */
export const PERSISTED_KEYS = [SAVE_KEY, BACKUP_KEY, 'fincan-sokagi:language:v1', 'fincan-sokagi:settings:v2'];

/** Önceki sürümlerden kalan, artık okunamayan kayıt anahtarları. */
const LEGACY_KEYS = [
  'fincan-sokagi:save:v7',
  'fincan-sokagi:save:v7:bak',
  'fincan-sokagi:save:v6',
  'fincan-sokagi:save:v6:bak',
  'fincan-sokagi:save:v5',
  'fincan-sokagi:save:v4',
  'sepet-sokagi:save:v3',
  'sepet-sokagi:save:v2',
  'sepet-sokagi:save',
];

/** Yedek yuvası bu aralıkla tazelenir. */
const BACKUP_INTERVAL_MS = 5 * 60 * 1000;

export interface SaveData {
  v: number;
  /** Kayıt anı (ms) */
  t: number;
  state: GameStateSave;
  worlds: Record<string, WorldSave>;
}

/**
 * Ondalıkları 3 haneye yuvarlayan JSON yazıcı.
 *
 * İstasyon ilerlemesi gibi alanlar 0.12345678901234567 olarak
 * serileşiyordu; kayıt ~12 KB'a şişiyor ve her 6 saniyede bir ana iş
 * parçacığında diske yazılıyordu. Yuvarlama boyutu belirgin düşürür,
 * oyunda hiçbir farkı yoktur.
 */
function round3(_key: string, value: unknown): unknown {
  if (typeof value === 'number' && Number.isFinite(value) && !Number.isInteger(value)) {
    return Math.round(value * 1000) / 1000;
  }
  return value;
}

function parseSave(raw: string | null): SaveData | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SaveData;
    if (typeof parsed !== 'object' || parsed === null) return null;
    if (!Number.isInteger(parsed.v) || parsed.v !== SAVE_VERSION) return null;
    if (typeof parsed.t !== 'number' || !Number.isFinite(parsed.t)) parsed.t = Date.now();
    if (!validSavedState(parsed.state)) return null;
    // A missing world dictionary can safely use newly constructed locations.
    if (parsed.worlds === undefined) parsed.worlds = {};
    if (!validSavedWorlds(parsed.worlds)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Kayıt katmanı.
 *
 * Üç kademeli dayanıklılık:
 *  1. localStorage — senkron birincil kaynak (oyun döngüsü beklemez),
 *  2. Capacitor Preferences — native aynası (işletim sistemi WebView
 *     verisini silse bile ilerleme durur, bkz. Native.hydrateStorage),
 *  3. yedek yuva — ana kayıt bozulursa 5 dakikaya kadar geri dönülür.
 * Ayrıca oyuncu Ayarlar'dan metin olarak yedek alıp geri yükleyebilir.
 */
export class SaveManager {
  private available = true;
  private lastBackup = 0;

  constructor() {
    try {
      const probe = '__fs_probe__';
      localStorage.setItem(probe, '1');
      localStorage.removeItem(probe);
      // Markete ait eski kayıt artık hiçbir işe yaramıyor; kullanıcının
      // tarayıcısında çöp bırakmamak için temizlenir.
      for (const legacy of LEGACY_KEYS) localStorage.removeItem(legacy);
    } catch {
      this.available = false;
      console.warn('[Kayıt] Yazma şu an kullanılamıyor; mevcut kayıt okunacak.');
    }
  }

  get isAvailable(): boolean {
    return this.available;
  }

  write(data: Omit<SaveData, 'v' | 't'>): boolean {
    if (!validSavedState(data.state) || !validSavedWorlds(data.worlds)) {
      console.warn('[Kayıt] Geçersiz durum yazılmadı; önceki kayıt korunuyor.');
      return false;
    }
    const now = Date.now();
    const payload: SaveData = { v: SAVE_VERSION, t: now, ...data };
    let text: string;
    try {
      text = JSON.stringify(payload, round3);
    } catch (err) {
      console.warn('[Kayıt] Serileştirilemedi:', err);
      return false;
    }
    try {
      localStorage.setItem(SAVE_KEY, text);
    } catch (err) {
      console.warn('[Kayıt] Yazılamadı:', err);
      return false;
    }
    this.available = true;
    mirrorStorage(SAVE_KEY, text);

    // Yedek yuva: ana kayıt bozulursa en fazla 5 dakika kaybedilir.
    if (now - this.lastBackup > BACKUP_INTERVAL_MS) {
      try {
        localStorage.setItem(BACKUP_KEY, text);
        this.lastBackup = now;
        mirrorStorage(BACKUP_KEY, text);
      } catch {
        /* yedek kritik değil */
      }
    }
    return true;
  }

  read(): SaveData | null {
    let main: string | null = null;
    try {
      main = localStorage.getItem(SAVE_KEY);
    } catch (err) {
      console.warn('[Kayıt] Okunamadı:', err);
    }
    const parsed = parseSave(main);
    if (parsed) return parsed;

    // Ana kayıt yok veya bozuk — yedeğe düş.
    try {
      const backup = parseSave(localStorage.getItem(BACKUP_KEY));
      if (backup) {
        console.warn('[Kayıt] Ana kayıt okunamadı, yedekten devam ediliyor.');
        return backup;
      }
    } catch {
      /* yoksay */
    }
    if (main) console.warn('[Kayıt] Kayıt bozuk, sıfırdan başlanıyor.');
    return null;
  }

  async clear(): Promise<void> {
    try {
      localStorage.removeItem(SAVE_KEY);
      localStorage.removeItem(BACKUP_KEY);
    } catch {
      /* yoksay */
    }
    await Promise.all([clearStorage(SAVE_KEY),clearStorage(BACKUP_KEY)]);
    this.lastBackup = 0;
  }

  /* ================================================================ *
   *  Oyuncunun elindeki yedek
   * ================================================================ */

  /**
   * Kaydı taşınabilir bir metne çevirir. Cihaz değiştiren ya da oyunu
   * silip yeniden kuran oyuncunun tek kurtuluş yolu — bulut kaydı için
   * sunucu gerekiyor, bu ise sıfır altyapıyla çalışır.
   */
  exportText(): string | null {
    try {
      const main = localStorage.getItem(SAVE_KEY);
      const backup = localStorage.getItem(BACKUP_KEY);
      const raw = parseSave(main) ? main : parseSave(backup) ? backup : null;
      if (!raw) return null;
      // btoa yalnızca latin1 alır; Türkçe karakterler için UTF-8'e çevir.
      const bytes = new TextEncoder().encode(raw);
      let bin = '';
      for (const b of bytes) bin += String.fromCharCode(b);
      return `FSK1:${btoa(bin)}`;
    } catch (err) {
      console.warn('[Kayıt] Dışa aktarılamadı:', err);
      return null;
    }
  }

  /** Metinden kaydı geri yükler. Başarılıysa true. */
  importText(text: string): boolean {
    try {
      const trimmed = text.trim();
      const body = trimmed.startsWith('FSK1:') ? trimmed.slice(5) : trimmed;
      const bin = atob(body);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const raw = new TextDecoder().decode(bytes);
      const restored = parseSave(raw);
      if (!restored) return false;
      const valid = JSON.stringify(restored, round3);
      const previousBackup = localStorage.getItem(BACKUP_KEY);
      // Prepare the matching recovery slot first. If the primary write fails,
      // keep the current game and restore its previous backup.
      localStorage.setItem(BACKUP_KEY, valid);
      try {
        localStorage.setItem(SAVE_KEY, valid);
      } catch (error) {
        if (previousBackup === null) localStorage.removeItem(BACKUP_KEY);
        else localStorage.setItem(BACKUP_KEY, previousBackup);
        throw error;
      }
      void mirrorStorage(BACKUP_KEY, valid);
      void mirrorStorage(SAVE_KEY, valid);
      this.lastBackup = Date.now();
      this.available = true;
      return true;
    } catch {
      return false;
    }
  }
}
