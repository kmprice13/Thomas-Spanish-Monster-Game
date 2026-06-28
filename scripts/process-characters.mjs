/**
 * process-characters.mjs
 *
 * Strips white background from all Thomas design variants and Chispa, then
 * copies them to public/assets/ with their in-game key names.
 *
 * Free colors  (always available):
 *   menta / morado / azul / naranja
 *
 * Earned colors (unlocked through play):
 *   baby / hada / brillante / arcoiris
 */
import { readFileSync, writeFileSync } from 'fs';
import { PNG } from 'pngjs';

// ── Thomas design map: source file → asset key ───────────────────────────────
const THOMAS_DESIGNS = [
  // Free color variants
  { src: 'scripts/Thomas_designs/thomas_base_mint.png',        key: 'menta'       },
  { src: 'scripts/Thomas_designs/thomas_base_purple.png',      key: 'morado'      },
  { src: 'scripts/Thomas_designs/thomas_base_blue.png',        key: 'azul'        },
  { src: 'scripts/Thomas_designs/thomas_base_orange.png',      key: 'naranja'     },
  // Earned thematic skins
  { src: 'scripts/Thomas_designs/thomas_base_alien.png',       key: 'alien'       },
  { src: 'scripts/Thomas_designs/thomas_base_baby.png',        key: 'baby'        },
  { src: 'scripts/Thomas_designs/thomas_base_cloud.png',       key: 'cloud'       },
  { src: 'scripts/Thomas_designs/thomas_base_fairy.png',       key: 'hada'        },
  { src: 'scripts/Thomas_designs/thomas_base_ghost.png',       key: 'ghost'       },
  { src: 'scripts/Thomas_designs/thomas_base_glowing.png',     key: 'brillante'   },
  { src: 'scripts/Thomas_designs/thomas_base_island.png',      key: 'island'      },
  { src: 'scripts/Thomas_designs/thomas_base_origami.png',     key: 'origami'     },
  { src: 'scripts/Thomas_designs/thomas_base_paint.png',       key: 'paint'       },
  { src: 'scripts/Thomas_designs/thomas_base_pastel.png',      key: 'pastel'      },
  { src: 'scripts/Thomas_designs/thomas_base_pharoh.png',      key: 'pharaon'     },
  { src: 'scripts/Thomas_designs/thomas_base_pirate.png',      key: 'pirate'      },
  { src: 'scripts/Thomas_designs/thomas_base_plushie.png',     key: 'plushie'     },
  { src: 'scripts/Thomas_designs/thomas_base_prehistoric.png', key: 'prehistoric' },
  { src: 'scripts/Thomas_designs/thomas_base_princess.png',    key: 'princess'    },
  { src: 'scripts/Thomas_designs/thomas_base_pumpkin.png',     key: 'pumpkin'     },
  { src: 'scripts/Thomas_designs/thomas_base_rainbow.png',     key: 'arcoiris'    },
  { src: 'scripts/Thomas_designs/thomas_base_shark.png',       key: 'shark'       },
  { src: 'scripts/Thomas_designs/thomas_base_sprite.png',      key: 'sprite'      },
  { src: 'scripts/Thomas_designs/thomas_base_stealth.png',     key: 'stealth'     },
];

// ── Background removal (flood-fill white from edges) ─────────────────────────
function removeBackground(data, width, height) {
  const visited = new Uint8Array(width * height);
  const queue = [];

  function seed(x, y) {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const p = y * width + x;
    if (visited[p]) return;
    const i = p * 4;
    if (data[i] > 220 && data[i + 1] > 220 && data[i + 2] > 220) {
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
}

// ── Process Thomas variants ───────────────────────────────────────────────────
function processThomas() {
  for (const { src, key } of THOMAS_DESIGNS) {
    const img = PNG.sync.read(readFileSync(src));
    const { width, height, data } = img;
    removeBackground(data, width, height);
    const dest = `public/assets/thomas_${key}.png`;
    writeFileSync(dest, PNG.sync.write(img));
    console.log(`  → ${dest}`);
  }
}

// ── Process Chispa ────────────────────────────────────────────────────────────
function processChispa() {
  const img = PNG.sync.read(readFileSync('scripts/Chispa designs/chispa_base.png'));
  const { width, height, data } = img;
  removeBackground(data, width, height);
  writeFileSync('public/assets/chispa_base.png', PNG.sync.write(img));
  console.log(`Done → public/assets/chispa_base.png (${width}×${height})`);
}

processThomas();
processChispa();
