import './styles.css';
import Phaser from 'phaser';
import { MainScene } from './game/MainScene';

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
  render: { antialias: false, pixelArt: true },
});
