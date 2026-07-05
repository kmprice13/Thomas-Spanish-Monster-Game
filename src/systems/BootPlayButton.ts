/**
 * GameUI's real Jugar click handler only exists once MainScene.create() runs,
 * which waits on Tier-1 asset loading (see MainScene.preload) — a handful of
 * files now instead of the old 126MB, but still nonzero, so on a slow
 * connection a tap can land before that handler is attached. Without this,
 * that tap does nothing at all with no feedback, reading as a dead button.
 *
 * This listener is wired at module-load time (before Phaser even exists), so
 * an early tap always gets visible feedback and is replayed once the real
 * handler comes online, instead of being silently dropped.
 */
const btn = document.getElementById('play-button') as HTMLButtonElement | null;
const originalLabel = btn?.textContent ?? '';
let ready = false;
let pending = false;

btn?.addEventListener('click', () => {
  if (ready || pending) return;
  pending = true;
  btn.disabled = true;
  btn.textContent = 'Cargando…';
});

/** Call once GameUI's own click listener is attached (MainScene.create()). */
export function markPlayButtonReady(): void {
  ready = true;
  if (!btn || !pending) return;
  btn.disabled = false;
  btn.textContent = originalLabel;
  btn.click(); // replay the tap that arrived before the real handler existed
}
