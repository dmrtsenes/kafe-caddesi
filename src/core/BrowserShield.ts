/**
 * Tarayıcı Davranışlarını Yok Etme Kalkanı (BrowserShield).
 *
 * Mobil ve masaüstünde tarayıcıya ait tüm menü, imleç ve sürükleme kalıntılarını
 * window capture aşamasında yutar; oyunun %100 yerel konsol/motor hissi vermesini sağlar.
 */
export function installBrowserShield(): () => void {
  const detach: Array<() => void> = [];

  const add = <K extends keyof WindowEventMap>(
    type: K,
    listener: (ev: WindowEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions
  ) => {
    window.addEventListener(type, listener, options);
    detach.push(() => window.removeEventListener(type, listener, options));
  };

  // 1. Bağlam Menüsünü Yok Et (Sağ tık ve mobilde uzun basma menüsü)
  add('contextmenu', (e: MouseEvent) => {
    e.preventDefault();
  }, { capture: true });

  // 2. Metin Seçim Başlangıcını Yok Et (Mavi seçim alanını engeller)
  add('selectstart', (e: Event) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    e.preventDefault();
  }, { capture: true });

  // 3. Hayalet Sürüklemeyi Yok Et (Resim/buton sürükleme kopyası)
  add('dragstart', (e: DragEvent) => {
    e.preventDefault();
  }, { capture: true });

  // 4. Orta Tuş Tıklamasını Yok Et (Otomatik scroll çemberi)
  add('auxclick', (e: MouseEvent) => {
    if (e.button === 1 || e.button === 2) {
      e.preventDefault();
    }
  }, { capture: true });

  // 5. Masaüstü/Trackpad Ctrl + Wheel (Pinch-to-zoom) Engelle
  add('wheel', (e: WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
    }
  }, { passive: false, capture: true });

  // 6. Çoklu Dokunma ile Ekran Yakınlaştırmayı Önle (1 parmak liste kaydırmasını korur)
  add('touchstart', (e: TouchEvent) => {
    if (e.touches.length > 1) {
      e.preventDefault();
    }
  }, { passive: false, capture: true });

  return () => {
    for (const off of detach) off();
  };
}
