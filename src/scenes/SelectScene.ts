import Phaser from 'phaser';
import { POKEMON, TYPE_COLOR } from '../data';
import { music } from '../music';
import { sfx } from '../sfx';
import { settings } from '../settings';

const TEAM_SIZE = 3;
const COLS = 4; // columnas de la cuadrícula; las filas se calculan según cuántos combatientes haya
const ROW_H = 132;
const TOP = 140;      // la cuadrícula se ve entre el encabezado (arriba) y la ayuda (abajo) y se desplaza con el cursor
const BOTTOM = 535;

export class SelectScene extends Phaser.Scene {
  private cursor = 0;
  private picks: number[] = [];
  private cards: Phaser.GameObjects.Rectangle[] = [];
  private badges: Phaser.GameObjects.Text[] = [];
  private rowObjs: Phaser.GameObjects.GameObject[][] = []; // objetos de cada fila, para ocultar los que quedan fuera de la vista
  private lit = -1;        // tarjeta con el borde resaltado
  private info!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private modeText!: Phaser.GameObjects.Text;
  // arena: contra un rival con equipo · wild: contra un Pokémon salvaje, con Pokébolas · adventure: camina por la ruta y aparecen salvajes
  private mode: 'arena' | 'wild' | 'adventure' = 'arena';

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
    this.rowObjs = [];
    this.lit = -1;
    this.input.keyboard!.addCapture('UP,DOWN,LEFT,RIGHT,ENTER,SPACE,TAB');

    const bg = this.cameras.main.backgroundColor;
    const fixed = <T extends Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.ScrollFactor & Phaser.GameObjects.Components.Depth>(o: T, d = 21) => o.setScrollFactor(0).setDepth(d) as T;
    // franjas que tapan las tarjetas al desplazarse bajo el encabezado y la ayuda
    fixed(this.add.rectangle(480, TOP / 2, 960, TOP, bg.color), 20);
    fixed(this.add.rectangle(480, (BOTTOM + 640) / 2, 960, 640 - BOTTOM, bg.color), 20);
    fixed(this.add.text(480, 50, 'POKE ARENA', { fontSize: '44px', color: '#ffd23f', fontStyle: 'bold' }).setOrigin(0.5));
    fixed(this.add.text(480, 96, `Elige ${TEAM_SIZE} Pokémon (el primero es el que sale a pelear)`, { fontSize: '18px', color: '#cfe8cf' }).setOrigin(0.5));

    this.modeText = fixed(this.add.text(480, 124, '', { fontSize: '17px', color: '#ffd23f' }).setOrigin(0.5));
    POKEMON.forEach((p, i) => {
      const x = 480 + ((i % COLS) - (COLS - 1) / 2) * 225;
      const y = TOP + ROW_H / 2 + Math.floor(i / COLS) * ROW_H;
      const row = Math.floor(i / COLS);
      const mine = (this.rowObjs[row] ??= []);
      const card = this.add.rectangle(x, y, 205, 124, 0x24382a).setStrokeStyle(4, 0x3f5c48);
      this.cards.push(card);
      mine.push(card, this.add.image(x, y - 14, `${p.id}-front`).setScale(0.85));
      mine.push(this.add.text(x, y + 38, `${p.name}  #${p.dex}`, { fontSize: '16px', color: '#fff' }).setOrigin(0.5));
      p.types.forEach((t, k) => {
        const tx = x + (k - (p.types.length - 1) / 2) * 58;
        mine.push(this.add.rectangle(tx, y + 55, 52, 13, TYPE_COLOR[t]));
        mine.push(this.add.text(tx, y + 55, t, { fontSize: '10px', color: '#000' }).setOrigin(0.5));
      });
      const badge = this.add.text(x - 94, y - 58, '', { fontSize: '24px', color: '#ffd23f', fontStyle: 'bold' });
      this.badges.push(badge);
      mine.push(badge);
    });

    this.info = fixed(this.add.text(480, 568, '', { fontSize: '16px', color: '#cfe8cf', align: 'center' }).setOrigin(0.5));
    this.hint = fixed(this.add.text(480, 618, '', { fontSize: '18px', color: '#fff' }).setOrigin(0.5));

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
    else if (e.key === 'Tab') this.mode = this.mode === 'arena' ? 'wild' : this.mode === 'wild' ? 'adventure' : 'arena';
    else if (e.key === 'Backspace') this.picks.pop();
    else if (e.key === 'Enter') {
      if (this.picks.length === TEAM_SIZE) {
        if (this.mode === 'adventure') this.scene.start('World', { team: this.picks });
        else this.scene.start('Battle', { team: this.picks, wild: this.mode === 'wild' });
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
    const modeLabel = (
      this.mode === 'arena' ? 'Modo: combate de arena   ·   TAB: cambiar de modo'
        : this.mode === 'wild' ? 'Modo: Pokémon salvaje (Poké Balls)   ·   TAB: cambiar de modo'
        : 'Modo: aventura por la ruta (hierba alta)   ·   TAB: cambiar de modo'
    );
    if (this.modeText.text !== modeLabel) this.modeText.setText(modeLabel);
    // solo se cambian la tarjeta que se deja y la que se resalta (y los textos solo si cambian: cada setText vuelve a dibujar)
    if (this.lit !== this.cursor) {
      this.cards[this.lit]?.setStrokeStyle(4, 0x3f5c48);
      this.cards[this.cursor].setStrokeStyle(4, 0xffd23f);
      this.lit = this.cursor;
    }
    // desplaza la cuadrícula para que la fila del cursor quede a la vista, lo más centrada posible
    const view = BOTTOM - TOP, maxScroll = Math.max(0, Math.ceil(POKEMON.length / COLS) * ROW_H - view);
    this.cameras.main.scrollY = Math.round(Phaser.Math.Clamp(Math.floor(this.cursor / COLS) * ROW_H - (view - ROW_H) / 2, 0, maxScroll));
    this.badges.forEach((b, i) => {
      const k = this.picks.indexOf(i);
      const t = k >= 0 ? `${k + 1}` : '';
      if (b.text !== t) b.setText(t);
    });
    const first = Math.floor(this.cameras.main.scrollY / ROW_H) - 1, last = Math.ceil((this.cameras.main.scrollY + view) / ROW_H) + 1;
    this.rowObjs.forEach((objs, r) => {
      const show = r >= first && r <= last;
      if ((objs[0] as Phaser.GameObjects.Rectangle).visible !== show) objs.forEach((o) => (o as Phaser.GameObjects.Image).setVisible(show));
    });
    const p = POKEMON[this.cursor];
    const st = p.stats;
    const infoText = (
      `#${p.dex} ${p.name}  ·  PS ${p.maxHp}  Atq ${st.atk}  Def ${st.def}  AtqEsp ${st.spa}  DefEsp ${st.spd}  Vel ${st.spe}\n` +
        p.moves.map((m, i) => `${(settings.controls === 'keys' ? 'UIOP' : 'QWER')[i]}: ${m.name}`).join('   ')
    );
    if (this.info.text !== infoText) this.info.setText(infoText);
    const hintText = this.picks.length === TEAM_SIZE
      ? 'ENTER: ¡Comenzar!   (Retroceso: quitar el último)'
      : 'Flechas: mover   ENTER: elegir   Retroceso: quitar';
    if (this.hint.text !== hintText) this.hint.setText(hintText);
  }
}
