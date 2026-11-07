// Genera src/data/clubes.json con los 16 clubes de la Liga de Primera 2026 y planteles FICTICIOS.
// Ejecutar con:  npm run datos
// Puedes editar el JSON a mano después (nombres, atributos, colores...). Si vuelves a ejecutar
// este script, el JSON se sobrescribe.
import { writeFileSync, mkdirSync } from 'node:fs';

function semilla(s) {
  let x = s >>> 0 || 1;
  return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
}

const NOMBRES = [
  'Matías', 'Benjamín', 'Vicente', 'Martín', 'Agustín', 'Joaquín', 'Tomás', 'Cristóbal', 'Diego', 'Felipe',
  'Sebastián', 'Nicolás', 'Ignacio', 'Maximiliano', 'Bastián', 'Lucas', 'Gaspar', 'Renato', 'Álvaro', 'Rodrigo',
  'Claudio', 'Esteban', 'Gonzalo', 'Javier', 'Mauricio', 'Pablo', 'Francisco', 'Jorge', 'Camilo', 'Fernando',
  'Iván', 'Rafael', 'Marcelo', 'Andrés', 'Eduardo', 'Patricio', 'Cristián', 'Alexis', 'Luciano', 'Emilio',
  'Damián', 'Simón', 'Bruno', 'Héctor', 'Leandro', 'Ramiro', 'Gabriel', 'Hugo', 'Elías', 'Thiago',
  'Byron', 'Brayan', 'Jean', 'Yerko', 'Dylan', 'Kevin', 'Branco', 'Franco', 'Enzo', 'Ariel',
];
const APELLIDOS = [
  'González', 'Muñoz', 'Rojas', 'Díaz', 'Pérez', 'Soto', 'Contreras', 'Silva', 'Martínez', 'Sepúlveda',
  'Morales', 'Rodríguez', 'López', 'Fuentes', 'Hernández', 'Torres', 'Araya', 'Flores', 'Espinoza', 'Valenzuela',
  'Castillo', 'Tapia', 'Reyes', 'Gutiérrez', 'Castro', 'Pizarro', 'Álvarez', 'Vásquez', 'Sánchez', 'Fernández',
  'Ramírez', 'Carrasco', 'Gómez', 'Cortés', 'Herrera', 'Núñez', 'Jara', 'Vergara', 'Rivera', 'Figueroa',
  'Riquelme', 'García', 'Miranda', 'Bravo', 'Vera', 'Molina', 'Vega', 'Campos', 'Sandoval', 'Orellana',
  'Cárdenas', 'Olivares', 'Alarcón', 'Gallardo', 'Ortiz', 'Garrido', 'Salazar', 'Guzmán', 'Henríquez', 'Saavedra',
  'Navarro', 'Aguilera', 'Parra', 'Romero', 'Aravena', 'Vidal', 'Lagos', 'Paredes', 'Cáceres', 'Yáñez',
  'Leiva', 'Escobar', 'Ulloa', 'Zúñiga', 'Poblete', 'Bustos', 'Salinas', 'Quiroz', 'Toro', 'Mella',
  'Huenchumilla', 'Painemal', 'Catrileo', 'Millán', 'Ancamil', 'Llanquileo', 'Quidel', 'Nahuelpán',
];

// Combinaciones que coinciden con futbolistas reales conocidos: se evitan.
const PROHIBIDOS = new Set([
  'Alexis Sánchez', 'Claudio Bravo', 'Marcelo Díaz', 'Gonzalo Jara', 'Esteban Paredes', 'Matías Fernández',
  'Felipe Gutiérrez', 'Pablo Contreras', 'Nicolás Castillo', 'Damián Pizarro', 'Vicente Pizarro', 'Ignacio Saavedra',
  'Iván Morales', 'Marcelo Morales', 'Gonzalo Tapia', 'Leandro Fernández', 'Eduardo Vargas', 'Charles Aránguiz',
  'Arturo Vidal', 'Rodrigo Millar', 'Jorge Valdivia', 'Gary Medel', 'Cristián Zavala', 'Felipe Flores', 'Matías Rodríguez',
  'Javier Parraguez', 'Rodrigo Echeverría', 'Esteban Pavez', 'Gabriel Suazo', 'Paulo Díaz', 'Erick Pulgar',
  'Fernando Cornejo', 'Diego Valdés', 'Felipe Mora', 'Rodrigo Holgado', 'Matías Zaldivia', 'Cristián Cuevas',
  'Francisco Sierralta', 'Benjamín Kuscevic', 'Darío Osorio', 'Marcelino Núñez', 'Víctor Dávila', 'Mauricio Isla',
  'Claudio Baeza', 'Jean Beausejour', 'Marcelo Salas', 'Iván Zamorano', 'Humberto Suazo', 'Pablo Parra',
  'Bruno Barticciotto', 'Lucas Assadi', 'Joaquín Montecinos', 'Maximiliano Guerrero', 'Felipe Loyola', 'Javier Altamirano',
]);

const kit = (camiseta, short, medias, detalle, diseno = 'liso', extra = {}) => ({ camiseta, short, medias, detalle, diseno, ...extra });

const CLUBES = [
  { id: 'colocolo', nombre: 'Colo-Colo', corto: 'Colo-Colo', iniciales: 'CC', ciudad: 'Santiago (Macul)', estadio: 'Estadio Monumental David Arellano', nivel: 82,
    titular: kit('#f7f7f7', '#111111', '#f7f7f7', '#111111'), alternativa: kit('#111111', '#111111', '#111111', '#f7f7f7'),
    emblema: { forma: 'circulo', patron: 'estrella', colores: ['#111111', '#f7f7f7', '#ffffff'] } },
  { id: 'udechile', nombre: 'Universidad de Chile', corto: 'U. de Chile', iniciales: 'UCH', ciudad: 'Santiago', estadio: 'Estadio Nacional Julio Martínez Prádanos', nivel: 81,
    titular: kit('#0b3fa8', '#f7f7f7', '#0b3fa8', '#d52b1e'), alternativa: kit('#f7f7f7', '#0b3fa8', '#f7f7f7', '#0b3fa8'),
    emblema: { forma: 'escudoRecto', patron: 'aro', colores: ['#0b3fa8', '#d52b1e', '#ffffff'] } },
  { id: 'ucatolica', nombre: 'Universidad Católica', corto: 'U. Católica', iniciales: 'UC', ciudad: 'Santiago (Las Condes)', estadio: 'Claro Arena', nivel: 80,
    titular: kit('#f7f7f7', '#0b2a6b', '#f7f7f7', '#0b2a6b', 'banda', { detalle2: '#d52b1e' }), alternativa: kit('#0b2a6b', '#0b2a6b', '#0b2a6b', '#f7f7f7', 'banda', { detalle2: '#d52b1e' }),
    emblema: { forma: 'escudo', patron: 'banda', colores: ['#f7f7f7', '#0b2a6b', '#d52b1e'] } },
  { id: 'coquimbo', nombre: 'Coquimbo Unido', corto: 'Coquimbo', iniciales: 'CU', ciudad: 'Coquimbo', estadio: 'Estadio Francisco Sánchez Rumoroso', nivel: 79,
    titular: kit('#f4c20d', '#111111', '#f4c20d', '#111111', 'franjasFinas'), alternativa: kit('#111111', '#111111', '#111111', '#f4c20d'),
    emblema: { forma: 'escudo', patron: 'franjas', colores: ['#f4c20d', '#111111', '#111111'] } },
  { id: 'ohiggins', nombre: "O'Higgins", corto: "O'Higgins", iniciales: 'OH', ciudad: 'Rancagua', estadio: 'Estadio El Teniente', nivel: 76,
    titular: kit('#5ab4e5', '#f7f7f7', '#5ab4e5', '#f7f7f7'), alternativa: kit('#f7f7f7', '#5ab4e5', '#f7f7f7', '#5ab4e5'),
    emblema: { forma: 'escudoRecto', patron: 'mitad', colores: ['#5ab4e5', '#f7f7f7', '#1b3b5a'] } },
  { id: 'audax', nombre: 'Audax Italiano', corto: 'Audax', iniciales: 'AI', ciudad: 'Santiago (La Florida)', estadio: 'Estadio Bicentenario de La Florida', nivel: 73,
    titular: kit('#11823b', '#f7f7f7', '#11823b', '#f7f7f7'), alternativa: kit('#f7f7f7', '#11823b', '#f7f7f7', '#11823b'),
    emblema: { forma: 'escudo', patron: 'banda', colores: ['#11823b', '#f7f7f7', '#d52b1e'] } },
  { id: 'palestino', nombre: 'Palestino', corto: 'Palestino', iniciales: 'CDP', ciudad: 'Santiago (La Cisterna)', estadio: 'Estadio Municipal de La Cisterna', nivel: 75,
    titular: kit('#f7f7f7', '#111111', '#d52b1e', '#d52b1e', 'centro', { detalle2: '#11823b' }), alternativa: kit('#d52b1e', '#d52b1e', '#d52b1e', '#11823b', 'centro', { detalle2: '#f7f7f7' }),
    emblema: { forma: 'diamante', patron: 'mitad', colores: ['#11823b', '#d52b1e', '#ffffff'] } },
  { id: 'cobresal', nombre: 'Cobresal', corto: 'Cobresal', iniciales: 'CS', ciudad: 'El Salvador', estadio: 'Estadio El Cobre', nivel: 71,
    titular: kit('#f26a1b', '#f26a1b', '#f26a1b', '#f7f7f7'), alternativa: kit('#f7f7f7', '#f7f7f7', '#f7f7f7', '#f26a1b'),
    emblema: { forma: 'circulo', patron: 'aro', colores: ['#f26a1b', '#f7f7f7', '#3b2010'] } },
  { id: 'huachipato', nombre: 'Huachipato', corto: 'Huachipato', iniciales: 'CDH', ciudad: 'Talcahuano', estadio: 'Estadio Huachipato-CAP Acero', nivel: 73,
    titular: kit('#1a3d8f', '#111111', '#111111', '#111111', 'franjas'), alternativa: kit('#f7f7f7', '#f7f7f7', '#f7f7f7', '#1a3d8f'),
    emblema: { forma: 'escudoRecto', patron: 'franjas', colores: ['#1a3d8f', '#111111', '#ffffff'] } },
  { id: 'nublense', nombre: 'Ñublense', corto: 'Ñublense', iniciales: 'ÑUB', ciudad: 'Chillán', estadio: 'Estadio Municipal Nelson Oyarzún', nivel: 71,
    titular: kit('#c8102e', '#c8102e', '#c8102e', '#111111'), alternativa: kit('#f7f7f7', '#f7f7f7', '#f7f7f7', '#c8102e'),
    emblema: { forma: 'escudo', patron: 'diagonal', colores: ['#c8102e', '#111111', '#ffffff'] } },
  { id: 'limache', nombre: 'Deportes Limache', corto: 'Limache', iniciales: 'DL', ciudad: 'Limache', estadio: 'Estadio Municipal Ángel Navarrete Candia', nivel: 68,
    titular: kit('#d2232a', '#f7f7f7', '#d2232a', '#f7f7f7', 'diagonal'), alternativa: kit('#f7f7f7', '#d2232a', '#f7f7f7', '#d2232a', 'diagonal'),
    emblema: { forma: 'circulo', patron: 'banda', colores: ['#d2232a', '#f7f7f7', '#ffffff'] } },
  { id: 'calera', nombre: 'Unión La Calera', corto: 'La Calera', iniciales: 'ULC', ciudad: 'La Calera', estadio: 'Estadio Municipal Nicolás Chahuán Nazar', nivel: 69,
    titular: kit('#e2231a', '#e2231a', '#e2231a', '#f7f7f7'), alternativa: kit('#f7f7f7', '#f7f7f7', '#f7f7f7', '#e2231a'),
    emblema: { forma: 'escudoRecto', patron: 'banda', colores: ['#e2231a', '#f7f7f7', '#ffffff'] } },
  { id: 'laserena', nombre: 'Deportes La Serena', corto: 'La Serena', iniciales: 'DLS', ciudad: 'La Serena', estadio: 'Estadio La Portada', nivel: 70,
    titular: kit('#7d1426', '#7d1426', '#7d1426', '#f7f7f7'), alternativa: kit('#f7f7f7', '#f7f7f7', '#f7f7f7', '#7d1426'),
    emblema: { forma: 'escudo', patron: 'mitad', colores: ['#7d1426', '#f7f7f7', '#ffffff'] } },
  { id: 'everton', nombre: 'Everton', corto: 'Everton', iniciales: 'EV', ciudad: 'Viña del Mar', estadio: 'Estadio Sausalito', nivel: 72,
    titular: kit('#1d3f8f', '#1d3f8f', '#1d3f8f', '#f4c20d', 'banda', { detalle2: '#f4c20d' }), alternativa: kit('#f4c20d', '#f4c20d', '#f4c20d', '#1d3f8f'),
    emblema: { forma: 'circulo', patron: 'banda', colores: ['#1d3f8f', '#f4c20d', '#ffffff'] } },
  { id: 'udeconce', nombre: 'Universidad de Concepción', corto: 'U. de Conce', iniciales: 'UdeC', ciudad: 'Concepción', estadio: 'Estadio Ester Roa Rebolledo', nivel: 69,
    titular: kit('#f4c20d', '#1d4f9e', '#f4c20d', '#1d4f9e'), alternativa: kit('#1d4f9e', '#1d4f9e', '#1d4f9e', '#f4c20d'),
    emblema: { forma: 'escudoRecto', patron: 'mitad', colores: ['#f4c20d', '#1d4f9e', '#ffffff'] } },
  { id: 'dconcepcion', nombre: 'Deportes Concepción', corto: 'D. Concepción', iniciales: 'DC', ciudad: 'Concepción', estadio: 'Estadio Ester Roa Rebolledo', nivel: 68,
    titular: kit('#7a3e9d', '#f7f7f7', '#7a3e9d', '#f7f7f7'), alternativa: kit('#f7f7f7', '#7a3e9d', '#f7f7f7', '#7a3e9d'),
    emblema: { forma: 'diamante', patron: 'aro', colores: ['#7a3e9d', '#f7f7f7', '#ffffff'] } },
];

// Formación que usa la CPU con cada club (se puede cambiar: 4-4-2, 4-3-3, 3-5-2, 4-2-3-1, 5-3-2, 4-1-4-1)
const FORMACION_CLUB = {
  colocolo: '4-3-3', udechile: '4-2-3-1', ucatolica: '4-3-3', coquimbo: '4-2-3-1', ohiggins: '4-4-2', audax: '3-5-2',
  palestino: '4-1-4-1', cobresal: '4-4-2', huachipato: '4-3-3', nublense: '5-3-2', limache: '4-4-2', calera: '5-3-2',
  laserena: '4-4-2', everton: '4-2-3-1', udeconce: '4-1-4-1', dconcepcion: '4-4-2',
};

// Planteles: 2 arqueros, 6 defensas, 6 volantes, 4 delanteros (18 jugadores)
const POSICIONES = [
  ['ARQ', 2], ['DEF', 6], ['VOL', 6], ['DEL', 4],
];
const DORSALES = { ARQ: [1, 12], DEF: [2, 3, 4, 5, 6, 13, 15, 22], VOL: [8, 10, 14, 16, 17, 20, 21, 23], DEL: [7, 9, 11, 18, 19, 27] };

function generarJugadores(club, idx) {
  const rnd = semilla(1000 + idx * 7919);
  const usados = new Set();
  const jugadores = [];
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const attr = (base, sesgo) => Math.max(30, Math.min(95, Math.round(base + sesgo + (rnd() - 0.5) * 14)));
  for (const [pos, n] of POSICIONES) {
    const dors = [...DORSALES[pos]];
    for (let i = 0; i < n; i++) {
      let nombre, apellido, clave;
      do { nombre = pick(NOMBRES); apellido = pick(APELLIDOS); clave = nombre + apellido; } while (usados.has(clave) || PROHIBIDOS.has(`${nombre} ${apellido}`));
      usados.add(clave);
      const titular = i < { ARQ: 1, DEF: 4, VOL: 4, DEL: 2 }[pos];
      const b = club.nivel + (titular ? 2 : -4) + (rnd() - 0.5) * 6;
      const s = {
        ARQ: { velocidad: -20, tiro: -30, pase: -12, regate: -30, defensa: -25, fisico: 0, arquero: 4 },
        DEF: { velocidad: -3, tiro: -14, pase: -4, regate: -10, defensa: 5, fisico: 3, arquero: -55 },
        VOL: { velocidad: 0, tiro: -4, pase: 5, regate: 2, defensa: -6, fisico: -2, arquero: -55 },
        DEL: { velocidad: 3, tiro: 5, pase: -4, regate: 3, defensa: -22, fisico: 0, arquero: -55 },
      }[pos];
      const atributos = Object.fromEntries(Object.entries(s).map(([k, v]) => [k, attr(b, v)]));
      const tonos = [0, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 5, 6, 7];
      jugadores.push({
        nombre: `${nombre} ${apellido}`,
        camiseta: apellido,
        dorsal: dors.shift() ?? 24 + jugadores.length,
        posicion: pos,
        titular,
        atributos,
        apariencia: {
          altura: +(pos === 'ARQ' ? 1.82 + rnd() * 0.12 : 1.66 + rnd() * 0.24).toFixed(2),
          contextura: +(0.9 + rnd() * 0.25).toFixed(2),
          piel: pick(tonos),
          colorPelo: Math.floor(rnd() * 8),
          estiloPelo: pick(['corto', 'corto', 'rapado', 'crespo', 'largo', 'pelado', 'mohicano', 'corto']),
          barba: rnd() < 0.3,
        },
      });
    }
  }
  return jugadores;
}

const salida = {
  version: 1,
  temporada: 'Liga de Primera 2026',
  nota: 'Jugadores ficticios. Emblemas originales (no son escudos oficiales). Puedes editar este archivo libremente.',
  clubes: CLUBES.map((c, i) => ({
    id: c.id, nombre: c.nombre, corto: c.corto, iniciales: c.iniciales, ciudad: c.ciudad, estadio: c.estadio, nivel: c.nivel,
    formacion: FORMACION_CLUB[c.id] || '4-4-2',
    colores: { titular: c.titular, alternativa: c.alternativa, emblema: c.emblema.colores },
    emblema: { forma: c.emblema.forma, patron: c.emblema.patron },
    jugadores: generarJugadores(c, i),
  })),
};

mkdirSync('src/data', { recursive: true });
writeFileSync('src/data/clubes.json', JSON.stringify(salida, null, 2));
console.log(`Listo: ${salida.clubes.length} clubes, ${salida.clubes.reduce((a, c) => a + c.jugadores.length, 0)} jugadores.`);
