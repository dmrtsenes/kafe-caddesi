/**
 * PERF HUD — sağ altta küçük, dokunmaz bir ölçüm katmanı.
 *
 * Kurulum KARARI çağıranın işidir (Game `?perf=1` sorgusunu okur ve
 * `renderer.info` + `QUALITY`'den bir örnekleyici bağlar); burası yalnız
 * çizer. `import.meta.env.DEV` şartı BİLEREK yok: asıl ölçüm cihazda,
 * üretim derlemesinde yapılır — katman yalnız sorgu paramıyla açıldığı
 * için oyuncu hiç görmez.
 */

export interface PerfSample {
  fps: number;
  /** renderer.info.render.calls */
  calls: number;
  /** renderer.info.render.triangles */
  tris: number;
  /** Etkin kademe adı (high/medium/low). */
  tier: string;
  /** Isı merdiveni basamağı 0..5. */
  heat: number;
}

/** Katmanı kurar; geri dönen fonksiyon söker. 500 ms'de bir tazelenir. */
export function installPerfHud(
  sample: () => { fps: number; calls: number; tris: number; tier: string; heat: number },
): () => void {
  const div = document.createElement('div');
  div.id = 'perf-hud';
  const s = div.style;
  s.position = 'fixed';
  s.right = '8px';
  s.bottom = '8px';
  s.zIndex = '9999';
  s.pointerEvents = 'none';
  s.background = 'rgba(0,0,0,.55)';
  s.color = '#9fe07a';
  s.font = '10px/1.5 ui-monospace, Consolas, monospace';
  s.padding = '4px 8px';
  s.borderRadius = '6px';
  s.whiteSpace = 'pre';
  document.body.appendChild(div);

  const timer = window.setInterval(() => {
    const v = sample();
    div.textContent =
      `${Math.round(v.fps)} fps · ${v.tier} · ısı ${v.heat}\n` +
      `${v.calls} çağrı · ${(v.tris / 1000).toFixed(1)}k üçgen`;
  }, 500);

  return () => {
    window.clearInterval(timer);
    div.remove();
  };
}
