import Phaser from 'phaser';
import type { ModelKey } from '../content/vocabulary';

/** Texture key for each vocab item's pixel-art image in public/assets/. */
export const ITEM_KEY: Record<ModelKey, string> = {
  apple: 'vocab_apple', banana: 'vocab_banana', strawberry: 'vocab_strawberry',
  flower: 'vocab_flower', star: 'vocab_star', ball: 'vocab_ball',
  fish: 'vocab_fish', frog: 'vocab_frog', bird: 'vocab_bird',
  butterfly: 'vocab_butterfly', mushroom: 'vocab_mushroom', bone: 'vocab_bone',
  gem: 'vocab_apple',
  pencil: 'vocab_pencil', crayon: 'vocab_crayon', paper: 'vocab_paper',
  book: 'vocab_book', backpack: 'vocab_backpack', scissors: 'vocab_scissors',
  glue: 'vocab_glue', eraser: 'vocab_eraser', notebook: 'vocab_notebook',
  ruler: 'vocab_ruler',
  bucket: 'vocab_bucket', coral: 'vocab_coral', crab: 'vocab_crab',
  dolphin: 'vocab_dolphin', jellyfish: 'vocab_jellyfish', sandcastle: 'vocab_sandcastle',
  seagull: 'vocab_seagull', seashell: 'vocab_seashell', turtle: 'vocab_turtle',
  wave: 'vocab_wave',
};

const INK = 0x120d1a;
const LINE = 5;

export function drawBadge(g: Phaser.GameObjects.Graphics): void {
  const W = 78, H = 78, R = 20;
  // Warm drop shadow
  g.fillStyle(0x4a2200, 0.32);
  g.fillRoundedRect(-W / 2 + 5, -H / 2 + 7, W, H, R);
  // Badge face (warm cream)
  g.fillStyle(0xfffef5, 1);
  g.fillRoundedRect(-W / 2, -H / 2, W, H, R);
  // Subtle inner highlight (top-left corner)
  g.fillStyle(0xffffff, 0.45);
  g.fillRoundedRect(-W / 2 + 5, -H / 2 + 5, W * 0.65, H * 0.35, 14);
  // Warm brown border instead of pure black
  g.lineStyle(4, 0x7a4e2a, 1);
  g.strokeRoundedRect(-W / 2, -H / 2, W, H, R);
}

function ellipsePoints(
  cx: number, cy: number, rx: number, ry: number, angleDeg: number, steps = 18,
): Phaser.Types.Math.Vector2Like[] {
  const a = (angleDeg * Math.PI) / 180;
  const cosA = Math.cos(a), sinA = Math.sin(a);
  const pts: Phaser.Types.Math.Vector2Like[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const ex = rx * Math.cos(t), ey = ry * Math.sin(t);
    pts.push({ x: cx + ex * cosA - ey * sinA, y: cy + ex * sinA + ey * cosA });
  }
  return pts;
}

export function drawItem(
  g: Phaser.GameObjects.Graphics,
  model: ModelKey,
  color: number,
  accent: number,
): void {
  g.lineStyle(LINE, INK, 1);

  switch (model) {
    case 'apple': {
      g.fillStyle(color, 1);
      g.fillCircle(0, 3, 20);
      g.lineStyle(LINE, INK, 1);
      g.strokeCircle(0, 3, 20);
      g.fillStyle(0x7a4e2a, 1);
      g.fillRect(-2, -19, 4, 10);
      g.lineStyle(2, INK, 1);
      g.strokeRect(-2, -19, 4, 10);
      const leaf = ellipsePoints(8, -15, 10, 5, -30);
      g.fillStyle(accent, 1);
      g.fillPoints(leaf, true);
      g.lineStyle(LINE, INK, 1);
      g.strokePoints(leaf, true);
      break;
    }
    case 'banana': {
      const outerPts = ellipsePoints(0, 0, 26, 10, -20);
      const innerPts = ellipsePoints(0, 5, 17, 7, -20).reverse();
      g.fillStyle(color, 1);
      g.fillPoints([...outerPts, ...innerPts], true);
      g.lineStyle(LINE, INK, 1);
      g.strokePoints(outerPts, true);
      // Tip marks
      const tipFirst = outerPts[0];
      const tipLast  = outerPts[outerPts.length - 1];
      if (tipFirst) { g.fillStyle(0x8a6a00, 1); g.fillCircle(tipFirst.x, tipFirst.y, 3); }
      if (tipLast)  { g.fillStyle(0x8a6a00, 1); g.fillCircle(tipLast.x,  tipLast.y,  3); }
      break;
    }
    case 'strawberry': {
      const body: Phaser.Types.Math.Vector2Like[] = [
        { x: 0, y: 22 }, { x: -16, y: -2 }, { x: -10, y: -18 },
        { x: 0, y: -22 }, { x: 10, y: -18 }, { x: 16, y: -2 },
      ];
      g.fillStyle(color, 1);
      g.fillPoints(body, true);
      g.lineStyle(LINE, INK, 1);
      g.strokePoints(body, true);
      // Seeds
      const seeds: Array<[number, number]> = [[-5, -8], [5, -5], [-3, 5], [7, 3], [-7, 3], [0, 13]];
      for (const [sx, sy] of seeds) {
        g.fillStyle(0xffffff, 1);
        g.fillCircle(sx, sy, 2.5);
      }
      // Crown
      const crown: Phaser.Types.Math.Vector2Like[] = [
        { x: 0, y: -18 }, { x: -10, y: -30 }, { x: -4, y: -18 },
        { x: 0, y: -28 }, { x: 4, y: -18 }, { x: 10, y: -30 },
      ];
      g.fillStyle(accent, 1);
      g.fillPoints(crown, true);
      g.lineStyle(LINE, INK, 1);
      g.strokePoints(crown, true);
      break;
    }
    case 'flower': {
      for (let p = 0; p < 6; p++) {
        const angle = (p / 6) * Math.PI * 2;
        const ppts = ellipsePoints(Math.cos(angle) * 14, Math.sin(angle) * 14, 10, 7, (p / 6) * 360);
        g.fillStyle(color, 1);
        g.fillPoints(ppts, true);
        g.lineStyle(LINE, INK, 1);
        g.strokePoints(ppts, true);
      }
      g.fillStyle(accent, 1);
      g.fillCircle(0, 0, 10);
      g.lineStyle(LINE, INK, 1);
      g.strokeCircle(0, 0, 10);
      break;
    }
    case 'star': {
      const starPts: Phaser.Types.Math.Vector2Like[] = [];
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 === 0 ? 22 : 9;
        starPts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
      }
      g.fillStyle(color, 1);
      g.fillPoints(starPts, true);
      g.lineStyle(LINE, INK, 1);
      g.strokePoints(starPts, true);
      break;
    }
    case 'ball': {
      g.fillStyle(color, 1);
      g.fillCircle(0, 0, 20);
      g.lineStyle(LINE, INK, 1);
      g.strokeCircle(0, 0, 20);
      // Stripe (half of a rotated ellipse)
      const stripe = ellipsePoints(0, 0, 8, 19, 0).slice(0, 10);
      g.fillStyle(accent, 1);
      g.fillPoints(stripe, true);
      break;
    }
    case 'fish': {
      const fishBody = ellipsePoints(0, 0, 22, 13, 0);
      g.fillStyle(color, 1);
      g.fillPoints(fishBody, true);
      g.lineStyle(LINE, INK, 1);
      g.strokePoints(fishBody, true);
      g.fillStyle(color, 1);
      g.fillTriangle(20, 0, 32, -11, 32, 11);
      g.lineStyle(LINE, INK, 1);
      g.strokeTriangle(20, 0, 32, -11, 32, 11);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(-8, -3, 6);
      g.lineStyle(LINE, INK, 1);
      g.strokeCircle(-8, -3, 6);
      g.fillStyle(INK, 1);
      g.fillCircle(-7, -3, 3);
      g.fillStyle(accent, 1);
      g.fillTriangle(0, -12, -8, -22, 8, -22);
      g.lineStyle(LINE, INK, 1);
      g.strokeTriangle(0, -12, -8, -22, 8, -22);
      break;
    }
    case 'frog': {
      g.fillStyle(color, 1);
      g.fillEllipse(0, 8, 38, 28);
      g.lineStyle(LINE, INK, 1);
      g.strokeEllipse(0, 8, 38, 28);
      g.fillStyle(color, 1);
      g.fillEllipse(0, -10, 34, 26);
      g.lineStyle(LINE, INK, 1);
      g.strokeEllipse(0, -10, 34, 26);
      g.fillStyle(accent, 1);
      g.fillCircle(-13, -19, 9);
      g.lineStyle(LINE, INK, 1);
      g.strokeCircle(-13, -19, 9);
      g.fillCircle(13, -19, 9);
      g.strokeCircle(13, -19, 9);
      g.fillStyle(INK, 1);
      g.fillCircle(-13, -19, 4);
      g.fillCircle(13, -19, 4);
      break;
    }
    case 'bird': {
      const bBody = ellipsePoints(-3, 3, 16, 12, -10);
      g.fillStyle(color, 1);
      g.fillPoints(bBody, true);
      g.lineStyle(LINE, INK, 1);
      g.strokePoints(bBody, true);
      g.fillStyle(color, 1);
      g.fillCircle(-4, -12, 12);
      g.lineStyle(LINE, INK, 1);
      g.strokeCircle(-4, -12, 12);
      const wing = ellipsePoints(9, 5, 14, 8, 15);
      g.fillStyle(0x6ba3ff, 1);
      g.fillPoints(wing, true);
      g.lineStyle(LINE, INK, 1);
      g.strokePoints(wing, true);
      g.fillStyle(accent, 1);
      g.fillTriangle(-14, -12, -24, -14, -14, -8);
      g.lineStyle(LINE, INK, 1);
      g.strokeTriangle(-14, -12, -24, -14, -14, -8);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(-2, -14, 5);
      g.fillStyle(INK, 1);
      g.fillCircle(-1, -14, 2.5);
      break;
    }
    case 'butterfly': {
      const wings: Array<[number, number, number, number, number]> = [
        [-14, -8, 18, 12, -30],
        [14, -8, 18, 12, 30],
        [-12, 10, 14, 10, -15],
        [12, 10, 14, 10, 15],
      ];
      for (const [wx, wy, wr1, wr2, wa] of wings) {
        const wpts = ellipsePoints(wx, wy, wr1, wr2, wa);
        g.fillStyle(color, 1);
        g.fillPoints(wpts, true);
        g.lineStyle(LINE, INK, 1);
        g.strokePoints(wpts, true);
      }
      g.fillStyle(accent, 1);
      g.fillCircle(-14, -6, 4);
      g.fillCircle(14, -6, 4);
      g.fillStyle(INK, 1);
      g.fillEllipse(0, 2, 6, 22);
      break;
    }
    case 'mushroom': {
      // Stem first (behind cap)
      g.fillStyle(accent, 1);
      g.fillRect(-11, 0, 22, 18);
      g.lineStyle(LINE, INK, 1);
      g.strokeRect(-11, 0, 22, 18);
      // Cap dome
      const capPts: Phaser.Types.Math.Vector2Like[] = [];
      for (let i = 0; i <= 12; i++) {
        const a = Math.PI + (i / 12) * Math.PI;
        capPts.push({ x: Math.cos(a) * 22, y: Math.sin(a) * 18 });
      }
      capPts.push({ x: 22, y: 2 }, { x: -22, y: 2 });
      g.fillStyle(color, 1);
      g.fillPoints(capPts, true);
      g.lineStyle(LINE, INK, 1);
      g.strokePoints(capPts, true);
      // White dots
      const dots: Array<[number, number]> = [[0, -14], [-10, -6], [10, -6], [-5, -18], [7, -18]];
      for (const [dx, dy] of dots) {
        g.fillStyle(0xffffff, 1);
        g.fillCircle(dx, dy, 4);
      }
      break;
    }
    case 'bone': {
      // Shaft
      g.fillStyle(color, 1);
      g.fillRect(-6, -12, 12, 24);
      g.lineStyle(LINE, INK, 1);
      g.strokeRect(-6, -12, 12, 24);
      // Four knob balls
      const knobs: Array<[number, number]> = [[-10, -14], [10, -14], [-10, 14], [10, 14]];
      for (const [bx, by] of knobs) {
        g.fillStyle(color, 1);
        g.fillCircle(bx, by, 9);
        g.lineStyle(LINE, INK, 1);
        g.strokeCircle(bx, by, 9);
      }
      break;
    }
    case 'gem': {
      const gem: Phaser.Types.Math.Vector2Like[] = [
        { x: 0, y: -22 }, { x: 16, y: -8 }, { x: 12, y: 18 },
        { x: -12, y: 18 }, { x: -16, y: -8 },
      ];
      g.fillStyle(color, 1);
      g.fillPoints(gem, true);
      g.lineStyle(LINE, INK, 1);
      g.strokePoints(gem, true);
      // Shine facet
      g.fillStyle(0xffffff, 0.4);
      g.fillTriangle(-6, -18, 0, -22, -14, -8);
      break;
    }
  }
}
