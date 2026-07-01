import Phaser from 'phaser';

const INK  = 0x120d1a;
const LINE = 6;

function ellipsePoints(
  cx: number, cy: number, rx: number, ry: number, angleDeg: number, steps = 20,
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

export function drawCharacter(g: Phaser.GameObjects.Graphics, who: 'thomas' | 'nube'): void {
  if (who === 'thomas') drawThomas(g);
  else drawNube(g);
}

// ── Shared eye helper ─────────────────────────────────────────────────────────
function drawEye(
  g: Phaser.GameObjects.Graphics,
  cx: number, cy: number,
  ex: number, ey: number,   // eye ellipse half-axes
  px: number, py: number,   // pupil center offset from eye center
  pr: number,               // pupil radius
): void {
  // White sclera
  g.fillStyle(0xffffff, 1);
  g.lineStyle(LINE, INK, 1);
  g.fillEllipse(cx, cy, ex * 2, ey * 2);
  g.strokeEllipse(cx, cy, ex * 2, ey * 2);

  // Large black pupil
  g.fillStyle(INK, 1);
  g.fillCircle(cx + px, cy + py, pr);

  // Primary shine (upper-right of pupil)
  g.fillStyle(0xffffff, 1);
  g.fillCircle(cx + px + pr * 0.35, cy + py - pr * 0.45, pr * 0.38);

  // Secondary tiny shine (lower-left)
  g.fillCircle(cx + px - pr * 0.3, cy + py + pr * 0.35, pr * 0.2);
}

// ── Eyebrow helper ────────────────────────────────────────────────────────────
function drawBrow(
  g: Phaser.GameObjects.Graphics,
  cx: number, cy: number,
  width: number,
): void {
  g.lineStyle(5, INK, 1);
  g.beginPath();
  g.arc(cx, cy + 4, width, Phaser.Math.DegToRad(195), Phaser.Math.DegToRad(345));
  g.strokePath();
}

// ── Thomas ────────────────────────────────────────────────────────────────────
function drawThomas(g: Phaser.GameObjects.Graphics): void {
  const BODY   = 0xff8c42;
  const BELLY  = 0xfff3d6;
  const ACCENT = 0xb06cff;
  const FIN    = 0xe0308a;

  // ── Fins (behind body) ──
  const finL = ellipsePoints(-36, -5, 14, 9, -35);
  g.fillStyle(FIN, 1);
  g.fillPoints(finL, true);
  g.lineStyle(LINE, INK, 1);
  g.strokePoints(finL, true);

  const finR = ellipsePoints(36, -5, 14, 9, 35);
  g.fillStyle(FIN, 1);
  g.fillPoints(finR, true);
  g.lineStyle(LINE, INK, 1);
  g.strokePoints(finR, true);

  // ── Waving arm ──
  const arm: Phaser.Types.Math.Vector2Like[] = [
    { x: 26, y: -6 }, { x: 40, y: -24 }, { x: 36, y: -31 }, { x: 30, y: -12 },
  ];
  g.fillStyle(BODY, 1);
  g.fillPoints(arm, true);
  g.lineStyle(LINE, INK, 1);
  g.strokePoints(arm, true);

  // ── Body ──
  g.fillStyle(BODY, 1);
  g.fillCircle(0, 0, 30);
  g.lineStyle(LINE, INK, 1);
  g.strokeCircle(0, 0, 30);

  // ── Belly ──
  g.fillStyle(BELLY, 1);
  g.fillEllipse(0, 10, 28, 24);
  g.lineStyle(3, INK, 0.35);
  g.strokeEllipse(0, 10, 28, 24);

  // ── Horn ──
  const horn: Phaser.Types.Math.Vector2Like[] = [
    { x: 0, y: -48 }, { x: -9, y: -30 }, { x: 9, y: -30 },
  ];
  g.fillStyle(ACCENT, 1);
  g.fillPoints(horn, true);
  g.lineStyle(LINE, INK, 1);
  g.strokePoints(horn, true);

  // ── Blush ──
  g.fillStyle(0xff8fb0, 1);
  g.fillEllipse(-22, 8, 14, 9);
  g.fillEllipse(22, 8, 14, 9);

  // ── Eyes ──
  drawEye(g, -13, -11, 12, 14,  1, 0, 10);
  drawEye(g,  13, -11, 12, 14, -1, 0, 10);

  // ── Eyebrows ──
  drawBrow(g, -13, -22, 10);
  drawBrow(g,  13, -22, 10);

  // ── Smile ──
  g.lineStyle(4, INK, 1);
  g.beginPath();
  g.arc(0, -2, 12, Phaser.Math.DegToRad(18), Phaser.Math.DegToRad(162));
  g.strokePath();

  // ── Legs ──
  g.fillStyle(BODY, 1);
  g.lineStyle(LINE, INK, 1);
  g.fillCircle(-18, 28, 11);
  g.strokeCircle(-18, 28, 11);
  g.fillCircle(18, 28, 11);
  g.strokeCircle(18, 28, 11);
}

// ── Nube ──────────────────────────────────────────────────────────────────────
function drawNube(g: Phaser.GameObjects.Graphics): void {
  const BODY   = 0x2ec5c1;
  const BELLY  = 0xfff9e8;
  const ACCENT = 0xffd23f;

  // ── Body ──
  g.fillStyle(BODY, 1);
  g.fillCircle(0, 0, 32);
  g.lineStyle(LINE, INK, 1);
  g.strokeCircle(0, 0, 32);

  // ── Belly ──
  g.fillStyle(BELLY, 1);
  g.fillEllipse(0, 11, 28, 24);
  g.lineStyle(3, INK, 0.35);
  g.strokeEllipse(0, 11, 28, 24);

  // ── Antenna stem ──
  g.lineStyle(5, INK, 1);
  g.beginPath();
  g.moveTo(5, -31);
  g.lineTo(14, -52);
  g.strokePath();

  // ── Antenna ball (glow ring + solid ball) ──
  g.fillStyle(0xfff4b0, 1);
  g.fillCircle(14, -57, 10);
  g.lineStyle(LINE, INK, 1);
  g.strokeCircle(14, -57, 10);
  g.fillStyle(ACCENT, 1);
  g.fillCircle(14, -57, 7);

  // ── Blush ──
  g.fillStyle(0x3de8c0, 1);
  g.fillEllipse(-24, 9, 14, 9);
  g.fillEllipse(24, 9, 14, 9);

  // ── Eyes ──
  drawEye(g, -13, -12, 12, 14,  1, 0, 10);
  drawEye(g,  13, -12, 12, 14, -1, 0, 10);

  // ── Eyebrows ──
  drawBrow(g, -13, -24, 10);
  drawBrow(g,  13, -24, 10);

  // ── Smile ──
  g.lineStyle(4, INK, 1);
  g.beginPath();
  g.arc(0, -2, 13, Phaser.Math.DegToRad(18), Phaser.Math.DegToRad(162));
  g.strokePath();

  // ── Legs ──
  g.fillStyle(BODY, 1);
  g.lineStyle(LINE, INK, 1);
  g.fillCircle(-20, 30, 12);
  g.strokeCircle(-20, 30, 12);
  g.fillCircle(20, 30, 12);
  g.strokeCircle(20, 30, 12);
}
