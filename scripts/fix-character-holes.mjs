// characters.png has transparent background BUT also transparent interior areas
// (teeth, mouth interior) because the artist removed all white.
// This script: flood-fill from image edges to mark which transparent pixels ARE background,
// then fills non-edge-reachable transparent pixels with opaque white (restores teeth, etc).
import { readFileSync, writeFileSync } from 'fs';
import { PNG } from 'pngjs';

const img = PNG.sync.read(readFileSync('public/assets/characters.png'));
const { width, height, data } = img;

// BFS: find all transparent pixels reachable from any edge pixel
const reachable = new Uint8Array(width * height);
const queue = [];

function seedTransparent(x, y) {
  if (x < 0 || x >= width || y < 0 || y >= height) return;
  const p = y * width + x;
  if (reachable[p]) return;
  if (data[p * 4 + 3] < 128) {  // transparent
    reachable[p] = 1;
    queue.push(p);
  }
}

for (let x = 0; x < width; x++) { seedTransparent(x, 0); seedTransparent(x, height - 1); }
for (let y = 1; y < height - 1; y++) { seedTransparent(0, y); seedTransparent(width - 1, y); }

while (queue.length) {
  const p = queue.pop();
  const x = p % width, y = (p - x) / width;
  seedTransparent(x - 1, y); seedTransparent(x + 1, y);
  seedTransparent(x, y - 1); seedTransparent(x, y + 1);
}

// Fill interior transparent holes (non-reachable) with opaque white
let filled = 0;
for (let p = 0; p < width * height; p++) {
  if (data[p * 4 + 3] < 128 && !reachable[p]) {
    data[p * 4]     = 255;
    data[p * 4 + 1] = 255;
    data[p * 4 + 2] = 255;
    data[p * 4 + 3] = 255;
    filled++;
  }
}

writeFileSync('public/assets/characters_fixed.png', PNG.sync.write(img));
console.log(`Done → characters_fixed.png  (filled ${filled} interior transparent pixels with white)`);
