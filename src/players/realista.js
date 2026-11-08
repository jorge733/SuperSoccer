// Futbolistas realistas: modelos Microsoft Rocketbox (licencia MIT) en GLB comprimido con Meshopt
// y texturas KTX2. La camiseta de cada club (colores, diseño, número y nombre) se pinta en la tarjeta
// gráfica con un sombreador propio, y las animaciones del juego se trasladan ("retarget") a su esqueleto.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { crearEsqueleto, HUESOS, IDX, TONOS_PIEL } from './humano.js';

const PLANTILLAS = {};
let disponible = false;
export const hayModelosRealistas = () => disponible;

const DISENOS = { liso: 0, franjas: 1, franjasFinas: 2, banda: 3, aros: 4, diagonal: 5, mitades: 6, centro: 7 };
// Tono de piel aproximado de cada modelo original (para teñir hacia el tono del jugador)
const TONO_BASE = { a: new THREE.Color('#d9a77f'), b: new THREE.Color('#a96e46') };

// Hueso del modelo realista -> hueso de mi esqueleto de animación
const MAPA = {
  Bip01_Pelvis: 'hips', Bip01_Spine: 'hips', Bip01_Spine1: 'spine', Bip01_Spine2: 'chest', Bip01_Neck: 'neck', Bip01_Head: 'head',
  Bip01_L_Clavicle: 'chest', Bip01_R_Clavicle: 'chest',
  Bip01_L_UpperArm: 'lUpperArm', Bip01_L_Forearm: 'lForeArm', Bip01_L_Hand: 'lHand',
  Bip01_R_UpperArm: 'rUpperArm', Bip01_R_Forearm: 'rForeArm', Bip01_R_Hand: 'rHand',
  Bip01_L_Thigh: 'lThigh', Bip01_L_Calf: 'lShin', Bip01_L_Foot: 'lFoot',
  Bip01_R_Thigh: 'rThigh', Bip01_R_Calf: 'rShin', Bip01_R_Foot: 'rFoot',
};
// Para los brazos se corrige la pose de referencia (brazos en "A") hacia brazos abajo
const HIJO_DIRECCION = {
  Bip01_L_UpperArm: 'Bip01_L_Forearm', Bip01_L_Forearm: 'Bip01_L_Hand', Bip01_L_Hand: 'Bip01_L_Finger2',
  Bip01_R_UpperArm: 'Bip01_R_Forearm', Bip01_R_Forearm: 'Bip01_R_Hand', Bip01_R_Hand: 'Bip01_R_Finger2',
};

export async function cargarModelosRealistas(renderer, progreso = () => {}) {
  const base = `${import.meta.env.BASE_URL}modelos/`;
  const ktx2 = new KTX2Loader().setTranscoderPath(`${import.meta.env.BASE_URL}basis/`).detectSupport(renderer);
  const gltf = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).setKTX2Loader(ktx2);
  const lista = [
    ['a', 'jugador_a', ['cuerpo', 'cuerpo_normal', 'cabeza', 'cabeza_normal']],
    ['b', 'jugador_b', ['cuerpo', 'cuerpo_normal', 'cabeza', 'cabeza_normal', 'pelo']],
  ];
  const total = lista.reduce((a, l) => a + 1 + l[2].length, 0);
  let hechos = 0;
  const avanzar = () => progreso(++hechos / total);
  for (const [clave, archivo, texs] of lista) {
    const g = await gltf.loadAsync(`${base}${archivo}.glb`);
    avanzar();
    const texturas = {};
    for (const t of texs) {
      const tx = await ktx2.loadAsync(`${base}${archivo}_${t}.ktx2`);
      tx.colorSpace = t.includes('normal') ? THREE.NoColorSpace : THREE.SRGBColorSpace;
      // Las UV vienen con la convención de three.js (v hacia arriba): invertimos la textura
      tx.repeat.set(1, -1); tx.offset.set(0, 1);
      tx.anisotropy = 4;
      tx.needsUpdate = true;
      texturas[t] = tx;
      avanzar();
    }
    prepararPlantilla(g.scene);
    PLANTILLAS[clave] = { escena: g.scene, texturas };
  }
  ktx2.dispose();
  disponible = true;
}

// Calcula la posición y normal "en reposo" de cada vértice (en cm, Y arriba, mirando a +Z)
function prepararPlantilla(escena) {
  escena.updateMatrixWorld(true);
  escena.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    const g = o.geometry;
    const p = g.attributes.position, n = g.attributes.normal;
    const rest = new Float32Array(p.count * 3), restN = new Float32Array(p.count * 3);
    // Las posiciones vienen cuantizadas: la pose real se obtiene aplicando el esqueleto en reposo
    const v = new THREE.Vector3(), w = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i); o.applyBoneTransform(i, v); v.applyMatrix4(o.matrixWorld);
      w.fromBufferAttribute(p, i).addScaledVector(new THREE.Vector3().fromBufferAttribute(n, i), 0.002);
      o.applyBoneTransform(i, w); w.applyMatrix4(o.matrixWorld).sub(v).normalize();
      rest.set([v.x, v.y, v.z], i * 3); restN.set([w.x, w.y, w.z], i * 3);
    }
    g.setAttribute('aRest', new THREE.BufferAttribute(rest, 3));
    g.setAttribute('aRestN', new THREE.BufferAttribute(restN, 3));
  });
}

// ---------- Sombreador de la camiseta ----------
const GLSL_PATRON = /* glsl */`
  uniform vec3 uCamiseta; uniform vec3 uDetalle; uniform vec3 uDetalle2; uniform float uTieneD2;
  uniform vec3 uShort; uniform vec3 uMedias; uniform float uDiseno; uniform vec3 uTinte;
  uniform float uArquero; uniform vec3 uGuantes; uniform sampler2D uDecal;
  varying vec3 vRest; varying vec3 vRestN;
  vec3 patronCamiseta(vec3 p) {
    float m = 0.0, m2 = 0.0;
    float d = uDiseno;
    if (d < 0.5) { m = 0.0; }
    else if (d < 1.5) { m = step(0.5, fract(p.x / 17.0 + 0.25)); }
    else if (d < 2.5) { m = step(0.72, fract(p.x / 9.0 + 0.36)); }
    else if (d < 3.5) { m = step(117.0, p.y) * step(p.y, 130.0); m2 = step(115.0, p.y) * step(p.y, 117.0) + step(130.0, p.y) * step(p.y, 132.0); }
    else if (d < 4.5) { m = step(0.5, fract(p.y / 22.0)); }
    else if (d < 5.5) { float s = p.z >= 0.0 ? 1.0 : -1.0; m = step(abs(p.x + (p.y - 120.0) * 0.75 * s), 6.0); }
    else if (d < 6.5) { m = step(0.0, p.x); }
    else { m = step(abs(p.x), 4.0); m2 = step(4.0, abs(p.x)) * step(abs(p.x), 5.5); }
    vec3 c = mix(uCamiseta, uDetalle, m);
    return mix(c, uTieneD2 > 0.5 ? uDetalle2 : uDetalle, m2);
  }`;

function materialCuerpo(tex, u) {
  const m = new THREE.MeshStandardMaterial({ map: tex.cuerpo, normalMap: tex.cuerpo_normal, roughness: 0.72, metalness: 0 });
  m.normalScale.set(1, -1);
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aRest; attribute vec3 aRestN; varying vec3 vRest; varying vec3 vRestN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRest = aRest; vRestN = aRestN;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${GLSL_PATRON}`)
      .replace('#include <map_fragment>', /* glsl */`
        #include <map_fragment>
        float zona = floor(sampledDiffuseColor.a * 4.0 + 0.5);
        float sombra = clamp(sampledDiffuseColor.g / 0.637, 0.0, 1.7);
        vec3 col = sampledDiffuseColor.rgb;
        if (zona > 0.5) {
          vec3 k = zona < 1.5 ? uMedias : zona < 2.5 ? uShort : zona < 3.5 ? patronCamiseta(vRest) : uDetalle;
          col = k * sombra;
          if (zona > 2.5 && zona < 3.5 && abs(vRest.x) < 18.0) {
            // Nombre y número en la espalda; número chico en el pecho
            vec4 dc = vec4(0.0);
            if (vRestN.z < -0.25 && vRest.y > 106.0 && vRest.y < 149.0) dc = texture2D(uDecal, vec2((-vRest.x + 15.0) / 30.0, (vRest.y - 106.0) / 43.0));
            else if (vRestN.z > 0.25 && vRest.y > 118.0 && vRest.y < 130.0 && abs(vRest.x) < 6.0) dc = texture2D(uDecal, vec2((vRest.x + 6.0) / 12.0 * 0.7 + 0.15, (vRest.y - 118.0) / 12.0 * 0.78));
            col = mix(col, dc.rgb * sombra, dc.a);
          }
        } else {
          float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
          if (vRest.y > 13.0) col *= uTinte;
          if (uArquero > 0.5) {
            float ax = abs(vRest.x);
            if (ax > 50.0) col = uGuantes * clamp(l / 0.25, 0.4, 1.3);
            else if (ax > 21.0 && vRest.y > 95.0) col = uCamiseta * clamp(l / 0.3, 0.5, 1.2);
          }
        }
        diffuseColor = vec4(col, 1.0);`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = zona > 0.5 ? 0.8 : (vRest.y < 13.0 ? 0.35 : 0.55);');
  };
  m.customProgramCacheKey = () => 'cuerpo-realista';
  return m;
}

function materialCabeza(tex, u) {
  const m = new THREE.MeshStandardMaterial({ map: tex.cabeza, normalMap: tex.cabeza_normal, roughness: 0.55, metalness: 0 });
  m.normalScale.set(1, -1);
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTinte = u.uTinte;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uTinte;')
      .replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb *= uTinte;');
  };
  m.customProgramCacheKey = () => 'cabeza-realista';
  return m;
}

function colorLineal(hex) { return new THREE.Color(hex); }

function contraste(hex) {
  const c = new THREE.Color(hex);
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b > 0.35 ? '#111111' : '#ffffff';
}

function texturaDecal(kit, dorsal, nombre) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const ctx = c.getContext('2d');
  if (dorsal !== null && dorsal !== undefined) {
    const color = kit.numero || contraste(kit.camiseta);
    ctx.fillStyle = color;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '800 38px "Arial Narrow", "Segoe UI", Arial, sans-serif';
    ctx.fillText((nombre || '').toUpperCase(), 128, 24, 236);
    ctx.font = '900 150px "Arial Narrow", "Segoe UI", Arial, sans-serif';
    ctx.lineWidth = 6;
    ctx.strokeStyle = color === '#ffffff' ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.35)';
    ctx.strokeText(String(dorsal), 128, 150, 220);
    ctx.fillText(String(dorsal), 128, 150, 220);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// ---------- Crear un jugador realista ----------
export function crearModeloRealista(apariencia = {}) {
  const { altura = 1.8, contextura = 1, piel = 2 } = apariencia;
  const clave = piel >= 4 ? 'b' : 'a';
  const tpl = PLANTILLAS[clave];
  const raiz = SkeletonUtils.clone(tpl.escena);
  const grupo = new THREE.Group();
  grupo.add(raiz);
  const esc = (altura / 1.8) * 0.01;
  raiz.scale.set(esc * (0.93 + contextura * 0.07), esc, esc * (0.93 + contextura * 0.07));

  // Uniforms propios del jugador
  const tono = new THREE.Color(TONOS_PIEL[piel] || TONOS_PIEL[2]);
  const b = TONO_BASE[clave];
  const tinte = new THREE.Vector3(
    THREE.MathUtils.clamp(tono.r / b.r, 0.55, 1.35), THREE.MathUtils.clamp(tono.g / b.g, 0.55, 1.35), THREE.MathUtils.clamp(tono.b / b.b, 0.55, 1.35));
  const u = {
    uCamiseta: { value: new THREE.Color(1, 1, 1) }, uDetalle: { value: new THREE.Color(0, 0, 0) }, uDetalle2: { value: new THREE.Color(0, 0, 0) },
    uTieneD2: { value: 0 }, uShort: { value: new THREE.Color(0, 0, 0) }, uMedias: { value: new THREE.Color(1, 1, 1) },
    uDiseno: { value: 0 }, uTinte: { value: tinte }, uArquero: { value: 0 }, uGuantes: { value: new THREE.Color(1, 1, 1) },
    uDecal: { value: null },
  };
  const matCuerpo = materialCuerpo(tpl.texturas, u);
  const matCabeza = materialCabeza(tpl.texturas, u);
  const matPelo = tpl.texturas.pelo ? new THREE.MeshStandardMaterial({ map: tpl.texturas.pelo, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.8 }) : null;
  const mallas = [];
  raiz.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    const n = o.material?.name || '';
    o.material = /opacity/.test(n) ? matPelo : /head/.test(n) ? matCabeza : matCuerpo;
    o.castShadow = true;
    o.receiveShadow = true;
    o.frustumCulled = false;
    mallas.push(o);
  });

  // Huesos del modelo, en orden padre -> hijo
  raiz.updateMatrixWorld(true);
  const huesosT = [];
  raiz.traverse((o) => { if (o.isBone) huesosT.push(o); });
  const porNombre = Object.fromEntries(huesosT.map((h) => [h.name, h]));
  const invRaiz = new THREE.Matrix4().copy(raiz.matrixWorld).invert();
  const qRel = (o) => { const m = new THREE.Matrix4().multiplyMatrices(invRaiz, o.matrixWorld); const q = new THREE.Quaternion(); m.decompose(new THREE.Vector3(), q, new THREE.Vector3()); return q; };
  const pRel = (o) => new THREE.Vector3().setFromMatrixPosition(o.matrixWorld).applyMatrix4(invRaiz);
  const info = huesosT.map((h) => {
    const fuente = MAPA[h.name];
    let corr = new THREE.Quaternion();
    if (HIJO_DIRECCION[h.name] && porNombre[HIJO_DIRECCION[h.name]]) {
      const dir = pRel(porNombre[HIJO_DIRECCION[h.name]]).sub(pRel(h)).normalize();
      corr = new THREE.Quaternion().setFromUnitVectors(dir, new THREE.Vector3(0, -1, 0));
    }
    return {
      h, padre: h.parent?.isBone ? huesosT.indexOf(h.parent) : -1,
      fuente: fuente !== undefined ? IDX[fuente] : -1,
      bindLocal: h.quaternion.clone(), bind: qRel(h), corr, mundo: new THREE.Quaternion(),
      // rotación (relativa a la raíz) del padre no-hueso del primer hueso
      padreFijo: h.parent?.isBone ? null : qRel(h.parent || raiz),
    };
  });
  // El hueso superior (pelvis) se desplaza en el espacio de su padre para agacharse/saltar/caer
  const raizHueso = huesosT[0];
  const posBindRaiz = raizHueso.position.clone();
  const invPadreRaiz = info[0].padreFijo.clone().invert();
  const escPadre = new THREE.Vector3();
  raizHueso.parent.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), escPadre);
  const factorEsc = raiz.scale.y / escPadre.y; // pasa de cm de la raíz a unidades del padre
  const manoDerecha = porNombre.Bip01_R_Hand;

  const rig = crearEsqueleto();
  const W = HUESOS.map(() => new THREE.Quaternion());
  const PADRE_RIG = HUESOS.map((n) => rig[IDX[n]].parent?.isBone ? IDX[rig[IDX[n]].parent.name] : -1);
  const tq = new THREE.Quaternion(), tv = new THREE.Vector3();

  const modelo = {
    grupo, huesos: rig, realista: true, mallas,
    apariencia: { ...apariencia },
    get manoDerecha() { return manoDerecha; },
    // Traslada la pose del esqueleto de animación al esqueleto realista
    alAplicarPose() {
      for (let i = 0; i < rig.length; i++) {
        const p = PADRE_RIG[i];
        if (p < 0) W[i].copy(rig[i].quaternion); else W[i].multiplyQuaternions(W[p], rig[i].quaternion);
      }
      for (const it of info) {
        const pm = it.padre >= 0 ? info[it.padre].mundo : it.padreFijo;
        if (it.fuente >= 0) {
          it.mundo.multiplyQuaternions(W[it.fuente], it.corr).multiply(it.bind);
          it.h.quaternion.copy(tq.copy(pm).invert().multiply(it.mundo));
        } else {
          it.h.quaternion.copy(it.bindLocal);
          it.mundo.multiplyQuaternions(pm, it.bindLocal);
        }
      }
      // Desplazamiento de cadera (saltos, agacharse, caídas)
      const hp = rig[0].position;
      tv.set(hp.x, hp.y - 0.98, hp.z).multiplyScalar(100 * 0.913 * factorEsc).applyQuaternion(invPadreRaiz);
      raizHueso.position.copy(posBindRaiz).add(tv);
    },
    adjuntarAMano(obj) {
      obj.scale.multiplyScalar(1 / esc);
      manoDerecha.add(obj);
    },
    vestir(kit, esArquero = false, dorsal = null, nombre = '') {
      u.uCamiseta.value.copy(colorLineal(kit.camiseta));
      u.uDetalle.value.copy(colorLineal(kit.detalle || kit.camiseta));
      u.uDetalle2.value.copy(colorLineal(kit.detalle2 || kit.detalle || kit.camiseta));
      u.uTieneD2.value = kit.detalle2 ? 1 : 0;
      u.uShort.value.copy(colorLineal(kit.short));
      u.uMedias.value.copy(colorLineal(kit.medias));
      u.uDiseno.value = DISENOS[kit.diseno] ?? 0;
      u.uArquero.value = esArquero ? 1 : 0;
      u.uGuantes.value.copy(colorLineal(kit.guantes || '#eeeeee'));
      u.uDecal.value?.dispose();
      u.uDecal.value = texturaDecal(kit, dorsal, nombre);
    },
    destruir() {
      u.uDecal.value?.dispose();
      matCuerpo.dispose(); matCabeza.dispose(); matPelo?.dispose();
    },
  };
  return modelo;
}
