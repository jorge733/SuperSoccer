// Camisetas generadas por código: colores del club, diseño (liso, franjas, banda...), número y nombre en la espalda.
import * as THREE from 'three';

const CACHE = new Map();
const TAM = 512;

function contraste(hex) {
  const c = new THREE.Color(hex);
  const l = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  return l > 0.5 ? '#111111' : '#ffffff';
}

// La textura envuelve el torso: u=0.25 es el pecho y u=0.75 la espalda.
export function dibujarCamiseta(ctx, kit, numero = null, nombre = '') {
  const W = TAM, H = TAM;
  const alto = H * 0.94; // la franja inferior (6%) no se usa
  ctx.fillStyle = kit.camiseta;
  ctx.fillRect(0, 0, W, H);
  const d = kit.detalle || '#ffffff';
  ctx.fillStyle = d;
  switch (kit.diseno) {
    case 'franjas': {
      const n = 10;
      for (let i = 0; i < n; i += 2) ctx.fillRect((i * W) / n, 0, W / n, alto);
      break;
    }
    case 'franjasFinas': {
      const n = 20;
      for (let i = 0; i < n; i += 2) ctx.fillRect((i * W) / n + W / n * 0.3, 0, W / n * 0.4, alto);
      break;
    }
    case 'banda': // banda horizontal en el pecho
      ctx.fillRect(0, alto * 0.3, W, alto * 0.14);
      if (kit.detalle2) { ctx.fillStyle = kit.detalle2; ctx.fillRect(0, alto * 0.28, W, alto * 0.025); ctx.fillRect(0, alto * 0.435, W, alto * 0.025); }
      break;
    case 'aros':
      for (let i = 0; i < 6; i += 2) ctx.fillRect(0, (i * alto) / 6, W, alto / 6);
      break;
    case 'diagonal':
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(W * 0.1, 0); ctx.lineTo(W * 0.22, 0); ctx.lineTo(W * 0.4, alto); ctx.lineTo(W * 0.28, alto); ctx.closePath();
      ctx.fill();
      ctx.restore();
      break;
    case 'mitades':
      ctx.fillRect(W * 0.25, 0, W * 0.5, alto);
      break;
    case 'centro': // franja vertical central (pecho y espalda)
      ctx.fillRect(W * 0.21, 0, W * 0.08, alto);
      ctx.fillRect(W * 0.71, 0, W * 0.08, alto);
      if (kit.detalle2) { ctx.fillStyle = kit.detalle2; ctx.fillRect(W * 0.19, 0, W * 0.02, alto); ctx.fillRect(W * 0.29, 0, W * 0.02, alto); }
      break;
    default: break;
  }
  // Ribetes en el cuello y en la parte baja
  ctx.fillStyle = d;
  ctx.fillRect(0, 0, W, 10);
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#000';
  // Sombreado sutil de pliegues
  for (let i = 0; i < 14; i++) ctx.fillRect(Math.random() * W, 20 + Math.random() * alto * 0.8, 2, 30 + Math.random() * 60);
  ctx.globalAlpha = 1;

  const colorNum = kit.numero || contraste(kit.diseno === 'franjas' ? d : kit.camiseta);
  if (numero !== null) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // Espalda: nombre + número grande
    const xs = W * 0.75;
    ctx.font = `800 ${Math.round(W * 0.05)}px "Segoe UI", Arial, sans-serif`;
    ctx.fillStyle = colorNum;
    ctx.strokeStyle = colorNum === '#111111' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 3;
    const nom = (nombre || '').toUpperCase();
    ctx.strokeText(nom, xs, alto * 0.17);
    ctx.fillText(nom, xs, alto * 0.17);
    ctx.font = `900 ${Math.round(W * 0.2)}px "Segoe UI", Arial, sans-serif`;
    ctx.lineWidth = 6;
    ctx.strokeText(String(numero), xs, alto * 0.46);
    ctx.fillText(String(numero), xs, alto * 0.46);
    // Pecho: número chico al centro
    ctx.font = `900 ${Math.round(W * 0.075)}px "Segoe UI", Arial, sans-serif`;
    ctx.lineWidth = 3;
    ctx.strokeText(String(numero), W * 0.25, alto * 0.42);
    ctx.fillText(String(numero), W * 0.25, alto * 0.42);
  }
  // Emblema (círculo con color de detalle) sobre el pecho izquierdo
  ctx.fillStyle = d;
  ctx.beginPath(); ctx.arc(W * 0.29, alto * 0.2, W * 0.018, 0, Math.PI * 2); ctx.fill();
}

export function texturaCamiseta(kit, numero, nombre) {
  const clave = `${kit.camiseta}|${kit.detalle}|${kit.detalle2}|${kit.diseno}|${kit.numero}|${numero}|${nombre}`;
  if (CACHE.has(clave)) return CACHE.get(clave);
  const c = document.createElement('canvas');
  c.width = c.height = TAM;
  dibujarCamiseta(c.getContext('2d'), kit, numero, nombre);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 4;
  CACHE.set(clave, t);
  return t;
}

export function limpiarCacheCamisetas() {
  for (const t of CACHE.values()) t.dispose();
  CACHE.clear();
}

// Elige uniformes que no se confundan entre sí.
export function elegirKits(local, visita) {
  const kl = local.colores.titular;
  let kv = visita.colores.titular;
  const dif = (a, b) => {
    const ca = new THREE.Color(a), cb = new THREE.Color(b);
    return Math.abs(ca.r - cb.r) + Math.abs(ca.g - cb.g) + Math.abs(ca.b - cb.b);
  };
  if (dif(kl.camiseta, kv.camiseta) < 0.6 || dif(kl.short, kv.short) + dif(kl.camiseta, kv.camiseta) < 0.9) kv = visita.colores.alternativa;
  if (dif(kl.camiseta, kv.camiseta) < 0.45) kv = { ...visita.colores.alternativa, camiseta: '#f4f4f4', short: '#f4f4f4', medias: '#f4f4f4', detalle: visita.colores.titular.camiseta };
  return [kl, kv];
}

// Uniforme de arquero: color que contraste con ambos equipos.
export function kitArquero(indice) {
  const opciones = [
    { camiseta: '#1fa35b', detalle: '#0b3d22', short: '#0b3d22', medias: '#1fa35b', guantes: '#f2f2f2', diseno: 'liso' },
    { camiseta: '#f2a516', detalle: '#2b2b2b', short: '#2b2b2b', medias: '#f2a516', guantes: '#2b2b2b', diseno: 'liso' },
    { camiseta: '#9b30d9', detalle: '#ffffff', short: '#2a0d3d', medias: '#9b30d9', guantes: '#ffffff', diseno: 'liso' },
    { camiseta: '#222428', detalle: '#ffd23f', short: '#222428', medias: '#222428', guantes: '#ffd23f', diseno: 'liso' },
  ];
  return opciones[indice % opciones.length];
}
