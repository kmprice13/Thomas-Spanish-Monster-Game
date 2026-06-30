// Prepares island element PNGs for use as game assets.
// Flood-fills the white/near-white background → transparent for all 11 elements.

import { readFileSync, writeFileSync } from 'fs';
import { PNG } from 'pngjs';

const SRC = 'scripts/Island Elements';
const DST = 'public/assets';

const ALL = [
  'bridge', 'dock', 'chest',
  'bush', 'rock_large', 'rock_small',
  'yellow_flowers', 'pink_flowers', 'purple_flowers',
  'pond', 'sign',
];

function floodFillWhiteToAlpha(name) {
  const img = PNG.sync.read(readFileSync(`${SRC}/${name}.png`));
  const { width, height, data } = img;
  const visited = new Uint8Array(width * height);
  const queue = [];

  function seed(x, y) {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const p = y * width + x;
    if (visited[p]) return;
    const i = p * 4;
    if (data[i] > 230 && data[i + 1] > 230 && data[i + 2] > 230) {
      visited[p] = 1;
      queue.push(p);
    }
  }

  for (let x = 0; x < width; x++) { seed(x, 0); seed(x, height - 1); }
  for (let y = 1; y < height - 1; y++) { seed(0, y); seed(width - 1, y); }

  while (queue.length) {
    const p = queue.pop();
    data[p * 4 + 3] = 0;
    const x = p % width;
    const y = (p - x) / width;
    seed(x - 1, y); seed(x + 1, y); seed(x, y - 1); seed(x, y + 1);
  }

  writeFileSync(`${DST}/isle_${name}.png`, PNG.sync.write(img));
  console.log(`✓ ${name}.png → isle_${name}.png`);
}

for (const name of ALL) floodFillWhiteToAlpha(name);
console.log('\nAll 11 island elements ready in public/assets/');
