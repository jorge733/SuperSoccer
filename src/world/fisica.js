// Mundo físico con Rapier: suelo, palos, travesaños, redes y vallas publicitarias.
import RAPIER from '@dimforge/rapier3d-compat';
import { CANCHA } from './medidas.js';

export let R = null;

export async function iniciarFisica() {
  if (!R) {
    // La librería avisa internamente de un parámetro obsoleto (no afecta en nada): lo silenciamos.
    const aviso = console.warn;
    console.warn = (...a) => { if (!String(a[0]).includes('deprecated parameters for the initialization')) aviso(...a); };
    try { await RAPIER.init(); } finally { console.warn = aviso; }
    R = RAPIER;
  }
  return R;
}

export class MundoFisico {
  constructor() {
    this.mundo = new R.World({ x: 0, y: -9.81, z: 0 });
    this.mundo.timestep = 1 / 120;
    this.mundo.integrationParameters.numSolverIterations = 4;
    this.colisionadores = { palos: new Set(), red: new Set(), suelo: null, vallas: new Set() };
    this.cola = new R.EventQueue(true);
    this.crearEstatico();
  }

  crearEstatico() {
    const w = this.mundo;
    const fijo = w.createRigidBody(R.RigidBodyDesc.fixed());
    // Suelo
    const suelo = w.createCollider(
      R.ColliderDesc.cuboid(90, 0.5, 70).setTranslation(0, -0.5, 0).setRestitution(0.62).setFriction(0.7)
        .setRestitutionCombineRule(R.CoefficientCombineRule.Multiply),
      fijo,
    );
    this.colisionadores.suelo = suelo;

    const L = CANCHA.largo / 2, A = CANCHA.anchoArco / 2, H = CANCHA.altoArco, rp = CANCHA.radioPalo;
    for (const lado of [-1, 1]) {
      const x = lado * (L + rp);
      // Palos y travesaño (cilindros/cápsulas)
      for (const z of [-A - rp, A + rp]) {
        const c = w.createCollider(
          R.ColliderDesc.cylinder(H / 2, rp).setTranslation(x, H / 2, z).setRestitution(0.75).setFriction(0.2)
            .setActiveEvents(R.ActiveEvents.COLLISION_EVENTS),
          fijo,
        );
        this.colisionadores.palos.add(c.handle);
      }
      const trav = w.createCollider(
        R.ColliderDesc.capsule(A + rp, rp).setTranslation(x, H + rp, 0)
          .setRotation({ x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 }).setRestitution(0.75).setFriction(0.2)
          .setActiveEvents(R.ActiveEvents.COLLISION_EVENTS),
        fijo,
      );
      this.colisionadores.palos.add(trav.handle);

      // Red: techo, fondo inclinado y costados (blandos: absorben el balón).
      const t = CANCHA.redTecho, f = CANCHA.redFondo;
      const dx = f - t, largo = Math.hypot(dx, H);
      const phi = Math.atan2(dx * lado, H);
      const nx = (H * lado) / largo, ny = dx / largo; // normal hacia afuera
      const mx = lado * (L + (t + f) / 2) + nx * 0.22, my = H / 2 + ny * 0.22;
      const partes = [
        R.ColliderDesc.cuboid(0.05, largo / 2 + 0.15, A + 0.3).setTranslation(mx, my, 0)
          .setRotation({ x: 0, y: 0, z: Math.sin(phi / 2), w: Math.cos(phi / 2) }),
        R.ColliderDesc.cuboid(t / 2 + 0.1, 0.05, A + 0.3).setTranslation(lado * (L + t / 2), H + 0.2, 0),
        R.ColliderDesc.cuboid(f / 2 + 0.1, H / 2, 0.05).setTranslation(lado * (L + f / 2), H / 2, -A - 0.2),
        R.ColliderDesc.cuboid(f / 2 + 0.1, H / 2, 0.05).setTranslation(lado * (L + f / 2), H / 2, A + 0.2),
      ];
      for (const p of partes) {
        const c = w.createCollider(p.setRestitution(0.05).setFriction(0.9)
          .setRestitutionCombineRule(R.CoefficientCombineRule.Min), fijo);
        this.colisionadores.red.add(c.handle);
      }
    }
    // Vallas publicitarias alrededor de la cancha
    const dx = L + 4.5, dz = CANCHA.ancho / 2 + 3.5;
    const vallas = [
      [0, 0.5, -dz, dx, 0.5, 0.1], [0, 0.5, dz, dx, 0.5, 0.1],
      [-dx, 0.5, 0, 0.1, 0.5, dz], [dx, 0.5, 0, 0.1, 0.5, dz],
    ];
    for (const [x, y, z, hx, hy, hz] of vallas) {
      const c = w.createCollider(R.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z).setRestitution(0.4), fijo);
      this.colisionadores.vallas.add(c.handle);
    }
  }

  // Cuerpo cinemático para cada jugador: los balones rebotan en sus piernas y cuerpo.
  crearCuerpoJugador(altura = 1.8) {
    const cuerpo = this.mundo.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 0, 0));
    const radio = 0.24;
    const mitad = Math.max(0.1, (altura - 0.16) / 2 - radio);
    const col = this.mundo.createCollider(
      R.ColliderDesc.capsule(mitad, radio).setTranslation(0, 0.04 + mitad + radio, 0).setRestitution(0.3).setFriction(0.5)
        .setActiveEvents(R.ActiveEvents.COLLISION_EVENTS),
      cuerpo,
    );
    return { cuerpo, col };
  }

  paso(dt, antesDePaso) {
    this.acum = (this.acum || 0) + Math.min(dt, 0.1);
    const h = this.mundo.timestep;
    const eventos = [];
    let n = 0;
    while (this.acum >= h && n < 12) {
      antesDePaso?.(h);
      this.mundo.step(this.cola);
      this.cola.drainCollisionEvents((a, b, empezo) => { if (empezo) eventos.push([a, b]); });
      this.acum -= h;
      n++;
    }
    return eventos;
  }
}
