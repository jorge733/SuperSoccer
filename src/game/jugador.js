// Jugador en la cancha: modelo 3D + animador + cuerpo físico + movimiento (aceleración, giro, sprint).
import * as THREE from 'three';
import { crearModelo } from '../players/humano.js';
import { Animador } from '../players/animacion.js';
import { texturaCamiseta } from '../players/camiseta.js';
import { angDif, clamp, MITAD_L, MITAD_A } from '../world/medidas.js';

const tmp = new THREE.Vector3();

export class Jugador {
  constructor({ escena, fisica, datos, equipo = null, indice = 0, rol = 'VOL', kit, esArquero = false, esArbitro = false }) {
    this.datos = datos;
    this.equipo = equipo;
    this.indice = indice;
    this.rol = rol;
    this.esArquero = esArquero;
    this.esArbitro = esArbitro;
    this.nombre = datos?.camiseta || 'Árbitro';
    this.dorsal = datos?.dorsal ?? 0;
    const at = datos?.atributos || { velocidad: 70, tiro: 50, pase: 50, regate: 50, defensa: 50, fisico: 70, arquero: 30 };
    this.at = at;
    this.modelo = crearModelo(datos?.apariencia || {});
    this.animador = new Animador(this.modelo);
    this.grupo = this.modelo.grupo;
    escena.add(this.grupo);
    this.fisica = fisica;
    if (fisica && !esArbitro) {
      const { cuerpo } = fisica.crearCuerpoJugador(datos?.apariencia?.altura || 1.8);
      this.cuerpo = cuerpo;
    }
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.rumbo = 0;           // ángulo: 0 = mirando hacia +Z
    this.velMax = 6.6 + at.velocidad * 0.026;   // sprint ~ 8,4 - 9,1 m/s
    this.acel = 10 + at.velocidad * 0.04;
    this.estamina = 1;
    this.estado = 'libre';    // libre | accion | caido | barrida | estirada | celebrando | expulsado
    this.tEstado = 0;
    this.objetivo = new THREE.Vector3();
    this.mirarA = null;        // si se fija, el jugador mira ese punto mientras se mueve
    this.deseo = new THREE.Vector3(); // velocidad deseada calculada por IA/control
    this.sprint = false;
    this.amarillas = 0;
    this.expulsado = false;
    this.goles = 0;
    this.controlado = null;    // controlador humano asignado
    this.pendiente = null;     // patada programada {t, fn}
    this.guardia = 0;
    this.proteger = 0;
    this.enfriamiento = 0;     // tiempo antes de poder volver a tocar el balón
    this.sinControl = 0;       // tras perder una disputa
    if (kit) this.vestir(kit);
  }

  vestir(kit) {
    this.kit = kit;
    this.modelo.colorear(kit, this.esArquero);
    this.modelo.fijarTexturaCamiseta(texturaCamiseta(kit, this.esArbitro ? null : this.dorsal, this.esArbitro ? '' : this.nombre));
  }

  colocar(x, z, rumbo = null) {
    this.pos.set(x, 0, z);
    this.vel.set(0, 0, 0);
    if (rumbo !== null) this.rumbo = rumbo;
    this.sincronizar();
  }

  mirarHacia(x, z) { this.rumbo = Math.atan2(x - this.pos.x, z - this.pos.z); }

  get adelante() { return tmp.set(Math.sin(this.rumbo), 0, Math.cos(this.rumbo)); }

  // Punto delante del pie donde se lleva el balón.
  puntoPie(dist = 0.55, salida = new THREE.Vector3()) {
    return salida.set(this.pos.x + Math.sin(this.rumbo) * dist, 0, this.pos.z + Math.cos(this.rumbo) * dist);
  }

  puedeActuar() { return this.estado === 'libre' && !this.expulsado; }

  fijarEstado(e, t = 0) { this.estado = e; this.tEstado = t; }

  // dir: vector (x,z) deseado normalizado * magnitud (0..1)
  mover(dx, dz, magnitud, sprint, dt, conBalon = false) {
    const max = this.velocidadMaxima(sprint, conBalon) * clamp(magnitud, 0, 1);
    const largo = Math.hypot(dx, dz);
    let vx = 0, vz = 0;
    if (largo > 1e-3) { vx = (dx / largo) * max; vz = (dz / largo) * max; }
    this.deseo.set(vx, 0, vz);
    this.sprint = sprint && largo > 0.1;
  }

  velocidadMaxima(sprint, conBalon) {
    const base = this.velMax * (sprint ? 1 : 0.72) * (0.75 + 0.25 * this.estamina);
    return base * (conBalon ? 0.9 + this.at.regate * 0.0006 : 1) * (this.multVel || 1);
  }

  actualizar(dt) {
    this.tEstado -= dt;
    this.enfriamiento = Math.max(0, this.enfriamiento - dt);
    this.sinControl = Math.max(0, this.sinControl - dt);
    if (this.pendiente) {
      this.pendiente.t -= dt;
      if (this.pendiente.t <= 0) { const f = this.pendiente.fn; this.pendiente = null; f(); }
    }
    let desV = this.deseo;
    let giroMax = 9;
    switch (this.estado) {
      case 'caido':
        desV = tmp.set(0, 0, 0);
        if (this.tEstado <= 0) this.fijarEstado('libre');
        break;
      case 'estirada':
      case 'barrida':
        // deslizamiento: conserva la velocidad que traía y frena de a poco
        this.vel.multiplyScalar(Math.exp((this.estado === 'estirada' ? -2.6 : -1.6) * dt));
        if (this.tEstado <= 0) this.fijarEstado('libre');
        desV = null;
        break;
      case 'accion':
        giroMax = 3;
        desV = tmp.copy(this.deseo).multiplyScalar(0.35);
        if (this.tEstado <= 0) this.fijarEstado('libre');
        break;
      case 'celebrando':
        if (this.tEstado <= 0 && this.tEstado > -100) this.fijarEstado('libre');
        break;
      default: break;
    }
    // Aceleración limitada
    if (desV) {
      const dvx = desV.x - this.vel.x, dvz = desV.z - this.vel.z;
      const dv = Math.hypot(dvx, dvz);
      const frenando = desV.lengthSq() < this.vel.lengthSq();
      const a = (frenando ? this.acel * 1.5 : this.acel) * dt;
      if (dv > a) { this.vel.x += (dvx / dv) * a; this.vel.z += (dvz / dv) * a; } else { this.vel.x = desV.x; this.vel.z = desV.z; }
    }
    // Estamina: el sprint cansa, caminar recupera
    const rapidez = Math.hypot(this.vel.x, this.vel.z);
    if (this.sprint && rapidez > 5) this.estamina = Math.max(0, this.estamina - dt * (0.05 - this.at.fisico * 0.0003));
    else this.estamina = Math.min(1, this.estamina + dt * 0.025);

    this.pos.addScaledVector(this.vel, dt);
    // Límites (fuera de la cancha se puede ir un poco)
    this.pos.x = clamp(this.pos.x, -MITAD_L - 4, MITAD_L + 4);
    this.pos.z = clamp(this.pos.z, -MITAD_A - 3, MITAD_A + 3);

    // Orientación: hacia donde corre, o hacia el punto que debe mirar
    if (this.estado !== 'barrida' && this.estado !== 'estirada' && this.estado !== 'caido') {
      let objetivoRumbo = null;
      if (this.mirarA) objetivoRumbo = Math.atan2(this.mirarA.x - this.pos.x, this.mirarA.z - this.pos.z);
      else if (rapidez > 0.4) objetivoRumbo = Math.atan2(this.vel.x, this.vel.z);
      if (objetivoRumbo !== null) {
        const d = angDif(this.rumbo, objetivoRumbo);
        const g = giroMax * (rapidez > 6 ? 0.7 : 1) * dt;
        this.rumbo += clamp(d, -g, g);
      }
    }

    // Animación: velocidad en coordenadas locales
    const s = Math.sin(this.rumbo), c = Math.cos(this.rumbo);
    const vz = this.vel.x * s + this.vel.z * c;
    const vx = this.vel.x * c - this.vel.z * s;
    this.animador.actualizar(dt, { vx, vz, guardia: this.guardia, proteger: this.proteger });
    this.sincronizar();
  }

  sincronizar() {
    this.grupo.position.set(this.pos.x, 0, this.pos.z);
    this.grupo.rotation.y = this.rumbo;
    if (this.cuerpo) {
      const caido = this.estado === 'caido' || this.estado === 'barrida' || this.estado === 'estirada';
      this.cuerpo.setNextKinematicTranslation({ x: this.pos.x, y: caido ? -3 : 0, z: this.pos.z });
    }
  }

  // Posición aproximada de un hueso en el mundo (para manos/cabeza)
  posHueso(nombre, salida = new THREE.Vector3()) {
    const h = this.modelo.huesos.find((b) => b.name === nombre);
    this.grupo.updateMatrixWorld(true);
    return h.getWorldPosition(salida);
  }

  visible(v) { this.grupo.visible = v; }

  destruir(escena) {
    escena.remove(this.grupo);
    if (this.cuerpo && this.fisica) this.fisica.mundo.removeRigidBody(this.cuerpo);
  }
}
