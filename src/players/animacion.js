// Animaciones procedurales con mezcla suave (blending):
// locomoción (quieto/trote/carrera/sprint, lateral y de espaldas) sincronizada con la distancia recorrida
// para que los pies no "patinen", más acciones (patear, cabecear, barrer, caer, celebrar, atajar...).
import { HUESOS, IDX } from './humano.js';

const NB = HUESOS.length;
const TAM = NB * 3 + 3; // rotaciones (x,y,z) por hueso + desplazamiento de cadera
const OFF = NB * 3;
const TAU = Math.PI * 2;

const suaveT = (t) => t * t * (3 - 2 * t);

function nuevaPose() { return new Float32Array(TAM); }

function fijar(p, hueso, x = 0, y = 0, z = 0) {
  const i = IDX[hueso] * 3;
  p[i] = x; p[i + 1] = y; p[i + 2] = z;
}

// Cada clave: { t, h: { hueso: [x,y,z] }, o: [x,y,z] }. Los huesos no indicados toman la locomoción.
const ACCIONES = {
  patada: {
    dur: 0.62, contacto: 0.2, mascara: 'todo',
    claves: [
      { t: 0, h: {} },
      { t: 0.13, h: { rThigh: [0.6, 0, 0], rShin: [1.35, 0, 0], rFoot: [0.3, 0, 0], lThigh: [-0.2, 0, 0], lShin: [0.35, 0, 0], spine: [0.12, 0.2, 0], chest: [0, 0.1, 0], lUpperArm: [-0.4, 0, 0.7], rUpperArm: [0.4, 0, -0.4], lForeArm: [-0.4, 0, 0], rForeArm: [-0.3, 0, 0] }, o: [0, -0.06, 0] },
      { t: 0.2, h: { rThigh: [-0.85, 0, 0], rShin: [0.35, 0, 0], rFoot: [0.35, 0, 0], lThigh: [-0.15, 0, 0], lShin: [0.3, 0, 0], spine: [0.2, -0.05, 0], chest: [0, -0.1, 0], lUpperArm: [-0.2, 0, 0.9], rUpperArm: [0.3, 0, -0.5] }, o: [0, -0.05, 0.05] },
      { t: 0.36, h: { rThigh: [-1.45, 0, 0.05], rShin: [0.15, 0, 0], rFoot: [0.1, 0, 0], lThigh: [0.05, 0, 0], lShin: [0.15, 0, 0], spine: [-0.05, -0.25, 0], lUpperArm: [-0.4, 0, 0.7], rUpperArm: [0.5, 0, -0.5] }, o: [0, 0.02, 0.12] },
      { t: 0.62, h: {} },
    ],
  },
  pase: {
    dur: 0.42, contacto: 0.14, mascara: 'todo',
    claves: [
      { t: 0, h: {} },
      { t: 0.09, h: { rThigh: [0.35, 0.25, 0], rShin: [0.8, 0, 0], rFoot: [0, -0.4, 0], lShin: [0.3, 0, 0], spine: [0.1, 0.1, 0], lUpperArm: [-0.2, 0, 0.4] }, o: [0, -0.05, 0] },
      { t: 0.15, h: { rThigh: [-0.6, 0.35, 0], rShin: [0.25, 0, 0], rFoot: [0, -0.5, 0], lShin: [0.3, 0, 0], spine: [0.1, -0.1, 0], lUpperArm: [-0.2, 0, 0.5] }, o: [0, -0.04, 0.03] },
      { t: 0.27, h: { rThigh: [-0.8, 0.3, 0], rShin: [0.2, 0, 0], spine: [0.05, -0.12, 0] }, o: [0, 0, 0.05] },
      { t: 0.42, h: {} },
    ],
  },
  cabezazo: {
    dur: 0.8, contacto: 0.36, mascara: 'todo',
    claves: [
      { t: 0, h: {} },
      { t: 0.14, h: { lThigh: [-0.5, 0, 0], rThigh: [-0.5, 0, 0], lShin: [1.0, 0, 0], rShin: [1.0, 0, 0], spine: [0.3, 0, 0], lUpperArm: [0.5, 0, 0.2], rUpperArm: [0.5, 0, -0.2] }, o: [0, -0.22, 0] },
      { t: 0.3, h: { lThigh: [-0.2, 0, 0], rThigh: [0.1, 0, 0], lShin: [0.6, 0, 0], rShin: [0.9, 0, 0], spine: [-0.3, 0, 0], neck: [-0.25, 0, 0], lUpperArm: [-1.4, 0, 0.5], rUpperArm: [-1.4, 0, -0.5], lForeArm: [-0.8, 0, 0], rForeArm: [-0.8, 0, 0] }, o: [0, 0.42, 0] },
      { t: 0.4, h: { lThigh: [-0.3, 0, 0], rThigh: [0.2, 0, 0], lShin: [0.5, 0, 0], rShin: [0.8, 0, 0], spine: [0.45, 0, 0], neck: [0.35, 0, 0], lUpperArm: [-0.6, 0, 0.6], rUpperArm: [-0.6, 0, -0.6] }, o: [0, 0.4, 0.05] },
      { t: 0.62, h: { lThigh: [-0.4, 0, 0], rThigh: [-0.4, 0, 0], lShin: [0.8, 0, 0], rShin: [0.8, 0, 0], spine: [0.25, 0, 0] }, o: [0, -0.15, 0] },
      { t: 0.8, h: {} },
    ],
  },
  barrida: {
    dur: 1.35, contacto: 0.25, mascara: 'todo',
    claves: [
      { t: 0, h: {} },
      { t: 0.18, h: { hips: [-1.0, 0, 0.15], lThigh: [-0.45, 0, 0], lShin: [0.05, 0, 0], lFoot: [0.4, 0, 0], rThigh: [0.55, 0, 0], rShin: [1.8, 0, 0], spine: [0.35, 0, 0], neck: [0.4, 0, 0], lUpperArm: [0.3, 0, 0.9], rUpperArm: [0.6, 0, -0.6], rForeArm: [-0.6, 0, 0] }, o: [0, -0.66, 0] },
      { t: 0.75, h: { hips: [-1.05, 0, 0.15], lThigh: [-0.4, 0, 0], lShin: [0.05, 0, 0], rThigh: [0.55, 0, 0], rShin: [1.8, 0, 0], spine: [0.4, 0, 0], neck: [0.45, 0, 0], lUpperArm: [0.4, 0, 0.9], rUpperArm: [0.7, 0, -0.5], rForeArm: [-0.6, 0, 0] }, o: [0, -0.68, 0] },
      { t: 1.05, h: { hips: [-0.2, 0, 0], lThigh: [-1.0, 0, 0], lShin: [1.4, 0, 0], rThigh: [-0.3, 0, 0], rShin: [1.9, 0, 0], spine: [0.6, 0, 0], lUpperArm: [0.3, 0, 0.3], rUpperArm: [0.3, 0, -0.3] }, o: [0, -0.45, 0] },
      { t: 1.35, h: {} },
    ],
  },
  caida: {
    dur: 2.6, mascara: 'todo',
    claves: [
      { t: 0, h: {} },
      { t: 0.25, h: { hips: [0.55, 0, 0.1], spine: [0.2, 0, 0], lUpperArm: [-1.2, 0, 0.4], rUpperArm: [-1.2, 0, -0.4], lThigh: [0.3, 0, 0], rThigh: [-0.2, 0, 0], lShin: [0.6, 0, 0] }, o: [0, -0.25, 0.25] },
      { t: 0.55, h: { hips: [1.45, 0, 0.05], spine: [0.05, 0, 0], neck: [-0.5, 0, 0], head: [-0.2, 0.4, 0], lUpperArm: [-2.6, 0, 0.5], rUpperArm: [-1.8, 0, -0.6], lForeArm: [-0.6, 0, 0], rForeArm: [-0.9, 0, 0], lThigh: [0.1, 0, 0.05], rThigh: [0.05, 0, -0.05], lShin: [0.3, 0, 0], rShin: [0.5, 0, 0] }, o: [0, -0.83, 0.65] },
      { t: 1.6, h: { hips: [1.45, 0, 0.05], spine: [0.05, 0, 0], neck: [-0.5, 0, 0], head: [-0.2, 0.4, 0], lUpperArm: [-2.6, 0, 0.5], rUpperArm: [-1.8, 0, -0.6], lForeArm: [-0.6, 0, 0], rForeArm: [-0.9, 0, 0], lShin: [0.4, 0, 0], rShin: [0.6, 0, 0] }, o: [0, -0.83, 0.65] },
      { t: 2.05, h: { hips: [0.9, 0, 0], spine: [0.2, 0, 0], lThigh: [-1.6, 0, 0], lShin: [2.0, 0, 0], rThigh: [-0.6, 0, 0], rShin: [1.6, 0, 0], lUpperArm: [-0.8, 0, 0.3], rUpperArm: [-0.8, 0, -0.3] }, o: [0, -0.55, 0.3] },
      { t: 2.6, h: {} },
    ],
  },
  estirada: { // hacia la izquierda del arquero (+X); se refleja para la derecha
    dur: 1.7, contacto: 0.32, mascara: 'todo',
    claves: [
      { t: 0, h: {} },
      { t: 0.12, h: { lThigh: [-0.6, 0, 0.1], rThigh: [-0.5, 0, -0.1], lShin: [1.1, 0, 0], rShin: [1.1, 0, 0], spine: [0.25, 0, 0], lUpperArm: [-0.6, 0, 0.5], rUpperArm: [-0.6, 0, -0.5] }, o: [0, -0.25, 0] },
      { t: 0.32, h: { hips: [0, 0, -1.2], spine: [0, 0, -0.15], lUpperArm: [-0.2, 0, 2.9], rUpperArm: [-0.2, 0, 2.2], lForeArm: [-0.1, 0, 0], rForeArm: [-0.2, 0, 0], lThigh: [-0.2, 0, 0.3], rThigh: [0.1, 0, 0.1], lShin: [0.3, 0, 0], rShin: [0.6, 0, 0] }, o: [0, 0.1, 0] },
      { t: 0.62, h: { hips: [0, 0, -1.45], spine: [0, 0, -0.1], lUpperArm: [-0.4, 0, 2.6], rUpperArm: [-0.6, 0, 2.0], lForeArm: [-0.4, 0, 0], rForeArm: [-0.4, 0, 0], lThigh: [-0.3, 0, 0.2], rThigh: [-0.1, 0, 0], lShin: [0.5, 0, 0], rShin: [0.8, 0, 0] }, o: [0, -0.78, 0] },
      { t: 1.2, h: { hips: [0, 0, -1.45], lUpperArm: [-1.2, 0, 1.0], rUpperArm: [-1.2, 0, 0.6], lForeArm: [-1.0, 0, 0], rForeArm: [-1.0, 0, 0], lThigh: [-0.6, 0, 0.1], rThigh: [-0.4, 0, 0], lShin: [1.0, 0, 0], rShin: [1.2, 0, 0] }, o: [0, -0.8, 0] },
      { t: 1.7, h: {} },
    ],
  },
  atajar: {
    dur: 0.7, contacto: 0.2, mascara: 'todo',
    claves: [
      { t: 0, h: {} },
      { t: 0.2, h: { spine: [0.35, 0, 0], lUpperArm: [-1.3, 0, 0.15], rUpperArm: [-1.3, 0, -0.15], lForeArm: [-0.7, 0, 0], rForeArm: [-0.7, 0, 0], lThigh: [-0.5, 0, 0], rThigh: [-0.5, 0, 0], lShin: [0.9, 0, 0], rShin: [0.9, 0, 0] }, o: [0, -0.22, 0] },
      { t: 0.5, h: { spine: [0.15, 0, 0], lUpperArm: [-0.9, 0, -0.2], rUpperArm: [-0.9, 0, 0.2], lForeArm: [-1.6, 0, 0], rForeArm: [-1.6, 0, 0] }, o: [0, -0.05, 0] },
      { t: 0.7, h: {} },
    ],
  },
  atajarAlto: {
    dur: 0.8, contacto: 0.3, mascara: 'todo',
    claves: [
      { t: 0, h: {} },
      { t: 0.12, h: { lThigh: [-0.5, 0, 0], rThigh: [-0.5, 0, 0], lShin: [1.0, 0, 0], rShin: [1.0, 0, 0] }, o: [0, -0.2, 0] },
      { t: 0.3, h: { lUpperArm: [-2.9, 0, 0.15], rUpperArm: [-2.9, 0, -0.15], lForeArm: [-0.2, 0, 0], rForeArm: [-0.2, 0, 0], rThigh: [-0.6, 0, 0], rShin: [1.2, 0, 0], spine: [-0.1, 0, 0] }, o: [0, 0.35, 0] },
      { t: 0.55, h: { lUpperArm: [-1.0, 0, -0.2], rUpperArm: [-1.0, 0, 0.2], lForeArm: [-1.6, 0, 0], rForeArm: [-1.6, 0, 0] }, o: [0, 0, 0] },
      { t: 0.8, h: {} },
    ],
  },
  saqueBanda: {
    dur: 1.0, contacto: 0.55, mascara: 'superior',
    claves: [
      { t: 0, h: { lUpperArm: [-2.9, 0, 0.2], rUpperArm: [-2.9, 0, -0.2], lForeArm: [-1.5, 0, 0], rForeArm: [-1.5, 0, 0], spine: [-0.3, 0, 0] } },
      { t: 0.45, h: { lUpperArm: [-3.1, 0, 0.2], rUpperArm: [-3.1, 0, -0.2], lForeArm: [-1.9, 0, 0], rForeArm: [-1.9, 0, 0], spine: [-0.45, 0, 0] } },
      { t: 0.6, h: { lUpperArm: [-2.0, 0, 0.15], rUpperArm: [-2.0, 0, -0.15], lForeArm: [-0.2, 0, 0], rForeArm: [-0.2, 0, 0], spine: [0.3, 0, 0] } },
      { t: 1.0, h: {} },
    ],
  },
  sostenerBanda: { // bucle: balón sobre la cabeza
    dur: 1, bucle: true, mascara: 'superior',
    claves: [
      { t: 0, h: { lUpperArm: [-2.9, 0, 0.2], rUpperArm: [-2.9, 0, -0.2], lForeArm: [-1.5, 0, 0], rForeArm: [-1.5, 0, 0], spine: [-0.15, 0, 0] } },
      { t: 1, h: { lUpperArm: [-2.9, 0, 0.2], rUpperArm: [-2.9, 0, -0.2], lForeArm: [-1.5, 0, 0], rForeArm: [-1.5, 0, 0], spine: [-0.15, 0, 0] } },
    ],
  },
  sostenerBalon: { // arquero con el balón en las manos
    dur: 1, bucle: true, mascara: 'superior',
    claves: [
      { t: 0, h: { lUpperArm: [-1.0, 0, -0.25], rUpperArm: [-1.0, 0, 0.25], lForeArm: [-1.5, 0, 0], rForeArm: [-1.5, 0, 0] } },
      { t: 1, h: { lUpperArm: [-1.0, 0, -0.25], rUpperArm: [-1.0, 0, 0.25], lForeArm: [-1.5, 0, 0], rForeArm: [-1.5, 0, 0] } },
    ],
  },
  celebrarBrazos: {
    dur: 0.7, bucle: true, mascara: 'todo',
    claves: [
      { t: 0, h: { lUpperArm: [-2.8, 0, 0.35], rUpperArm: [-2.8, 0, -0.35], lForeArm: [-0.3, 0, 0], rForeArm: [-0.3, 0, 0], spine: [-0.15, 0, 0], neck: [-0.3, 0, 0], lShin: [0.4, 0, 0], rShin: [0.4, 0, 0], lThigh: [-0.2, 0, 0], rThigh: [-0.2, 0, 0] }, o: [0, -0.08, 0] },
      { t: 0.35, h: { lUpperArm: [-3.0, 0, 0.5], rUpperArm: [-3.0, 0, -0.5], lForeArm: [-0.1, 0, 0], rForeArm: [-0.1, 0, 0], spine: [-0.25, 0, 0], neck: [-0.4, 0, 0], lShin: [0.3, 0, 0], rShin: [0.5, 0, 0] }, o: [0, 0.3, 0] },
      { t: 0.7, h: { lUpperArm: [-2.8, 0, 0.35], rUpperArm: [-2.8, 0, -0.35], lForeArm: [-0.3, 0, 0], rForeArm: [-0.3, 0, 0], spine: [-0.15, 0, 0], neck: [-0.3, 0, 0], lShin: [0.4, 0, 0], rShin: [0.4, 0, 0], lThigh: [-0.2, 0, 0], rThigh: [-0.2, 0, 0] }, o: [0, -0.08, 0] },
    ],
  },
  celebrarAvion: {
    dur: 1.2, bucle: true, mascara: 'superior',
    claves: [
      { t: 0, h: { lUpperArm: [0, 0, 1.45], rUpperArm: [0, 0, -1.45], spine: [0.2, 0, 0.25], chest: [0, 0, 0.1] } },
      { t: 0.6, h: { lUpperArm: [0, 0, 1.45], rUpperArm: [0, 0, -1.45], spine: [0.2, 0, -0.25], chest: [0, 0, -0.1] } },
      { t: 1.2, h: { lUpperArm: [0, 0, 1.45], rUpperArm: [0, 0, -1.45], spine: [0.2, 0, 0.25], chest: [0, 0, 0.1] } },
    ],
  },
  celebrarRodillas: {
    dur: 1.0, bucle: true, mascara: 'todo',
    claves: [
      { t: 0, h: { lThigh: [0.1, 0, 0.1], rThigh: [0.1, 0, -0.1], lShin: [1.7, 0, 0], rShin: [1.7, 0, 0], lFoot: [0.6, 0, 0], rFoot: [0.6, 0, 0], spine: [-0.4, 0, 0], neck: [-0.4, 0, 0], lUpperArm: [-0.3, 0, 2.0], rUpperArm: [-0.3, 0, -2.0], lForeArm: [-0.6, 0, 0], rForeArm: [-0.6, 0, 0] }, o: [0, -0.46, -0.1] },
      { t: 0.5, h: { lThigh: [0.1, 0, 0.1], rThigh: [0.1, 0, -0.1], lShin: [1.7, 0, 0], rShin: [1.7, 0, 0], lFoot: [0.6, 0, 0], rFoot: [0.6, 0, 0], spine: [-0.5, 0, 0], neck: [-0.5, 0, 0], lUpperArm: [-0.5, 0, 2.3], rUpperArm: [-0.5, 0, -2.3], lForeArm: [-0.9, 0, 0], rForeArm: [-0.9, 0, 0] }, o: [0, -0.46, -0.1] },
      { t: 1.0, h: { lThigh: [0.1, 0, 0.1], rThigh: [0.1, 0, -0.1], lShin: [1.7, 0, 0], rShin: [1.7, 0, 0], lFoot: [0.6, 0, 0], rFoot: [0.6, 0, 0], spine: [-0.4, 0, 0], neck: [-0.4, 0, 0], lUpperArm: [-0.3, 0, 2.0], rUpperArm: [-0.3, 0, -2.0], lForeArm: [-0.6, 0, 0], rForeArm: [-0.6, 0, 0] }, o: [0, -0.46, -0.1] },
    ],
  },
  celebrarPuno: {
    dur: 0.5, bucle: true, mascara: 'superior',
    claves: [
      { t: 0, h: { rUpperArm: [-0.6, 0, -0.3], rForeArm: [-2.2, 0, 0], spine: [0.15, 0, 0], lUpperArm: [0.2, 0, 0.3] } },
      { t: 0.25, h: { rUpperArm: [-0.3, 0, -0.2], rForeArm: [-1.4, 0, 0], spine: [0.25, 0, 0], lUpperArm: [0.2, 0, 0.3] } },
      { t: 0.5, h: { rUpperArm: [-0.6, 0, -0.3], rForeArm: [-2.2, 0, 0], spine: [0.15, 0, 0], lUpperArm: [0.2, 0, 0.3] } },
    ],
  },
  lamento: { // manos a la cabeza
    dur: 2.0, bucle: true, mascara: 'superior',
    claves: [
      { t: 0, h: { lUpperArm: [-2.5, 0, 0.9], rUpperArm: [-2.5, 0, -0.9], lForeArm: [-1.9, 0, 0], rForeArm: [-1.9, 0, 0], neck: [0.3, 0, 0], spine: [0.1, 0, 0] } },
      { t: 1, h: { lUpperArm: [-2.6, 0, 0.9], rUpperArm: [-2.6, 0, -0.9], lForeArm: [-2.0, 0, 0], rForeArm: [-2.0, 0, 0], neck: [0.45, 0, 0], spine: [0.15, 0, 0] } },
      { t: 2, h: { lUpperArm: [-2.5, 0, 0.9], rUpperArm: [-2.5, 0, -0.9], lForeArm: [-1.9, 0, 0], rForeArm: [-1.9, 0, 0], neck: [0.3, 0, 0], spine: [0.1, 0, 0] } },
    ],
  },
  aplaudir: {
    dur: 0.4, bucle: true, mascara: 'superior',
    claves: [
      { t: 0, h: { lUpperArm: [-1.2, 0, -0.1], rUpperArm: [-1.2, 0, 0.1], lForeArm: [-0.6, -0.4, 0], rForeArm: [-0.6, 0.4, 0] } },
      { t: 0.2, h: { lUpperArm: [-1.2, 0, 0.3], rUpperArm: [-1.2, 0, -0.3], lForeArm: [-0.6, 0, 0], rForeArm: [-0.6, 0, 0] } },
      { t: 0.4, h: { lUpperArm: [-1.2, 0, -0.1], rUpperArm: [-1.2, 0, 0.1], lForeArm: [-0.6, -0.4, 0], rForeArm: [-0.6, 0.4, 0] } },
    ],
  },
  silbar: {
    dur: 0.9, mascara: 'superior',
    claves: [
      { t: 0, h: {} },
      { t: 0.2, h: { rUpperArm: [-1.0, 0, -0.3], rForeArm: [-2.2, 0.3, 0] } },
      { t: 0.7, h: { rUpperArm: [-1.0, 0, -0.3], rForeArm: [-2.2, 0.3, 0] } },
      { t: 0.9, h: {} },
    ],
  },
  tarjeta: {
    dur: 2.2, mascara: 'superior',
    claves: [
      { t: 0, h: {} },
      { t: 0.3, h: { rUpperArm: [-3.0, 0, -0.1], rForeArm: [-0.1, 0, 0] } },
      { t: 1.9, h: { rUpperArm: [-3.0, 0, -0.1], rForeArm: [-0.1, 0, 0] } },
      { t: 2.2, h: {} },
    ],
  },
};

const ES_SUPERIOR = new Set(['spine', 'chest', 'neck', 'head', 'lUpperArm', 'lForeArm', 'lHand', 'rUpperArm', 'rForeArm', 'rHand']);

// Refleja una pose (izquierda <-> derecha)
function reflejar(h) {
  const r = {};
  for (const [n, v] of Object.entries(h)) {
    const m = n.startsWith('l') && n !== 'lamento' ? 'r' + n.slice(1) : n.startsWith('r') ? 'l' + n.slice(1) : n;
    r[IDX[m] !== undefined ? m : n] = [v[0], -v[1], -v[2]];
  }
  return r;
}
const CACHE_REFLEJO = new Map();
function accionReflejada(nombre) {
  if (!CACHE_REFLEJO.has(nombre)) {
    const a = ACCIONES[nombre];
    CACHE_REFLEJO.set(nombre, { ...a, claves: a.claves.map((k) => ({ t: k.t, h: reflejar(k.h), o: k.o ? [-k.o[0], k.o[1], k.o[2]] : undefined })) });
  }
  return CACHE_REFLEJO.get(nombre);
}

export class Animador {
  constructor(modelo) {
    this.modelo = modelo;
    this.fase = Math.random();
    this.tiempo = Math.random() * 10;
    this.loco = nuevaPose();
    this.final = nuevaPose();
    this.tmp = nuevaPose();
    this.accion = null;      // { def, t, peso, velocidad, nombre }
    this.saliente = null;    // acción que se está desvaneciendo
    this.intensidad = 0;
    this.lateral = 0;
    this.adelante = 1;
    this.guardia = 0;
    this.proteger = 0;
    this.velSuave = 0;
  }

  get ocupado() { return !!this.accion && !this.accion.def.bucle && this.accion.t < this.accion.def.dur * 0.85; }
  get nombreAccion() { return this.accion?.nombre || null; }

  reproducir(nombre, { espejo = false, velocidad = 1, escala = 1 } = {}) {
    const def = espejo ? accionReflejada(nombre) : ACCIONES[nombre];
    if (!def) return;
    if (this.accion) this.saliente = { ...this.accion, pesoSalida: this.accion.peso };
    this.accion = { def, t: 0, peso: 0, velocidad, nombre, escala };
  }

  detener() {
    if (this.accion) { this.saliente = { ...this.accion, pesoSalida: this.accion.peso }; this.accion = null; }
  }

  // velLocal: velocidad en coordenadas del jugador (x lateral, z adelante) en m/s
  actualizar(dt, { vx = 0, vz = 0, guardia = 0, proteger = 0 } = {}) {
    this.tiempo += dt;
    const vel = Math.hypot(vx, vz);
    this.velSuave += (vel - this.velSuave) * Math.min(1, dt * 8);
    const v = this.velSuave;
    // Largo de ciclo (2 pasos) según la velocidad: sincroniza la pisada con lo recorrido.
    const ciclo = 1.25 + 0.42 * v;
    this.fase = (this.fase + (v * dt) / ciclo + (v < 0.3 ? dt * 0.0 : 0)) % 1;
    const s = Math.min(1, v / 8.5);
    this.intensidad = s;
    if (vel > 0.2) {
      this.adelante += (vz / vel - this.adelante) * Math.min(1, dt * 6);
      this.lateral += (vx / vel - this.lateral) * Math.min(1, dt * 6);
    }
    this.guardia += (guardia - this.guardia) * Math.min(1, dt * 5);
    this.proteger += (proteger - this.proteger) * Math.min(1, dt * 6);
    this.locomocion(this.loco, v, s);

    const f = this.final;
    f.set(this.loco);
    if (this.saliente) {
      this.saliente.pesoSalida -= dt * 6;
      if (this.saliente.pesoSalida <= 0) this.saliente = null;
      else {
        this.saliente.t += dt * this.saliente.velocidad;
        this.muestrear(this.saliente, this.tmp);
        this.mezclar(f, this.tmp, this.saliente.pesoSalida, this.saliente.def.mascara);
      }
    }
    if (this.accion) {
      const a = this.accion;
      a.t += dt * a.velocidad;
      const d = a.def;
      if (!d.bucle && a.t >= d.dur) { this.accion = null; }
      else {
        const entrada = Math.min(1, a.t / 0.08);
        const salida = d.bucle ? 1 : Math.min(1, (d.dur - a.t) / 0.12);
        a.peso = Math.min(entrada, salida);
        this.muestrear(a, this.tmp);
        this.mezclar(f, this.tmp, a.peso, d.mascara);
      }
    }
    this.aplicar(f);
  }

  locomocion(p, v, s) {
    p.fill(0);
    const ph = this.fase * TAU;
    const t = this.tiempo;
    const ad = this.adelante, la = this.lateral;
    const quieto = Math.max(0, 1 - v / 0.6);
    // Piernas
    const amp = 0.18 + 0.72 * s;
    const ampRod = 0.35 + 1.25 * s;
    for (const [lado, desf] of [['l', 0], ['r', Math.PI]]) {
      const a = ph + desf;
      const muslo = -Math.sin(a) * amp * (1 - quieto);
      const rodilla = (0.08 + ampRod * Math.pow(Math.max(0, Math.cos(a - 0.5)), 1.6)) * (1 - quieto);
      const latZ = Math.sin(a) * 0.25 * la * (1 - quieto) * (lado === 'l' ? 1 : -1) * 0.5;
      fijar(p, `${lado}Thigh`, muslo * ad - 0.02, 0, latZ);
      fijar(p, `${lado}Shin`, rodilla, 0, 0);
      fijar(p, `${lado}Foot`, -(muslo * ad) * 0.35 - rodilla * 0.25 + 0.05 * s, 0, 0);
      // Brazos opuestos a las piernas
      const brazo = Math.sin(a) * (0.12 + 0.75 * s) * (1 - quieto);
      const sx = lado === 'l' ? 1 : -1;
      fijar(p, `${lado}UpperArm`, brazo, 0, sx * (0.08 + 0.1 * s));
      fijar(p, `${lado}ForeArm`, -(0.2 + 1.1 * s) - Math.max(0, -brazo) * 0.3, 0, 0);
    }
    // Torso: inclinación hacia adelante según velocidad, giro de caderas
    fijar(p, 'spine', 0.04 + 0.2 * s * Math.max(0, ad), Math.sin(ph) * 0.12 * s, 0);
    fijar(p, 'chest', 0.02 + Math.sin(t * 2.1) * 0.012 * quieto, -Math.sin(ph) * 0.18 * s, 0);
    fijar(p, 'hips', 0, -Math.sin(ph) * 0.1 * s, 0);
    fijar(p, 'neck', -0.05 - 0.12 * s, 0, 0);
    fijar(p, 'head', 0.02, 0, 0);
    p[OFF + 1] = -0.015 - 0.035 * s + Math.abs(Math.cos(ph)) * 0.05 * s - 0.04 * s;
    // Respiración en reposo
    p[OFF + 1] += Math.sin(t * 2.1) * 0.004 * quieto;

    // Guardia de arquero / defensa (rodillas flectadas, brazos abiertos)
    const g = this.guardia;
    if (g > 0.01) {
      const k = g * (1 - s * 0.6);
      p[IDX.lThigh * 3] -= 0.38 * k; p[IDX.rThigh * 3] -= 0.38 * k;
      p[IDX.lShin * 3] += 0.75 * k; p[IDX.rShin * 3] += 0.75 * k;
      p[IDX.lFoot * 3] -= 0.35 * k; p[IDX.rFoot * 3] -= 0.35 * k;
      p[IDX.lThigh * 3 + 2] += 0.12 * k; p[IDX.rThigh * 3 + 2] -= 0.12 * k;
      p[IDX.spine * 3] += 0.28 * k;
      p[IDX.lUpperArm * 3] = p[IDX.lUpperArm * 3] * (1 - k) - 0.45 * k; p[IDX.lUpperArm * 3 + 2] += 0.35 * k;
      p[IDX.rUpperArm * 3] = p[IDX.rUpperArm * 3] * (1 - k) - 0.45 * k; p[IDX.rUpperArm * 3 + 2] -= 0.35 * k;
      p[IDX.lForeArm * 3] = -0.7 * k + p[IDX.lForeArm * 3] * (1 - k);
      p[IDX.rForeArm * 3] = -0.7 * k + p[IDX.rForeArm * 3] * (1 - k);
      p[OFF + 1] -= 0.12 * k;
    }
    const pr = this.proteger;
    if (pr > 0.01) {
      p[IDX.lUpperArm * 3 + 2] += 0.55 * pr; p[IDX.rUpperArm * 3 + 2] -= 0.55 * pr;
      p[IDX.lUpperArm * 3] += 0.25 * pr; p[IDX.rUpperArm * 3] += 0.25 * pr;
      p[IDX.spine * 3] += 0.15 * pr;
      p[OFF + 1] -= 0.05 * pr;
    }
  }

  muestrear(a, salida) {
    const d = a.def;
    let t = a.t;
    if (d.bucle) t = t % d.dur;
    const cl = d.claves;
    let i = 0;
    while (i < cl.length - 2 && cl[i + 1].t < t) i++;
    const k0 = cl[i], k1 = cl[i + 1] || cl[i];
    const u = k1.t > k0.t ? suaveT(Math.min(1, Math.max(0, (t - k0.t) / (k1.t - k0.t)))) : 0;
    salida.set(this.loco);
    // Mezcla entre claves; huesos ausentes en una clave usan la locomoción.
    const huesos = new Set([...Object.keys(k0.h), ...Object.keys(k1.h)]);
    const esc = a.escala ?? 1;
    for (const n of huesos) {
      const j = IDX[n] * 3;
      const v0 = k0.h[n], v1 = k1.h[n];
      for (let e = 0; e < 3; e++) {
        const base = this.loco[j + e];
        const a0 = v0 ? v0[e] * esc + base * (1 - esc) : base;
        const a1 = v1 ? v1[e] * esc + base * (1 - esc) : base;
        salida[j + e] = a0 + (a1 - a0) * u;
      }
    }
    const o0 = k0.o || [0, 0, 0], o1 = k1.o || [0, 0, 0];
    for (let e = 0; e < 3; e++) {
      const extra = o0[e] + (o1[e] - o0[e]) * u;
      salida[OFF + e] = (e === 1 ? this.loco[OFF + 1] * 0.3 : this.loco[OFF + e]) + extra * esc;
    }
  }

  mezclar(destino, origen, peso, mascara) {
    if (peso <= 0) return;
    for (let b = 0; b < NB; b++) {
      if (mascara === 'superior' && !ES_SUPERIOR.has(HUESOS[b])) continue;
      for (let e = 0; e < 3; e++) {
        const i = b * 3 + e;
        destino[i] += (origen[i] - destino[i]) * peso;
      }
    }
    if (mascara !== 'superior') for (let e = 0; e < 3; e++) destino[OFF + e] += (origen[OFF + e] - destino[OFF + e]) * peso;
  }

  aplicar(p) {
    const hs = this.modelo.huesos;
    for (let b = 0; b < NB; b++) hs[b].rotation.set(p[b * 3], p[b * 3 + 1], p[b * 3 + 2]);
    hs[0].position.set(p[OFF], 0.98 + p[OFF + 1], p[OFF + 2]);
  }
}

export { ACCIONES };
