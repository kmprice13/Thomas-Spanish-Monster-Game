import './styles.css';
import Phaser from 'phaser';
import { MainScene } from './game/MainScene';

// `?test=1` uses a separate save slot (see ProgressStore) — flag it in the
// tab title so it's never ambiguous which save is active.
if (new URLSearchParams(location.search).get('test') === '1') {
  document.title = `🧪 ${document.title}`;
}

new Phaser.Game({
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  backgroundColor: '#3ab8e8',
  scene: [MainScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    parent: 'app',
  },
  input: { keyboard: true, touch: true, mouse: true },
  render: { antialias: true, pixelArt: false },
});
