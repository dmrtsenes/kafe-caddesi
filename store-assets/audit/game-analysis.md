# Kaynak ve gerçek oynanış bulguları

İncelenen sürüm: 1.2.1, 13 Eylül 2026 çalışma ağacı. Mevcut çalışma ağacındaki önceden yapılmış değişiklikler korunur.

| Bulgu | Kaynak |
|---|---|
| Tek elle hareket; yakınlık ve duruşla otomatik etkileşim | `src/entities/Player.ts`, `src/core/Game.ts`, `README.md` |
| Üretim → tepsiye al → masadaki doğru siparişe veya paket rafına teslim | `src/sim/World.ts` `updateStationInteraction`, `src/sim/Orders.ts`, `src/entities/CarryStack.ts` |
| Kasiyer sipariş sırasını işler; parayı oyuncu toplar | `src/data/staff.ts`, `src/sim/World.ts` `collectCounterCash` |
| Bulaşık toplama ve ardından boş elle masa silme; süpürgeyle trafik kiri temizleme | `src/sim/World.ts`, `src/world/GrimeView.ts`, `src/world/VacuumAsset.ts` |
| Çay, latte, tost; ileride waffle/frappe; sahilde ayrı ürünler | `src/data/items.ts`, `src/data/stations.ts` |
| Para yatırılan alan/masa açma pedleri, salon ve VIP odaları, Sahil Şubesi | `src/data/layouts.ts`, `src/world/ZonePurchasePad.ts`, `src/core/Game.ts` |
| Hız, kapasite, el çabukluğu, hesap değeri geliştirmeleri | `src/data/upgrades.ts`, `src/sim/GameState.ts` |
| Tezgâhtar, kasiyer, komi, barista; sınırlı görev paylaşımı | `src/data/staff.ts`, `src/entities/Staff.ts` |
| Bahçe Çay Evi ve Avlu Paket Servisi yan işleri | `src/data/sideActivities.ts`, `src/sim/SideActivities.ts` |
| Hedefler, festival, prestij, dekor/üniforma ve iki dil | `src/data/goals.ts`, `src/sim/Festival.ts`, `src/data/prestige.ts`, `src/data/cosmetics.ts`, `src/core/I18n.ts` |
| Offline sürede stok hazırlığı; otomatik para kazanımı vaat edilmemeli | `README.md`, `src/data/upgrades.ts`, `src/sim/World.ts` |
| Petrol/krem/bakır iş kıyafetleri ve gerçek model ailesi | `src/chars/SignatureWardrobe.ts`, `src/chars/Workwear.ts`, `docs/KARAKTER-OZELLESTIRME-2026-09-12.md` |
| Üstten eğik kamera, gerçek cihaz görünümüyle ortak sahne | `src/world/CameraFraming.ts`, `src/world/Scene3D.ts`, `src/data/cafePresentation.ts` |

## Markaya etkisi

Temel vaat kahve demlemek veya pasif gelir beklemek değildir. Oyuncu işin içinde dolaşır, ellerini/tepsisini yönetir, masalarla kasa arasında öncelik seçer, temizlik yapar ve kazandığını yeniden yatırır. “Tepsilo” bu elde taşıma ve servis omurgasından türetildi. Logo ve ikon tepsi + çay + bakım parıltısını birleştirir. “Kafenin ritmi sende.” ifadesi hız garantisi veya müzik mekaniği iddiası taşımaz; iş akışının oyuncunun elinde olduğunu anlatır.

## Kullanılmayan eski içerik

`tools/make-store-shots.mjs` eski self-servis döngüsünü tarif ediyor. `reklam.html` altındaki eski konsept sahneler asıl oyundan farklı tasarım içerebiliyor. Bu dosyaların çıktıları yeni mağaza karelerinin kaynağı yapılmadı.

## Gözlenen sınırlama

Eski denge botu, yeni “SÜPÜRGEYİ BIRAK” düğmesine yanıt vermediği için bir denemede ilerlemeyi durdurdu. Çekim otomasyonuna yalnız mevcut düğmenin işlemi eklendi. Bu durum oyun kaynaklarında düzeltilmedi; değişiklik `store-assets/source/capture.mjs` içindedir. Çekimler bir performans, ekonomi dengesi veya gerçek oyuncu tutma ölçümü değildir.

Canlı oyundan alınan bütün son karelerin etkileşimi, taşınan ürünleri, istasyon yerleşimi, gerçek para/alan/ekip durumu, kamera, çözünürlük ve arayüz metni `capture-evidence.json` dosyasında saklanır.
