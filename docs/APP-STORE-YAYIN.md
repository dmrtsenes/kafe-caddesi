# Kafe Caddesi — Apple App Store & Codemagic Yayın Kılavuzu

Bu kılavuz, **Kafe Caddesi** (`com.fincansokagi.game`) oyununun Mac bilgisayar gerekmeden **Codemagic** üzerinden derlenip **Apple App Store**'da ilk seferde onay alacak şekilde yayınlanması ve onay sonrasında **AdMob iOS** reklamlarının devreye alınması için hazırlanmıştır.

---

## 1. Apple İncelemesinden Reddedilmemek İçin Yapılan Teknik Hazırlıklar

Projede Apple App Store Review Guidelines kapsamında redde yol açabilecek tüm noktalar kapatılmıştır:

1. **Guideline 2.3.10 (Rakip Platform Atıfları — "Google Play" / "Play Store")**:
   - `src/ui/Panels.ts` ve `src/i18n/en.json` içinde iOS platformu algılandığında (`isIos`) hiçbir yerde `"Google Play"`, `"Play Store"` veya `play.google.com` bağlantısı gösterilmez.
   - Uygulama henüz App Store'da yayınlanmadan önce (`VITE_IOS_APP_STORE_URL` boşken) dış mağaza puanlama butonu gizlenir (ölü bağlantı oluşmaz), paylaşım butonu ise yalnızca temiz paylaşım metni üretir.
2. **Guideline 2.1 (Uygulama Bütünlüğü — Çökme Önleme & "Test Ad" Engeli)**:
   - İlk App Store incelemesinde iOS AdMob reklam birimleri (`VITE_IOS_ADMOB_REWARDED_ID`, `VITE_IOS_ADMOB_INTERSTITIAL_ID`) henüz tanımlı değilken oyun `VITE_ADMOB_MODE=production` modunda **%100 reklamsız** çalışır; inceleme ekibine asla `"Test Ad"` etiketi gösterilmez ve oyun içinde çalışmayan reklam butonu çıkmaz (`Ads.ts` hazır olmayan reklam butonlarını otomatik gizler).
   - `ios/release.xcconfig` içine güvenli başlangıç `ADMOB_APP_ID` yedek değeri eklendi; böylece `Info.plist` içindeki `GADApplicationIdentifier` asla boş kalmaz ve `GADInvalidInitializationException` çökmesi yaşanmaz.
3. **Guideline 5.1.2(i) (App Tracking Transparency — ATT İzni)**:
   - `src/core/AdMobProvider.ts` içinde iOS'ta açılış ekranı kapandıktan 1.5 saniye sonra (`AdMob.requestTrackingAuthorization()`) sistem ATT izin penceresi tetiklenir.
   - `ios/App/App/en.lproj/InfoPlist.strings` ve `tr.lproj/InfoPlist.strings` ile ATT açıklama metni hem Türkçe hem İngilizce (ABD'deki Apple inceleme ekibi için) yerelleştirildi.
   - Google'ın resmî 49 adet `SKAdNetworkItems` kimliği `ios/App/App/Info.plist` dosyasına eklendi.
4. **ITMS-91053 (Apple Privacy Manifest — `PrivacyInfo.xcprivacy`)**:
   - `ios/App/App/PrivacyInfo.xcprivacy` oluşturuldu ve `project.pbxproj` kaynaklarına bağlandı (`NSPrivacyAccessedAPICategoryUserDefaults` `CA92.1`, `FileTimestamp` `C617.1`, `SystemBootTime` `35F9.1`, `DiskSpace` `E174.1` ve veri kategorileri).
5. **ITMS-90474 (iPad Dikey Ekran Kilidi) & Şifreleme Beyanı**:
   - `ios/App/App/Info.plist` içine `<key>UIRequiresFullScreen</key><true/>` eklendi (iPad'de tüm yönleri zorunlu kılan Split View hatasını önler).
   - `<key>ITSAppUsesNonExemptEncryption</key><false/>` eklendi (TestFlight / App Store yüklemelerinde her seferinde "Missing Export Compliance" sorulmasını önler).
6. **Uygulama İkonu ve Açılış Ekranı (Guideline 2.3.8)**:
   - `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png` 1024×1024 piksel, alfa kanalsız (tam opak RGB) güncel **Kafe Caddesi** ikonuyla güncellendi.
   - `Splash.imageset` içindeki eski "Fincan Sokağı" görselleri güncel **Kafe Caddesi** açılış ekranlarıyla değiştirildi.

---

## 2. Adım Adım Apple Developer & App Store Connect Kurulumu

### Adım 2.1 — Bundle ID Kaydı
1. [developer.apple.com/account](https://developer.apple.com/account) → **Certificates, Identifiers & Profiles** → **Identifiers** bölümüne gidin.
2. **+** butonuna tıklayıp **App IDs** → **App** seçin.
3. **Description**: `Kafe Caddesi`
4. **Bundle ID (Explicit)**: `com.fincansokagi.game`
5. **Continue** → **Register** ile kaydedin.

### Adım 2.2 — App Store Connect'te Uygulamayı Oluşturma
1. [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → **Apps** → **+** → **New App** seçin.
2. Alanları doldurun:
   - **Platforms**: iOS
   - **Name**: `Kafe Caddesi` (veya İngilizce mağaza adı olarak `Cafe Avenue: Idle Coffee`)
   - **Primary Language**: Turkish (Türkçe)
   - **Bundle ID**: `com.fincansokagi.game`
   - **SKU**: `kafe-caddesi-ios-001`
   - **User Access**: Full Access
3. Uygulama oluşturulduktan sonra sol menüden **General** → **App Information** sayfasına gidin ve **Apple ID** (ör. `673XXXXXXX` biçimindeki 10 haneli sayı) değerini not alın.

### Adım 2.3 — App Store Connect API Anahtarı (Codemagic İçin)
1. App Store Connect → **Users and Access** → **Integrations** → **App Store Connect API** (`Team Keys`) sekmesine gidin.
2. **Generate API Key** (veya **+**) butonuna tıklayın:
   - **Name**: `Codemagic`
   - **Access**: `App Manager` (veya `Admin`)
3. Oluşan anahtarın:
   - **Issuer ID** (üstte yazar)
   - **Key ID**
   - İndirilen **`AuthKey_XXXXXXXXXX.p8`** dosyasını bilgisayarınıza kaydedin.

---

## 3. Codemagic Kurulumu ve İlk IPA Derlemesi

1. [codemagic.io](https://codemagic.io) hesabınıza giriş yapın ve Git deponuzu bağlayın.
2. Sol menüden **Teams / Settings** → **Integrations** → **Developer Portal / App Store Connect** bölümüne gidin:
   - Entegrasyon adını **`Codemagic_AppStoreConnect`** olarak girin (`codemagic.yaml` içindeki `integrations.app_store_connect` adıyla birebir aynı olmalıdır).
   - **Issuer ID**, **Key ID** ve **`AuthKey_XXXXXXXXXX.p8`** dosyasını yükleyip kaydedin.
3. Codemagic'te uygulamanızı seçin → **Environment variables** sekmesine gidin ve şu değişkeni ekleyin:
   - `APP_STORE_APPLE_ID`: App Store Connect'teki 10 haneli Apple ID numaranız (ör. `6731234567`) — derleme numarasını otomatik artırmak için kullanılır.
4. **Start new build** → **`ios-app-store`** iş akışını (workflow) seçip derlemeyi başlatın.
5. Codemagic otomatik olarak:
   - Apple sertifikasını ve Provisioning Profile'ı oluşturur,
   - `npm run build` ve `npx cap sync ios` çalıştırır,
   - `.ipa` dosyasını imzalayıp doğrudan **App Store Connect / TestFlight**'a yükler.

---

## 4. App Store Connect Mağaza Bilgileri ve Gizlilik Formu (Reddedilmemek İçin)

Derleme TestFlight'a düştükten sonra App Store Connect'te şu alanları doldurun:

1. **Gizlilik Politikası URL'si (Privacy Policy URL)**:
   - `https://sites.google.com/view/fincan-sokagi-gizlilik` (oyun içi Ayarlar → Gizlilik Politikası bağlantısıyla birebir aynı olmalı ve yayında/açılır durumda olmalıdır).
2. **Destek URL'si (Support URL)**:
   - Gizlilik politikası sayfanızın adresini veya iletişim bilginizin bulunduğu bir Google Sites / GitHub Pages sayfasını girebilirsiniz.
3. **App Privacy (Uygulama Gizliliği Anketi)**:
   - `PrivacyInfo.xcprivacy` ile uyumlu olması için:
     - **Do you or your third-party partners collect data from this app?** → **Yes**
     - Seçilecek veri türleri:
       - **Identifiers → Device ID**: Collected for *Third-Party Advertising*, Not Linked to User, Used for Tracking = **Yes**.
       - **Usage Data → Product Interaction & Advertising Data**: Collected for *Third-Party Advertising & Analytics*, Not Linked to User, Used for Tracking = **Yes**.
       - **Diagnostics → Crash Data & Performance Data**: Collected for *App Functionality*, Not Linked to User, Used for Tracking = **No**.
4. **Yaş Sınırı (Age Rating)**:
   - Tüm şiddet/kumar/yetişkin içerik sorularına **None / No** işaretleyin → **4+** olarak çıkacaktır.
5. **App Review Information (İnceleme Notları)**:
   - **Sign-in required**: Kutucuğu **İŞARETLEMEYİN** (oyunda giriş/hesap zorunluluğu yoktur).
   - **Notes** kısmına şu notu ekleyebilirsiniz:
     > *"Cafe Avenue (Kafe Caddesi) is a 3D single-player idle coffee shop management game. No account or login is required. All core gameplay features are immediately accessible upon launch. The App Tracking Transparency (ATT) prompt is presented automatically on first launch after the main scene loads."*

---

## 5. Onay Sonrası AdMob iOS Reklamlarını Aktif Etme

Uygulamanız App Store'da yayınlandıktan sonra:

1. [admob.google.com](https://admob.google.com) → **Uygulamalar** → **Uygulama Ekle** → **iOS** seçin ve uygulamayı App Store'da aratıp bağlayın.
2. AdMob size şu 3 kimliği verecektir:
   - **iOS Uygulama Kimliği (App ID)**: `ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY` (tilde `~` içerir)
   - **iOS Ödüllü Reklam Birimi (Rewarded)**: `ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY`
   - **iOS Geçiş Reklamı Birimi (Interstitial)**: `ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY`
3. **Hiçbir kaynak kodu değiştirmeden** Codemagic → **Environment variables** bölümüne şu 4 değişkeni ekleyin:
   - `IOS_ADMOB_APP_ID` = `ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY`
   - `VITE_IOS_ADMOB_REWARDED_ID` = `ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY`
   - `VITE_IOS_ADMOB_INTERSTITIAL_ID` = `ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY`
   - `VITE_IOS_APP_STORE_URL` = `https://apps.apple.com/app/idXXXXXXXXXX` (uygulamanızın App Store linki)
4. Codemagic'ten yeni bir derleme başlatın. Yeni sürümde hem canlı iOS AdMob reklamları hem de Ayarlar'daki **"⭐ App Store'da Puanla"** butonu otomatik olarak aktif olacaktır.
