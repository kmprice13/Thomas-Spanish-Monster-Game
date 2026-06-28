// Flood-fill white background from edges → transparent.
// Interior white areas (frog belly, ball highlight, etc.) stay opaque
// because dark outlines enclose them, making them unreachable from edges.
import { readFileSync, writeFileSync } from 'fs';
import { PNG } from 'pngjs';

const inPath  = 'public/assets/vocab_sheet.png';
const outPath = 'public/assets/vocab_sheet_alpha.png';

const img = PNG.sync.read(readFileSync(inPath));
const { width, height, data } = img;

const visited = new Uint8Array(width * height);
const queue   = [];

function seed(x, y) {
  if (x < 0 || x >= width || y < 0 || y >= height) return;
  const p = y * width + x;
  if (visited[p]) return;
  const i = p * 4;
  // Near-white threshold (accounts for anti-aliasing fringe)
  if (data[i] > 230 && data[i + 1] > 230 && data[i + 2] > 230) {
    visited[p] = 1;
    queue.push(p);
  }
}

// Seed from every edge pixel
for (let x = 0; x < width; x++)  { seed(x, 0); seed(x, height - 1); }
for (let y = 1; y < height - 1; y++) { seed(0, y); seed(width - 1, y); }

// BFS
while (queue.length) {
  const p = queue.pop();          // pop (DFS) is faster for BFS-like fills
  data[p * 4 + 3] = 0;           // alpha → 0
  const x = p % width;
  const y = (p - x) / width;
  seed(x - 1, y); seed(x + 1, y);
  seed(x, y - 1); seed(x, y + 1);
}

writeFileSync(outPath, PNG.sync.write(img));
console.log(`Done → ${outPath}  (${width}×${height}, flood-fill from edges)`);
