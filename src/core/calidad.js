// Niveles de calidad gráfica y detección automática del equipo.
export const NIVELES = {
  baja: {
    nombre: 'Baja', pixelRatio: 0.75, sombras: false, mapaSombra: 1024, ssao: false, bloom: false,
    aa: 'fxaa', publico: 1800, texturaCancha: 1024, lluvia: 1500, redes: false, focosExtra: false,
  },
  media: {
    nombre: 'Media', pixelRatio: 1, sombras: true, mapaSombra: 1024, ssao: false, bloom: true,
    aa: 'fxaa', publico: 5000, texturaCancha: 2048, lluvia: 4000, redes: true, focosExtra: false,
  },
  alta: {
    nombre: 'Alta', pixelRatio: 1.25, sombras: true, mapaSombra: 2048, ssao: true, bloom: true,
    aa: 'smaa', publico: 10000, texturaCancha: 2048, lluvia: 8000, redes: true, focosExtra: true,
  },
  ultra: {
    nombre: 'Ultra', pixelRatio: 2, sombras: true, mapaSombra: 4096, ssao: true, bloom: true,
    aa: 'smaa', publico: 18000, texturaCancha: 4096, lluvia: 14000, redes: true, focosExtra: true,
  },
};

export const ORDEN_CALIDAD = ['baja', 'media', 'alta', 'ultra'];

export function esTablet() {
  const tactil = navigator.maxTouchPoints > 1 || 'ontouchstart' in window;
  const ua = navigator.userAgent || '';
  return tactil && (/iPad|Android|Tablet|Mobile/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1));
}

// Elige una calidad inicial mirando la tarjeta gráfica que informa el navegador.
export function detectarCalidad(renderer) {
  if (esTablet()) return 'baja';
  let gpu = '';
  try {
    const gl = renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  } catch { /* ignorar */ }
  gpu = String(gpu || '').toLowerCase();
  const nucleos = navigator.hardwareConcurrency || 4;
  if (/swiftshader|llvmpipe|software|basic render/.test(gpu)) return 'baja';
  if (/rtx|radeon rx|rx [5-9]\d{3}|geforce gtx 1[0-9]{3}|arc a|apple m[2-9]|apple m1 (pro|max|ultra)/.test(gpu)) {
    return nucleos >= 8 ? 'alta' : 'media';
  }
  if (/apple m1|apple gpu|iris xe|radeon(tm)? graphics|vega/.test(gpu)) return 'media';
  if (/intel|mali|adreno|powervr/.test(gpu)) return 'media';
  return 'media';
}

// Ajuste dinámico: si los FPS se mantienen bajos durante varios segundos, sugiere bajar un nivel.
export class MonitorFps {
  constructor() { this.muestras = []; this.fps = 60; this.acum = 0; this.cuadros = 0; }
  actualizar(dt) {
    this.acum += dt; this.cuadros++;
    if (this.acum >= 0.5) {
      this.fps = this.cuadros / this.acum;
      this.muestras.push(this.fps);
      if (this.muestras.length > 12) this.muestras.shift();
      this.acum = 0; this.cuadros = 0;
    }
  }
  promedio() {
    if (!this.muestras.length) return 60;
    return this.muestras.reduce((a, b) => a + b, 0) / this.muestras.length;
  }
  reiniciar() { this.muestras = []; }
}
