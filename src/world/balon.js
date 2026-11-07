// Balón: cuerpo físico en Rapier + efecto Magnus, roce del aire, roce del pasto y estela en tiros fuertes.
import * as THREE from 'three';
import { R } from './fisica.js';
import { CANCHA, MITAD_L } from './medidas.js';

const RADIO = CANCHA.radioBalon;
const _ax = new THREE.Vector3(), _m = new THREE.Vector3(), _w = new THREE.Vector3(), _q = new THREE.Quaternion();
const _dir = new THREE.Vector3(), _lado = new THREE.Vector3(), _aCam = new THREE.Vector3();
const MASA = 0.43;

// Textura del balón: 32 paneles (12 pentágonos + 20 hexágonos) calculados por píxel.
function texturaBalon() {
  const W = 512, H = 256;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(W, H);
  const fi = (1 + Math.sqrt(5)) / 2;
  const ico = [
    [-1, fi, 0], [1, fi, 0], [-1, -fi, 0], [1, -fi, 0], [0, -1, fi], [0, 1, fi],
    [0, -1, -fi], [0, 1, -fi], [fi, 0, -1], [fi, 0, 1], [-fi, 0, -1], [-fi, 0, 1],
  ].map((v) => new THREE.Vector3(...v).normalize());
  const caras = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ].map(([a, b, d]) => ico[a].clone().add(ico[b]).add(ico[d]).normalize());
  const centros = [...ico.map((v) => ({ v, pent: true })), ...caras.map((v) => ({ v, pent: false }))];
  const p = new THREE.Vector3();
  for (let y = 0; y < H; y++) {
    const lat = (0.5 - y / H) * Math.PI;
    for (let x = 0; x < W; x++) {
      const lon = (x / W) * Math.PI * 2;
      p.set(Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon));
      let d1 = -2, d2 = -2, i1 = 0;
      for (let i = 0; i < centros.length; i++) {
        const d = p.dot(centros[i].v);
        if (d > d1) { d2 = d1; d1 = d; i1 = i; } else if (d > d2) d2 = d;
      }
      const costura = d1 - d2 < 0.012;
      let r = 245, g = 246, b = 248;
      if (centros[i1].pent) {
        const ang = Math.acos(Math.min(1, d1));
        if (ang < 0.2) { r = 200; g = 30; b = 40; } else if (ang < 0.28) { r = 15; g = 40; b = 130; }
      } else {
        const ang = Math.acos(Math.min(1, d1));
        if (ang > 0.3 && ang < 0.33) { r = 30; g = 30; b = 40; }
      }
      if (costura) { r *= 0.55; g *= 0.55; b *= 0.55; }
      const o = (y * W + x) * 4;
      img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export class Balon {
  constructor(escena, fisica) {
    this.fisica = fisica;
    const desc = R.RigidBodyDesc.dynamic().setTranslation(0, RADIO, 0).lockRotations().setCcdEnabled(true)
      .setLinearDamping(0).setAdditionalMass(MASA);
    this.cuerpo = fisica.mundo.createRigidBody(desc);
    this.col = fisica.mundo.createCollider(
      R.ColliderDesc.ball(RADIO).setDensity(0).setRestitution(0.72).setFriction(0.0)
        .setFrictionCombineRule(R.CoefficientCombineRule.Min)
        .setActiveEvents(R.ActiveEvents.COLLISION_EVENTS),
      this.cuerpo,
    );
    this.efecto = new THREE.Vector3();      // giro (rad/s) que genera la curva
    this.giroVisual = new THREE.Quaternion();
    this.pos = new THREE.Vector3(0, RADIO, 0);
    this.vel = new THREE.Vector3();
    this.mojado = false;
    this.enRed = false;

    const geo = new THREE.SphereGeometry(RADIO, 32, 20);
    this.malla = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: texturaBalon(), roughness: 0.42, metalness: 0 }));
    this.malla.castShadow = true;
    escena.add(this.malla);

    // Sombra de contacto (siempre visible, ayuda a leer la altura del balón)
    const sc = document.createElement('canvas'); sc.width = sc.height = 64;
    const sx = sc.getContext('2d');
    const gr = sx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    sx.fillStyle = gr; sx.fillRect(0, 0, 64, 64);
    this.sombra = new THREE.Mesh(
      new THREE.PlaneGeometry(0.5, 0.5).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }),
    );
    this.sombra.renderOrder = 2;
    escena.add(this.sombra);

    // Estela para tiros fuertes
    this.N_ESTELA = 18;
    this.estelaPts = Array.from({ length: this.N_ESTELA }, () => new THREE.Vector3());
    const eg = new THREE.BufferGeometry();
    eg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.N_ESTELA * 2 * 3), 3));
    eg.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(this.N_ESTELA * 2), 1));
    const idx = [];
    for (let i = 0; i < this.N_ESTELA - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    eg.setIndex(idx);
    this.estela = new THREE.Mesh(eg, new THREE.ShaderMaterial({
      uniforms: { intensidad: { value: 0 } },
      vertexShader: 'attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform float intensidad; varying float vA; void main(){ gl_FragColor = vec4(1.0,0.97,0.9, vA * intensidad * 0.45); }',
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    }));
    this.estela.frustumCulled = false;
    escena.add(this.estela);
    this.intensidadEstela = 0;
    this.leer();
  }

  leer() {
    const t = this.cuerpo.translation(), v = this.cuerpo.linvel();
    this.pos.set(t.x, t.y, t.z);
    this.vel.set(v.x, v.y, v.z);
  }

  colocar(x, y, z) {
    this.cuerpo.setTranslation({ x, y: Math.max(RADIO, y), z }, true);
    this.cuerpo.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.efecto.set(0, 0, 0);
    this.leer();
    for (const p of this.estelaPts) p.copy(this.pos);
  }

  fijarVelocidad(v) {
    this.cuerpo.setLinvel({ x: v.x, y: v.y, z: v.z }, true);
    this.vel.copy(v);
  }

  patear(v, efecto = null) {
    this.fijarVelocidad(v);
    if (efecto) this.efecto.copy(efecto); else this.efecto.set(0, 0, 0);
  }

  enSuelo() { return this.pos.y < RADIO + 0.04 && Math.abs(this.vel.y) < 1.2; }

  // Se llama en cada sub-paso de física (120 por segundo).
  fuerzas(h) {
    this.leer();
    const v = this.vel;
    const vel = v.length();
    const ax = _ax.set(0, 0, 0);
    // Roce del aire
    if (vel > 0.01) ax.addScaledVector(v, -0.011 * vel);
    // Efecto Magnus (curva)
    if (this.efecto.lengthSq() > 0.01 && !this.enSuelo()) {
      ax.add(_m.crossVectors(this.efecto, v).multiplyScalar(0.013));
    }
    this.efecto.multiplyScalar(Math.exp(-0.5 * h));
    // Roce del pasto (rodando)
    if (this.enSuelo()) {
      const hv = Math.hypot(v.x, v.z);
      if (hv > 0.02) {
        const des = (this.mojado ? 0.6 : 0.9) + (this.mojado ? 0.07 : 0.12) * hv;
        const f = Math.min(des * h, hv) / hv;
        v.x -= v.x * f; v.z -= v.z * f;
      } else { v.x = 0; v.z = 0; }
      this.efecto.multiplyScalar(Math.exp(-4 * h));
    }
    // Dentro del arco: la red absorbe el balón
    const dentro = Math.abs(this.pos.x) > MITAD_L + 0.15 && Math.abs(this.pos.z) < CANCHA.anchoArco / 2 + 0.2 && this.pos.y < CANCHA.altoArco + 0.2;
    this.enRed = dentro;
    if (dentro) v.multiplyScalar(Math.exp(-3.5 * h));
    v.addScaledVector(ax, h);
    this.cuerpo.setLinvel({ x: v.x, y: v.y, z: v.z }, true);
  }

  actualizarVisual(dt, camara) {
    this.leer();
    this.malla.position.copy(this.pos);
    // Giro visual: rodando en el suelo o según el efecto en el aire.
    const w = _w;
    if (this.enSuelo()) w.set(this.vel.z, 0, -this.vel.x).divideScalar(RADIO);
    else w.set(this.vel.z * 2, 0, -this.vel.x * 2).add(this.efecto);
    const ang = w.length() * dt;
    if (ang > 1e-5) this.malla.quaternion.premultiply(_q.setFromAxisAngle(w.normalize(), ang));
    this.sombra.position.set(this.pos.x, 0.015, this.pos.z);
    const s = Math.max(0.3, 1 - this.pos.y * 0.12);
    this.sombra.scale.setScalar(s);
    this.sombra.material.opacity = Math.max(0.15, 1 - this.pos.y * 0.15);

    // Estela
    const vel = this.vel.length();
    const objetivo = vel > 21 && !this.enSuelo() ? Math.min(1, (vel - 21) / 8) : 0;
    this.intensidadEstela += (objetivo - this.intensidadEstela) * Math.min(1, dt * 8);
    const viejo = this.estelaPts.pop();
    this.estelaPts.unshift(viejo.copy(this.pos));
    this.estela.material.uniforms.intensidad.value = this.intensidadEstela;
    this.estela.visible = this.intensidadEstela > 0.01;
    if (this.estela.visible && camara) {
      const pos = this.estela.geometry.attributes.position, al = this.estela.geometry.attributes.alpha;
      const dir = _dir, lado = _lado, aCam = _aCam;
      for (let i = 0; i < this.N_ESTELA; i++) {
        const p = this.estelaPts[i], q = this.estelaPts[Math.min(i + 1, this.N_ESTELA - 1)];
        dir.subVectors(p, q); if (dir.lengthSq() < 1e-6) dir.set(1, 0, 0);
        aCam.subVectors(camara.position, p);
        lado.crossVectors(dir, aCam).normalize().multiplyScalar(RADIO * 0.9 * (1 - i / this.N_ESTELA));
        pos.setXYZ(i * 2, p.x + lado.x, p.y + lado.y, p.z + lado.z);
        pos.setXYZ(i * 2 + 1, p.x - lado.x, p.y - lado.y, p.z - lado.z);
        const a = 1 - i / this.N_ESTELA;
        al.setX(i * 2, a); al.setX(i * 2 + 1, a);
      }
      pos.needsUpdate = true; al.needsUpdate = true;
    }
  }
}

export { RADIO as RADIO_BALON };
