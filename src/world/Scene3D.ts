import { cameraFraming } from './CameraFraming';
import { ITEMS, type ItemId } from '../data/items';
import { createProductMesh, createPackProductInstanced } from './ProductMesh';
import { createCharacterWarmup } from '../chars';
import { ViewOcclusion } from './ViewOcclusion';
import { EdgeSmoothing } from './EdgeSmoothing';
import { renderSurfaceLabels } from './SurfaceLabel';
import { StaticSceneCache } from "./StaticSceneCache";
import { takeMaterialWarms } from "./MaterialWarmup";
import { renderPixelRatio } from "../core/RenderBudget";
import * as THREE from "three";
import { BALANCE } from "../data/balance";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { LocationPalette } from "../data/layouts";
import { clamp, damp } from "../core/MathUtils";
import {
  ANISOTROPY_CAP_DESKTOP,
  ANISOTROPY_CAP_MOBILE,
  DPR_CAP,
  MOBILE_SHADOWS,
  MOBILE_SHADOW_MAP_MAX,
  type QualityTier,
} from "../core/Quality";
import { isNative } from "../core/Native";
import { LAYER_DYNAMIC, LAYER_STATIC, LAYER_SURFACE_LABEL } from "./layers";

const DEG = Math.PI / 180;
const FOG_NEAR = 55;
const FOG_FAR = 130;
const CAMERA_FAR = FOG_FAR + 8;
/**
 * Yakın düzlem kameranın uzaklığına bağlıdır. Kamera sahnenin en az ~20 birim
 * uzağındadır; 0,5'lik sabit near, derinlik çözünürlüğünü (∝ 1/near) gereksiz
 * yere ezer. 24 bit derinlikte fark edilmez, ama 16 bit/düşük hassasiyetli
 * derinlik tamponu veren cihazlarda zemin kaplamaları, lekeler ve gölgeler
 * birbiriyle "z-fight" yapıp pır pır titrer. Ölçüm (tools/depth-probe.mjs,
 * 16 bit eşdeğeri): near 0,5 iken kare başına 10-78 bin piksel titriyordu.
 * Çarpan, kameraya en yakın kırpılması gereken nesneden (tavan/saçak) güvenli
 * uzaklıkta kalacak kadar küçük tutulur.
 */
const NEAR_PER_DISTANCE = 0.3;
const NEAR_MIN = 0.5;
const NEAR_MAX = 8;

const _target = new THREE.Vector3();
const _offset = new THREE.Vector3();
const _proj = new THREE.Vector3();
const WARM_TEXTURE_SLOTS = ['map', 'alphaMap', 'emissiveMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'bumpMap'] as const;

export interface ScreenPoint {
  x: number;
  y: number;
  behind: boolean;
}

/** Renderer, kamera, ışıklar ve ekran uyarlaması. */
export class Scene3D {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  readonly ambient: THREE.AmbientLight;
  /** Gölge düşürmeyen karşı ışık — siluetleri fondan ayırır. */
  readonly rim: THREE.DirectionalLight;

  /** Kameranın takip ettiği yer düzlemi noktası. */
  private focus = new THREE.Vector3(0, 0, 0);
  private focusTarget = new THREE.Vector3(0, 0, 0);
  private distance: number = BALANCE.camera.distance;
  private distanceTarget: number = BALANCE.camera.distance;
  private openingFrame = false;
  framing = cameraFraming(390, 844);
  private readonly playerFocus = new THREE.Vector3();
  private shakeAmount = 0;
  private shakeTime = 0;

  private width = 1;
  private height = 1;
  private lowQuality = false;
  private qualityDprCap = DPR_CAP;
  private reducedMotion = false;
  /** Shadow preference can recover after a low preset or a thermal event. */
  private qualityShadows = true;
  private qualityApplied = false;
  /** Telefon tarayıcısında yüksek saatli GPU istememek için dengeli profil. */
  private readonly mobileDevice: boolean;
  private staticDirty = true;
  private forcePresent = true;
  private sceneCache: StaticSceneCache;
  readonly edgeSmoothing = new EdgeSmoothing();
  private readonly occlusion = new ViewOcclusion();
  readonly preparation = { screenMs: 0, cacheMs: 0, textureMs: 0, totalMs: 0, meshes: 0, cacheMeshes: 0 };
  private readonly cacheView = new THREE.Matrix4();
  private readonly nextView = new THREE.Matrix4();
  private haveCacheView = false;
  private renderPixelBudget = 2_100_000;
  private lostContext = false;
  private detachContext = () => {};
  private lastRenderPath: "direct" | "bake" | "cached" = "direct";
  get renderPath() {
    return this.lastRenderPath;
  }
  get cacheSupported() {
    return this.sceneCache.supported;
  }
  get isContextLost() {
    return this.lostContext;
  }
  /** Promo films hide diegetic station tags so motion graphics stay readable. */
  hideSurfaceLabels = false;

  constructor(
    canvas: HTMLCanvasElement,
    tier: QualityTier = "high",
    mobileDevice = false,
  ) {
    // A shared final edge pass works for both cached and moving frames.
    // Canvas-only MSAA would disappear when the static scene cache is reused.
    this.qualityShadows = tier !== 'low';
    this.mobileDevice = mobileDevice;
    this.edgeSmoothing.enabled = !mobileDevice && tier === 'high';
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: tier !== "low",
      /**
       * Native WebView'de 'high-performance' yüksek saatli GPU profili
       * ister ve cihazı boş yere ısıtır — termal şikâyetin ölçülen
       * parçalarından biri. Telefonda sistemin dengeli profili yeter;
       * masaüstü tarayıcıda ise dGPU seçimi için doğru tercih olmayı
       * sürdürür.
       */
      powerPreference:
        isNative || mobileDevice ? "default" : "high-performance",
      precision: 'highp',
      preserveDrawingBuffer: false,
      alpha: false,
      stencil: false,
    });
    this.sceneCache = new StaticSceneCache(this.renderer);
    this.renderer.info.autoReset = false;
    const lost = (event: Event) => {
      event.preventDefault();
      this.lostContext = true;
      this.sceneCache.dispose();
      this.edgeSmoothing.reset();
    };
    const restored = () => {
      this.lostContext = false;
      this.sceneCache = new StaticSceneCache(this.renderer);
      this.haveCacheView = false;
      this.invalidateStatic();
      this.invalidateShadows();
    };
    canvas.addEventListener("webglcontextlost", lost);
    canvas.addEventListener("webglcontextrestored", restored);
    this.detachContext = () => {
      canvas.removeEventListener("webglcontextlost", lost);
      canvas.removeEventListener("webglcontextrestored", restored);
    };
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    /**
     * ACES yerine Neutral.
     *
     * ACESFilmic sinematik bir eğridir: yüksek ışıkları güçlü şekilde
     * doygunluktan düşürür. Zaten açık renkli, düşük doygunluklu bir
     * paletle birleşince sahnenin tamamını kreme çeviriyordu. Neutral
     * (three r160+) yüksek ışıkları sıkıştırır ama rengi korur — arcade
     * bir oyunun istediği tam olarak budur.
     */
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.shadowMap.enabled = this.qualityShadows;
    // Görsel profil tek: gölge açıksa bütün kademelerde aynı (donanım) PCF filtresi.
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    /**
     * Anizotropi tavanı TEK NOKTADAN: three, doku yüklerken
     * `min(texture.anisotropy, capabilities.getMaxAnisotropy())` uygular;
     * dokuların 16 isteyen çağrı yerlerine dokunmadan tavanı burada indiriyoruz.
     */
    {
      const caps = this.renderer.capabilities;
      const hardwareMax = caps.getMaxAnisotropy();
      const cap = mobileDevice || tier === 'low' ? ANISOTROPY_CAP_MOBILE : ANISOTROPY_CAP_DESKTOP;
      caps.getMaxAnisotropy = () => Math.min(hardwareMax, cap);
    }
    /**
     * GÖLGE HARİTASI DONDURULDU.
     *
     * Sahne ışığı sabittir ve mimari yalnızca bölge açılınca değişir;
     * buna rağmen gölge geçişi HER KARE tüm sahneyi yeniden çiziyordu
     * (çizim çağrılarının büyük kısmı buradan geliyordu). Artık harita
     * yalnızca `invalidateShadows()` çağrıldığında yenilenir.
     *
     * Karakterler bu haritaya GİRMEZ (rig meshlerinde castShadow yok);
     * onların yere basması ayrı bir temas gölgesi katmanıyla sağlanır.
     */
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;

    this.scene = new THREE.Scene();
    this.scene.matrixAutoUpdate = false;
    this.scene.background = new THREE.Color(0xbfe3ff);
    this.scene.fog = new THREE.Fog(0xdfe9f0, FOG_NEAR, FOG_FAR);

    /**
     * ÇEVRE HARİTASI — sahnedeki tek büyük "ölü metal" düzeltmesi.
     *
     * Krom/pirinç yüzeyler (espresso makinesi, VIP altın kenarlar, cam)
     * envMap'siz metalness ile GRİ ölü lekeler olarak kalıyordu; PBR'da
     * metalin rengi yansıttığı çevredir, çevre yoksa metal de yoktur.
     * RoomEnvironment küçük bir stüdyo sahnesini PMREM'e pişirir; maliyet
     * açılışta bir kez ~2 ms, kare başına sıfıra yakındır. Yoğunluk kısık
     * tutulur ki pastel palet yıkanmasın.
     */
    {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      this.scene.environment = pmrem.fromScene(
        new RoomEnvironment(),
        0.04,
      ).texture;
      this.scene.environmentIntensity = 0.35;
      pmrem.dispose();
    }

    this.camera = new THREE.PerspectiveCamera(
      BALANCE.camera.fov,
      1,
      0.5,
      CAMERA_FAR,
    );

    /**
     * IŞIK DENGESİ.
     *
     * Eski kurulum: hemi 1,15 + ambient 0,28 + güneş 2,15. Yani gölgede
     * kalan bir yüzey tam ışığın %38,9'unu alıyordu — gölgeler neredeyse
     * hiç karartmıyor, her şey düz görünüyordu.
     *
     * Yeni kurulum düz dolguyu kaldırır (ambient 0), yarımküreyi kısar ve
     * güneşi yükseltir; hacmi geri getirmek için de gölge DÜŞÜRMEYEN bir
     * karşı ışık (rim) eklenir. Karşı ışık gölge hesaplamadığı için
     * maliyeti pratikte sıfırdır ama siluetleri arka plandan ayırır.
     * Dolgu payı böylece ~%13'e iner.
     */
    this.hemi = new THREE.HemisphereLight(0xb4dcf5, 0xb08a5c, 0.72);
    this.hemi.layers.enableAll();
    this.scene.add(this.hemi);

    // Ambient korunur ama sıfırdır: paletten gelen ayar tek noktadan
    // yönetilebilsin diye nesne duruyor, katkısı yok.
    this.ambient = new THREE.AmbientLight(0xffffff, 0);
    this.ambient.layers.enableAll();
    this.scene.add(this.ambient);

    this.rim = new THREE.DirectionalLight(0xbcd8ff, 0.55);
    this.rim.position.set(-18, 20, -26);
    this.rim.castShadow = false;
    this.rim.layers.enableAll();
    this.scene.add(this.rim);

    this.sun = new THREE.DirectionalLight(0xffd9a8, 2.15);
    this.sun.layers.enableAll();
    this.sun.position.set(24, 40, 18);
    this.sun.castShadow = this.qualityShadows;
    this.sun.shadow.mapSize.set(this.shadowMapSizeFor(1024), this.shadowMapSizeFor(1024));
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 130;
    this.sun.shadow.bias = -0.0009;
    this.sun.shadow.normalBias = 0.035;
    const sc = this.sun.shadow.camera;
    sc.left = -34;
    sc.right = 34;
    sc.top = 34;
    sc.bottom = -34;
    sc.updateProjectionMatrix();
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    this.camera.layers.enableAll();

    this.resize();
  }

  applyPalette(p: LocationPalette): void {
    (this.scene.background as THREE.Color).setHex(p.sky);
    (this.scene.fog as THREE.Fog).color.setHex(p.fog);
    this.sun.color.setHex(p.sunColor);
    this.sun.intensity = p.sunIntensity;
    this.hemi.color.setHex(p.hemiSky);
    this.hemi.groundColor.setHex(p.hemiGround);
    this.hemi.intensity = p.hemiIntensity ?? 0.72;
    this.ambient.intensity = p.ambientIntensity ?? 0;
    this.rim.intensity = p.rimIntensity ?? 0.55;
    this.renderer.toneMappingExposure = p.exposure ?? 1.1;
    // Karşı ışık gökyüzünün soğuk tonunu alır: sıcak güneşe karşı
    // tamamlayıcı kalır ve sahne tek renge düşmez.
    this.rim.color.setHex(p.rimColor ?? p.hemiSky);
    this.invalidateShadows();
    this.invalidateStatic();
  }

  private shadowsOn(low = this.lowQuality): boolean {
    return this.qualityShadows && !low && (MOBILE_SHADOWS || !this.mobileDevice);
  }

  private shadowMapSizeFor(size: number): number {
    return this.mobileDevice ? Math.min(size, MOBILE_SHADOW_MAP_MAX) : size;
  }

  /**
   * Kalite/ısı ayarlarını uygular — İDEMPOTENT, her an yeniden çağrılabilir.
   *
   * İlk uygulama daima renderer'a geçer. Sonrakilerde gerçek piksel/gölge
   * değerleri aynıysa tamponları yeniden kurmayız; yalnız FPS değişen ilk
   * yük basamağı veya ses ayarı görüntüde bir duraklama oluşturmamalı.
   */
  applyQuality(q: {
    shadows: boolean;
    shadowMapSize: number;
    dprCap?: number;
    pixelBudget?: number;
  }): void {
    const pixelBudget = q.pixelBudget ?? 2_100_000;
    const dprCap = Math.max(0.5, Math.min(DPR_CAP, q.dprCap ?? DPR_CAP));
    const resize = !this.qualityApplied || pixelBudget !== this.renderPixelBudget || dprCap !== this.qualityDprCap;
    this.qualityShadows = q.shadows;
    const shadows = this.shadowsOn();
    const mapSize = this.shadowMapSizeFor(q.shadowMapSize);
    const shadowChanged = !this.qualityApplied || this.renderer.shadowMap.enabled !== shadows || this.sun.shadow.mapSize.width !== mapSize;
    this.qualityApplied = true;
    this.renderPixelBudget = pixelBudget;
    this.qualityDprCap = dprCap;
    // Kenar yumuşatma geçişi ek bir tam ekran geçiştir: yalnızca masaüstünde ve
    // DPR tavanı sonuna kadar açıkken (ısı merdiveni inince kapanır) çalışır.
    this.edgeSmoothing.enabled = !this.mobileDevice && dprCap >= DPR_CAP;
    if (!resize && !shadowChanged) return;
    this.renderer.shadowMap.enabled = shadows;
    this.sun.castShadow = shadows;
    if (this.sun.shadow.mapSize.width !== mapSize) {
      this.sun.shadow.mapSize.set(mapSize, mapSize);
      // Harita hedefi boyutuyla birlikte yeniden yaratılmalı.
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null as unknown as THREE.WebGLRenderTarget;
    }
    if (shadowChanged) { this.invalidateShadows(); this.invalidateStatic(); }
    if (resize) this.resize();
  }

  setLowQuality(low: boolean): void {
    if (this.lowQuality === low) return;
    this.lowQuality = low;
    const shadows = this.shadowsOn(low);
    this.renderer.shadowMap.enabled = shadows;
    this.sun.castShadow = shadows;
    // NOT: burada eskiden harita 2048'e SABİTLENİYORDU ve az önce
    // applyQuality()'nin uyguladığı kademe boyutunu (orta seviyede 1024)
    // eziyordu — "Düşük Kalite"yi kapatmak gölge dolgusunu dört katına
    // çıkarıyordu. Boyut artık yalnızca kademeden gelir.
    //
    // Sahnedeki tüm malzemelerin `needsUpdate` ile taranması da kaldırıldı:
    // gölge açık/kapalı değişimi shader'ı zaten geçersiz kılıyor, elle
    // tarama ise tüm programları yeniden derletip belirgin bir takılma
    // yaratıyordu.
    this.invalidateShadows();
    this.invalidateStatic();
    this.resize();
  }

  setReducedMotion(v: boolean): void {
    this.reducedMotion = v;
  }

  /** Kameranın takip edeceği noktayı anında ayarla (şube değişimi). */
  snapTo(x: number, z: number): void {
    this.focus.set(x, 0, z);
    this.focusTarget.set(x, 0, z);
    this.playerFocus.set(x, 0, z);
    this.updateCamera();
  }

  setFocus(x: number, z: number, floorY = 0, playerX = x, playerZ = z): void {
    this.focusTarget.set(x, floorY, z);
    this.playerFocus.set(playerX, floorY, playerZ);
  }

  /** Opening overview uses the same minimum venue span as regular following. */
  setOpeningFrame(on: boolean): void {
    if (this.openingFrame === on) return;
    this.openingFrame = on;
    if (!this.haveCacheView) {
      this.distance = this.framedDistance();
      this.updateCamera();
    }
  }

  private framedDistance(): number {
    // The first tutorial must not silently replace the selected phone camera
    // with the old 14.2-unit overview. Keep one scale from the first frame.
    return this.distanceTarget;
  }

  shake(amount: number): void {
    if (this.reducedMotion) return;
    this.shakeAmount = Math.max(this.shakeAmount, amount);
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.width = w;
    this.height = h;

    // Limit 3D pixel work at every viewport size; HTML UI keeps its native resolution.
    const maxDpr = this.lowQuality
      ? Math.min(1, this.qualityDprCap)
      : this.qualityDprCap;
    this.renderer.setPixelRatio(
      renderPixelRatio(
        w,
        h,
        window.devicePixelRatio || 1,
        maxDpr,
        this.renderPixelBudget,
      ),
    );
    this.renderer.setSize(w, h, false);
    this.sceneCache.invalidate();
    this.invalidateStaticCache();

    // Preserve the same venue width and camera angle across screen shapes.
    this.framing = cameraFraming(w, h, this.mobileDevice);
    this.camera.aspect = this.framing.aspect;
    this.camera.fov = this.framing.fov;
    this.camera.setViewOffset(w, h, 0, h * this.framing.offsetY, w, h);
    this.camera.updateProjectionMatrix();
    this.distanceTarget = this.framing.distance;
    if (!this.haveCacheView) {
      this.distance = this.framing.distance;
    }
  }

  update(dt: number): void {
    const lerpRate = this.reducedMotion ? 999 : BALANCE.camera.followLerp;
    this.focus.x = damp(this.focus.x, this.focusTarget.x, lerpRate, dt);
    this.focus.z = damp(this.focus.z, this.focusTarget.z, lerpRate, dt);
    this.focus.y = damp(this.focus.y, this.focusTarget.y, lerpRate, dt);
    this.distance = damp(this.distance, this.framedDistance(), this.reducedMotion ? 999 : 4, dt);

    if (this.shakeAmount > 0.0005) {
      this.shakeTime += dt * 34;
      this.shakeAmount = Math.max(0, this.shakeAmount - dt * 2.4);
    } else {
      this.shakeAmount = 0;
    }

    this.updateCamera();
    if (this.shadowRefreshIn > 0) {
      this.shadowRefreshIn -= dt;
      if (this.shadowRefreshIn <= 0) {
        this.shadowRefreshIn = 0;
        this.invalidateShadows();
        this.forcePresent = true;
      }
    }
    // Güneş artık oyuncuyu TAKİP ETMEZ. Takip ettiği sürece gölge haritası
    // her kare geçersizleşiyordu; oysa gölge kamerası (68×68) zaten tüm
    // mekânı kapsıyor. Sabitlenince harita dondurulabilir hâle geldi.
  }

  /**
   * Gölge kamerasını mekânın ortasına oturtur ve haritayı bir kez yeniler.
   * Şube değişiminde çağrılır.
   */
  setVenueCenter(x: number, z: number): void {
    this.sun.target.position.set(x, 0, z);
    this.sun.position.set(x + 24, 40, z + 18);
    this.sun.target.updateMatrixWorld();
    this.invalidateShadows();
    this.invalidateStatic();
  }

  /**
   * Gölge haritasını bir sonraki karede yeniden çizdirir.
   * Bölge açılışı, şube değişimi ve kalite değişiminde çağrılır.
   */
  invalidateShadows(): void {
    this.renderer.shadowMap.needsUpdate = true;
  }

  private shadowRefreshIn = 0;
  /**
   * Bake the frozen shadow map once install animations have settled: on the
   * unlock frame new furniture is still hidden or scaled down, and that frame
   * is already the heaviest one of the purchase.
   */
  invalidateShadowsAfter(seconds: number): void {
    this.shadowRefreshIn = Math.max(this.shadowRefreshIn, seconds);
  }

  async prepareForPlay(): Promise<void> {
    await this.edgeSmoothing.prepare(this.renderer);
    const start = performance.now();
    const warm = new THREE.Group(), cacheWarm = new THREE.Group();
    const temporaryInstances: THREE.InstancedMesh[] = [];
    const temporaryCharacters = createCharacterWarmup();
    const textures = new Set<THREE.Texture>();
    const add = (object: THREE.Object3D, products = false): void => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh && !(object as THREE.Sprite).isSprite && !(object as THREE.Points).isPoints) return;
      // compile traverses invisible meshes too. Build a flat visible selection so
      // a locked room cannot delay the first playable frame.
      const clone = object.clone(false) as THREE.Mesh;
      clone.frustumCulled = false;
      clone.castShadow = false;
      warm.add(clone);
      if (!products && object.layers.isEnabled(LAYER_STATIC)) cacheWarm.add(object.clone(false));
      if (!mesh.material) return;
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        const map = (material as THREE.MeshStandardMaterial).map;
        if (map) textures.add(map);
      }
    };
    this.scene.traverseVisible(object => add(object));
    for (const character of temporaryCharacters) character.root.traverse(object=>add(object,true));
    for (const id of Object.keys(ITEMS) as ItemId[]) {
      createProductMesh(id).traverse(object => add(object, true));
      const instance = createPackProductInstanced(id, 1);
      if (instance) { add(instance, true); temporaryInstances.push(instance); }
    }
    this.preparation.meshes = warm.children.length;
    this.preparation.cacheMeshes = cacheWarm.children.length;
    const previousTarget = this.renderer.getRenderTarget();
    const linearTarget = new THREE.WebGLRenderTarget(2, 2);
    const layerMask = this.camera.layers.mask;
    try {
      let phase = performance.now();
      this.camera.layers.enable(LAYER_SURFACE_LABEL);
      await this.renderer.compileAsync(warm, this.camera, this.scene);
      this.preparation.screenMs = performance.now() - phase;
      phase = performance.now();
      // The static HDR cache never renders characters or product stacks.
      this.renderer.setRenderTarget(linearTarget);
      await this.renderer.compileAsync(cacheWarm, this.camera, this.scene);
      this.preparation.cacheMs = performance.now() - phase;
      this.renderer.setRenderTarget(previousTarget);
      phase = performance.now();
      for (const texture of textures) this.renderer.initTexture(texture);
      // Compilation alone does not upload vertex buffers. One covered pixel warms
      // the actual display shader and shared bodies before the first customer arrives.
      const scissor = this.renderer.getScissor(new THREE.Vector4());
      const scissorTest = this.renderer.getScissorTest();
      // Only shared character bodies need eager vertex upload. Keep distant
      // architecture on demand so startup does not allocate an entire world.
      for (const object of warm.children) object.visible = (object as THREE.SkinnedMesh).isSkinnedMesh === true;
      this.scene.add(warm);
      try {
        this.camera.layers.mask = (1 << LAYER_STATIC) | (1 << LAYER_DYNAMIC) | (1 << LAYER_SURFACE_LABEL);
        this.renderer.setScissor(0,0,1,1);
        this.renderer.setScissorTest(true);
        this.renderer.render(this.scene,this.camera);
      } finally {
        this.scene.remove(warm);
        this.camera.layers.mask = layerMask;
        this.renderer.setScissor(scissor);
        this.renderer.setScissorTest(scissorTest);
      }
      this.preparation.textureMs = performance.now() - phase;
    } catch (error) {
      console.warn('[Render] Shader warm-up skipped:', error);
    } finally {
      this.camera.layers.mask = layerMask;
      this.renderer.setRenderTarget(previousTarget);
      linearTarget.dispose();
      for (const instance of temporaryInstances) instance.dispose();
      for (const character of temporaryCharacters) character.dispose();
      // Clones own only temporary instance buffers, never shared asset geometry.
      for (const root of [warm, cacheWarm]) {
        root.traverse(object => { if ((object as THREE.InstancedMesh).isInstancedMesh) (object as THREE.InstancedMesh).dispose(); });
        root.clear();
      }
      this.preparation.totalMs = performance.now() - start;
    }
  }

  private hiddenWarmRunning = false;
  private hiddenWarmAgain = false;
  /**
   * prepareForPlay warms only what the first frame shows. Locked zones,
   * first-use effects (mop, spills, VFX) and the other branch otherwise
   * compile their programs and upload their textures on the frame they
   * appear — usually the unlock frame. This prepares them afterwards in
   * small idle slices; objects are compiled in place, without clones.
   */
  warmHiddenContent(startDelayMs = 2000): void {
    if (this.lostContext) return;
    if (this.hiddenWarmRunning) { this.hiddenWarmAgain = true; return; }
    this.hiddenWarmRunning = true;
    const props = this.renderer.properties;
    const fresh = (m: THREE.Material | undefined) => !!m && (props.get(m) as { programs?: unknown }).programs === undefined;
    const objects: THREE.Object3D[] = [];
    const swaps = takeMaterialWarms();
    const textures: THREE.Texture[] = [];
    const listed = new Set<THREE.Texture>();
    const listTextures = (m: THREE.Material) => {
      for (const slot of WARM_TEXTURE_SLOTS) {
        const texture = (m as unknown as Record<string, THREE.Texture | null | undefined>)[slot];
        if (texture?.isTexture && !listed.has(texture)) { listed.add(texture); textures.push(texture); }
      }
    };
    // A material already compiled for one object kind can still need a new
    // variant on another (plain vs instanced, back face of a two-sided
    // transparent pass), so hidden objects and swaps are always compiled;
    // three only computes the key when that variant already exists.
    const shown = new Set<THREE.Object3D>();
    this.scene.traverseVisible(object => { shown.add(object); });
    this.scene.traverse(object => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh && !(object as THREE.Sprite).isSprite && !(object as THREE.Points).isPoints) return;
      let needed = !shown.has(object);
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        if (!fresh(m)) continue;
        needed = true;
        listTextures(m);
      }
      if (needed) objects.push(object);
    });
    for (const swap of swaps) listTextures(swap.material);
    const inScene = (object: THREE.Object3D) => {
      let p: THREE.Object3D | null = object;
      while (p && p !== this.scene) p = p.parent;
      return p === this.scene;
    };
    const step = (deadline?: IdleDeadline) => {
      // A phone with no idle time only reaches here through the timeout, where
      // timeRemaining() is 0; a small fixed slice keeps the warm-up moving.
      const budget = deadline && !deadline.didTimeout ? Math.max(2, deadline.timeRemaining() - 1) : 5;
      const until = performance.now() + budget;
      const hasTime = () => performance.now() < until;
      try {
        do {
          if (this.lostContext) { objects.length = swaps.length = textures.length = 0; break; }
          const object = objects.pop();
          if (object) {
            if (inScene(object)) this.renderer.compile(object, this.camera, this.scene);
            continue;
          }
          const swap = swaps.pop();
          if (swap) {
            if (!inScene(swap.mesh)) continue;
            // Compile on the mesh that will draw it (instancing, skinning and
            // geometry attributes are part of the program key), then restore.
            const shown = swap.mesh.material;
            swap.mesh.material = swap.material;
            try { this.renderer.compile(swap.mesh, this.camera, this.scene); }
            finally { swap.mesh.material = shown; }
            continue;
          }
          const texture = textures.pop();
          if (texture && !(props.get(texture) as { __webglInit?: boolean }).__webglInit) this.renderer.initTexture(texture);
        } while ((objects.length || swaps.length || textures.length) && hasTime());
      } catch (error) {
        console.warn('[Render] Hidden warm-up stopped:', error);
        objects.length = swaps.length = textures.length = 0;
      }
      if (objects.length || swaps.length || textures.length) { schedule(); return; }
      this.hiddenWarmRunning = false;
      if (this.hiddenWarmAgain) { this.hiddenWarmAgain = false; this.warmHiddenContent(0); }
    };
    const schedule = () => {
      if (typeof requestIdleCallback === 'function') requestIdleCallback(step, { timeout: 500 });
      else setTimeout(step, 100);
    };
    setTimeout(schedule, startDelayMs);
  }

  invalidateStatic(): void {
    this.occlusion.invalidate();
    this.invalidateStaticCache();
  }

  /** Layer or pixel changes that leave the venue's occluders untouched. */
  invalidateStaticCache(): void {
    this.staticDirty = true;
    this.forcePresent = true;
  }

  consumeForcePresent(): boolean {
    const v = this.forcePresent;
    this.forcePresent = false;
    return v;
  }

  private updateCamera(): void {
    const pitch = this.framing.pitch * DEG;
    const yaw = BALANCE.camera.yaw * DEG;
    const d = this.distance;
    const near = clamp(d * NEAR_PER_DISTANCE, NEAR_MIN, NEAR_MAX);
    if (Math.abs(near - this.camera.near) > 0.05) {
      this.camera.near = near;
      this.camera.updateProjectionMatrix();
    }
    _offset
      .set(
        Math.sin(yaw) * Math.cos(pitch),
        Math.sin(pitch),
        Math.cos(yaw) * Math.cos(pitch),
      )
      .multiplyScalar(d);

    let sx = 0;
    let sy = 0;
    if (this.shakeAmount > 0) {
      sx = Math.sin(this.shakeTime * 1.7) * this.shakeAmount * 0.5;
      sy = Math.cos(this.shakeTime * 2.3) * this.shakeAmount * 0.4;
    }

    this.camera.position.set(
      this.focus.x + _offset.x + sx,
      this.focus.y + _offset.y + sy,
      this.focus.z + _offset.z,
    );
    _target.set(this.focus.x, this.focus.y + 1.4, this.focus.z);
    this.camera.lookAt(_target);
  }

  /** Dünya noktasını ekran pikseline çevirir (yüzen yazılar için). */
  project(x: number, y: number, z: number, out: ScreenPoint): ScreenPoint {
    _proj.set(x, y, z).project(this.camera);
    out.behind = _proj.z > 1;
    out.x = (_proj.x * 0.5 + 0.5) * this.width;
    out.y = (-_proj.y * 0.5 + 0.5) * this.height;
    return out;
  }

  /** Ekran noktasından yer düzlemine (y=0) ışın atar. */
  screenToGround(
    clientX: number,
    clientY: number,
    out: THREE.Vector3,
  ): boolean {
    const ndcX = (clientX / this.width) * 2 - 1;
    const ndcY = -(clientY / this.height) * 2 + 1;
    _proj.set(ndcX, ndcY, 0.5).unproject(this.camera);
    _proj.sub(this.camera.position).normalize();
    if (Math.abs(_proj.y) < 1e-5) return false;
    const t = -this.camera.position.y / _proj.y;
    if (t < 0) return false;
    out.copy(this.camera.position).addScaledVector(_proj, t);
    return true;
  }

  /** Kameranın baktığı yönün yer düzlemindeki yaw açısı — girişi kameraya göre döndürmek için. */
  get cameraYaw(): number {
    return BALANCE.camera.yaw * DEG;
  }

  get screenWidth(): number {
    return this.width;
  }

  get screenHeight(): number {
    return this.height;
  }

  render(): void {
    if (this.lostContext) return;
    this.camera.updateMatrixWorld();
    this.occlusion.update(this.scene, this.camera, this.playerFocus);
    this.renderer.info.reset();

    if (this.mobileDevice) {
      // Mobilde TBDR mimarisi, Z-fighting ve ara doku geçişi kaynaklı pır pır
      // yapmaması için temiz, donanımsal MSAA destekli doğrudan çizim kullanılır.
      // Kenar yumuşatma mobilde kapalı; yazılar ayrı bir ikinci sahne geçişi
      // yerine aynı geçişte, LABEL_RENDER_ORDER ile en son çizilir.
      this.camera.layers.mask = (1 << LAYER_STATIC) | (1 << LAYER_DYNAMIC) | (1 << LAYER_SURFACE_LABEL);
      this.renderer.autoClear = true;
      this.renderer.setRenderTarget(null);
      this.renderer.render(this.scene, this.camera);
      this.lastRenderPath = "direct";
      return;
    }

    this.nextView.multiplyMatrices(
      this.camera.projectionMatrix,
      this.camera.matrixWorldInverse,
    );
    const current = this.nextView.elements,
      previous = this.cacheView.elements;
    let stationary = this.haveCacheView;
    for (let i = 0; stationary && i < 16; i++)
      if (Math.abs(current[i] - previous[i]) > 1e-4) stationary = false;
    if (this.staticDirty) {
      this.sceneCache.invalidate();
      this.staticDirty = false;
    }
    this.lastRenderPath = this.sceneCache.render(
      this.scene,
      this.camera,
      stationary,
    );
    if (this.lastRenderPath !== "cached") {
      this.cacheView.copy(this.nextView);
      this.haveCacheView = true;
    }

    this.edgeSmoothing.render(this.renderer);
    if (!this.hideSurfaceLabels) renderSurfaceLabels(this.renderer, this.scene, this.camera);
  }

  dispose(): void {
    this.detachContext();
    this.occlusion.dispose();
    this.sceneCache.dispose();
    this.edgeSmoothing.dispose();
    this.scene.environment?.dispose();
    this.renderer.dispose();
  }
}

export function clampToBounds(
  v: { x: number; z: number },
  b: { x0: number; z0: number; x1: number; z1: number },
  pad: number,
): void {
  v.x = clamp(v.x, b.x0 + pad, b.x1 - pad);
  v.z = clamp(v.z, b.z0 + pad, b.z1 - pad);
}
