/**
 * RIG SONDASI — karakter başına çizim maliyetinin ölçüm temeli.
 *
 * Neden var: skinned geçişinin kazancı "önce/sonra" olmadan iddiadan
 * ibarettir. Bu araç iki soruyu rakamla cevaplar: bir karakter kaç mesh /
 * vertex / materyal, ve sahnenin tamamı kaç çizim çağrısı.
 *
 * Kullanım: konsolda eval ettikten sonra  __rigProbe()
 */
/* eslint-disable no-console */
function __rigProbe() {
  const g = window.__fincan;
  if (!g) throw new Error('window.__fincan yok — oyun açılmadı mı?');

  // Sahnedeki her karakter kökünü bul: rig kökünün adı 'char'. traverse
  // görünürlüğe bakmaksızın gezer — bu liste renderer'ın atladığı
  // aktörleri de içerir; actorsTotal/actorsVisible ayrımı bunun için var.
  const roots = [];
  g.scene3d.scene.traverse((o) => {
    if (o.name === 'char') roots.push(o);
  });
  if (!roots.length) throw new Error('sahnede karakter yok — biraz oyna, müşteri gelsin');

  /**
   * FIX (kod incelemesi, round 1): `Object3D.traverse` ata zincirindeki
   * `visible=false`a bakmaksızın TÜM alt ağacı gezer; renderer
   * (`WebGLRenderer.projectObject`) ise bir düğüm invisible olunca
   * ALTINA hiç inmez. Oyun bunu gerçekten kullanıyor: `Customer.ts:555`
   * ve `Staff.ts:288` kadraj dışı aktörde `char.root.visible = false`
   * yazıyor (`World.ts` `isNearCamera` — odaktan 26 birimden uzaksa).
   * Eski sürüm yaprak mesh'in kendi `visible` bayrağına bakıyordu, ata
   * zincirine değil; böyle bir karakter sahnede sıfır çağrı harcarken
   * `perChar` onu tam maliyetli normal bir karakter gibi sayıyordu.
   * Düzeltme: elle özyineleme, invisible düğümde durur ve altına hiç
   * inmez — renderer'ın yaptığı tam bu.
   */
  const measure = (root) => {
    let drawCalls = 0;
    let vertices = 0;
    let triangles = 0;
    const mats = new Set();
    const walk = (o) => {
      if (!o.visible) return; // renderer da tam burada durur, altına inmez
      if (o.isMesh || o.isSkinnedMesh) {
        const geo = o.geometry;
        const pos = geo.getAttribute('position');
        vertices += pos ? pos.count : 0;
        triangles += geo.index ? geo.index.count / 3 : (pos ? pos.count / 3 : 0);
        // Materyal dizisi + geometri grubu = grup başına bir çizim çağrısı.
        const groups = geo.groups && geo.groups.length ? geo.groups.length : 1;
        drawCalls += groups;
        const m = o.material;
        if (Array.isArray(m)) m.forEach((x) => mats.add(x.uuid));
        else mats.add(m.uuid);
      }
      for (const c of o.children) walk(c);
    };
    walk(root);
    return { drawCalls, vertices, triangles: Math.round(triangles), materials: mats.size };
  };

  const per = roots.map(measure);
  // drawCalls===0 → renderer bu kökü hiç çizmedi (kadraj dışı / uzak
  // aktör). Ortalamaya girerse perChar'ı sessizce aşağı çeker — dışla.
  const visible = per.filter((p) => p.drawCalls > 0);
  const avg = (k) =>
    visible.length ? Math.round(visible.reduce((s, p) => s + p[k], 0) / visible.length) : 0;
  // Toplam (ortalama değil): sahnedeki karakter payını KESİN veriyor —
  // eskiden "ortalama × aktör sayısı" tahminiyle yapılıyordu.
  const charCallsTotal = visible.reduce((s, p) => s + p.drawCalls, 0);
  const sceneCalls = g.scene3d.renderer.info.render.calls;

  const report = {
    actorsTotal: roots.length,
    actorsVisible: visible.length,
    perChar: {
      drawCalls: avg('drawCalls'),
      vertices: avg('vertices'),
      triangles: avg('triangles'),
      materials: avg('materials'),
    },
    charCallsTotal,
    nonCharCalls: sceneCalls - charCallsTotal,
    scene: {
      calls: sceneCalls,
      triangles: g.scene3d.renderer.info.render.triangles,
    },
    quality: { tier: g.scene3d.renderer.shadowMap.enabled ? 'gölge açık' : 'gölge kapalı' },
  };
  window.__rigProbeReport = report;
  console.table(report.perChar);
  console.log(
    'sahne:', report.scene,
    '· aktör (toplam/görünür):', `${report.actorsTotal}/${report.actorsVisible}`,
    '· karakter payı:', report.charCallsTotal,
    '· karakter dışı:', report.nonCharCalls,
  );
  return report;
}

/**
 * DOĞUM MALİYETİ — bir karakteri kurmanın kare bütçesine etkisi (Task 9,
 * spec 3.6 kapısı). Bant (spec 5.2): `customer` rolünde **p95 < 4 ms**.
 *
 * Neden ölçülüyor: skinned geçişinden önce geometriler `world/Materials`
 * önbelleğinden PAYLAŞIMLIYDI ve bir karakteri kurmak neredeyse bedavaydı
 * (bkz. dosya başı `__rigProbe` yorumu). Artık `buildRig` her çağrıda
 * parça başına kaynak özniteliklerini (konum/normal/uv) dönüştürüp
 * boyayarak önceden tahsis edilmiş TEK birleşik tampona yazıyor
 * (`CharacterSkin.buildSkin` — Task 9b fix round 1 Adım B'den beri ara
 * `BufferGeometry` klonu ya da `mergeGeometries` çağrısı YOK, bkz. o
 * dosyanın başlık notu) ve bir `Skeleton` bağlıyor. 60 fps bütçesi 16,7 ms;
 * bu maliyet oranın belirgin bir dilimini yerse doğuşta takılma görülür.
 *
 * NEDEN RENDER YOK: birleştirme saf CPU hesabı — `buildRig` sahneye hiçbir
 * şey eklemez, `renderer`e hiç dokunmaz, GPU'ya hiçbir şey yüklemez (o,
 * nesne ilk RENDER edildiğinde olur). Ölçüm bu yüzden `g.scene3d.render()`
 * çağırmadan, salt `performance.now()` ile yapılıyor. GPU sayaçlarıyla
 * (`renderer.info.memory`) sızıntı kanıtı ayrı bir fonksiyonda —
 * `__rigLeakCheck` — çünkü o sayaçlar YALNIZCA render edilmiş nesneleri
 * sayar (bkz. o fonksiyonun başlık yorumu) ve bu döngüde asla oynamazlar.
 *
 * ISINMA (brief'in istediği ayrıştırma): `charLitMaterial()`/
 * `charUnlitMaterial()` (CharacterMaterials.ts) modül seviyesinde birer kez
 * kurulan singleton'lardır; `world/Materials.ts`'in geometri önbelleği
 * (box/cyl/sph/roundBox/torus) ise her (şekil,parametre) çiftini YALNIZ İLK
 * GÖRÜLDÜĞÜNDE üretir, sonrakiler map lookup'tır. Bu "ilk K çağrı yavaş"
 * gibi SABİT bir örüntü DEĞİL: turun herhangi bir noktasında, hangi seed'in
 * hangi şapka/saç/üstlük/sırt-eşyası kombinasyonunu İLK KEZ getirdiğine
 * bağlı, rastgele konumlu önbellek-ISKASI sıçramaları. Ölçülen turdan ÖNCE
 * ayrı bir ısınma turu koşulur ve sonuca KARIŞTIRILMAZ; ısınmanın gerçekten
 * pahalı olduğu `report.warmup` alanında ayrıca görülebilir.
 *
 * `opts.charLod`: geçici olarak `QUALITY.charLod`'u değiştirip ölçümden
 * sonra ESKİ DEĞERE geri koyar — chars/index.ts'teki "araç bayrağı geçici
 * çevirir, koşu senkron olduğu için oyun döngüsü araya giremez" idiomunun
 * aynısı. Sade LOD dalında parça sayısı düşer; birleştirme de ucuzlar mı,
 * bunu görmek işe yarar.
 *
 * `opts.legacy` KALKTI (Task 10): eski kurucunun doğum maliyetini aynı
 * derlemede ölçmeye yarıyordu ve `buildRigLegacy` silinince dev kancasından
 * da çıktı — bayrak `undefined`ı çağırıp patlardı. "Önce" değeri artık
 * ölçülemez, plandaki Ölçüm Kütüğü'nde duruyor.
 *
 * @returns {{mean:number, p95:number, max:number, samples:number[], n:number,
 *   role:string, charLod:boolean,
 *   warmup:{mean:number,p95:number,max:number,n:number}|null}}
 */
function __rigSpawnCost(opts = {}) {
  const n = opts.n ?? 60;
  const warmup = opts.warmup ?? 60;
  const role = opts.role ?? 'customer';
  const I = window.__charInternals;
  if (!I) throw new Error('window.__charInternals yok — dev derlemesi mi?');

  const prevLod = I.QUALITY.charLod;
  if (opts.charLod !== undefined) I.QUALITY.charLod = opts.charLod;

  /**
   * SAHİPLİK (brief'in tek satırı — `rig.skinned.geometry.dispose(); rig.
   * root.clear();` — BAYAT, Task 7'de değişti). Çapa `headMat`in 'dispose'
   * olayından `buildRig` içindeki açık `disposeOwned` kapanışına taşındı;
   * birleşik tampon VE `Skeleton`in kemik matrisi `DataTexture`'ı ikisi de
   * onun altında (`released` bayrağıyla idempotent). Sıra
   * `CharacterAnimator.dispose()`un gerçek yoluyla BİREBİR aynı.
   *
   * TEK DAL (Task 10): eskiden `headMat` yedeği ve "ikisi de yoksa patla"
   * dalı vardı; ikisi de legacy'nin çapasıydı ve o kurucu silindi.
   * `disposeOwned` artık `Rig`de ZORUNLU alan (CharacterRig.ts), yani
   * eksikliği çalışma anında değil tip denetiminde yakalanıyor.
   */
  const disposeRig = (rig) => {
    rig.disposeOwned();
  };

  const run = (count, seedBase) => {
    const s = [];
    for (let i = 0; i < count; i++) {
      const spec = I.createAppearance(role, { seed: seedBase + i * 7919 });
      const t0 = performance.now();
      const rig = I.buildRig(spec);
      s.push(performance.now() - t0);
      disposeRig(rig);
    }
    return s; // kronolojik sırada — SIRALANMAZ (turun içinde sürüklenme varsa görünsün)
  };

  try {
    const warmSamples = warmup ? run(warmup, 3) : [];
    const samples = run(n, 1_000_003);

    const stat = (arr) => {
      const sorted = [...arr].sort((a, b) => a - b);
      return {
        mean: +(sorted.reduce((sum, x) => sum + x, 0) / sorted.length).toFixed(3),
        p95: +sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))].toFixed(3),
        max: +sorted[sorted.length - 1].toFixed(3),
      };
    };

    const mainStat = stat(samples);
    const warmStat = warmSamples.length ? stat(warmSamples) : null;
    const report = {
      ...mainStat,
      samples,
      n: samples.length,
      role,
      charLod: I.QUALITY.charLod,
      warmup: warmStat ? { ...warmStat, n: warmSamples.length } : null,
    };
    window.__rigSpawnReport = report;
    console.table({
      mean: report.mean,
      p95: report.p95,
      max: report.max,
      n: report.n,
      role,
      charLod: report.charLod,
      warmupMean: warmStat ? warmStat.mean : '—',
      warmupMax: warmStat ? warmStat.max : '—',
    });
    return report;
  } finally {
    I.QUALITY.charLod = prevLod;
  }
}

/**
 * SIZINTI DOĞRULAMASI — `disposeOwned()` GERÇEKTEN GPU sayaçlarını
 * (`renderer.info.memory`) tabana döndürüyor mu?
 *
 * `__rigSpawnCost` bunu KANITLAYAMAZ: three.js'te `WebGLGeometries.get()` ve
 * `WebGLTextures`in yükleme yolu yalnızca GERÇEKTEN RENDER EDİLMİŞ nesneleri
 * sayar (`renderBufferDirect` içinden çağrılır, bkz. node_modules/three/src/
 * renderers/webgl/WebGLGeometries.js) — `buildRig()` kendi başına renderer'a
 * hiç dokunmaz. Yani `__rigSpawnCost`ün saf-hesap döngüsünde dispose'u
 * BOZSAN bile `info.memory` sayaçları oynamaz; "kanıt" sahte-yeşil olurdu.
 *
 * Bu yüzden ayrı fonksiyon, Task 6/7/8'in doğrulanmış "kur-at" yöntemiyle
 * BİREBİR aynı desende (bkz. plan Ölçüm Kütüğü — "GPU kaynağı / karakter"
 * satırı, ölçüldü: geometries 298→338→298, textures 31→71→31 ×5 tur):
 * N karakter AYNI ANDA sahnede yaşar → TEK `render()` (hepsi sayaca girer,
 * tepe okunur) → hepsi `dispose()` → sayaç tekrar okunur, TABANA dönmeli.
 *
 * ÜRETİM ZİNCİRİ (nihai inceleme bulgusu — düzeltildi). Bu fonksiyon
 * `I.buildRig(spec)` + `rig.disposeOwned()`i DOĞRUDAN çağırıyordu: üretim
 * zincirini (`World` → `Actor.dispose` → `Character.dispose` →
 * `anim.dispose` → `rig.disposeOwned`, bkz. Actor.ts `dispose()` ve
 * `CharacterAnimator.ts`teki tek üretim çağrısı) hiç koşturmuyordu.
 * `anim.dispose()`, `Character.dispose()` gibi ara katmanlar tamamen kapsam
 * dışıydı — biri kırılsa (ör. `disposeOwned` çağrısı silinse) bu kapı yine
 * de YEŞİL YANARDI, çünkü rig'i her seferinde elle kurup elle söküyordu.
 * Şimdi `I.createCharacter()` ile kuruluyor (`Actor`in yaptığı
 * `parent.add(char.root)` burada `scene.add`), `char.dispose()` ile atılıyor.
 * Ayrıca `scene.remove` artık ayrı çağrılmıyor: `Character.dispose()` bunu
 * kendi içinde yapıyor (`root.removeFromParent()`), üretimin yaptığı da bu.
 *
 * SABOTAJ KOLU KALKTI (`opts.skipSkeleton`). Üretim yoluna geçince `rig`e
 * doğrudan erişim yok — `CharacterHandle` onu kasıtlı olarak sızdırmaz, yani
 * eski `rig.skinned.geometry.dispose()` sabotajı buradan kurulamaz. Kanıt
 * artık gerçek kaynakta: `CharacterAnimator.ts`teki `disposeOwned` çağrısı
 * geçici kaldırılıp bu fonksiyon tekrar koşturulunca `flat` `false`'a düşer
 * (ölçüldü, bkz. commit/rapor) — sahte kol yerine gerçek regresyon.
 *
 * @returns {{before:{geometries:number,textures:number}, peak:object,
 *   after:object, up:object, down:object, flat:boolean, n:number}}
 */
function __rigLeakCheck(opts = {}) {
  const n = opts.n ?? 40;
  const role = opts.role ?? 'customer';
  const I = window.__charInternals;
  const g = window.__fincan;
  if (!I) throw new Error('window.__charInternals yok — dev derlemesi mi?');
  if (!g) throw new Error('window.__fincan yok — oyun açılmadı mı?');

  const mem = () => ({
    geometries: g.scene3d.renderer.info.memory.geometries,
    textures: g.scene3d.renderer.info.memory.textures,
  });

  const before = mem();
  const chars = [];
  try {
    for (let i = 0; i < n; i++) {
      const char = I.createCharacter(role, { seed: 9_000_000 + i * 7919 });
      g.scene3d.scene.add(char.root);
      chars.push(char);
    }
    g.scene3d.render(); // sayaca girmenin TEK yolu — bkz. başlık yorumu
    const peak = mem();

    // `char.dispose()` üretimin tek yolu (Actor.dispose → Character.dispose
    // → anim.dispose → rig.disposeOwned) ve `scene.remove`i kendi içinde
    // yapıyor — burada ayrıca çağrılmıyor.
    for (const char of chars) char.dispose();
    const after = mem();

    const report = {
      before,
      peak,
      after,
      up: { geometries: peak.geometries - before.geometries, textures: peak.textures - before.textures },
      down: { geometries: peak.geometries - after.geometries, textures: peak.textures - after.textures },
      flat: after.geometries === before.geometries && after.textures === before.textures,
      n,
    };
    console.table({
      before: `${before.geometries}g / ${before.textures}t`,
      peak: `${peak.geometries}g / ${peak.textures}t`,
      after: `${after.geometries}g / ${after.textures}t`,
      flat: report.flat,
    });
    return report;
  } finally {
    // Fırlarsa bile sahnede yetim karakter ya da sızan kaynak kalmasın.
    // `char.dispose()` `dead` bayrağıyla idempotent (Character.dispose),
    // yani yukarıda zaten atılmış karakterler için de güvenli — bu yalnız
    // erken-throw durumunun savunması.
    for (const char of chars) char.dispose();
  }
}
