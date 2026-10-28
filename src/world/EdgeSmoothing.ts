import * as THREE from 'three';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';

/** One final edge pass for both live and cached frames. It uses the already
 * displayed colors, so tone mapping, unlit labels, and depth stay unchanged. */
export class EdgeSmoothing {
  enabled = true;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.Camera();
  private readonly size = new THREE.Vector2();
  private readonly geometry = new THREE.BufferGeometry();
  private readonly material = new THREE.ShaderMaterial({
    name: 'FincanEdgeSmoothing',
    uniforms: THREE.UniformsUtils.clone(FXAAShader.uniforms),
    vertexShader: FXAAShader.vertexShader,
    fragmentShader: FXAAShader.fragmentShader,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    blending: THREE.NoBlending,
  });
  private texture: THREE.FramebufferTexture | null = null;

  constructor() {
    this.geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3));
    this.geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0,0,2,0,0,2],2));
    const triangle = new THREE.Mesh(this.geometry,this.material);
    triangle.frustumCulled = false;
    this.scene.add(triangle);
  }

  async prepare(renderer: THREE.WebGLRenderer): Promise<void> {
    if (!this.enabled) return;
    await renderer.compileAsync(this.scene,this.camera);
  }

  render(renderer: THREE.WebGLRenderer): void {
    if (!this.enabled) return;
    renderer.getDrawingBufferSize(this.size);
    const width = Math.floor(this.size.x), height = Math.floor(this.size.y);
    if (!this.texture || this.texture.image.width !== width || this.texture.image.height !== height) {
      this.reset();
      this.texture = new THREE.FramebufferTexture(width,height);
      this.texture.minFilter = this.texture.magFilter = THREE.LinearFilter;
      this.texture.colorSpace = THREE.NoColorSpace;
      this.material.uniforms.tDiffuse.value = this.texture;
      this.material.uniforms.resolution.value.set(1/width,1/height);
    }
    // GPU-to-GPU copy; no pixel readback and no multisampled depth-buffer blit.
    renderer.copyFramebufferToTexture(this.texture);
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    try { renderer.render(this.scene,this.camera); }
    finally { renderer.autoClear = autoClear; }
  }

  reset(): void {
    this.texture?.dispose();
    this.texture = null;
    this.material.uniforms.tDiffuse.value = null;
  }

  dispose(): void {
    this.reset();
    this.geometry.dispose();
    this.material.dispose();
  }
}
