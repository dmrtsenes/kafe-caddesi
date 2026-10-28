import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor yapılandırması — Play Store / App Store paketlemesi.
 *
 * Oyun tamamen istemci tarafında çalıştığı için `webDir` doğrudan Vite
 * çıktısıdır; sunucu, izin veya ağ erişimi gerekmez.
 */
const config: CapacitorConfig = {
  appId: 'com.fincansokagi.game',
  appName: 'Kafe Caddesi',
  webDir: 'dist',

  android: {
    // WebView'de donanım hızlandırma ve GPU zaten varsayılan; oyunun kendi
    // kalite kademesi cihazı saptayıp ayar yapıyor (src/core/Quality.ts).
    backgroundColor: '#1d2b34',
    // Tam ekran oyun: klavye/uyarı katmanı içerik boyutunu değiştirmesin.
    webContentsDebuggingEnabled: false,
    // Native tarayıcı yakınlaştırmasını devre dışı bırak
    zoomEnabled: false,
  },

  ios: {
    backgroundColor: '#1d2b34',
    // Oyun kendi safe-area dolgusunu CSS ile yönetiyor.
    contentInset: 'never',
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      launchAutoHide: true,
      backgroundColor: '#1d2b34',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
