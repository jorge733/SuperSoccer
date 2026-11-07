// Campeonato Nacional (liga de 30 fechas, ida y vuelta) y Copa Chile (eliminación directa con penales).
// El progreso se guarda automáticamente en localStorage.
import { leerJSON, guardarJSON, borrarClave } from '../core/ajustes.js';

const CLAVE_LIGA = 'supersoccer.campeonato.v1';
const CLAVE_COPA = 'supersoccer.copa.v1';

function poisson(l) {
  const L = Math.exp(-l);
  let k = 0, p = 1;
  do { k++; p *= Math.random(); } while (p > L && k < 12);
  return k - 1;
}

// Simula un partido según el nivel de los clubes (con localía).
export function simularPartido(local, visita) {
  const dif = (local.nivel - visita.nivel) / 13;
  const gl = poisson(1.38 * Math.exp(dif * 0.9));
  const gv = poisson(1.05 * Math.exp(-dif * 0.9));
  return { gl, gv, goles: [...asignarGoles(local, gl, 0), ...asignarGoles(visita, gv, 1)] };
}

function asignarGoles(club, n, equipo) {
  const peso = { DEL: 3.2, VOL: 1.4, DEF: 0.35, ARQ: 0.01 };
  const js = club.jugadores;
  const tot = js.reduce((a, j) => a + peso[j.posicion] * j.atributos.tiro * (j.titular ? 1.6 : 0.6), 0);
  const res = [];
  for (let i = 0; i < n; i++) {
    let r = Math.random() * tot;
    for (const j of js) {
      r -= peso[j.posicion] * j.atributos.tiro * (j.titular ? 1.6 : 0.6);
      if (r <= 0) { res.push({ equipo, jugador: j.nombre, club: club.id, minuto: 1 + Math.floor(Math.random() * 90) }); break; }
    }
  }
  return res;
}

export function simularPenales() {
  const p = [0, 0];
  for (let i = 0; i < 5; i++) for (let e = 0; e < 2; e++) if (Math.random() < 0.76) p[e]++;
  while (p[0] === p[1]) { for (let e = 0; e < 2; e++) if (Math.random() < 0.72) p[e]++; }
  return p;
}

// ---------------- Campeonato ----------------
export class Campeonato {
  constructor(datos, clubes) {
    this.d = datos;
    this.clubes = clubes;
    this.porId = Object.fromEntries(clubes.map((c) => [c.id, c]));
  }

  static nuevo(clubes, miClub) {
    const ids = clubes.map((c) => c.id);
    // Método del círculo para un todos contra todos
    const n = ids.length;
    const lista = [...ids].sort(() => Math.random() - 0.5);
    const ida = [];
    for (let r = 0; r < n - 1; r++) {
      const fecha = [];
      for (let i = 0; i < n / 2; i++) {
        const a = lista[i], b = lista[n - 1 - i];
        fecha.push(r % 2 === 0 ? [a, b] : [b, a]);
      }
      ida.push(fecha);
      lista.splice(1, 0, lista.pop());
    }
    const vuelta = ida.map((f) => f.map(([a, b]) => [b, a]));
    const tabla = Object.fromEntries(ids.map((id) => [id, { pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, pts: 0 }]));
    const datos = { version: 1, miClub, fecha: 0, calendario: [...ida, ...vuelta], resultados: [], tabla, goleadores: {} };
    const c = new Campeonato(datos, clubes);
    c.guardar();
    return c;
  }

  static cargar(clubes) {
    const d = leerJSON(CLAVE_LIGA);
    if (!d || d.version !== 1) return null;
    return new Campeonato(d, clubes);
  }

  static borrar() { borrarClave(CLAVE_LIGA); }
  guardar() { guardarJSON(CLAVE_LIGA, this.d); }

  get terminado() { return this.d.fecha >= this.d.calendario.length; }
  get miClub() { return this.porId[this.d.miClub]; }
  get totalFechas() { return this.d.calendario.length; }

  partidoUsuario() {
    if (this.terminado) return null;
    const f = this.d.calendario[this.d.fecha];
    const p = f.find(([a, b]) => a === this.d.miClub || b === this.d.miClub);
    return p ? { local: this.porId[p[0]], visita: this.porId[p[1]] } : null;
  }

  registrar(localId, visitaId, gl, gv, goles = []) {
    const t = this.d.tabla;
    const L = t[localId], V = t[visitaId];
    L.pj++; V.pj++; L.gf += gl; L.gc += gv; V.gf += gv; V.gc += gl;
    if (gl > gv) { L.pg++; V.pp++; L.pts += 3; } else if (gl < gv) { V.pg++; L.pp++; V.pts += 3; } else { L.pe++; V.pe++; L.pts++; V.pts++; }
    for (const g of goles) {
      if (g.enContra) continue;
      const clave = `${g.jugador}|${g.club}`;
      this.d.goleadores[clave] = (this.d.goleadores[clave] || 0) + 1;
    }
    if (!this.d.resultados[this.d.fecha]) this.d.resultados[this.d.fecha] = [];
    this.d.resultados[this.d.fecha].push({ l: localId, v: visitaId, gl, gv });
  }

  // Juega (simula) todos los partidos de la fecha excepto el del usuario si ya se registró.
  completarFecha(resultadoUsuario = null) {
    const f = this.d.calendario[this.d.fecha];
    for (const [a, b] of f) {
      const esMio = a === this.d.miClub || b === this.d.miClub;
      if (esMio && resultadoUsuario) {
        this.registrar(a, b, resultadoUsuario.gl, resultadoUsuario.gv, resultadoUsuario.goles.map((g) => ({ ...g })));
      } else {
        const r = simularPartido(this.porId[a], this.porId[b]);
        this.registrar(a, b, r.gl, r.gv, r.goles);
      }
    }
    this.d.fecha++;
    this.guardar();
  }

  tablaOrdenada() {
    return Object.entries(this.d.tabla).map(([id, s]) => ({ id, club: this.porId[id], ...s, dg: s.gf - s.gc }))
      .sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf || a.club.nombre.localeCompare(b.club.nombre));
  }

  goleadores(n = 15) {
    return Object.entries(this.d.goleadores).map(([k, g]) => { const [nombre, club] = k.split('|'); return { nombre, club: this.porId[club], goles: g }; })
      .sort((a, b) => b.goles - a.goles).slice(0, n);
  }

  resultadosFecha(i) { return this.d.resultados[i] || []; }
}

// ---------------- Copa Chile ----------------
export const RONDAS_COPA = ['Octavos de final', 'Cuartos de final', 'Semifinal', 'Final'];

export class Copa {
  constructor(datos, clubes) {
    this.d = datos;
    this.clubes = clubes;
    this.porId = Object.fromEntries(clubes.map((c) => [c.id, c]));
  }

  static nueva(clubes, miClub) {
    const ids = clubes.map((c) => c.id).sort(() => Math.random() - 0.5);
    const cruces = [];
    for (let i = 0; i < ids.length; i += 2) cruces.push({ a: ids[i], b: ids[i + 1], ga: null, gb: null, pen: null, ganador: null });
    const d = { version: 1, miClub, ronda: 0, rondas: [cruces], campeon: null, eliminado: false };
    const c = new Copa(d, clubes);
    c.guardar();
    return c;
  }

  static cargar(clubes) {
    const d = leerJSON(CLAVE_COPA);
    if (!d || d.version !== 1) return null;
    return new Copa(d, clubes);
  }

  static borrar() { borrarClave(CLAVE_COPA); }
  guardar() { guardarJSON(CLAVE_COPA, this.d); }

  get terminada() { return !!this.d.campeon; }
  get miClub() { return this.porId[this.d.miClub]; }

  cruceUsuario() {
    if (this.terminada || this.d.eliminado) return null;
    const c = this.d.rondas[this.d.ronda].find((x) => x.a === this.d.miClub || x.b === this.d.miClub);
    return c ? { cruce: c, local: this.porId[c.a], visita: this.porId[c.b] } : null;
  }

  // Completa la ronda actual (con el resultado del usuario si jugó) y arma la siguiente.
  completarRonda(resultadoUsuario = null) {
    const ronda = this.d.rondas[this.d.ronda];
    for (const c of ronda) {
      if (c.ganador) continue;
      const mio = c.a === this.d.miClub || c.b === this.d.miClub;
      let ga, gb, pen = null;
      if (mio && resultadoUsuario) {
        ga = resultadoUsuario.gl; gb = resultadoUsuario.gv; pen = resultadoUsuario.penales;
        if (ga === gb && !pen) pen = simularPenales();
      } else {
        const r = simularPartido(this.porId[c.a], this.porId[c.b]);
        ga = r.gl; gb = r.gv;
        if (ga === gb) pen = simularPenales();
      }
      c.ga = ga; c.gb = gb; c.pen = pen;
      c.ganador = ga > gb ? c.a : gb > ga ? c.b : pen[0] > pen[1] ? c.a : c.b;
      if (mio && c.ganador !== this.d.miClub) this.d.eliminado = true;
    }
    if (ronda.length === 1) { this.d.campeon = ronda[0].ganador; this.guardar(); return; }
    const sig = [];
    for (let i = 0; i < ronda.length; i += 2) sig.push({ a: ronda[i].ganador, b: ronda[i + 1].ganador, ga: null, gb: null, pen: null, ganador: null });
    this.d.rondas.push(sig);
    this.d.ronda++;
    this.guardar();
  }

  // Si el usuario quedó eliminado, simula hasta el final
  simularHastaElFinal() {
    while (!this.terminada) this.completarRonda();
  }
}
