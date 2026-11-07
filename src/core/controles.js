// Controles: mandos (Gamepad API: Xbox, PlayStation y genéricos) + teclado de respaldo.
// Incluye zona muerta, vibración, detección de conexión y reasignación guardada en localStorage.
import { leerJSON, guardarJSON, ajustes } from './ajustes.js';

export const ACCIONES = [
  { id: 'pase', nombre: 'Pase / Entrada' },
  { id: 'tiro', nombre: 'Tiro / Barrida' },
  { id: 'paseLargo', nombre: 'Pase largo / Centro' },
  { id: 'filtrado', nombre: 'Pase filtrado' },
  { id: 'cambiar', nombre: 'Cambiar jugador' },
  { id: 'correr', nombre: 'Correr' },
  { id: 'proteger', nombre: 'Proteger balón' },
  { id: 'camara', nombre: 'Cambiar cámara' },
  { id: 'pausa', nombre: 'Pausa' },
];

// Índices del "mapeo estándar" de la Gamepad API.
export const MANDO_PREDETERMINADO = {
  pase: 0, tiro: 1, paseLargo: 2, filtrado: 3, cambiar: 4, correr: 7, proteger: 6, camara: 8, pausa: 9,
};
export const TECLADO_PREDETERMINADO = {
  pase: 'KeyA', tiro: 'KeyD', paseLargo: 'KeyS', filtrado: 'KeyW', cambiar: 'KeyQ',
  correr: 'ShiftLeft', proteger: 'KeyE', camara: 'KeyC', pausa: 'Escape',
};

const NOMBRES_XBOX = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Menu', 'L3', 'R3', '↑', '↓', '←', '→', 'Guía'];
const NOMBRES_PS = ['✕', '○', '□', '△', 'L1', 'R1', 'L2', 'R2', 'Share', 'Options', 'L3', 'R3', '↑', '↓', '←', '→', 'PS'];

const CLAVE_MAPEO = 'supersoccer.controles.v1';
const ZONA_MUERTA = 0.2;
const UMBRAL_GATILLO = 0.35;

function tipoMando(id) {
  const s = (id || '').toLowerCase();
  if (/xbox|xinput|045e|microsoft/.test(s)) return 'xbox';
  if (/054c|playstation|dualsense|dualshock|wireless controller|ps4|ps5/.test(s)) return 'ps';
  return 'generico';
}

export function nombreBoton(tipo, indice) {
  const tabla = tipo === 'ps' ? NOMBRES_PS : NOMBRES_XBOX;
  return tabla[indice] ?? `Botón ${indice}`;
}

export function nombreTecla(codigo) {
  if (!codigo) return '—';
  return codigo.replace(/^Key/, '').replace(/^Digit/, '').replace('ShiftLeft', 'Shift Izq')
    .replace('ShiftRight', 'Shift Der').replace('ControlLeft', 'Ctrl Izq').replace('Escape', 'Esc')
    .replace('Space', 'Espacio').replace('Enter', 'Enter');
}

// Zona muerta radial con reescalado: elimina movimientos fantasma y mantiene precisión.
function zonaMuerta(x, y, zm = ZONA_MUERTA) {
  const m = Math.hypot(x, y);
  if (m < zm) return [0, 0];
  const k = Math.min(1, (m - zm) / (1 - zm)) / m;
  return [x * k, y * k];
}

class EstadoDispositivo {
  constructor(id, tipo, indice = -1) {
    this.id = id; this.tipo = tipo; this.indice = indice;
    this.mx = 0; this.my = 0; this.rx = 0; this.ry = 0;
    this.actual = {}; this.anterior = {};
    this.tiempoPresionado = {};
    this.gatillo = 0; // valor analógico del gatillo de correr
    this.navAnterior = { x: 0, y: 0 };
    this.btnAnt = [];
    this.btnAct = [];
  }
  presionado(a) { return !!this.actual[a] && !this.anterior[a]; }
  soltado(a) { return !this.actual[a] && !!this.anterior[a]; }
  mantenido(a) { return !!this.actual[a]; }
  duracion(a) { return this.tiempoPresionado[a] || 0; }
  nombre() {
    if (this.tipo === 'teclado') return 'Teclado';
    if (this.tipo === 'ps') return 'Mando PlayStation';
    if (this.tipo === 'xbox') return 'Mando Xbox';
    return 'Mando';
  }
}

export class Controles {
  constructor() {
    this.teclas = new Set();
    this.pulsadas = new Set();
    this.dispositivos = new Map(); // id -> EstadoDispositivo
    this.teclado = new EstadoDispositivo('teclado', 'teclado');
    this.dispositivos.set('teclado', this.teclado);
    this.alConectar = null;
    this.alDesconectar = null;
    this.capturando = null; // para reasignar botones
    const guardado = leerJSON(CLAVE_MAPEO, {});
    this.mapeoMando = { ...MANDO_PREDETERMINADO, ...(guardado.mando || {}) };
    this.mapeoTeclado = { ...TECLADO_PREDETERMINADO, ...(guardado.teclado || {}) };
    this.nav = { arriba: false, abajo: false, izq: false, der: false, aceptar: false, volver: false, l: false, r: false, origen: null };
    this.repeticion = { dir: null, t: 0 };

    window.addEventListener('keydown', (e) => {
      if (this.capturando && this.capturando.tipo === 'teclado') {
        e.preventDefault();
        const c = this.capturando; this.capturando = null;
        c.resolver(e.code);
        return;
      }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(e.code)) e.preventDefault();
      this.teclas.add(e.code);
      if (!e.repeat) this.pulsadas.add(e.code); // recuerda toques cortos aunque el cuadro sea lento
    });
    window.addEventListener('keyup', (e) => this.teclas.delete(e.code));
    window.addEventListener('blur', () => this.teclas.clear());
    window.addEventListener('gamepadconnected', (e) => this.conectar(e.gamepad));
    window.addEventListener('gamepaddisconnected', (e) => this.desconectar(e.gamepad));
  }

  conectar(gp) {
    const id = `mando${gp.index}`;
    if (this.dispositivos.has(id)) return;
    const d = new EstadoDispositivo(id, tipoMando(gp.id), gp.index);
    this.dispositivos.set(id, d);
    this.alConectar?.(d, gp);
  }

  desconectar(gp) {
    const id = `mando${gp.index}`;
    const d = this.dispositivos.get(id);
    if (!d) return;
    this.dispositivos.delete(id);
    this.alDesconectar?.(d);
  }

  mandos() { return [...this.dispositivos.values()].filter((d) => d.tipo !== 'teclado'); }

  // Lista ordenada: primero mandos, luego teclado.
  listaDispositivos() { return [...this.mandos(), this.teclado]; }

  guardarMapeo() {
    guardarJSON(CLAVE_MAPEO, { mando: this.mapeoMando, teclado: this.mapeoTeclado });
  }

  restaurarMapeo() {
    this.mapeoMando = { ...MANDO_PREDETERMINADO };
    this.mapeoTeclado = { ...TECLADO_PREDETERMINADO };
    this.guardarMapeo();
  }

  // Espera a que el jugador presione un botón/tecla para asignarlo.
  capturar(tipo) {
    return new Promise((resolver) => { this.capturando = { tipo, resolver, espera: 0.25 }; });
  }

  actualizar(dt) {
    // Algunos navegadores no disparan "gamepadconnected" hasta presionar un botón: revisamos igual.
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const vistos = new Set();
    for (const gp of pads) {
      if (!gp || !gp.connected) continue;
      vistos.add(`mando${gp.index}`);
      if (!this.dispositivos.has(`mando${gp.index}`)) this.conectar(gp);
    }
    for (const d of this.mandos()) {
      if (!vistos.has(d.id)) this.desconectar({ index: d.indice });
    }

    // Teclado
    const t = this.teclado;
    t.anterior = t.actual; t.actual = {};
    const k = this.teclas;
    let x = 0, y = 0;
    if (k.has('ArrowLeft')) x -= 1;
    if (k.has('ArrowRight')) x += 1;
    if (k.has('ArrowUp')) y += 1;
    if (k.has('ArrowDown')) y -= 1;
    const m = Math.hypot(x, y) || 1;
    t.mx = x / m; t.my = y / m;
    t.rx = (k.has('KeyL') ? 1 : 0) - (k.has('KeyJ') ? 1 : 0);
    t.ry = (k.has('KeyI') ? 1 : 0) - (k.has('KeyK') ? 1 : 0);
    for (const a of ACCIONES) {
      const cod = this.mapeoTeclado[a.id];
      t.actual[a.id] = k.has(cod) || (this.pulsadas.has(cod) && !t.anterior[a.id]);
    }
    t.gatillo = t.actual.correr ? 1 : 0;
    this.acumularTiempos(t, dt);

    // Mandos
    for (const d of this.mandos()) {
      const gp = pads[d.indice];
      if (!gp) continue;
      d.anterior = d.actual; d.actual = {};
      d.btnAnt = d.btnAct;
      d.btnAct = gp.buttons.map((b) => b.pressed || b.value > UMBRAL_GATILLO);
      const ax = gp.axes;
      const [lx, ly] = zonaMuerta(ax[0] || 0, ax[1] || 0);
      const [rx, ry] = zonaMuerta(ax[2] || 0, ax[3] || 0, 0.25);
      d.mx = lx; d.my = -ly; d.rx = rx; d.ry = -ry;
      // La cruceta también mueve al jugador.
      const b = d.btnAct;
      if (b[12] || b[13] || b[14] || b[15]) {
        const cx = (b[15] ? 1 : 0) - (b[14] ? 1 : 0);
        const cy = (b[12] ? 1 : 0) - (b[13] ? 1 : 0);
        const cm = Math.hypot(cx, cy) || 1;
        d.mx = cx / cm; d.my = cy / cm;
      }
      for (const a of ACCIONES) d.actual[a.id] = !!b[this.mapeoMando[a.id]];
      const btnCorrer = gp.buttons[this.mapeoMando.correr];
      d.gatillo = btnCorrer ? Math.max(btnCorrer.value, btnCorrer.pressed ? 1 : 0) : 0;
      this.acumularTiempos(d, dt);

      // Captura de botón para reasignar.
      if (this.capturando && this.capturando.tipo === 'mando') {
        this.capturando.espera -= dt;
        if (this.capturando.espera <= 0) {
          const idx = d.btnAct.findIndex((v, i) => v && !d.btnAnt[i] && i < 12);
          if (idx >= 0) { const c = this.capturando; this.capturando = null; c.resolver(idx); }
        }
      }
    }
    this.actualizarNavegacion(dt);
  }

  acumularTiempos(d, dt) {
    for (const a of ACCIONES) {
      if (d.actual[a.id]) d.tiempoPresionado[a.id] = (d.anterior[a.id] ? (d.tiempoPresionado[a.id] || 0) : 0) + dt;
      else if (!d.anterior[a.id]) d.tiempoPresionado[a.id] = 0;
    }
  }

  // Navegación de menús con cualquier dispositivo (cruceta/stick, A = aceptar, B = volver).
  actualizarNavegacion(dt) {
    const n = this.nav;
    n.arriba = n.abajo = n.izq = n.der = n.aceptar = n.volver = n.l = n.r = false;
    n.origen = null;
    let dir = null;
    const k = this.teclas;
    const tk = this.teclado;
    if (k.has('ArrowUp') || k.has('KeyW')) dir = 'arriba';
    else if (k.has('ArrowDown') || k.has('KeyS')) dir = 'abajo';
    else if (k.has('ArrowLeft') || k.has('KeyA')) dir = 'izq';
    else if (k.has('ArrowRight') || k.has('KeyD')) dir = 'der';
    if (this._enterAnt === undefined) this._enterAnt = false;
    const enter = k.has('Enter') || k.has('Space') || this.pulsadas.has('Enter') || this.pulsadas.has('Space');
    if (enter && !this._enterAnt) { n.aceptar = true; n.origen = tk; }
    this._enterAnt = enter;
    const esc = k.has('Escape') || k.has('Backspace') || this.pulsadas.has('Escape') || this.pulsadas.has('Backspace');
    if (esc && !this._escAnt) { n.volver = true; n.origen = tk; }
    this._escAnt = esc;

    for (const d of this.mandos()) {
      const b = d.btnAct, a = d.btnAnt;
      const pres = (i) => b[i] && !a[i];
      const ax = navigator.getGamepads()[d.indice]?.axes || [];
      const sx = ax[0] || 0, sy = ax[1] || 0;
      if (b[12] || sy < -0.6) dir = 'arriba';
      else if (b[13] || sy > 0.6) dir = 'abajo';
      else if (b[14] || sx < -0.6) dir = 'izq';
      else if (b[15] || sx > 0.6) dir = 'der';
      if (pres(0)) { n.aceptar = true; n.origen = d; }
      if (pres(1)) { n.volver = true; n.origen = d; }
      if (pres(4)) n.l = true;
      if (pres(5)) n.r = true;
      if (pres(9) && !n.aceptar) { n.inicio = true; n.origen = d; }
    }
    const r = this.repeticion;
    // Toques cortos de flechas
    if (!dir) {
      for (const [c, d] of [['ArrowUp', 'arriba'], ['ArrowDown', 'abajo'], ['ArrowLeft', 'izq'], ['ArrowRight', 'der']]) if (this.pulsadas.has(c)) dir = d;
    }
    this.pulsadas.clear();
    if (dir) {
      if (dir !== r.dir) { r.dir = dir; r.t = 0.38; n[dir] = true; }
      else {
        r.t -= dt;
        if (r.t <= 0) { r.t = 0.12; n[dir] = true; }
      }
    } else r.dir = null;
  }

  vibrar(dispositivo, intensidad = 0.5, duracionMs = 200) {
    if (!ajustes.vibracion || !dispositivo || dispositivo.tipo === 'teclado') return;
    const gp = navigator.getGamepads()[dispositivo.indice];
    if (!gp) return;
    try {
      if (gp.vibrationActuator?.playEffect) {
        gp.vibrationActuator.playEffect('dual-rumble', {
          startDelay: 0, duration: duracionMs, weakMagnitude: Math.min(1, intensidad), strongMagnitude: Math.min(1, intensidad * 0.8),
        }).catch(() => {});
      } else if (gp.hapticActuators?.[0]?.pulse) {
        gp.hapticActuators[0].pulse(intensidad, duracionMs);
      }
    } catch { /* el mando no soporta vibración */ }
  }

  vibrarTodos(intensidad, duracionMs) {
    for (const d of this.mandos()) this.vibrar(d, intensidad, duracionMs);
  }

  etiqueta(dispositivo, accion) {
    if (!dispositivo || dispositivo.tipo === 'teclado') return nombreTecla(this.mapeoTeclado[accion]);
    return nombreBoton(dispositivo.tipo, this.mapeoMando[accion]);
  }
}
