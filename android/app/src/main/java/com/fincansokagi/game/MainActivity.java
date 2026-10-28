package com.fincansokagi.game;

import android.content.pm.ApplicationInfo;
import android.os.Build;
import android.os.Bundle;
import android.view.ActionMode;
import android.view.Menu;
import android.view.MenuItem;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.core.splashscreen.SplashScreen;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

/**
 * Oyun aktivitesi.
 *
 * WebView container'ı %100 yerel bir oyun motoru (Unity/Godot) gibi davranacak
 * şekilde yapılandırılır:
 *  1) SPLASH: Android 12+ SplashScreen kütüphanesi başlatılarak beyaz parlama önlenir.
 *  2) TAM EKRAN (immersive sticky) + Çentik (Cutout) uzantısı: Durum ve gezinme
 *     çubukları gizlenir, kenardan kaydırınca geçici görünür. Reklam (AdMob)
 *     ve odak değişimlerinde kalıcılık korunur.
 *  3) EKRAN AÇIK KALIR (FLAG_KEEP_SCREEN_ON): Idle akışında ekran sönmez.
 *  4) DONANIM HIZLANDIRMA: Pencere ve WebView düzeyinde GPU hızlandırması ve
 *     OOM koruması (RENDERER_PRIORITY_IMPORTANT) zorlanır.
 *  5) OVERSCROLL & SCROLLBAR İPTALİ: Android 12+ esneme (stretch) efekti ve
 *     istenmeyen yerel kaydırma çubukları tamamen kapatılır.
 *  6) METİN YAKINLAŞTIRMA KİLİDİ: Sistem erişilebilirlik yazı boyutu büyütülse dahi
 *     oyun içi arayüzün kaymasını önlemek için %100'e sabitlenir.
 *  7) UZUN BASMA & BAĞLAM MENÜSÜ İPTALİ: Dokunmatik kontroller sırasında yerel
 *     "Kopyala/Paylaş" menüsü ve titreşim engellenir.
 */
public class MainActivity extends BridgeActivity {

  @Override
  public void onCreate(Bundle savedInstanceState) {
    SplashScreen.installSplashScreen(this);
    registerPlugin(DeviceThermalPlugin.class);
    super.onCreate(savedInstanceState);

    // 1. Pencere düzeyinde donanım hızlandırmasını garantiye al
    getWindow().setFlags(
        WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
        WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED);

    // 2. Ekranın oyun sırasında açık kalmasını sağla
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

    // 3. Çentik (Camera Cutout / Notch) alanını kısa kenarlara genişlet (API 28+)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      WindowManager.LayoutParams lp = getWindow().getAttributes();
      lp.layoutInDisplayCutoutMode =
          WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
      getWindow().setAttributes(lp);
    }

    // 4. Kenardan kenara (Edge-to-Edge) ve kalıcı sticky immersive mod
    WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    applyImmersive();

    // 5. Yerel WebView kabını yapılandır
    configureNativeGameWebView();
  }

  @Override
  public void onWindowFocusChanged(boolean hasFocus) {
    super.onWindowFocusChanged(hasFocus);
    // AdMob tam ekran reklamları, sistem paneli veya klavye sonrası çubukları yeniden gizle
    if (hasFocus) {
      applyImmersive();
    }
  }

  @Override
  public void onResume() {
    super.onResume();
    // Arka plandan veya harici intent/reklam dönüşünden sonra tam ekranı tazele
    applyImmersive();
  }

  private void applyImmersive() {
    View decor = getWindow().getDecorView();
    WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), decor);
    if (controller != null) {
      controller.setSystemBarsBehavior(
          WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
      controller.hide(WindowInsetsCompat.Type.systemBars());
    }
  }

  private void configureNativeGameWebView() {
    WebView webView = getBridge() != null ? getBridge().getWebView() : null;
    if (webView == null) return;

    // Sadece debug derlemelerinde uzaktan hata ayıklamaya izin ver
    boolean isDebuggable =
        (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
    WebView.setWebContentsDebuggingEnabled(isDebuggable);

    // 1. Overscroll glow ve Android 12+ rubber-band stretch efektini iptal et
    webView.setOverScrollMode(View.OVER_SCROLL_NEVER);

    // 2. Yatay ve dikey yerel kaydırma çubuklarını tamamen devre dışı bırak
    webView.setHorizontalScrollBarEnabled(false);
    webView.setVerticalScrollBarEnabled(false);
    webView.setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY);
    webView.setScrollBarSize(0);

    // 3. Donanım hızlandırma denetimi & Renderer önceliği
    if (webView.getLayerType() == View.LAYER_TYPE_SOFTWARE) {
      webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
    }
    // Android Oreo (API 26+) ile gelen izole render sürecini OOM katiline karşı koru
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      webView.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, true);
    }

    // 4. WebSettings yapılandırması
    WebSettings settings = webView.getSettings();
    if (settings != null) {
      // Sistem erişilebilirlik yazı boyutu büyütülse bile arayüzün bozulmaması için %100'e kilitle
      settings.setTextZoom(100);

      // Yakınlaştırma (zoom) ve ekrandaki +/- kontrollerini kapat
      settings.setSupportZoom(false);
      settings.setBuiltInZoomControls(false);
      settings.setDisplayZoomControls(false);

      // Otomatik metin boyutlandırma algoritmasını standart tut
      settings.setLayoutAlgorithm(WebSettings.LayoutAlgorithm.NORMAL);

      // Dokunmatik gecikmesini düşür ve gereksiz odak aramayı engelle
      settings.setNeedInitialFocus(false);
    }

    // 5. Uzun basma, titreşim ve yerel bağlam menülerini bastır
    webView.setLongClickable(false);
    webView.setHapticFeedbackEnabled(false);
    webView.setOnLongClickListener(v -> true);

    // 6. Yanlışlıkla sürüklenebilecek öğeler için yerel Drag & Drop'u tüket (API 24+)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      webView.setOnDragListener((v, event) -> true);
    }
  }

  @Override
  public ActionMode onWindowStartingActionMode(ActionMode.Callback callback) {
    return null;
  }

  @Override
  public ActionMode onWindowStartingActionMode(ActionMode.Callback callback, int type) {
    return null;
  }
}
