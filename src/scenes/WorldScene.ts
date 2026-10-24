import Phaser from 'phaser';
import { buildRoute, TILE, MAP_W, MAP_H, ROUTE_NAME, isWalkable, pickEncounter, RouteMap, RIVAL } from '../route';
import { music } from '../music';
import { sfx } from '../sfx';
import { settings, saveSettings } from '../settings';

type Dir = 'down' | 'up' | 'left' | 'right';
const ROW: Record<Dir, number> = { down: 0, up: 1, left: 2, right: 3 };   // filas de la hoja del entrenador
const VEC: Record<Dir, [number, number]> = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] };
const STEP_MS = 200;        // lo que tarda en cruzar un tile
const TURN_MS = 110;        // girar en el lugar antes de avanzar, como en los juegos
const ENCOUNTER_RATE = 0.14; // probabilidad de encuentro por paso en hierba alta
const SAFE_STEPS = 3;       // pasos sin encuentros al volver de una batalla

export interface WorldData { team?: number[]; tx?: number; ty?: number; dir?: Dir; result?: 'win' | 'lose' }

let rivalBeaten = false;   // dura mientras no se salga de la aventura

export class WorldScene extends Phaser.Scene {
  private map!: RouteMap;
  private team: number[] = [0, 1, 2];
  private player!: Phaser.GameObjects.Image;
  private grassOver!: Phaser.GameObjects.Image;
  private tx = 0;
  private ty = 0;
  private dir: Dir = 'up';
  private moving: { fx: number; fy: number; tx: number; ty: number; t: number } | null = null;
  private stepToggle = false;
  private turnUntil = 0;
  private now = 0;
  private path: [number, number][] = [];
  private pathMark!: Phaser.GameObjects.Graphics;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private water: Phaser.GameObjects.Image[] = [];
  private waterT = 0;
  private menuOpen = false;
  private menuIdx = 0;
  private menuLayer!: Phaser.GameObjects.Container;
  private busy = false;          // transición hacia la batalla
  private safeSteps = 0;
  private encounterRate = ENCOUNTER_RATE;
  private hint!: Phaser.GameObjects.Text;
  private rival!: Phaser.GameObjects.Image;
  private challenged = false;   // el rival ya vio al jugador y la batalla está por empezar

  constructor() {
    super('World');
  }

  create(data: WorldData) {
    this.team = data.team ?? [0, 1, 2];
    this.map = buildRoute();
    const back = data.tx !== undefined && data.ty !== undefined;
    // Al perder contra el rival se vuelve a la entrada de la ruta.
    const lost = back && data.result === 'lose';
    if (!back) rivalBeaten = false;
    if (back && data.result === 'win') rivalBeaten = true;
    this.tx = back && !lost ? data.tx! : this.map.start.x;
    this.ty = back && !lost ? data.ty! : this.map.start.y;
    this.dir = lost ? 'up' : data.dir ?? 'up';
    this.moving = null;
    this.path = [];
    this.menuOpen = false;
    this.menuIdx = 0;
    this.busy = false;
    this.safeSteps = back ? SAFE_STEPS : 0;
    this.challenged = false;
    this.water = [];
    this.waterT = 0;
    this.now = 0;
    this.turnUntil = 0;
    this.encounterRate = ENCOUNTER_RATE;
    this.input.keyboard!.addCapture('UP,DOWN,LEFT,RIGHT,ENTER,SPACE');
    music.play('world');
    void sfx.preload();

    this.drawMap();

    const px = (this.tx + 0.5) * TILE, py = (this.ty + 1) * TILE;
    this.player = this.add.image(px, py, 'trainer-walk', ROW[this.dir] * 3).setOrigin(0.5, 1).setScale(2).setDepth(py + 1);
    this.rival = this.add.image((RIVAL.x + 0.5) * TILE, (RIVAL.y + 1) * TILE, 'trainer-rival', ROW[RIVAL.dir] * 3)
      .setOrigin(0.5, 1).setScale(2).setDepth((RIVAL.y + 1) * TILE + 1);
    this.grassOver = this.add.image(0, 0, 'tile-tall-over').setOrigin(0, 0).setScale(2).setVisible(false);
    this.pathMark = this.add.graphics().setDepth(5);
    this.updateGrassOver(this.tx, this.ty);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, MAP_W * TILE, MAP_H * TILE);
    cam.startFollow(this.player, true, 0.18, 0.18);
    cam.roundPixels = true;

    // Cartel con el nombre de la ruta y ayuda de controles.
    const banner = this.add.text(480, 56, ROUTE_NAME, {
      fontSize: '30px', color: '#ffffff', stroke: '#1b2a1e', strokeThickness: 6, fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2e6);
    this.tweens.add({ targets: banner, alpha: 0, delay: 2400, duration: 700 });
    this.hint = this.add.text(480, 618, '', { fontSize: '14px', color: '#ffffff', stroke: '#1b2a1e', strokeThickness: 4 })
      .setOrigin(0.5).setScrollFactor(0).setDepth(2e6);
    this.refreshHint();

    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as Record<string, Phaser.Input.Keyboard.Key>;
    this.menuLayer = this.add.container(0, 0).setScrollFactor(0).setDepth(3e6);
    const born = performance.now(); // la tecla que inició la escena no debe contar
    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => {
      if (e.timeStamp >= born) this.onKey(e);
    });
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => this.onPointer(ptr));
  }

  // ---------- mapa ----------

  private drawMap() {
    const { tiles, w, h } = this.map;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const k = tiles[y][x];
      const tex = k === 'grass' ? `tile-grass-${(x * 7 + y * 13) % 3}`
        : k === 'flower' ? 'tile-flower' : k === 'path' ? 'tile-path' : k === 'tall' ? 'tile-tall'
        : k === 'tree' ? 'tile-tree' : k === 'water' ? 'tile-water-0' : k === 'fence' ? 'tile-fence' : 'tile-rock';
      const img = this.add.image(x * TILE, y * TILE, tex).setOrigin(0, 0).setScale(2);
      // árboles, cercos y rocas se ordenan por su base para que el entrenador pase por detrás o por delante
      img.setDepth(k === 'tree' || k === 'fence' || k === 'rock' ? (y + 1) * TILE : 0);
      if (k === 'water') this.water.push(img);
    }
  }

  private walkable(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.map.w && y < this.map.h && isWalkable(this.map.tiles[y][x]) && !(x === RIVAL.x && y === RIVAL.y);
  }

  private refreshHint() {
    this.hint.setText(settings.controls === 'keys'
      ? 'WASD o flechas: caminar · ENTER: menú'
      : 'Clic: caminar hasta ese punto · ENTER: menú');
  }

  // ---------- movimiento ----------

  update(_time: number, delta: number) {
    this.waterT += delta;
    if (this.waterT > 550) {
      this.waterT = 0;
      const f = this.water[0]?.texture.key === 'tile-water-0' ? 1 : 0;
      this.water.forEach((i) => i.setTexture(`tile-water-${f}`));
    }
    this.pathMark.clear();
    if (this.path.length) {
      const [x, y] = this.path[this.path.length - 1];
      this.pathMark.lineStyle(4, 0xffe066, 0.9).strokeCircle((x + 0.5) * TILE, (y + 0.5) * TILE, 14 + 2 * Math.sin(this.now / 120));
    }
    if (this.menuOpen || this.busy) return;
    this.now += delta;
    if (this.moving) this.advance(delta);
    else this.tryStart();
  }

  private keyDir(): Dir | null {
    const k = this.keys;
    if (settings.controls === 'keys') {
      if (k.W.isDown) return 'up';
      if (k.S.isDown) return 'down';
      if (k.A.isDown) return 'left';
      if (k.D.isDown) return 'right';
    }
    if (k.UP.isDown) return 'up';
    if (k.DOWN.isDown) return 'down';
    if (k.LEFT.isDown) return 'left';
    if (k.RIGHT.isDown) return 'right';
    return null;
  }

  private setFrame(col: number) {
    this.player.setFrame(ROW[this.dir] * 3 + col);
  }

  private tryStart() {
    let want = this.keyDir();
    if (want) this.path = [];                       // el teclado cancela el camino del mouse
    else if (this.path.length) {
      const [nx, ny] = this.path[0];
      const dx = nx - this.tx, dy = ny - this.ty;
      want = dx > 0 ? 'right' : dx < 0 ? 'left' : dy > 0 ? 'down' : 'up';
    }
    if (!want) { this.setFrame(0); return; }
    if (want !== this.dir) {                        // primero gira en el lugar
      this.dir = want;
      this.turnUntil = this.now + TURN_MS;
      this.setFrame(0);
      return;
    }
    if (this.now < this.turnUntil) return;
    const [dx, dy] = VEC[want];
    const nx = this.tx + dx, ny = this.ty + dy;
    if (!this.walkable(nx, ny)) { this.path = []; this.setFrame(0); return; }
    this.moving = { fx: this.tx, fy: this.ty, tx: nx, ty: ny, t: 0 };
    this.stepToggle = !this.stepToggle;
    if (this.path.length) this.path.shift();
  }

  private advance(delta: number) {
    const m = this.moving!;
    m.t += delta;
    const k = Math.min(1, m.t / STEP_MS);
    const x = Phaser.Math.Linear((m.fx + 0.5) * TILE, (m.tx + 0.5) * TILE, k);
    const y = Phaser.Math.Linear((m.fy + 1) * TILE, (m.ty + 1) * TILE, k);
    this.player.setPosition(x, y).setDepth(y + 1);
    this.setFrame(k < 0.5 ? (this.stepToggle ? 1 : 2) : 0);      // pie A o B en la primera mitad, quieto en la segunda
    this.updateGrassOver(k >= 0.5 ? m.tx : m.fx, k >= 0.5 ? m.ty : m.fy);
    if (k < 1) return;
    this.tx = m.tx;
    this.ty = m.ty;
    this.moving = null;
    this.onArrive();
    if (!this.busy) this.tryStart();                              // si sigue la tecla, el siguiente paso es continuo
  }

  // La hierba alta cubre los pies del entrenador mientras está dentro de ella.
  private updateGrassOver(tx: number, ty: number) {
    const inTall = this.map.tiles[ty]?.[tx] === 'tall';
    this.grassOver.setVisible(inTall);
    if (inTall) this.grassOver.setPosition(tx * TILE, ty * TILE).setDepth(this.player.depth + 1);
  }

  private onArrive() {
    const safe = this.safeSteps > 0;          // este paso aún cuenta como "seguro" (sin encuentros)
    if (safe) this.safeSteps--;
    if (this.checkRival()) return;
    if (this.map.tiles[this.ty][this.tx] !== 'tall') return;
    sfx.rustle();
    if (!safe && Math.random() < this.encounterRate) this.startEncounter();
  }

  // ---------- encuentros ----------

  private startEncounter() {
    this.busy = true;
    this.path = [];
    sfx.encounter();
    this.setFrame(0);
    const mark = this.add.text(this.player.x, this.player.y - 90, '!', {
      fontSize: '48px', color: '#ffffff', stroke: '#c0392b', strokeThickness: 8, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(1e6);
    this.tweens.add({ targets: mark, y: mark.y - 12, duration: 200, yoyo: true });
    this.cameras.main.flash(160, 255, 255, 255);
    this.time.delayedCall(320, () => this.cameras.main.flash(160, 255, 255, 255));
    this.time.delayedCall(850, () => this.launchBattle());
  }

  /** Elige qué Pokémon salvaje aparece según la tabla de la ruta y abre la batalla. */
  private launchBattle() {
    const e = pickEncounter(Math.random());
    this.scene.start('Battle', {
      team: this.team, wild: true, wildId: e.id, wildLevel: e.level,
      returnTo: { team: this.team, tx: this.tx, ty: this.ty, dir: this.dir },
    });
  }

  // ---------- entrenador rival ----------

  /** ¿El jugador está dentro de la línea de visión del rival, sin nada que la tape? */
  private rivalSees(): boolean {
    const [dx, dy] = VEC[RIVAL.dir];
    for (let i = 1; i <= RIVAL.sight; i++) {
      const x = RIVAL.x + dx * i, y = RIVAL.y + dy * i;
      if (!this.walkable(x, y)) return false;
      if (x === this.tx && y === this.ty) return true;
    }
    return false;
  }

  private checkRival(): boolean {
    if (rivalBeaten || this.challenged || !this.rivalSees()) return false;
    this.challenged = true;
    this.busy = true;
    this.path = [];
    this.setFrame(0);
    sfx.encounter();
    const mark = this.add.text(this.rival.x, this.rival.y - 150, '!', {
      fontSize: '48px', color: '#ffffff', stroke: '#c0392b', strokeThickness: 8, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(1e6);
    this.tweens.add({ targets: mark, y: mark.y - 12, duration: 200, yoyo: true });
    // el rival camina hasta quedar frente al jugador y este se voltea hacia él
    const [dx, dy] = VEC[RIVAL.dir];
    const steps = Math.max(0, Math.abs(this.tx - RIVAL.x) + Math.abs(this.ty - RIVAL.y) - 1);
    this.dir = RIVAL.dir === 'left' ? 'right' : RIVAL.dir === 'right' ? 'left' : RIVAL.dir === 'up' ? 'down' : 'up';
    this.setFrame(0);
    this.time.delayedCall(600, () => {
      if (steps === 0) return this.rivalSpeech();
      this.tweens.add({
        targets: this.rival, x: this.rival.x + dx * steps * TILE, y: this.rival.y + dy * steps * TILE,
        duration: steps * STEP_MS, onComplete: () => this.rivalSpeech(),
      });
      this.tweens.addCounter({ from: 0, to: steps * 2, duration: steps * STEP_MS, onUpdate: (t) => this.rival.setFrame(ROW[RIVAL.dir] * 3 + (Math.floor(t.getValue()!) % 2 ? 1 : 2)) });
    });
    return true;
  }

  private rivalSpeech() {
    this.rival.setFrame(ROW[RIVAL.dir] * 3);
    const box = this.add.rectangle(480, 560, 820, 80, 0x1b2a1e).setStrokeStyle(4, 0xffd23f).setScrollFactor(0).setDepth(2e6);
    const txt = this.add.text(480, 560, `${RIVAL.name}: ¡Eh, tú! Nadie cruza mi camino sin pelear.`, { fontSize: '22px', color: '#ffffff' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(2e6);
    this.time.delayedCall(1700, () => { box.destroy(); txt.destroy(); this.cameras.main.flash(160, 255, 255, 255); });
    this.time.delayedCall(2100, () => this.scene.start('Battle', {
      team: this.team, trainer: RIVAL.name,
      returnTo: { team: this.team, tx: this.tx, ty: this.ty, dir: this.dir },
    }));
  }

  // ---------- mouse: caminar hasta el tile pulsado ----------

  private onPointer(ptr: Phaser.Input.Pointer) {
    if (settings.controls !== 'mouse' || this.menuOpen || this.busy || !ptr.leftButtonDown()) return;
    const x = Math.floor(ptr.worldX / TILE), y = Math.floor(ptr.worldY / TILE);
    const from: [number, number] = this.moving ? [this.moving.tx, this.moving.ty] : [this.tx, this.ty];
    const p = this.findPath(from, [x, y]);
    if (p) this.path = p;
  }

  /** Camino más corto entre dos tiles (búsqueda en anchura); null si no se puede llegar. */
  private findPath(from: [number, number], to: [number, number]): [number, number][] | null {
    if (!this.walkable(to[0], to[1]) || (from[0] === to[0] && from[1] === to[1])) return null;
    const key = (x: number, y: number) => y * this.map.w + x;
    const prev = new Map<number, number>();
    prev.set(key(from[0], from[1]), -1);
    const queue: [number, number][] = [from];
    while (queue.length) {
      const [x, y] = queue.shift()!;
      if (x === to[0] && y === to[1]) break;
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const nx = x + dx, ny = y + dy;
        if (!this.walkable(nx, ny) || prev.has(key(nx, ny))) continue;
        prev.set(key(nx, ny), key(x, y));
        queue.push([nx, ny]);
      }
    }
    if (!prev.has(key(to[0], to[1]))) return null;
    const out: [number, number][] = [];
    for (let k = key(to[0], to[1]); k !== -1 && k !== key(from[0], from[1]); k = prev.get(k)!) out.unshift([k % this.map.w, Math.floor(k / this.map.w)]);
    return out;
  }

  // ---------- menú ----------

  private menuItems(): string[] {
    const bar = (v: number) => `${'█'.repeat(v)}${'░'.repeat(10 - v)} ${v}`;
    return [
      'Continuar',
      `Música    ${bar(settings.music)}`,
      `Efectos   ${bar(settings.sfx)}`,
      `Controles: ${settings.controls === 'keys' ? 'Teclado' : 'Mouse'}`,
      'Salir al menú de equipos',
    ];
  }

  private renderMenu() {
    this.menuLayer.removeAll(true);
    if (!this.menuOpen) return;
    const items = this.menuItems();
    const h = 130 + items.length * 40, y0 = 320 - h / 2;
    const objs: Phaser.GameObjects.GameObject[] = [
      this.add.rectangle(480, 320, 960, 640, 0x000000, 0.45),
      this.add.rectangle(480, 320, 580, h, 0x1b2a1e).setStrokeStyle(4, 0xffd23f),
      this.add.text(480, y0 + 28, 'MENÚ', { fontSize: '26px', color: '#ffd23f', fontStyle: 'bold' }).setOrigin(0.5),
    ];
    items.forEach((t, i) => {
      objs.push(this.add.text(214, y0 + 66 + i * 40, `${i === this.menuIdx ? '▶ ' : '  '}${t}`, {
        fontSize: '22px', color: i === this.menuIdx ? '#ffffff' : '#9fb8a6',
      }));
    });
    objs.push(this.add.text(480, y0 + h - 22, '↑ ↓ mover · ← → volumen · ENTER aceptar · ESC cerrar', { fontSize: '15px', color: '#cfe8cf' }).setOrigin(0.5));
    this.menuLayer.add(objs);
  }

  private onKey(e: KeyboardEvent) {
    if (this.busy) return;
    if (!this.menuOpen) {
      if (e.key === 'Enter' && !this.moving) { this.menuOpen = true; this.menuIdx = 0; this.path = []; this.renderMenu(); }
      return;
    }
    const n = this.menuItems().length;
    if (e.key === 'ArrowDown') this.menuIdx = (this.menuIdx + 1) % n;
    else if (e.key === 'ArrowUp') this.menuIdx = (this.menuIdx + n - 1) % n;
    else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && (this.menuIdx === 1 || this.menuIdx === 2)) {
      const which = this.menuIdx === 1 ? 'music' : 'sfx';
      const v = Phaser.Math.Clamp(settings[which] + (e.key === 'ArrowRight' ? 1 : -1), 0, 10);
      if (v !== settings[which]) {
        settings[which] = v;
        saveSettings();
        music.applyVolumes();
        if (which === 'sfx') sfx.rustle();             // muestra del nuevo volumen
      }
    } else if (e.key === 'Escape') this.menuOpen = false;
    else if (e.key === 'Enter') {
      if (this.menuIdx === 0) this.menuOpen = false;
      else if (this.menuIdx === 3) { settings.controls = settings.controls === 'keys' ? 'mouse' : 'keys'; saveSettings(); this.path = []; this.refreshHint(); }
      else if (this.menuIdx === 4) { this.scene.start('Select'); return; }
    } else return;
    this.renderMenu();
  }
}
