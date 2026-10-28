import * as THREE from "three";
import { LAYER_STATIC, LAYER_DYNAMIC } from "./layers";

/** Cached color + depth via a regular draw, avoiding incompatible framebuffer blits. */
export class StaticSceneCache {
  readonly supported: boolean;
  private target: THREE.WebGLRenderTarget | null = null;
  private ready = false;
  private labelsSplit = false;
  private readonly copyScene = new THREE.Scene();
  private readonly copyCamera = new THREE.Camera();
  private readonly geometry = new THREE.BufferGeometry();
  private readonly material: THREE.ShaderMaterial;
  private readonly size = new THREE.Vector2();
  constructor(private renderer: THREE.WebGLRenderer) {
    this.supported =
      renderer.capabilities.isWebGL2 &&
      renderer.extensions.has("EXT_color_buffer_float");
    this.geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3),
    );
    this.material = new THREE.ShaderMaterial({
      name: "StaticColorDepthCopy",
      uniforms: {
        colorTexture: { value: null },
        depthTexture: { value: null },
      },
      vertexShader:
        "varying vec2 uvScreen; void main(){uvScreen=position.xy*.5+.5;gl_Position=vec4(position.xy,0.,1.);}",
      fragmentShader: `uniform sampler2D colorTexture;uniform sampler2D depthTexture;varying vec2 uvScreen;
void main(){float depth=texture2D(depthTexture,uvScreen).r;if(depth>=1.0)discard;gl_FragDepth=depth;gl_FragColor=texture2D(colorTexture,uvScreen);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`,
      depthTest: true,
      depthWrite: true,
      depthFunc: THREE.AlwaysDepth,
      toneMapped: true,
      blending: THREE.NoBlending,
    });
    const quad = new THREE.Mesh(this.geometry, this.material);
    quad.name = "StaticColorDepthCopy";
    quad.frustumCulled = false;
    this.copyScene.add(quad);
  }
  invalidate(): void {
    this.ready = false;
    this.labelsSplit = false;
  }
  private ensureSize(): void {
    this.renderer.getDrawingBufferSize(this.size);
    const w = Math.floor(this.size.x),
      h = Math.floor(this.size.y);
    if (this.target && this.target.width === w && this.target.height === h)
      return;
    this.target?.dispose();
    this.target = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType,
      depthBuffer: true,
      stencilBuffer: false,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      generateMipmaps: false,
    });
    this.target.texture.colorSpace = THREE.LinearSRGBColorSpace;
    this.target.depthTexture = new THREE.DepthTexture(
      w,
      h,
      THREE.UnsignedIntType,
    );
    this.material.uniforms.colorTexture.value = this.target.texture;
    this.material.uniforms.depthTexture.value = this.target.depthTexture;
    this.ready = false;
  }
  /** Keep untonemapped labels out of the HDR pass so their colors stay exact. */
  private splitUnlitLabels(scene: THREE.Scene): void {
    if (this.labelsSplit) return;
    this.labelsSplit = true;
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || !mesh.layers.isEnabled(LAYER_STATIC)) return;
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      if (materials.some((m) => !m.toneMapped || m.transparent))
        mesh.layers.set(LAYER_DYNAMIC);
    });
  }
  render(
    scene: THREE.Scene,
    camera: THREE.Camera,
    stationary: boolean,
  ): "direct" | "bake" | "cached" {
    const renderer = this.renderer;
    if (!this.supported || !stationary) {
      this.ready = false;
      camera.layers.mask = (1 << LAYER_STATIC) | (1 << LAYER_DYNAMIC);
      renderer.autoClear = true;
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);
      return "direct";
    }
    this.ensureSize();
    const bake = !this.ready;
    if (bake) {
      this.splitUnlitLabels(scene);
      camera.layers.set(LAYER_STATIC);
      renderer.setRenderTarget(this.target);
      renderer.autoClear = true;
      renderer.render(scene, camera);
      this.ready = true;
    }
    renderer.setRenderTarget(null);
    renderer.autoClear = true;
    this.copyScene.background = scene.background;
    renderer.render(this.copyScene, this.copyCamera);
    camera.layers.set(LAYER_DYNAMIC);
    renderer.autoClear = false;
    // A Color background forces a clear even with autoClear=false in Three.js.
    const background = scene.background;
    scene.background = null;
    try {
      renderer.render(scene, camera);
    } finally {
      scene.background = background;
      renderer.autoClear = true;
      camera.layers.mask = (1 << LAYER_STATIC) | (1 << LAYER_DYNAMIC);
    }
    return bake ? "bake" : "cached";
  }
  dispose(): void {
    this.target?.dispose();
    this.target = null;
    this.geometry.dispose();
    this.material.dispose();
  }
}
