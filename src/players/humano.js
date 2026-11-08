// Modelo humano 3D generado por código: malla con esqueleto (SkinnedMesh) de 17 huesos.
// Varía altura, contextura, tono de piel, pelo y barba. 2 llamadas de dibujo por jugador.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const HUESOS = [
  'hips', 'spine', 'chest', 'neck', 'head',
  'lUpperArm', 'lForeArm', 'lHand', 'rUpperArm', 'rForeArm', 'rHand',
  'lThigh', 'lShin', 'lFoot', 'rThigh', 'rShin', 'rFoot',
];
export const IDX = Object.fromEntries(HUESOS.map((n, i) => [n, i]));
const PADRE = {
  spine: 'hips', chest: 'spine', neck: 'chest', head: 'neck',
  lUpperArm: 'chest', lForeArm: 'lUpperArm', lHand: 'lForeArm',
  rUpperArm: 'chest', rForeArm: 'rUpperArm', rHand: 'rForeArm',
  lThigh: 'hips', lShin: 'lThigh', lFoot: 'lShin', rThigh: 'hips', rShin: 'rThigh', rFoot: 'rShin',
};
// Posiciones relativas al padre (modelo de 1,80 m). La izquierda del jugador es +X (mira hacia +Z).
const OFFSET = {
  hips: [0, 0.98, 0], spine: [0, 0.1, 0], chest: [0, 0.2, 0], neck: [0, 0.22, 0], head: [0, 0.07, 0],
  lUpperArm: [0.19, 0.17, -0.01], lForeArm: [0, -0.29, 0], lHand: [0, -0.26, 0],
  rUpperArm: [-0.19, 0.17, -0.01], rForeArm: [0, -0.29, 0], rHand: [0, -0.26, 0],
  lThigh: [0.095, -0.06, 0], lShin: [0, -0.44, 0], lFoot: [0, -0.42, 0],
  rThigh: [-0.095, -0.06, 0], rShin: [0, -0.44, 0], rFoot: [0, -0.42, 0],
};

// Roles de color de cada vértice (para recolorear al cambiar de camiseta).
const ROL = { piel: 0, pelo: 1, manga: 2, short: 3, media: 4, zapato: 5, guante: 6, antebrazo: 7, ojos: 8, cuello: 9 };

export const TONOS_PIEL = ['#f1d0b5', '#e6bc98', '#d9a77f', '#c68d63', '#a96e46', '#8a5535', '#6b3f26', '#4e2c1b'];
export const COLORES_PELO = ['#1a120c', '#2b1b10', '#3d2716', '#5a3a1e', '#7a5530', '#b08850', '#0d0d0d', '#6e6e6e'];
export const ESTILOS_PELO = ['corto', 'rapado', 'crespo', 'largo', 'pelado', 'mohicano'];

function posicionMundo(nombre) {
  const p = new THREE.Vector3(...OFFSET[nombre]);
  let n = PADRE[nombre];
  while (n) { p.add(new THREE.Vector3(...OFFSET[n])); n = PADRE[n]; }
  return p;
}

// Prepara una pieza: geometría en coordenadas del hueso -> modelo, con pesos e índices de piel.
function pieza(geo, hueso, rol, { mover = [0, 0, 0], pesos = null } = {}) {
  let g = geo.index ? geo.toNonIndexed() : geo;
  const base = posicionMundo(hueso);
  g.translate(base.x + mover[0], base.y + mover[1], base.z + mover[2]);
  const n = g.attributes.position.count;
  const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4), roles = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    if (pesos) {
      const r = pesos(g.attributes.position.getY(i), g.attributes.position.getX(i));
      for (let k = 0; k < Math.min(4, r.length); k++) { si[i * 4 + k] = IDX[r[k][0]]; sw[i * 4 + k] = r[k][1]; }
    } else { si[i * 4] = IDX[hueso]; sw[i * 4] = 1; }
    roles[i] = rol;
  }
  g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  g.setAttribute('rol', new THREE.BufferAttribute(roles, 1));
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  g.deleteAttribute('uv1');
  return g;
}

function mezcla(y, y0, y1, a, b) {
  const t = Math.min(1, Math.max(0, (y - y0) / (y1 - y0)));
  if (t <= 0) return [[a, 1]];
  if (t >= 1) return [[b, 1]];
  return [[a, 1 - t], [b, t]];
}

export function crearModelo(apariencia = {}) {
  const {
    altura = 1.8, contextura = 1, piel = 2, colorPelo = 0, estiloPelo = 'corto', barba = false,
  } = apariencia;
  const c = contextura;
  const cuerpo = [];
  const torso = [];

  // --- Torso con camiseta (textura) ---
  const tg = new THREE.CylinderGeometry(0.185 * c, 0.152 * c, 0.54, 20, 8, false, -Math.PI / 2);
  tg.scale(1, 1, 0.64);
  // Ensancha un poco el pecho
  const tp = tg.attributes.position;
  for (let i = 0; i < tp.count; i++) {
    const y = tp.getY(i);
    const k = 1 + Math.max(0, Math.sin(((y + 0.27) / 0.54) * Math.PI)) * 0.06;
    tp.setX(i, tp.getX(i) * k); tp.setZ(i, tp.getZ(i) * k * (tp.getZ(i) > 0 ? 1.06 : 1));
  }
  // UV: v de 0.08 a 1 (deja la franja inferior para otros usos)
  const tuv = tg.attributes.uv;
  for (let i = 0; i < tuv.count; i++) tuv.setY(i, 0.06 + tuv.getY(i) * 0.94);
  torso.push(pieza(tg, 'hips', ROL.manga, {
    mover: [0, 0.24, 0],
    pesos: (y) => (y < 1.07 ? mezcla(y, 0.99, 1.07, 'hips', 'spine') : mezcla(y, 1.14, 1.28, 'spine', 'chest')),
  }));

  // Hombros redondeados (color manga)
  for (const lado of ['l', 'r']) {
    cuerpo.push(pieza(new THREE.SphereGeometry(0.075 * c, 12, 8), `${lado}UpperArm`, ROL.manga, { mover: [0, -0.02, 0] }));
    // Manga corta
    cuerpo.push(pieza(new THREE.CylinderGeometry(0.066 * c, 0.058 * c, 0.17, 12, 1, true).translate(0, -0.085, 0), `${lado}UpperArm`, ROL.manga));
    // Brazo
    cuerpo.push(pieza(new THREE.CapsuleGeometry(0.044 * c, 0.22, 4, 10).translate(0, -0.15, 0), `${lado}UpperArm`, ROL.piel));
    cuerpo.push(pieza(new THREE.CapsuleGeometry(0.039 * c, 0.2, 4, 10).translate(0, -0.12, 0), `${lado}ForeArm`, ROL.antebrazo));
    cuerpo.push(pieza(new THREE.SphereGeometry(0.046, 10, 8).scale(0.75, 1.25, 0.55).translate(0, -0.06, 0.005), `${lado}Hand`, ROL.guante));
    // Piernas
    cuerpo.push(pieza(new THREE.CylinderGeometry(0.092 * c, 0.083 * c, 0.24, 14, 1, true).translate(0, -0.08, 0), `${lado}Thigh`, ROL.short));
    cuerpo.push(pieza(new THREE.CapsuleGeometry(0.072 * c, 0.3, 4, 12).translate(0, -0.23, 0), `${lado}Thigh`, ROL.piel));
    cuerpo.push(pieza(new THREE.SphereGeometry(0.058 * c, 10, 8), `${lado}Shin`, ROL.piel));
    cuerpo.push(pieza(new THREE.CapsuleGeometry(0.052 * c, 0.1, 4, 10).translate(0, -0.06, 0), `${lado}Shin`, ROL.piel));
    const media = new THREE.CylinderGeometry(0.057 * c, 0.042, 0.34, 12, 1, false).translate(0, -0.25, 0.008);
    cuerpo.push(pieza(media, `${lado}Shin`, ROL.media));
    cuerpo.push(pieza(new THREE.SphereGeometry(0.044, 10, 8), `${lado}Foot`, ROL.media));
    // Zapato con punta redondeada
    const zap = new THREE.CapsuleGeometry(0.045, 0.17, 4, 10).rotateX(Math.PI / 2).scale(1.05, 0.85, 1).translate(0, -0.02, 0.06);
    cuerpo.push(pieza(zap, `${lado}Foot`, ROL.zapato));
  }
  // Short (pelvis)
  const sh = new THREE.CylinderGeometry(0.168 * c, 0.178 * c, 0.2, 18, 1, false).scale(1, 1, 0.66).translate(0, -0.06, 0);
  cuerpo.push(pieza(sh, 'hips', ROL.short));
  // Cuello y cabeza
  cuerpo.push(pieza(new THREE.CylinderGeometry(0.06, 0.066, 0.14, 12).translate(0, 0.02, 0.005), 'neck', ROL.piel));
  cuerpo.push(pieza(new THREE.TorusGeometry(0.068, 0.014, 6, 16).rotateX(Math.PI / 2).translate(0, -0.03, 0.004), 'neck', ROL.cuello));
  cuerpo.push(pieza(new THREE.SphereGeometry(0.1, 20, 14).scale(0.86, 1.08, 0.98).translate(0, 0.1, 0.012), 'head', ROL.piel));
  cuerpo.push(pieza(new THREE.SphereGeometry(0.06, 12, 8).scale(1.05, 0.7, 1).translate(0, 0.035, 0.035), 'head', ROL.piel)); // mandíbula
  cuerpo.push(pieza(new THREE.BoxGeometry(0.022, 0.04, 0.03).translate(0, 0.095, 0.105), 'head', ROL.piel)); // nariz
  for (const sx of [-1, 1]) {
    cuerpo.push(pieza(new THREE.SphereGeometry(0.022, 8, 6).scale(0.5, 1, 0.8).translate(sx * 0.087, 0.1, 0.005), 'head', ROL.piel));
    cuerpo.push(pieza(new THREE.SphereGeometry(0.011, 8, 6).translate(sx * 0.033, 0.118, 0.094), 'head', ROL.ojos));
  }
  // Pelo
  const hemi = (r, sy = 1) => new THREE.SphereGeometry(r, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.55).scale(0.88, 1.05 * sy, 1.0);
  if (estiloPelo === 'corto') cuerpo.push(pieza(hemi(0.106).translate(0, 0.11, 0.0), 'head', ROL.pelo));
  else if (estiloPelo === 'rapado') cuerpo.push(pieza(hemi(0.103, 0.95).translate(0, 0.108, 0.004), 'head', ROL.pelo));
  else if (estiloPelo === 'crespo') cuerpo.push(pieza(new THREE.IcosahedronGeometry(0.118, 1).scale(0.92, 0.82, 1).translate(0, 0.15, -0.008), 'head', ROL.pelo));
  else if (estiloPelo === 'largo') {
    cuerpo.push(pieza(hemi(0.11).translate(0, 0.105, -0.004), 'head', ROL.pelo));
    cuerpo.push(pieza(new THREE.BoxGeometry(0.17, 0.16, 0.06).translate(0, 0.04, -0.075), 'head', ROL.pelo));
  } else if (estiloPelo === 'mohicano') {
    cuerpo.push(pieza(new THREE.BoxGeometry(0.035, 0.05, 0.2).translate(0, 0.2, -0.005), 'head', ROL.pelo));
    cuerpo.push(pieza(hemi(0.102, 0.95).translate(0, 0.107, 0.004), 'head', ROL.pelo));
  }
  if (barba) cuerpo.push(pieza(new THREE.SphereGeometry(0.064, 12, 8, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55).scale(1.08, 0.75, 1.02).translate(0, 0.05, 0.034), 'head', ROL.pelo));

  const geoCuerpo = mergeGeometries(cuerpo);
  const geoTorso = mergeGeometries(torso);
  const geo = mergeGeometries([geoCuerpo, geoTorso], true);
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 3), 3));

  // Esqueleto
  const huesos = HUESOS.map((n) => { const b = new THREE.Bone(); b.name = n; b.position.set(...OFFSET[n]); return b; });
  for (const n of HUESOS) if (PADRE[n]) huesos[IDX[PADRE[n]]].add(huesos[IDX[n]]);
  const esqueleto = new THREE.Skeleton(huesos);

  const matCuerpo = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0 });
  const matTorso = new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0, vertexColors: false });
  const malla = new THREE.SkinnedMesh(geo, [matCuerpo, matTorso]);
  malla.add(huesos[0]);
  malla.bind(esqueleto);
  malla.castShadow = true;
  malla.receiveShadow = false;
  malla.frustumCulled = false;

  const grupo = new THREE.Group();
  grupo.add(malla);
  grupo.scale.setScalar(altura / 1.8);

  const modelo = {
    grupo, malla, huesos, esqueleto, matTorso, matCuerpo,
    apariencia: { altura, contextura, piel, colorPelo, estiloPelo, barba },
    colorear(kit, esArquero = false) {
      const tonoPiel = new THREE.Color(TONOS_PIEL[piel] || TONOS_PIEL[2]);
      const pelo = new THREE.Color(COLORES_PELO[colorPelo] || COLORES_PELO[0]);
      if (estiloPelo === 'rapado') pelo.lerp(tonoPiel, 0.35);
      const col = {
        [ROL.piel]: tonoPiel, [ROL.pelo]: pelo,
        [ROL.manga]: new THREE.Color(kit.manga || kit.camiseta),
        [ROL.short]: new THREE.Color(kit.short),
        [ROL.media]: new THREE.Color(kit.medias),
        [ROL.zapato]: new THREE.Color(kit.zapatos || '#111111'),
        [ROL.guante]: esArquero ? new THREE.Color(kit.guantes || '#e8e8e8') : tonoPiel,
        [ROL.antebrazo]: esArquero ? new THREE.Color(kit.manga || kit.camiseta) : tonoPiel,
        [ROL.ojos]: new THREE.Color('#1a1410'),
        [ROL.cuello]: new THREE.Color(kit.detalle || kit.camiseta),
      };
      const roles = geo.attributes.rol.array, colores = geo.attributes.color.array;
      for (let i = 0; i < roles.length; i++) {
        const cc = col[roles[i]] || tonoPiel;
        colores[i * 3] = cc.r; colores[i * 3 + 1] = cc.g; colores[i * 3 + 2] = cc.b;
      }
      geo.attributes.color.needsUpdate = true;
    },
    fijarTexturaCamiseta(tex) {
      matTorso.map = tex;
      matTorso.needsUpdate = true;
    },
  };
  return modelo;
}

// Esqueleto sin malla: lo usa el jugador realista para calcular la animación antes de trasladarla.
export function crearEsqueleto() {
  const huesos = HUESOS.map((n) => { const b = new THREE.Bone(); b.name = n; b.position.set(...OFFSET[n]); return b; });
  for (const n of HUESOS) if (PADRE[n]) huesos[IDX[PADRE[n]]].add(huesos[IDX[n]]);
  return huesos;
}
export { PADRE, OFFSET };
