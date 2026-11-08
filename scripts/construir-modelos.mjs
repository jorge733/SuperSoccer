// Comprime los futbolistas realistas para el juego:
//  - Modelos GLB con compresión Meshopt (EXT_meshopt_compression) y cuantización.
//  - Texturas KTX2 (Basis Universal UASTC) que la tarjeta gráfica usa comprimidas.
// Uso: node scripts/construir-modelos.mjs <carpeta_glb> <carpeta_png> <salida>
import { readFileSync, writeFileSync, mkdirSync, existsSync, cpSync } from 'node:fs';
import { join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, reorder, quantize, meshopt as meshoptT } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import { encodeToKTX2 } from 'ktx2-encoder';
import { decode as decodificarPNG } from 'fast-png';

// Decodifica PNG a RGBA de 8 bits para el codificador KTX2
const imageDecoder = async (buf) => {
  const im = decodificarPNG(buf);
  const n = im.width * im.height;
  const rgba = new Uint8Array(n * 4);
  const c = im.channels;
  for (let i = 0; i < n; i++) {
    rgba[i * 4] = im.data[i * c]; rgba[i * 4 + 1] = im.data[i * c + 1]; rgba[i * 4 + 2] = im.data[i * c + 2];
    rgba[i * 4 + 3] = c === 4 ? im.data[i * c + 3] : 255;
  }
  return { data: rgba, width: im.width, height: im.height };
};

const [, , GLB, PNG, SAL] = process.argv;
mkdirSync(SAL, { recursive: true });
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

for (const [nombre, archivo] of [['jugador_a', 'Sports_Male_02'], ['jugador_b', 'Sports_Male_03']]) {
  const doc = await io.read(join(GLB, `${archivo}.glb`));
  // Las animaciones del FBX (pose de referencia) no se usan: el juego tiene sus propias animaciones
  for (const a of doc.getRoot().listAnimations()) a.dispose();
  await doc.transform(dedup(), prune({ keepAttributes: true }), reorder({ encoder: MeshoptEncoder }), quantize(), meshoptT({ encoder: MeshoptEncoder, level: 'medium' }));
  const bin = await io.writeBinary(doc);
  writeFileSync(join(SAL, `${nombre}.glb`), bin);
  console.log(`${nombre}.glb`, (bin.length / 1024).toFixed(0), 'KB');
  const texturas = ['cuerpo', 'cuerpo_normal', 'cabeza', 'cabeza_normal', 'pelo'];
  for (const t of texturas) {
    const f = join(PNG, `${nombre}_${t}.png`);
    if (!existsSync(f) || (process.env.SOLO_GLB && existsSync(join(SAL, `${nombre}_${t}.ktx2`)))) continue;
    const normal = t.includes('normal');
    const datos = await encodeToKTX2(new Uint8Array(readFileSync(f)), {
      isUASTC: true, generateMipmap: true, needSupercompression: true, isNormalMap: normal, isPerceptual: !normal,
      uastcLDRQualityLevel: 1, enableRDO: true, rdoQualityLevel: normal ? 1.5 : 1, imageDecoder,
    });
    writeFileSync(join(SAL, `${nombre}_${t}.ktx2`), datos);
    console.log(`${nombre}_${t}.ktx2`, (datos.length / 1024).toFixed(0), 'KB');
  }
}
// Transcodificador de Basis (lo usa KTX2Loader en el navegador)
cpSync('node_modules/three/examples/jsm/libs/basis', 'public/basis', { recursive: true });
