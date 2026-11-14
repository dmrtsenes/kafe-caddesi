# Kafe Caddesi — App Store Ret Çözümü (4.3 & 4.2.6) ve Resmi İnceleme Cevabı

Bu belge, **Kafe Caddesi** (`com.fincansokagi.game`, App ID `6827967983`) için `1.0.6 (15)` sürümüne verilen **Guidelines 4.3 (Spam)** ve **4.2.6 (App Generation Services)** reddinin kök nedenlerini, `1.1.0 (16)` sürümünde yapılan teknik/görsel düzeltmeleri, yükleme öncesi kontrol listesini ve Apple'a gönderilecek **9 soruluk tam İngilizce cevabı** içerir.

---

## 1. Reddin Kök Nedenleri ve Yapılan Düzeltmeler

### A. Guideline 4.3(a)/(b) — Dış Kaynaklı Karakter Paketi ve İnce Wrapper Sinyalleri
- **Sorun 1 (Kullanılmayan Yedek Karakter Paketi ve İnce Wrapper Sinyalleri):** Projede hem ana karakter seti (`public/packs/current-cast/`) hem de kullanılmayan yedek alternatif karakter klasörü (`public/packs/quaternius/` + `PackCharacters.ts`) bulunuyordu; bu yapı ince/şablon uygulama sinyali verebiliyordu.
  - **Çözüm:** Kullanılmayan alternatif karakter klasörü (`public/packs/quaternius/` ve `src/chars/PackCharacters.ts`) depodan ve derlemeden tamamen kaldırıldı; `vite.config.ts` ve `tools/release-assets.mjs` doğrulama koruyucularıyla tekrar dahil edilmeleri engellendi. Yayınlanan karakter seti (`public/packs/current-cast/`: `PlayerS01.fbx`, `CustomerMan.glb`, `CustomerWoman.glb`, `ColorPalette01.png`) çalışma anında Kafe Caddesi'ne özgü rol bazlı UV kıyafet gölgelendiricisi (`Workwear.ts`), prosedürel önlük/askı/atkı/şapka/çanta/kupa rozeti geometrileri (`SignatureWardrobe.ts`), iki elli tepsi IK (`ServiceArms.ts`) ve süpürge itme katmanı (`PushArms.ts`) ile giydirilip tek `SkinnedMesh` (`SkinBatch.ts`) altında birleştirilir.
- **Sorun 2 (İnce WebView / Capacitor Sinyalleri):** `SceneDelegate.swift` doğrudan ham `CAPBridgeViewController()` açıyordu; iOS'a özgü Swift çerçeveleri (`StoreKit`, `CoreHaptics`, `AVAudioSession`, `ProcessInfo.thermalState`) bağlı değildi, `ios/release.xcconfig` içinde `CAPACITOR_DEBUG = false` yoktu ve `src/main.ts` hata mesajlarında *"tarayıcı ayarlarından... / refresh page"* ifadeleri vardı.
  - **Çözüm:** `GameBridgeViewController.swift` ve `IosGameNativePlugin.swift` yazıldı (`StoreKit` `SKStoreReviewController`, `CoreHaptics` `CHHapticEngine`, `AVAudioSession` ambient mixing + kesinti yöneticisi, iOS termal + Düşük Güç Modu takibi, `WKWebView` bounce/link-preview kilidi). `ios/release.xcconfig` güncellendi, `manifest.webmanifest` / `pwa-*.png` / `app-ads.txt` gibi web dosyaları native iOS paketinden temizlendi ve `1.1.0 (16)` sürümüne çıkıldı.

### B. Guideline 4.2.6 — Marka Tutarsızlığı ("Tepsilo", "Cafe Avenue", Zenith Lab vs. Enes Demirtaş)
- **Sorun:** App Store Connect medya alanındaki ekran görüntüleri eski `"Tepsilo"` markasını taşıyordu, İngilizce `InfoPlist.strings` uygulama adını `"Cafe Avenue"` gösteriyordu ve canlı gizlilik politikası yalnızca `"Zenith Lab / beytugrul571@gmail.com"` adını içeriyordu (Apple geliştirici hesabı **"Enes Demirtaş"** / `dmrtsenes35@gmail.com`).
- **Çözüm:**
  - Tüm `"Tepsilo"` kalıntıları (`index-tepsilo-archived.html`, `tepsilo-google-play.zip`, eski ekran görüntüleri ve eski SVG şablonları) silindi.
  - `ios/App/App/en.lproj/InfoPlist.strings` içinde uygulama adı **`"Kafe Caddesi"`** olarak eşitlendi.
  - `docs/gizlilik-politikasi.html` ve `docs/gizlilik-politikasi-google-sites.md` dosyaları `1.1.0` sürümüyle güncellenerek oyunun **Enes Demirtaş** tarafından geliştirilip yayınlandığı (Google Play'de stüdyo etiketi **Zenith Lab** altında, iletişim `dmrtsenes35@gmail.com`) açıkça belirtildi.
  - `tools/render-1179-screenshots.mjs` (`1179x2556` iPhone) ve `tools/render-ipad-screenshots.mjs` (`2048x2732` iPad) canlı `1.1.0` 3B oynanışından şeffafsız (RGB) **KAFE CADDESİ** ekran görüntüleri üretecek şekilde yeniden oluşturuldu.

---

## 2. Yeniden Göndermeden Önce Yapılacak Zorunlu Adımlar (Sırayla)

1. **Canlı Gizlilik Politikası Sayfasını Güncelle (ÇOK ÖNEMLİ):**
   - `docs/gizlilik-politikasi-google-sites.md` içindeki güncel `1.1.0` metnini kopyalayıp Google Sites üzerindeki canlı gizlilik politikası sayfana (`https://sites.google.com/view/fincan-sokagi-gizlilik`) yapıştır ve **Yayınla (Publish)** tuşuna bas.
   - Bu adımda amaç, inceleme ekibinin URL'yi açtığında **Enes Demirtaş** ve `dmrtsenes35@gmail.com` bilgisini doğrudan görmesidir.
2. **Yeni `1.1.0 (16)` İPA Paketini Codemagic ile Oluştur:**
   - Bu depodaki değişiklikleri `main` dalına push et. `codemagic.yaml` otomatik olarak `npm run build && npx cap sync ios`, web-only temizliği, `1.1.0` sürüm numarası ve TestFlight yüklemesini çalıştıracaktır.
3. **Gerçek TestFlight Beta Testi Yap (Soru 4 İçin Şart):**
   - Yeni `1.1.0` derlemesini TestFlight'a aktardıktan sonra gerçek birkaç test kullanıcısıyla (en az 2–3 kişi, farklı iPhone/iPad ekranlarında) oynanış testi yap ve aldığın gerçek geri bildirimlere dayanarak tespit ettiğin somut iyileştirmeleri (ör. kontrol hassasiyeti, performans/ısı veya erken aşama dengesi) not et. Aşağıdaki 4. soruda köşeli parantez içindeki yerleri **kendi gerçek TestFlight notlarınla** doldur.
4. **App Store Connect Ekran Görüntülerini Yenile:**
   - Eski `"Tepsilo"` başlıklı tüm görselleri sil.
   - `store-assets/ios-screenshots-1179/01-serve.png` .. `06-growth.png` dosyalarını **iPhone 6.5" / 6.7" Ekran** alanına yükle.
   - `store-assets/ipad-screenshots-2048x2732/01-serve.png` .. `06-growth.png` dosyalarını **iPad 13" Ekran** alanına yükle.
   - App Review'daki App Store görselleri ve Gizlilik URL'sinin hepsinin `"Kafe Caddesi"` adını ve `Enes Demirtaş` kimliğini yansıttığından emin ol.
5. **1.1.0 Derlemesi + Cevap Metni Birlikte Gönder:**
   - Önce yeni `1.1.0` derlemesini App Version sayfasında seç, ardından App Review Resolution Center üzerinden aşağıdaki 9 soruluk İngilizce yanıtı yapıştırıp yeni derlemeyi incelemeye gönder.

---

## 3. Apple App Review'a Yapıştırılacak 9 Soruluk İngilizce Yanıt

> Not: **Soru 4** içindeki `[TESTFLIGHT TESTER COUNT AND CONCRETE FEEDBACK]` kısmını, yeni `1.1.0` TestFlight turunu tamamladıktan sonra gerçek test verilerinle güncelledikten sonra gönder.

```text
Hello App Review Team,

Thank you for the detailed feedback regarding Guidelines 4.3 and 4.2.6. We took this review very seriously and audited the entire project before preparing build 1.1.0. During that audit, we discovered two legacy issues in our previous submission (1.0.6):
1. Some earlier App Store screenshots carried an internal working title ("Tepsilo"), our English InfoPlist.strings showed "Cafe Avenue", and our privacy policy page listed only our Google Play studio alias ("Zenith Lab") instead of clearly identifying the developer account holder ("Enes Demirtaş").
2. Our previous repository still contained an unused duplicate alternative character asset pack (`quaternius`) alongside unused template code (`PackCharacters.ts`).

In build 1.1.0, we removed the unused duplicate character pack and template modules, retained our single canonical stylized Mixamo-rigged character set (`public/packs/current-cast/`) overlaid at runtime with custom Kafe Caddesi role-based UV workwear shaders (`Workwear.ts`), procedural cafe aprons/scarves/hats/satchels/cup badges (`SignatureWardrobe.ts`), two-hand tray IK (`ServiceArms.ts`), sweep kinematics (`PushArms.ts`), and single-draw-call `SkinnedMesh` batching (`SkinBatch.ts`), integrated deeper native iOS Swift frameworks (StoreKit SKStoreReviewController, CoreHaptics CHHapticEngine, AVAudioSession mixing/interruption handling, ProcessInfo thermal & Low Power Mode scaling), unified all store screenshots, localization strings, and privacy disclosures under "Kafe Caddesi" and "Enes Demirtaş", and generated new screenshots directly from live 1.1.0 gameplay.

Below are our complete answers to each of your 9 questions:

1. Describe in detail what this app does and the primary problem it solves for users. Do not use the App Store marketing description as your response.
Kafe Caddesi (bundle ID com.fincansokagi.game) is a real-time 3D hybrid-casual cafe management and service-loop game built with a custom TypeScript simulation engine and a batched Three.js/WebGL rendering pipeline hosted inside a native iOS shell. The player controls a cafe owner moving freely via touch-joystick in 3D space across multiple stations: brewing tea, espresso, latte, toast, and ice-cream orders; stocking self-service display shelves; collecting payments at dual cashier queues; wiping dirty tables and floor spills; repairing broken machines; chasing dine-and-dash runners; handling influencer visits; and hiring/upgrading four specialized staff roles (Waiter, Cashier, Barista, Busser) while unlocking rooms zone by zone. The primary user goal it solves is delivering an active, tactile, single-handed arcade cafe simulation with meaningful spatial bottlenecks (stock vs. table cleanliness vs. queue flow vs. machine durability) that runs smoothly offline with persistent local backup and zero mandatory paywalls or forced sign-ups.

2. Who is the intended user of this app? Provide a detailed description of the specific target audience.
The intended users are casual and hybrid-casual mobile gamers (ages 13+)—particularly in Turkish and English-speaking markets—who enjoy time-management, arcade-tycoon, and cozy shop-runner games suited for short 3–10 minute portrait-mode play sessions on iPhone and iPad, while also offering multi-branch prestige progression, uniform/accessory cosmetics, and strategic staffing depth for longer multi-day play.

3. What need or gap in the market does this app address that existing apps do not currently address, or address less effectively? Provide a detailed, substantive explanation.
Many existing arcade-idle cafe games on the App Store either turn passive after the first two minutes (reducing gameplay to tapping static menus while automated timers run), overwhelm the screen with intrusive forced interstitial ads between short tasks, or suffer from heavy thermal throttling and dropped frames on mid-tier devices due to unbatched 3D characters. Kafe Caddesi addresses this gap through three concrete mechanics and engineering choices:
- An authentic self-service spatial loop combined with active hazards: guests take items from shelves themselves and dine at tables, creating real bottlenecks across hygiene (dirty tables/spills reduce tips and comfort), restocking, dasher chases, and dual-register queues rather than passive progress bars.
- Player agency over monetization: progression never hits an artificial paywall, and optional rewarded offers are contextual to immediate cafe bottlenecks (temporary 2× boost, emergency repair, rush hour, VIP investor).
- Custom native-adaptive performance budget: single-draw-call merged SkinnedMesh characters (SkinBatch), static architecture baking, cached directional light shadows, and iOS ProcessInfo thermalState + Low Power Mode adaptation keep frame pacing steady across iPhones and iPads without thermal spikes.

4. What beta testing did you conduct before submitting the app for review? Provide examples of user feedback provided in beta that was applied to the production build.
For build 1.1.0, we distributed builds via Apple TestFlight and ran hands-on playtesting sessions across iPhone and iPad devices ([FILL IN YOUR EXACT TESTFLIGHT TESTER COUNT AND DATES FROM THE 1.1.0 TESTFLIGHT RUN]). Examples of concrete tester feedback applied to this build include:
- [EXAMPLE 1: Replace with exact tester feedback from TestFlight, e.g., testers noticed table cleaning bottlenecks slowed early-game pacing and requested clearer floor-spill/dirty-table indicators and responsive haptic cues -> tuned CoreHaptics transient feedback and table hygiene indicators.]
- [EXAMPLE 2: Replace with exact tester feedback from TestFlight, e.g., testers playing on mobile requested audio mixing compatibility when listening to background music -> configured AVAudioSession .ambient with .mixWithOthers and interruption recovery in GameBridgeViewController.swift.]
- [EXAMPLE 3: Replace with exact visual/UI feedback from TestFlight -> verified readable staff/customer silhouettes via custom aprons/caps and updated English/Turkish localization strings.]

5. Is this app intended to function as a standalone product, or is it part of a suite of related apps published under your developer account? If part of a suite, provide a detailed description of how this app's scope and functionality differ from each other app in the suite.
Kafe Caddesi is a 100% standalone product. There are no companion apps, reskinned variants, or related suite apps on our Apple Developer account (Team ID 56U6MSYVM3 / Enes Demirtaş). It is our sole iOS application.

6. Could the functionality of this app be fully delivered as an in-app purchase, feature expansion, or content addition within any other app on your developer account? If so, provide a detailed explanation of why this functionality was not consolidated into that existing app.
No. We have no other apps on our Apple Developer account, so there is no existing app into which Kafe Caddesi's gameplay or engine could be consolidated.

7. Does this app's binary share any significant code, frameworks, or assets with any other app on your developer account, beyond standard third-party frameworks? If so, identify each shared component and describe its role in detail.
No. Because Kafe Caddesi is the only app under our Apple Developer account, the binary shares zero proprietary code, frameworks, or assets with any other app on our account.

8. Does this app share any codebase, SDK, or content library with any third-party app, beyond standard third-party frameworks? If so, identify the shared component and provide a detailed explanation of the original functionality this app adds beyond it.
No proprietary codebase, third-party game template, or app-generation SDK is shared with any third-party app. All simulation logic, cafe progression balancing, multi-location economies, custom shader/palette batching, UI/localization, and bespoke native iOS bridge code (GameBridgeViewController.swift and IosGameNativePlugin.swift) were authored specifically for Kafe Caddesi. Standard open/licensed third-party dependencies used are strictly infrastructure and base CC0 building blocks:
- Standard Capacitor iOS runtime, Three.js 3D renderer, Google Mobile Ads SDK / UMP, and Firebase Analytics.
- Standard CC0-1.0 public-domain starter environment furniture models (Kenney) paired with custom Three.js architectural geometry, cafe signage, and textures.
- Canonical stylized Mixamo-rigged low-poly character set (`public/packs/current-cast/`: `PlayerS01.fbx`, `CustomerMan.glb`, `CustomerWoman.glb`, `ColorPalette01.png`) paired at runtime with custom Kafe Caddesi procedural aprons/scarves/satchel bags/cup crest badges (`SignatureWardrobe.ts`), custom vertex-channel palette uniform shaders (`Workwear.ts`), single-draw-call `SkinnedMesh` batching (`SkinBatch.ts`), procedural two-hand tray IK (`ServiceArms.ts`), and sweep arm layers (`PushArms.ts`). Unused alternative character packs were purged from the repository and guarded against re-inclusion in the build pipeline.

9. Was this app created for a client, partner, or other third party who provided the app's content, concept, or branding? If so, identify who provided the content and provide a detailed explanation of why the app is submitted under your developer account rather than theirs. Note that guideline 4.2.6 requires apps built from a commercial template or app generation service to be submitted directly by the provider of the app's content, not on their behalf by the template or service provider.
No. Kafe Caddesi was not created for any client, agency, partner, or external brand, and it was not generated from any commercial template or app generation service. I (Enes Demirtaş) am the independent solo creator, developer, and owner of the game's concept, codebase, custom 3D modifications, and branding. For transparency: on Google Play we display the indie studio label "Zenith Lab", whereas on the Apple App Store our individual developer account is under my legal name, Enes Demirtaş. We also removed legacy working-title assets ("Tepsilo") and updated our live Privacy Policy to explicitly document both Enes Demirtaş and the Zenith Lab label with direct developer contact at dmrtsenes35@gmail.com.

Sincerely,
Enes Demirtaş
dmrtsenes35@gmail.com
```
