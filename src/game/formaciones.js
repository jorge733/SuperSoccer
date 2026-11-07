// Formaciones: posiciones base normalizadas. x: 0 = arco propio, 1 = arco rival. z: -1..1 (ancho).
// El índice 0 es siempre el arquero. "rol" se usa para decidir comportamientos de la IA.
const ARQ = { x: 0.02, z: 0, rol: 'ARQ' };
const d = (x, z, rol = 'DEF') => ({ x, z, rol });

export const FORMACIONES = {
  '4-4-2': [ARQ, d(0.21, -0.72), d(0.18, -0.24), d(0.18, 0.24), d(0.21, 0.72),
    d(0.43, -0.75, 'VOL'), d(0.4, -0.22, 'VOL'), d(0.4, 0.22, 'VOL'), d(0.43, 0.75, 'VOL'),
    d(0.63, -0.2, 'DEL'), d(0.63, 0.2, 'DEL')],
  '4-3-3': [ARQ, d(0.21, -0.72), d(0.18, -0.24), d(0.18, 0.24), d(0.21, 0.72),
    d(0.38, -0.45, 'VOL'), d(0.34, 0, 'VOL'), d(0.38, 0.45, 'VOL'),
    d(0.63, -0.72, 'DEL'), d(0.67, 0, 'DEL'), d(0.63, 0.72, 'DEL')],
  '3-5-2': [ARQ, d(0.19, -0.5), d(0.17, 0), d(0.19, 0.5),
    d(0.45, -0.85, 'VOL'), d(0.38, -0.32, 'VOL'), d(0.33, 0, 'VOL'), d(0.38, 0.32, 'VOL'), d(0.45, 0.85, 'VOL'),
    d(0.63, -0.2, 'DEL'), d(0.63, 0.2, 'DEL')],
  '4-2-3-1': [ARQ, d(0.21, -0.72), d(0.18, -0.24), d(0.18, 0.24), d(0.21, 0.72),
    d(0.33, -0.24, 'VOL'), d(0.33, 0.24, 'VOL'),
    d(0.5, -0.7, 'VOL'), d(0.5, 0, 'VOL'), d(0.5, 0.7, 'VOL'),
    d(0.67, 0, 'DEL')],
  '5-3-2': [ARQ, d(0.24, -0.85), d(0.18, -0.4), d(0.16, 0), d(0.18, 0.4), d(0.24, 0.85),
    d(0.38, -0.45, 'VOL'), d(0.36, 0, 'VOL'), d(0.38, 0.45, 'VOL'),
    d(0.6, -0.2, 'DEL'), d(0.6, 0.2, 'DEL')],
  '4-1-4-1': [ARQ, d(0.21, -0.72), d(0.18, -0.24), d(0.18, 0.24), d(0.21, 0.72),
    d(0.31, 0, 'VOL'),
    d(0.46, -0.75, 'VOL'), d(0.44, -0.25, 'VOL'), d(0.44, 0.25, 'VOL'), d(0.46, 0.75, 'VOL'),
    d(0.66, 0, 'DEL')],
};

export const LISTA_FORMACIONES = Object.keys(FORMACIONES);

// Elige 11 titulares del plantel según la formación (por posición y atributos).
export function elegirOnce(club, formacion) {
  const f = FORMACIONES[formacion] || FORMACIONES['4-4-2'];
  const necesita = { ARQ: 0, DEF: 0, VOL: 0, DEL: 0 };
  for (const p of f) necesita[p.rol]++;
  const por = { ARQ: [], DEF: [], VOL: [], DEL: [] };
  const valor = (j) => (j.titular ? 6 : 0) + Object.values(j.atributos).reduce((a, b) => a + b, 0) / 7;
  for (const j of club.jugadores) por[j.posicion].push(j);
  for (const k in por) por[k].sort((a, b) => valor(b) - valor(a));
  const usados = new Set();
  const once = f.map((p) => {
    let j = por[p.rol].find((x) => !usados.has(x));
    if (!j) {
      const alt = { DEF: ['VOL', 'DEL'], VOL: ['DEF', 'DEL'], DEL: ['VOL', 'DEF'], ARQ: ['DEF'] }[p.rol];
      for (const r of alt) { j = por[r].find((x) => !usados.has(x)); if (j) break; }
    }
    usados.add(j);
    return j;
  });
  const suplentes = club.jugadores.filter((j) => !usados.has(j));
  return { once, suplentes };
}
