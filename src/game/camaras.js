// Cámaras: transmisión de TV, cercana (detrás del jugador), aérea, órbita de menú y planos de cine.
import * as THREE from 'three';
import { clamp, suave, MITAD_L, MITAD_A } from '../world/medidas.js';

export const MODOS_CAMARA = ['tv', 'cercana', 'aerea'];
export const NOMBRE_CAMARA = { tv: 'Transmisión TV', cercana: 'Cercana', aerea: 'Aérea' };

export class Camaras {
  constructor() {
    this.cam = new THREE.PerspectiveCamera(32, window.innerWidth / window.innerHeight, 0.3, 900);
    this.cam.position.set(0, 20, -60);
    this.modo = 'tv';
    this.mira = new THREE.Vector3();
    this.posObj = new THREE.Vector3();
    this.miraObj = new THREE.Vector3();
    this.fovObj = 32;
    this.orbita = 0;
    this.offsetStick = new THREE.Vector2();
    this.temblor = 0;
    this.cine = null; // plano cinematográfico activo
  }

  ciclar() {
    const i = MODOS_CAMARA.indexOf(this.modo);
    this.modo = MODOS_CAMARA[(i + 1) % MODOS_CAMARA.length];
    return this.modo;
  }

  sacudir(v) { this.temblor = Math.max(this.temblor, v); }

  // info: { balon: Vector3, jugador: Jugador|null, dirAtaque: ±1, velBalon }
  actualizar(dt, info) {
    const b = info.balon;
    let rapidez = 4;
    if (this.cine) {
      this.actualizarCine(dt, info);
      return;
    }
    switch (this.modo) {
      case 'tv': {
        const x = clamp(b.x * 0.88, -MITAD_L + 8, MITAD_L - 8);
        const zLejos = clamp(b.z, -MITAD_A, MITAD_A);
        this.posObj.set(x + this.offsetStick.x * 6, 17 + this.offsetStick.y * 4, -54 + zLejos * 0.08);
        this.miraObj.set(clamp(b.x, -MITAD_L + 2, MITAD_L - 2), 0, zLejos * 0.6 + 1);
        this.fovObj = 31 + (zLejos + MITAD_A) * 0.07 + Math.abs(b.x) * 0.03;
        rapidez = 2.6;
        break;
      }
      case 'cercana': {
        const j = info.jugador;
        const p = j ? j.pos : b;
        const dir = info.dirAtaque || 1;
        const ang = this.offsetStick.x * 0.9;
        const dx = Math.cos(ang) * dir, dz = Math.sin(ang);
        this.posObj.set(p.x - dx * 11, 5.5 + this.offsetStick.y * 2, p.z - dz * 11 - 1);
        this.miraObj.set(p.x + dx * 7 + (b.x - p.x) * 0.3, 0.8, p.z + dz * 7 + (b.z - p.z) * 0.3);
        this.fovObj = 50;
        rapidez = 4;
        break;
      }
      case 'aerea': {
        this.posObj.set(b.x * 0.9, 52, b.z * 0.7 - 22);
        this.miraObj.set(b.x * 0.95, 0, b.z * 0.8);
        this.fovObj = 42;
        rapidez = 2.5;
        break;
      }
      case 'menu': {
        this.orbita += dt * 0.05;
        const r = 40;
        this.posObj.set(Math.sin(this.orbita) * r * 1.3, 13 + Math.sin(this.orbita * 0.7) * 4, Math.cos(this.orbita) * r * 0.8);
        this.miraObj.set(0, 2, 0);
        this.fovObj = 45;
        rapidez = 1.5;
        break;
      }
      case 'vitrina': { // selección de club: jugador modelando la camiseta
        const p = info.vitrina || new THREE.Vector3();
        this.posObj.set(p.x + 1.15, 1.25, p.z + 4.4);
        this.miraObj.set(p.x + 1.15, 1.0, p.z);
        this.fovObj = 34;
        rapidez = 3;
        break;
      }
      default: break;
    }
    // En los menús, al cambiar de vista la cámara salta directo (sin viaje largo)
    const salto = this.modo !== this._modoAnterior && (this.modo === 'vitrina' || this._modoAnterior === 'vitrina');
    this._modoAnterior = this.modo;
    if (info.instantaneo || salto) { this.cam.position.copy(this.posObj); this.mira.copy(this.miraObj); this.cam.fov = this.fovObj; }
    this.cam.position.x = suave(this.cam.position.x, this.posObj.x, rapidez, dt);
    this.cam.position.y = suave(this.cam.position.y, this.posObj.y, rapidez, dt);
    this.cam.position.z = suave(this.cam.position.z, this.posObj.z, rapidez, dt);
    this.mira.x = suave(this.mira.x, this.miraObj.x, rapidez * 1.3, dt);
    this.mira.y = suave(this.mira.y, this.miraObj.y, rapidez * 1.3, dt);
    this.mira.z = suave(this.mira.z, this.miraObj.z, rapidez * 1.3, dt);
    this.aplicar(dt);
  }

  aplicar(dt) {
    const c = this.cam;
    c.fov = suave(c.fov, this.fovObj, 3, dt);
    c.updateProjectionMatrix();
    if (this.temblor > 0.001) {
      this.temblor *= Math.exp(-dt * 5);
      c.position.x += (Math.random() - 0.5) * this.temblor;
      c.position.y += (Math.random() - 0.5) * this.temblor;
    }
    c.lookAt(this.mira);
  }

  // ---------- Planos cinematográficos (repeticiones, entrada de equipos, celebraciones) ----------
  iniciarCine(tipo, datos = {}) { this.cine = { tipo, t: 0, ...datos }; }
  terminarCine() { this.cine = null; }

  actualizarCine(dt, info) {
    const c = this.cine;
    c.t += dt;
    const b = info.balon;
    const lado = c.lado || 1;
    let pos = this.posObj, mira = this.miraObj, rapidez = 6;
    switch (c.tipo) {
      case 'detrasArco': // detrás de la red, mirando hacia la cancha
        pos.set(lado * (MITAD_L + 6), 1.8, b.z * 0.3);
        mira.copy(b);
        this.fovObj = 38;
        break;
      case 'bajoLateral': // a ras de cancha siguiendo el balón
        pos.set(b.x - lado * 6, 0.9, b.z - 9);
        mira.set(b.x, 0.6 + b.y * 0.6, b.z);
        this.fovObj = 40;
        rapidez = 4;
        break;
      case 'altaGol':
        pos.set(lado * (MITAD_L - 22), 14, -26);
        mira.set(lado * (MITAD_L - 3), 0.5, 0);
        this.fovObj = 30 + Math.max(0, 6 - c.t * 2);
        rapidez = 3;
        break;
      case 'orbitaJugador': { // celebración
        const p = info.foco || b;
        const a = c.t * 0.45 + (c.angulo || 0);
        pos.set(p.x + Math.sin(a) * 5.5, 1.7, p.z + Math.cos(a) * 5.5);
        mira.set(p.x, 1.2, p.z);
        this.fovObj = 38;
        rapidez = 5;
        break;
      }
      case 'tunel': { // entrada de equipos
        const p = info.foco || b;
        pos.set(p.x - 4 + c.t * 0.6, 1.6, p.z - 7);
        mira.set(p.x, 1.3, p.z);
        this.fovObj = 42;
        rapidez = 2;
        break;
      }
      case 'estadio': { // vista general giratoria
        const a = c.t * 0.12 + (c.angulo || 0);
        pos.set(Math.sin(a) * 85, 30, Math.cos(a) * 70);
        mira.set(0, 0, 0);
        this.fovObj = 42;
        rapidez = 2;
        break;
      }
      case 'fijo':
        pos.copy(c.pos); mira.copy(c.mira); this.fovObj = c.fov || 40;
        break;
      default: break;
    }
    if (c.t < 0.05 || c.corte) { this.cam.position.copy(pos); this.mira.copy(mira); c.corte = false; }
    this.cam.position.x = suave(this.cam.position.x, pos.x, rapidez, dt);
    this.cam.position.y = suave(this.cam.position.y, pos.y, rapidez, dt);
    this.cam.position.z = suave(this.cam.position.z, pos.z, rapidez, dt);
    this.mira.x = suave(this.mira.x, mira.x, rapidez * 1.5, dt);
    this.mira.y = suave(this.mira.y, mira.y, rapidez * 1.5, dt);
    this.mira.z = suave(this.mira.z, mira.z, rapidez * 1.5, dt);
    if (c.t < 0.05) this.cam.fov = this.fovObj;
    this.aplicar(dt);
  }
}
