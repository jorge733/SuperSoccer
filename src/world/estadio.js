// Estadio completo generado por código: cancha, líneas de cal, arcos con redes, graderías,
// techo, vallas LED, banderines, bancas, pantalla gigante y torres de iluminación.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CANCHA, MITAD_L, MITAD_A, semilla } from './medidas.js';
import { RedArco } from './red.js';
import { dibujarEmblema } from '../ui/emblema.js';

const ANCHO_TOTAL = 124; // pasto incluyendo zona de seguridad
const ALTO_TOTAL = 86;

// ---------- Textura del pasto: franjas de corte + desgaste en las áreas ----------
function texturaPasto(tam) {
  const W = tam, H = Math.round(tam * ALTO_TOTAL / ANCHO_TOTAL);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const px = W / ANCHO_TOTAL; // píxeles por metro
  const aX = (x) => (x + ANCHO_TOTAL / 2) * px;
  const aZ = (z) => (z + ALTO_TOTAL / 2) * px;
  ctx.fillStyle = '#3f7d2c';
  ctx.fillRect(0, 0, W, H);
  // Franjas de corte (perpendiculares al largo)
  const franjas = 20, anchoF = CANCHA.largo / franjas;
  for (let i = -3; i < franjas + 3; i++) {
    const x0 = -MITAD_L + i * anchoF;
    ctx.fillStyle = i % 2 === 0 ? '#467f2f' : '#3a7027';
    ctx.fillRect(aX(x0), 0, anchoF * px + 1, H);
  }
  // Franjas suaves cruzadas (corte en dos direcciones)
  ctx.globalAlpha = 0.07;
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = i % 2 ? '#000' : '#fff';
    ctx.fillRect(0, aZ(-MITAD_A + i * (CANCHA.ancho / 14)), W, (CANCHA.ancho / 14) * px + 1);
  }
  ctx.globalAlpha = 1;
  // Ruido: briznas y manchas
  const rnd = semilla(7);
  const n = Math.round(W * H / 40);
  for (let i = 0; i < n; i++) {
    const x = rnd() * W, y = rnd() * H;
    const l = rnd();
    ctx.fillStyle = l > 0.5 ? `rgba(120,170,70,${0.05 + rnd() * 0.08})` : `rgba(20,50,15,${0.05 + rnd() * 0.1})`;
    ctx.fillRect(x, y, 1 + rnd() * 2, 1 + rnd() * 2);
  }
  // Desgaste: arcos, puntos penales, círculo central y bandas
  const desgaste = (x, z, r, a) => {
    const g = ctx.createRadialGradient(aX(x), aZ(z), 0, aX(x), aZ(z), r * px);
    g.addColorStop(0, `rgba(120,98,58,${a})`);
    g.addColorStop(0.55, `rgba(110,100,60,${a * 0.5})`);
    g.addColorStop(1, 'rgba(110,100,60,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(aX(x), aZ(z), r * px, 0, Math.PI * 2); ctx.fill();
  };
  for (const s of [-1, 1]) {
    desgaste(s * (MITAD_L - 2.5), 0, 4.5, 0.55);
    desgaste(s * (MITAD_L - 1.2), 2.2, 2.2, 0.5);
    desgaste(s * (MITAD_L - 1.2), -2.2, 2.2, 0.5);
    desgaste(s * (MITAD_L - CANCHA.puntoPenal), 0, 1.4, 0.45);
    desgaste(s * (MITAD_L - 9), 0, 7, 0.18);
    for (let k = 0; k < 18; k++) desgaste(s * (MITAD_L - 5 - rnd() * 14), (rnd() - 0.5) * 22, 1 + rnd() * 2, 0.12);
  }
  desgaste(0, 0, 2.5, 0.3);
  for (let k = 0; k < 30; k++) desgaste((rnd() - 0.5) * 60, (rnd() - 0.5) * 50, 1 + rnd() * 3, 0.08);
  // Bandas por donde corren los jueces de línea
  ctx.fillStyle = 'rgba(110,100,60,0.12)';
  ctx.fillRect(aX(-MITAD_L), aZ(MITAD_A + 1.2), CANCHA.largo * px, 1.0 * px);
  ctx.fillRect(aX(-MITAD_L), aZ(-MITAD_A - 2.2), CANCHA.largo * px, 1.0 * px);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// Textura de detalle (briznas) que se repite muchas veces para verse bien de cerca.
function texturaDetalle() {
  const S = 256;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgb(128,128,128)'; ctx.fillRect(0, 0, S, S);
  const rnd = semilla(99);
  for (let i = 0; i < 9000; i++) {
    const x = rnd() * S, y = rnd() * S, l = 80 + rnd() * 110;
    ctx.strokeStyle = `rgb(${l},${l},${l})`;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (rnd() - 0.5) * 2, y + 2 + rnd() * 4); ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(ANCHO_TOTAL / 1.6, ALTO_TOTAL / 1.6);
  t.anisotropy = 8;
  return t;
}

// ---------- Líneas de cal como geometría (nítidas a cualquier distancia) ----------
function geometriaLineas() {
  const g = [];
  const w = CANCHA.linea;
  const rect = (x1, z1, x2, z2) => {
    const p = new THREE.PlaneGeometry(Math.abs(x2 - x1) || w, Math.abs(z2 - z1) || w).rotateX(-Math.PI / 2);
    p.translate((x1 + x2) / 2, 0, (z1 + z2) / 2);
    g.push(p);
  };
  const linea = (x1, z1, x2, z2) => {
    if (x1 === x2) rect(x1 - w / 2, Math.min(z1, z2), x1 + w / 2, Math.max(z1, z2));
    else rect(Math.min(x1, x2), z1 - w / 2, Math.max(x1, x2), z1 + w / 2);
  };
  const arco = (x, z, r, a0, a1, seg = 48) => {
    const p = new THREE.RingGeometry(r - w / 2, r + w / 2, seg, 1, a0, a1 - a0).rotateX(-Math.PI / 2);
    p.translate(x, 0, z);
    g.push(p);
  };
  const L = MITAD_L, A = MITAD_A;
  linea(-L, -A, L, -A); linea(-L, A, L, A);
  linea(-L, -A - w / 2, -L, A + w / 2); linea(L, -A - w / 2, L, A + w / 2);
  linea(0, -A, 0, A);
  arco(0, 0, CANCHA.radioCirculo, 0, Math.PI * 2, 96);
  arco(0, 0, 0.12, 0, Math.PI * 2, 16);
  for (const s of [-1, 1]) {
    const ag = CANCHA.areaGrande, ac = CANCHA.areaChica;
    const xg = s * (L - ag.largo), xc = s * (L - ac.largo);
    linea(xg, -ag.ancho / 2, xg, ag.ancho / 2);
    linea(s * L, -ag.ancho / 2, xg, -ag.ancho / 2);
    linea(s * L, ag.ancho / 2, xg, ag.ancho / 2);
    linea(xc, -ac.ancho / 2, xc, ac.ancho / 2);
    linea(s * L, -ac.ancho / 2, xc, -ac.ancho / 2);
    linea(s * L, ac.ancho / 2, xc, ac.ancho / 2);
    const xp = s * (L - CANCHA.puntoPenal);
    arco(xp, 0, 0.12, 0, Math.PI * 2, 16);
    // Medialuna: parte del círculo de 9,15 m fuera del área
    const ang = Math.acos((ag.largo - CANCHA.puntoPenal) / CANCHA.radioCirculo);
    // RingGeometry: ángulo 0 = +X en el plano; tras rotar -90° en X, +Y del plano pasa a -Z.
    if (s > 0) arco(xp, 0, CANCHA.radioCirculo, Math.PI - ang, Math.PI + ang);
    else arco(xp, 0, CANCHA.radioCirculo, -ang, ang);
    // Arcos de esquina
    arco(s * L, -A, 1, s > 0 ? Math.PI : Math.PI * 1.5, s > 0 ? Math.PI * 1.5 : Math.PI * 2, 12);
    arco(s * L, A, 1, s > 0 ? Math.PI / 2 : 0, s > 0 ? Math.PI : Math.PI / 2, 12);
  }
  const geo = mergeGeometries(g.map((p) => (p.index ? p.toNonIndexed() : p)));
  geo.translate(0, 0.006, 0);
  return geo;
}

// ---------- Texturas varias ----------
function texturaLED(textos, colores) {
  const c = document.createElement('canvas'); c.width = 2048; c.height = 64;
  const ctx = c.getContext('2d');
  const n = textos.length;
  for (let i = 0; i < n; i++) {
    const col = colores[i % colores.length];
    ctx.fillStyle = col[0];
    ctx.fillRect((i * 2048) / n, 0, 2048 / n, 64);
    ctx.fillStyle = col[1];
    ctx.font = '900 italic 40px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(textos[i], ((i + 0.5) * 2048) / n, 34);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

function texturaFoco() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 160;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#2a2d33'; ctx.fillRect(0, 0, 256, 160);
  for (let y = 0; y < 5; y++) for (let x = 0; x < 8; x++) {
    const g = ctx.createRadialGradient(18 + x * 31, 18 + y * 31, 1, 18 + x * 31, 18 + y * 31, 14);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.6, '#e8f0ff'); g.addColorStop(1, '#55585e');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(18 + x * 31, 18 + y * 31, 13, 0, Math.PI * 2); ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Graderías: escalones fusionados en una sola geometría con colores de asientos.
function crearGraderia({ largo, filas, prof, alto, asientos }) {
  const geos = [];
  const color = new THREE.Color();
  for (let i = 0; i < filas; i++) {
    const h = 0.9 + i * alto;
    const b = new THREE.BoxGeometry(largo, h, prof).toNonIndexed();
    b.translate(0, h / 2, i * prof + prof / 2);
    const col = asientos(i);
    color.set(col);
    const cols = new Float32Array(b.attributes.position.count * 3);
    for (let k = 0; k < cols.length; k += 3) { cols[k] = color.r; cols[k + 1] = color.g; cols[k + 2] = color.b; }
    b.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    geos.push(b);
  }
  // Muro trasero
  const hT = 0.9 + filas * alto + 3;
  const m = new THREE.BoxGeometry(largo, hT, 0.6).toNonIndexed();
  m.translate(0, hT / 2, filas * prof + 0.3);
  const cm = new Float32Array(m.attributes.position.count * 3).fill(0.42);
  m.setAttribute('color', new THREE.BufferAttribute(cm, 3));
  geos.push(m);
  return mergeGeometries(geos);
}

export class Estadio {
  constructor(escena, calidad) {
    this.escena = escena;
    this.grupo = new THREE.Group();
    escena.add(this.grupo);
    this.calidad = calidad;
    this.asientos = []; // posiciones para el público {pos, rotY, fila}
    this.redes = [];
    this.banderines = [];
    this.tiempo = 0;
    this.crearSuelo();
    this.crearLineas();
    this.crearArcos();
    this.crearVallas();
    this.crearGraderias();
    this.crearTorres();
    this.crearBancas();
    this.crearBanderines();
    this.crearPantalla();
  }

  crearSuelo() {
    const tex = texturaPasto(this.calidad.texturaCancha);
    const det = texturaDetalle();
    this.materialPasto = new THREE.MeshStandardMaterial({
      map: tex, roughness: 0.92, metalness: 0, bumpMap: det, bumpScale: 0.6, envMapIntensity: 0.7,
    });
    this.materialPasto.onBeforeCompile = (sh) => {
      sh.uniforms.tDetalle = { value: det };
      sh.uniforms.uMojado = this.uMojado = { value: 0 };
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform sampler2D tDetalle;\nuniform float uMojado;')
        .replace('#include <map_fragment>', `#include <map_fragment>
          float det = texture2D(tDetalle, vBumpMapUv).r;
          diffuseColor.rgb *= 0.78 + det * 0.45;
          diffuseColor.rgb *= 1.0 - uMojado * 0.28;`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
          roughnessFactor = mix(roughnessFactor, 0.28 + det * 0.25, uMojado);`);
    };
    const pasto = new THREE.Mesh(new THREE.PlaneGeometry(ANCHO_TOTAL, ALTO_TOTAL).rotateX(-Math.PI / 2), this.materialPasto);
    pasto.receiveShadow = true;
    this.grupo.add(pasto);
    // Suelo exterior (cemento)
    const ext = new THREE.Mesh(
      new THREE.PlaneGeometry(420, 420).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x55585c, roughness: 0.95 }),
    );
    ext.position.y = -0.02;
    ext.receiveShadow = true;
    this.grupo.add(ext);
    // Pista alrededor del pasto
    const pista = new THREE.Mesh(
      new THREE.RingGeometry(1, 1, 4).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x7a3d2c, roughness: 0.9 }),
    );
    pista.visible = false;
    this.grupo.add(pista);
  }

  crearLineas() {
    const m = new THREE.MeshStandardMaterial({
      color: 0xf4f6f2, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    const l = new THREE.Mesh(geometriaLineas(), m);
    l.receiveShadow = true;
    this.grupo.add(l);
  }

  crearArcos() {
    const blanco = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.1 });
    const gris = new THREE.MeshStandardMaterial({ color: 0xb8bcc2, roughness: 0.5, metalness: 0.6 });
    const A = CANCHA.anchoArco / 2, H = CANCHA.altoArco, r = CANCHA.radioPalo;
    for (const s of [-1, 1]) {
      const g = new THREE.Group();
      const x = s * (MITAD_L + r);
      const partes = [];
      for (const z of [-A - r, A + r]) {
        partes.push(new THREE.CylinderGeometry(r, r, H + r, 16).translate(x, (H + r) / 2, z));
      }
      partes.push(new THREE.CylinderGeometry(r, r, CANCHA.anchoArco + 4 * r, 16).rotateX(Math.PI / 2).translate(x, H + r, 0));
      const palos = new THREE.Mesh(mergeGeometries(partes), blanco);
      palos.castShadow = true;
      g.add(palos);
      // Soportes traseros
      const t = CANCHA.redTecho, f = CANCHA.redFondo;
      const sop = [];
      for (const z of [-A - 0.2, A + 0.2]) {
        sop.push(new THREE.CylinderGeometry(0.025, 0.025, t, 8).rotateZ(Math.PI / 2).translate(s * (MITAD_L + t / 2), H, z));
        const largo = Math.hypot(f - t, H);
        const c = new THREE.CylinderGeometry(0.025, 0.025, largo, 8);
        c.rotateZ(Math.atan2(f - t, H) * s);
        c.translate(s * (MITAD_L + (t + f) / 2), H / 2, z);
        sop.push(c);
      }
      sop.push(new THREE.CylinderGeometry(0.025, 0.025, CANCHA.anchoArco + 0.4, 8).rotateX(Math.PI / 2).translate(s * (MITAD_L + f), 0.03, 0));
      const soportes = new THREE.Mesh(mergeGeometries(sop), gris);
      soportes.castShadow = true;
      g.add(soportes);
      this.grupo.add(g);
      const red = new RedArco(s, this.calidad.redes);
      this.grupo.add(red.grupo);
      this.redes.push(red);
    }
  }

  crearVallas() {
    const textos = ['SUPERSOCCER', 'CORDILLERA', 'PACÍFICO', 'COPIHUE', 'ANDES', 'LA ROJA FC', 'ATACAMA', 'PATAGONIA'];
    const colores = [['#d52b1e', '#fff'], ['#0b2a6b', '#fff'], ['#f2f2f2', '#0b2a6b'], ['#141414', '#ffd23f']];
    const tex = texturaLED(textos, colores);
    this.texLED = tex;
    const mat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.6, roughness: 0.6 });
    this.matLED = mat;
    const dx = MITAD_L + 4.5, dz = MITAD_A + 3.5;
    const caja = (largo, rotY, x, z, rep) => {
      const geo = new THREE.BoxGeometry(largo, 0.9, 0.12);
      const tx = tex.clone(); tx.repeat.set(rep, 1); tx.needsUpdate = true;
      const mm = mat.clone(); mm.map = tx; mm.emissiveMap = tx;
      const m = new THREE.Mesh(geo, mm);
      m.position.set(x, 0.45, z);
      m.rotation.y = rotY;
      m.castShadow = true; m.receiveShadow = true;
      this.grupo.add(m);
      return mm;
    };
    this.materialesLED = [
      caja(dx * 2, 0, 0, -dz, 3), caja(dx * 2, Math.PI, 0, dz, 3),
      caja(dz * 2, Math.PI / 2, -dx, 0, 2), caja(dz * 2, -Math.PI / 2, dx, 0, 2),
    ];
  }

  crearGraderias() {
    const matG = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
    const rnd = semilla(3);
    const lados = [
      // [largo, filas, distancia, rotY, eje]
      { largo: 128, filas: 30, d: MITAD_A + 9, rot: 0, normal: new THREE.Vector3(0, 0, 1) },
      { largo: 128, filas: 30, d: MITAD_A + 9, rot: Math.PI, normal: new THREE.Vector3(0, 0, -1) },
      { largo: 88, filas: 24, d: MITAD_L + 10, rot: Math.PI / 2, normal: new THREE.Vector3(1, 0, 0) },
      { largo: 88, filas: 24, d: MITAD_L + 10, rot: -Math.PI / 2, normal: new THREE.Vector3(-1, 0, 0) },
    ];
    const prof = 0.82, alto = 0.42;
    this.coloresAsientos = ['#b8202a', '#f0f0f0', '#1e3d8f'];
    for (const [i, lado] of lados.entries()) {
      const geo = crearGraderia({
        largo: lado.largo, filas: lado.filas, prof, alto,
        asientos: (f) => this.coloresAsientos[Math.floor(f / 6) % this.coloresAsientos.length],
      });
      const m = new THREE.Mesh(geo, matG);
      m.receiveShadow = true;
      m.castShadow = i < 2;
      // La gradería se construye mirando hacia +Z local; la orientamos hacia la cancha.
      const grupo = new THREE.Group();
      grupo.add(m);
      grupo.rotation.y = lado.rot;
      grupo.position.copy(lado.normal).multiplyScalar(lado.d);
      // rot=0 => la gradería crece hacia +Z; para el lado +Z necesitamos que crezca hacia afuera (+Z) ✓
      this.grupo.add(grupo);
      // Posiciones de asientos (en coordenadas del mundo)
      const sep = 0.56;
      for (let f = 0; f < lado.filas; f++) {
        const n = Math.floor(lado.largo / sep);
        for (let k = 0; k < n; k++) {
          const lx = -lado.largo / 2 + (k + 0.5) * sep + (rnd() - 0.5) * 0.08;
          const lz = f * prof + prof * 0.45;
          const ly = 0.9 + f * alto;
          const v = new THREE.Vector3(lx, ly, lz).applyAxisAngle(new THREE.Vector3(0, 1, 0), lado.rot).add(grupo.position);
          this.asientos.push({ x: v.x, y: v.y, z: v.z, rot: lado.rot + Math.PI, fila: f });
        }
      }
      // Techo sobre las tribunas laterales
      if (i < 2) {
        const hT = 0.9 + lado.filas * alto + 6;
        const techo = new THREE.Mesh(
          new THREE.BoxGeometry(lado.largo + 4, 0.5, lado.filas * prof * 0.75),
          new THREE.MeshStandardMaterial({ color: 0xd8dade, roughness: 0.6, metalness: 0.3 }),
        );
        techo.position.set(0, hT, lado.filas * prof * 0.62);
        techo.rotation.x = -0.08;
        techo.castShadow = true;
        grupo.add(techo);
        const vigas = [];
        for (let x = -lado.largo / 2; x <= lado.largo / 2; x += 16) {
          vigas.push(new THREE.BoxGeometry(0.5, hT, 0.5).translate(x, hT / 2, lado.filas * prof + 0.6));
        }
        const v = new THREE.Mesh(mergeGeometries(vigas), new THREE.MeshStandardMaterial({ color: 0x9a9da3, metalness: 0.5, roughness: 0.5 }));
        v.castShadow = true;
        grupo.add(v);
      }
    }
  }

  crearTorres() {
    const matPoste = new THREE.MeshStandardMaterial({ color: 0x8f949b, metalness: 0.6, roughness: 0.4 });
    this.matFocos = new THREE.MeshStandardMaterial({
      map: texturaFoco(), emissiveMap: texturaFoco(), emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.4,
    });
    this.posFocos = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const x = sx * (MITAD_L + 22), z = sz * (MITAD_A + 25);
      const alto = 48;
      const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.1, alto, 12), matPoste);
      poste.position.set(x, alto / 2, z);
      poste.castShadow = true;
      this.grupo.add(poste);
      const panel = new THREE.Mesh(new THREE.BoxGeometry(10, 6, 0.6), [matPoste, matPoste, matPoste, matPoste, this.matFocos, matPoste]);
      panel.position.set(x, alto + 2, z);
      panel.lookAt(0, 0, 0);
      this.grupo.add(panel);
      this.posFocos.push(new THREE.Vector3(x, alto + 2, z));
    }
  }

  crearBancas() {
    const matTecho = new THREE.MeshPhysicalMaterial({ color: 0xaecbe8, transparent: true, opacity: 0.45, roughness: 0.1, transmission: 0 });
    const matAsiento = new THREE.MeshStandardMaterial({ color: 0x1b2b4a, roughness: 0.6 });
    const matMarco = new THREE.MeshStandardMaterial({ color: 0xdedede, metalness: 0.4, roughness: 0.4 });
    for (const sx of [-1, 1]) {
      const g = new THREE.Group();
      g.position.set(sx * 9, 0, MITAD_A + 5.2);
      const techo = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 8, 16, 1, true, -Math.PI / 2, Math.PI), matTecho);
      techo.rotation.z = Math.PI / 2;
      techo.rotation.y = 0;
      techo.position.y = 1.0;
      techo.scale.set(1, 1, 0.8);
      g.add(techo);
      const base = new THREE.Mesh(new THREE.BoxGeometry(8, 0.1, 1.6), matMarco);
      base.position.y = 0.05;
      g.add(base);
      for (let i = 0; i < 8; i++) {
        const a = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.5, 0.5), matAsiento);
        a.position.set(-3.5 + i, 0.35, 0.3);
        a.castShadow = true;
        g.add(a);
      }
      this.grupo.add(g);
    }
  }

  crearBanderines() {
    const matPalo = new THREE.MeshStandardMaterial({ color: 0xffd23f, roughness: 0.5 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const g = new THREE.Group();
      g.position.set(sx * MITAD_L, 0, sz * MITAD_A);
      const palo = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.55, 8), matPalo);
      palo.position.y = 0.775;
      palo.castShadow = true;
      g.add(palo);
      const geo = new THREE.PlaneGeometry(0.42, 0.3, 6, 3);
      geo.translate(0.21, 0, 0);
      const flag = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xd52b1e, side: THREE.DoubleSide, roughness: 0.7 }));
      flag.position.y = 1.4;
      flag.castShadow = true;
      g.add(flag);
      this.grupo.add(g);
      this.banderines.push({ flag, base: geo.attributes.position.array.slice(), fase: Math.random() * 6 });
    }
  }

  crearPantalla() {
    const c = document.createElement('canvas'); c.width = 768; c.height = 384;
    this.canvasPantalla = c;
    this.texPantalla = new THREE.CanvasTexture(c);
    this.texPantalla.colorSpace = THREE.SRGBColorSpace;
    const g = new THREE.Group();
    const x = -(MITAD_L + 10 + 24 * 0.82 + 1);
    g.position.set(x, 0.9 + 24 * 0.42 + 3 + 6, 0);
    g.rotation.y = Math.PI / 2;
    const marco = new THREE.Mesh(new THREE.BoxGeometry(22, 11.5, 0.8), new THREE.MeshStandardMaterial({ color: 0x1a1c20, roughness: 0.5 }));
    g.add(marco);
    this.matPantalla = new THREE.MeshBasicMaterial({ map: this.texPantalla, toneMapped: false });
    const pant = new THREE.Mesh(new THREE.PlaneGeometry(20.5, 10.25), this.matPantalla);
    pant.position.z = 0.42;
    g.add(pant);
    const pata = new THREE.Mesh(new THREE.BoxGeometry(1, 12, 1), new THREE.MeshStandardMaterial({ color: 0x55585e }));
    pata.position.set(0, -10, -0.5);
    g.add(pata);
    this.grupo.add(g);
    this.actualizarPantalla({ texto: 'SUPERSOCCER' });
  }

  // Pantalla gigante: marcador o mensajes.
  actualizarPantalla({ local, visita, gl = 0, gv = 0, minuto = null, texto = null }) {
    const c = this.canvasPantalla, ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, c.height);
    g.addColorStop(0, '#0b1a33'); g.addColorStop(1, '#030812');
    ctx.fillStyle = g; ctx.fillRect(0, 0, c.width, c.height);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (local && visita) {
      dibujarEmblema(ctx, local, 130, 60, 70);
      dibujarEmblema(ctx, visita, 130, c.width - 190, 70);
      ctx.fillStyle = '#fff';
      ctx.font = '900 120px "Segoe UI", Arial';
      ctx.fillText(`${gl} - ${gv}`, c.width / 2, 150);
      ctx.font = '800 34px "Segoe UI", Arial';
      ctx.fillText(local.corto.toUpperCase(), 125, 240);
      ctx.fillText(visita.corto.toUpperCase(), c.width - 125, 240);
      if (minuto !== null) {
        ctx.fillStyle = '#d52b1e';
        ctx.fillRect(c.width / 2 - 70, 250, 140, 54);
        ctx.fillStyle = '#fff';
        ctx.font = '800 38px "Segoe UI", Arial';
        ctx.fillText(`${minuto}'`, c.width / 2, 279);
      }
      if (texto) {
        ctx.fillStyle = '#ffd23f';
        ctx.font = '900 italic 52px "Segoe UI", Arial';
        ctx.fillText(texto, c.width / 2, 345);
      }
    } else {
      ctx.fillStyle = '#fff';
      ctx.font = '900 italic 92px "Segoe UI", Arial';
      ctx.fillText(texto || '', c.width / 2, c.height / 2);
    }
    this.texPantalla.needsUpdate = true;
  }

  colorearAsientos(colores) {
    this.coloresAsientos = colores;
  }

  fijarNoche(intensidad) {
    this.matFocos.emissiveIntensity = intensidad;
    for (const m of this.materialesLED) m.emissiveIntensity = 0.5 + intensidad * 0.25;
  }

  fijarMojado(v) { if (this.uMojado) this.uMojado.value = v; }

  actualizar(dt, balon) {
    this.tiempo += dt;
    for (const r of this.redes) r.actualizar(dt, balon);
    // Banderines ondeando
    for (const b of this.banderines) {
      const pos = b.flag.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = b.base[i * 3];
        pos.setZ(i, Math.sin(this.tiempo * 6 + b.fase + x * 12) * 0.05 * (x / 0.42));
      }
      pos.needsUpdate = true;
    }
    // Vallas LED desplazándose
    for (const m of this.materialesLED) m.map.offset.x = (this.tiempo * 0.03) % 1;
  }
}
