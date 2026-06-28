import Phaser from 'phaser';

// ── Pixel size (screen pixels per art pixel) ──────────────────────────────────
const PS = 6;

// ── Island palette (flat, no alpha — pixel art uses opaque fills) ─────────────
const C_SAND_OUTER  = 0xf0d875;
const C_SAND_INNER  = 0xdcb848;
const C_GRASS_DARK  = 0x2a8010;
const C_GRASS_MID1  = 0x389820;
const C_GRASS_MID2  = 0x4eaa28;
const C_GRASS_MID3  = 0x64bc34;
const C_GRASS_LIGHT = 0x78d042;
const C_MOUND       = 0x88e050;
const C_MOUND_HI    = 0x98f060;

export function drawIsland(g: Phaser.GameObjects.Graphics, cx: number, cy: number): void {
  // Semi-axes of the sand ellipse
  const SA = 271;
  const SB = 173;

  // Bounding box with one-pixel margin so edge is fully visible
  const x0 = Math.floor((cx - SA - PS) / PS) * PS;
  const y0 = Math.floor((cy - SB - PS) / PS) * PS;
  const x1 = Math.ceil( (cx + SA + PS) / PS) * PS;
  const y1 = Math.ceil( (cy + SB + PS) / PS) * PS;

  for (let py = y0; py < y1; py += PS) {
    for (let px = x0; px < x1; px += PS) {
      // Centre of this art pixel in screen space
      const pcx = px + PS * 0.5;
      const pcy = py + PS * 0.5;

      const dx = pcx - cx;
      const dy = pcy - cy;

      // Normalized elliptical distance from island centre (1 = edge, 0 = centre)
      const sandNorm = Math.sqrt((dx / SA) ** 2 + (dy / SB) ** 2);

      // ── Irregular island boundary ──────────────────────────────────────────
      // Sum of sine waves at different angular frequencies = organic coastline.
      // Using dy/SB and dx/SA normalises the angle to the ellipse's own space
      // so bumps are evenly spaced around the perimeter rather than squashed.
      const angle = Math.atan2(dy / SB, dx / SA);
      const edgeNoise =
        Math.sin(angle *  3.0 + 0.80) * 0.072 +   // large bays / headlands
        Math.sin(angle *  7.0 + 2.10) * 0.042 +   // medium bumps
        Math.sin(angle * 13.0 + 0.50) * 0.026 +   // small jags
        Math.sin(angle * 23.0 + 1.70) * 0.013;    // fine pixel detail
      const outerEdge = 1.0 + edgeNoise;

      if (sandNorm > outerEdge) continue; // ocean — skip

      // All internal thresholds are proportional to outerEdge so every layer
      // (sand, grass, mound) tracks the same irregular coastline shape.
      const relNorm = sandNorm / outerEdge; // 0 = centre, 1 = coast

      let color: number;

      // ── Sand rim ──────────────────────────────────────────────────────────
      if (relNorm > 0.86) {
        color = C_SAND_OUTER;
      } else if (relNorm > 0.75) {
        color = C_SAND_INNER;

      // ── Grass zone ────────────────────────────────────────────────────────
      } else {
        // Mound: offset slightly left and up, smaller ellipse
        const mdx = dx + 28;
        const mdy = dy + 6;
        const moundNorm = Math.sqrt((mdx / 120) ** 2 + (mdy / 74) ** 2);

        if (moundNorm < 0.35) {
          color = C_MOUND_HI;
        } else if (moundNorm < 0.72) {
          color = C_MOUND;
        } else {
          // Grass shading: darker at top of island (elevation illusion), lighter at front
          const grassBand = (pcy - (cy - SB)) / (SB * 1.6); // 0 = top-back, 1 = front
          if      (grassBand < 0.22) color = C_GRASS_DARK;
          else if (grassBand < 0.40) color = C_GRASS_MID1;
          else if (grassBand < 0.58) color = C_GRASS_MID2;
          else if (grassBand < 0.74) color = C_GRASS_MID3;
          else                       color = C_GRASS_LIGHT;
        }
      }

      g.fillStyle(color, 1);
      g.fillRect(px, py, PS, PS);
    }
  }
}
