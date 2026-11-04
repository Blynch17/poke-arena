import Phaser from 'phaser';
import { POKEMON, maxUses } from '../data';
import { Entry, teamCards, dataPanel, CARD_H, CARD_GAP } from '../teamui';
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

export interface WorldData { team?: number[]; tx?: number; ty?: number; dir?: Dir; result?: 'win' | 'lose'; out?: number[] }

// Un Pokémon que anda por la ruta junto al entrenador: camina por casillas, sigue al jugador si este se aleja y
// deambula solo cuando está cerca.
interface Follower {
  id: number;                // índice en POKEMON
  img: Phaser.GameObjects.Image;
  tx: number; ty: number;
  dir: Dir;
  mv: { fx: number; fy: number; tx: number; ty: number; t: number } | null;
  wait: number;              // ms hasta que elija otro destino
  goal: [number, number] | null; // casilla a la que va caminando
  away: number;              // ms seguidos lejos del jugador
  returning: boolean;        // vuelve hacia el jugador hasta quedar cerca
}
const FOLLOW_STEP_MS = 230;  // un poco más lento que el jugador (200), para que se queden un paso atrás
const RETURN_STEP_MS = 170;  // pero más rápido que él cuando vuelven, para alcanzarlo
const FOLLOW_NEAR = 2;       // al volver paran a esta distancia del jugador
const NEAR_AWAY = 4;         // más lejos que esto cuenta como "lejos"
const AWAY_MAX = 6000;       // tras tanto tiempo lejos, vuelven sí o sí
const MAX_DIST = 14;         // o si se alejan tanto (más allá de la pantalla)
const STILL_MS = 800;        // el jugador cuenta como quieto tras este tiempo sin caminar

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
  private menuScreen: 'main' | 'options' | 'team' | 'actions' | 'data' | 'move' = 'main';
  private menuSel = 0;      // Pokémon elegido en la pantalla Pokémon
  private menuMsg = '';
  private followers: Follower[] = [];
  private outIds: number[] = [];   // Pokémon que están fuera, por índice en POKEMON
  private stillMs = 0;             // hace cuánto no camina el jugador
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
    this.menuScreen = 'main';
    this.menuSel = 0;
    this.menuMsg = '';
    this.followers = [];
    this.stillMs = 0;
    this.outIds = back ? [...(data.out ?? [])] : [];
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
    this.outIds.forEach((id) => this.spawnFollower(id, false));   // los que estaban fuera siguen fuera al volver de una batalla

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
    this.updateFollowers(delta);
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
      returnTo: { team: this.team, tx: this.tx, ty: this.ty, dir: this.dir, out: this.outIds },
    });
  }


  // ---------- Pokémon fuera de su bola ----------

  private isOut(id: number) { return this.outIds.includes(id); }

  /** Casilla del jugador, o a la que va si está caminando. */
  private playerTile(): [number, number] { return this.moving ? [this.moving.tx, this.moving.ty] : [this.tx, this.ty]; }

  private occupied(x: number, y: number, self?: Follower) {
    const [px, py] = this.playerTile();
    if ((x === px && y === py) || (x === this.tx && y === this.ty)) return true;
    return this.followers.some((f) => f !== self && ((f.tx === x && f.ty === y) || (f.mv && f.mv.tx === x && f.mv.ty === y)));
  }

  /** Saca o guarda un Pokémon: el que sale aparece junto al entrenador. */
  private toggleOut(id: number) {
    if (this.isOut(id)) {
      this.outIds = this.outIds.filter((o) => o !== id);
      const f = this.followers.find((q) => q.id === id);
      this.followers = this.followers.filter((q) => q.id !== id);
      if (f) this.tweens.add({ targets: f.img, scale: 0, alpha: 0, duration: 220, onComplete: () => f.img.destroy() });
    } else {
      this.outIds.push(id);
      this.spawnFollower(id, true);
    }
  }

  private spawnFollower(id: number, pop: boolean) {
    const [px, py] = this.playerTile();
    const back = VEC[this.dir];
    // la casilla libre más cercana al jugador, empezando por la de atrás
    const cands: [number, number][] = [[px - back[0], py - back[1]], [px + back[1], py - back[0]], [px - back[1], py + back[0]], [px + back[0], py + back[1]]];
    for (let r = 2; r <= 3; r++) for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) if (Math.max(Math.abs(dx), Math.abs(dy)) === r) cands.push([px + dx, py + dy]);
    const at = cands.find(([x, y]) => this.walkable(x, y) && !this.occupied(x, y)) ?? [px, py];
    const img = this.add.image((at[0] + 0.5) * TILE, (at[1] + 1) * TILE, `${POKEMON[id].id}-walk`, ROW[this.dir] * 2).setOrigin(0.5, 1).setScale(2).setDepth((at[1] + 1) * TILE + 1);
    const f: Follower = { id, img, tx: at[0], ty: at[1], dir: this.dir, mv: null, wait: 600 + Math.random() * 800, goal: null, away: 0, returning: false };
    this.followers.push(f);
    if (pop) { img.setScale(0.2).setAlpha(0.2); this.tweens.add({ targets: img, scale: 2, alpha: 1, duration: 260, ease: 'Back.easeOut' }); }
  }

  private followerStep(f: Follower, nx: number, ny: number) {
    const dx = nx - f.tx, dy = ny - f.ty;
    f.dir = dx > 0 ? 'right' : dx < 0 ? 'left' : dy > 0 ? 'down' : 'up';
    f.mv = { fx: f.tx, fy: f.ty, tx: nx, ty: ny, t: 0 };
  }

  /** Destino al azar: con el jugador quieto, cualquier punto de la pantalla; caminando, cerca de él o lejos (hasta salir de la vista). */
  private pickGoal(f: Follower): [number, number] | null {
    const [px, py] = this.playerTile(), still = this.stillMs > STILL_MS, v = this.cameras.main.worldView;
    const near = !still && Math.random() < 0.6;
    for (let k = 0; k < 24; k++) {
      let x: number, y: number;
      if (still) { x = Phaser.Math.Between(Math.floor(v.x / TILE), Math.floor(v.right / TILE)); y = Phaser.Math.Between(Math.floor(v.y / TILE), Math.floor(v.bottom / TILE)); }
      else { const r = near ? 3 : MAX_DIST - 2; x = px + Phaser.Math.Between(-r, r); y = py + Phaser.Math.Between(-r, r); }
      if (!this.walkable(x, y) || this.occupied(x, y, f) || (x === f.tx && y === f.ty)) continue;
      if (this.findPath([f.tx, f.ty], [x, y])) return [x, y];
    }
    return null;
  }

  private updateFollowers(dt: number) {
    this.stillMs = this.moving ? 0 : this.stillMs + dt;
    const [px, py] = this.playerTile();
    for (const f of this.followers) {
      const dist = Math.abs(f.tx - px) + Math.abs(f.ty - py);
      f.away = dist > NEAR_AWAY ? f.away + dt : 0;
      if (!f.returning && (f.away > AWAY_MAX || dist > MAX_DIST)) { f.returning = true; f.goal = null; }   // pueden alejarse, pero siempre vuelven
      if (f.mv) {
        const ms = f.returning ? RETURN_STEP_MS : FOLLOW_STEP_MS;
        f.mv.t += dt;
        const k = Math.min(1, f.mv.t / ms);
        const x = Phaser.Math.Linear((f.mv.fx + 0.5) * TILE, (f.mv.tx + 0.5) * TILE, k), y = Phaser.Math.Linear((f.mv.fy + 1) * TILE, (f.mv.ty + 1) * TILE, k);
        f.img.setPosition(x, y).setDepth(y + 1).setFrame(ROW[f.dir] * 2 + (k < 0.5 ? 1 : 0));
        if (k >= 1) { f.tx = f.mv.tx; f.ty = f.mv.ty; f.mv = null; f.img.setFrame(ROW[f.dir] * 2); }
        continue;
      }
      if (f.tx === px && f.ty === py) {   // el jugador se le subió encima: se aparta
        const opts = (Object.values(VEC) as [number, number][]).map(([dx, dy]) => [f.tx + dx, f.ty + dy] as [number, number]).filter(([x, y]) => this.walkable(x, y) && !this.occupied(x, y, f));
        if (opts.length) { const [x, y] = Phaser.Utils.Array.GetRandom(opts); this.followerStep(f, x, y); }
        continue;
      }
      if (f.returning) {   // vuelve junto al jugador por el camino más corto
        if (dist <= FOLLOW_NEAR) { f.returning = false; f.away = 0; f.wait = 600; continue; }
        const path = this.findPath([f.tx, f.ty], [px, py]);
        if (path && path.length > 1 && !this.occupied(path[0][0], path[0][1], f)) this.followerStep(f, path[0][0], path[0][1]);
        continue;
      }
      if (f.goal) {   // camina hacia su destino
        const [gx, gy] = f.goal;
        if (f.tx === gx && f.ty === gy) { f.goal = null; f.wait = 800 + Math.random() * 2200; continue; }
        const path = this.findPath([f.tx, f.ty], [gx, gy]);
        if (path && path.length && !this.occupied(path[0][0], path[0][1], f)) this.followerStep(f, path[0][0], path[0][1]);
        else { f.goal = null; f.wait = 400; }   // se le cruzó algo: elige otro destino
        continue;
      }
      f.wait -= dt;
      if (f.wait > 0) continue;
      f.goal = Math.random() < 0.85 ? this.pickGoal(f) : null;
      if (!f.goal) { f.wait = 700 + Math.random() * 1500; f.dir = Phaser.Utils.Array.GetRandom(['up', 'down', 'left', 'right'] as Dir[]); f.img.setFrame(ROW[f.dir] * 2); }   // a veces solo mira a otro lado
    }
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
      returnTo: { team: this.team, tx: this.tx, ty: this.ty, dir: this.dir, out: this.outIds },
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
    if (this.menuScreen === 'options') {
      return [`Música    ${bar(settings.music)}`, `Efectos   ${bar(settings.sfx)}`, `Controles: ${settings.controls === 'keys' ? 'Teclado' : 'Mouse'}`, 'Atrás'];
    }
    if (this.menuScreen === 'actions') return ['Datos', 'Mover', this.isOut(this.team[this.menuSel]) ? 'Guardar Pokémon' : 'Sacar Pokémon', 'Atrás'];
    return ['Continuar', 'Pokémon', 'Opciones', 'Salir al menú de equipos'];
  }

  // Mis Pokémon, en el orden en que saldrán a pelear. Sus PS y PP vuelven a estar completos en cada batalla.
  private teamEntries(): Entry[] {
    return this.team.map((i, k) => {
      const def = POKEMON[i];
      return { def, level: def.level, hp: def.maxHp, maxHp: def.maxHp, stats: def.stats, pp: def.moves.map(maxUses), tag: [k === 0 ? 'abre las batallas' : '', this.isOut(i) ? 'fuera' : ''].filter(Boolean).join(' · ') || undefined };
    });
  }

  private openMenuScreen(screen: 'main' | 'options' | 'team' | 'actions' | 'data' | 'move', idx = 0) {
    this.menuScreen = screen;
    this.menuIdx = idx;
    this.menuMsg = '';
  }

  private renderMenu() {
    this.menuLayer.removeAll(true);
    if (!this.menuOpen) return;
    const scr = this.menuScreen;
    if (scr === 'team' || scr === 'actions' || scr === 'data' || scr === 'move') { this.renderTeamMenu(); return; }
    const items = this.menuItems();
    const h = 130 + items.length * 40, y0 = 320 - h / 2;
    const objs: Phaser.GameObjects.GameObject[] = [
      this.add.rectangle(480, 320, 960, 640, 0x000000, 0.45),
      this.add.rectangle(480, 320, 580, h, 0x1b2a1e).setStrokeStyle(4, 0xffd23f),
      this.add.text(480, y0 + 28, scr === 'options' ? 'OPCIONES' : 'MENÚ', { fontSize: '26px', color: '#ffd23f', fontStyle: 'bold' }).setOrigin(0.5),
    ];
    items.forEach((t, i) => {
      objs.push(this.add.text(214, y0 + 66 + i * 40, `${i === this.menuIdx ? '▶ ' : '  '}${t}`, {
        fontSize: '22px', color: i === this.menuIdx ? '#ffffff' : '#9fb8a6',
      }));
    });
    const hint = scr === 'options' ? '↑ ↓ mover · ← → volumen · ENTER cambiar · ESC volver' : '↑ ↓ mover · ENTER aceptar · ESC cerrar';
    objs.push(this.add.text(480, y0 + h - 22, hint, { fontSize: '15px', color: '#cfe8cf' }).setOrigin(0.5));
    this.menuLayer.add(objs);
  }

  // Pantalla Pokémon: tarjetas con imagen, nivel y PS. Al elegir uno: "Datos" o "Mover" (intercambia su lugar con otro).
  private renderTeamMenu() {
    const scr = this.menuScreen, entries = this.teamEntries(), n = entries.length;
    const objs: Phaser.GameObjects.GameObject[] = [this.add.rectangle(480, 320, 960, 640, 0x000000, 0.6)];
    if (scr === 'data') {
      objs.push(...dataPanel(this, entries[this.menuSel], 480, 320));
      this.menuLayer.add(objs);
      return;
    }
    const options = this.menuItems();
    const rows = scr === 'actions' ? 1 : n, listH = rows * (CARD_H + CARD_GAP);
    const extra = scr === 'team' ? 46 : scr === 'actions' ? options.length * 40 + 8 : 0;
    const h = 100 + listH + extra + 36, y0 = 320 - h / 2;
    const hint = this.menuMsg || (scr === 'move' ? 'Elige con quién intercambiar su lugar · ENTER confirmar · ESC cancelar' : scr === 'team' ? '↑ ↓ elegir · ENTER abrir opciones · el primero abre las batallas · ESC volver' : '↑ ↓ mover · ENTER aceptar · ESC volver');
    objs.push(this.add.rectangle(480, 320, 640, h, 0x1b2a1e).setStrokeStyle(4, 0xffd23f));
    objs.push(this.add.text(480, y0 + 26, scr === 'move' ? 'MOVER A…' : 'POKÉMON', { fontSize: '26px', color: '#ffd23f', fontStyle: 'bold' }).setOrigin(0.5));
    if (scr === 'actions') {
      objs.push(...teamCards(this, [entries[this.menuSel]], -1, 480, y0 + 56, 580));
      options.forEach((o, i) => objs.push(this.add.text(214, y0 + 56 + listH + 4 + i * 40, `${i === this.menuIdx ? '▶ ' : '  '}${o}`, { fontSize: '22px', color: i === this.menuIdx ? '#ffffff' : '#9fb8a6' })));
    } else {
      objs.push(...teamCards(this, entries, this.menuIdx < n ? this.menuIdx : -1, 480, y0 + 56, 580, scr === 'move' ? this.menuSel : -1));
      if (scr === 'team') objs.push(this.add.text(214, y0 + 56 + listH + 4, `${this.menuIdx === n ? '▶ ' : '  '}Atrás`, { fontSize: '22px', color: this.menuIdx === n ? '#ffffff' : '#9fb8a6' }));
    }
    objs.push(this.add.text(480, y0 + h - 22, hint, { fontSize: '15px', color: '#cfe8cf', align: 'center', wordWrap: { width: 600 } }).setOrigin(0.5));
    this.menuLayer.add(objs);
  }

  private onKey(e: KeyboardEvent) {
    if (this.busy) return;
    if (!this.menuOpen) {
      if (e.key === 'Enter' && !this.moving) { this.menuOpen = true; this.openMenuScreen('main'); this.path = []; this.renderMenu(); }
      return;
    }
    const scr = this.menuScreen;
    if (scr === 'data') {   // cualquier tecla de aceptar o volver cierra los datos
      if (e.key === 'Enter' || e.key === 'Escape' || e.key === 'Backspace') { this.openMenuScreen('actions'); this.renderMenu(); }
      return;
    }
    const n = scr === 'team' ? this.team.length + 1 : scr === 'move' ? this.team.length : this.menuItems().length;
    const back = e.key === 'Escape' || e.key === 'Backspace';
    if (e.key === 'ArrowDown') this.menuIdx = (this.menuIdx + 1) % n;
    else if (e.key === 'ArrowUp') this.menuIdx = (this.menuIdx + n - 1) % n;
    else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && scr === 'options' && this.menuIdx <= 1) {
      const which = this.menuIdx === 0 ? 'music' : 'sfx';
      const v = Phaser.Math.Clamp(settings[which] + (e.key === 'ArrowRight' ? 1 : -1), 0, 10);
      if (v !== settings[which]) {
        settings[which] = v;
        saveSettings();
        music.applyVolumes();
        if (which === 'sfx') sfx.rustle();             // muestra del nuevo volumen
      }
    } else if (back) {
      if (scr === 'main') this.menuOpen = false;
      else if (scr === 'options') this.openMenuScreen('main', 2);
      else if (scr === 'team') this.openMenuScreen('main', 1);
      else if (scr === 'actions') this.openMenuScreen('team', this.menuSel);
      else if (scr === 'move') this.openMenuScreen('actions', 1);
    } else if (e.key === 'Enter') {
      if (scr === 'main') {
        if (this.menuIdx === 0) this.menuOpen = false;
        else if (this.menuIdx === 1) this.openMenuScreen('team');
        else if (this.menuIdx === 2) this.openMenuScreen('options');
        else { this.scene.start('Select'); return; }
      } else if (scr === 'options') {
        if (this.menuIdx === 2) { settings.controls = settings.controls === 'keys' ? 'mouse' : 'keys'; saveSettings(); this.path = []; this.refreshHint(); }
        else if (this.menuIdx === 3) this.openMenuScreen('main', 2);
      } else if (scr === 'team') {
        if (this.menuIdx >= this.team.length) this.openMenuScreen('main', 1);
        else { this.menuSel = this.menuIdx; this.openMenuScreen('actions'); }
      } else if (scr === 'actions') {
        if (this.menuIdx === 0) this.openMenuScreen('data');
        else if (this.menuIdx === 1) {
          if (this.team.length < 2) this.menuMsg = 'No hay otro Pokémon con quien intercambiar.';
          else this.openMenuScreen('move', this.menuSel === 0 ? 1 : 0);
        } else if (this.menuIdx === 2) {
          const id = this.team[this.menuSel], was = this.isOut(id);
          this.toggleOut(id);
          this.menuMsg = was ? `${POKEMON[id].name} volvió a su bola.` : `${POKEMON[id].name} salió a caminar contigo.`;
        } else this.openMenuScreen('team', this.menuSel);
      } else if (scr === 'move') {
        const from = this.menuSel, to = this.menuIdx;
        if (to !== from) [this.team[from], this.team[to]] = [this.team[to], this.team[from]];   // el que quede primero abre las batallas
        this.openMenuScreen('team', to);
        this.menuMsg = to !== from ? `${POKEMON[this.team[to]].name} pasó al puesto ${to + 1}.` : '';
      }
    } else return;
    this.renderMenu();
  }
}
