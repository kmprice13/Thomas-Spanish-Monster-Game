import Phaser from 'phaser';

export function drawIsland(g: Phaser.GameObjects.Graphics, cx: number, cy: number): void {
  // ── Sand beach rim ────────────────────────────────────────────────────────
  // Outer sand with slight organic wobble (16-point polygon offset from ellipse)
  const sandWobble = [0, 0.01, -0.01, 0.02, 0, 0.01, -0.02, 0.01, 0, 0.01, -0.01, 0.02, -0.01, 0, 0.02, -0.01];
  const sandPts: Phaser.Types.Math.Vector2Like[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const rm = 1 + sandWobble[i];
    sandPts.push({ x: cx + Math.cos(a) * 271 * rm, y: cy + Math.sin(a) * 173 * rm });
  }
  g.fillStyle(0xf5e080, 1);
  g.fillPoints(sandPts, true);

  // Inner sand band (darker tone gives beach depth)
  g.fillStyle(0xdcb848, 0.35);
  g.fillEllipse(cx, cy + 5, 515, 330);

  // Sand-to-grass fringe (very slight green tint at inner edge)
  g.fillStyle(0xa8c840, 0.28);
  g.fillEllipse(cx, cy, 495, 314);

  // ── Grass — layered for elevation illusion ─────────────────────────────────
  // Back grass: darkest green (visually "highest/furthest")
  g.fillStyle(0x2a8010, 1);
  g.fillEllipse(cx, cy - 14, 488, 298);

  // Back-mid grass
  g.fillStyle(0x389820, 1);
  g.fillEllipse(cx, cy - 7,  468, 285);

  // Mid grass
  g.fillStyle(0x4eaa28, 1);
  g.fillEllipse(cx, cy,      448, 272);

  // Front-mid grass (lighter = "lower/closer")
  g.fillStyle(0x64bc34, 1);
  g.fillEllipse(cx, cy + 10, 425, 258);

  // Front highlight (brightest, sun-facing)
  g.fillStyle(0x78d042, 1);
  g.fillEllipse(cx - 18, cy + 6, 368, 228);

  // Central mound (elevated island center)
  g.fillStyle(0x88e050, 1);
  g.fillEllipse(cx - 28, cy - 6, 240, 148);

  // Mound top-highlight (sunlit peak)
  g.fillStyle(0x98f060, 0.6);
  g.fillEllipse(cx - 40, cy - 22, 145, 88);

  // ── Elevation shadow (mound cast shadow) ──────────────────────────────────
  // Dark ellipse below the mound center implies height
  g.fillStyle(0x1a6008, 0.22);
  g.fillEllipse(cx + 8, cy + 48, 295, 62);

  // ── Path suggestion (slightly lighter strip) ──────────────────────────────
  g.fillStyle(0x90d855, 0.3);
  g.fillEllipse(cx, cy + 30, 52, 225);

  // ── Inner dark patch (very center — original design element) ─────────────
  g.fillStyle(0x3a9018, 0.18);
  g.fillEllipse(cx, cy, 295, 185);
}
