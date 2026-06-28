import Phaser from 'phaser';

// ── Mountain silhouettes ─────────────────────────────────────────────────────
// Drawn at depth -0.5, visible above and beside the island
export function drawMountains(g: Phaser.GameObjects.Graphics): void {
  // Farthest mountains (misty blue, very transparent)
  g.fillStyle(0x8ab8d8, 0.38);
  g.fillPoints([
    { x: 0,   y: 310 }, { x: 0,   y: 215 }, { x: 55,  y: 178 },
    { x: 110, y: 208 }, { x: 165, y: 172 }, { x: 228, y: 196 },
    { x: 290, y: 168 }, { x: 345, y: 188 }, { x: 400, y: 162 },
    { x: 455, y: 185 }, { x: 515, y: 168 }, { x: 575, y: 192 },
    { x: 635, y: 170 }, { x: 695, y: 195 }, { x: 755, y: 175 },
    { x: 800, y: 200 }, { x: 800, y: 310 },
  ], true);

  // Mid mountains (deeper teal-blue)
  g.fillStyle(0x4a8aad, 0.55);
  g.fillPoints([
    { x: 0,   y: 310 }, { x: 0,   y: 258 }, { x: 72,  y: 228 },
    { x: 140, y: 255 }, { x: 210, y: 230 }, { x: 275, y: 252 },
    { x: 345, y: 228 }, { x: 405, y: 248 }, { x: 468, y: 230 },
    { x: 535, y: 252 }, { x: 600, y: 232 }, { x: 658, y: 255 },
    { x: 728, y: 238 }, { x: 800, y: 255 }, { x: 800, y: 310 },
  ], true);

  // Near mountains (darkest, most visible at canvas sides)
  g.fillStyle(0x2a6888, 0.65);
  g.fillPoints([
    { x: 0,   y: 310 }, { x: 0,   y: 285 }, { x: 90,  y: 268 },
    { x: 155, y: 282 }, { x: 218, y: 265 }, { x: 285, y: 280 },
    { x: 348, y: 265 }, { x: 800, y: 268 }, { x: 800, y: 310 },
  ], true);

  // Snow caps on tallest peaks (tiny white triangles)
  g.fillStyle(0xffffff, 0.55);
  const peaks: Array<[number, number]> = [[165, 172], [400, 162], [515, 168], [635, 170]];
  for (const [px, py] of peaks) {
    g.fillTriangle(px, py, px - 14, py + 18, px + 14, py + 18);
  }
}

// ── Rock helper ──────────────────────────────────────────────────────────────
function drawRock(
  g: Phaser.GameObjects.Graphics,
  x: number, y: number,
  w: number, h: number,
): void {
  const hw = w / 2, hh = h / 2;
  const pts: Phaser.Types.Math.Vector2Like[] = [
    { x: x - hw,       y: y + hh * 0.3  },
    { x: x - hw * 0.75, y: y - hh * 0.65 },
    { x: x - hw * 0.2, y: y - hh        },
    { x: x + hw * 0.45, y: y - hh * 0.88 },
    { x: x + hw,       y: y - hh * 0.25 },
    { x: x + hw * 0.85, y: y + hh * 0.55 },
    { x: x + hw * 0.25, y: y + hh        },
    { x: x - hw * 0.35, y: y + hh        },
  ];
  g.fillStyle(0x8999ab, 1);
  g.fillPoints(pts, true);
  g.lineStyle(2, 0x5a6870, 1);
  g.strokePoints(pts, true);
  // Highlight facet
  g.fillStyle(0xb0c4d0, 0.75);
  g.fillEllipse(x - hw * 0.28, y - hh * 0.52, w * 0.32, h * 0.25);
  // Shadow under
  g.fillStyle(0x000000, 0.12);
  g.fillEllipse(x + 3, y + hh + 3, w * 1.1, 8);

  // Optional second smaller rock beside
  if (w > 28) {
    const sx = x + hw * 0.75, sy = y + hh * 0.1;
    const sw = w * 0.6, sh = h * 0.55;
    const shw = sw / 2, shh = sh / 2;
    const pts2: Phaser.Types.Math.Vector2Like[] = [
      { x: sx - shw,       y: sy + shh * 0.3  },
      { x: sx - shw * 0.6, y: sy - shh * 0.7  },
      { x: sx + shw * 0.5, y: sy - shh        },
      { x: sx + shw,       y: sy + shh * 0.2  },
      { x: sx + shw * 0.7, y: sy + shh        },
      { x: sx - shw * 0.3, y: sy + shh        },
    ];
    g.fillStyle(0x7a8898, 1);
    g.fillPoints(pts2, true);
    g.lineStyle(1.5, 0x5a6870, 1);
    g.strokePoints(pts2, true);
  }
}

// ── Bush helper ──────────────────────────────────────────────────────────────
function drawBush(
  g: Phaser.GameObjects.Graphics,
  x: number, y: number,
  r: number,
): void {
  // Three overlapping ovals
  g.fillStyle(0x38901a, 1);
  g.fillEllipse(x - r * 0.55, y + r * 0.05, r * 1.25, r * 1.05);
  g.fillEllipse(x + r * 0.55, y + r * 0.05, r * 1.25, r * 1.05);
  g.fillStyle(0x4aaa22, 1);
  g.fillEllipse(x, y - r * 0.12, r * 1.55, r * 1.25);
  // Bright highlight
  g.fillStyle(0x68cc35, 0.65);
  g.fillEllipse(x - r * 0.18, y - r * 0.35, r * 0.75, r * 0.5);
  // Shadow bottom
  g.fillStyle(0x000000, 0.1);
  g.fillEllipse(x + 2, y + r * 0.78, r * 1.65, r * 0.35);
}

// ── Flower helper ────────────────────────────────────────────────────────────
export function drawSmallFlower(
  g: Phaser.GameObjects.Graphics,
  x: number, y: number,
  petalColor: number,
  centerColor: number,
  size = 5,
): void {
  for (let p = 0; p < 5; p++) {
    const a = (p / 5) * Math.PI * 2 - Math.PI / 2;
    g.fillStyle(petalColor, 1);
    g.fillEllipse(
      x + Math.cos(a) * size * 0.9,
      y + Math.sin(a) * size * 0.9,
      size * 1.5, size * 1.15,
    );
  }
  g.fillStyle(centerColor, 1);
  g.fillCircle(x, y, size * 0.65);
  // Stem
  g.lineStyle(1.5, 0x3a7e20, 1);
  g.beginPath();
  g.moveTo(x, y + size * 0.65);
  g.lineTo(x + (Math.random() > 0.5 ? 2 : -2), y + size * 2.0);
  g.strokePath();
}

// ── Main decoration pass ─────────────────────────────────────────────────────
export function drawRocksAndFlowers(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
): void {
  // ── Rocks ──
  drawRock(g, cx - 148, cy + 62,  44, 30);   // lower-left main rock
  drawRock(g, cx + 148, cy + 62,  38, 26);   // lower-right main rock
  drawRock(g, cx - 192, cy +  8,  32, 22);   // left-mid
  drawRock(g, cx + 192, cy +  8,  28, 18);   // right-mid
  drawRock(g, cx - 70,  cy + 130, 26, 18);   // bottom-left small
  drawRock(g, cx + 75,  cy + 128, 22, 15);   // bottom-right small

  // ── Bushes ──
  drawBush(g, cx - 125, cy + 92, 22);  // near lower-left rock
  drawBush(g, cx + 125, cy + 92, 20);  // near lower-right rock
  drawBush(g, cx - 165, cy - 25, 16);  // left-upper area
  drawBush(g, cx + 165, cy - 25, 16);  // right-upper area

  // ── Flowers (scattered across grass) ──
  const flowerData: Array<[number, number, number, number, number]> = [
    [cx - 180, cy + 45,  0xff8fc8, 0xffee44, 5],
    [cx + 185, cy + 40,  0xaa66ff, 0xffee44, 5],
    [cx - 100, cy + 105, 0xffee44, 0xff9922, 4.5],
    [cx + 102, cy + 108, 0xff8fc8, 0xffee44, 4.5],
    [cx - 55,  cy + 132, 0xaa66ff, 0xffee44, 4],
    [cx + 60,  cy + 130, 0xffffff, 0xffee44, 4],
    [cx - 215, cy +  30, 0xff8fc8, 0xffee44, 4],
    [cx + 218, cy +  28, 0xffee44, 0xff9922, 4],
    [cx - 80,  cy - 18,  0xaa66ff, 0xffee44, 4],
    [cx + 80,  cy - 20,  0xff8fc8, 0xffee44, 4],
    [cx - 20,  cy + 50,  0xffee44, 0xff9922, 3.5],
    [cx + 25,  cy + 52,  0xffffff, 0xffee44, 3.5],
    [cx - 140, cy - 20,  0xff8fc8, 0xffee44, 3.5],
    [cx + 142, cy - 22,  0xaa66ff, 0xffee44, 3.5],
  ];
  for (const [fx, fy, pc, cc, sz] of flowerData) {
    drawSmallFlower(g, fx, fy, pc, cc, sz);
  }

  // ── Foam marks at beach edge (where sand meets ocean) ──
  g.fillStyle(0xffffff, 0.28);
  const foamPts: Array<[number, number, number, number]> = [
    [cx, cy - 168, 20, 8], [cx + 90, cy - 152, 16, 7], [cx - 90, cy - 152, 16, 7],
    [cx + 195, cy - 80, 14, 6], [cx - 195, cy - 80, 14, 6],
    [cx + 240, cy + 12, 14, 6], [cx - 240, cy + 12, 14, 6],
    [cx + 215, cy + 95, 16, 7], [cx - 215, cy + 95, 16, 7],
    [cx + 120, cy + 162, 18, 8], [cx - 120, cy + 162, 18, 8],
    [cx, cy + 172, 22, 8],
  ];
  for (const [fx, fy, fw, fh] of foamPts) {
    g.fillEllipse(fx, fy, fw, fh);
    g.fillEllipse(fx + fw * 0.55, fy + fh * 0.3, fw * 0.75, fh * 0.7);
  }
}

// ── Foreground grass tufts and flowers ──────────────────────────────────────
export function drawForeground(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
): void {
  const tufts: Array<[number, number]> = [
    [cx - 42, cy + 152], [cx + 32, cy + 158], [cx + 80, cy + 148],
    [cx - 88, cy + 145], [cx - 10, cy + 162], [cx + 122, cy + 140],
    [cx - 130, cy + 138],
  ];
  for (const [tx, ty] of tufts) {
    g.lineStyle(2, 0x3e8e18, 1);
    g.beginPath(); g.moveTo(tx, ty); g.lineTo(tx - 5, ty - 13); g.strokePath();
    g.beginPath(); g.moveTo(tx, ty); g.lineTo(tx + 5, ty - 13); g.strokePath();
    g.beginPath(); g.moveTo(tx, ty); g.lineTo(tx,     ty - 16); g.strokePath();
    g.lineStyle(2, 0x55b028, 1);
    g.beginPath(); g.moveTo(tx + 3, ty + 1); g.lineTo(tx - 4, ty - 11); g.strokePath();
    g.beginPath(); g.moveTo(tx - 3, ty + 1); g.lineTo(tx + 4, ty - 11); g.strokePath();
  }

  const fgFlowers: Array<[number, number, number, number]> = [
    [cx - 40, cy + 163, 0xff8fc8, 0xffee44],
    [cx + 38, cy + 166, 0xffdd44, 0xff9922],
    [cx - 98, cy + 152, 0xaa80ff, 0xffee44],
    [cx + 100, cy + 154, 0xff8fc8, 0xffee44],
    [cx + 148, cy + 146, 0xffdd44, 0xff9922],
    [cx - 150, cy + 144, 0xaa80ff, 0xffee44],
  ];
  for (const [fx, fy, pc, cc] of fgFlowers) {
    drawSmallFlower(g, fx, fy, pc, cc, 4.5);
  }
}
