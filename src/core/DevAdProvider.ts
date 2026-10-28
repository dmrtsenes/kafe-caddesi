import { tr } from "./I18n";
import type { AdPlacement, AdProvider } from './Ads';
import { setAdProvider, setAdStatusSource } from './Ads';

/**
 * GELİŞTİRME SAHTE REKLAM SAĞLAYICISI — yalnız DEV derleme + tarayıcı.
 *
 * Gerçek AdMob yalnız native platformda çalışır; bu yüzden teklif çipi,
 * ödül akışı ve zamanlama tarayıcıda HİÇ test edilemiyordu ("reklamlar
 * cihazda görünmüyor" hatasının bu kadar geç fark edilmesinin sebebi de
 * bu). Bu sağlayıcı reklam yerine 4 saniyelik sahte bir tam ekran kart
 * gösterir: teklif → İZLE → ödül döngüsünün TAMAMI masaüstünde denenir.
 *
 * BİLEREK ui/ modüllerinden bağımsızdır (çıplak DOM + satır içi stil):
 * HUD/UIRoot üzerinde çalışan başka iş akışlarıyla çakışamaz. Üretim
 * paketine girmez — main.ts onu yalnız `import.meta.env.DEV && !isNative`
 * dalında, dinamik import ile yükler.
 */

/** Sahte reklamın "izlenme" süresi (sn) — sonunda ödül butonu belirir. */
const SURE = 4;

const YERLESIM_ADI: Record<AdPlacement, string> = {
  happy_hour: tr("Mutlu Saat"),
  zone_finish: tr("Bölümü Tamamla"),
  robot_vacuum: tr("Süpürge Robotu"),
  stock_refill: tr("Depoları Doldur"),
  daily_double: tr("Ödülü İkiye Katla"),
  // v5.1 "Sadakat" turu yerleşimleri (bkz. core/Ads.ts)
  cash_boost: tr("Nakit Desteği"),
  usta_mode: tr("Usta Modu"),
  rush_hour: tr("Müşteri Akını"),
  repair_shield: tr("Arıza Sigortası"),
  tip_rain: tr("Bahşiş Yağmuru"),
  investor: tr("Zengin Yatırımcı"),
  comeback_sale: tr("Dönüş Satışı"),
  free_upgrade: tr("Ücretsiz Yükseltme"),
};

let acik = false;

function sahteReklam(placement: AdPlacement): Promise<boolean> {
  if (acik) return Promise.resolve(false); // aynı anda tek kart
  acik = true;
  return new Promise<boolean>((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;' +
      'justify-content:center;background:rgba(8,12,16,0.86);' +
      'font-family:system-ui,-apple-system,sans-serif;';
    // Dokunuş oyuna sızmasın: joystick pointerdown ile doğuyor.
    for (const ev of ['pointerdown', 'pointerup', 'pointermove', 'click'] as const) {
      overlay.addEventListener(ev, (e) => e.stopPropagation());
    }

    const card = document.createElement('div');
    card.style.cssText =
      'position:relative;width:min(320px,84vw);padding:26px 22px 22px;text-align:center;' +
      'border-radius:18px;color:#f3e9d6;background:linear-gradient(180deg,#2d404c,#16242c);' +
      'box-shadow:0 14px 40px rgba(0,0,0,0.6),inset 0 0 0 2px rgba(255,200,74,0.35);';
    overlay.appendChild(card);

    const glyph = document.createElement('div');
    glyph.style.cssText = 'font-size:46px;line-height:1;margin-bottom:10px;';
    glyph.textContent = '🎬';
    card.appendChild(glyph);

    const title = document.createElement('div');
    title.style.cssText = 'font-size:17px;font-weight:900;letter-spacing:2px;color:#ffc84a;';
    title.textContent = tr("TEST REKLAMI");
    card.appendChild(title);

    const sub = document.createElement('div');
    sub.style.cssText = 'font-size:12px;font-weight:700;opacity:0.65;margin:4px 0 16px;';
    sub.textContent = YERLESIM_ADI[placement] ?? placement;
    card.appendChild(sub);

    // Geri sayım: büyük sayı + ince ilerleme çubuğu.
    const say = document.createElement('div');
    say.style.cssText = 'font-size:34px;font-weight:900;margin-bottom:10px;';
    say.textContent = String(SURE);
    card.appendChild(say);

    const barKap = document.createElement('div');
    barKap.style.cssText =
      'height:4px;border-radius:2px;overflow:hidden;background:rgba(255,255,255,0.15);';
    const bar = document.createElement('div');
    bar.style.cssText =
      `height:100%;width:0%;background:#ffc84a;transition:width ${SURE}s linear;`;
    barKap.appendChild(bar);
    card.appendChild(barKap);

    let iv = 0;
    const bitir = (odul: boolean): void => {
      if (iv) window.clearInterval(iv);
      overlay.remove();
      acik = false;
      resolve(odul);
    };

    // Köşedeki ✕ erken kapatır → ödül YOK (gerçek akışla birebir).
    const x = document.createElement('button');
    x.type = 'button';
    x.setAttribute('aria-label', tr("Kapat"));
    x.textContent = '✕';
    x.style.cssText =
      'position:absolute;top:-10px;right:-10px;width:28px;height:28px;border:0;' +
      'border-radius:999px;font-size:13px;font-weight:900;color:#f3e9d6;cursor:pointer;' +
      'background:#0e161c;box-shadow:inset 0 0 0 2px rgba(255,255,255,0.16);';
    x.addEventListener('click', () => bitir(false));
    card.appendChild(x);

    document.body.appendChild(overlay);
    // Çubuk animasyonu: bir sonraki karede %100'e — geçiş baştan başlasın.
    requestAnimationFrame(() => {
      bar.style.width = '100%';
    });

    const t0 = performance.now();
    iv = window.setInterval(() => {
      const kalan = SURE - (performance.now() - t0) / 1000;
      if (kalan > 0) {
        say.textContent = String(Math.ceil(kalan));
        return;
      }
      window.clearInterval(iv);
      iv = 0;
      // Süre doldu: sayaç yerini ödül butonuna bırakır.
      say.textContent = '';
      const al = document.createElement('button');
      al.type = 'button';
      al.textContent = tr("ÖDÜLÜ AL ✓");
      al.style.cssText =
        'padding:10px 24px;border:0;border-radius:999px;font-size:15px;font-weight:900;' +
        'color:#241a06;cursor:pointer;background:linear-gradient(180deg,#ffe08a,#ffc84a);' +
        'box-shadow:0 3px 0 rgba(0,0,0,0.35);';
      al.addEventListener('click', () => bitir(true));
      say.appendChild(al);
    }, 100);
  });
}

/** DEV sahte sağlayıcısını takar — yalnız main.ts'in DEV dalı çağırır. */
export function installDevAds(): void {
  const dev: AdProvider = {
    isReady: () => true,
    isInterstitialReady: () => true,
    show: (p) => sahteReklam(p),
    showInterstitial: async () => {
      await sahteReklam('happy_hour');
    },
  };
  setAdProvider(dev);
  setAdStatusSource(() => tr("hazır (DEV sahte reklamı)"));
  console.info('[Reklam] DEV sahte sağlayıcı takıldı — teklif döngüsü tarayıcıda test edilebilir.');
}
