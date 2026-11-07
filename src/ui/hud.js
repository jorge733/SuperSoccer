// HUD: marcador, reloj, radar (minimapa), jugador con balón, barra de potencia, relato y avisos.
import { MITAD_L, MITAD_A } from '../world/medidas.js';
import { ajustes } from '../core/ajustes.js';

export class Hud {
  constructor(raiz) {
    this.raiz = raiz;
    this.relatoT = 0;
    this.visible = false;
  }

  montar(partido) {
    this.partido = partido;
    const [a, b] = partido.equipos;
    this.raiz.innerHTML = `
      <div class="marcador">
        <div class="franja" style="background:${a.kit.camiseta}"></div>
        <div class="eq">${a.club.iniciales}</div>
        <div class="goles" id="h-goles">0 - 0</div>
        <div class="eq">${b.club.iniciales}</div>
        <div class="franja" style="background:${b.kit.camiseta}"></div>
        <div class="reloj" id="h-reloj">0'</div>
      </div>
      <div class="relato" id="h-relato"></div>
      <div class="potencia" id="h-potencia"><div></div></div>
      <canvas class="radar" id="h-radar" width="230" height="150"></canvas>
      <div class="jugador-activo" id="h-j1" style="display:none"></div>
      <div class="jugador-activo j2" id="h-j2" style="display:none"></div>
      <div class="jugador-activo" id="h-pos" style="left:50%;transform:translateX(-50%);bottom:auto;top:16px;min-width:0;display:none"></div>
      <div id="h-banner"></div>
      <div id="h-replay"></div>
      <div class="fps" id="h-fps"></div>`;
    this.el = {
      goles: this.raiz.querySelector('#h-goles'), reloj: this.raiz.querySelector('#h-reloj'),
      relato: this.raiz.querySelector('#h-relato'), potencia: this.raiz.querySelector('#h-potencia'),
      radar: this.raiz.querySelector('#h-radar'), j1: this.raiz.querySelector('#h-j1'), j2: this.raiz.querySelector('#h-j2'),
      banner: this.raiz.querySelector('#h-banner'), pos: this.raiz.querySelector('#h-pos'), replay: this.raiz.querySelector('#h-replay'), fps: this.raiz.querySelector('#h-fps'),
    };
    this.ctxRadar = this.el.radar.getContext('2d');
    this.mostrar(true);
  }

  mostrar(v) { this.visible = v; this.raiz.style.display = v ? '' : 'none'; }
  desmontar() { this.raiz.innerHTML = ''; this.partido = null; }

  relato(texto, segundos = 2.5, chico = false) {
    if (!ajustes.relato && chico) return;
    const r = this.el?.relato;
    if (!r) return;
    r.textContent = texto;
    r.classList.toggle('chico', chico);
    r.classList.add('visible');
    this.relatoT = segundos;
  }

  banner(html) {
    if (!this.el) return;
    this.el.banner.innerHTML = html ? `<div class="banner-central">${html}</div>` : '';
  }

  repeticion(v) {
    if (!this.el) return;
    this.el.replay.innerHTML = v ? '<div class="replay-marca">REPETICIÓN</div>' : '';
  }

  potencia(v) {
    if (!this.el) return;
    const p = this.el.potencia;
    if (v === null || v === undefined) { p.style.display = 'none'; return; }
    p.style.display = 'block';
    p.firstElementChild.style.width = `${Math.round(Math.min(1, v) * 100)}%`;
  }

  actualizar(dt, fps) {
    const pa = this.partido;
    if (!pa || !this.el) return;
    if (this.relatoT > 0) {
      this.relatoT -= dt;
      if (this.relatoT <= 0) this.el.relato.classList.remove('visible');
    }
    const [a, b] = pa.equipos;
    const goles = `${a.goles} - ${b.goles}`;
    if (this.el.goles.textContent !== goles) this.el.goles.textContent = goles;
    const reloj = pa.textoReloj();
    if (this.el.reloj.textContent !== reloj) this.el.reloj.textContent = reloj;
    this.el.fps.textContent = ajustes.mostrarFps ? `${Math.round(fps)} FPS` : '';
    // Jugadores controlados
    pa.controles.forEach((c, i) => {
      const el = i === 0 ? this.el.j1 : this.el.j2;
      const j = c.jugador;
      if (!j) { el.style.display = 'none'; return; }
      el.style.display = '';
      el.style.borderLeft = `4px solid ${c.color}`;
      const html = `<span class="dorsal">${j.dorsal}</span>${j.nombre}<div class="estamina"><div style="width:${Math.round(j.estamina * 100)}%"></div></div>`;
      if (el._html !== html) { el.innerHTML = html; el._html = html; }
    });
    for (let i = pa.controles.length; i < 2; i++) (i === 0 ? this.el.j1 : this.el.j2).style.display = 'none';
    const po = pa.poseedor || pa.balonSujeto;
    const txt = po && pa.fase === 'juego' ? `<span class="dorsal" style="background:${po.equipo.kit.camiseta};color:#000">${po.dorsal}</span>${po.nombre}` : '';
    if (this.el.pos._t !== txt) { this.el.pos._t = txt; this.el.pos.innerHTML = txt; this.el.pos.style.display = txt ? '' : 'none'; }
    this.el.radar.style.display = ajustes.radar && pa.fase !== 'repeticion' ? '' : 'none';
    if (ajustes.radar) this.dibujarRadar();
  }

  dibujarRadar() {
    const pa = this.partido, ctx = this.ctxRadar;
    const W = 230, H = 150, m = 6;
    const sx = (W - 2 * m) / (MITAD_L * 2), sz = (H - 2 * m) / (MITAD_A * 2);
    // La cámara de TV mira hacia +Z desde -Z: en pantalla, +X queda a la izquierda.
    const X = (x) => W - (m + (x + MITAD_L) * sx);
    const Y = (z) => H - (m + (z + MITAD_A) * sz);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(20, 70, 30, 0.75)';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1;
    ctx.strokeRect(m, m, W - 2 * m, H - 2 * m);
    ctx.beginPath(); ctx.moveTo(W / 2, m); ctx.lineTo(W / 2, H - m); ctx.stroke();
    ctx.beginPath(); ctx.arc(W / 2, H / 2, 9.15 * sx, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeRect(m, H / 2 - 20.16 * sz, 16.5 * sx, 40.32 * sz);
    ctx.strokeRect(W - m - 16.5 * sx, H / 2 - 20.16 * sz, 16.5 * sx, 40.32 * sz);
    for (const eq of pa.equipos) {
      ctx.fillStyle = eq.kit.camiseta;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      for (const j of eq.jugadores) {
        if (j.expulsado) continue;
        ctx.beginPath(); ctx.arc(X(j.pos.x), Y(j.pos.z), j.controlado ? 4.5 : 3.2, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        if (j.controlado) {
          ctx.strokeStyle = j.controlado.color; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(X(j.pos.x), Y(j.pos.z), 6.5, 0, Math.PI * 2); ctx.stroke();
          ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        }
      }
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(X(pa.balon.pos.x), Y(pa.balon.pos.z), 2.6, 0, Math.PI * 2); ctx.fill();
  }
}

export function aviso(texto, segundos = 3) {
  const cont = document.getElementById('avisos');
  if (!cont) return;
  const d = document.createElement('div');
  d.className = 'aviso';
  d.textContent = texto;
  cont.appendChild(d);
  setTimeout(() => d.classList.add('sale'), segundos * 1000);
  setTimeout(() => d.remove(), segundos * 1000 + 600);
}
