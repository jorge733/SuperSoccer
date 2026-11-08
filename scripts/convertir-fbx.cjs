// Convierte los FBX de Rocketbox a GLB y genera el mapa de zonas de la camiseta.
// Uso: copiar los FBX a .trabajo/rb/, servir la carpeta del proyecto (python3 -m http.server 8765),
// copiar scripts/convertir-fbx.html a .trabajo/inspeccion.html y ejecutar:
//   node scripts/convertir-fbx.cjs exportar Sports_Male_02 Sports_Male_03
//   node scripts/convertir-fbx.cjs zonas Sports_Male_02 Sports_Male_03
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage();
  p.on('console', (m) => { if (m.type() === 'error') console.log('consola:', m.text()); });
  await p.goto('http://localhost:8765/.trabajo/inspeccion.html');
  await p.waitForFunction(() => window.listo);
  for (const n of process.argv.slice(3)) {
    if (process.argv[2] === 'zonas') { const r = await p.evaluate((u) => window.zonas(u), `/.trabajo/rb/${n}.fbx`); fs.writeFileSync(`/home/user/SuperSoccer/.trabajo/rb/${n}_zonas.png`, Buffer.from(r.png.split(',')[1], 'base64')); console.log(JSON.stringify(r.cuenta)); continue; }
    if (process.argv[2] === 'ver') console.log(n, JSON.stringify(await p.evaluate((u) => window.inspeccionar(u), `/.trabajo/rb/${n}.fbx`), null, 0));
    else { const b64 = await p.evaluate((u) => window.exportar(u), `/.trabajo/rb/${n}.fbx`); fs.writeFileSync(`/home/user/SuperSoccer/.trabajo/rb/${n}.glb`, Buffer.from(b64, 'base64')); console.log('escrito', n); }
  }
  await b.close();
})();
