import { installCanvasCompat } from './core/CanvasCompat';
import { tr } from './core/I18n';
import './style.css'; // ui/ui.css'i kendisi @import eder
import { initializeLanguage, getLanguage, LANGUAGE_KEY, tr as localText } from './core/I18n';
import { hydrateStorage, mirrorStorage, isNative } from './core/Native';
import { PERSISTED_KEYS } from './core/SaveManager';

import { installCrashReporter } from './core/CrashReporter';
import { installBrowserShield } from './core/BrowserShield';

installCanvasCompat();
installCrashReporter();
installBrowserShield();

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
const uiHost = document.getElementById('ui-root') as HTMLElement | null;

function fatal(message: string, err?: unknown): void {
  if (err) console.error(err);
  const boot = document.getElementById('boot-screen');
  if (boot) {
    boot.classList.add('boot-error');
    const p = boot.querySelector('p');
    if (p) p.textContent = message;
    const bar = boot.querySelector('.boot-bar');
    if (bar) bar.remove();
  }
}

async function boot(): Promise<void> {
  performance.mark('fincan:boot-start');
  if (!canvas || !uiHost) {
    fatal(tr('Oyun yüklenemedi: sayfa yapısı eksik.'));
    return;
  }
  const isAdMode = new URLSearchParams(window.location.search).get('ad') === '1';
  // İşletim sistemi WebView verisini silmiş olabilir; native depoda kayıt
  // varsa oyun kurulmadan ÖNCE localStorage'a geri yazılır.
  if (!isAdMode) {
    try {
      await hydrateStorage(PERSISTED_KEYS);
    } catch (err) {
      console.warn('[Kayıt] Geri yükleme atlandı:', err);
    }
  }
  initializeLanguage();
  if (!isAdMode) await mirrorStorage(LANGUAGE_KEY, getLanguage());
  const bootTagline = document.querySelector('#boot-screen .boot-mark p');
  if (bootTagline) bootTagline.textContent = localText('Sokağın en sıcak kafesi');
  performance.mark('fincan:imports-start');
  const [{ Game }, { loadPacks }, { loadCharacterPack }] = await Promise.all([
    import('./core/Game'),
    import('./world/packs/library'),
    import('./chars'),
  ]);
  performance.mark('fincan:imports-end');
  performance.measure('fincan:imports', 'fincan:imports-start', 'fincan:imports-end');
  try {
    await Promise.all([
      (async () => {
        performance.mark('fincan:furniture-start');
        try { await loadPacks(); }
        catch (err) { console.warn('[Pack] Mobilya paketleri yüklenemedi:', err); }
        performance.mark('fincan:furniture-end');
        performance.measure('fincan:furniture', 'fincan:furniture-start', 'fincan:furniture-end');
      })(),
      (async () => {
        performance.mark('fincan:characters-start');
        await loadCharacterPack();
        performance.mark('fincan:characters-end');
        performance.measure('fincan:characters', 'fincan:characters-start', 'fincan:characters-end');
      })(),
    ]);
  } catch (err) {
    fatal(tr('Karakterler yüklenemedi. Sayfayı yenilemeyi dene.'), err);
    return;
  }
  try {
    performance.mark('fincan:world-start');
    const game = new Game(canvas, uiHost);
    performance.mark('fincan:world-end');
    performance.measure('fincan:world', 'fincan:world-start', 'fincan:world-end');
    performance.mark('fincan:shaders-start');
    await game.prepareForPlay();
    performance.mark('fincan:shaders-end');
    performance.measure('fincan:shaders', 'fincan:shaders-start', 'fincan:shaders-end');
    game.start();
    if (isAdMode) {
      const { installAdDirector } = await import('./ad/AdDirector');
      installAdDirector(game);
    }
    performance.mark('fincan:playable');
    performance.measure('fincan:boot', 'fincan:boot-start', 'fincan:playable');
    (window as unknown as { __fincan?: InstanceType<typeof Game> }).__fincan = game;
  } catch (err) {
    fatal(tr('WebGL başlatılamadı. Tarayıcı ayarlarından donanım hızlandırmayı açmayı dene.'), err);
    return;
  }
  /**
   * REKLAM AĞI OYUN KURULDUKTAN SONRA BAŞLAR.
   *
   * Beklenmez (`void`): SDK başlatma ağ işidir ve saniyeler sürebilir;
   * açılışı ona bağlamak oyunu geç açar. Başarısız olursa sağlayıcı hiç
   * takılmaz ve oyun tamamen reklamsız çalışır — yani bu satırın
   * çökmesi bile oynanışı etkilemez.
   *
   * DEV + tarayıcı → SAHTE sağlayıcı (bkz. DevAdProvider): teklif çipi ve
   * ödül döngüsü masaüstünde test edilebilir. Diğer her durumda gerçek
   * AdMob; tarayıcı ÜRETİM derlemesinde o hiçbir şey yapmaz ve oyun
   * reklamsız kalır — reklamları yalnız gerçek cihazda / APK'da görürsün.
   */
  if (import.meta.env.DEV && !isNative) {
    void import('./core/DevAdProvider')
      .then((m) => m.installDevAds())
      .catch((err) => console.warn('[Reklam] DEV sağlayıcı yüklenemedi:', err));
  } else {
    void import('./core/AdMobProvider')
      .then((m) => m.initAds())
      .catch((err) => console.warn('[Reklam] Modül yüklenemedi:', err));
  }
}

void boot().catch((err) => fatal(tr('Oyun yüklenemedi. Bağlantını kontrol edip sayfayı yenile.'), err));
