// IA de equipo: ubicación según formación, presión, marca, desmarques y decisiones con el balón.
import * as THREE from 'three';
import { FORMACIONES } from './formaciones.js';
import { clamp, MITAD_L, MITAD_A, CANCHA, azar } from '../world/medidas.js';

export const DIFICULTAD = {
  facil: { reaccion: 0.5, decision: 0.65, errorPase: 1.7, errorTiro: 1.5, presion: 0.55, vel: 0.9, entrada: 0.75, arquero: 0.8, nombre: 'Fácil' },
  normal: { reaccion: 0.3, decision: 0.42, errorPase: 1.0, errorTiro: 1.0, presion: 0.85, vel: 0.97, entrada: 1.0, arquero: 1.0, nombre: 'Normal' },
  dificil: { reaccion: 0.16, decision: 0.26, errorPase: 0.6, errorTiro: 0.7, presion: 1.0, vel: 1.0, entrada: 1.2, arquero: 1.15, nombre: 'Difícil' },
};

const v1 = new THREE.Vector3(), v2 = new THREE.Vector3();

// Distancia de un punto a un segmento (en el plano XZ)
function distSegmento(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const l2 = dx * dx + dz * dz || 1e-6;
  let t = ((px - ax) * dx + (pz - az) * dz) / l2;
  t = clamp(t, 0, 1);
  const cx = ax + dx * t, cz = az + dz * t;
  return { d: Math.hypot(px - cx, pz - cz), t };
}

export class IAEquipo {
  constructor(partido, equipo, dificultad = 'normal') {
    this.p = partido;
    this.eq = equipo;
    this.dif = DIFICULTAD[dificultad] || DIFICULTAD.normal;
    this.tDecision = new Map();
    this.desmarque = new Map(); // jugador -> {x,z,t}
    this.tPresion = 0;
  }

  get rival() { return this.p.equipos[1 - this.eq.indice]; }

  // x normalizado (0 = arco propio, 1 = arco rival) -> x mundo
  aMundoX(xn) { return (xn * 2 * MITAD_L - MITAD_L) * this.eq.dir; }
  aNormX(x) { return (x * this.eq.dir + MITAD_L) / (2 * MITAD_L); }
  arcoRival() { return v2.set(MITAD_L * this.eq.dir, 0, 0); }

  // Posición táctica según formación, balón y fase (ataque/defensa).
  posicionTactica(j, salida = new THREE.Vector3()) {
    const f = (FORMACIONES[this.eq.formacion] || FORMACIONES['4-4-2'])[j.indice];
    const b = this.p.balon.pos;
    const bxn = this.aNormX(b.x);
    const bzn = clamp(b.z / MITAD_A, -1, 1);
    const ataque = this.p.equipoEnPosesion === this.eq;
    let xn, zn;
    if (ataque) {
      xn = f.x + (bxn - 0.42) * 0.75 + 0.07;
      zn = f.z * 1.05 + bzn * 0.2;
    } else {
      xn = f.x + (bxn - 0.5) * 0.62 - 0.06;
      zn = f.z * 0.72 + bzn * 0.3;
    }
    if (f.rol === 'DEF') xn = clamp(xn, 0.07, ataque ? 0.62 : 0.48);
    else if (f.rol === 'VOL') xn = clamp(xn, 0.15, 0.82);
    else xn = clamp(xn, 0.3, 0.92);
    // No quedar en fuera de juego: no pasar la línea del penúltimo defensor rival
    if (ataque) {
      const linea = this.aNormX(this.p.lineaOffside(this.rival));
      xn = Math.min(xn, Math.max(linea - 0.008, 0.5));
    }
    salida.set(this.aMundoX(xn), 0, clamp(zn * (MITAD_A - 3) * this.eq.dir, -MITAD_A + 1.5, MITAD_A - 1.5));
    return salida;
  }

  actualizar(dt) {
    const p = this.p;
    const eq = this.eq;
    const ataque = p.equipoEnPosesion === eq;
    const poseedor = p.poseedor;
    // Perseguidores: los de menor tiempo de intercepción
    const candidatos = eq.jugadores.filter((j) => j.puedeActuar() && !j.esArquero && !j.expulsado);
    candidatos.sort((a, b) => a.tInter - b.tInter);
    const humanos = eq.jugadores.filter((j) => j.controlado);
    const tHumano = humanos.length ? Math.min(...humanos.map((h) => h.tInter)) : Infinity;
    let perseguidor = null, apoyo = null;
    const libre = !poseedor && !p.balonSujeto;
    if (!ataque || libre) {
      for (const j of candidatos) {
        if (j.controlado) continue;
        // Si un humano está razonablemente cerca, la IA no le roba la persecución
        if (humanos.length && j.tInter > tHumano - 0.6) continue;
        if (!perseguidor) perseguidor = j; else if (!apoyo) { apoyo = j; break; }
      }
      if (libre && humanos.length && perseguidor && tHumano < perseguidor.tInter + 0.3) perseguidor = null;
    }
    if (this.apoyoForzado > 0) this.apoyoForzado -= dt;

    for (const j of eq.jugadores) {
      if (j.expulsado || j.controlado) continue;
      if (j.esArquero) { this.arquero(j, dt); continue; }
      if (!j.puedeActuar()) { j.mover(0, 0, 0, false, dt); continue; }
      j.mirarA = null;
      j.guardia = 0;
      j.proteger = 0;
      if (j === poseedor) { this.conBalon(j, dt); continue; }
      if (j === perseguidor) { this.perseguir(j, dt); continue; }
      const presionAlta = !ataque && poseedor && (j === apoyo) && (this.dif.presion > 0.7 || this.apoyoForzado > 0);
      if (presionAlta) { this.cubrir(j, dt, poseedor); continue; }
      this.sinBalon(j, dt, ataque);
    }
  }

  irA(j, x, z, dt, { urgencia = 0.5, mirarBalon = false, dist = 0.6 } = {}) {
    const dx = x - j.pos.x, dz = z - j.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < dist) { j.mover(0, 0, 0, false, dt); }
    else {
      const mag = clamp(d / 3, 0.25, 1);
      j.mover(dx, dz, mag, (d > 9 && urgencia > 0.4) || urgencia > 0.85, dt);
    }
    j.multVel = this.dif.vel;
    if (mirarBalon || d < 2.5) j.mirarA = this.p.balon.pos;
  }

  perseguir(j, dt) {
    const p = this.p;
    const obj = j.puntoInter || p.balon.pos;
    // Si el rival tiene el balón: ir a su pie, y entrar cuando esté cerca
    const pos = p.poseedor;
    if (pos && pos.equipo !== this.eq) {
      const pie = pos.puntoPie(0.7, v1);
      // Posición entre el rival y el arco propio
      const ax = -MITAD_L * this.eq.dir;
      const k = 0.85;
      const tx = pie.x + (ax - pie.x) * 0.06 * k, tz = pie.z * (1 - 0.04 * k);
      this.irA(j, tx, tz, dt, { urgencia: 0.9, mirarBalon: true, dist: 0.2 });
      j.guardia = j.pos.distanceTo(pie) < 4 ? 0.5 : 0;
      const d = j.pos.distanceTo(pie);
      const t = (this.tDecision.get(j) || 0) - dt;
      this.tDecision.set(j, t);
      if (d < 1.6 && t <= 0) {
        this.tDecision.set(j, this.dif.reaccion + azar(0.2, 0.6));
        if (Math.random() < 0.55 * this.dif.entrada) p.entrada(j);
      } else if (d < 3.2 && d > 1.8 && t <= 0 && Math.random() < 0.012 * this.dif.entrada) {
        // barrida ocasional, más probable si el rival se escapa hacia el arco
        const haciaArco = Math.sign(pos.vel.x) === -this.eq.dir;
        if (haciaArco || Math.random() < 0.3) { p.barrida(j); this.tDecision.set(j, 1.5); }
      }
      return;
    }
    this.irA(j, obj.x, obj.z, dt, { urgencia: 0.95, dist: 0.1 });
  }

  cubrir(j, dt, rival) {
    // Segundo hombre: se ubica entre el rival y el arco a unos 4 m
    const ax = -MITAD_L * this.eq.dir;
    const dx = ax - rival.pos.x, dz = -rival.pos.z;
    const d = Math.hypot(dx, dz) || 1;
    this.irA(j, rival.pos.x + (dx / d) * 4.5, rival.pos.z + (dz / d) * 4.5, dt, { urgencia: 0.7, mirarBalon: true });
    j.guardia = 0.4;
  }

  sinBalon(j, dt, ataque) {
    const p = this.p;
    const obj = this.posicionTactica(j, v1);
    if (ataque) {
      // Desmarques: los delanteros y volantes atacan el espacio a la espalda de la defensa
      let dm = this.desmarque.get(j);
      if (dm && (dm.t -= dt) <= 0) { this.desmarque.delete(j); dm = null; }
      const bxn = this.aNormX(p.balon.pos.x);
      if (!dm && (j.rol === 'DEL' || (j.rol === 'VOL' && Math.random() < 0.3)) && bxn > 0.3 && Math.random() < dt * 0.25) {
        const linea = this.p.lineaOffside(this.rival);
        const zx = clamp(j.pos.z + azar(-8, 8), -MITAD_A + 4, MITAD_A - 4);
        dm = { x: linea + this.eq.dir * azar(6, 14), z: zx, t: azar(2.5, 4) };
        // espera a estar habilitado antes de partir
        if (Math.abs(j.pos.x - linea) < 4 || j.pos.x * this.eq.dir < linea * this.eq.dir) this.desmarque.set(j, dm);
      }
      if (dm) {
        this.irA(j, clamp(dm.x, -MITAD_L + 2, MITAD_L - 2), dm.z, dt, { urgencia: 0.9 });
        return;
      }
      // Ofrecer línea de pase: alejarse del rival más cercano
      const rc = p.rivalMasCercano(j);
      if (rc && rc.d < 5) {
        obj.x += (j.pos.x - rc.j.pos.x) / rc.d * 2.5;
        obj.z += (j.pos.z - rc.j.pos.z) / rc.d * 2.5;
      }
      this.irA(j, obj.x, obj.z, dt, { urgencia: 0.45 });
    } else {
      // Marca zonal + marca al hombre cercano (lado del arco)
      let mejor = null, dm = 9;
      for (const r of this.rival.jugadores) {
        if (r.expulsado || r.esArquero) continue;
        const d = Math.hypot(r.pos.x - obj.x, r.pos.z - obj.z);
        if (d < dm) { dm = d; mejor = r; }
      }
      if (mejor && j.rol !== 'DEL') {
        const ax = -MITAD_L * this.eq.dir;
        const dx = ax - mejor.pos.x, dz = -mejor.pos.z, d = Math.hypot(dx, dz) || 1;
        const k = j.rol === 'DEF' ? 0.7 : 0.5;
        obj.x += ((mejor.pos.x + (dx / d) * 1.8) - obj.x) * k;
        obj.z += ((mejor.pos.z + (dz / d) * 1.8) - obj.z) * k;
      }
      this.irA(j, obj.x, obj.z, dt, { urgencia: 0.6, mirarBalon: true });
    }
  }

  // ---------- Con el balón ----------
  conBalon(j, dt) {
    const p = this.p;
    if (p.fase !== 'juego') return;
    const t = (this.tDecision.get(j) ?? this.dif.decision) - dt;
    this.tDecision.set(j, t);
    const arco = this.arcoRival();
    const dGol = Math.hypot(arco.x - j.pos.x, j.pos.z);
    const presion = p.rivalMasCercano(j);
    const presionado = presion && presion.d < 2.6;
    // Dirección de conducción: hacia el arco esquivando rivales
    let dx = arco.x - j.pos.x, dz = (dGol < 25 ? 0 : j.pos.z * 0.3) - j.pos.z;
    const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
    for (const r of this.rival.jugadores) {
      if (r.expulsado) continue;
      const rx = j.pos.x - r.pos.x, rz = j.pos.z - r.pos.z;
      const d = Math.hypot(rx, rz);
      if (d < 7 && d > 0.01) {
        const delante = (r.pos.x - j.pos.x) * dx + (r.pos.z - j.pos.z) * dz > -1;
        if (delante) { dx += (rx / d) * (7 - d) / 7 * 1.3; dz += (rz / d) * (7 - d) / 7 * 1.3; }
      }
    }
    if (Math.abs(j.pos.z) > MITAD_A - 5) dz -= Math.sign(j.pos.z) * 0.8;
    if (Math.abs(j.pos.x) > MITAD_L - 3 && dGol > 10) dx -= Math.sign(j.pos.x) * 0.5;
    const sprint = !presionado && dGol > 18 && j.estamina > 0.3;
    j.mover(dx, dz, 1, sprint, dt, true);
    j.multVel = this.dif.vel;

    if (t > 0 && !(presionado && t < this.dif.decision * 0.5)) return;
    this.tDecision.set(j, this.dif.decision * azar(0.7, 1.3));

    // 1) Tiro
    const calidadTiro = this.calidadTiro(j, dGol);
    const umbral = dGol < 14 ? 0.05 : dGol < 20 ? 0.22 : 0.4;
    if (calidadTiro > umbral + azar(-0.08, 0.08)) {
      const pot = clamp(0.55 + dGol / 40 + azar(-0.1, 0.15), 0.4, 1);
      const zObj = (Math.random() < 0.5 ? -1 : 1) * azar(1.2, 3.2);
      p.tiro(j, pot, { z: zObj, alto: azar(0.1, 0.75), errorExtra: this.dif.errorTiro });
      return;
    }
    // 2) Centro desde la banda
    const xn = this.aNormX(j.pos.x);
    if (xn > 0.78 && Math.abs(j.pos.z) > 15) {
      const enArea = this.eq.jugadores.filter((c) => c !== j && !c.expulsado && this.aNormX(c.pos.x) > 0.8 && Math.abs(c.pos.z) < 14);
      if (enArea.length && (Math.random() < 0.6 || presionado)) {
        const dest = enArea[Math.floor(Math.random() * enArea.length)];
        p.centro(j, new THREE.Vector3(dest.pos.x + this.eq.dir * azar(-1, 2), 0, dest.pos.z + azar(-1.5, 1.5)), this.dif.errorPase);
        return;
      }
    }
    // 3) Pase
    const op = this.mejorPase(j);
    const avance = op ? op.score : -1;
    const libreAdelante = !presion || presion.d > 5 || this.libreHacia(j, dx, dz, 5);
    if (op && (presionado || avance > 0.9 || (!libreAdelante && avance > 0.2) || Math.random() < 0.18 * (avance > 0.4 ? 1 : 0))) {
      if (op.tipo === 'filtrado') p.pase(j, op.j, 'filtrado', null, this.dif.errorPase);
      else if (op.tipo === 'alto') p.pase(j, op.j, 'alto', null, this.dif.errorPase);
      else p.pase(j, op.j, 'raso', null, this.dif.errorPase);
      return;
    }
    // 4) Despeje si está muy presionado en su área
    if (presionado && xn < 0.2) { p.despeje(j); return; }
    // 5) Si no hay nada, proteger y seguir
    if (presionado && Math.random() < 0.4) j.proteger = 1;
  }

  libreHacia(j, dx, dz, dist) {
    for (const r of this.rival.jugadores) {
      if (r.expulsado) continue;
      const rx = r.pos.x - j.pos.x, rz = r.pos.z - j.pos.z;
      const proy = rx * dx + rz * dz;
      if (proy > 0 && proy < dist && Math.abs(rx * dz - rz * dx) < 2) return false;
    }
    return true;
  }

  calidadTiro(j, dGol) {
    if (dGol > 32) return 0;
    const arcoX = MITAD_L * this.eq.dir;
    const angulo = Math.atan2(CANCHA.anchoArco, Math.max(1, dGol)) * (1 - Math.min(1, Math.abs(j.pos.z) / (dGol + 1)) * 0.7);
    let q = (1 - dGol / 32) * 0.75 + angulo * 0.9 + (j.at.tiro - 60) / 100;
    // Bloqueos en la línea de tiro
    for (const r of this.rival.jugadores) {
      if (r.expulsado || r.esArquero) continue;
      const { d, t } = distSegmento(r.pos.x, r.pos.z, j.pos.x, j.pos.z, arcoX, 0);
      if (t > 0.05 && t < 0.9 && d < 0.9) q -= 0.14;
    }
    return q;
  }

  mejorPase(j) {
    const p = this.p;
    let mejor = null;
    const xnJ = this.aNormX(j.pos.x);
    for (const c of this.eq.jugadores) {
      if (c === j || c.expulsado || !c.puedeActuar()) continue;
      if (c.esArquero && xnJ > 0.3) continue;
      const d = j.pos.distanceTo(c.pos);
      if (d < 4 || d > 42) continue;
      // ¿Fuera de juego?
      if (p.estaEnOffside(c, j)) continue;
      for (const tipo of ['raso', 'filtrado']) {
        let tx = c.pos.x, tz = c.pos.z;
        if (tipo === 'filtrado') {
          const vel = Math.hypot(c.vel.x, c.vel.z);
          if (vel < 4 || Math.sign(c.vel.x) !== this.eq.dir) continue;
          const lead = clamp(d / 14, 0.6, 2.2);
          tx += c.vel.x * lead; tz += c.vel.z * lead;
          if (Math.abs(tx) > MITAD_L - 1 || Math.abs(tz) > MITAD_A - 1) continue;
        }
        // Seguridad de la línea de pase
        let seguridad = 3;
        for (const r of this.rival.jugadores) {
          if (r.expulsado) continue;
          const s = distSegmento(r.pos.x, r.pos.z, j.pos.x, j.pos.z, tx, tz);
          const alcance = 0.9 + s.t * d * 0.09;
          seguridad = Math.min(seguridad, s.d - alcance);
        }
        let alto = false;
        if (seguridad < 0.3) {
          if (d > 18 && seguridad > -2.5) alto = true; else continue;
        }
        const rc = p.rivalMasCercanoA(tx, tz, this.eq);
        const espacio = clamp(rc ? rc.d / 8 : 1, 0, 1);
        const progreso = (tx - j.pos.x) * this.eq.dir / 25;
        const xnR = this.aNormX(tx);
        const ultimoTercio = xnJ > 0.66;
        let score = progreso * (ultimoTercio && progreso < 0 ? 2.2 : 1.1) + espacio * 0.7 + Math.min(seguridad, 2) * 0.15 - (d > 30 ? 0.3 : 0) + (xnR > 0.8 ? 0.3 : 0);
        if (tipo === 'filtrado') score += 0.25;
        if (c.esArquero) score -= 0.6;
        if (alto) score -= 0.25;
        score += azar(-0.12, 0.12) * this.dif.errorPase;
        if (!mejor || score > mejor.score) mejor = { j: c, score, tipo: alto ? 'alto' : tipo };
      }
    }
    return mejor;
  }

  // ---------- Arquero ----------
  arquero(j, dt) {
    const p = this.p;
    const b = p.balon.pos;
    const ax = -MITAD_L * this.eq.dir;
    j.guardia = 0;
    j.mirarA = b;
    if (!j.puedeActuar()) { j.mover(0, 0, 0, false, dt); return; }
    if (p.balonSujeto === j) { this.arqueroConBalon(j, dt); return; }
    const amenaza = p.tiroEnCurso && p.tiroEnCurso.defensor === this.eq;
    const dBalon = Math.hypot(b.x - ax, b.z);
    // Salir a cortar balones sueltos en su área
    const enArea = Math.abs(b.x - ax) < CANCHA.areaGrande.largo && Math.abs(b.z) < CANCHA.areaGrande.ancho / 2;
    const libre = !p.poseedor || p.poseedor.equipo !== this.eq;
    if (!amenaza && enArea && libre && j.tInter < 3 && (!p.poseedor || p.poseedor.pos.distanceTo(j.pos) < 3) && this.esMasRapido(j)) {
      const o = j.puntoInter || b;
      this.irA(j, o.x, o.z, dt, { urgencia: 1, dist: 0.1 });
      return;
    }
    if (amenaza) {
      const t = p.tiroEnCurso;
      const dz = t.z - j.pos.z;
      // Desplazarse lateralmente mientras se pueda; tirarse si no alcanza
      j.guardia = 1;
      if (!t.reaccionado && t.tRestante < 0.5 + (1 - this.dif.arquero) * 0.15) {
        t.reaccionado = true;
        p.reaccionArquero(j, t);
      } else {
        this.irA(j, ax + this.eq.dir * 0.8, clamp(t.z, -3.2, 3.2), dt, { urgencia: 1, mirarBalon: true, dist: 0.05 });
      }
      return;
    }
    // Posicionamiento: sobre la bisectriz balón-arco, adelantado según la distancia
    const sal = clamp(1.2 + (dBalon - 10) * 0.08, 0.8, dBalon < 30 ? 5 : 9);
    const ang = Math.atan2(b.z, (b.x - ax) * this.eq.dir);
    const tx = ax + Math.cos(ang) * sal * this.eq.dir;
    const tz = clamp(Math.sin(ang) * sal, -3, 3);
    this.irA(j, tx, tz, dt, { urgencia: dBalon < 25 ? 0.8 : 0.4, mirarBalon: true, dist: 0.15 });
    j.guardia = dBalon < 35 ? 1 : 0.3;
  }

  esMasRapido(j) {
    for (const r of this.rival.jugadores) if (!r.expulsado && r.tInter < j.tInter - 0.2) return false;
    return true;
  }

  arqueroConBalon(j, dt) {
    const p = this.p;
    j.mover(0, 0, 0, false, dt);
    this.tSaque = (this.tSaque ?? azar(1.2, 2.4)) - dt;
    // Mirar hacia la cancha
    j.mirarA = v1.set(j.pos.x + this.eq.dir * 10, 0, j.pos.z);
    if (this.tSaque > 0) return;
    this.tSaque = undefined;
    // Saque: buscar compañero libre cercano, si no, saque largo
    let mejor = null, ms = -Infinity;
    for (const c of this.eq.jugadores) {
      if (c === j || c.expulsado) continue;
      const d = c.pos.distanceTo(j.pos);
      const rc = p.rivalMasCercano(c);
      const libre = rc ? rc.d : 10;
      const s = libre * 0.5 - Math.abs(d - 22) * 0.08 + (c.rol === 'DEF' ? 0.3 : 0);
      if (s > ms) { ms = s; mejor = c; }
    }
    if (mejor && ms > 2.2) p.saqueArquero(j, mejor, mejor.pos.distanceTo(j.pos) > 25 ? 'alto' : 'mano');
    else {
      const dest = this.eq.jugadores.filter((c) => c.rol === 'DEL' && !c.expulsado)[0] || mejor;
      p.saqueArquero(j, dest, 'largo');
    }
  }
}
