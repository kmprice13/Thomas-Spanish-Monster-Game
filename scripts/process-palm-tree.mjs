// Flood-fill white background → transparent (same approach as vocab sheet)
import { readFileSync, writeFileSync } from 'fs';
import { PNG } from 'pngjs';

const img = PNG.sync.read(readFileSync('public/assets/palm_tree.png'));
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
  const x = p % width, y = (p - x) / width;
  seed(x - 1, y); seed(x + 1, y); seed(x, y - 1); seed(x, y + 1);
}

writeFileSync('public/assets/palm_tree_alpha.png', PNG.sync.write(img));
console.log(`Done → palm_tree_alpha.png (${width}×${height})`);
