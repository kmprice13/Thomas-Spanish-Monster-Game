import Phaser from 'phaser';

const INK = 0x120d1a;

export function drawIsland(g: Phaser.GameObjects.Graphics, cx: number, cy: number): void {
  // Sand rim
  g.fillStyle(0xf0d87a, 1);
  g.fillEllipse(cx, cy, 540, 345);

  // Grass
  g.fillStyle(0x6ec840, 1);
  g.fillEllipse(cx, cy, 490, 310);

  // Inner darker patch
  g.fillStyle(0x5bb832, 1);
  g.fillEllipse(cx, cy, 300, 190);

  // 10 trees around the sand rim
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.3;
    const tx = cx + Math.cos(a) * 255;
    const ty = cy + Math.sin(a) * 162;
    drawTree(g, tx, ty);
  }
}

function drawTree(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
  // Trunk
  g.fillStyle(0x7a4e2a, 1);
  g.fillRect(x - 5, y - 10, 10, 22);
  g.lineStyle(3, INK, 1);
  g.strokeRect(x - 5, y - 10, 10, 22);

  // 3 leaf blobs (drawn back-to-front)
  const leafData: Array<[number, number, number, number]> = [
    [-12, -16, 14, 0x52b440],
    [12, -16, 14, 0x52b440],
    [0, -28, 18, 0x3ea030],
  ];
  for (const [dx, dy, r, c] of leafData) {
    g.fillStyle(c, 1);
    g.fillCircle(x + dx, y + dy, r);
    g.lineStyle(3, INK, 1);
    g.strokeCircle(x + dx, y + dy, r);
  }
}
