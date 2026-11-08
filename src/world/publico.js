// Público animado con "instancing": miles de hinchas en una sola llamada de dibujo.
// La animación (saltar, levantar los brazos) se calcula en la tarjeta gráfica.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { semilla } from './medidas.js';

function geometriaHincha() {
  const partes = [];
  const marcar = (g, brazo) => {
    const n = g.attributes.position.count;
    g.setAttribute('aBrazo', new THREE.BufferAttribute(new Float32Array(n).fill(brazo), 1));
    return g.index ? g.toNonIndexed() : g;
  };
  // Siluetas redondeadas (cápsulas) en vez de cajas: se ven como personas desde la cámara de TV
  partes.push(marcar(new THREE.CapsuleGeometry(0.19, 0.3, 1, 7).scale(1, 1, 0.62).translate(0, 0.68, 0), 0)); // torso
  partes.push(marcar(new THREE.SphereGeometry(0.11, 7, 5).scale(0.9, 1.08, 1).translate(0, 1.07, 0.01), 0)); // cabeza
  partes.push(marcar(new THREE.CapsuleGeometry(0.075, 0.3, 1, 5).rotateX(Math.PI / 2).translate(0.1, 0.32, 0.18), 0));  // muslos (sentado)
  partes.push(marcar(new THREE.CapsuleGeometry(0.075, 0.3, 1, 5).rotateX(Math.PI / 2).translate(-0.1, 0.32, 0.18), 0));
  partes.push(marcar(new THREE.CapsuleGeometry(0.05, 0.4, 1, 5).translate(0.25, 0.64, 0), 1));   // brazo izq
  partes.push(marcar(new THREE.CapsuleGeometry(0.05, 0.4, 1, 5).translate(-0.25, 0.64, 0), -1)); // brazo der
  const g = mergeGeometries(partes);
  // Color de piel en la cabeza y brazos: vertex color
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  const p = g.attributes.position;
  for (let i = 0; i < n; i++) {
    const cabeza = p.getY(i) > 0.95;
    const v = cabeza ? 0.0 : 1.0; // 0 = usar tono de piel, 1 = usar color de la camiseta
    col[i * 3] = v; col[i * 3 + 1] = v; col[i * 3 + 2] = v;
  }
  g.setAttribute('aRopa', new THREE.BufferAttribute(col.filter((_, i) => i % 3 === 0), 1));
  return g;
}

export class Publico {
  constructor(escena, asientos, cantidad) {
    this.escena = escena;
    this.uniforms = { uTiempo: { value: 0 }, uEmocion: { value: 0.2 }, uSalto: { value: 0 } };
    this.crear(asientos, cantidad);
  }

  crear(asientos, cantidad) {
    if (this.malla) { this.escena.remove(this.malla); this.malla.geometry.dispose(); }
    const rnd = semilla(42);
    // Elegimos asientos al azar (más llenos abajo)
    const lista = asientos.filter((a) => rnd() < 1.1 - a.fila * 0.008);
    for (let i = lista.length - 1; i > 0; i--) { const k = Math.floor(rnd() * (i + 1)); [lista[i], lista[k]] = [lista[k], lista[i]]; }
    const n = Math.min(cantidad, lista.length);
    const geo = geometriaHincha();
    const fase = new Float32Array(n);
    const piel = new Float32Array(n * 3);
    const mat = new THREE.MeshLambertMaterial({ vertexColors: false });
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, this.uniforms);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
          uniform float uTiempo; uniform float uEmocion; uniform float uSalto;
          attribute float aFase; attribute float aBrazo; attribute float aRopa; attribute vec3 aPiel;
          varying float vRopa; varying vec3 vPiel;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vRopa = aRopa; vPiel = aPiel;
          float ex = clamp(uEmocion, 0.0, 1.0);
          float ritmo = sin(uTiempo * (5.0 + aFase * 3.0) + aFase * 40.0);
          float activo = step(fract(aFase * 7.31), ex);
          // brazos arriba cuando hay emoción
          if (abs(aBrazo) > 0.5) {
            float sube = activo * smoothstep(0.45, 0.9, ex) * (0.75 + 0.25 * ritmo);
            vec3 hombro = vec3(0.25 * aBrazo, 0.86, 0.0);
            vec3 r = transformed - hombro;
            float a = sube * 2.7 * aBrazo;
            float c = cos(a), s = sin(a);
            transformed = hombro + vec3(r.x * c - r.y * s, r.x * s + r.y * c, r.z);
          }
          // de pie y saltando
          float pie = activo * ex;
          transformed.y += pie * 0.25 + max(0.0, ritmo) * pie * (0.12 + uSalto * 0.25);
          transformed.y += sin(uTiempo * 1.3 + aFase * 20.0) * 0.015;`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vRopa; varying vec3 vPiel;')
        .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb = mix(vPiel, diffuseColor.rgb, vRopa);');
    };
    const malla = new THREE.InstancedMesh(geo, mat, n);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), pos = new THREE.Vector3();
    const tonos = ['#f1d0b5', '#e6bc98', '#d9a77f', '#c68d63', '#a96e46', '#6b3f26'].map((c) => new THREE.Color(c));
    for (let i = 0; i < n; i++) {
      const a = lista[i];
      pos.set(a.x, a.y, a.z);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), a.rot + (rnd() - 0.5) * 0.3);
      const e = 0.9 + rnd() * 0.2;
      s.set(e, e, e);
      m.compose(pos, q, s);
      malla.setMatrixAt(i, m);
      fase[i] = rnd();
      const t = tonos[Math.floor(rnd() * tonos.length)];
      piel.set([t.r, t.g, t.b], i * 3);
    }
    geo.setAttribute('aFase', new THREE.InstancedBufferAttribute(fase, 1));
    geo.setAttribute('aPiel', new THREE.InstancedBufferAttribute(piel, 3));
    malla.instanceMatrix.needsUpdate = true;
    malla.frustumCulled = false;
    malla.castShadow = false;
    malla.receiveShadow = false;
    this.malla = malla;
    this.lista = lista.slice(0, n);
    this.escena.add(malla);
  }

  // Colores de las camisetas del público: mayoría local, algo de visita y neutros.
  colorear(coloresLocal, coloresVisita) {
    const rnd = semilla(11);
    const c = new THREE.Color();
    const neutros = ['#2a2a2a', '#3b4a63', '#6b6b6b', '#8a2a2a', '#ffffff'];
    for (let i = 0; i < this.malla.count; i++) {
      const a = this.lista[i];
      // la barra visitante se concentra en un sector de una cabecera
      const sectorVisita = a.x > 60 && a.z < 20 && a.z > -30;
      const r = rnd();
      let col;
      if (sectorVisita) col = r < 0.85 ? coloresVisita[Math.floor(rnd() * coloresVisita.length)] : neutros[Math.floor(rnd() * neutros.length)];
      else col = r < 0.72 ? coloresLocal[Math.floor(rnd() * coloresLocal.length)] : r < 0.8 ? coloresVisita[0] : neutros[Math.floor(rnd() * neutros.length)];
      c.set(col);
      c.offsetHSL(0, -0.12, (rnd() - 0.5) * 0.16);
      this.malla.setColorAt(i, c);
    }
    this.malla.instanceColor.needsUpdate = true;
  }

  actualizar(dt, emocion, salto = 0) {
    this.uniforms.uTiempo.value += dt;
    this.uniforms.uEmocion.value += (emocion - this.uniforms.uEmocion.value) * Math.min(1, dt * 2);
    this.uniforms.uSalto.value += (salto - this.uniforms.uSalto.value) * Math.min(1, dt * 2);
  }
}
