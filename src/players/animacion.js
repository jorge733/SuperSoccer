// Animaciones procedurales con mezcla suave (blending):
// locomoción (quieto/trote/carrera/sprint, lateral y de espaldas) sincronizada con la distancia recorrida
// para que los pies no "patinen", más acciones (patear, cabecear, barrer, caer, celebrar, atajar...).
import * as THREE from 'three';
import { HUESOS, IDX } from './humano.js';
import DATOS_MOCAP from '../data/animaciones.json';

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

// ---------- Clips de captura de movimiento (horneados en src/data/animaciones.json) ----------
const CLIPS = {};
for (const [nombre, c] of Object.entries(DATOS_MOCAP.clips || {})) {
  CLIPS[nombre] = { ...c, q: Float32Array.from(c.q), p: Float32Array.from(c.p) };
}
export const hayMocap = (n) => !!CLIPS[n];

// Acciones que se reproducen con mocap (si el clip existe); el resto usa las claves procedurales.
const ACCION_CLIP = {
  patada: ['tiro', 'tiro2'], pase: ['pase'], celebrarSalto: ['celebrarSalto'], baile: ['baile'],
};

const NQ = NB * 4;
const TAMQ = NQ + 3;
const OFFQ = NQ;
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler();
const ESPEJO_IDX = HUESOS.map((n) => {
  const m = n[0] === 'l' && IDX['r' + n.slice(1)] !== undefined ? 'r' + n.slice(1) : n[0] === 'r' && IDX['l' + n.slice(1)] !== undefined ? 'l' + n.slice(1) : n;
  return IDX[m];
});

// Muestrea un clip en el tiempo t (segundos) y escribe cuaterniones locales + desplazamiento de cadera.
function muestrearClip(c, t, out, espejo = false) {
  const per = c.dur;
  let u;
  if (c.bucle) { u = ((t % per) + per) % per / per; } else u = Math.min(1, Math.max(0, t / per));
  const f = u * (c.n - 1);
  const i0 = Math.floor(f), i1 = Math.min(c.n - 1, i0 + 1), k = f - i0;
  for (let b = 0; b < NB; b++) {
    const src = espejo ? ESPEJO_IDX[b] : b;
    THREE.Quaternion.slerpFlat(out, b * 4, c.q, (i0 * NB + src) * 4, c.q, (i1 * NB + src) * 4, k);
    if (espejo) { out[b * 4 + 1] = -out[b * 4 + 1]; out[b * 4 + 2] = -out[b * 4 + 2]; }
  }
  for (let e = 0; e < 3; e++) out[OFFQ + e] = c.p[i0 * 3 + e] + (c.p[i1 * 3 + e] - c.p[i0 * 3 + e]) * k;
  if (espejo) out[OFFQ] = -out[OFFQ];
}

// Convierte una pose de ángulos (formato procedural) a cuaterniones
function eulerAQuat(pe, out) {
  for (let b = 0; b < NB; b++) {
    _e.set(pe[b * 3], pe[b * 3 + 1], pe[b * 3 + 2]);
    _q1.setFromEuler(_e);
    out[b * 4] = _q1.x; out[b * 4 + 1] = _q1.y; out[b * 4 + 2] = _q1.z; out[b * 4 + 3] = _q1.w;
  }
  out[OFFQ] = pe[OFF]; out[OFFQ + 1] = pe[OFF + 1]; out[OFFQ + 2] = pe[OFF + 2];
}

// Mezcla esférica por hueso: destino = slerp(destino, origen, peso)
function mezclarQ(dest, orig, peso, mascara, conCadera = true) {
  if (peso <= 0) return;
  for (let b = 0; b < NB; b++) {
    if (mascara === 'superior' && !ES_SUPERIOR.has(HUESOS[b])) continue;
    THREE.Quaternion.slerpFlat(dest, b * 4, dest, b * 4, orig, b * 4, Math.min(1, peso));
  }
  if (conCadera && mascara !== 'superior') for (let e = 0; e < 3; e++) dest[OFFQ + e] += (orig[OFFQ + e] - dest[OFFQ + e]) * peso;
}

// Suma ponderada de poses (para mezclar ciclos de locomoción), con alineación de signo
function acumular(dest, orig, peso, primero) {
  for (let b = 0; b < NB; b++) {
    const o = b * 4;
    let s = peso;
    if (!primero && dest[o] * orig[o] + dest[o + 1] * orig[o + 1] + dest[o + 2] * orig[o + 2] + dest[o + 3] * orig[o + 3] < 0) s = -peso;
    for (let e = 0; e < 4; e++) dest[o + e] = (primero ? 0 : dest[o + e]) + orig[o + e] * s;
  }
  for (let e = 0; e < 3; e++) dest[OFFQ + e] = (primero ? 0 : dest[OFFQ + e]) + orig[OFFQ + e] * peso;
}

function normalizar(p) {
  for (let b = 0; b < NB; b++) {
    const o = b * 4;
    const l = Math.hypot(p[o], p[o + 1], p[o + 2], p[o + 3]) || 1;
    p[o] /= l; p[o + 1] /= l; p[o + 2] /= l; p[o + 3] /= l;
  }
}

// Rotación extra (en grados de Euler) aplicada sobre un hueso: q = q * delta
function sumarEuler(p, hueso, x, y, z) {
  const o = IDX[hueso] * 4;
  _q1.fromArray(p, o);
  _q2.setFromEuler(_e.set(x, y, z));
  _q1.multiply(_q2).toArray(p, o);
}

export class Animador {
  constructor(modelo) {
    this.modelo = modelo;
    this.fase = Math.random();
    this.tiempo = Math.random() * 10;
    this.locoE = nuevaPose();       // locomoción procedural (ángulos) para movimientos laterales/de espaldas
    this.tmpE = nuevaPose();
    this.loco = new Float32Array(TAMQ);
    this.final = new Float32Array(TAMQ);
    this.tmp = new Float32Array(TAMQ);
    this.tmp2 = new Float32Array(TAMQ);
    this.accion = null;
    this.saliente = null;
    this.intensidad = 0;
    this.lateral = 0;
    this.adelante = 1;
    this.guardia = 0;
    this.proteger = 0;
    this.velSuave = 0;
    this.mocap = !!CLIPS.trotar;
  }

  get ocupado() { return !!this.accion && !this.accion.def.bucle && this.accion.t < this.accion.def.dur * 0.85; }
  get nombreAccion() { return this.accion?.nombre || null; }

  definicion(nombre, espejo) {
    const clips = ACCION_CLIP[nombre]?.filter((c) => CLIPS[c]);
    if (clips && clips.length) {
      const c = CLIPS[clips[Math.floor(Math.random() * clips.length)]];
      return { clip: c, dur: c.dur, contacto: c.contacto ?? 0.2, bucle: c.bucle, mascara: 'todo', espejo };
    }
    const def = espejo ? accionReflejada(nombre) : ACCIONES[nombre];
    return def || null;
  }

  // Momento (en segundos reales) en que el pie toca el balón en la acción actual
  contactoActual() {
    const a = this.accion;
    return a && a.def.contacto !== undefined ? a.def.contacto / a.velocidad : null;
  }

  reproducir(nombre, { espejo = false, velocidad = 1, escala = 1 } = {}) {
    const def = this.definicion(nombre, espejo);
    if (!def) return;
    if (this.accion) this.saliente = { ...this.accion, pesoSalida: this.accion.peso };
    this.accion = { def, t: 0, peso: 0, velocidad, nombre, escala, espejo };
  }

  detener() {
    if (this.accion) { this.saliente = { ...this.accion, pesoSalida: this.accion.peso }; this.accion = null; }
  }

  actualizar(dt, { vx = 0, vz = 0, guardia = 0, proteger = 0 } = {}) {
    this.tiempo += dt;
    const vel = Math.hypot(vx, vz);
    this.velSuave += (vel - this.velSuave) * Math.min(1, dt * 8);
    const v = this.velSuave;
    const s = Math.min(1, v / 8.5);
    this.intensidad = s;
    if (vel > 0.2) {
      this.adelante += (vz / vel - this.adelante) * Math.min(1, dt * 6);
      this.lateral += (vx / vel - this.lateral) * Math.min(1, dt * 6);
    }
    this.guardia += (guardia - this.guardia) * Math.min(1, dt * 5);
    this.proteger += (proteger - this.proteger) * Math.min(1, dt * 6);
    this.locomocion(this.loco, v, s, dt);

    const f = this.final;
    f.set(this.loco);
    if (this.saliente) {
      this.saliente.pesoSalida -= dt * 6;
      if (this.saliente.pesoSalida <= 0) this.saliente = null;
      else {
        this.saliente.t += dt * this.saliente.velocidad;
        this.muestrear(this.saliente, this.tmp);
        mezclarQ(f, this.tmp, this.saliente.pesoSalida, this.saliente.def.mascara);
      }
    }
    if (this.accion) {
      const a = this.accion;
      a.t += dt * a.velocidad;
      const d = a.def;
      if (!d.bucle && a.t >= d.dur) { this.accion = null; }
      else {
        const entrada = Math.min(1, a.t / (d.clip ? 0.12 : 0.08));
        const salida = d.bucle ? 1 : Math.min(1, (d.dur - a.t) / (d.clip ? 0.2 : 0.12));
        a.peso = Math.min(entrada, salida);
        this.muestrear(a, this.tmp);
        mezclarQ(f, this.tmp, a.peso, d.mascara);
      }
    }
    this.aplicar(f);
  }

  // Locomoción: mezcla de ciclos de captura (reposo, caminar, trotar, sprint) sincronizados por fase
  locomocion(p, v, s, dt) {
    if (!this.mocap) {
      this.fase = (this.fase + (v * dt) / (1.25 + 0.42 * v)) % 1;
      locomocionProcedural.call(this, this.locoE, v, s);
      eulerAQuat(this.locoE, p);
      return;
    }
    const w = { reposo: 0, caminar: 0, trotar: 0, correr: 0 };
    const tramo = (x, a, b) => Math.min(1, Math.max(0, (x - a) / (b - a)));
    if (v < 0.25) w.reposo = 1;
    else if (v < 1.8) { const k = tramo(v, 0.25, 1.8); w.reposo = 1 - k; w.caminar = k; }
    else if (v < 4.2) { const k = tramo(v, 1.8, 4.2); w.caminar = 1 - k; w.trotar = k; }
    else { const k = tramo(v, 4.2, 7.0); w.trotar = 1 - k; w.correr = k; }
    // Fase común: avanza según la distancia recorrida y la zancada de los ciclos activos
    let L = 0, wm = 0;
    for (const n of ['caminar', 'trotar', 'correr']) { L += w[n] * CLIPS[n].zancada; wm += w[n]; }
    if (wm > 0.01) this.fase = (this.fase + (v * dt) / (L / wm)) % 1;
    let primero = true;
    for (const n of ['reposo', 'caminar', 'trotar', 'correr']) {
      if (w[n] < 0.001) continue;
      const c = CLIPS[n];
      const t = n === 'reposo' ? this.tiempo : ((this.fase + c.fase0) % 1) * c.dur;
      muestrearClip(c, t, this.tmp2);
      acumular(p, this.tmp2, w[n], primero);
      primero = false;
    }
    normalizar(p);
    // Movimiento lateral o de espaldas: se mezcla con la locomoción procedural (que sabe hacerlo)
    const atras = Math.max(0, -this.adelante) + Math.abs(this.lateral) * 0.8;
    const wp = v > 0.3 ? Math.min(1, atras * 1.2) : 0;
    if (wp > 0.02) {
      locomocionProcedural.call(this, this.locoE, v, s);
      eulerAQuat(this.locoE, this.tmp2);
      mezclarQ(p, this.tmp2, wp, 'todo');
    }
    // Capas aditivas: guardia (arquero/defensa) y proteger el balón
    const g = this.guardia;
    if (g > 0.01) {
      const k = g * (1 - s * 0.6);
      sumarEuler(p, 'lThigh', -0.38 * k, 0, 0.12 * k); sumarEuler(p, 'rThigh', -0.38 * k, 0, -0.12 * k);
      sumarEuler(p, 'lShin', 0.75 * k, 0, 0); sumarEuler(p, 'rShin', 0.75 * k, 0, 0);
      sumarEuler(p, 'lFoot', -0.35 * k, 0, 0); sumarEuler(p, 'rFoot', -0.35 * k, 0, 0);
      sumarEuler(p, 'spine', 0.28 * k, 0, 0);
      sumarEuler(p, 'lUpperArm', -0.4 * k, 0, 0.35 * k); sumarEuler(p, 'rUpperArm', -0.4 * k, 0, -0.35 * k);
      sumarEuler(p, 'lForeArm', -0.6 * k, 0, 0); sumarEuler(p, 'rForeArm', -0.6 * k, 0, 0);
      p[OFFQ + 1] -= 0.12 * k;
    }
    const pr = this.proteger;
    if (pr > 0.01) {
      sumarEuler(p, 'lUpperArm', 0.25 * pr, 0, 0.55 * pr); sumarEuler(p, 'rUpperArm', 0.25 * pr, 0, -0.55 * pr);
      sumarEuler(p, 'spine', 0.15 * pr, 0, 0);
      p[OFFQ + 1] -= 0.05 * pr;
    }
  }

  muestrear(a, salida) {
    const d = a.def;
    const esc = a.escala ?? 1;
    if (d.clip) {
      muestrearClip(d.clip, a.t, salida, !!d.espejo);
      if (esc < 1) {
        for (let b = 0; b < NB; b++) THREE.Quaternion.slerpFlat(salida, b * 4, this.loco, b * 4, salida, b * 4, esc);
        for (let e = 0; e < 3; e++) salida[OFFQ + e] = this.loco[OFFQ + e] + (salida[OFFQ + e] - this.loco[OFFQ + e]) * esc;
      }
      return;
    }
    // Acción por claves (ángulos): los huesos no indicados toman la locomoción
    let t = a.t;
    if (d.bucle) t %= d.dur;
    const cl = d.claves;
    let i = 0;
    while (i < cl.length - 2 && cl[i + 1].t < t) i++;
    const k0 = cl[i], k1 = cl[i + 1] || cl[i];
    const u = k1.t > k0.t ? suaveT(Math.min(1, Math.max(0, (t - k0.t) / (k1.t - k0.t)))) : 0;
    salida.set(this.loco);
    const huesos = new Set([...Object.keys(k0.h), ...Object.keys(k1.h)]);
    // Ángulos base de la locomoción para los huesos que solo aparecen en una de las dos claves
    for (const n of huesos) {
      const b = IDX[n];
      _q2.fromArray(this.loco, b * 4);
      const v0 = k0.h[n], v1 = k1.h[n];
      const qa = v0 ? new THREE.Quaternion().setFromEuler(_e.set(v0[0], v0[1], v0[2])) : _q2.clone();
      const qb = v1 ? new THREE.Quaternion().setFromEuler(_e.set(v1[0], v1[1], v1[2])) : _q2.clone();
      qa.slerp(qb, u);
      if (esc < 1) qa.copy(_q2.clone().slerp(qa, esc));
      qa.toArray(salida, b * 4);
    }
    const o0 = k0.o || [0, 0, 0], o1 = k1.o || [0, 0, 0];
    for (let e = 0; e < 3; e++) {
      const extra = o0[e] + (o1[e] - o0[e]) * u;
      salida[OFFQ + e] = (e === 1 ? this.loco[OFFQ + 1] * 0.3 : this.loco[OFFQ + e]) + extra * esc;
    }
  }

  aplicar(p) {
    const hs = this.modelo.huesos;
    for (let b = 0; b < NB; b++) hs[b].quaternion.set(p[b * 4], p[b * 4 + 1], p[b * 4 + 2], p[b * 4 + 3]);
    hs[0].position.set(p[OFFQ], 0.98 + p[OFFQ + 1], p[OFFQ + 2]);
    this.modelo.alAplicarPose?.();
  }
}

// Locomoción procedural (ángulos): se usa para correr de lado o de espaldas y como respaldo.
function locomocionProcedural(p, v, s) {

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

}

export { ACCIONES };
