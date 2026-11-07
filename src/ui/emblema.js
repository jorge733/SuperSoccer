// Emblemas ORIGINALES generados por código (no son escudos oficiales): forma + colores + iniciales del club.
const FORMAS = ['escudo', 'circulo', 'diamante', 'escudoRecto'];

function trazarForma(ctx, forma, s) {
  ctx.beginPath();
  if (forma === 'circulo') {
    ctx.arc(s / 2, s / 2, s * 0.46, 0, Math.PI * 2);
  } else if (forma === 'diamante') {
    ctx.moveTo(s / 2, s * 0.04); ctx.lineTo(s * 0.94, s / 2); ctx.lineTo(s / 2, s * 0.96); ctx.lineTo(s * 0.06, s / 2);
    ctx.closePath();
  } else if (forma === 'escudoRecto') {
    ctx.moveTo(s * 0.12, s * 0.08); ctx.lineTo(s * 0.88, s * 0.08); ctx.lineTo(s * 0.88, s * 0.6);
    ctx.lineTo(s / 2, s * 0.94); ctx.lineTo(s * 0.12, s * 0.6); ctx.closePath();
  } else {
    ctx.moveTo(s * 0.1, s * 0.1);
    ctx.quadraticCurveTo(s / 2, s * 0.02, s * 0.9, s * 0.1);
    ctx.lineTo(s * 0.9, s * 0.5);
    ctx.quadraticCurveTo(s * 0.88, s * 0.82, s / 2, s * 0.96);
    ctx.quadraticCurveTo(s * 0.12, s * 0.82, s * 0.1, s * 0.5);
    ctx.closePath();
  }
}

export function dibujarEmblema(ctx, club, s, x = 0, y = 0) {
  const [c1, c2] = club.colores.emblema || [club.colores.titular.camiseta, club.colores.titular.detalle];
  const forma = club.emblema?.forma || FORMAS[(club.id.length + club.nombre.length) % FORMAS.length];
  ctx.save();
  ctx.translate(x, y);
  trazarForma(ctx, forma, s);
  ctx.fillStyle = c1;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // Diseño interior: franja o banda según el club
  ctx.fillStyle = c2;
  const patron = club.emblema?.patron || 'banda';
  if (patron === 'banda') {
    ctx.beginPath(); ctx.moveTo(0, s * 0.62); ctx.lineTo(s, s * 0.28); ctx.lineTo(s, s * 0.44); ctx.lineTo(0, s * 0.78); ctx.fill();
  } else if (patron === 'franjas') {
    for (let i = 0; i < 5; i += 2) ctx.fillRect((i * s) / 5, 0, s / 5, s);
  } else if (patron === 'mitad') {
    ctx.fillRect(s / 2, 0, s / 2, s);
  } else if (patron === 'aro') {
    ctx.lineWidth = s * 0.08; ctx.strokeStyle = c2; ctx.beginPath(); ctx.arc(s / 2, s / 2, s * 0.33, 0, Math.PI * 2); ctx.stroke();
  } else if (patron === 'estrella') {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? s * 0.09 : s * 0.2, a = -Math.PI / 2 + (i * Math.PI) / 5;
      ctx.lineTo(s / 2 + Math.cos(a) * r, s * 0.24 + Math.sin(a) * r);
    }
    ctx.fill();
  }
  ctx.restore();
  trazarForma(ctx, forma, s);
  ctx.lineWidth = Math.max(2, s * 0.05);
  ctx.strokeStyle = club.colores.emblema?.[2] || '#ffffff';
  ctx.stroke();
  // Iniciales
  const ini = club.iniciales;
  ctx.font = `900 ${s * (ini.length > 2 ? 0.27 : 0.34)}px "Segoe UI", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = s * 0.06;
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.strokeText(ini, s / 2, s * 0.56);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(ini, s / 2, s * 0.56);
  ctx.restore();
}

export function canvasEmblema(club, s = 128, clase = '') {
  const c = document.createElement('canvas');
  c.width = c.height = s;
  if (clase) c.className = clase;
  dibujarEmblema(c.getContext('2d'), club, s);
  return c;
}
