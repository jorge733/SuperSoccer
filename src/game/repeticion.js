// Grabación continua de los últimos segundos (posición, giro y pose de cada hueso) para repetir los goles.
import { HUESOS } from '../players/humano.js';

const NB = HUESOS.length;
const POR_ENTIDAD = 3 + 1 + NB * 3 + 3; // pos(x,y,z) + rumbo + rotaciones de huesos + posición de cadera
const HZ = 30;

export class Repeticion {
  constructor(entidades, balon, segundos = 8) {
    this.ent = entidades;
    this.balon = balon;
    this.max = Math.round(segundos * HZ);
    this.tamCuadro = entidades.length * POR_ENTIDAD + 7;
    this.buffer = new Float32Array(this.max * this.tamCuadro);
    this.visibles = new Uint8Array(this.max * entidades.length);
    this.n = 0;        // cuadros grabados
    this.cabeza = 0;   // siguiente índice a escribir
    this.acum = 0;
  }

  reiniciar() { this.n = 0; this.cabeza = 0; this.acum = 0; }

  grabar(dt) {
    this.acum += dt;
    if (this.acum < 1 / HZ) return;
    this.acum -= 1 / HZ;
    const base = this.cabeza * this.tamCuadro;
    const b = this.buffer;
    let o = base;
    for (let e = 0; e < this.ent.length; e++) {
      const j = this.ent[e];
      const g = j.grupo;
      this.visibles[this.cabeza * this.ent.length + e] = g.visible ? 1 : 0;
      b[o++] = g.position.x; b[o++] = g.position.y; b[o++] = g.position.z; b[o++] = g.rotation.y;
      const hs = j.modelo.huesos;
      for (let k = 0; k < NB; k++) { const r = hs[k].rotation; b[o++] = r.x; b[o++] = r.y; b[o++] = r.z; }
      const hp = hs[0].position; b[o++] = hp.x; b[o++] = hp.y; b[o++] = hp.z;
    }
    const m = this.balon.malla;
    b[o++] = m.position.x; b[o++] = m.position.y; b[o++] = m.position.z;
    b[o++] = m.quaternion.x; b[o++] = m.quaternion.y; b[o++] = m.quaternion.z; b[o++] = m.quaternion.w;
    this.cabeza = (this.cabeza + 1) % this.max;
    this.n = Math.min(this.n + 1, this.max);
  }

  duracion() { return this.n / HZ; }

  // t: segundos desde el inicio de lo grabado (0 .. duracion)
  aplicar(t) {
    if (this.n < 2) return;
    const f = Math.max(0, Math.min(this.n - 1.001, t * HZ));
    const i0 = Math.floor(f), u = f - i0;
    const inicio = (this.cabeza - this.n + this.max) % this.max;
    const a = ((inicio + i0) % this.max) * this.tamCuadro;
    const c = ((inicio + i0 + 1) % this.max) * this.tamCuadro;
    const B = this.buffer;
    const L = (k) => B[a + k] + (B[c + k] - B[a + k]) * u;
    let o = 0;
    for (let e = 0; e < this.ent.length; e++) {
      const j = this.ent[e];
      j.grupo.visible = this.visibles[((inicio + i0) % this.max) * this.ent.length + e] === 1;
      j.grupo.position.set(L(o), L(o + 1), L(o + 2));
      // rumbo: interpolación por el camino corto
      let r0 = B[a + o + 3], r1 = B[c + o + 3];
      while (r1 - r0 > Math.PI) r1 -= Math.PI * 2;
      while (r1 - r0 < -Math.PI) r1 += Math.PI * 2;
      j.grupo.rotation.y = r0 + (r1 - r0) * u;
      o += 4;
      const hs = j.modelo.huesos;
      for (let k = 0; k < NB; k++) { hs[k].rotation.set(L(o), L(o + 1), L(o + 2)); o += 3; }
      hs[0].position.set(L(o), L(o + 1), L(o + 2)); o += 3;
      j.modelo.alAplicarPose?.();
    }
    const m = this.balon.malla;
    m.position.set(L(o), L(o + 1), L(o + 2));
    m.quaternion.set(B[a + o + 3], B[a + o + 4], B[a + o + 5], B[a + o + 6]);
    this.balon.sombra.position.set(m.position.x, 0.015, m.position.z);
    this.posBalon = m.position;
  }
}
