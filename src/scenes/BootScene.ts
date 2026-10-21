import Phaser from 'phaser';
import { POKEMON } from '../data';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    this.add.text(480, 320, 'Cargando...', { fontSize: '24px', color: '#fff' }).setOrigin(0.5);
    for (const p of POKEMON) {
      this.load.image(`${p.id}-front`, `sprites/${p.id}-front.png`);
      this.load.image(`${p.id}-back`, `sprites/${p.id}-back.png`);
      this.load.spritesheet(`${p.id}-walk`, `sprites/${p.id}-walk.png`, { frameWidth: 32, frameHeight: 32 });
    }
  }

  create() {
    // Proyectil: orbe con brillo, se tiñe según el tipo.
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff, 0.25).fillCircle(16, 16, 16);
    g.fillStyle(0xffffff, 0.6).fillCircle(16, 16, 11);
    g.fillStyle(0xffffff, 1).fillCircle(16, 16, 6);
    g.generateTexture('orb', 32, 32);
    g.destroy();
    this.scene.start('Select');
  }
}
