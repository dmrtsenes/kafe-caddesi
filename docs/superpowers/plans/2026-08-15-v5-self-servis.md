# v5.0 Self-Servis Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.
> Görevler `- [ ]` kutucuklarıyla izlenir. Spec: `docs/superpowers/specs/2026-08-15-v5-self-servis-design.md`.

**Hedef:** Kafeyi self-servis döngüye çevir (kasada öde → kendi rafından al → kendi masana git), termal/pixelleşme sorununu kapat, ödüllü reklam tekliflerini görünür-süreli-güvenilir yap, kilitli alan/balon okunaklılığını düzelt.

**Mimari:** Sim çekirdeği (World/Customer/Station) tek elden (ana oturum) yeniden bağlanır; render-termal, reklam ve etiket paketleri dosya sahipliği ayrık üç subagent paketidir. Ölçüm disiplini: her görev kendi doğrulama komutuyla biter.

**Stack:** TypeScript 5.6 · three 0.169 · Vite 5 · Capacitor 8 · @capacitor-community/admob 8.1.

## Küresel Kısıtlar (her görev için geçerli)

- Test çerçevesi yok; TDD karşılığı = `npm run typecheck` + `validateLayout/validateClearances/validateSightlines` + `tools/balance-bot.js` + konsol ölçümü + 375×812 `/__shot` karesi. Her görev doğrulama adımı içerir.
- Dosyalar YALNIZ Read/Write/Edit araçlarıyla düzenlenir; PowerShell Get-Content/Set-Content YASAK (Türkçe metin mojibake'ye döner).
- Türkçe oyun metni; emoji-önekli, cümle düzeni mevcut kalıpta.
- Çözünürlük hiçbir kod yolunda düşürülemez (DPR tavanı 2,0 sabit).
- Zincirsiz üretim, asla cezalandırma, portre + yaw 0, tek ekranda tek ped.
- Bar hattı z = −4,4; kapı ≥3,0; koridor ≥1,6; 0,15–0,95 boğaz bandı yasak.
- `SAVE_VERSION = 8`, anahtar `fincan-sokagi:save:v8`.
- Her görev sonunda `git add <dosyalar> && git commit`.

---

## DALGA A (paralel: A1 ana oturum + A2 subagent)

### Task A1: Çekirdek sim v5 (ANA OTURUM — World.ts sahibi)

**Files:**
- Modify: `src/data/items.ts` (espresso/kruvasan/cheesecake/limonata sil)
- Modify: `src/data/stations.ts` (k_espresso/k_firin/k_tatli/k_soguk sil; PickupDef'e `item?: ItemId`; raf istasyonları `k_raf_cay|latte|tost|waffle|frappe`, Sahil `s_raf_*` ×3)
- Modify: `src/data/layouts.ts` (bar hattı: 2 kasa + 5 raf; raflar bölgelerine atanır; a4 görünen adı "TOST"; silinen makine konumları temizlenir)
- Modify: `src/data/staff.ts` (hız tabloları spec §1), `src/data/balance.ts` (counterCap 40, playerBoost sabitleri, spawn formül sabitleri)
- Modify: `src/data/goals.ts` (g02/g05/g06/g13/g35 + sonsuz şablon metinleri; 'serve' semantiği aynı kalır)
- Modify: `src/sim/Orders.ts` (`maxLines=1` üretimi — buildOrder tek satır)
- Modify: `src/sim/Station.ts` (`canAccept('pickup')`: `def.item` eşleşme şartı; `hasItem/takeItem` aynen)
- Modify: `src/sim/World.ts` (placeOrder ödeme+rota, startTakeaway→raf seçimi `def.item`, pickup→toTable→seated(yalnız ye), updateWaiter=yalnız ikmal, findServeJob/tableNeeding/tableUrgency söküm, onItemPlaced 'table' ürün yolu ölür, stats.served→raf alışı, spawn governor, pickGuideTarget v5 fiilleri + "BÖLÜMÜ AÇ", hasServiceWork raf/sıra okur, "el ver" bonusu, validateLayout koşumu)
- Modify: `src/entities/Customer.ts` (showTicket/badgeMaterial('ticket') SİL; pickup sonrası masa yolculuğu; balon: sipariş sonrası ikon)
- Modify: `src/entities/Player.ts` + `World.updatePlayerInteraction` (masaya ürün bırakma yolu ürünler için kapanır; rafa arka yüzden bırakma kalır)
- Modify: `src/entities/Staff.ts` (fetchItem hedefi kendi rafı; tezgâhtar görünen adı)
- Modify: `src/sim/Tutorial.ts` (v5 zinciri 8 adım, spec §1; her adıma 14 sn kaçış)
- Modify: `src/core/SaveManager.ts` (v8), `src/sim/GameState.ts` (yeni alan yok; defensive default)
- Modify: `src/core/Game.ts` (kare sınırlayıcı birikimli 60/30; rAF iptal on hidden; applyQualityTier zincir düzeltmesi çağrı yönü; ısı merdiveni kancası `Quality.evaluateHeat` — A2'nin ürettiği API)

**Interfaces (A2/B dalgalarının bağımlıları):**
- `Quality.evaluateHeat(workMs: number, fps: number): void` — A2 üretir, Game.tick çağırır.
- `QUALITY.heatLevel: 0|1|2|3|4|5` — A2 üretir; 5 = 30 fps modu; Game kare hedefini `QUALITY.heatLevel>=5 ? 30 : 60` okur.
- Raf istasyon id'leri: `k_raf_cay, k_raf_latte, k_raf_tost, k_raf_waffle, k_raf_frappe, s_raf_smoothie, s_raf_dondurma, s_raf_shake`; `StationDef.kind='pickup'`, `item` alanı dolu. B2 (etiket) PickupView bu id'lerle glif çizer.
- Olay: `bus.emit('item:served', {item, x, z})` raf alışında; `stats.served` orada artar.

**Adımlar (özet — ayrıntı spec §1):**
- [ ] Veri katmanı (items/stations/layouts/staff/balance/goals) + typecheck
- [ ] Station pickup item filtresi + Orders tek satır + typecheck
- [ ] World: placeOrder→ödeme; rota → raf; pickup→toTable→ye; finishOrder sadeleşir
- [ ] Garson=ikmalci; findServeJob söküm; guide v5; spawn governor; el-ver bonusu
- [ ] Tutorial v5; SaveManager v8; Game kare sınırlayıcı + görünürlük + kalite zinciri
- [ ] Doğrulama: `npm run typecheck` · dev'de `validateLayout` 0 ciddi · tarayıcıda 3 dk el testi (sipariş→öde→raf→masa akışı gözle + `__fincan` sayaçları) · commit

### Task A2 (SUBAGENT "perf-render"): Termal paket — Game.ts HARİÇ

**Files (yalnız bunlar):**
- Modify: `src/core/Quality.ts` — kademe tablosundan `maxDpr` çıkar (sabit 2.0 dışa `DPR_CAP` export); `vfxScale` sil; ısı merdiveni: `evaluateHeat(workMs, fps)` EWMA α=0.05, yükselme eşiği 13 ms VEYA fps<52 (12 sn cooldown), inme eşiği 8 ms VE fps>57 (45 sn cooldown), seviye etkileri: 1=shadowMap 1024 · 2=charLod zorla · 3=maxCustomers−6 · 4=gölge kapalı · 5=`heatLevel` 5 (Game 30 fps okur). Uygula-geri-al simetrik, `applyHeat(level)` renderer'a `Scene3D.applyQuality` üzerinden.
- Modify: `src/core/Settings.ts` — anahtar `:v2`; `load()` v1'den taşır, `quality` alanı YOKSA `detectTier()`; `isLikelyLowEnd` sil.
- Modify: `src/world/Scene3D.ts` — `dprCap` sabit 2.0 (`lowQuality`da 1.0 kalabilir); `applyQuality` her çağrıda setPixelRatio+shadow uygular (erken dönüş yok); `powerPreference: isNative ? 'default' : 'high-performance'` (`core/Native.ts` import).
- Modify: `src/world/Environment.ts` — sokak cepheleri `BufferGeometryUtils.mergeGeometries` ile malzeme başına tek mesh (pencere camı/denizlik dahil; hedef sokak ≤10 çağrı); sokak propları (ağaç/lamba) 2 InstancedMesh; `street` altındaki her şey `matrixAutoUpdate=false` + tek `updateMatrixWorld(true)`; env.root statik çocuklarında aynı bayrak.
- Modify: `src/world/Decor.ts` — kök grupta `matrixAutoUpdate=false` (instanced zaten).
- Modify: `src/world/StationView.ts` — `setOutput/setInput`: içerik imzası (uzunluk+ilk/son id) değişmediyse erken dön; `flushInstances`'a `boundsDirty` bayrağı (`src/world/ProductMesh.ts` Modify).
- Modify: `src/entities/Staff.ts` — YOK (A1'in); bunun yerine kültleme World'de mi? HAYIR: kültleme `src/entities/Staff.ts:update` yerine `src/world/...` erişimi yok → kültlemeyi ATLA, A1 notuna bırak: `Staff.step` içinde `char.root.visible` müşteri kalıbıyla (World.ts:1476 kalıbı) — A1 uygular.
- Modify: `src/style.css` — `#grade` yalnız `body.desktop-high`; mobil/medium/low'da yok (mevcut `low-fx` kalıbını genişlet).
- Modify: `src/ui/Panels.ts` — Ayarlar'a 4'lü "🎚️ Grafik: Otomatik/Yüksek/Orta/Düşük" (mevcut `TIER_LABEL` metinleri; Otomatik=adaptif açık). `📉 Düşük Kalite` toggle'ı kaldır, yerine seçici (api.setQuality mevcut yolu).
- Create: `src/core/PerfHud.ts` — `?perf=1`: sağ-alt sabit mono div; 500 ms'de bir `fps · calls · tris · tier · heat` (renderer.info; `import.meta.env.DEV` şartı YOK — cihazda da çalışmalı, yalnız query paramla).

**Interfaces:** `evaluateHeat(workMs: number, fps: number): void` + `QUALITY.heatLevel` (Game okur, A1 bağlar). `DPR_CAP = 2.0` export.

- [ ] Quality/Settings/Scene3D düzenle + typecheck
- [ ] Environment sokak birleştirme + matris bayrakları; önce/sonra `renderer.info.render.calls` konsol ölçümü not düş
- [ ] StationView/ProductMesh kirli bayrak; Panels seçici; PerfHud
- [ ] Doğrulama: `npm run typecheck` · dev'de `?perf=1` ile çağrı sayısı önce/sonra · `validateSightlines` boş · commit

---

## DALGA B (A bitince paralel: B1 + B2 subagent)

### Task B1 (SUBAGENT "ads"): Reklam güvenilirlik + süreli çip

**Files:**
- Rewrite: `src/core/AdMobProvider.ts` — tek ödüllü slot (`rewardedLoaded: boolean`); init retry 5→15→30→60 sn; `RewardAdPluginEvents.FailedToLoad` dinleyicisi → backoff'la `prepare`; UMP: `requestConsentInfo` ayrı try/catch, hata → `console.warn` + devam (sağlayıcı YİNE kayıt olur); `show()` sonrası bayrak düşer + yeniden yükleme; `adStatus(): 'hazır'|'yükleniyor'|'hata: …'` export.
- Create: `src/core/DevAdProvider.ts` — yalnız `import.meta.env.DEV && !isNative`: 4 sn tam ekran "🎬 TEST REKLAMI" perdesi (DOM, geri sayım), her zaman ready; `main.ts`'te AdMob yerine bu dalda kayıt.
- Modify: `src/core/Ads.ts` — `adStatus` köprüsü; başka değişiklik yok.
- Modify: `src/core/Game.ts` (YALNIZ reklam bölgesi :774-823, :1566-1685) — `ARA 150→110 + jitter ±20`, `OMUR 14→22`, ilk teklif 45→40; `watchAd` başarısızsa `toast('Reklam şu an hazır değil', 'info')` + `adChipTimer=30`.
- Modify: `src/ui/HUD.ts` — çipe conic-gradient geri sayım halkası (`--p` CSS değişkeni, `showAdChip(kind, life)` + `setAdChipProgress(t01)`); beliriş pop animasyonu; `bus.emit('haptic')` + sfx `'chip'`.
- Modify: `src/ui/ui.css` — çip halka/animasyon stilleri.
- Modify: `src/ui/Panels.ts` — Ayarlar Gizlilik bölümüne tek satır: `Reklam durumu: ${adStatus()}`.
- Modify: `src/audio/Synth.ts` VEYA AudioManager sfx tablosuna `chip` tınısı (mevcut kalıpla 2 nota).

**Interfaces:** `setAdChipProgress(t: number)` Game.maybeOfferAd her kare çağırır (`adChipLife/OMUR`).

- [ ] Sağlayıcı + DevAdProvider + Ads köprüsü + typecheck
- [ ] Game reklam bölgesi + HUD/css çip + ses
- [ ] Doğrulama: dev tarayıcıda öğretici sonrası ~40 sn içinde çip belirir, halka 22 sn'de erir, İZLE→perde→ödül toast; `npm run build`'de "reklam" kelimesi UI'da yalnız sağlayıcı varken; commit

### Task B2 (SUBAGENT "labels"): Kilitli alan etiketleri + raf glifleri

**Files:**
- Modify: `src/world/Environment.ts` — `paintPad()` genişler: üst satır bölge adı, orta `₺fiyat`, alt `blurb` (12-14 px, 2 satır sarma) + istasyon glif sırası (ITEMS/istasyon glifleri, ≤4 glif); oda tabelasına kilitliyken ikinci şerit `sharedLabelMaterial(içerik, …)` — r1 "3 masa · özel salon", r2 "VIP teras · hesap ×2,4"; kilit açılınca şerit gizlenir (mevcut `door.lock.visible` kalıbı).
- Modify: `src/data/layouts.ts` — YALNIZ `blurb` metin güncellemeleri (yeni SKU'lara göre; a3 "Kahve barı: latte menüye girer." a4 "Tost makinesi ve tost rafı." a7 "Waffle büfesi." a8 "Frappe blender — menünün zirvesi.").
- Modify: `src/world/StationView.ts` — `sheet` grubuna depth-0 bölge istasyonları için küçük glif çipi (`setLocked(locked, hidden, showHint)` üçüncü parametre; `World.syncLocks` çağrısını A1 zaten `zoneDepth===0` bilgisiyle geçirecek — imza: `setLocked(locked: boolean, hidden: boolean, nextUp?: boolean)`).
- Modify: `src/world/PickupView.ts` — raf tepesine ürün glifi + `makeLabelPlate` adet ("☕ ×4"); `def.item` yoksa eski "TESLİM" davranışı.

**Interfaces:** `StationView.setLocked(locked, hidden, nextUp?)`; `PickupView` raf df.item okur (A1 üretti).

- [ ] paintPad + tabela şeridi + blurb güncellemeleri
- [ ] Tarp glif çipi + PickupView raf etiketi
- [ ] Doğrulama: dev'de `/__shot` 375×812 üç kare (kilitli ped, oda tabelası, raf hattı) `.devshots/v5-labels-*.png`; `validateSightlines` boş; typecheck; commit

---

## DALGA C (B bitince)

### Task C1 (SUBAGENT "char-mesh"): Karakter mesh diyeti (riskli, izole)

**Files:** `src/chars/CharacterRig.ts` (+ gerekirse `src/chars/CharacterAnimator.ts` okunur, DEĞİŞMEZ)

Eklem başına statik çocuk birleştirme (kafa kümesi: saç+şapka+yüz parçaları tek geometry; ayakkabı gövde+burun; kol: kol+dirsek yuvası). Hedef ≤14 mesh/aktör (high), ≤10 (LOD). `mat(p.face).clone()` başına aktör kalır (öfke tintine gerek var) ama gövde/uzuv malzemeleri paylaşımlı kalmalı.

- [ ] Birleştirme + typecheck
- [ ] SAYISAL doğrulama (konsol): koşu çevriminde kafa-gövde x-ofseti ≤0,05; ayak kayması %0 bandı (changelog v3.x ölçüm kalıbı `__fincan` üzerinden); mesh sayısı önce/sonra
- [ ] `/__shot` önce/sonra 375×812 koşu karesi; gözle fark yoksa commit; FARK VARSA GERİ AL ve raporla

### Task C2 (ANA OTURUM): Bot + ölçüm + kapanış

- [ ] `tools/balance-bot.js`: `report.served` kaynağı raf alışverişi (`stats.served` zaten oradan artar — sadece yorum + `seenStaff` rol adları + satın alma tavanları gözden geçir); botun rehber-takip politikası v5 fiilleriyle çalışır — 5 dk deneme koşusu, takılma varsa düzelt
- [ ] 2×50 dk senkron bot koşusu → kabul bantları (spec §6); sapma varsa denge sabitlerini ayarla (staff/balance), yeniden koş
- [ ] Perf ölçümü: `?perf=1` geç oyun çağrı/üçgen; `evaluateHeat` el testi (konsolda yapay workMs basarak in/çık)
- [ ] `/__shot` kare seti; `npm run build`; CHANGELOG "v5.0" bölümü + README güncelle (döngü anlatımı + bayat "100 çizim çağrısı" satırı)
- [ ] `npm run android:apk` (gradle varsa) → taze debug APK yolu rapora
- [ ] Son commit + kullanıcı özeti

## Öz-denetim notları

- Spec kapsaması: §1→A1, §2→A2(+A1 Game), §3→B1, §4→B2(+A1 balon silme), §6→C2. Boşluk yok.
- Tip tutarlılığı: `evaluateHeat(workMs, fps)` A1-A2 ortak; `setLocked(locked, hidden, nextUp?)` A1-B2 ortak; raf id listesi A1-B2 ortak.
- Bilinçli sapma: adım-başına-test yerine görev-başına-ölçüm (proje disiplini); tam kod blokları yerine spec + keşif file:line referansları (uygulayıcılar tam keşif raporlarıyla brieflenir).
