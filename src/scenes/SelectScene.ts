import Phaser from 'phaser';
import { POKEMON, TYPE_COLOR } from '../data';

const TEAM_SIZE = 3;

export class SelectScene extends Phaser.Scene {
  private cursor = 0;
  private picks: number[] = [];
  private cards: Phaser.GameObjects.Rectangle[] = [];
  private badges: Phaser.GameObjects.Text[] = [];
  private info!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;

  constructor() {
    super('Select');
  }

  create() {
    this.cursor = 0;
    this.picks = [];
    this.cards = [];
    this.badges = [];
    this.input.keyboard!.addCapture('UP,DOWN,LEFT,RIGHT,ENTER,SPACE');

    this.add.text(480, 50, 'POKE ARENA', { fontSize: '44px', color: '#ffd23f', fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(480, 96, `Elige ${TEAM_SIZE} Pokémon (el primero es el que sale a pelear)`, { fontSize: '18px', color: '#cfe8cf' }).setOrigin(0.5);

    POKEMON.forEach((p, i) => {
      const x = 180 + (i % 3) * 300;
      const y = 230 + Math.floor(i / 3) * 210;
      this.cards.push(this.add.rectangle(x, y, 250, 190, 0x24382a).setStrokeStyle(4, 0x3f5c48));
      this.add.image(x, y - 14, `${p.id}-front`).setScale(1.5);
      this.add.text(x, y + 62, p.name, { fontSize: '20px', color: '#fff' }).setOrigin(0.5);
      p.types.forEach((t, k) => {
        this.add.rectangle(x - 30 + k * 60, y + 86, 52, 14, TYPE_COLOR[t]);
        this.add.text(x - 30 + k * 60, y + 86, t, { fontSize: '10px', color: '#000' }).setOrigin(0.5);
      });
      this.badges.push(this.add.text(x - 112, y - 88, '', { fontSize: '26px', color: '#ffd23f', fontStyle: 'bold' }));
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
    const n = POKEMON.length;
    if (e.key === 'ArrowRight') this.cursor = (this.cursor + 1) % n;
    else if (e.key === 'ArrowLeft') this.cursor = (this.cursor + n - 1) % n;
    else if (e.key === 'ArrowDown') this.cursor = (this.cursor + 3) % n;
    else if (e.key === 'ArrowUp') this.cursor = (this.cursor + n - 3) % n;
    else if (e.key === 'Backspace') this.picks.pop();
    else if (e.key === 'Enter') {
      if (this.picks.length === TEAM_SIZE) {
        this.scene.start('Battle', { team: this.picks });
        return;
      }
      if (!this.picks.includes(this.cursor)) this.picks.push(this.cursor);
    }
    this.refresh();
  }

  private refresh() {
    this.cards.forEach((c, i) => c.setStrokeStyle(4, i === this.cursor ? 0xffd23f : 0x3f5c48));
    this.badges.forEach((b, i) => {
      const k = this.picks.indexOf(i);
      b.setText(k >= 0 ? `${k + 1}` : '');
    });
    const p = POKEMON[this.cursor];
    const st = p.stats;
    this.info.setText(
      `${p.name}  ·  PS ${p.maxHp}  Atq ${st.atk}  Def ${st.def}  AtqEsp ${st.spa}  DefEsp ${st.spd}  Vel ${st.spe}\n` +
        p.moves.map((m, i) => `${'UIOP'[i]}: ${m.name}`).join('   '),
    );
    this.hint.setText(
      this.picks.length === TEAM_SIZE
        ? 'ENTER: ¡Comenzar!   (Retroceso: quitar el último)'
        : 'Flechas: mover   ENTER: elegir   Retroceso: quitar',
    );
  }
}
