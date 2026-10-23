import Phaser from 'phaser';
import { POKEMON, TYPE_COLOR } from '../data';
import { music } from '../music';
import { sfx } from '../sfx';
import { settings } from '../settings';

const TEAM_SIZE = 3;
const COLS = 4; // columnas de la cuadrícula; las filas se calculan según cuántos combatientes haya

export class SelectScene extends Phaser.Scene {
  private cursor = 0;
  private picks: number[] = [];
  private cards: Phaser.GameObjects.Rectangle[] = [];
  private badges: Phaser.GameObjects.Text[] = [];
  private info!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private modeText!: Phaser.GameObjects.Text;
  private mode: 'arena' | 'wild' = 'arena'; // arena: contra un rival con equipo · wild: contra un Pokémon salvaje, con Pokébolas

  constructor() {
    super('Select');
  }

  create() {
    music.play('select');
    this.cursor = 0;
    this.picks = [];
    this.mode = 'arena';
    this.cards = [];
    this.badges = [];
    this.input.keyboard!.addCapture('UP,DOWN,LEFT,RIGHT,ENTER,SPACE,TAB');

    this.add.text(480, 50, 'POKE ARENA', { fontSize: '44px', color: '#ffd23f', fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(480, 96, `Elige ${TEAM_SIZE} Pokémon (el primero es el que sale a pelear)`, { fontSize: '18px', color: '#cfe8cf' }).setOrigin(0.5);

    this.modeText = this.add.text(480, 124, '', { fontSize: '17px', color: '#ffd23f' }).setOrigin(0.5);
    const rows = Math.ceil(POKEMON.length / COLS);
    POKEMON.forEach((p, i) => {
      const x = 480 + ((i % COLS) - (COLS - 1) / 2) * 225;
      const y = 330 + (Math.floor(i / COLS) - (rows - 1) / 2) * 132;
      this.cards.push(this.add.rectangle(x, y, 205, 124, 0x24382a).setStrokeStyle(4, 0x3f5c48));
      this.add.image(x, y - 14, `${p.id}-front`).setScale(0.85);
      this.add.text(x, y + 38, `${p.name}  #${p.dex}`, { fontSize: '16px', color: '#fff' }).setOrigin(0.5);
      p.types.forEach((t, k) => {
        const tx = x + (k - (p.types.length - 1) / 2) * 58;
        this.add.rectangle(tx, y + 55, 52, 13, TYPE_COLOR[t]);
        this.add.text(tx, y + 55, t, { fontSize: '10px', color: '#000' }).setOrigin(0.5);
      });
      this.badges.push(this.add.text(x - 94, y - 58, '', { fontSize: '24px', color: '#ffd23f', fontStyle: 'bold' }));
    });

    this.info = this.add.text(480, 560, '', { fontSize: '16px', color: '#cfe8cf', align: 'center' }).setOrigin(0.5);
    this.hint = this.add.text(480, 606, '', { fontSize: '18px', color: '#fff' }).setOrigin(0.5);

    const born = performance.now(); // el Enter que inició la escena no debe contar
    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => {
      if (e.timeStamp >= born) this.onKey(e);
    });
    this.refresh();
  }

  private onKey(e: KeyboardEvent) {
    void sfx.preload(); // en cuanto hay una tecla, el audio está listo para cargar sonidos locales
    const n = POKEMON.length;
    if (e.key === 'ArrowRight') this.cursor = (this.cursor + 1) % n;
    else if (e.key === 'ArrowLeft') this.cursor = (this.cursor + n - 1) % n;
    else if (e.key === 'ArrowDown') this.moveVertical(1);
    else if (e.key === 'ArrowUp') this.moveVertical(-1);
    else if (e.key === 'Tab') this.mode = this.mode === 'arena' ? 'wild' : 'arena';
    else if (e.key === 'Backspace') this.picks.pop();
    else if (e.key === 'Enter') {
      if (this.picks.length === TEAM_SIZE) {
        this.scene.start('Battle', { team: this.picks, wild: this.mode === 'wild' });
        return;
      }
      if (!this.picks.includes(this.cursor)) this.picks.push(this.cursor);
    }
    this.refresh();
  }

  // Sube o baja una fila en la misma columna; si la última fila está incompleta, salta a la que tenga combatiente.
  private moveVertical(dir: number) {
    const n = POKEMON.length, rows = Math.ceil(n / COLS), col = this.cursor % COLS;
    let r = Math.floor(this.cursor / COLS);
    do r = (r + dir + rows) % rows; while (r * COLS + col >= n);
    this.cursor = r * COLS + col;
  }

  private refresh() {
    this.modeText.setText(
      this.mode === 'arena'
        ? 'Modo: combate de arena   ·   TAB: cambiar a Pokémon salvaje'
        : 'Modo: Pokémon salvaje (Poké Balls)   ·   TAB: cambiar a combate de arena',
    );
    this.cards.forEach((c, i) => c.setStrokeStyle(4, i === this.cursor ? 0xffd23f : 0x3f5c48));
    this.badges.forEach((b, i) => {
      const k = this.picks.indexOf(i);
      b.setText(k >= 0 ? `${k + 1}` : '');
    });
    const p = POKEMON[this.cursor];
    const st = p.stats;
    this.info.setText(
      `${p.name}  ·  PS ${p.maxHp}  Atq ${st.atk}  Def ${st.def}  AtqEsp ${st.spa}  DefEsp ${st.spd}  Vel ${st.spe}\n` +
        p.moves.map((m, i) => `${(settings.controls === 'keys' ? 'UIOP' : 'QWER')[i]}: ${m.name}`).join('   '),
    );
    this.hint.setText(
      this.picks.length === TEAM_SIZE
        ? 'ENTER: ¡Comenzar!   (Retroceso: quitar el último)'
        : 'Flechas: mover   ENTER: elegir   Retroceso: quitar',
    );
  }
}
