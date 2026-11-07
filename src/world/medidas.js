// Medidas reglamentarias de la cancha (en metros). Eje X = largo, Z = ancho, Y = altura.
export const CANCHA = {
  largo: 105,
  ancho: 68,
  anchoArco: 7.32,
  altoArco: 2.44,
  profundidadArco: 2.0,
  radioPalo: 0.06,
  areaGrande: { largo: 16.5, ancho: 40.32 },
  areaChica: { largo: 5.5, ancho: 18.32 },
  puntoPenal: 11,
  radioCirculo: 9.15,
  radioBalon: 0.11,
  linea: 0.12,
  // Perfil de la red: techo plano hasta 'techo' m y luego baja inclinada hasta 'fondo' m a ras de piso.
  redTecho: 0.9,
  redFondo: 2.0,
};

export const MITAD_L = CANCHA.largo / 2;
export const MITAD_A = CANCHA.ancho / 2;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const suave = (actual, objetivo, velocidad, dt) => lerp(actual, objetivo, 1 - Math.exp(-velocidad * dt));
export const azar = (a = 0, b = 1) => a + Math.random() * (b - a);
export const angDif = (a, b) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
};

// Generador pseudoaleatorio con semilla (para que los planteles sean siempre iguales).
export function semilla(s) {
  let x = s >>> 0 || 1;
  return () => {
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5; x >>>= 0;
    return (x >>> 0) / 4294967296;
  };
}
