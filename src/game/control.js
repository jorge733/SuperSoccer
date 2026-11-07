// Control humano: traduce el mando/teclado en acciones del jugador seleccionado.
import * as THREE from 'three';
import { clamp, MITAD_L } from '../world/medidas.js';

const COLORES = ['#ffd23f', '#3fd2ff'];
const v = new THREE.Vector3();

export class ControlHumano {
  constructor(partido, dispositivo, equipo, indice) {
    this.p = partido;
    this.disp = dispositivo;
    this.equipo = equipo;
    this.indice = indice;
    this.color = COLORES[indice % 2];
    this.jugador = null;
    this.carga = null;        // { accion, t }
    this.tCambio = 0;
    this.regateT = 0;
    this.crearIndicador();
  }

  crearIndicador() {
    // Anillo bajo el jugador controlado + flecha de dirección
    const g = new THREE.Group();
    const anillo = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.55, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: this.color, transparent: true, opacity: 0.85, depthWrite: false }),
    );
    const flecha = new THREE.Mesh(
      new THREE.ConeGeometry(0.16, 0.36, 3).rotateX(Math.PI / 2).translate(0, 0, 0.82),
      new THREE.MeshBasicMaterial({ color: this.color, transparent: true, opacity: 0.85, depthWrite: false }),
    );
    flecha.position.y = 0.02;
    g.add(anillo, flecha);
    g.renderOrder = 3;
    anillo.position.y = 0.02;
    this.indicador = g;
    this.p.escena.add(g);
    // Marcador sobre la cabeza
    const c = document.createElement('canvas'); c.width = 64; c.height = 64;
    const ctx = c.getContext('2d');
    ctx.fillStyle = this.color;
    ctx.beginPath(); ctx.moveTo(8, 8); ctx.lineTo(56, 8); ctx.lineTo(32, 50); ctx.closePath(); ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = '#000'; ctx.stroke();
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }));
    sp.scale.set(0.45, 0.45, 1);
    sp.renderOrder = 10;
    this.cabeza = sp;
    this.p.escena.add(sp);
  }

  destruir() {
    this.p.escena.remove(this.indicador);
    this.p.escena.remove(this.cabeza);
    if (this.jugador) this.jugador.controlado = null;
  }

  asignar(j) {
    if (this.jugador === j) return;
    if (this.jugador) this.jugador.controlado = null;
    this.jugador = j;
    if (j) { j.controlado = this; j.mirarA = null; j.guardia = 0; }
    this.carga = null;
    this.p.hud?.potencia(null);
  }

  // Dirección del stick en coordenadas del mundo, relativa a la cámara.
  direccion(mx, my) {
    const cam = this.p.camaras.cam;
    cam.getWorldDirection(v);
    let fx = v.x, fz = v.z;
    const l = Math.hypot(fx, fz) || 1; fx /= l; fz /= l;
    const rx = -fz, rz = fx;
    return { x: rx * mx + fx * my, z: rz * mx + fz * my };
  }

  // Elige el mejor compañero para cambiar (el más cercano al balón / mejor para interceptar)
  cambiarJugador(auto = false) {
    const otros = this.p.controles.filter((c) => c !== this).map((c) => c.jugador);
    const cand = this.equipo.jugadores.filter((j) => !j.expulsado && !j.esArquero && j !== this.jugador && !otros.includes(j));
    if (!cand.length) return;
    const b = this.p.balon.pos;
    const d = this.disp;
    const dir = Math.hypot(d.mx, d.my) > 0.4 ? this.direccion(d.mx, d.my) : null;
    let mejor = null, ms = Infinity;
    for (const j of cand) {
      let s = Math.min(j.tInter, 6) + j.pos.distanceTo(b) * 0.05;
      if (dir && !auto) {
        const dx = j.pos.x - this.jugador.pos.x, dz = j.pos.z - this.jugador.pos.z;
        const dl = Math.hypot(dx, dz) || 1;
        s -= ((dx * dir.x + dz * dir.z) / dl) * 2.5;
      }
      if (s < ms) { ms = s; mejor = j; }
    }
    if (mejor) this.asignar(mejor);
    this.tCambio = 0.25;
  }

  // Busca el receptor en la dirección del stick (cono) — prioriza cercanía al eje.
  receptorEnDireccion(dir, maxDist = 50) {
    const j = this.jugador;
    let mejor = null, ms = -Infinity;
    for (const c of this.equipo.jugadores) {
      if (c === j || c.expulsado) continue;
      const dx = c.pos.x - j.pos.x, dz = c.pos.z - j.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 2 || d > maxDist) continue;
      const cos = (dx * dir.x + dz * dir.z) / d;
      if (cos < 0.55) continue;
      const s = cos * 3 - d / 30 - (c.esArquero ? 1.5 : 0);
      if (s > ms) { ms = s; mejor = c; }
    }
    return mejor;
  }

  actualizar(dt) {
    const p = this.p;
    const d = this.disp;
    const j = this.jugador;
    this.tCambio -= dt;
    if (!j) return;
    if (j.expulsado) { this.cambiarJugador(true); return; }
    const conBalon = p.poseedor === j;
    const dir = this.direccion(d.mx, d.my);
    const mag = Math.min(1, Math.hypot(d.mx, d.my));
    const sprint = d.gatillo > 0.3;
    const juego = p.fase === 'juego';
    const ejecutor = p.ejecutorPelotaParada === j && p.fase === 'detenido' && p.listoParaSacar;

    // Movimiento
    if (j.puedeActuar() && (juego || p.fase === 'detenido') && !ejecutor) {
      j.mover(dir.x, dir.z, mag, sprint, dt, conBalon);
      j.proteger = conBalon && d.mantenido('proteger') ? 1 : 0;
      if (j.proteger) j.mover(dir.x, dir.z, mag * 0.55, false, dt, true);
      j.mirarA = null;
      j.guardia = !conBalon && p.equipoEnPosesion && p.equipoEnPosesion !== this.equipo && d.mantenido('pase') ? 0.6 : 0;
    } else if (ejecutor) {
      j.mover(0, 0, 0, false, dt);
      // Apuntar con el stick
      if (mag > 0.3) j.rumbo = Math.atan2(dir.x, dir.z);
    }

    // Regate con el stick derecho
    if (conBalon && juego && Math.hypot(d.rx, d.ry) > 0.7 && this.regateT <= 0) {
      const rd = this.direccion(d.rx, d.ry);
      p.regate(j, rd);
      this.regateT = 0.6;
    }
    this.regateT -= dt;
    // Cámara con el stick derecho cuando no se lleva el balón
    if (!conBalon) {
      p.camaras.offsetStick.x += (d.rx - p.camaras.offsetStick.x) * Math.min(1, dt * 4);
      p.camaras.offsetStick.y += (d.ry - p.camaras.offsetStick.y) * Math.min(1, dt * 4);
    }

    if (d.presionado('camara')) p.cambiarCamara();
    if (d.presionado('pausa')) { p.pedirPausa(this); return; }
    if (!(juego || ejecutor)) { this.carga = null; p.hud?.potencia(null); return; }

    // ---------- Con balón o ejecutando pelota parada ----------
    if (conBalon || ejecutor) {
      const dirAccion = mag > 0.25 ? dir : { x: Math.sin(j.rumbo), z: Math.cos(j.rumbo) };
      if (ejecutor && p.tipoParada === 'banda') {
        if (d.presionado('pase') || d.presionado('filtrado')) p.lanzarBanda(j, this.receptorEnDireccion(dirAccion, 30));
        else if (d.presionado('paseLargo') || d.presionado('tiro')) p.lanzarBanda(j, this.receptorEnDireccion(dirAccion, 45), true);
        return;
      }
      // Acciones con carga (tiro y pase largo)
      for (const acc of ['tiro', 'paseLargo']) {
        if (d.presionado(acc) && !this.carga) this.carga = { accion: acc, t: 0 };
      }
      if (this.carga) {
        this.carga.t += dt;
        const pot = clamp(this.carga.t / 0.9, 0.15, 1);
        p.hud?.potencia(pot);
        const soltado = !d.mantenido(this.carga.accion);
        if (soltado || this.carga.t > 1.15) {
          const acc = this.carga.accion;
          this.carga = null;
          p.hud?.potencia(null);
          if (acc === 'tiro') {
            const zObj = mag > 0.25 ? clamp(dir.z * 3.6, -3.4, 3.4) : 0;
            p.tiro(j, pot, { z: zObj, alto: clamp(pot - 0.35, 0, 0.8), humano: true });
          } else {
            const r = this.receptorEnDireccion(dirAccion, 70);
            const enBanda = Math.abs(j.pos.z) > 18 && (j.pos.x * this.equipo.dir) > 25;
            if (enBanda && (!r || Math.abs(r.pos.z) < 16)) {
              p.centro(j, new THREE.Vector3(this.equipo.dir * (MITAD_L - 9 + (1 - pot) * 4), 0, dirAccion.z * 4), 1, pot);
            } else if (r) p.pase(j, r, 'alto', pot);
            else p.paseAPunto(j, { x: j.pos.x + dirAccion.x * (15 + pot * 30), z: j.pos.z + dirAccion.z * (15 + pot * 30) }, 'alto');
          }
        }
        return;
      }
      if (d.presionado('pase')) {
        const r = this.receptorEnDireccion(dirAccion, 45);
        if (r) p.pase(j, r, 'raso');
        else p.paseAPunto(j, { x: j.pos.x + dirAccion.x * 14, z: j.pos.z + dirAccion.z * 14 }, 'raso');
      } else if (d.presionado('filtrado')) {
        const r = this.receptorEnDireccion(dirAccion, 55);
        if (r) p.pase(j, r, 'filtrado');
        else p.paseAPunto(j, { x: j.pos.x + dirAccion.x * 20, z: j.pos.z + dirAccion.z * 20 }, 'raso');
      }
      return;
    }

    this.carga = null;
    p.hud?.potencia(null);
    const propio = p.equipoEnPosesion === this.equipo;
    // ---------- Sin balón ----------
    if (d.presionado('cambiar') && this.tCambio <= 0) { this.cambiarJugador(); return; }
    if (propio) {
      // Pedir el pase al compañero que lleva el balón
      if (d.presionado('pase') && p.poseedor && !p.poseedor.controlado) p.pedirPase(p.poseedor, j);
      if (d.presionado('filtrado') && p.poseedor && !p.poseedor.controlado) p.pedirPase(p.poseedor, j, 'filtrado');
      return;
    }
    // Defensa
    if (d.presionado('tiro')) p.barrida(j);
    else if (d.presionado('pase')) {
      if (p.poseedor && p.poseedor.equipo !== this.equipo && p.poseedor.pos.distanceTo(j.pos) < 2.2) p.entrada(j);
    }
    // Mantener A: presionar automáticamente al portador
    if (d.mantenido('pase') && p.poseedor && p.poseedor.equipo !== this.equipo && mag < 0.2) {
      const pie = p.poseedor.puntoPie(0.8);
      j.mover(pie.x - j.pos.x, pie.z - j.pos.z, 1, sprint, dt);
      j.mirarA = p.balon.pos;
    }
    if (d.presionado('paseLargo')) p.pedirPresion(this.equipo);
  }

  actualizarIndicador(dt) {
    const j = this.jugador;
    const vis = !!j && !j.expulsado && this.p.fase !== 'repeticion' && this.p.fase !== 'presentacion';
    this.indicador.visible = vis;
    this.cabeza.visible = vis;
    if (!vis) return;
    this.indicador.position.set(j.pos.x, 0, j.pos.z);
    this.indicador.rotation.y = j.rumbo;
    const alt = (j.datos?.apariencia?.altura || 1.8) + 0.45;
    this.cabeza.position.set(j.pos.x, alt + Math.sin(performance.now() / 200) * 0.05, j.pos.z);
  }
}
