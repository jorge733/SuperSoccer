// Motor de render: Three.js + post-procesado (SSAO, bloom, corrección de color y antialiasing).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { NIVELES } from './calidad.js';

// Corrección de color: contraste, saturación, tinte y viñeta suave (en espacio lineal).
const ShaderColor = {
  uniforms: {
    tDiffuse: { value: null },
    saturacion: { value: 1.08 },
    contraste: { value: 1.05 },
    tinte: { value: new THREE.Vector3(1, 1, 1) },
    vineta: { value: 0.22 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float saturacion; uniform float contraste; uniform vec3 tinte; uniform float vineta;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb * tinte;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, saturacion);
      col = max(vec3(0.0), (col - 0.18) * contraste + 0.18);
      vec2 d = vUv - 0.5;
      col *= 1.0 - vineta * dot(d, d) * 2.2;
      gl_FragColor = vec4(col, c.a);
    }`,
};

export class Render {
  constructor(lienzo) {
    this.renderer = new THREE.WebGLRenderer({
      canvas: lienzo, antialias: false, powerPreference: 'high-performance', stencil: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.composer = null;
    this.escena = null;
    this.camara = null;
    this.nivel = 'media';
    window.addEventListener('resize', () => this.redimensionar());
  }

  get calidad() { return NIVELES[this.nivel]; }

  configurar(escena, camara, nivel) {
    this.escena = escena;
    this.camara = camara;
    this.nivel = nivel;
    const q = NIVELES[nivel];
    const r = this.renderer;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    r.setPixelRatio(Math.max(0.5, Math.min(q.pixelRatio, dpr * (q.pixelRatio >= 1 ? 1 : q.pixelRatio))));
    r.setSize(window.innerWidth, window.innerHeight, false);
    r.shadowMap.enabled = q.sombras;
    r.shadowMap.needsUpdate = true;

    if (this.composer) { this.composer.dispose(); }
    const tamano = r.getDrawingBufferSize(new THREE.Vector2());
    const destino = new THREE.WebGLRenderTarget(tamano.x, tamano.y, { type: THREE.HalfFloatType, samples: 0 });
    const c = new EffectComposer(r, destino);
    c.setPixelRatio(r.getPixelRatio());
    c.setSize(window.innerWidth, window.innerHeight);
    c.addPass(new RenderPass(escena, camara));

    this.pasoAO = null;
    if (q.ssao) {
      const ao = new GTAOPass(escena, camara, tamano.x, tamano.y);
      ao.output = GTAOPass.OUTPUT.Default;
      ao.blendIntensity = 0.85;
      ao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.5, thickness: 1.5, scale: 1.0, samples: nivel === 'ultra' ? 16 : 10 });
      ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
      c.addPass(ao);
      this.pasoAO = ao;
    }
    this.pasoBloom = null;
    if (q.bloom) {
      const b = new UnrealBloomPass(new THREE.Vector2(tamano.x / 2, tamano.y / 2), 0.35, 0.5, 0.92);
      c.addPass(b);
      this.pasoBloom = b;
    }
    this.pasoColor = new ShaderPass(ShaderColor);
    c.addPass(this.pasoColor);
    c.addPass(new OutputPass());
    if (q.aa === 'smaa') {
      c.addPass(new SMAAPass(tamano.x, tamano.y));
    } else {
      const fxaa = new ShaderPass(FXAAShader);
      fxaa.material.uniforms.resolution.value.set(1 / tamano.x, 1 / tamano.y);
      c.addPass(fxaa);
      this.pasoFxaa = fxaa;
    }
    this.composer = c;
  }

  // Ajusta bloom/tinte según la hora del día.
  ambientar({ bloom = 0.35, umbral = 0.92, saturacion = 1.08, contraste = 1.05, tinte = [1, 1, 1], exposicion = 1 }) {
    this.renderer.toneMappingExposure = exposicion;
    if (this.pasoBloom) { this.pasoBloom.strength = bloom; this.pasoBloom.threshold = umbral; }
    const u = this.pasoColor.uniforms;
    u.saturacion.value = saturacion;
    u.contraste.value = contraste;
    u.tinte.value.set(tinte[0], tinte[1], tinte[2]);
  }

  cambiarCamara(camara) {
    this.camara = camara;
    if (this.composer) {
      for (const p of this.composer.passes) {
        if (p.camera !== undefined) p.camera = camara;
      }
    }
  }

  redimensionar() {
    if (!this.camara) return;
    const w = window.innerWidth, h = window.innerHeight;
    this.camara.aspect = w / h;
    this.camara.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    if (this.composer) {
      this.composer.setSize(w, h);
      const t = this.renderer.getDrawingBufferSize(new THREE.Vector2());
      if (this.pasoFxaa) this.pasoFxaa.material.uniforms.resolution.value.set(1 / t.x, 1 / t.y);
    }
  }

  dibujar() {
    if (this.composer) this.composer.render();
    else this.renderer.render(this.escena, this.camara);
  }
}
