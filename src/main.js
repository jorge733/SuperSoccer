// SuperSoccer: arranque, pantalla de carga, bucle principal y flujo entre menús y partidos.
import * as THREE from 'three';
import { Render } from './core/render.js';
import { detectarCalidad, MonitorFps, NIVELES, ORDEN_CALIDAD } from './core/calidad.js';
import { ajustes } from './core/ajustes.js';
import { Controles } from './core/controles.js';
import { iniciarFisica, MundoFisico } from './world/fisica.js';
import { Balon } from './world/balon.js';
import { Estadio } from './world/estadio.js';
import { Publico } from './world/publico.js';
import { Ambiente } from './world/ambiente.js';
import { Camaras } from './game/camaras.js';
import { Partido } from './game/partido.js';
import { Jugador } from './game/jugador.js';
import { cargarModelosRealistas } from './players/realista.js';
import { Hud, aviso } from './ui/hud.js';
import { Menus } from './ui/menus.js';
import { sonido } from './audio/sonido.js';
import datosClubes from './data/clubes.json';

const barra = document.getElementById('carga-barra');
const textoCarga = document.getElementById('carga-texto');
function progreso(p, texto) {
  barra.style.width = `${Math.round(p * 100)}%`;
  if (texto) textoCarga.textContent = texto;
}
const esperar = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

class App {
  constructor() {
    this.clubes = datosClubes.clubes;
    this.lienzo = document.getElementById('lienzo');
    this.render = new Render(this.lienzo);
    this.escena = new THREE.Scene();
    this.camaras = new Camaras();
    this.input = new Controles();
    this.hud = new Hud(document.getElementById('hud'));
    this.monitor = new MonitorFps();
    this.partido = null;
    this.reloj = new THREE.Clock();
    this.estado = 'cargando';
    this.vitrina = null;
  }

  async cargar() {
    progreso(0.03, 'Detectando tu equipo…');
    const nivel = ajustes.calidad === 'auto' ? detectarCalidad(this.render.renderer) : ajustes.calidad;
    this.nivel = NIVELES[nivel] ? nivel : 'media';
    const q = NIVELES[this.nivel];
    await esperar();
    progreso(0.08, 'Cargando motor de física (Rapier)…');
    await iniciarFisica();
    this.fisica = new MundoFisico();
    progreso(0.15, 'Cargando cielos HDRI (Poly Haven)…');
    this.ambiente = new Ambiente(this.escena, this.render.renderer);
    await this.ambiente.cargar((p) => progreso(0.15 + p * 0.35));
    progreso(0.52, 'Construyendo el estadio…');
    await esperar();
    this.estadio = new Estadio(this.escena, q);
    progreso(0.66, 'Llenando las galerías…');
    await esperar();
    this.publico = new Publico(this.escena, this.estadio.asientos, q.publico);
    this.publico.colorear(['#d52b1e', '#f5f5f5', '#0039a6'], ['#ffd23f']);
    progreso(0.74, 'Inflando el balón…');
    await esperar();
    this.balon = new Balon(this.escena, this.fisica);
    this.balon.colocar(0, 0.11, 0);
    this.ambiente.crearFocos(this.estadio.posFocos, q.focosExtra);
    this.aplicarCalidad(this.nivel, false);
    this.ambiente.fijarHora('dia', this.render, this.estadio);
    this.camaras.modo = 'menu';
    progreso(0.78, 'Cargando futbolistas 3D (GLB + KTX2)…');
    try {
      await cargarModelosRealistas(this.render.renderer, (p) => progreso(0.78 + p * 0.1));
    } catch (e) {
      console.warn('No se pudieron cargar los modelos realistas; se usan los modelos simples.', e);
    }
    progreso(0.88, 'Vistiendo al jugador…');
    await esperar();
    this.crearVitrina(this.clubes[0]);
    progreso(0.92, 'Compilando sombreadores…');
    await esperar();
    this.camaras.actualizar(0.016, { balon: this.balon.pos, instantaneo: true });
    try { await this.render.renderer.compileAsync(this.escena, this.camaras.cam); } catch { /* ignorar */ }
    progreso(1, '¡Listo!');
    this.menus = new Menus(this, document.getElementById('ui'));
    this.input.alConectar = (d) => {
      aviso(`🎮 ${d.nombre()} conectado`);
      // Si el mando se reconecta en medio de un partido, vuelve a manejar a su jugador
      for (const c of this.partido?.controles || []) if (c.disp.id === d.id) c.disp = d;
      this.menus.alCambiarMandos();
    };
    this.input.alDesconectar = (d) => {
      aviso(`⚠️ ${d.nombre()} desconectado`);
      if (this.partido && !this.partido.pausado && this.partido.controles.some((c) => c.disp === d)) this.pausar();
      this.menus.alCambiarMandos();
    };
    const activar = () => sonido.activar();
    window.addEventListener('pointerdown', activar);
    window.addEventListener('keydown', activar);
    window.addEventListener('gamepadconnected', activar);
    window.addEventListener('keydown', (e) => { if (e.code === 'F11' || (e.code === 'KeyF' && this.estado !== 'partido')) { e.preventDefault(); this.pantallaCompleta(); } });
    setTimeout(() => document.getElementById('carga').classList.add('oculto'), 300);
    this.estado = 'menu';
    this.menus.mostrar('titulo');
    this.bucle();
  }

  crearVitrina(club, kit) {
    if (this.vitrina) this.vitrina.destruir(this.escena);
    const datos = club.jugadores.find((j) => j.posicion === 'DEL') || club.jugadores[0];
    this.vitrina = new Jugador({ escena: this.escena, fisica: null, datos, kit: kit || club.colores.titular });
    this.vitrina.colocar(0, -24, 0);
    this.vitrina.grupo.visible = this.camaras.modo === 'vitrina';
  }

  aplicarCalidad(nivel, reconstruir = true) {
    this.nivel = nivel;
    const q = NIVELES[nivel];
    this.render.configurar(this.escena, this.camaras.cam, nivel);
    this.ambiente.fijarCalidadSombras(q);
    if (reconstruir) {
      this.publico.crear(this.estadio.asientos, q.publico);
      this.publico.colorear(this.coloresPublico?.[0] || ['#d52b1e', '#f5f5f5'], this.coloresPublico?.[1] || ['#ffd23f']);
      this.ambiente.crearFocos(this.estadio.posFocos, q.focosExtra);
      this.ambiente.fijarHora(this.ambiente.hora, this.render, this.estadio);
      for (const r of this.estadio.redes) r.simulada = q.redes;
    }
    if (this.ambiente.intensidadLluvia > 0) this.ambiente.activarLluvia(true, q.lluvia, this.render, this.estadio, this.balon);
    this.monitor.reiniciar();
  }

  pantallaCompleta() {
    const d = document;
    if (!d.fullscreenElement) d.documentElement.requestFullscreen?.().catch(() => {});
    else d.exitFullscreen?.();
  }

  // config: { local, visita, estadio, hora, clima, duracion, dificultad, formaciones, humanos, penalesSiEmpate, soloPenales, alTerminar }
  jugarPartido(config) {
    sonido.activar();
    if (this.partido) this.salirPartido(false);
    if (this.vitrina) this.vitrina.grupo.visible = false;
    const q = NIVELES[this.nivel];
    this.ambiente.fijarHora(config.hora || 'dia', this.render, this.estadio);
    this.ambiente.activarLluvia(config.clima === 'lluvia', q.lluvia, this.render, this.estadio, this.balon);
    const kitL = config.local.colores.titular;
    this.coloresPublico = [[kitL.camiseta, kitL.detalle, kitL.short], [config.visita.colores.titular.camiseta]];
    this.publico.colorear(...this.coloresPublico);
    this.estadio.pintarPublico(...this.coloresPublico);
    const cl = config.local.colores.titular;
    this.estadio.coloresAsientos = [cl.camiseta, cl.detalle];
    this.camaras.modo = ajustes.camara || 'tv';
    this.camaras.offsetStick.set(0, 0);
    this.partido = new Partido({
      escena: this.escena, fisica: this.fisica, balon: this.balon, estadio: this.estadio, publico: this.publico,
      camaras: this.camaras, hud: this.hud, input: this.input, ambiente: this.ambiente,
    }, {
      ...config,
      duracion: config.duracion || ajustes.duracion,
      alPausar: () => this.pausar(),
      alTerminar: (res) => { const cb = config.alTerminar; this.salirPartido(false); cb?.(res); },
    });
    this.estado = 'partido';
    this.menus.ocultar();
    this.partido.iniciar();
    this.monitor.reiniciar();
  }

  pausar() {
    if (!this.partido || this.partido.pausado) return;
    this.partido.pausado = true;
    this.menus.mostrar('pausa');
  }

  continuar() {
    if (!this.partido) return;
    this.partido.pausado = false;
    this.partido.bloqueoPausa = 0.35; // evita que el mismo botón vuelva a pausar
    this.menus.ocultar();
  }

  salirPartido(irAlMenu = true) {
    if (this.partido) {
      this.partido.destruir();
      this.partido = null;
    }
    this.hud.desmontar();
    this.camaras.terminarCine();
    this.camaras.modo = 'menu';
    this.balon.colocar(0, 0.11, 0);
    this.ambiente.activarLluvia(false, 0, this.render, this.estadio, this.balon);
    this.estado = 'menu';
    if (irAlMenu) this.menus.mostrar('principal');
  }

  bucle() {
    requestAnimationFrame(() => this.bucle());
    const dtReal = Math.min(this.reloj.getDelta(), 0.1);
    this.monitor.actualizar(dtReal);
    this.input.actualizar(dtReal);
    this.menus.actualizar(dtReal);
    if (this.estado === 'partido' && this.partido) {
      if (!this.partido.pausado) this.partido.actualizar(dtReal);
      this.hud.actualizar(dtReal, this.monitor.fps);
    } else {
      // Fondo de los menús: el estadio con la cámara orbitando
      this.estadio.actualizar(dtReal, this.balon);
      this.balon.actualizarVisual(dtReal, this.camaras.cam);
      this.publico.actualizar(dtReal, 0.35, 0);
      if (this.vitrina) {
        this.vitrina.grupo.visible = this.camaras.modo === 'vitrina';
        if (this.vitrina.grupo.visible) {
          this.vitrina.rumbo += dtReal * 0.6;
          this.vitrina.mover(0, 0, 0, false, dtReal);
          this.vitrina.actualizar(dtReal);
        }
      }
      this.camaras.actualizar(dtReal, { balon: this.balon.pos, vitrina: this.vitrina?.pos });
      this.ambiente.seguir(this.camaras.modo === 'vitrina' ? this.vitrina.pos : new THREE.Vector3());
      sonido.actualizar(dtReal);
    }
    this.ambiente.actualizar(dtReal, this.camaras.cam);
    this.render.dibujar();
    this.revisarRendimiento();
  }

  // Si la calidad es automática y los FPS se mantienen bajos, baja un nivel.
  revisarRendimiento() {
    if (ajustes.calidad !== 'auto' || this.monitor.muestras.length < 12) return;
    const prom = this.monitor.promedio();
    const i = ORDEN_CALIDAD.indexOf(this.nivel);
    if (prom < 40 && i > 0) {
      const nuevo = ORDEN_CALIDAD[i - 1];
      aviso(`Calidad ajustada a ${NIVELES[nuevo].nombre} para mantener la fluidez`);
      this.aplicarCalidad(nuevo);
    }
    this.monitor.reiniciar();
  }
}

const app = new App();
window.__supersoccer = app;
app.cargar().catch((e) => {
  console.error(e);
  textoCarga.textContent = `Error al cargar: ${e.message}. Prueba con otro navegador (Chrome, Edge o Firefox actualizados).`;
});
