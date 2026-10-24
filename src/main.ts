import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { SelectScene } from './scenes/SelectScene';
import { BattleScene } from './scenes/BattleScene';
import { WorldScene } from './scenes/WorldScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 960,
  height: 640,
  backgroundColor: '#1b2a1e',
  pixelArt: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BootScene, SelectScene, BattleScene, WorldScene],
});

// En desarrollo (o compilando con VITE_EXPOSE_GAME=1) se expone el juego para depurarlo desde la consola.
if (import.meta.env.DEV || import.meta.env.VITE_EXPOSE_GAME) (window as unknown as { __game: Phaser.Game }).__game = game;
