// Compara las capturas de develop contra las del PR #160, pixel por pixel (umbral por canal 16).
// Uso: node docs/evidencia/pr160/comparar.mjs   (después de correr capturas-temas.mjs dos veces)
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const dir = new URL('.', import.meta.url).pathname;
const read = (file) => PNG.sync.read(readFileSync(file));
for (const name of ['pedir', 'menu-tienda']) {
  for (const theme of ['claro', 'oscuro', 'amoled']) {
    // develop no tiene AMOLED: ese modo se compara contra su oscuro.
    const base = read(`${dir}develop/${name}-${theme === 'amoled' ? 'oscuro' : theme}-390x844.png`);
    const pr = read(`${dir}pr/${name}-${theme}-390x844.png`);
    const width = Math.min(base.width, pr.width);
    const height = Math.min(base.height, pr.height);
    let diff = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const a = (y * base.width + x) * 4;
        const b = (y * pr.width + x) * 4;
        if ([0, 1, 2].some((c) => Math.abs(base.data[a + c] - pr.data[b + c]) > 16)) diff++;
      }
    }
    const total = Math.max(base.width * base.height, pr.width * pr.height);
    const extra = total - width * height;
    console.log(`${name} ${theme}: develop ${base.width}x${base.height}, PR ${pr.width}x${pr.height}, distintos ${(((diff + extra) / total) * 100).toFixed(1)} % (${diff + extra} px)`);
  }
}
