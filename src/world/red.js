// Red del arco: tela simulada (partículas con resortes) que se deforma y ondea cuando entra el balón.
import * as THREE from 'three';
import { CANCHA, MITAD_L } from './medidas.js';
import { RADIO_BALON } from './balon.js';

function texturaRed() {
  const S = 64;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, S, S);
  ctx.strokeStyle = 'rgba(255,255,255,1)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(0, S / 2); ctx.lineTo(S, S / 2);
  ctx.moveTo(S / 2, 0); ctx.lineTo(S / 2, S);
  ctx.stroke();
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

let TEX = null;

export class RedArco {
  constructor(lado, simulada = true) {
    this.lado = lado;
    this.simulada = simulada;
    this.grupo = new THREE.Group();
    TEX = TEX || texturaRed();
    const A = CANCHA.anchoArco / 2 + 0.05, H = CANCHA.altoArco, t = CANCHA.redTecho, f = CANCHA.redFondo;
    // Perfil: travesaño -> techo -> fondo inclinado -> piso (en coordenadas profundidad/altura)
    const perfil = [[0, H], [t, H], [f, 0]];
    const l1 = t, l2 = Math.hypot(f - t, H), total = l1 + l2;
    this.nu = 22; this.nv = 16;
    const nu = this.nu, nv = this.nv;
    const n = nu * nv;
    this.reposo = new Float32Array(n * 3);
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.fijo = new Uint8Array(n);
    for (let j = 0; j < nv; j++) {
      const s = (j / (nv - 1)) * total;
      let d, h;
      if (s <= l1) { d = s; h = H; } else { const k = (s - l1) / l2; d = t + (f - t) * k; h = H * (1 - k); }
      for (let i = 0; i < nu; i++) {
        const z = -A + (i / (nu - 1)) * 2 * A;
        const k = (j * nu + i) * 3;
        this.reposo[k] = lado * (MITAD_L + d);
        this.reposo[k + 1] = h;
        this.reposo[k + 2] = z;
        if (j === 0 || j === nv - 1 || i === 0 || i === nu - 1) this.fijo[j * nu + i] = 1;
      }
    }
    this.pos.set(this.reposo);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    const uv = new Float32Array(n * 2);
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      uv[(j * nu + i) * 2] = (i / (nu - 1)) * (2 * A) / 0.12;
      uv[(j * nu + i) * 2 + 1] = (j / (nv - 1)) * total / 0.12;
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const idx = [];
    for (let j = 0; j < nv - 1; j++) for (let i = 0; i < nu - 1; i++) {
      const a = j * nu + i, b = a + 1, c = a + nu, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    geo.setIndex(idx);
    geo.computeVertexNormals();
    this.geo = geo;
    const mat = new THREE.MeshStandardMaterial({
      map: TEX, alphaTest: 0.35, transparent: false, side: THREE.DoubleSide, roughness: 0.8, color: 0xf2f2f2,
    });
    this.malla = new THREE.Mesh(geo, mat);
    this.malla.castShadow = true;
    this.malla.frustumCulled = false;
    this.grupo.add(this.malla);

    // Costados (estáticos)
    for (const sz of [-1, 1]) {
      const forma = new THREE.Shape();
      forma.moveTo(0, 0); forma.lineTo(0, H); forma.lineTo(t, H); forma.lineTo(f, 0); forma.lineTo(0, 0);
      const g = new THREE.ShapeGeometry(forma);
      // ShapeGeometry está en XY: X = profundidad, Y = altura
      const p = g.attributes.position;
      const uvs = new Float32Array(p.count * 2);
      for (let i = 0; i < p.count; i++) { uvs[i * 2] = p.getX(i) / 0.12; uvs[i * 2 + 1] = p.getY(i) / 0.12; }
      g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      const m = new THREE.Mesh(g, mat);
      m.scale.x = lado;
      m.position.set(lado * MITAD_L, 0, sz * A);
      this.grupo.add(m);
    }
    this.activa = 0;
  }

  // Empuja la red con el balón y propaga la onda.
  actualizar(dt, balon) {
    if (!this.simulada || !balon) return;
    const bp = balon.pos;
    const cerca = Math.abs(bp.x) > MITAD_L - 0.5 && Math.sign(bp.x) === this.lado && Math.abs(bp.z) < 5 && bp.y < 3.5;
    if (!cerca && this.activa <= 0) return;
    this.activa = cerca ? 2.5 : this.activa - dt;
    const h = Math.min(dt, 1 / 30);
    const { pos, vel, reposo, fijo, nu, nv } = this;
    const r = RADIO_BALON + 0.05;
    const bv = balon.vel;
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const id = j * nu + i, k = id * 3;
      if (fijo[id]) continue;
      // Resorte a la posición de reposo + acoplamiento con vecinos (onda)
      for (let e = 0; e < 3; e++) {
        const lap = pos[k - 3 + e] + pos[k + 3 + e] + pos[k - nu * 3 + e] + pos[k + nu * 3 + e] - 4 * pos[k + e];
        const f = (reposo[k + e] - pos[k + e]) * 60 + lap * 260;
        vel[k + e] = (vel[k + e] + f * h) * Math.exp(-5 * h);
      }
      vel[k + 1] -= 1.5 * h;
      pos[k] += vel[k] * h; pos[k + 1] += vel[k + 1] * h; pos[k + 2] += vel[k + 2] * h;
      // Colisión con el balón
      const dx = pos[k] - bp.x, dy = pos[k + 1] - bp.y, dz = pos[k + 2] - bp.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < r * r * 9) {
        const d = Math.sqrt(d2) || 1e-4;
        if (d < r) {
          const empuje = (r - d) / d;
          pos[k] += dx * empuje; pos[k + 1] += dy * empuje; pos[k + 2] += dz * empuje;
        }
        const infl = Math.max(0, 1 - d / (r * 3));
        vel[k] += bv.x * infl * 0.25; vel[k + 1] += bv.y * infl * 0.25; vel[k + 2] += bv.z * infl * 0.25;
      }
    }
    this.geo.attributes.position.needsUpdate = true;
  }
}
