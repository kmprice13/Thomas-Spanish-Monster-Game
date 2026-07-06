import './styles.css';
import Phaser from 'phaser';
import { MainScene } from './game/MainScene';
import { DebugGameScene } from './game/DebugGameScene';
import { ProgressStore } from './systems/ProgressStore';

// `?test=1` uses a separate save slot (see ProgressStore) — flag it in the
// tab title so it's never ambiguous which save is active.
if (new URLSearchParams(location.search).get('test') === '1') {
  document.title = `🧪 ${document.title}`;
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  backgroundColor: '#3ab8e8',
  // DebugGameScene declares itself active:false/visible:false in its own
  // constructor, so it stays dormant until picked from the hub — only
  // MainScene auto-runs at boot, same as before this game mode existed.
  scene: [MainScene, DebugGameScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    parent: 'app',
  },
  input: { keyboard: true, touch: true, mouse: true },
  render: { antialias: true, pixelArt: false },
});

// Hub button: dismiss the start screen, freeze MainScene in place (sleep, not
// stop — stop() would re-run create() and reset its whole state machine), and
// start a fresh DebugGameScene session.
document.getElementById('find-mistake-button')?.addEventListener('click', () => {
  document.getElementById('start-screen')?.classList.add('hidden');
  game.scene.sleep('MainScene');
  game.scene.start('DebugGameScene');
});

// Hub gear icon → reuse the existing settings panel (same one used in-game).
document.getElementById('hub-settings-button')?.addEventListener('click', () => {
  document.getElementById('settings-panel')?.classList.remove('hidden');
});

// Hub speaker icon → toggle the existing sound checkbox so the real mute
// logic (persist + live-update MainScene's AudioSystem) runs unchanged,
// rather than re-implementing mute handling here.
const hubMuteButton = document.getElementById('hub-mute-button');
const setSoundCheckbox = document.getElementById('set-sound') as HTMLInputElement | null;
if (hubMuteButton && setSoundCheckbox) {
  hubMuteButton.classList.toggle('muted', new ProgressStore().settings.muted);
  hubMuteButton.addEventListener('click', () => {
    setSoundCheckbox.checked = !setSoundCheckbox.checked;
    setSoundCheckbox.dispatchEvent(new Event('change'));
    hubMuteButton.classList.toggle('muted', !setSoundCheckbox.checked);
  });
}

// "Coming soon" slots — gentle shake, no action (more games land here later).
['hub-soon-left', 'hub-soon-right'].forEach((id) => {
  const btn = document.getElementById(id);
  btn?.addEventListener('click', () => {
    btn.classList.remove('shake');
    void btn.offsetWidth; // restart the animation if clicked again quickly
    btn.classList.add('shake');
  });
});
