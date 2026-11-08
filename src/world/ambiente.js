// Iluminación PBR con HDRI (Poly Haven, CC0), sol con sombras dinámicas, focos nocturnos y lluvia.
import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';

export const HORAS = {
  dia: {
    nombre: 'Día', hdri: 'quarry_01_1k.hdr', fondo: 0.95, env: 0.85, sol: 3.2, colorSol: 0xfff3e0,
    elev: 52, azim: -35, hemi: 0.35, focos: 0, exposicion: 0.95,
    post: { bloom: 0.15, umbral: 0.95, saturacion: 0.98, contraste: 1.05, tinte: [1.0, 1.0, 0.99] },
    niebla: 0x9fb4c8,
  },
  atardecer: {
    nombre: 'Atardecer', hdri: 'venice_sunset_1k.hdr', fondo: 1.0, env: 0.75, sol: 2.6, colorSol: 0xffb070,
    elev: 11, azim: 60, hemi: 0.3, focos: 1.2, exposicion: 0.95,
    post: { bloom: 0.3, umbral: 0.9, saturacion: 1.03, contraste: 1.06, tinte: [1.04, 0.99, 0.93] },
    niebla: 0xc89a7a,
  },
  noche: {
    nombre: 'Noche', hdri: 'moonless_golf_1k.hdr', fondo: 0.6, env: 0.4, sol: 3.0, colorSol: 0xeef3ff,
    elev: 70, azim: 20, hemi: 0.6, focos: 3.2, exposicion: 1.18,
    post: { bloom: 0.5, umbral: 0.82, saturacion: 0.97, contraste: 1.07, tinte: [0.97, 0.99, 1.04] },
    niebla: 0x10141c,
  },
};

export class Ambiente {
  constructor(escena, renderer) {
    this.escena = escena;
    this.renderer = renderer;
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.texturas = {};
    this.hora = 'dia';
    this.lluvia = null;
    this.intensidadLluvia = 0;

    this.sol = new THREE.DirectionalLight(0xffffff, 3);
    this.sol.castShadow = true;
    this.sol.shadow.bias = -0.0004;
    this.sol.shadow.normalBias = 0.03;
    const sc = this.sol.shadow.camera;
    sc.left = -38; sc.right = 38; sc.top = 38; sc.bottom = -38; sc.near = 10; sc.far = 260;
    escena.add(this.sol);
    escena.add(this.sol.target);

    this.hemi = new THREE.HemisphereLight(0xcfe3ff, 0x3a5a2a, 0.35);
    escena.add(this.hemi);

    this.focosExtra = [];
    this.dirSol = new THREE.Vector3();
  }

  // Carga los HDRI reportando avance (0..1).
  async cargar(progreso) {
    const loader = new HDRLoader();
    const nombres = [...new Set(Object.values(HORAS).map((h) => h.hdri))];
    const avance = new Array(nombres.length).fill(0);
    await Promise.all(nombres.map((n, i) => new Promise((ok) => {
      loader.load(`${import.meta.env.BASE_URL}hdri/${n}`, (tex) => {
        tex.mapping = THREE.EquirectangularReflectionMapping;
        this.texturas[n] = { fondo: tex, env: this.pmrem.fromEquirectangular(tex).texture };
        avance[i] = 1; progreso?.(avance.reduce((a, b) => a + b, 0) / nombres.length);
        ok();
      }, (e) => {
        if (e.total) { avance[i] = e.loaded / e.total * 0.95; progreso?.(avance.reduce((a, b) => a + b, 0) / nombres.length); }
      }, () => { console.warn('No se pudo cargar el HDRI', n); ok(); });
    })));
  }

  crearFocos(posiciones, activar) {
    for (const f of this.focosExtra) this.escena.remove(f);
    this.focosExtra = [];
    if (!activar) return;
    for (const p of posiciones) {
      const s = new THREE.SpotLight(0xf2f6ff, 0, 0, Math.PI / 5, 0.6, 0);
      s.position.copy(p);
      s.target.position.set(p.x * 0.15, 0, p.z * 0.15);
      s.castShadow = false;
      this.escena.add(s); this.escena.add(s.target);
      this.focosExtra.push(s);
    }
  }

  fijarHora(hora, render, estadio) {
    const h = HORAS[hora] || HORAS.dia;
    this.hora = hora;
    const tex = this.texturas[h.hdri];
    if (tex) {
      this.escena.environment = tex.env;
      this.escena.background = tex.fondo;
    } else {
      this.escena.background = new THREE.Color(h.niebla);
    }
    this.escena.backgroundIntensity = h.fondo;
    this.escena.environmentIntensity = h.env;
    this.escena.backgroundBlurriness = 0.02;
    const el = THREE.MathUtils.degToRad(h.elev), az = THREE.MathUtils.degToRad(h.azim);
    this.dirSol.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).normalize();
    this.sol.color.set(h.colorSol);
    this.sol.intensity = h.sol;
    this.hemi.intensity = h.hemi;
    this.hemi.color.set(hora === 'noche' ? 0x9fb3d9 : 0xcfe3ff);
    for (const f of this.focosExtra) f.intensity = h.focos > 1 ? 2.2 : h.focos * 0.8;
    estadio?.fijarNoche(h.focos);
    render?.ambientar({ ...h.post, exposicion: h.exposicion });
    this.aplicarLluvia(render);
  }

  // La sombra sigue a la jugada para tener buena resolución donde importa.
  seguir(objetivo) {
    const d = this.dirSol;
    this.sol.position.set(objetivo.x + d.x * 120, d.y * 120, objetivo.z + d.z * 120);
    this.sol.target.position.set(objetivo.x, 0, objetivo.z);
  }

  fijarCalidadSombras(q) {
    this.sol.castShadow = q.sombras;
    const t = q.mapaSombra;
    if (this.sol.shadow.mapSize.x !== t) {
      this.sol.shadow.mapSize.set(t, t);
      if (this.sol.shadow.map) { this.sol.shadow.map.dispose(); this.sol.shadow.map = null; }
    }
    const e = q.mapaSombra >= 4096 ? 45 : 38;
    const sc = this.sol.shadow.camera;
    sc.left = -e; sc.right = e; sc.top = e; sc.bottom = -e;
    sc.updateProjectionMatrix();
  }

  // ---------- Lluvia ----------
  activarLluvia(activa, cantidad, render, estadio, balon) {
    this.intensidadLluvia = activa ? 1 : 0;
    if (this.lluvia) { this.escena.remove(this.lluvia); this.lluvia.geometry.dispose(); this.lluvia = null; }
    estadio?.fijarMojado(activa ? 1 : 0);
    if (balon) balon.mojado = activa;
    if (activa) {
      const n = cantidad;
      const pos = new Float32Array(n * 2 * 3);
      const semilla = new Float32Array(n * 2 * 4);
      for (let i = 0; i < n; i++) {
        const x = Math.random(), y = Math.random(), z = Math.random(), v = 0.7 + Math.random() * 0.6;
        for (let k = 0; k < 2; k++) {
          semilla.set([x, y, z, v], (i * 2 + k) * 4);
          pos.set([0, k, 0], (i * 2 + k) * 3);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('semilla', new THREE.BufferAttribute(semilla, 4));
      const m = new THREE.ShaderMaterial({
        uniforms: { uTiempo: { value: 0 }, uCentro: { value: new THREE.Vector3() }, uColor: { value: new THREE.Color(0xaabbd0) } },
        vertexShader: /* glsl */`
          attribute vec4 semilla; uniform float uTiempo; uniform vec3 uCentro; varying float vA;
          void main() {
            vec3 caja = vec3(70.0, 30.0, 70.0);
            vec3 p = semilla.xyz * caja;
            p.y = mod(p.y - uTiempo * 14.0 * semilla.w, caja.y);
            p.x = mod(p.x - uTiempo * 1.5 - uCentro.x, caja.x) + uCentro.x - caja.x * 0.5;
            p.z = mod(p.z - uCentro.z, caja.z) + uCentro.z - caja.z * 0.5;
            p.y += position.y * 0.55;
            p.x += position.y * 0.06;
            vA = 0.35 + position.y * 0.3;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          }`,
        fragmentShader: 'uniform vec3 uColor; varying float vA; void main(){ gl_FragColor = vec4(uColor, vA * 0.5); }',
        transparent: true, depthWrite: false,
      });
      this.lluvia = new THREE.LineSegments(g, m);
      this.lluvia.frustumCulled = false;
      this.escena.add(this.lluvia);
    }
    this.aplicarLluvia(render);
  }

  aplicarLluvia(render) {
    const h = HORAS[this.hora];
    if (this.intensidadLluvia > 0) {
      this.escena.fog = new THREE.Fog(this.hora === 'noche' ? 0x0c1018 : 0x7d8590, 70, 260);
      this.sol.intensity = h.sol * 0.45;
      this.escena.backgroundIntensity = h.fondo * 0.55;
      this.escena.environmentIntensity = h.env * 0.9;
      render?.ambientar({ ...h.post, saturacion: h.post.saturacion * 0.85, exposicion: h.exposicion * 0.95 });
    } else {
      this.escena.fog = this.hora === 'noche' ? null : new THREE.Fog(h.niebla, 160, 700);
    }
  }

  actualizar(dt, camara) {
    if (this.lluvia) {
      this.lluvia.material.uniforms.uTiempo.value += dt;
      this.lluvia.material.uniforms.uCentro.value.copy(camara.position);
    }
  }
}
