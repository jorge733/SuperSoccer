// Hornea las animaciones de captura de movimiento al formato del juego (src/data/animaciones.json).
// Requiere servir el proyecto: python3 -m http.server 8765  (y los archivos fuente en .trabajo/mocap/)
// Uso: node scripts/hornear-animaciones.cjs ver <tipo> <archivo> [clip]
//      node scripts/hornear-animaciones.cjs hornear
const { chromium } = require('playwright');
const fs = require('fs');

// Receta: nombre en el juego -> fuente y tramo
const RECETA = require('./receta-animaciones.json');

(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage();
  p.on('console', (m) => { if (m.type() === 'error') console.log('consola:', m.text()); });
  p.on('pageerror', (e) => console.log('error:', e.message));
  await p.goto('http://localhost:8765/scripts/hornear-animaciones.html');
  await p.waitForFunction(() => window.listo, null, { timeout: 60000 });
  const [modo, tipo, archivo, clip] = process.argv.slice(2);
  if (modo === 'ver') {
    const r = await p.evaluate(([t, a, c]) => window.inspeccionar(t, a, c), [tipo, archivo, clip]);
    console.log('dur', r.dur, 'frames', r.frames, '\n', r.nombres, '\n', r.lineas);
  } else {
    const salida = { version: 1, fps: 30, clips: {} };
    for (const [nombre, rc] of Object.entries(RECETA)) {
      const r = await p.evaluate(([rc]) => window.hornear(rc.tipo, rc.archivo, rc.clip, rc.t0, rc.t1, rc.op || {}), [rc]);
      if (rc.zancada) r.zancada = rc.zancada;
      salida.clips[nombre] = { ...r, bucle: !!(rc.op && rc.op.bucle), contacto: rc.contacto ?? null, fuente: rc.credito };
      console.log(nombre, r.n, 'cuadros', 'zancada', r.zancada);
    }
    fs.writeFileSync('src/data/animaciones.json', JSON.stringify(salida));
    console.log('KB', (fs.statSync('src/data/animaciones.json').size / 1024).toFixed(0));
  }
  await b.close();
})();
