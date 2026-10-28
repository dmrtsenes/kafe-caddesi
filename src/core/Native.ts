import { Capacitor, registerPlugin } from '@capacitor/core';
import { attachThermalStatus, type ThermalStatusBridge } from './thermal';
import { App } from '@capacitor/app';
import { Preferences } from '@capacitor/preferences';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

/**
 * Native köprüsü.
 *
 * Oyun kodunun hiçbir yeri Capacitor'ü doğrudan import etmez; hepsi buradan
 * geçer. Sebep: web derlemesi (tarayıcıda test) ve native derleme (Play
 * Store / App Store) aynı kaynaktan çıkıyor. Capacitor eklentilerinin web
 * karşılıkları var ama davranışları farklı — örneğin `App.exitApp()` webde
 * hiçbir şey yapmaz. Bu dosya farkı tek yerde toplar.
 */

export const isNative = Capacitor.isNativePlatform();
export const isIos = isNative && Capacitor.getPlatform() === 'ios';

export function onNativeThermalStatus(callback:(status:number)=>void):()=>void {
  if (!isNative || Capacitor.getPlatform() !== 'android') return ()=>{};
  return attachThermalStatus(registerPlugin<ThermalStatusBridge>('DeviceThermal'),callback);
}

/* ================================================================ *
 *  Kalıcı depolama
 * ================================================================ */

/**
 * Kayıtları native tarafa AYNALAR.
 *
 * Neden gerekli: WebView'in localStorage'ı işletim sistemi tarafından
 * silinebilir — iOS'ta depolama baskısı altında `Library/WebKit`
 * temizlenir, Android'de üretici "temizleyici" uygulamaları WebView
 * verisini siler. Oyuncu 40 saatlik ilerlemesini kaybeder ve bunu
 * mağazaya tek yıldız olarak yazar.
 *
 * Preferences ise SharedPreferences / NSUserDefaults kullanır: uygulama
 * verisiyle birlikte yedeklenir ve cihaz değiştirmede taşınır.
 *
 * localStorage senkron olduğu için birincil kaynak olarak kalır (oyun
 * döngüsü kayıt yazarken beklemez); Preferences arka planda aynalanır.
 */
export async function hydrateStorage(keys: string[]): Promise<void> {
  if (!isNative) return;
  for (const key of keys) {
    try {
      const local = localStorage.getItem(key);
      const { value: nativeVal } = await Preferences.get({ key });
      if (!nativeVal) continue;

      let shouldRestore = local === null;
      if (!shouldRestore && key.includes(':save:')) {
        try {
          const localParsed = JSON.parse(local!);
          const nativeParsed = JSON.parse(nativeVal);
          if (!localParsed || typeof localParsed !== 'object') {
            shouldRestore = true;
          } else if (typeof nativeParsed?.t === 'number' && typeof localParsed?.t === 'number') {
            if (nativeParsed.t > localParsed.t) {
              shouldRestore = true;
            }
          }
        } catch {
          shouldRestore = true;
        }
      }

      if (shouldRestore) {
        localStorage.setItem(key, nativeVal);
        console.info(`[Kayıt] "${key}" native depodan başarıyla onarıldı/güncellendi.`);
      }
    } catch (err) {
      console.warn('[Kayıt] Native depo okunamadı:', err);
    }
  }
}

/** Serialize native writes per key so a delayed write cannot undo a reset. */
const storageWrites=new Map<string,Promise<void>>();
function queueStorage(key:string,operation:()=>Promise<unknown>):Promise<void> {
  const next=(storageWrites.get(key)??Promise.resolve()).then(operation).then(()=>{}).catch(err=>console.warn('[Kayıt] Native depo işlemi tamamlanamadı:',err));
  storageWrites.set(key,next);
  void next.then(()=>{if(storageWrites.get(key)===next)storageWrites.delete(key);});
  return next;
}
export async function mirrorStorage(key:string,value:string):Promise<void> {
  if(isNative)await queueStorage(key,()=>Preferences.set({key,value}));
}
export async function clearStorage(key:string):Promise<void> {
  if(isNative)await queueStorage(key,()=>Preferences.remove({key}));
}
/** Await native persistence before a reload, restore or reset (drains complete write queue). */
export async function flushStorage(): Promise<void> {
  while (storageWrites.size > 0) {
    await Promise.all(Array.from(storageWrites.values()));
  }
}

let appExiting = false;
export function isAppExiting(): boolean {
  return appExiting;
}

/* ================================================================ *
 *  Geri tuşu
 * ================================================================ */

/**
 * Android donanım/jest geri tuşu.
 *
 * Varsayılan davranış `finish()` — yani oyun ANINDA kapanır. Idle bir
 * oyunda oyuncu paneli kapatmak için geri tuşuna basar ve kendini ana
 * ekranda bulur; bu doğrudan tek yıldızlık bir yorumdur.
 *
 * `handler` true dönerse olay yutulur (panel kapandı). false dönerse
 * çıkış onayı akışı işler: ilk basış uyarır, 2 saniye içindeki ikinci
 * basış çıkar.
 */
export function onBackButton(handler: () => boolean, onConfirmPrompt: () => void, beforeExit?: () => void): () => void {
  if (!isNative) return () => undefined;

  let armed = false;
  let disposed = false;
  let armTimer: ReturnType<typeof setTimeout> | undefined;

  const listener = App.addListener('backButton', () => {
    if (disposed || appExiting) return;
    if (handler()) {
      armed = false;
      if (armTimer) clearTimeout(armTimer);
      return;
    }
    if (armed) {
      if (armTimer) clearTimeout(armTimer);
      appExiting = true;
      beforeExit?.();
      void flushStorage().then(() => { if (!disposed) return App.exitApp(); }).catch(error => {
        appExiting = false;
        console.warn('[Cihaz] Çıkış tamamlanamadı:', error);
      });
      return;
    }
    armed = true;
    onConfirmPrompt();
    armTimer = setTimeout(() => (armed = false), 2000);
  });

  void listener.catch(error => console.warn('[Cihaz] Geri tuşu bağlanamadı:', error));
  return () => {
    disposed = true;
    if (armTimer) clearTimeout(armTimer);
    void listener.then((l) => l.remove()).catch(() => {});
  };
}

/* ================================================================ *
 *  Dokunsal geri bildirim
 * ================================================================ */

/* ================================================================ *
 *  Yerel bildirimler
 * ================================================================ */

/** Oyunun kullandığı bildirim kimlikleri — her planlamada yenilenir. */
const NOTIF_IDS = [8001, 8002];

/**
 * İzin ister. TUTORIAL BİTTİKTEN SONRA çağrılmalı, açılışta değil:
 * daha oyunu görmeden izin isteyen uygulama reddedilir ve bir daha
 * sorulamaz.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNative) return false;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const cur = await LocalNotifications.checkPermissions();
    if (cur.display === 'granted') return true;
    if (cur.display === 'denied') return false;
    const res = await LocalNotifications.requestPermissions();
    return res.display === 'granted';
  } catch {
    return false;
  }
}

export interface Reminder {
  /** Kaç saat sonra. */
  hours: number;
  title: string;
  body: string;
}

/**
 * Hatırlatmaları planlar (öncekileri iptal ederek).
 *
 * Her kayıtta yeniden planlanır: oyuncu oyunu açtıysa eski hatırlatma
 * artık yanlıştır. Bildirim, oyunun geri dönme kancasıdır — şu ana kadar
 * geri dönmek için tek sebep offline kazanç ekranıydı ve onu görmek için
 * oyuncunun kendiliğinden uygulamayı açması gerekiyordu.
 */
export async function scheduleReminders(list: Reminder[]): Promise<void> {
  if (!isNative) return;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') return;
    await LocalNotifications.cancel({ notifications: NOTIF_IDS.map((id) => ({ id })) });
    const now = Date.now();
    await LocalNotifications.schedule({
      notifications: list.slice(0, NOTIF_IDS.length).map((r, i) => ({
        id: NOTIF_IDS[i],
        title: r.title,
        body: r.body,
        schedule: { at: new Date(now + r.hours * 3600_000) },
        // res/drawable-*/ic_stat_notify.png — tools/make-assets.mjs üretir.
        smallIcon: 'ic_stat_notify',
      })),
    });
  } catch (err) {
    console.warn('[Bildirim] Planlanamadı:', err);
  }
}

export type HapticKind = 'light' | 'medium' | 'heavy' | 'success' | 'warning';

/**
 * Titreşim. Native'de Haptics, webde `navigator.vibrate` (Android
 * Chrome destekler, iOS Safari etmez — sessizce yok sayılır).
 */
export function haptic(kind: HapticKind = 'light'): void {
  try {
    if (isNative) {
      if (kind === 'success') void Haptics.notification({ type: NotificationType.Success }).catch(() => {});
      else if (kind === 'warning') void Haptics.notification({ type: NotificationType.Warning }).catch(() => {});
      else {
        const style =
          kind === 'heavy' ? ImpactStyle.Heavy : kind === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light;
        void Haptics.impact({ style }).catch(() => {});
      }
      return;
    }
    const ms = kind === 'heavy' ? 32 : kind === 'medium' ? 18 : kind === 'success' ? 24 : 9;
    navigator.vibrate?.(ms);
  } catch {
    /* titreşim kritik değil, sessizce geç */
  }
}

/** Some Android WebViews pause before a DOM visibility event; listen to both. */
export function onAppStateChange(handler: (active: boolean) => void): () => void {
  if (!isNative) return () => undefined;
  let disposed = false;
  const listener = App.addListener('appStateChange', ({isActive}) => {
    if (!disposed) handler(isActive);
  });
  void listener.catch(error => console.warn('[Cihaz] Yaşam döngüsü bağlanamadı:', error));
  return () => { disposed = true; void listener.then(l => l.remove()).catch(() => {}); };
}
