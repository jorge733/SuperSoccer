// Ajustes del jugador guardados en localStorage (se mantienen entre sesiones).
const CLAVE = 'supersoccer.ajustes.v1';

const PREDETERMINADOS = {
  calidad: 'auto',        // auto | baja | media | alta | ultra
  volumen: 0.8,
  volumenPublico: 0.8,
  dificultad: 'normal',   // facil | normal | dificil
  duracion: 4,            // minutos por tiempo: 2, 4, 6, 8
  camara: 'tv',           // tv | cercana | aerea
  vibracion: true,
  mostrarFps: false,
  radar: true,
  relato: true,
  formacion: '4-4-2',
};

let datos = { ...PREDETERMINADOS };
try {
  const guardado = JSON.parse(localStorage.getItem(CLAVE) || '{}');
  datos = { ...PREDETERMINADOS, ...guardado };
} catch { /* sin localStorage: usamos valores por defecto */ }

export const ajustes = new Proxy(datos, {
  set(obj, prop, valor) {
    obj[prop] = valor;
    try { localStorage.setItem(CLAVE, JSON.stringify(obj)); } catch { /* ignorar */ }
    return true;
  },
});

export function leerJSON(clave, defecto = null) {
  try {
    const t = localStorage.getItem(clave);
    return t ? JSON.parse(t) : defecto;
  } catch { return defecto; }
}

export function guardarJSON(clave, valor) {
  try { localStorage.setItem(clave, JSON.stringify(valor)); return true; } catch { return false; }
}

export function borrarClave(clave) {
  try { localStorage.removeItem(clave); } catch { /* ignorar */ }
}
