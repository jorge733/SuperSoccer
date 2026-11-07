// Menús en español de Chile, navegables 100% con mando (cruceta/stick + A/B), teclado o mouse.
import { ajustes } from '../core/ajustes.js';
import { ACCIONES, nombreBoton, nombreTecla } from '../core/controles.js';
import { NIVELES } from '../core/calidad.js';
import { LISTA_FORMACIONES } from '../game/formaciones.js';
import { DIFICULTAD } from '../game/ia.js';
import { HORAS } from '../world/ambiente.js';
import { canvasEmblema } from './emblema.js';
import { elegirKits } from '../players/camiseta.js';
import { Campeonato, Copa, RONDAS_COPA } from '../modes/torneos.js';
import { sonido } from '../audio/sonido.js';
import { aviso } from './hud.js';
import { MODOS_CAMARA, NOMBRE_CAMARA } from '../game/camaras.js';

const DURACIONES = [2, 4, 6, 8];
const CALIDADES = ['auto', 'baja', 'media', 'alta', 'ultra'];
const nombreCalidad = (c) => (c === 'auto' ? 'Automática' : NIVELES[c].nombre);
const estrellas = (nivel) => { const n = Math.max(1, Math.min(5, Math.round((nivel - 62) / 4))); return '★'.repeat(n) + '☆'.repeat(5 - n); };
const ciclar = (lista, actual, d) => lista[(lista.indexOf(actual) + d + lista.length) % lista.length];

function el(tag, attrs = {}, ...hijos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'style') e.setAttribute('style', v);
    else e[k] = v;
  }
  for (const h of hijos) if (h) e.append(h);
  return e;
}

export class Menus {
  constructor(app, raiz) {
    this.app = app;
    this.raiz = raiz;
    this.actual = null;
    this.foco = null;
    this.alVolver = null;
    this.amistoso = {
      local: app.clubes[0].id, visita: app.clubes[1].id, estadio: null, hora: 'dia', clima: 'despejado',
      asignacion: {},
    };
    this.capturando = false;
  }

  // ---------- Infraestructura ----------
  limpiar() { this.raiz.innerHTML = ''; this.foco = null; this.alVolver = null; }

  ocultar() {
    this.limpiar();
    this.actual = null;
    if (this.app.estado !== 'partido') this.app.camaras.modo = 'menu';
  }

  mostrar(nombre, datos) {
    this.limpiar();
    this.actual = nombre;
    if (this.app.estado !== 'partido') this.app.camaras.modo = nombre === 'amistoso' || nombre === 'elegirClub' ? 'vitrina' : 'menu';
    const fn = this[`p_${nombre}`];
    if (fn) fn.call(this, datos);
    const primero = this.raiz.querySelector('.boton:not([disabled])');
    if (primero && !this.foco) this.enfocar(primero);
  }

  boton(texto, accion, { valor = null, ciclo = null, clase = '', deshabilitado = false, alEnfocar = null } = {}) {
    const b = el('button', { class: `boton ${clase}` });
    const t = el('span', { html: texto });
    b.append(t);
    if (valor !== null) {
      const v = el('span', { class: 'valor', html: ciclo ? `◀ ${valor} ▶` : valor });
      b.append(v);
      b._valor = v;
    }
    if (deshabilitado) b.disabled = true;
    b._accion = accion;
    b._ciclo = ciclo;
    b._alEnfocar = alEnfocar;
    b.addEventListener('click', () => { sonido.activar(); this.enfocar(b); this.activar(b); });
    b.addEventListener('mouseenter', () => this.enfocar(b));
    return b;
  }

  enfocar(b) {
    if (this.foco === b) return;
    this.foco?.classList.remove('foco');
    this.foco = b;
    b.classList.add('foco');
    b.scrollIntoView?.({ block: 'nearest' });
    b._alEnfocar?.();
  }

  activar(b) {
    if (!b || b.disabled) return;
    sonido.clic(1.2);
    if (b._accion) b._accion();
    else if (b._ciclo) b._ciclo(1);
  }

  moverFoco(dir) {
    const items = [...this.raiz.querySelectorAll('.boton:not([disabled])')];
    if (!items.length) return;
    if (!this.foco || !this.raiz.contains(this.foco)) { this.enfocar(items[0]); return; }
    const r = this.foco.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let mejor = null, ms = Infinity;
    for (const it of items) {
      if (it === this.foco) continue;
      const q = it.getBoundingClientRect();
      const x = q.left + q.width / 2, y = q.top + q.height / 2;
      const dx = x - cx, dy = y - cy;
      let ok = false, s = 0;
      if (dir === 'abajo') { ok = dy > 4; s = dy + Math.abs(dx) * 2.5; }
      if (dir === 'arriba') { ok = dy < -4; s = -dy + Math.abs(dx) * 2.5; }
      if (dir === 'der') { ok = dx > 4; s = dx + Math.abs(dy) * 2.5; }
      if (dir === 'izq') { ok = dx < -4; s = -dx + Math.abs(dy) * 2.5; }
      if (ok && s < ms) { ms = s; mejor = it; }
    }
    if (!mejor && (dir === 'abajo' || dir === 'arriba')) {
      // Dar la vuelta
      const i = items.indexOf(this.foco);
      mejor = items[(i + (dir === 'abajo' ? 1 : -1) + items.length) % items.length];
    }
    if (mejor) { this.enfocar(mejor); sonido.clic(0.9); }
  }

  actualizar() {
    if (!this.actual || this.capturando) return;
    const n = this.app.input.nav;
    if (n.arriba) this.moverFoco('arriba');
    if (n.abajo) this.moverFoco('abajo');
    if (n.izq || n.der) {
      const d = n.izq ? -1 : 1;
      if (this.foco?._ciclo) { this.foco._ciclo(d); sonido.clic(1); } else this.moverFoco(n.izq ? 'izq' : 'der');
    }
    if (n.aceptar) { this.origen = n.origen; this.activar(this.foco); }
    if (n.volver || (n.inicio && this.actual === 'pausa')) { sonido.clic(0.7); this.alVolver?.(); }
    if (n.inicio && this.actual === 'titulo') this.activar(this.foco);
  }

  ayuda(texto) { this.raiz.append(el('div', { class: 'ayuda', html: texto })); }

  actualizarValor(b, valor) { if (b._valor) b._valor.innerHTML = b._ciclo ? `◀ ${valor} ▶` : valor; }

  dispositivoPrincipal() {
    const o = this.origen;
    if (o) return o;
    return this.app.input.mandos()[0] || this.app.input.teclado;
  }

  alCambiarMandos() {
    if (this.actual === 'amistoso') this.mostrar('amistoso');
    if (this.actual === 'titulo') this.mostrar('titulo');
  }

  // ---------- Pantallas ----------
  p_titulo() {
    const mandos = this.app.input.mandos();
    const caja = el('div', { class: 'pantalla' },
      el('h1', { class: 'logo', html: 'Super<span>Soccer</span>' }),
      el('div', { style: 'color:var(--tenue);font-size:18px;margin-top:-18px;margin-bottom:26px;text-align:center', html: 'Fútbol chileno · Liga de Primera 2026' }),
    );
    const b = this.boton('Presiona <b>A</b> / <b>Enter</b> para comenzar', () => this.mostrar('principal'), { clase: 'primario' });
    caja.append(b);
    caja.append(el('div', { style: 'color:var(--tenue);margin-top:18px;text-align:center', html: mandos.length ? `🎮 ${mandos.map((m) => m.nombre()).join(' · ')}` : 'Conecta un mando (Xbox, PlayStation o genérico) y presiona un botón. También puedes jugar con teclado.' }));
    this.raiz.append(caja);
  }

  p_principal() {
    const lista = el('div', { class: 'menu-lista' },
      this.boton('⚽ Amistoso', () => this.mostrar('amistoso')),
      this.boton('🏆 Campeonato Nacional', () => this.mostrar('campeonato')),
      this.boton('🥇 Copa Chile', () => this.mostrar('copa')),
      this.boton('🎯 Tanda de penales', () => this.mostrar('penales')),
      this.boton('⚙️ Opciones', () => this.mostrar('opciones', { volver: 'principal' })),
      this.boton('🎮 Controles', () => this.mostrar('controles', { volver: 'principal' })),
      this.boton('⛶ Pantalla completa', () => this.app.pantallaCompleta()),
    );
    this.raiz.append(el('div', { class: 'pantalla lateral' },
      el('h1', { class: 'logo', style: 'font-size:64px;margin-bottom:10px', html: 'Super<span>Soccer</span>' }),
      el('div', { class: 'panel' }, lista)));
    this.ayuda('<b>A</b>/<b>Enter</b> elegir · <b>B</b>/<b>Esc</b> volver · <b>Cruceta</b>/<b>Flechas</b> moverse');
    this.alVolver = () => this.mostrar('titulo');
  }

  // Tarjeta de club con emblema
  tarjetaClub(club, kit) {
    const c = el('div', { class: 'club-tarjeta' });
    c.append(canvasEmblema(club, 128, 'emblema'));
    c.append(el('div', {},
      el('div', { class: 'nombre', html: club.nombre }),
      el('div', { class: 'sub', html: `${club.ciudad} · ${club.estadio}` }),
      el('div', { class: 'estrellas', html: estrellas(club.nivel) }),
      kit ? el('div', { class: 'sub', html: `<span style="display:inline-block;width:14px;height:14px;background:${kit.camiseta};border:1px solid #fff;vertical-align:middle"></span> <span style="display:inline-block;width:14px;height:14px;background:${kit.short};border:1px solid #fff;vertical-align:middle"></span> Uniforme` }) : null,
    ));
    return c;
  }

  porId(id) { return this.app.clubes.find((c) => c.id === id); }

  p_amistoso() {
    const a = this.amistoso;
    const ids = this.app.clubes.map((c) => c.id);
    const L = this.porId(a.local), V = this.porId(a.visita);
    const [kl, kv] = elegirKits(L, V);
    const estadios = [...new Set(this.app.clubes.map((c) => c.estadio))];
    if (!a.estadio) a.estadio = L.estadio;
    const tarjL = this.tarjetaClub(L, kl), tarjV = this.tarjetaClub(V, kv);
    const vit = (club, kit) => () => this.app.crearVitrina(club, kit);
    const selL = this.boton('Local', null, {
      valor: L.corto, alEnfocar: vit(L, kl),
      ciclo: (d) => { a.local = ciclar(ids, a.local, d); if (a.local === a.visita) a.local = ciclar(ids, a.local, d); a.estadio = this.porId(a.local).estadio; this.mostrar('amistoso'); this.enfocarPorTexto('Local'); },
    });
    const selV = this.boton('Visita', null, {
      valor: V.corto, alEnfocar: vit(V, kv),
      ciclo: (d) => { a.visita = ciclar(ids, a.visita, d); if (a.local === a.visita) a.visita = ciclar(ids, a.visita, d); this.mostrar('amistoso'); this.enfocarPorTexto('Visita'); },
    });
    const opciones = el('div', { class: 'columna' },
      selL, selV,
      this.botonCiclo('Estadio', estadios, () => a.estadio, (v) => { a.estadio = v; }, (v) => v.replace('Estadio ', '')),
      this.botonCiclo('Hora', Object.keys(HORAS), () => a.hora, (v) => { a.hora = v; }, (v) => HORAS[v].nombre),
      this.botonCiclo('Clima', ['despejado', 'lluvia'], () => a.clima, (v) => { a.clima = v; }, (v) => (v === 'lluvia' ? 'Lluvia' : 'Despejado')),
      this.botonCiclo('Duración', DURACIONES, () => ajustes.duracion, (v) => { ajustes.duracion = v; }, (v) => `${v} min por tiempo`),
      this.botonCiclo('Dificultad', Object.keys(DIFICULTAD), () => ajustes.dificultad, (v) => { ajustes.dificultad = v; }, (v) => DIFICULTAD[v].nombre),
      this.botonCiclo('Tu formación', LISTA_FORMACIONES, () => ajustes.formacion, (v) => { ajustes.formacion = v; }),
    );
    // Asignación de mandos: Local / Visita / Sin jugar
    const disp = this.app.input.listaDispositivos();
    const asig = el('div', { class: 'columna' }, el('h3', { html: 'Jugadores' }));
    disp.forEach((d, i) => {
      if (!(d.id in a.asignacion)) a.asignacion[d.id] = i === 0 ? 'local' : (d.tipo === 'teclado' && disp.length > 1 ? 'nadie' : (i === 1 ? 'visita' : 'nadie'));
      asig.append(this.botonCiclo(d.nombre() + (d.tipo !== 'teclado' ? ` ${d.indice + 1}` : ''), ['local', 'visita', 'nadie'], () => a.asignacion[d.id], (v) => { a.asignacion[d.id] = v; },
        (v) => (v === 'local' ? `⬅ ${L.iniciales}` : v === 'visita' ? `${V.iniciales} ➡` : 'CPU / nadie')));
    });
    asig.append(el('div', { class: 'sub', style: 'color:var(--tenue);font-size:13px;max-width:330px', html: 'Pon dos mandos en el mismo equipo para jugar en cooperativo contra la CPU, o en equipos distintos para 1 contra 1.' }));
    const jugar = this.boton('▶ ¡A la cancha!', () => this.iniciarAmistoso(), { clase: 'primario' });
    asig.append(el('div', { style: 'margin-top:10px' }, jugar));
    this.raiz.append(el('div', { class: 'pantalla', style: 'align-items:flex-end;padding-right:2.5vw' },
      el('div', { class: 'panel compacto', style: 'max-width:min(760px,96vw)' },
        el('h2', { html: 'Amistoso' }),
        el('div', { class: 'fila', style: 'justify-content:space-between;flex-wrap:nowrap' }, tarjL, el('div', { style: 'font-size:24px;font-weight:900;align-self:center', html: 'VS' }), tarjV),
        el('div', { class: 'fila', style: 'margin-top:10px;align-items:flex-start;justify-content:space-between' }, opciones, asig))));
    this.ayuda('<b>◀ ▶</b> cambiar opción · <b>A</b> confirmar · <b>B</b> volver');
    this.alVolver = () => this.mostrar('principal');
    this.app.crearVitrina(L, kl);
    this.enfocar(selL);
  }

  enfocarPorTexto(t) {
    const b = [...this.raiz.querySelectorAll('.boton')].find((x) => x.textContent.startsWith(t));
    if (b) this.enfocar(b);
  }

  botonCiclo(texto, lista, obtener, fijar, formato = (v) => v) {
    const b = this.boton(texto, null, {
      valor: formato(obtener()),
      ciclo: (d) => { const v = ciclar(lista, obtener(), d); fijar(v); this.actualizarValor(b, formato(v)); },
    });
    return b;
  }

  humanosDesdeAsignacion(asig) {
    const res = [];
    const lista = this.app.input.listaDispositivos();
    if (!lista.some((d) => d.id in asig)) asig[lista[0].id] = 'local';
    for (const d of this.app.input.listaDispositivos()) {
      const v = asig[d.id];
      if (v === 'local') res.push({ dispositivo: d, equipo: 0 });
      else if (v === 'visita') res.push({ dispositivo: d, equipo: 1 });
    }
    return res;
  }

  iniciarAmistoso() {
    const a = this.amistoso;
    const local = this.porId(a.local), visita = this.porId(a.visita);
    this.app.jugarPartido({
      local, visita, estadio: a.estadio, hora: a.hora, clima: a.clima, dificultad: ajustes.dificultad,
      humanos: this.humanosDesdeAsignacion(a.asignacion),
      alTerminar: (res) => this.mostrar('resultado', { res, volver: () => this.mostrar('amistoso') }),
    });
  }

  p_resultado({ res, volver, titulo = 'Resultado' }) {
    const L = this.porId(res.local), V = this.porId(res.visita);
    const goles = (eq) => res.goles.filter((g) => g.equipo === eq).map((g) => `${g.jugador.split(' ').slice(-1)[0]} ${g.minuto}'${g.enContra ? ' (ec)' : ''}`).join(', ') || '—';
    const e = res.estad;
    const pos = Math.round((e[0].posesion / Math.max(1, e[0].posesion + e[1].posesion)) * 100);
    const filas = [
      ['Posesión', `${pos}%`, `${100 - pos}%`], ['Remates', e[0].tiros, e[1].tiros], ['Al arco', e[0].alArco, e[1].alArco],
      ['Córners', e[0].corners, e[1].corners], ['Faltas', e[0].faltas, e[1].faltas], ['Tarjetas', `🟨${e[0].amarillas} 🟥${e[0].rojas}`, `🟨${e[1].amarillas} 🟥${e[1].rojas}`],
      ['Fueras de juego', e[0].offsides, e[1].offsides],
    ];
    const tabla = el('table', { class: 'tabla' });
    tabla.innerHTML = filas.map(([n, a, b]) => `<tr><td>${a}</td><th>${n}</th><td>${b}</td></tr>`).join('');
    const pen = res.penales ? `<div style="text-align:center;color:var(--foco)">Penales: ${res.penales[0]} - ${res.penales[1]}</div>` : '';
    this.raiz.append(el('div', { class: 'pantalla oscura' }, el('div', { class: 'panel', style: 'min-width:min(560px,92vw)' },
      el('h2', { html: titulo }),
      el('div', { class: 'fila', style: 'align-items:center' }, canvasEmblema(L, 72), el('div', { style: 'font-size:44px;font-weight:900', html: `${res.gl} - ${res.gv}` }), canvasEmblema(V, 72)),
      el('div', { html: `${pen}<div style="display:flex;justify-content:space-between;gap:20px;color:var(--tenue);font-size:14px;margin:8px 0"><span>⚽ ${goles(0)}</span><span>⚽ ${goles(1)}</span></div>` }),
      tabla,
      el('div', { class: 'fila', style: 'margin-top:14px' }, this.boton('Continuar', volver, { clase: 'primario' })))));
    this.alVolver = volver;
  }

  p_pausa() {
    const p = this.app.partido;
    const lista = el('div', { class: 'menu-lista' },
      this.boton('▶ Continuar', () => this.app.continuar(), { clase: 'primario' }),
      this.botonCiclo('Cámara', MODOS_CAMARA, () => this.app.camaras.modo, (v) => { this.app.camaras.modo = v; ajustes.camara = v; }, (v) => NOMBRE_CAMARA[v]),
      this.botonCiclo('Formación', LISTA_FORMACIONES, () => p?.controles[0]?.equipo.formacion || ajustes.formacion, (v) => {
        const eq = p?.controles[0]?.equipo; if (eq) eq.formacion = v; ajustes.formacion = v;
      }),
      this.boton('⚙️ Opciones', () => this.mostrar('opciones', { volver: 'pausa' })),
      this.boton('🎮 Controles', () => this.mostrar('controles', { volver: 'pausa' })),
      this.boton('🚪 Salir al menú', () => this.mostrar('confirmar', {
        texto: '¿Salir del partido? Se perderá el resultado.', si: () => this.app.salirPartido(true), no: () => this.mostrar('pausa'),
      })),
    );
    this.raiz.append(el('div', { class: 'pantalla oscura' }, el('div', { class: 'panel' }, el('h2', { html: 'Pausa' }), lista)));
    this.alVolver = () => this.app.continuar();
  }

  p_confirmar({ texto, si, no }) {
    this.raiz.append(el('div', { class: 'pantalla oscura' }, el('div', { class: 'panel' },
      el('h2', { html: texto }),
      el('div', { class: 'fila' }, this.boton('Sí', si, { clase: 'primario' }), this.boton('No', no)))));
    this.alVolver = no;
  }

  p_opciones({ volver }) {
    const app = this.app;
    const vol = (v) => `${Math.round(v * 100)}%`;
    const pasos = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
    const lista = el('div', { class: 'menu-lista', style: 'min-width:min(460px,90vw)' },
      el('h3', { html: 'Gráficos' }),
      this.botonCiclo('Calidad gráfica', CALIDADES, () => ajustes.calidad, (v) => {
        ajustes.calidad = v;
        const nivel = v === 'auto' ? app.nivel : v;
        app.aplicarCalidad(nivel);
        aviso(`Calidad: ${nombreCalidad(v)}${v === 'auto' ? ` (${NIVELES[nivel].nombre})` : ''}`);
      }, nombreCalidad),
      this.botonCiclo('Mostrar FPS', [true, false], () => ajustes.mostrarFps, (v) => { ajustes.mostrarFps = v; }, (v) => (v ? 'Sí' : 'No')),
      el('h3', { html: 'Sonido' }),
      this.botonCiclo('Volumen general', pasos, () => Math.round(ajustes.volumen * 10) / 10, (v) => { ajustes.volumen = v; sonido.fijarVolumen(); }, vol),
      this.botonCiclo('Volumen del público', pasos, () => Math.round(ajustes.volumenPublico * 10) / 10, (v) => { ajustes.volumenPublico = v; sonido.fijarVolumen(); }, vol),
      el('h3', { html: 'Partido' }),
      this.botonCiclo('Dificultad', Object.keys(DIFICULTAD), () => ajustes.dificultad, (v) => { ajustes.dificultad = v; }, (v) => DIFICULTAD[v].nombre),
      this.botonCiclo('Duración', DURACIONES, () => ajustes.duracion, (v) => { ajustes.duracion = v; }, (v) => `${v} min por tiempo`),
      this.botonCiclo('Cámara', MODOS_CAMARA, () => ajustes.camara, (v) => { ajustes.camara = v; if (app.partido) app.camaras.modo = v; }, (v) => NOMBRE_CAMARA[v]),
      this.botonCiclo('Radar', [true, false], () => ajustes.radar, (v) => { ajustes.radar = v; }, (v) => (v ? 'Sí' : 'No')),
      this.botonCiclo('Relato en pantalla', [true, false], () => ajustes.relato, (v) => { ajustes.relato = v; }, (v) => (v ? 'Sí' : 'No')),
      this.botonCiclo('Vibración del mando', [true, false], () => ajustes.vibracion, (v) => { ajustes.vibracion = v; if (v) app.input.vibrarTodos(0.6, 250); }, (v) => (v ? 'Sí' : 'No')),
      this.boton('⬅ Volver', () => this.mostrar(volver)),
    );
    this.raiz.append(el('div', { class: 'pantalla oscura' }, el('div', { class: 'panel' }, el('h2', { html: 'Opciones' }), lista)));
    this.ayuda('<b>◀ ▶</b> cambiar · <b>B</b> volver');
    this.alVolver = () => this.mostrar(volver);
  }

  p_controles({ volver }) {
    const input = this.app.input;
    const mando = input.mandos()[0];
    const tipo = mando?.tipo === 'ps' ? 'ps' : 'xbox';
    const grid = el('div', { class: 'remapeo' },
      el('div', { class: 'accion', html: 'Acción' }), el('div', { class: 'accion', html: `Mando (${tipo === 'ps' ? 'PlayStation' : 'Xbox'})` }), el('div', { class: 'accion', html: 'Teclado' }));
    for (const a of ACCIONES) {
      grid.append(el('div', { html: a.nombre }));
      const bm = this.boton(nombreBoton(tipo, input.mapeoMando[a.id]), () => this.reasignar(a.id, 'mando', bm, volver), { clase: 'chico' });
      const bt = this.boton(nombreTecla(input.mapeoTeclado[a.id]), () => this.reasignar(a.id, 'teclado', bt, volver), { clase: 'chico' });
      grid.append(bm, bt);
    }
    const fijos = el('div', { style: 'color:var(--tenue);font-size:14px;margin-top:10px;max-width:520px', html:
      'Fijos: <b>stick izquierdo / cruceta</b> mover · <b>stick derecho</b> regate (con balón) o cámara · Teclado: <b>flechas</b> mover, <b>I J K L</b> regate.' });
    this.raiz.append(el('div', { class: 'pantalla oscura' }, el('div', { class: 'panel' },
      el('h2', { html: 'Controles' }), grid, fijos,
      el('div', { class: 'fila', style: 'margin-top:12px' },
        this.boton('Restaurar valores', () => { input.restaurarMapeo(); this.mostrar('controles', { volver }); aviso('Controles restaurados'); }),
        this.boton('⬅ Volver', () => this.mostrar(volver))))));
    this.ayuda('Elige una acción y presiona el nuevo botón o tecla');
    this.alVolver = () => this.mostrar(volver);
  }

  async reasignar(accion, tipo, boton, volver) {
    const input = this.app.input;
    this.capturando = true;
    boton.querySelector('span').textContent = tipo === 'mando' ? 'Presiona un botón…' : 'Presiona una tecla…';
    const valor = await input.capturar(tipo);
    const mapa = tipo === 'mando' ? input.mapeoMando : input.mapeoTeclado;
    // Si otra acción usaba ese botón, intercambiamos
    const otra = Object.keys(mapa).find((k) => mapa[k] === valor && k !== accion);
    if (otra) mapa[otra] = mapa[accion];
    mapa[accion] = valor;
    input.guardarMapeo();
    setTimeout(() => { this.capturando = false; this.mostrar('controles', { volver }); }, 250);
  }

  // ---------- Elegir club (grilla) ----------
  p_elegirClub({ titulo, alElegir, volver }) {
    const grid = el('div', { class: 'grilla-clubes' });
    for (const c of this.app.clubes) {
      const b = this.boton('', () => alElegir(c), { alEnfocar: () => { this.app.crearVitrina(c); info.innerHTML = ''; info.append(this.tarjetaClub(c, c.colores.titular)); } });
      b.prepend(canvasEmblema(c, 92));
      b.querySelector('span').textContent = c.corto;
      grid.append(b);
    }
    const info = el('div', { style: 'min-height:90px;margin-top:10px' });
    this.raiz.append(el('div', { class: 'pantalla oscura', style: 'align-items:flex-start;padding-left:4vw' }, el('div', { class: 'panel', style: 'max-width:min(620px,94vw)' }, el('h2', { html: titulo }), grid, info)));
    this.ayuda('<b>Cruceta</b> elegir club · <b>A</b> confirmar · <b>B</b> volver');
    this.alVolver = volver;
  }

  // ---------- Campeonato Nacional ----------
  p_campeonato() {
    const guardado = Campeonato.cargar(this.app.clubes);
    const lista = el('div', { class: 'menu-lista' });
    if (guardado && !guardado.terminado) lista.append(this.boton(`▶ Continuar (${guardado.miClub.corto}, fecha ${guardado.d.fecha + 1})`, () => this.mostrar('ligaHub', guardado), { clase: 'primario' }));
    lista.append(this.boton('🆕 Nuevo campeonato', () => {
      const crear = () => this.mostrar('elegirClub', {
        titulo: 'Elige tu club', volver: () => this.mostrar('campeonato'),
        alElegir: (c) => { const l = Campeonato.nuevo(this.app.clubes, c.id); aviso('Campeonato creado y guardado'); this.mostrar('ligaHub', l); },
      });
      if (guardado && !guardado.terminado) this.mostrar('confirmar', { texto: '¿Empezar de nuevo? Se borrará el campeonato guardado.', si: crear, no: () => this.mostrar('campeonato') });
      else crear();
    }));
    if (guardado && guardado.terminado) lista.append(this.boton('📊 Ver tabla final', () => this.mostrar('ligaTabla', guardado)));
    lista.append(this.boton('⬅ Volver', () => this.mostrar('principal')));
    this.raiz.append(el('div', { class: 'pantalla oscura' }, el('div', { class: 'panel' },
      el('h2', { html: 'Campeonato Nacional 2026' }),
      el('p', { style: 'color:var(--tenue);max-width:420px', html: '16 clubes, 30 fechas (ida y vuelta). Los partidos que no juegas se simulan. Tu avance se guarda solo.' }), lista)));
    this.alVolver = () => this.mostrar('principal');
  }

  p_ligaHub(liga) {
    const yo = liga.miClub;
    const prox = liga.partidoUsuario();
    const tabla = liga.tablaOrdenada();
    const posicion = tabla.findIndex((t) => t.id === yo.id) + 1;
    const lista = el('div', { class: 'menu-lista' });
    if (prox) {
      const rival = prox.local.id === yo.id ? prox.visita : prox.local;
      const condicion = prox.local.id === yo.id ? 'Local' : 'Visita';
      lista.append(el('div', { style: 'text-align:center;margin-bottom:6px', html: `<b>Fecha ${liga.d.fecha + 1} de ${liga.totalFechas}</b><br>${prox.local.corto} vs ${prox.visita.corto}<br><span style="color:var(--tenue)">${condicion} · ${prox.local.estadio}</span>` }));
      lista.append(this.boton(`▶ Jugar vs ${rival.corto}`, () => this.jugarLiga(liga, prox), { clase: 'primario' }));
      lista.append(this.boton('⏩ Simular mi partido', () => {
        liga.completarFecha();
        aviso('Fecha simulada');
        this.mostrar('ligaFecha', { liga, fecha: liga.d.fecha - 1 });
      }));
    } else {
      const campeon = tabla[0].club;
      lista.append(el('div', { style: 'text-align:center;font-size:20px', html: `🏆 Campeón: <b>${campeon.nombre}</b><br>Terminaste en el lugar ${posicion}` }));
    }
    lista.append(this.boton('📊 Tabla de posiciones', () => this.mostrar('ligaTabla', liga)));
    lista.append(this.boton('⚽ Goleadores', () => this.mostrar('ligaGoleadores', liga)));
    if (liga.d.fecha > 0) lista.append(this.boton('📋 Resultados última fecha', () => this.mostrar('ligaFecha', { liga, fecha: liga.d.fecha - 1 })));
    lista.append(this.boton('⬅ Menú principal', () => this.mostrar('principal')));
    const cab = el('div', { class: 'fila', style: 'align-items:center;margin-bottom:10px' }, canvasEmblema(yo, 64),
      el('div', { html: `<div style="font-size:22px;font-weight:800">${yo.nombre}</div><div style="color:var(--tenue)">Posición: ${posicion}° · ${tabla[posicion - 1].pts} pts</div>` }));
    this.raiz.append(el('div', { class: 'pantalla oscura' }, el('div', { class: 'panel' }, el('h2', { html: 'Campeonato Nacional' }), cab, lista)));
    this.alVolver = () => this.mostrar('principal');
  }

  configPartido(local, visita, extra = {}) {
    const horas = ['dia', 'dia', 'atardecer', 'noche', 'noche'];
    return {
      local, visita, estadio: local.estadio,
      hora: horas[Math.floor(Math.random() * horas.length)], clima: Math.random() < 0.15 ? 'lluvia' : 'despejado',
      dificultad: ajustes.dificultad, ...extra,
    };
  }

  humanosModo(miClub, local) {
    const d = this.dispositivoPrincipal();
    return [{ dispositivo: d, equipo: local.id === miClub.id ? 0 : 1 }];
  }

  jugarLiga(liga, prox) {
    const yo = liga.miClub;
    this.app.jugarPartido(this.configPartido(prox.local, prox.visita, {
      humanos: this.humanosModo(yo, prox.local),
      alTerminar: (res) => {
        liga.completarFecha(res);
        this.mostrar('resultado', { res, titulo: `Fecha ${liga.d.fecha}`, volver: () => this.mostrar('ligaFecha', { liga, fecha: liga.d.fecha - 1 }) });
      },
    }));
  }

  p_ligaFecha({ liga, fecha }) {
    const res = liga.resultadosFecha(fecha);
    const t = el('table', { class: 'tabla' });
    t.innerHTML = res.map((r) => {
      const mio = r.l === liga.d.miClub || r.v === liga.d.miClub;
      return `<tr class="${mio ? 'mio' : ''}"><td class="izq">${liga.porId[r.l].corto}</td><td><b>${r.gl} - ${r.gv}</b></td><td class="izq">${liga.porId[r.v].corto}</td></tr>`;
    }).join('');
    this.raiz.append(el('div', { class: 'pantalla oscura' }, el('div', { class: 'panel', style: 'min-width:min(460px,92vw)' },
      el('h2', { html: `Resultados · Fecha ${fecha + 1}` }), t,
      el('div', { class: 'fila', style: 'margin-top:12px' }, this.boton('📊 Tabla', () => this.mostrar('ligaTabla', liga)), this.boton('Continuar', () => this.mostrar('ligaHub', liga), { clase: 'primario' })))));
    this.alVolver = () => this.mostrar('ligaHub', liga);
  }

  p_ligaTabla(liga) {
    const t = el('table', { class: 'tabla' });
    const filas = liga.tablaOrdenada();
    t.innerHTML = `<tr><th>#</th><th class="izq">Club</th><th>PJ</th><th>PG</th><th>PE</th><th>PP</th><th>GF</th><th>GC</th><th>DG</th><th>Pts</th></tr>`;
    filas.forEach((f, i) => {
      const tr = document.createElement('tr');
      if (f.id === liga.d.miClub) tr.className = 'mio';
      const td = document.createElement('td'); td.className = 'izq';
      td.append(canvasEmblema(f.club, 40, 'mini-emblema'), document.createTextNode(f.club.corto));
      tr.innerHTML = `<td>${i + 1}</td>`;
      tr.append(td);
      tr.insertAdjacentHTML('beforeend', `<td>${f.pj}</td><td>${f.pg}</td><td>${f.pe}</td><td>${f.pp}</td><td>${f.gf}</td><td>${f.gc}</td><td>${f.dg > 0 ? '+' : ''}${f.dg}</td><td><b>${f.pts}</b></td>`);
      t.append(tr);
    });
    this.raiz.append(el('div', { class: 'pantalla oscura' }, el('div', { class: 'panel', style: 'min-width:min(640px,94vw)' },
      el('h2', { html: 'Tabla de posiciones' }), t,
      el('div', { class: 'fila', style: 'margin-top:12px' }, this.boton('⬅ Volver', () => this.mostrar(liga.terminado ? 'campeonato' : 'ligaHub', liga), { clase: 'primario' })))));
    this.alVolver = () => this.mostrar(liga.terminado ? 'campeonato' : 'ligaHub', liga);
  }

  p_ligaGoleadores(liga) {
    const t = el('table', { class: 'tabla' });
    const g = liga.goleadores(15);
    t.innerHTML = `<tr><th>#</th><th class="izq">Jugador</th><th class="izq">Club</th><th>Goles</th></tr>` +
      (g.length ? g.map((x, i) => `<tr class="${x.club.id === liga.d.miClub ? 'mio' : ''}"><td>${i + 1}</td><td class="izq">${x.nombre}</td><td class="izq">${x.club.corto}</td><td><b>${x.goles}</b></td></tr>`).join('') : '<tr><td colspan="4">Aún no hay goles</td></tr>');
    this.raiz.append(el('div', { class: 'pantalla oscura' }, el('div', { class: 'panel', style: 'min-width:min(520px,92vw)' },
      el('h2', { html: 'Goleadores' }), t,
      el('div', { class: 'fila', style: 'margin-top:12px' }, this.boton('⬅ Volver', () => this.mostrar('ligaHub', liga), { clase: 'primario' })))));
    this.alVolver = () => this.mostrar('ligaHub', liga);
  }

  // ---------- Copa Chile ----------
  p_copa() {
    const guardada = Copa.cargar(this.app.clubes);
    const lista = el('div', { class: 'menu-lista' });
    if (guardada && !guardada.terminada) lista.append(this.boton(`▶ Continuar (${guardada.miClub.corto}, ${RONDAS_COPA[guardada.d.ronda]})`, () => this.mostrar('copaHub', guardada), { clase: 'primario' }));
    lista.append(this.boton('🆕 Nueva Copa Chile', () => {
      const crear = () => this.mostrar('elegirClub', {
        titulo: 'Elige tu club', volver: () => this.mostrar('copa'),
        alElegir: (c) => { const k = Copa.nueva(this.app.clubes, c.id); aviso('Sorteo realizado'); this.mostrar('copaHub', k); },
      });
      if (guardada && !guardada.terminada) this.mostrar('confirmar', { texto: '¿Empezar de nuevo? Se borrará la copa guardada.', si: crear, no: () => this.mostrar('copa') });
      else crear();
    }));
    lista.append(this.boton('⬅ Volver', () => this.mostrar('principal')));
    this.raiz.append(el('div', { class: 'pantalla oscura' }, el('div', { class: 'panel' },
      el('h2', { html: 'Copa Chile' }),
      el('p', { style: 'color:var(--tenue);max-width:420px', html: 'Eliminación directa a partido único. Si hay empate, ¡se define a penales!' }), lista)));
    this.alVolver = () => this.mostrar('principal');
  }

  p_copaHub(copa) {
    const llaves = el('div', { class: 'llaves' });
    for (let r = 0; r < 4; r++) {
      const ronda = copa.d.rondas[r];
      const col = el('div', { class: 'llave-ronda' }, el('h4', { html: RONDAS_COPA[r] }));
      const n = 8 >> r;
      for (let i = 0; i < n; i++) {
        const c = ronda?.[i];
        const mio = c && (c.a === copa.d.miClub || c.b === copa.d.miClub);
        const nom = (id) => (id ? copa.porId[id].corto : '—');
        const res = (id, g) => (c?.ganador ? `${g}${c.pen ? ` (${id === c.a ? c.pen[0] : c.pen[1]})` : ''}` : '');
        const div = el('div', { class: `cruce ${mio ? 'mio' : ''}`, html:
          `<div class="eq ${c?.ganador === c?.a ? 'gana' : ''}"><span>${nom(c?.a)}</span><span>${res(c?.a, c?.ga)}</span></div>` +
          `<div class="eq ${c?.ganador === c?.b ? 'gana' : ''}"><span>${nom(c?.b)}</span><span>${res(c?.b, c?.gb)}</span></div>` });
        col.append(div);
      }
      llaves.append(col);
    }
    const lista = el('div', { class: 'fila', style: 'margin-top:12px' });
    const cr = copa.cruceUsuario();
    if (copa.terminada) {
      const c = copa.porId[copa.d.campeon];
      lista.append(el('div', { style: 'font-size:20px', html: `🏆 Campeón de la Copa Chile: <b>${c.nombre}</b>${c.id === copa.d.miClub ? ' ¡FELICITACIONES!' : ''}` }));
    } else if (cr) {
      lista.append(this.boton(`▶ Jugar ${RONDAS_COPA[copa.d.ronda]}: ${cr.local.corto} vs ${cr.visita.corto}`, () => this.jugarCopa(copa, cr), { clase: 'primario' }));
      lista.append(this.boton('⏩ Simular', () => { copa.completarRonda(); this.mostrar('copaHub', copa); }));
    } else if (copa.d.eliminado) {
      lista.append(el('div', { html: 'Quedaste eliminado 😢' }));
      lista.append(this.boton('⏩ Simular hasta el final', () => { copa.simularHastaElFinal(); this.mostrar('copaHub', copa); }));
    }
    lista.append(this.boton('⬅ Menú principal', () => this.mostrar('principal')));
    this.raiz.append(el('div', { class: 'pantalla oscura' }, el('div', { class: 'panel', style: 'max-width:96vw' },
      el('h2', { html: 'Copa Chile' }), llaves, lista)));
    this.alVolver = () => this.mostrar('principal');
  }

  jugarCopa(copa, cr) {
    const yo = copa.miClub;
    this.app.jugarPartido(this.configPartido(cr.local, cr.visita, {
      humanos: this.humanosModo(yo, cr.local), penalesSiEmpate: true,
      alTerminar: (res) => {
        copa.completarRonda(res);
        this.mostrar('resultado', { res, titulo: 'Copa Chile', volver: () => this.mostrar('copaHub', copa) });
      },
    }));
  }

  // ---------- Tanda de penales ----------
  p_penales() {
    const a = this.amistoso;
    const ids = this.app.clubes.map((c) => c.id);
    const L = this.porId(a.local), V = this.porId(a.visita);
    const lista = el('div', { class: 'menu-lista' },
      this.boton('Tu club', null, { valor: L.corto, ciclo: (d) => { a.local = ciclar(ids, a.local, d); if (a.local === a.visita) a.local = ciclar(ids, a.local, d); this.mostrar('penales'); } }),
      this.boton('Rival', null, { valor: V.corto, ciclo: (d) => { a.visita = ciclar(ids, a.visita, d); if (a.local === a.visita) a.visita = ciclar(ids, a.visita, d); this.mostrar('penales'); this.enfocarPorTexto('Rival'); } }),
      this.boton('▶ ¡A patear!', () => {
        const disp = this.app.input.listaDispositivos();
        const humanos = [{ dispositivo: this.dispositivoPrincipal(), equipo: 0 }];
        const otro = disp.find((d) => d !== humanos[0].dispositivo && d.tipo !== 'teclado');
        if (otro) humanos.push({ dispositivo: otro, equipo: 1 });
        this.app.jugarPartido({
          local: L, visita: V, hora: 'noche', clima: 'despejado', soloPenales: true, presentacion: false, humanos,
          alTerminar: (res) => this.mostrar('resultado', { res, titulo: 'Tanda de penales', volver: () => this.mostrar('penales') }),
        });
      }, { clase: 'primario' }),
      this.boton('⬅ Volver', () => this.mostrar('principal')),
    );
    this.raiz.append(el('div', { class: 'pantalla oscura' }, el('div', { class: 'panel' },
      el('h2', { html: 'Tanda de penales' }),
      el('div', { class: 'fila' }, this.tarjetaClub(L), this.tarjetaClub(V)),
      el('p', { style: 'color:var(--tenue);max-width:480px', html: 'Pateador: apunta con el stick (arriba/abajo para la altura) y mantén Tiro para la potencia. Arquero: elige un lado con el stick antes del remate. Con un segundo mando, el rival lo maneja otra persona.' }),
      lista)));
    this.alVolver = () => this.mostrar('principal');
  }
}
