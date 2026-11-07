// Partido 11 contra 11: reglas, posesión, pases, tiros, faltas, tarjetas, fuera de juego,
// pelotas paradas, goles con repetición, entretiempo, final y tanda de penales.
import * as THREE from 'three';
import { Jugador } from './jugador.js';
import { IAEquipo } from './ia.js';
import { ControlHumano } from './control.js';
import { Repeticion } from './repeticion.js';
import { FORMACIONES, elegirOnce } from './formaciones.js';
import { frase } from './relato.js';
import { elegirKits, kitArquero } from '../players/camiseta.js';
import { CANCHA, MITAD_L, MITAD_A, clamp, azar } from '../world/medidas.js';
import { RADIO_BALON } from '../world/balon.js';
import { sonido } from '../audio/sonido.js';
import { NOMBRE_CAMARA } from './camaras.js';
import { ajustes } from '../core/ajustes.js';

const G = 9.81;
const R = RADIO_BALON;
const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();

const KIT_ARBITRO = { camiseta: '#151515', detalle: '#ffd23f', short: '#151515', medias: '#151515', diseno: 'liso', zapatos: '#111' };

// Velocidad inicial para que un pase raso llegue a distancia d con velocidad final vf (roce del pasto)
function velRaso(d, vf) {
  let v0 = Math.sqrt(vf * vf + 2 * 2.0 * d);
  for (let i = 0; i < 3; i++) {
    const a = 0.9 + 0.12 * (v0 + vf) / 2;
    v0 = Math.sqrt(vf * vf + 2 * a * d);
  }
  return Math.min(v0, 30);
}

export class Partido {
  constructor(ctx, config) {
    Object.assign(this, ctx); // escena, fisica, balon, estadio, publico, camaras, hud, input, ambiente
    this.config = config;
    this.fase = 'inicio';
    this.tFase = 0;
    this.pausado = false;
    this.mitad = 1;
    this.tiempo = 0;
    this.durMitad = (config.duracion || 4) * 60;
    this.anadido = null;
    this.poseedor = null;
    this.ultimoToque = null;
    this.equipoEnPosesion = null;
    this.balonSujeto = null;
    this.tiroEnCurso = null;
    this.offside = null;
    this.receptorPase = null;
    this.ejecutorPelotaParada = null;
    this.listoParaSacar = false;
    this.goles = [];
    this.eventosFisica = [];
    this.velocidadJuego = 1;
    this.temporizadores = [];
    this.crearEquipos();
    this.crearArbitros();
    this.entidades = [...this.equipos[0].jugadores, ...this.equipos[1].jugadores, this.arbitro, ...this.jueces];
    this.repeticion = new Repeticion(this.entidades, this.balon, 9);
    this.controles = [];
    for (const [i, h] of (config.humanos || []).entries()) {
      const c = new ControlHumano(this, h.dispositivo, this.equipos[h.equipo], i);
      this.controles.push(c);
    }
    this.prediccion = Array.from({ length: 40 }, () => new THREE.Vector3());
    this.estadio.actualizarPantalla({ local: this.equipos[0].club, visita: this.equipos[1].club, gl: 0, gv: 0, minuto: 0 });
  }

  // ---------- Montaje ----------
  crearEquipos() {
    const c = this.config;
    const [kl, kv] = c.kits || elegirKits(c.local, c.visita);
    this.equipos = [c.local, c.visita].map((club, i) => {
      const humano = (c.humanos || []).some((h) => h.equipo === i);
      const formacion = (c.formaciones && c.formaciones[i]) || (humano ? ajustes.formacion : club.formacion || '4-4-2');
      const { once, suplentes } = elegirOnce(club, formacion);
      const eq = {
        indice: i, club, kit: i === 0 ? kl : kv, formacion, dir: i === 0 ? 1 : -1, goles: 0, penales: 0,
        suplentes, jugadores: [],
        estad: { tiros: 0, alArco: 0, faltas: 0, corners: 0, posesion: 0, amarillas: 0, rojas: 0, offsides: 0 },
      };
      const kitArq = kitArquero(i * 2 + (club.id.length % 2));
      const f = FORMACIONES[formacion];
      eq.jugadores = once.map((datos, k) => {
        const j = new Jugador({
          escena: this.escena, fisica: this.fisica, datos, equipo: eq, indice: k, rol: f[k].rol,
          kit: k === 0 ? { ...kitArq, zapatos: '#111' } : eq.kit, esArquero: k === 0,
        });
        return j;
      });
      return eq;
    });
    const dif = c.dificultad || ajustes.dificultad;
    for (const eq of this.equipos) {
      const humano = (c.humanos || []).some((h) => h.equipo === eq.indice);
      eq.ia = new IAEquipo(this, eq, humano ? 'normal' : dif);
    }
  }

  crearArbitros() {
    const datosArb = { camiseta: '', dorsal: 0, atributos: { velocidad: 72, tiro: 30, pase: 30, regate: 30, defensa: 30, fisico: 80, arquero: 10 }, apariencia: { altura: 1.78, contextura: 1, piel: 2, colorPelo: 0, estiloPelo: 'rapado', barba: false } };
    this.arbitro = new Jugador({ escena: this.escena, fisica: null, datos: datosArb, kit: KIT_ARBITRO, esArbitro: true });
    this.jueces = [0, 1].map((i) => new Jugador({
      escena: this.escena, fisica: null, kit: KIT_ARBITRO, esArbitro: true,
      datos: { ...datosArb, apariencia: { ...datosArb.apariencia, estiloPelo: i ? 'corto' : 'pelado', piel: 1 + i * 2 } },
    }));
    // Banderín del juez de línea
    for (const j of this.jueces) {
      const b = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.25), new THREE.MeshStandardMaterial({ color: 0xffd23f, side: THREE.DoubleSide }));
      b.position.set(0, -0.3, 0.15);
      j.modelo.huesos[10].add(b); // mano derecha
      j.bandera = b;
    }
    // Tarjeta del árbitro
    this.tarjeta = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.13), new THREE.MeshBasicMaterial({ color: 0xffd400, side: THREE.DoubleSide }));
    this.tarjeta.position.set(0, -0.28, 0.02);
    this.tarjeta.visible = false;
    this.arbitro.modelo.huesos[10].add(this.tarjeta);
  }

  destruir() {
    for (const e of this.entidades) e.destruir(this.escena);
    for (const c of this.controles) c.destruir();
    this.hud?.desmontar();
  }

  get todos() { return this.equipos[0].jugadores.concat(this.equipos[1].jugadores); }

  // ---------- Utilidades tácticas ----------
  rivalMasCercano(j) { return this.rivalMasCercanoA(j.pos.x, j.pos.z, j.equipo); }
  rivalMasCercanoA(x, z, equipo = null) {
    let mejor = null, md = Infinity;
    const rivales = equipo ? this.equipos[1 - equipo.indice].jugadores : this.todos;
    for (const r of rivales) {
      if (r.expulsado) continue;
      const d = Math.hypot(r.pos.x - x, r.pos.z - z);
      if (d < md) { md = d; mejor = r; }
    }
    if (!equipo && mejor) {
      // rivalMasCercanoA sin equipo: usar el equipo contrario al poseedor
      const eq = this.equipoEnPosesion;
      if (eq) return this.rivalMasCercanoA(x, z, eq);
    }
    return mejor ? { j: mejor, d: md } : null;
  }

  // Línea del penúltimo defensor del equipo "defensor" (coordenada X)
  lineaOffside(defensor) {
    const d = defensor.dir;
    const xs = defensor.jugadores.filter((j) => !j.expulsado).map((j) => j.pos.x * -d).sort((a, b) => b - a);
    const segundo = xs[1] ?? 0;
    return Math.max(segundo, 0) * -d; // nunca antes de mitad de cancha
  }

  estaEnOffside(j, pasador) {
    const eq = j.equipo, d = eq.dir;
    const rival = this.equipos[1 - eq.indice];
    const linea = this.lineaOffside(rival) * d;
    const xb = this.balon.pos.x * d;
    const x = j.pos.x * d;
    return x > 0 && x > linea + 0.3 && x > xb + 0.3 && j !== pasador;
  }

  marcarOffside(equipo, pasador) {
    const set = new Set();
    for (const j of equipo.jugadores) if (!j.expulsado && this.estaEnOffside(j, pasador)) set.add(j);
    this.offside = set.size ? { equipo, jugadores: set } : null;
  }

  textoReloj() {
    if (this.fase === 'penales' || this.penales) return 'PEN';
    const total = this.tiempo / this.durMitad * 45;
    const base = this.mitad === 1 ? 0 : 45;
    if (total >= 45) {
      const extra = Math.floor(total - 45) + 1;
      return `${base + 45}+${extra}'`;
    }
    return `${base + Math.floor(total)}'`;
  }

  minuto() { return Math.min(this.mitad === 1 ? 45 : 90, (this.mitad === 1 ? 0 : 45) + Math.floor(this.tiempo / this.durMitad * 45)) + 1; }

  // ---------- Flujo general ----------
  iniciar() {
    this.hud.montar(this);
    if (this.config.soloPenales) { this.iniciarPenales(); return; }
    if (this.config.presentacion !== false) this.iniciarPresentacion();
    else this.prepararSaqueInicial(0);
  }

  cambiarFase(f) { this.fase = f; this.tFase = 0; }

  iniciarPresentacion() {
    this.cambiarFase('presentacion');
    // Los equipos salen del túnel (lado de las bancas) y forman en la mitad de la cancha
    this.equipos.forEach((eq, i) => {
      eq.jugadores.forEach((j, k) => {
        j.colocar(-1.5 + i * 3, MITAD_A + 6 + k * 1.1, Math.PI);
        j.formacionPres = new THREE.Vector3((i === 0 ? -1 : 1) * (1.5 + k * 1.2), 0, 1.5);
      });
    });
    this.arbitro.colocar(0, MITAD_A + 4.5, Math.PI);
    this.jueces[0].colocar(-0.8, MITAD_A + 4, Math.PI); this.jueces[1].colocar(0.8, MITAD_A + 4, Math.PI);
    this.balon.colocar(0, R, 0);
    this.camaras.iniciarCine('tunel');
    this.hud.banner(`${this.config.local.nombre} <span style="color:var(--tenue)">vs</span> ${this.config.visita.nombre}<small>${this.config.estadio || this.config.local.estadio}</small>`);
    sonido.rugir('aplauso');
    sonido.fijarEmocion(0.7);
    this.programar(() => sonido.cantar(6), 1200);
  }

  actualizarPresentacion(dt) {
    const t = this.tFase;
    for (const eq of this.equipos) {
      for (const j of eq.jugadores) {
        const o = j.formacionPres;
        const dx = o.x - j.pos.x, dz = o.z - j.pos.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.3) j.mover(dx, dz, Math.min(1, d / 2) * 0.5, false, dt);
        else { j.mover(0, 0, 0, false, dt); j.rumbo += (Math.PI - j.rumbo) * 0.08; }
        j.actualizar(dt);
      }
    }
    const destA = [[0, 2.5], [-1, 2.5], [1, 2.5]];
    [this.arbitro, ...this.jueces].forEach((a, i) => {
      const dx = destA[i][0] - a.pos.x, dz = destA[i][1] - a.pos.z;
      const d = Math.hypot(dx, dz);
      a.mover(dx, dz, d > 0.3 ? 0.5 : 0, false, dt);
      a.actualizar(dt);
    });
    const foco = tmp.set(this.equipos[0].jugadores[0].pos.x, 0, this.equipos[0].jugadores[0].pos.z);
    if (t > 4.5 && this.camaras.cine?.tipo === 'tunel') this.camaras.iniciarCine('estadio', { angulo: 2.6 });
    this.camaras.actualizar(dt, { balon: this.balon.pos, foco });
    const n = this.input.nav;
    const saltar = n.aceptar || n.inicio || n.volver;
    if (t > 9 || (t > 0.3 && saltar)) {
      this.hud.banner(null);
      this.camaras.terminarCine();
      this.prepararSaqueInicial(0);
    }
  }

  // Temporizadores en tiempo de juego (se detienen con la pausa)
  programar(fn, ms) { this.temporizadores.push({ t: ms / 1000, fn }); }

  correrTemporizadores(dt) {
    if (!this.temporizadores.length) return;
    const listos = [];
    for (const t of this.temporizadores) { t.t -= dt; if (t.t <= 0) listos.push(t); }
    if (!listos.length) return;
    this.temporizadores = this.temporizadores.filter((t) => t.t > 0);
    for (const t of listos) t.fn();
  }

  // ---------- Bucle principal ----------
  actualizar(dt) {
    if (this.pausado) return;
    this.tFase += dt;
    if (this.bloqueoPausa > 0) this.bloqueoPausa -= dt;
    this.correrTemporizadores(dt);
    for (const c of this.controles) c.actualizarIndicador(dt);
    if (this.fase === 'presentacion') { this.actualizarPresentacion(dt); this.comun(dt); return; }
    if (this.fase === 'repeticion') { this.actualizarRepeticion(dt); this.comun(dt, true); return; }
    if (this.fase === 'entretiempo' || this.fase === 'final') { this.actualizarPausaLarga(dt); this.comun(dt); return; }

    const juego = this.fase === 'juego';
    // Reloj
    if ((juego || this.fase === 'detenido') && !this.penales) this.actualizarReloj(dt);
    // Controles humanos e IA
    for (const c of this.controles) c.actualizar(dt);
    if (juego) {
      for (const eq of this.equipos) eq.ia.actualizar(dt);
      this.receptorDePaseIA(dt);
    } else if (this.fase === 'detenido') this.actualizarPelotaParada(dt);
    else if (this.fase === 'gol') this.actualizarGol(dt);
    else if (this.fase === 'penales') this.actualizarPenales(dt);

    for (const j of this.todos) if (!j.expulsado) j.actualizar(dt);
    this.separar();
    this.moverArbitros(dt);

    // Física
    const eventos = this.fisica.paso(dt, (h) => { this.balon.fuerzas(h); this.subpaso(h); });
    this.procesarEventos(eventos);
    if (juego || this.fase === 'penales') this.revisarReglas();
    this.predecir();
    if (this.equipoEnPosesion && juego) this.equipoEnPosesion.estad.posesion += dt;
    this.repeticion.grabar(dt);
    this.comun(dt);
  }

  comun(dt, enRepeticion = false) {
    if (!enRepeticion) this.balon.actualizarVisual(dt, this.camaras.cam);
    this.estadio.actualizar(dt, enRepeticion ? null : this.balon);
    const cont = this.controles[0]?.jugador || this.poseedor;
    if (this.fase !== 'presentacion' && this.fase !== 'repeticion') {
      const foco = this.focoCamara;
      this.camaras.actualizar(dt, {
        balon: this.camaras.cine ? this.balon.pos : this.puntoCamara(), jugador: cont,
        dirAtaque: (this.controles[0]?.equipo || this.equipos[0]).dir, foco,
      });
    }
    const b = enRepeticion ? this.repeticion.posBalon || this.balon.pos : this.balon.pos;
    this.ambiente.seguir(b);
    // Emoción del público según la jugada
    if (this.fase === 'juego') {
      const xA = Math.abs(this.balon.pos.x);
      if (xA > MITAD_L - 25) sonido.fijarEmocion(Math.max(sonido.emocionObj, 0.25 + (xA - (MITAD_L - 25)) / 40));
    }
    this.publico.actualizar(dt, sonido.emocion, this.fase === 'gol' ? 1 : 0);
    sonido.actualizar(dt);
  }

  puntoCamara() {
    // La cámara anticipa un poco hacia donde va el balón
    const b = this.balon.pos;
    tmp2.set(b.x + this.balon.vel.x * 0.25, b.y, b.z + this.balon.vel.z * 0.15);
    return tmp2;
  }

  actualizarReloj(dt) {
    if (this.fase !== 'juego') return;
    this.tiempo += dt;
    const minActual = this.minuto();
    if (minActual !== this._minPantalla) {
      this._minPantalla = minActual;
      this.estadio.actualizarPantalla({ local: this.equipos[0].club, visita: this.equipos[1].club, gl: this.equipos[0].goles, gv: this.equipos[1].goles, minuto: Math.min(minActual, this.mitad === 1 ? 45 : 90) });
    }
    if (this.tiempo >= this.durMitad) {
      if (this.anadido === null) {
        this.anadido = Math.floor(azar(1, this.mitad === 1 ? 3 : 5));
        this.hud.relato(`+${this.anadido} minutos de descuento`, 2.5, true);
      }
      const extra = this.anadido / 45 * this.durMitad;
      // No cortar una ocasión clara
      const peligro = Math.abs(this.balon.pos.x) > MITAD_L - 20 && this.tiroEnCurso;
      if (this.tiempo >= this.durMitad + extra && !peligro) this.finDeMitad();
    }
  }

  finDeMitad() {
    sonido.silbato('triple');
    this.arbitro.animador.reproducir('silbar');
    this.soltarBalon();
    if (this.mitad === 1) {
      this.cambiarFase('entretiempo');
      this.hud.relato(frase('entretiempo'), 3);
      this.hud.banner(`Entretiempo<small>${this.equipos[0].club.corto} ${this.equipos[0].goles} - ${this.equipos[1].goles} ${this.equipos[1].club.corto} · Presiona A / Enter para continuar</small>`);
      this.camaras.iniciarCine('estadio', { angulo: 0 });
    } else {
      const empate = this.equipos[0].goles === this.equipos[1].goles;
      if (empate && this.config.penalesSiEmpate) {
        this.hud.relato('¡Se define a penales!', 3);
        this.cambiarFase('entretiempo');
        this.hud.banner('¡Empate! Se viene la tanda de penales<small>Presiona A / Enter</small>');
        this.irAPenales = true;
        return;
      }
      this.terminarPartido();
    }
  }

  terminarPartido() {
    this.cambiarFase('final');
    this.hud.relato(frase('final'), 3);
    const [a, b] = this.equipos;
    let extra = '';
    if (this.penales) extra = ` (${a.penales}-${b.penales} pen.)`;
    this.hud.banner(`Final del partido<small>${a.club.corto} ${a.goles} - ${b.goles} ${b.club.corto}${extra} · Presiona A / Enter</small>`);
    this.camaras.iniciarCine('estadio', { angulo: 1 });
    const ganador = a.goles + a.penales > b.goles + b.penales ? a : b.goles + b.penales > a.goles + a.penales ? b : null;
    for (const eq of this.equipos) for (const j of eq.jugadores) {
      if (j.expulsado) continue;
      j.mover(0, 0, 0, false, 0);
      if (ganador === eq) j.animador.reproducir(Math.random() < 0.5 ? 'celebrarBrazos' : 'aplaudir');
      else if (ganador) j.animador.reproducir('lamento');
      else j.animador.reproducir('aplaudir');
      j.fijarEstado('celebrando', -1000);
    }
    if (ganador) sonido.rugir('gol');
  }

  actualizarPausaLarga(dt) {
    for (const j of this.todos) { if (!j.expulsado) { j.mover(0, 0, 0, false, dt); j.actualizar(dt); } }
    this.moverArbitros(dt);
    this.camaras.actualizar(dt, { balon: this.balon.pos });
    const n = this.input.nav;
    const listo = this.tFase > 1.2 && (n.aceptar || n.inicio);
    if (this.fase === 'entretiempo' && (listo || this.tFase > 12)) {
      this.hud.banner(null);
      this.camaras.terminarCine();
      if (this.irAPenales) { this.irAPenales = false; this.iniciarPenales(); return; }
      this.mitad = 2;
      this.tiempo = 0;
      this.anadido = null;
      for (const eq of this.equipos) eq.dir *= -1;
      for (const j of this.todos) { j.estamina = Math.min(1, j.estamina + 0.4); j.fijarEstado('libre'); j.animador.detener(); }
      this.prepararSaqueInicial(1);
    } else if (this.fase === 'final' && (listo || this.tFase > 15)) {
      if (this._terminado) return;
      this._terminado = true;
      this.hud.banner(null);
      this.config.alTerminar?.(this.resultado());
    }
  }

  resultado() {
    const [a, b] = this.equipos;
    return {
      local: a.club.id, visita: b.club.id, gl: a.goles, gv: b.goles,
      penales: this.penales ? [a.penales, b.penales] : null,
      goles: this.goles,
      estad: [a.estad, b.estad],
    };
  }

  pedirPausa() {
    if (['gol', 'repeticion', 'final', 'presentacion'].includes(this.fase)) {
      if (this.fase === 'repeticion') this.saltarRepeticion = true;
      return;
    }
    this.config.alPausar?.();
  }

  cambiarCamara() {
    const m = this.camaras.ciclar();
    ajustes.camara = m;
    this.hud.relato(`Cámara: ${NOMBRE_CAMARA[m]}`, 1.2, true);
  }

  // ---------- Física por sub-paso: conducción, posesión, atajadas ----------
  subpaso(h) {
    const b = this.balon;
    if (this.balonSujeto) {
      const j = this.balonSujeto;
      const enManos = j.esArquero && !this.ejecutorPelotaParada;
      const f = j.adelante;
      const alto = enManos ? 1.05 : 2.12 * ((j.datos?.apariencia?.altura || 1.8) / 1.8);
      b.cuerpo.setTranslation({ x: j.pos.x + f.x * (enManos ? 0.32 : 0.05), y: alto, z: j.pos.z + f.z * (enManos ? 0.32 : 0.05) }, true);
      b.cuerpo.setLinvel({ x: 0, y: 0, z: 0 }, true);
      b.leer();
      return;
    }
    // Conducción del balón
    const p = this.poseedor;
    if (p) {
      if (!p.puedeActuar() && p.estado !== 'accion') { this.perderBalon(p); return; }
      const rap = Math.hypot(p.vel.x, p.vel.z);
      const dist = 0.48 + rap * 0.05 + (p.proteger ? -0.08 : 0);
      const pie = p.puntoPie(dist, tmp);
      const dx = pie.x - b.pos.x, dz = pie.z - b.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > 1.8) { this.perderBalon(p); return; }
      const k = 14;
      b.cuerpo.setLinvel({ x: p.vel.x + dx * k, y: Math.min(b.vel.y, 0) + (R - b.pos.y) * 8, z: p.vel.z + dz * k }, true);
      b.leer();
      return;
    }
    // Atajada del arquero en camino
    if (this.tiroEnCurso?.decision) this.revisarAtajada();
    // Barridas en curso
    for (const j of this.todos) if (j.estado === 'barrida') this.revisarBarrida(j);
    // Captura de balón suelto
    if (this.fase !== 'juego' && this.fase !== 'penales') return;
    let mejor = null, md = Infinity;
    for (const j of this.todos) {
      if (j.expulsado || j.enfriamiento > 0 || !(j.puedeActuar() || j.estado === 'accion')) continue;
      if (this.fase === 'penales' && j !== this.penalArquero) continue;
      const pie = j.puntoPie(0.3, tmp);
      const dx = b.pos.x - pie.x, dz = b.pos.z - pie.z;
      const d = Math.hypot(dx, dz);
      const manos = j.esArquero && this.enAreaPropia(j) && !(this.ultimoToque && this.ultimoToque.equipo === j.equipo && this.ultimoPaseDeCompanero);
      const alcance = manos ? 1.05 : 0.72;
      const altoMax = manos ? 2.5 : 0.8;
      if (d < alcance && b.pos.y < altoMax && d < md) { md = d; mejor = j; }
      // Cabezazo
      if (!manos && b.pos.y > 1.45 && b.pos.y < 2.5 && d < 0.65 && j.puedeActuar() && !this.cabezazoT) this.cabezazo(j);
    }
    if (mejor) this.intentarControl(mejor);
  }

  enAreaPropia(j) {
    const ax = -MITAD_L * j.equipo.dir;
    return Math.abs(j.pos.x - ax) < CANCHA.areaGrande.largo + 0.5 && Math.abs(j.pos.z) < CANCHA.areaGrande.ancho / 2 + 0.5;
  }

  intentarControl(j) {
    const b = this.balon;
    const rel = Math.hypot(b.vel.x - j.vel.x, b.vel.z - j.vel.z) + Math.abs(b.vel.y) * 0.5;
    const manos = j.esArquero && this.enAreaPropia(j) && !(this.ultimoToque?.equipo === j.equipo && this.ultimoPaseDeCompanero);
    const max = manos ? 26 * (0.6 + j.at.arquero / 200) : 9 + j.at.regate * 0.12;
    if (rel < max) {
      if (manos && (b.pos.y > 0.4 || rel > 6)) this.atrapar(j);
      else this.tomarPosesion(j);
    } else if (rel < max + 9) {
      // Rebote: no la controla limpio
      const f = 0.35;
      b.fijarVelocidad(tmp.set(b.vel.x * f + azar(-2, 2), Math.abs(b.vel.y) * 0.3 + 0.5, b.vel.z * f + azar(-2, 2)));
      this.tocar(j);
      j.enfriamiento = 0.35;
    }
  }

  tocar(j) {
    // Fuera de juego: si el que toca estaba adelantado al momento del pase
    if (this.offside && this.offside.jugadores.has(j) && this.offside.equipo === j.equipo) {
      this.offside = null;
      this.cobrarOffside(j);
      return false;
    }
    if (this.offside && j.equipo !== this.offside.equipo) this.offside = null;
    else if (this.offside && j.equipo === this.offside.equipo) this.offside = null;
    this.ultimoToque = j;
    this.ultimoPaseDeCompanero = false;
    if (this.tiroEnCurso && !this.tiroEnCurso.decision) this.tiroEnCurso = null;
    if (this.receptorPase && j === this.receptorPase) this.receptorPase = null;
    return true;
  }

  tomarPosesion(j) {
    if (!this.tocar(j)) return;
    const anterior = this.equipoEnPosesion;
    this.poseedor = j;
    this.equipoEnPosesion = j.equipo;
    this.tiroEnCurso = null;
    j.enfriamiento = 0;
    // Cambio automático de jugador para humanos
    const ctrls = this.controles.filter((c) => c.equipo === j.equipo);
    if (ctrls.length && !j.controlado) {
      let c = ctrls.find((cc) => cc.ultimoPasador);
      if (!c) c = ctrls.slice().sort((a, b) => (a.jugador ? a.jugador.pos.distanceTo(j.pos) : 0) - (b.jugador ? b.jugador.pos.distanceTo(j.pos) : 0))[0];
      c.asignar(j);
    }
    for (const c of this.controles) c.ultimoPasador = false;
    if (anterior && anterior !== j.equipo) {
      for (const c of this.controles) if (c.equipo !== j.equipo && c.jugador && c.jugador.pos.distanceTo(j.pos) > 14) c.cambiarJugador(true);
    }
  }

  perderBalon(j) {
    if (this.poseedor === j) this.poseedor = null;
  }

  soltarBalon() { this.poseedor = null; this.balonSujeto = null; }

  atrapar(gk) {
    if (!this.tocar(gk)) return;
    this.poseedor = null;
    this.balonSujeto = gk;
    this.equipoEnPosesion = gk.equipo;
    this.tiroEnCurso = null;
    gk.animador.reproducir('atajar');
    gk.fijarEstado('accion', 0.5);
    this.programar(() => { if (this.balonSujeto === gk) gk.animador.reproducir('sostenerBalon'); }, 450);
    gk.equipo.ia.tSaque = undefined;
  }

  // ---------- Acciones con el balón ----------
  ejecutarPatada(j, { anim = 'pase', contacto = 0.14, escala = 1, fn }) {
    if (j.pendiente) return false;
    const def = anim;
    j.animador.reproducir(def, { escala, velocidad: 1 });
    j.fijarEstado('accion', contacto + 0.22);
    j.pendiente = {
      t: contacto,
      fn: () => {
        const b = this.balon;
        const cerca = this.poseedor === j || this.balonSujeto === j || j.puntoPie(0.5, tmp).distanceTo(tmp2.set(b.pos.x, 0, b.pos.z)) < 1.3;
        if (!cerca || b.pos.y > 1.3) return;
        if (this.poseedor === j) this.poseedor = null;
        if (this.balonSujeto === j) this.balonSujeto = null;
        this.ultimoToque = j;
        j.enfriamiento = 0.3;
        fn();
        if (this.fase === 'detenido') this.reanudar();
      },
    };
    return true;
  }

  // Calcula la velocidad para un balón elevado que cae en (x,z) con cierta altura máxima.
  velElevada(desde, x, z, apice) {
    const dx = x - desde.x, dz = z - desde.z;
    const d = Math.hypot(dx, dz) || 1;
    const vy = Math.sqrt(2 * G * apice);
    const T = (vy + Math.sqrt(vy * vy + 2 * G * Math.max(0, desde.y - R))) / G;
    const vh = (d / T) * (1 + d * 0.0028); // compensa el roce del aire
    return new THREE.Vector3((dx / d) * vh, vy, (dz / d) * vh);
  }

  aplicarError(v, sigma) {
    if (sigma <= 0) return v;
    const ang = (Math.random() + Math.random() + Math.random() - 1.5) * sigma * 1.4;
    const c = Math.cos(ang), s = Math.sin(ang);
    const x = v.x * c - v.z * s, z = v.x * s + v.z * c;
    v.x = x; v.z = z;
    v.multiplyScalar(1 + (Math.random() - 0.5) * sigma * 0.8);
    return v;
  }

  pase(j, receptor, tipo = 'raso', potencia = null, errorMult = 1) {
    if (!receptor) return;
    const b = this.balon;
    const d0 = j.pos.distanceTo(receptor.pos);
    let tx = receptor.pos.x, tz = receptor.pos.z;
    if (tipo === 'filtrado') {
      const lead = clamp(d0 / 11, 0.8, 2.6);
      tx += receptor.vel.x * lead + receptor.equipo.dir * 3.5;
      tz += receptor.vel.z * lead;
    } else {
      const lead = clamp(d0 / 18, 0.2, 1.2);
      tx += receptor.vel.x * lead; tz += receptor.vel.z * lead;
    }
    tx = clamp(tx, -MITAD_L + 0.5, MITAD_L + (tipo === 'filtrado' ? 0 : 0)); tz = clamp(tz, -MITAD_A + 0.5, MITAD_A - 0.5);
    const sigma = (0.02 + (1 - j.at.pase / 100) * 0.1) * errorMult * (j.controlado ? 0.8 : 1) * (j.proteger ? 1.2 : 1);
    this.marcarOffside(j.equipo, j);
    const real = receptor instanceof Jugador;
    if (j.controlado) { j.controlado.ultimoPasador = true; if (real && !receptor.controlado) j.controlado.asignar(receptor); }
    this.receptorPase = real ? receptor : null;
    this.ultimoPaseDeCompanero = true;
    const d = Math.hypot(tx - b.pos.x, tz - b.pos.z);
    j.mirarHacia(tx, tz);
    if (tipo === 'alto' || (tipo === 'filtrado' && d > 30 && potencia > 0.8)) {
      this.ejecutarPatada(j, {
        anim: 'patada', contacto: 0.2, escala: 0.8, fn: () => {
          const v = this.velElevada(b.pos, tx, tz, clamp(3 + d * 0.1 * (potencia ?? 0.7), 3, 14));
          b.patear(this.aplicarError(v, sigma));
          this.ultimoPaseDeCompanero = true;
          sonido.patada(0.6);
        },
      });
    } else {
      this.ejecutarPatada(j, {
        anim: 'pase', contacto: 0.13, fn: () => {
          const vf = tipo === 'filtrado' ? 6 + d * 0.06 : 7 + d * 0.1;
          const v0 = velRaso(d, vf) * (potencia ? 0.85 + potencia * 0.3 : 1);
          const dir = tmp.set(tx - b.pos.x, 0, tz - b.pos.z).normalize();
          const v = new THREE.Vector3(dir.x * v0, 0.3, dir.z * v0);
          b.patear(this.aplicarError(v, sigma));
          this.ultimoPaseDeCompanero = true;
          sonido.patada(0.35);
        },
      });
    }
  }

  paseAPunto(j, punto, tipo = 'raso') {
    const fantasma = { pos: new THREE.Vector3(punto.x, 0, punto.z), vel: new THREE.Vector3(), equipo: j.equipo, controlado: null };
    this.pase(j, fantasma, tipo === 'alto' ? 'alto' : 'raso', 0.7);
    this.receptorPase = null;
  }

  centro(j, punto, errorMult = 1, potencia = 0.8) {
    const b = this.balon;
    const sigma = (0.03 + (1 - j.at.pase / 100) * 0.09) * errorMult;
    this.marcarOffside(j.equipo, j);
    this.ultimoPaseDeCompanero = true;
    j.mirarHacia(punto.x, punto.z);
    this.ejecutarPatada(j, {
      anim: 'patada', contacto: 0.2, escala: 0.9, fn: () => {
        const d = Math.hypot(punto.x - b.pos.x, punto.z - b.pos.z);
        const v = this.velElevada(b.pos, punto.x, punto.z, clamp(3.5 + d * 0.08 * potencia, 3.5, 9));
        const curva = Math.sign(-j.pos.z * j.equipo.dir) * azar(2, 6);
        b.patear(this.aplicarError(v, sigma), new THREE.Vector3(0, curva, 0));
        this.ultimoPaseDeCompanero = true;
        sonido.patada(0.6);
      },
    });
  }

  despeje(j) {
    const dir = j.equipo.dir;
    const tx = clamp(j.pos.x + dir * azar(30, 48), -MITAD_L + 5, MITAD_L - 5);
    const tz = clamp(j.pos.z * 1.4 + azar(-12, 12), -MITAD_A + 3, MITAD_A - 3);
    j.mirarHacia(tx, tz);
    this.ejecutarPatada(j, {
      anim: 'patada', contacto: 0.18, fn: () => {
        const v = this.velElevada(this.balon.pos, tx, tz, azar(8, 14));
        this.balon.patear(this.aplicarError(v, 0.12));
        sonido.patada(0.8);
      },
    });
  }

  tiro(j, potencia, { z = 0, alto = 0.3, errorExtra = 1, humano = false, objetivo = null } = {}) {
    const b = this.balon;
    const eq = j.equipo;
    const gx = MITAD_L * eq.dir;
    const tz = clamp(z, -3.45, 3.45);
    const ty = 0.2 + clamp(alto, 0, 1) * 2.05;
    j.mirarHacia(gx, tz);
    const destino = objetivo || new THREE.Vector3(gx, ty, tz);
    eq.estad.tiros++;
    this.ejecutarPatada(j, {
      anim: 'patada', contacto: 0.19, escala: 0.75 + potencia * 0.35, fn: () => {
        const rapidez = 14 + potencia * (9 + j.at.tiro * 0.14);
        const dx = destino.x - b.pos.x, dz = destino.z - b.pos.z;
        const d = Math.hypot(dx, dz) || 1;
        // Error según habilidad, potencia, presión y si va de pierna cambiada
        const presion = this.rivalMasCercano(j);
        const presionF = presion && presion.d < 2 ? 1.4 : 1;
        const sigma = (0.012 + (1 - j.at.tiro / 100) * 0.05 + Math.pow(potencia, 3) * 0.035) * errorExtra * presionF * (humano ? 0.9 : 1);
        const T = (d / rapidez) * (1 + d * 0.004);
        let yObj = destino.y + (Math.random() - 0.4) * sigma * d * 0.8 + (potencia > 0.88 ? (potencia - 0.88) * 9 : 0);
        const vy = (yObj - b.pos.y) / T + 0.5 * G * T;
        const v = new THREE.Vector3((dx / d) * rapidez, vy, (dz / d) * rapidez);
        this.aplicarError(v, sigma);
        // Efecto: curva leve hacia el centro del arco en tiros colocados
        const curva = humano ? 0 : azar(-1, 1) * (1 - potencia) * 6;
        b.patear(v, new THREE.Vector3(0, curva, 0));
        sonido.patada(0.6 + potencia * 0.4);
        if (potencia > 0.75 && j.controlado) this.input.vibrar(j.controlado.disp, 0.5 + potencia * 0.3, 140);
        this.registrarTiro(j.equipo);
        if (d > 18) sonido.rugir('ocasion');
      },
    });
  }

  // Predice dónde cruza el balón la línea de gol tras un tiro
  registrarTiro(equipoAtacante) {
    const defensor = this.equipos[1 - equipoAtacante.indice];
    const gx = MITAD_L * equipoAtacante.dir;
    const p = this.balon.pos.clone(), v = this.balon.vel.clone();
    const h = 1 / 60;
    for (let t = 0; t < 3; t += h) {
      const vel = v.length();
      v.addScaledVector(v, -0.011 * vel * h);
      v.y -= G * h;
      p.addScaledVector(v, h);
      if (p.y < R) { p.y = R; v.y = Math.abs(v.y) * 0.45; v.x *= 0.92; v.z *= 0.92; }
      if ((p.x - gx) * equipoAtacante.dir >= 0) {
        this.tiroEnCurso = {
          atacante: equipoAtacante, defensor, z: p.z, y: p.y, t0: performance.now(), tRestante: t, tTotal: t,
          dentro: Math.abs(p.z) < CANCHA.anchoArco / 2 && p.y < CANCHA.altoArco, rapidez: this.balon.vel.length(),
        };
        if (this.tiroEnCurso.dentro) equipoAtacante.estad.alArco++;
        return;
      }
    }
    this.tiroEnCurso = null;
  }

  cabezazo(j) {
    const b = this.balon;
    const eq = j.equipo;
    const gx = MITAD_L * eq.dir;
    const dGol = Math.hypot(gx - j.pos.x, j.pos.z);
    this.cabezazoT = true;
    this.programar(() => { this.cabezazoT = false; }, 300);
    if (!this.tocar(j)) return;
    j.animador.reproducir('cabezazo', { velocidad: 1.6 });
    j.fijarEstado('accion', 0.5);
    j.enfriamiento = 0.4;
    let v;
    const atacando = dGol < 22 && (!j.controlado || j.controlado.disp.mantenido('tiro') || Math.random() < 0.85);
    if (atacando) {
      const tz = clamp(azar(-3.2, 3.2), -3.4, 3.4);
      const dx = gx - b.pos.x, dz = tz - b.pos.z, d = Math.hypot(dx, dz);
      const rap = 10 + j.at.tiro * 0.08 + j.at.fisico * 0.04;
      const T = d / rap;
      const vy = (azar(0.2, 1.6) - b.pos.y) / T + 0.5 * G * T;
      v = new THREE.Vector3((dx / d) * rap, vy, (dz / d) * rap);
      this.aplicarError(v, 0.06 + (1 - j.at.tiro / 100) * 0.12);
      eq.estad.tiros++;
      b.patear(v);
      this.registrarTiro(eq);
      sonido.rugir('ocasion');
    } else {
      // Despeje / pase de cabeza
      v = new THREE.Vector3(eq.dir * azar(8, 14), azar(3, 6), azar(-5, 5));
      b.patear(v);
    }
    sonido.patada(0.4);
  }

  regate(j, dir) {
    if (this.poseedor !== j || !j.puedeActuar()) return;
    j.rumbo = Math.atan2(dir.x, dir.z);
    j.vel.x = dir.x * Math.max(5, Math.hypot(j.vel.x, j.vel.z));
    j.vel.z = dir.z * Math.max(5, Math.hypot(j.vel.x, j.vel.z));
    j.esquive = 0.55;
    j.animador.reproducir('pase', { espejo: Math.random() < 0.5, escala: 0.5, velocidad: 1.5 });
    const rc = this.rivalMasCercano(j);
    if (rc && rc.d < 2.5) {
      this.programar(() => {
        if (this.poseedor === j && rc.j.pos.distanceTo(j.pos) > 2.2) { this.hud.relato(frase('regate'), 1.6, true); sonido.rugir('aplauso'); }
      }, 600);
    }
  }

  pedirPase(poseedor, receptor, tipo = 'raso') {
    if (poseedor.pendiente || !poseedor.puedeActuar()) return;
    const d = poseedor.pos.distanceTo(receptor.pos);
    this.pase(poseedor, receptor, tipo === 'filtrado' ? 'filtrado' : d > 30 ? 'alto' : 'raso', null, 0.9);
  }

  pedirPresion(equipo) { equipo.ia.apoyoForzado = 3; }

  // El receptor de un pase de la IA va a buscar el balón.
  receptorDePaseIA(dt) {
    const r = this.receptorPase;
    if (!r || r.controlado || this.poseedor || !r.puedeActuar?.()) return;
    const o = r.puntoInter || this.balon.pos;
    const dx = o.x - r.pos.x, dz = o.z - r.pos.z;
    r.mover(dx, dz, Math.min(1, Math.hypot(dx, dz) / 2), Math.hypot(dx, dz) > 4, dt);
  }

  // ---------- Quites ----------
  entrada(j) {
    if (!j.puedeActuar() || j.pendiente) return;
    const rival = this.poseedor;
    j.animador.reproducir('pase', { escala: 0.8, velocidad: 1.3 });
    j.fijarEstado('accion', 0.35);
    if (!rival || rival.equipo === j.equipo) return;
    const d = rival.pos.distanceTo(j.pos);
    if (d > 2.0) return;
    // de frente o de costado: comparar rumbos
    const dx = rival.pos.x - j.pos.x, dz = rival.pos.z - j.pos.z;
    const porDetras = (Math.sin(rival.rumbo) * dx + Math.cos(rival.rumbo) * dz) / (d || 1) > 0.6;
    let prob = 0.45 + (j.at.defensa - rival.at.regate) / 110 + (rival.proteger ? -0.18 : 0) + (rival.esquive > 0 ? -0.35 : 0);
    if (j.controlado) prob += 0.08;
    prob *= j.equipo.ia.dif.entrada * (j.controlado ? 1 : 0.95);
    if (Math.random() < clamp(prob, 0.08, 0.85)) {
      this.perderBalon(rival);
      const v = new THREE.Vector3(j.pos.x - rival.pos.x, 0, j.pos.z - rival.pos.z).normalize().multiplyScalar(azar(1.5, 4));
      v.x += azar(-1.5, 1.5); v.z += azar(-1.5, 1.5);
      this.balon.patear(v);
      this.tocar(j);
      rival.sinControl = 0.4; rival.enfriamiento = 0.45;
      sonido.patada(0.3);
      if (Math.random() < 0.25) this.hud.relato(frase('barrida'), 1.4, true);
      if (rival.controlado) this.input.vibrar(rival.controlado.disp, 0.4, 120);
    } else {
      j.enfriamiento = 0.6;
      j.fijarEstado('accion', 0.6);
      if (porDetras && Math.random() < 0.3) this.cobrarFalta(j, rival, 0.35);
    }
  }

  barrida(j) {
    if (!j.puedeActuar() || j.pendiente) return;
    const rap = Math.max(Math.hypot(j.vel.x, j.vel.z) + 1.5, 6.5);
    j.vel.x = Math.sin(j.rumbo) * rap;
    j.vel.z = Math.cos(j.rumbo) * rap;
    j.fijarEstado('barrida', 1.25);
    j.barridaInfo = { tocoBalon: false, golpeados: new Set(), t: 0 };
    j.animador.reproducir('barrida');
    if (j.controlado) this.input.vibrar(j.controlado.disp, 0.35, 160);
  }

  revisarBarrida(j) {
    const info = j.barridaInfo;
    if (!info) return;
    const transcurrido = 1.25 - j.tEstado;
    if (transcurrido < 0.12 || transcurrido > 0.85) return;
    const b = this.balon;
    const pie = j.puntoPie(0.95, tmp);
    const dB = Math.hypot(b.pos.x - pie.x, b.pos.z - pie.z);
    if (!info.tocoBalon && dB < 0.9 && b.pos.y < 0.6) {
      info.tocoBalon = true;
      const poseedorAnterior = this.poseedor;
      if (poseedorAnterior && poseedorAnterior.equipo !== j.equipo) { this.perderBalon(poseedorAnterior); poseedorAnterior.enfriamiento = 0.5; }
      const f = j.adelante;
      this.balon.patear(new THREE.Vector3(f.x * azar(5, 9) + azar(-2, 2), 0.6, f.z * azar(5, 9) + azar(-2, 2)));
      this.tocar(j);
      sonido.patada(0.5);
      if (poseedorAnterior && poseedorAnterior.equipo !== j.equipo) this.hud.relato(frase('barrida'), 1.4, true);
    }
    // Golpe al rival
    for (const r of this.equipos[1 - j.equipo.indice].jugadores) {
      if (r.expulsado || info.golpeados.has(r) || !r.puedeActuar()) continue;
      const d = Math.hypot(r.pos.x - pie.x, r.pos.z - pie.z);
      if (d < 0.85) {
        info.golpeados.add(r);
        if (!info.tocoBalon) {
          const dx = r.pos.x - j.pos.x, dz = r.pos.z - j.pos.z;
          const porDetras = (Math.sin(r.rumbo) * dx + Math.cos(r.rumbo) * dz) / (Math.hypot(dx, dz) || 1) > 0.4;
          this.caer(r);
          this.cobrarFalta(j, r, porDetras ? 0.85 : 0.5);
          return;
        } else if (Math.random() < 0.35) this.caer(r);
      }
    }
  }

  caer(j) {
    if (this.poseedor === j) this.perderBalon(j);
    j.fijarEstado('caido', 2.5);
    j.animador.reproducir('caida');
    j.vel.multiplyScalar(0.5);
    if (j.controlado) this.input.vibrar(j.controlado.disp, 0.7, 250);
  }

  // ---------- Arquero ----------
  reaccionArquero(gk, t) {
    const b = this.balon;
    const dz = t.z - gk.pos.z;
    const alto = t.y;
    const alcance = 2.4 + gk.at.arquero * 0.012;
    const s = Math.sin(gk.rumbo);
    // El eje izquierdo del arquero en el mundo es (cos r, 0, -sin r): proyectamos el desplazamiento lateral
    const lateral = (t.z - gk.pos.z) * -s;
    const haciaIzq = lateral > 0;
    const rap = t.rapidez;
    const distTiro = Math.abs(b.pos.x - gk.pos.x);
    let prob = (0.35 + gk.at.arquero / 160) * gk.equipo.ia.dif.arquero - (rap - 20) * 0.025 - Math.max(0, Math.abs(dz) - 1.5) * 0.12 + Math.min(0.2, (distTiro - 12) * 0.012);
    if (alto > 1.9 && Math.abs(dz) > 2.4) prob -= 0.2; // al ángulo
    prob = clamp(prob, 0.04, 0.92);
    const alcanzable = Math.abs(dz) <= alcance && alto < 2.55;
    t.decision = { gk, atajada: alcanzable && Math.random() < prob, atrapa: rap < 19 && Math.abs(dz) < 1.4 && alto < 1.8 };
    if (!t.dentro && Math.random() < 0.5) t.decision.atajada = false;
    if (Math.abs(dz) < 0.8) {
      gk.animador.reproducir(alto > 1.7 ? 'atajarAlto' : 'atajar');
      gk.fijarEstado('accion', 0.6);
    } else {
      gk.animador.reproducir('estirada', { espejo: !haciaIzq, velocidad: 1.15 });
      gk.fijarEstado('estirada', 1.6);
      const desp = clamp(dz, -alcance + 0.8, alcance - 0.8);
      gk.vel.set(0, 0, desp / 0.42);
    }
  }

  revisarAtajada() {
    const t = this.tiroEnCurso;
    const dec = t.decision;
    const b = this.balon;
    const gk = dec.gk;
    if (!dec.atajada || dec.hecho) return;
    // Cuando el balón llega al plano del arquero
    const ax = MITAD_L * t.atacante.dir;
    const dxGk = (gk.pos.x - b.pos.x) * t.atacante.dir;
    const cerca = Math.hypot(b.pos.z - gk.pos.z, b.pos.y - 1) < 2.8;
    if ((dxGk < 0.6 || Math.abs(b.pos.x - ax) < 0.8) && cerca) {
      dec.hecho = true;
      this.tocar(gk);
      if (dec.atrapa) {
        this.atrapar(gk);
      } else {
        const lado = Math.sign(b.pos.z || azar(-1, 1));
        b.patear(new THREE.Vector3(-t.atacante.dir * azar(3, 8), azar(1.5, 4.5), lado * azar(4, 9)));
        sonido.patada(0.5);
      }
      this.tiroEnCurso = null;
      if (this.fase !== 'penales') {
        this.hud.relato(frase('atajada'), 2);
        sonido.rugir('uy');
      } else this.penalResultado = 'atajado';
      this.input.vibrarTodos(0.25, 100);
    }
  }

  saqueArquero(gk, receptor, tipo) {
    if (!receptor) return;
    if (tipo === 'mano') {
      gk.animador.reproducir('saqueBanda', { velocidad: 1.6 });
      gk.fijarEstado('accion', 0.5);
      this.programar(() => {
        if (this.balonSujeto !== gk) return;
        this.balonSujeto = null;
        const b = this.balon;
        const dx = receptor.pos.x - gk.pos.x, dz = receptor.pos.z - gk.pos.z, d = Math.hypot(dx, dz) || 1;
        const v0 = Math.min(18, 6 + d * 0.55);
        b.patear(new THREE.Vector3((dx / d) * v0, 2.5, (dz / d) * v0));
        this.ultimoToque = gk; gk.enfriamiento = 0.4;
        this.receptorPase = receptor;
      }, 340);
    } else {
      // Patea de "bote pronto"
      this.balonSujeto = null;
      this.poseedor = gk;
      const dest = tipo === 'largo' ? { x: gk.equipo.dir * azar(5, 20), z: azar(-15, 15) } : receptor.pos;
      const fant = { pos: new THREE.Vector3(dest.x, 0, dest.z), vel: new THREE.Vector3(), equipo: gk.equipo, controlado: null };
      this.pase(gk, tipo === 'largo' ? fant : receptor, 'alto', 1, 1.2);
      if (tipo === 'largo') this.receptorPase = null;
    }
  }

  // ---------- Reglas ----------
  revisarReglas() {
    const b = this.balon.pos;
    if (this.balonSujeto && this.fase === 'juego') return;
    const L = MITAD_L, A = MITAD_A;
    if (Math.abs(b.x) > L + R) {
      const lado = Math.sign(b.x);
      const dentro = Math.abs(b.z) < CANCHA.anchoArco / 2 - R * 0.5 && b.y < CANCHA.altoArco;
      if (this.fase === 'penales') { this.finPenalTiro(dentro && Math.abs(b.x) < L + 3 ? 'gol' : 'fuera'); return; }
      if (dentro) {
        const anotador = this.equipos.find((e) => e.dir === lado);
        this.anotarGol(anotador);
      } else if (Math.abs(b.x) > L + R + 0.3) {
        const defensor = this.equipos.find((e) => e.dir === -lado);
        const ult = this.ultimoToque;
        if (this.tiroEnCurso || (ult && ult.equipo !== defensor && Math.abs(b.z) < 12)) {
          this.hud.relato(frase(Math.abs(b.z) < 6 && b.y < 4 ? 'fuera' : 'fueraLejos'), 2);
          sonido.rugir('uy');
        }
        if (ult && ult.equipo === defensor) this.prepararPelotaParada('corner', this.equipos[1 - defensor.indice], { x: lado * L, z: Math.sign(b.z) * A });
        else this.prepararPelotaParada('arco', defensor, { x: lado * (L - 5.5), z: Math.sign(b.z || 1) * 4 });
      }
      return;
    }
    if (Math.abs(b.z) > A + R + 0.2) {
      if (this.fase === 'penales') { this.finPenalTiro('fuera'); return; }
      const ult = this.ultimoToque;
      const eq = ult ? this.equipos[1 - ult.equipo.indice] : this.equipos[0];
      this.prepararPelotaParada('banda', eq, { x: clamp(b.x, -L + 1, L - 1), z: Math.sign(b.z) * (A + 0.25) });
    }
  }

  procesarEventos(eventos) {
    const bh = this.balon.col.handle;
    for (const [a, c] of eventos) {
      const otro = a === bh ? c : c === bh ? a : null;
      if (otro === null) continue;
      if (this.fisica.colisionadores.palos.has(otro)) {
        sonido.palo();
        if (this.tiroEnCurso || this.fase === 'penales') {
          this.hud.relato(frase('palo'), 2);
          sonido.rugir('uy');
          this.input.vibrarTodos(0.3, 120);
          if (this.fase === 'penales') this.penalPalo = true;
        }
        this.camaras.sacudir(0.15);
      }
    }
  }

  anotarGol(equipo) {
    const autor = this.ultimoToque;
    const enContra = autor && autor.equipo !== equipo;
    equipo.goles++;
    if (autor && !enContra) autor.goles++;
    const minuto = this.minuto();
    this.goles.push({ equipo: equipo.indice, jugador: autor ? autor.datos.nombre : '—', club: equipo.club.id, minuto, enContra });
    this.cambiarFase('gol');
    this.tiroEnCurso = null;
    this.soltarBalon();
    sonido.red();
    sonido.rugir('gol');
    this.programar(() => sonido.cantar(4), 2500);
    this.hud.relato(enContra ? frase('golPropio') : frase('gol'), 4);
    if (autor && !enContra) this.programar(() => this.hud.relato(`${autor.nombre} ${minuto}'`, 2.5, true), 2200);
    this.input.vibrarTodos(0.9, 500);
    this.camaras.sacudir(0.25);
    this.estadio.actualizarPantalla({ local: this.equipos[0].club, visita: this.equipos[1].club, gl: this.equipos[0].goles, gv: this.equipos[1].goles, minuto, texto: '¡GOOOL!' });
    this.goleador = enContra ? null : autor;
    this.equipoGol = equipo;
    const foco = this.goleador || equipo.jugadores[10];
    this.focoCamara = foco.pos;
    // Celebración: el goleador corre hacia el banderín más cercano
    const esquina = new THREE.Vector3(MITAD_L * equipo.dir * 0.92, 0, Math.sign(foco.pos.z || 1) * MITAD_A * 0.85);
    this.destinoCelebracion = esquina;
    const anims = ['celebrarAvion', 'celebrarBrazos', 'celebrarPuno'];
    for (const j of equipo.jugadores) {
      if (j.expulsado) continue;
      j.fijarEstado('celebrando', -1000);
      j.animador.reproducir(j === foco ? anims[Math.floor(Math.random() * anims.length)] : (Math.random() < 0.5 ? 'celebrarBrazos' : 'aplaudir'));
    }
    for (const j of this.equipos[1 - equipo.indice].jugadores) {
      if (j.expulsado) continue;
      j.fijarEstado('celebrando', -1000);
      if (Math.random() < 0.6) j.animador.reproducir('lamento');
    }
  }

  actualizarGol(dt) {
    const eq = this.equipoGol;
    const foco = this.goleador || eq.jugadores[10];
    const dest = this.destinoCelebracion;
    for (const j of this.todos) {
      if (j.expulsado) continue;
      if (j.equipo === eq) {
        const o = j === foco ? dest : foco.pos;
        const dx = o.x - j.pos.x, dz = o.z - j.pos.z, d = Math.hypot(dx, dz);
        const lim = j === foco ? 1 : 2.2;
        if (d > lim) j.mover(dx, dz, 1, j === foco || d > 6, dt);
        else {
          j.mover(0, 0, 0, false, dt);
          if (j === foco && this.tFase > 2.2 && j.animador.nombreAccion !== 'celebrarRodillas' && Math.random() < 0.01) j.animador.reproducir('celebrarRodillas');
        }
      } else {
        j.mover(0, 0, 0, false, dt);
      }
    }
    if (this.tFase > 1.0 && !this.camaras.cine) this.camaras.iniciarCine('orbitaJugador', { angulo: Math.random() * 6 });
    if (this.camaras.cine) this.camaras.cine.foco = foco.pos;
    this.focoCamara = foco.pos;
    const saltar = this.tFase > 1.5 && (this.input.nav.aceptar || this.input.nav.inicio);
    if (this.tFase > 5.5 || saltar) {
      this.camaras.terminarCine();
      this.iniciarRepeticion();
    }
  }

  iniciarRepeticion() {
    const dur = this.repeticion.duracion();
    if (dur < 2) { this.despuesDelGol(); return; }
    this.cambiarFase('repeticion');
    // Reproducimos los últimos ~6 segundos antes de la celebración
    this.repFin = Math.max(0, dur - 5.4);
    this.repT = Math.max(0, this.repFin - 6);
    this.repInicio = this.repT;
    this.repCorte = 0;
    this.saltarRepeticion = false;
    this.hud.repeticion(true);
    this.lado = this.equipoGol.dir;
    this.camaras.iniciarCine('bajoLateral', { lado: this.lado });
    this.balon.estela.visible = false;
  }

  actualizarRepeticion(dt) {
    const lento = 0.45;
    this.repT += dt * lento;
    this.repeticion.aplicar(this.repT);
    const pb = this.repeticion.posBalon || this.balon.pos;
    // Cortes de cámara cinematográficos
    const prog = (this.repT - this.repInicio) / Math.max(0.1, this.repFin - this.repInicio);
    const corte = prog < 0.35 ? 'bajoLateral' : prog < 0.7 ? 'altaGol' : 'detrasArco';
    if (this.camaras.cine?.tipo !== corte) this.camaras.iniciarCine(corte, { lado: this.lado, corte: true });
    this.camaras.actualizar(dt, { balon: pb });
    if (this.repT >= this.repFin || this.saltarRepeticion || (this.tFase > 0.5 && (this.input.nav.aceptar || this.input.nav.inicio))) {
      this.hud.repeticion(false);
      this.camaras.terminarCine();
      this.despuesDelGol();
    }
  }

  despuesDelGol() {
    for (const j of this.todos) { j.animador.detener(); j.fijarEstado('libre'); j.grupo.visible = !j.expulsado; }
    for (const a of [this.arbitro, ...this.jueces]) a.grupo.visible = true;
    this.focoCamara = null;
    const concede = this.equipos[1 - this.equipoGol.indice];
    this.prepararSaqueInicial(concede.indice, true);
  }

  // ---------- Faltas, tarjetas y fuera de juego ----------
  cobrarFalta(infractor, victima, gravedad) {
    if (this.fase !== 'juego') return;
    sonido.silbato('corto');
    infractor.equipo.estad.faltas++;
    this.arbitro.animador.reproducir('silbar');
    const p = victima.pos.clone();
    const eqV = victima.equipo;
    const areaInfractor = Math.abs(p.x - (-MITAD_L * infractor.equipo.dir)) < CANCHA.areaGrande.largo && Math.abs(p.z) < CANCHA.areaGrande.ancho / 2;
    // Tarjetas
    let tarjeta = null;
    const r = Math.random();
    if (gravedad > 0.8 && r < 0.12 && !infractor.esArquero) tarjeta = 'roja';
    else if (gravedad > 0.55 && r < 0.65) tarjeta = 'amarilla';
    else if (gravedad > 0.3 && r < 0.12) tarjeta = 'amarilla';
    if (areaInfractor) {
      this.hud.relato(frase('penal'), 2.5);
      sonido.rugir('gol');
    } else this.hud.relato(frase('falta'), 1.8, true);
    if (tarjeta) this.programar(() => this.mostrarTarjeta(infractor, tarjeta), 900);
    if (victima.controlado) this.input.vibrar(victima.controlado.disp, 0.6, 220);
    sonido.rugir(eqV === this.equipos[0] ? 'abucheo' : 'aplauso');
    if (areaInfractor) this.prepararPelotaParada('penal', eqV, { x: MITAD_L * eqV.dir - CANCHA.puntoPenal * eqV.dir, z: 0 });
    else this.prepararPelotaParada('libre', eqV, { x: clamp(p.x, -MITAD_L + 1, MITAD_L - 1), z: clamp(p.z, -MITAD_A + 1, MITAD_A - 1) });
  }

  mostrarTarjeta(j, tipo) {
    if (tipo === 'amarilla') {
      j.amarillas++;
      j.equipo.estad.amarillas++;
      if (j.amarillas >= 2) tipo = 'roja2';
    }
    this.tarjeta.material.color.set(tipo === 'amarilla' ? 0xffd400 : 0xe00000);
    this.tarjeta.visible = true;
    this.arbitro.animador.reproducir('tarjeta');
    this.arbitro.mirarHacia(j.pos.x, j.pos.z);
    this.programar(() => { this.tarjeta.visible = false; }, 2100);
    const nombre = `${j.nombre} (${j.equipo.club.corto})`;
    if (tipo === 'amarilla') this.hud.relato(`🟨 ${frase('amarilla')} ${nombre}`, 2.5, true);
    else {
      this.hud.relato(`🟥 ${frase('roja')} ${nombre}`, 3, true);
      j.equipo.estad.rojas++;
      this.programar(() => this.expulsar(j), 1500);
    }
  }

  expulsar(j) {
    j.expulsado = true;
    j.grupo.visible = false;
    if (j.cuerpo) j.cuerpo.setNextKinematicTranslation({ x: 0, y: -10, z: 0 });
    if (this.poseedor === j) this.poseedor = null;
    if (j.controlado) { const c = j.controlado; c.asignar(null); c.cambiarJugador(true); }
  }

  cobrarOffside(j) {
    sonido.silbato('corto');
    j.equipo.estad.offsides++;
    this.hud.relato(frase('offside'), 2, true);
    // El juez de línea levanta la bandera
    const juez = this.jueces.reduce((a, b) => (a.pos.distanceTo(j.pos) < b.pos.distanceTo(j.pos) ? a : b));
    juez.animador.reproducir('tarjeta');
    const def = this.equipos[1 - j.equipo.indice];
    this.prepararPelotaParada('libre', def, { x: clamp(j.pos.x, -MITAD_L + 2, MITAD_L - 2), z: clamp(j.pos.z, -MITAD_A + 1, MITAD_A - 1) }, true);
  }

  // ---------- Pelotas paradas ----------
  prepararSaqueInicial(equipoIdx, tras = false) {
    this.soltarBalon();
    this.tiroEnCurso = null;
    this.offside = null;
    this.receptorPase = null;
    this.balon.colocar(0, R, 0);
    const eq = this.equipos[equipoIdx];
    const posiciones = new Map();
    for (const e of this.equipos) {
      const f = FORMACIONES[e.formacion];
      e.jugadores.forEach((j, k) => {
        const xn = Math.min(f[k].x * 0.9, 0.46);
        let x = (xn * 2 * MITAD_L - MITAD_L) * e.dir;
        let z = f[k].z * (MITAD_A - 4) * e.dir;
        if (e !== eq && Math.hypot(x, z) < CANCHA.radioCirculo + 0.5) { const a = Math.atan2(z, x); x = Math.cos(a) * 10; z = Math.sin(a) * 10; }
        posiciones.set(j, new THREE.Vector3(x, 0, z));
      });
    }
    // Dos jugadores del equipo que saca en el círculo central
    const dels = eq.jugadores.filter((j) => !j.expulsado && (j.rol === 'DEL' || j.rol === 'VOL')).slice(-2);
    const ejecutor = dels[0] || eq.jugadores[10];
    posiciones.set(ejecutor, new THREE.Vector3(-eq.dir * 0.5, 0, 0));
    if (dels[1]) posiciones.set(dels[1], new THREE.Vector3(-eq.dir * 6, 0, 3));
    this.iniciarDetenido('saque', eq, ejecutor, posiciones, tras ? 1.2 : 0.6, { x: 0, z: 0 });
    if (!tras) {
      this.hud.relato(this.mitad === 1 ? frase('inicio') : 'Comienza el segundo tiempo', 2);
    }
  }

  prepararPelotaParada(tipo, equipo, punto, esOffside = false) {
    const rival = this.equipos[1 - equipo.indice];
    this.soltarBalon();
    this.tiroEnCurso = null;
    this.offside = null;
    this.receptorPase = null;
    const dir = equipo.dir;
    const posiciones = new Map();
    let ejecutor;
    const disponibles = equipo.jugadores.filter((j) => !j.expulsado && !j.esArquero);
    const masCercano = (lista, p) => lista.reduce((a, b) => (Math.hypot(a.pos.x - p.x, a.pos.z - p.z) < Math.hypot(b.pos.x - p.x, b.pos.z - p.z) ? a : b));
    const tactica = (j) => j.equipo.ia.posicionTactica(j, new THREE.Vector3());
    // Simular el balón en el punto para calcular las posiciones tácticas
    this.balon.colocar(punto.x, R, punto.z);
    this.equipoEnPosesion = equipo;
    for (const e of this.equipos) for (const j of e.jugadores) if (!j.expulsado) posiciones.set(j, j.esArquero ? new THREE.Vector3(-MITAD_L * e.dir + e.dir * 1.2, 0, 0) : tactica(j));
    switch (tipo) {
      case 'banda':
        ejecutor = masCercano(disponibles, punto);
        posiciones.set(ejecutor, new THREE.Vector3(punto.x, 0, punto.z));
        this.hud.relato('Saque de banda', 1.2, true);
        break;
      case 'corner': {
        equipo.estad.corners++;
        const cx = punto.x, cz = punto.z;
        ejecutor = disponibles.slice().sort((a, b) => b.at.pase - a.at.pase)[0];
        posiciones.set(ejecutor, new THREE.Vector3(cx + Math.sign(cx) * 0.4, 0, cz + Math.sign(cz) * 0.4));
        const ax = MITAD_L * dir;
        const atacantes = disponibles.filter((j) => j !== ejecutor).sort((a, b) => (b.rol === 'DEF' ? 0.5 : 0) + b.at.fisico - ((a.rol === 'DEF' ? 0.5 : 0) + a.at.fisico)).slice(0, 6);
        const spots = [[-6, -3], [-8, 2], [-11, 0], [-5, 4], [-13, -5], [-20, 0]];
        atacantes.forEach((j, i) => posiciones.set(j, new THREE.Vector3(ax - dir * Math.abs(spots[i][0]), 0, spots[i][1] * Math.sign(cz || 1))));
        const defensores = rival.jugadores.filter((j) => !j.expulsado && !j.esArquero);
        defensores.slice(0, 8).forEach((j, i) => {
          const m = atacantes[i % atacantes.length];
          const pm = posiciones.get(m);
          posiciones.set(j, new THREE.Vector3(pm.x + dir * 0.9, 0, pm.z + (i % 2 ? 0.6 : -0.6)));
        });
        this.hud.relato(frase('corner'), 1.5, true);
        sonido.fijarEmocion(0.6);
        break;
      }
      case 'arco': {
        ejecutor = equipo.jugadores[0];
        posiciones.set(ejecutor, new THREE.Vector3(punto.x, 0, punto.z));
        for (const j of rival.jugadores) {
          const pj = posiciones.get(j);
          if (pj && Math.abs(pj.x - (-MITAD_L * dir)) < CANCHA.areaGrande.largo + 1) pj.x = -MITAD_L * dir + dir * (CANCHA.areaGrande.largo + 2);
        }
        this.hud.relato('Saque de arco', 1.2, true);
        break;
      }
      case 'libre': {
        ejecutor = disponibles.slice().sort((a, b) => Math.hypot(a.pos.x - punto.x, a.pos.z - punto.z) - Math.hypot(b.pos.x - punto.x, b.pos.z - punto.z)).slice(0, 3)
          .sort((a, b) => b.at.tiro + b.at.pase - (a.at.tiro + a.at.pase))[0];
        const gx = MITAD_L * dir;
        const dGol = Math.hypot(gx - punto.x, punto.z);
        const ux = (punto.x - gx) / dGol, uz = punto.z / dGol;
        posiciones.set(ejecutor, new THREE.Vector3(punto.x + ux * 1.2, 0, punto.z + uz * 1.2));
        // Barrera
        if (dGol < 33 && !esOffside) {
          const nb = dGol < 22 ? 4 : 3;
          const bx = punto.x - ux * 9.15, bz = punto.z - uz * 9.15;
          const barrera = rival.jugadores.filter((j) => !j.expulsado && !j.esArquero).sort((a, b) => b.rol.localeCompare(a.rol)).slice(0, nb);
          barrera.forEach((j, i) => {
            const o = (i - (nb - 1) / 2) * 0.62;
            posiciones.set(j, new THREE.Vector3(bx + -uz * o, 0, bz + ux * o));
          });
          this.barrera = barrera;
        }
        // Nadie del rival a menos de 9,15 m
        for (const j of rival.jugadores) {
          const pj = posiciones.get(j);
          if (!pj || this.barrera?.includes(j) || j.esArquero) continue;
          const d = Math.hypot(pj.x - punto.x, pj.z - punto.z);
          if (d < 9.5) { pj.x = punto.x + (pj.x - punto.x) / (d || 1) * 9.6; pj.z = punto.z + (pj.z - punto.z) / (d || 1) * 9.6; }
        }
        break;
      }
      case 'penal': {
        ejecutor = disponibles.slice().sort((a, b) => b.at.tiro - a.at.tiro)[0];
        const sx = punto.x;
        posiciones.set(ejecutor, new THREE.Vector3(sx - dir * 1.6, 0, 0));
        const gkR = rival.jugadores[0];
        posiciones.set(gkR, new THREE.Vector3(MITAD_L * dir - dir * 0.3, 0, 0));
        for (const e of this.equipos) for (const j of e.jugadores) {
          if (j === ejecutor || j === gkR || j.esArquero || j.expulsado) continue;
          const pj = posiciones.get(j);
          const lim = MITAD_L - CANCHA.areaGrande.largo - 1.5;
          if (pj.x * dir > lim) pj.x = lim * dir - dir * azar(0, 4);
          pj.z = clamp(pj.z, -18, 18);
        }
        this.penalEnJuego = true;
        break;
      }
      default: break;
    }
    if (tipo !== 'libre') this.barrera = null;
    this.iniciarDetenido(tipo, equipo, ejecutor, posiciones, tipo === 'banda' ? 0.9 : 1.8, punto);
  }

  iniciarDetenido(tipo, equipo, ejecutor, posiciones, espera, punto) {
    this.cambiarFase('detenido');
    this.tipoParada = tipo;
    this.equipoSaca = equipo;
    this.ejecutorPelotaParada = ejecutor;
    this.posicionesPP = posiciones;
    this.esperaPP = espera;
    this.puntoPP = punto;
    this.listoParaSacar = false;
    this.tIA = azar(0.9, 1.6);
    this.equipoEnPosesion = equipo;
    this.balon.colocar(punto.x, R, punto.z);
    for (const j of this.todos) {
      if (j.estado !== 'libre') { j.fijarEstado('libre'); j.animador.detener(); }
      j.pendiente = null;
    }
    // El humano controla al ejecutor si es de su equipo (excepto el arquero en saque de arco, lo hace la IA)
    const ctrl = this.controles.find((c) => c.equipo === equipo);
    if (ctrl && !(ejecutor.esArquero && tipo === 'arco')) ctrl.asignar(ejecutor);
    if (tipo === 'banda') { this.balonSujeto = ejecutor; ejecutor.animador.reproducir('sostenerBanda'); }
  }

  actualizarPelotaParada(dt) {
    const pos = this.posicionesPP;
    let todosListos = true;
    const t = this.tFase;
    for (const j of this.todos) {
      if (j.expulsado) continue;
      const o = pos.get(j);
      if (!o) continue;
      const dx = o.x - j.pos.x, dz = o.z - j.pos.z, d = Math.hypot(dx, dz);
      const esEjecutorHumano = j === this.ejecutorPelotaParada && j.controlado && this.listoParaSacar;
      if (j.controlado && j !== this.ejecutorPelotaParada && this.listoParaSacar) continue; // el humano mueve a su jugador
      if (esEjecutorHumano) continue;
      if (d > 0.4) {
        todosListos = todosListos && d < 1.5;
        j.multVel = 1.25;
        j.mover(dx, dz, Math.min(1, d / 2), d > 3, dt);
      } else j.mover(0, 0, 0, false, dt);
      // mirar el balón
      j.mirarA = this.balon.pos;
      if (j === this.ejecutorPelotaParada && d < 0.5) {
        j.mirarA = this.tipoParada === 'banda' || this.tipoParada === 'arco' || this.tipoParada === 'saque'
          ? tmp.set(j.pos.x + j.equipo.dir * 5, 0, j.pos.z * 0.6) : tmp.set(MITAD_L * j.equipo.dir, 0, 0);
      }
    }
    if (!this.listoParaSacar && (t > this.esperaPP + 1.6 || (t > this.esperaPP && todosListos))) {
      // Ubicar a los rezagados de inmediato
      for (const j of this.todos) {
        const o = pos.get(j);
        if (!o || j.expulsado) continue;
        if (j.pos.distanceTo(o) > 1.2) j.colocar(o.x, o.z);
        j.multVel = 1;
      }
      const ej = this.ejecutorPelotaParada;
      if (this.tipoParada === 'banda') { this.balonSujeto = ej; ej.animador.reproducir('sostenerBanda'); }
      else this.balon.colocar(this.puntoPP.x, R, this.puntoPP.z);
      this.listoParaSacar = true;
      if (this.tipoParada !== 'banda') {
        const p = this.puntoPP;
        // el ejecutor queda justo detrás del balón
        const objetivo = this.tipoParada === 'libre' || this.tipoParada === 'penal' ? tmp2.set(MITAD_L * ej.equipo.dir, 0, 0) : tmp2.set(ej.equipo.dir * 20 + p.x * 0.5, 0, p.z * 0.4);
        const dx = objetivo.x - p.x, dz = objetivo.z - p.z, dd = Math.hypot(dx, dz) || 1;
        ej.colocar(p.x - (dx / dd) * 0.75, p.z - (dz / dd) * 0.75);
        ej.mirarHacia(p.x, p.z);
      }
      if (this.tipoParada === 'saque') sonido.silbato('corto');
      if (this.tipoParada === 'penal') sonido.silbato('corto');
      if (ej.controlado) this.hud.relato(this.ayudaPelotaParada(ej.controlado), 2.5, true);
    }
    // IA ejecuta
    if (this.listoParaSacar && !this.ejecutorPelotaParada.controlado) {
      this.tIA -= dt;
      if (this.tIA <= 0 && !this.ejecutorPelotaParada.pendiente) this.ejecutarIAPelotaParada();
    }
  }

  ayudaPelotaParada(c) {
    const e = (a) => this.input.etiqueta(c.disp, a);
    switch (this.tipoParada) {
      case 'banda': return `${e('pase')} saque corto · ${e('paseLargo')} saque largo`;
      case 'corner': return `${e('paseLargo')} centro · ${e('pase')} corto`;
      case 'libre': return `${e('tiro')} tiro · ${e('pase')} pase · ${e('paseLargo')} centro`;
      case 'penal': return `Apunta con el stick y ${e('tiro')} para patear`;
      default: return `${e('pase')} para sacar`;
    }
  }

  ejecutarIAPelotaParada() {
    const j = this.ejecutorPelotaParada;
    const eq = j.equipo;
    const ia = eq.ia;
    const dir = eq.dir;
    switch (this.tipoParada) {
      case 'saque': {
        const comp = eq.jugadores.filter((c) => c !== j && !c.expulsado && c.pos.x * dir < 0).sort((a, b) => a.pos.distanceTo(j.pos) - b.pos.distanceTo(j.pos))[0];
        this.pase(j, comp, 'raso');
        break;
      }
      case 'banda': {
        const op = eq.jugadores.filter((c) => c !== j && !c.expulsado && c.pos.distanceTo(j.pos) < 22 && !c.esArquero)
          .sort((a, b) => (this.rivalMasCercano(b)?.d || 9) - b.pos.distanceTo(j.pos) * 0.15 - ((this.rivalMasCercano(a)?.d || 9) - a.pos.distanceTo(j.pos) * 0.15))[0];
        this.lanzarBanda(j, op);
        break;
      }
      case 'corner': {
        const ax = MITAD_L * dir;
        this.centro(j, new THREE.Vector3(ax - dir * azar(5, 12), 0, azar(-5, 5)), ia.dif.errorPase);
        break;
      }
      case 'arco': {
        const largo = Math.random() < 0.55;
        if (largo) this.paseAPunto(j, { x: dir * azar(0, 15), z: azar(-20, 20) }, 'alto');
        else {
          const def = eq.jugadores.filter((c) => c.rol === 'DEF' && !c.expulsado).sort(() => Math.random() - 0.5)[0];
          this.pase(j, def, 'raso');
        }
        break;
      }
      case 'libre': {
        const gx = MITAD_L * dir;
        const dGol = Math.hypot(gx - j.pos.x, j.pos.z);
        if (dGol < 30 && Math.random() < 0.7) {
          this.tiro(j, azar(0.65, 0.9), { z: (Math.random() < 0.5 ? -1 : 1) * azar(2, 3.2), alto: azar(0.4, 0.85), errorExtra: ia.dif.errorTiro });
        } else {
          const op = ia.mejorPase(j);
          if (op) this.pase(j, op.j, op.tipo === 'filtrado' ? 'raso' : op.tipo, null, ia.dif.errorPase);
          else this.despeje(j);
        }
        break;
      }
      case 'penal': {
        const z = (Math.random() < 0.5 ? -1 : 1) * azar(1.5, 3.2);
        this.tiro(j, azar(0.65, 0.85), { z, alto: azar(0.05, 0.7), errorExtra: ia.dif.errorTiro * 0.6 });
        break;
      }
      default: break;
    }
  }

  // Saque de banda (con las manos)
  lanzarBanda(j, receptor, largo = false) {
    if (this.balonSujeto !== j) return;
    j.animador.reproducir('saqueBanda');
    j.fijarEstado('accion', 0.8);
    this.marcarOffside(j.equipo, j);
    this.offside = null; // en saque de banda no hay fuera de juego
    this.programar(() => {
      if (this.balonSujeto !== j) return;
      this.balonSujeto = null;
      this.ultimoToque = j;
      j.enfriamiento = 0.5;
      const b = this.balon;
      let tx, tz;
      if (receptor) { tx = receptor.pos.x + receptor.vel.x * 0.5; tz = receptor.pos.z + receptor.vel.z * 0.5; this.receptorPase = receptor; }
      else { const f = j.adelante; tx = j.pos.x + f.x * (largo ? 25 : 12); tz = j.pos.z + f.z * (largo ? 25 : 12); }
      const d = Math.hypot(tx - b.pos.x, tz - b.pos.z);
      const v = this.velElevada(b.pos, tx, tz, clamp(1 + d * 0.1, 1.5, largo ? 5 : 3));
      b.patear(v);
      if (receptor?.equipo.indice !== undefined && this.controles.some((c) => c.equipo === j.equipo) && receptor && !receptor.controlado) {
        const c = this.controles.find((cc) => cc.equipo === j.equipo && cc.jugador === j);
        c?.asignar(receptor);
      }
      this.reanudar();
    }, 500);
  }

  reanudar() {
    if (this.fase === 'detenido') {
      this.cambiarFase('juego');
      this.ejecutorPelotaParada = null;
      this.listoParaSacar = false;
      this.barrera = null;
      if (this.penalEnJuego) {
        this.penalEnJuego = false;
      }
    }
  }

  // ---------- Árbitro y jueces de línea ----------
  moverArbitros(dt) {
    const b = this.balon.pos;
    const a = this.arbitro;
    if (this.fase === 'juego' || this.fase === 'detenido' || this.fase === 'gol') {
      // Diagonal: el árbitro se mantiene a ~12 m del balón, hacia el lado de las bancas
      const tx = clamp(b.x - Math.sign(b.x || 1) * 8, -MITAD_L + 12, MITAD_L - 12);
      const tz = clamp(b.z + (b.z > 0 ? -10 : 10) * 0.8, -MITAD_A + 6, MITAD_A - 6);
      const dx = tx - a.pos.x, dz = tz - a.pos.z, d = Math.hypot(dx, dz);
      a.mover(dx, dz, clamp(d / 6, 0, 1), d > 10, dt);
      a.mirarA = b;
      // Jueces: siguen la línea del penúltimo defensor en su mitad
      const [j1, j2] = this.jueces;
      const defIzq = this.equipos.find((e) => e.dir === 1); // defiende x<0
      const defDer = this.equipos.find((e) => e.dir === -1);
      const x1 = Math.min(this.lineaOffside(defIzq), b.x < 0 ? b.x : 0);
      const x2 = Math.max(this.lineaOffside(defDer), b.x > 0 ? b.x : 0);
      for (const [j, x, z] of [[j1, clamp(x1, -MITAD_L, 0), -MITAD_A - 1.6], [j2, clamp(x2, 0, MITAD_L), MITAD_A + 1.6]]) {
        const dx2 = x - j.pos.x, dz2 = z - j.pos.z;
        const d2 = Math.hypot(dx2, dz2);
        j.mover(dx2, dz2, clamp(d2 / 3, 0, 1), d2 > 6, dt);
        j.mirarA = b;
      }
    } else {
      for (const r of [a, ...this.jueces]) r.mover(0, 0, 0, false, dt);
    }
    for (const r of [a, ...this.jueces]) r.actualizar(dt);
  }

  // Separación entre jugadores para que no se atraviesen
  separar() {
    const js = this.todos;
    for (let i = 0; i < js.length; i++) {
      const a = js[i];
      if (a.expulsado) continue;
      for (let k = i + 1; k < js.length; k++) {
        const b = js[k];
        if (b.expulsado) continue;
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < 0.5 && d2 > 1e-6) {
          const d = Math.sqrt(d2), em = (0.71 - d) * 0.5;
          const fa = a.at.fisico / (a.at.fisico + b.at.fisico);
          a.pos.x -= (dx / d) * em * (1 - fa) * 2; a.pos.z -= (dz / d) * em * (1 - fa) * 2;
          b.pos.x += (dx / d) * em * fa * 2; b.pos.z += (dz / d) * em * fa * 2;
        }
      }
    }
  }

  // ---------- Predicción del balón y tiempos de intercepción (para la IA) ----------
  predecir() {
    const pred = this.prediccion;
    const b = this.balon;
    const h = 0.075;
    if (this.poseedor || this.balonSujeto) {
      const o = this.poseedor || this.balonSujeto;
      for (const p of pred) p.set(o.pos.x, R, o.pos.z);
    } else {
      const p = b.pos.clone(), v = b.vel.clone();
      for (let i = 0; i < pred.length; i++) {
        pred[i].copy(p);
        const vel = v.length();
        v.addScaledVector(v, -0.011 * vel * h);
        if (p.y <= R + 0.03 && Math.abs(v.y) < 1) {
          const hv = Math.hypot(v.x, v.z);
          if (hv > 0.05) { const f = Math.min((0.9 + 0.12 * hv) * h, hv) / hv; v.x -= v.x * f; v.z -= v.z * f; }
          v.y = 0;
        } else v.y -= G * h;
        p.addScaledVector(v, h);
        if (p.y < R) { p.y = R; v.y = Math.abs(v.y) * 0.45; }
      }
    }
    for (const j of this.todos) {
      if (j.expulsado) { j.tInter = 99; continue; }
      const vmax = j.velMax * 0.92;
      const reac = j.controlado ? 0.1 : 0.2;
      let encontrado = false;
      for (let i = 0; i < pred.length; i++) {
        const p = pred[i];
        const t = i * h;
        if (p.y > (j.esArquero ? 2.6 : 2.2)) continue;
        const d = Math.max(0, Math.hypot(p.x - j.pos.x, p.z - j.pos.z) - 0.6);
        if (d / vmax + reac <= t) {
          j.tInter = t; j.puntoInter = j.puntoInter || new THREE.Vector3(); j.puntoInter.copy(p);
          encontrado = true; break;
        }
      }
      if (!encontrado) {
        const p = pred[pred.length - 1];
        j.tInter = 3 + Math.hypot(p.x - j.pos.x, p.z - j.pos.z) / vmax;
        j.puntoInter = j.puntoInter || new THREE.Vector3(); j.puntoInter.copy(p);
      }
    }
    // Avanza la cuenta regresiva del tiro en curso
    if (this.tiroEnCurso) {
      this.tiroEnCurso.tRestante = this.tiroEnCurso.tTotal - (performance.now() - this.tiroEnCurso.t0) / 1000 * this.velocidadJuego;
      if (this.tiroEnCurso.tRestante < -1.5) this.tiroEnCurso = null;
    }
  }

  // ---------- Tanda de penales ----------
  iniciarPenales() {
    this.penales = { turno: 0, tiradas: [[], []], ronda: 0, terminado: false };
    for (const eq of this.equipos) eq.penales = 0;
    // Orden de pateadores: mejores tiradores primero
    for (const eq of this.equipos) {
      eq.ordenPenales = eq.jugadores.filter((j) => !j.expulsado && !j.esArquero).sort((a, b) => b.at.tiro - a.at.tiro);
    }
    this.cambiarFase('penales');
    this.hud.relato('¡Tanda de penales!', 2.5);
    this.prepararPenal();
  }

  prepararPenal() {
    const pe = this.penales;
    const eq = this.equipos[pe.turno];
    const rival = this.equipos[1 - pe.turno];
    const lado = 1; // siempre al arco de x>0 (como en la vida real: un solo arco)
    const ax = MITAD_L * lado;
    const n = pe.tiradas[pe.turno].length;
    const pateador = eq.ordenPenales[n % eq.ordenPenales.length];
    const gk = rival.jugadores[0];
    this.penalPateador = pateador;
    this.penalArquero = gk;
    this.penalResultado = null;
    this.penalPalo = false;
    this.penalT = 0;
    this.penalPateado = false;
    this.soltarBalon();
    this.tiroEnCurso = null;
    const spot = ax - CANCHA.puntoPenal;
    this.balon.colocar(spot, R, 0);
    // dirección temporal para que tiro() apunte a este arco
    this.dirOriginal = this.dirOriginal || this.equipos.map((e) => e.dir);
    eq.dir = lado; rival.dir = -lado;
    for (const e of this.equipos) {
      e.jugadores.forEach((j, k) => {
        j.fijarEstado('libre'); j.animador.detener(); j.pendiente = null;
        if (j.expulsado) return;
        if (j === pateador) j.colocar(spot - 1.8, 0, Math.PI / 2);
        else if (j === gk) j.colocar(ax - 0.2, 0, -Math.PI / 2);
        else if (j.esArquero) j.colocar(ax - 20, e.indice ? 8 : -8, Math.PI / 2);
        else j.colocar(-2 + (k % 5) * 0.9 * (e.indice ? 1 : -1) + (e.indice ? 3 : -3) * 0, (e.indice ? 2 : -2) + Math.floor(k / 5) * 1.2 * (e.indice ? 1 : -1), Math.PI / 2);
      });
    }
    this.arbitro.colocar(ax - 13, 6, -Math.PI / 2);
    // Control humano
    for (const c of this.controles) c.asignar(null);
    const ctrlP = this.controles.find((c) => c.equipo === eq);
    const ctrlA = this.controles.find((c) => c.equipo === rival);
    if (ctrlP) ctrlP.asignar(pateador);
    if (ctrlA) ctrlA.asignar(gk);
    this.penalCtrlP = ctrlP; this.penalCtrlA = ctrlA;
    this.camaras.iniciarCine('fijo', { pos: new THREE.Vector3(spot - 9, 2.6, -2.5), mira: new THREE.Vector3(ax, 1.1, 0), fov: 40, corte: true });
    const tabla = this.textoPenales();
    this.hud.banner(`${tabla}<small>Patea: ${pateador.nombre} (${eq.club.corto})${ctrlP ? ` · Apunta con el stick y mantén ${this.input.etiqueta(ctrlP.disp, 'tiro')}` : ''}${ctrlA ? ' · Tú atajas: elige el lado con el stick antes del remate' : ''}</small>`, true);
    this.carga = null;
  }

  textoPenales() {
    const pe = this.penales;
    const f = (i) => pe.tiradas[i].map((r) => (r ? '●' : '○')).join(' ') || '—';
    const [a, b] = this.equipos;
    return `<span style="font-size:20px">${a.club.iniciales} ${a.penales} &nbsp; ${f(0)}<br>${b.club.iniciales} ${b.penales} &nbsp; ${f(1)}</span>`;
  }

  actualizarPenales(dt) {
    const pe = this.penales;
    if (pe.terminado) return;
    this.penalT += dt;
    const pat = this.penalPateador, gk = this.penalArquero;
    const ax = MITAD_L;
    gk.guardia = 1;
    gk.mirarA = this.balon.pos;
    for (const j of this.todos) if (j !== pat && j !== gk) j.mover(0, 0, 0, false, dt);
    // Arquero humano: elige lado
    const cA = this.penalCtrlA;
    if (cA && !this.penalPateado) {
      const d = cA.disp;
      const dir = cA.direccion(d.mx, d.my);
      this.ladoHumanoArquero = Math.abs(dir.z) > 0.4 ? Math.sign(dir.z) : 0;
      gk.mover(0, 0, 0, false, dt);
    } else if (!this.penalPateado) gk.mover(0, 0, 0, false, dt);
    if (!this.penalPateado) {
      pat.mover(0, 0, 0, false, dt);
      const cP = this.penalCtrlP;
      if (cP && this.penalT > 0.6) {
        const d = cP.disp;
        const dir = cP.direccion(d.mx, d.my);
        this.apunteZ = clamp(dir.z * 3.1, -3.1, 3.1);
        this.apunteY = clamp(0.35 + dir.x * 0.6, 0, 1); // stick hacia el arco = más alto
        if (d.presionado('tiro')) this.carga = 0;
        if (this.carga !== null && this.carga !== undefined) {
          this.carga += dt;
          this.hud.potencia(Math.min(1, this.carga / 0.9));
          if (!d.mantenido('tiro') || this.carga > 1.1) {
            const pot = clamp(this.carga / 0.9, 0.3, 1);
            this.carga = null;
            this.hud.potencia(null);
            this.patearPenal(pot, this.apunteZ, clamp(this.apunteY + (pot - 0.6) * 0.5, 0, 1), true);
          }
        }
      } else if (!cP && this.penalT > 1.8) {
        const z = (Math.random() < 0.5 ? -1 : 1) * azar(0.8, 3.3);
        this.patearPenal(azar(0.6, 0.9), z, azar(0, 0.75), false);
      }
    } else {
      // Esperar resultado
      if (!this.penalResultado && this.penalT > 4) this.finPenalTiro(this.penalResultado || 'fuera');
      if (this.penalResultado && !this._penalCerrando) {
        this._penalCerrando = true;
        this.programar(() => { this._penalCerrando = false; this.siguientePenal(); }, 1800);
      }
    }
    void ax;
  }

  patearPenal(pot, z, alto, humano) {
    const pat = this.penalPateador;
    this.penalPateado = true;
    this.penalT = 0;
    pat.colocar(this.balon.pos.x - 0.7, 0, Math.PI / 2);
    this.poseedor = pat;
    this.equipoEnPosesion = pat.equipo;
    this.tiro(pat, pot, { z, alto, humano, errorExtra: humano ? 0.6 : 0.7 });
    // El arquero se lanza al momento de la patada
    this.programar(() => {
      const gk = this.penalArquero;
      let lado;
      if (this.penalCtrlA) lado = this.ladoHumanoArquero || 0;
      else {
        const leer = gk.equipo.ia.dif.arquero * 0.35;
        lado = Math.random() < leer ? Math.sign(z) : [-1, 0, 1, 1, -1][Math.floor(Math.random() * 5)];
      }
      const t = this.tiroEnCurso;
      if (!t) return;
      // Si eligió el lado correcto, la atajada depende de la colocación del tiro
      const acierta = lado !== 0 ? Math.sign(t.z) === lado : Math.abs(t.z) < 1.2;
      t.reaccionado = true;
      const zFalso = lado === 0 ? 0 : lado * 2.2;
      const tReal = { ...t, z: acierta ? t.z : zFalso };
      this.reaccionArquero(gk, tReal);
      t.decision = tReal.decision;
      if (!acierta) t.decision.atajada = false;
      else t.decision.atajada = Math.random() < clamp(0.55 - Math.abs(t.z) * 0.1 - (t.y > 1.6 ? 0.2 : 0) + gk.at.arquero / 400, 0.1, 0.75);
      if (!t.dentro) t.decision.atajada = false;
    }, 210);
  }

  finPenalTiro(res) {
    if (this.penalResultado) return;
    if (res === 'gol' && this.penalPateado) {
      this.penalResultado = 'gol';
      sonido.red();
    } else this.penalResultado = res;
  }

  siguientePenal() {
    const pe = this.penales;
    if (!pe || pe.terminado) return;
    const eq = this.equipos[pe.turno];
    const anotado = this.penalResultado === 'gol';
    pe.tiradas[pe.turno].push(anotado);
    if (anotado) { eq.penales++; this.hud.relato(frase('penalGol'), 2); sonido.rugir('gol'); this.input.vibrarTodos(0.5, 200); }
    else if (this.penalResultado === 'atajado') { this.hud.relato(frase('penalAtajado'), 2); sonido.rugir('ocasion'); }
    else { this.hud.relato(frase('penalFuera'), 2); sonido.rugir('uy'); }
    // ¿Se decidió?
    const [a, b] = this.equipos;
    const na = pe.tiradas[0].length, nb = pe.tiradas[1].length;
    const restA = Math.max(0, 5 - na), restB = Math.max(0, 5 - nb);
    let fin = false;
    if (na <= 5 && nb <= 5) {
      if (a.penales > b.penales + restB || b.penales > a.penales + restA) fin = true;
      if (na === 5 && nb === 5 && a.penales !== b.penales) fin = true;
    } else if (na === nb && a.penales !== b.penales) fin = true;
    if (fin) {
      pe.terminado = true;
      this.hud.banner(this.textoPenales(), true);
      this.programar(() => {
        if (this.dirOriginal) this.equipos.forEach((e, i) => { e.dir = this.dirOriginal[i]; });
        this.camaras.terminarCine();
        this.terminarPartido();
      }, 2200);
      return;
    }
    pe.turno = 1 - pe.turno;
    this.prepararPenal();
  }
}
