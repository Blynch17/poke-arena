import Phaser from 'phaser';
import { POKEMON, walkScale, PokemonDef, Party, maxUses, makeCombatant, moveByKey } from '../data';
import { defaultMoves, withMoves } from '../moveset';
import { START_LEVEL, expAt } from '../exp';
import { Entry, teamCards, dataPanel, cardMetrics } from '../teamui';
import { ROUTES, RouteDef, Exit, TILE, TileKey, isWalkable, isEncounterTile, pickEncounter, RouteMap, RIVAL } from '../route';
import { music } from '../music';
import { sfx } from '../sfx';
import { settings, saveSettings } from '../settings';

type Dir = 'down' | 'up' | 'left' | 'right';
const ROW: Record<Dir, number> = { down: 0, up: 1, left: 2, right: 3 };   // filas de la hoja del entrenador
const VEC: Record<Dir, [number, number]> = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] };
const STEP_MS = 200;        // lo que tarda en cruzar un tile
const TURN_MS = 110;        // girar en el lugar antes de avanzar, como en los juegos
const ENCOUNTER_RATE = 0.1;  // probabilidad de encuentro por paso en hierba alta (además de los Pokémon que se ven por la ruta)
const SAFE_STEPS = 3;       // pasos sin encuentros al volver de una batalla

export interface WorldData { team?: number[]; tx?: number; ty?: number; dir?: Dir; result?: 'win' | 'lose'; out?: number[]; route?: string; warp?: boolean; party?: Party; items?: { potion: number; ether: number } }

// Pokémon salvajes visibles: salen de la hierba alta, pasean un rato y vuelven a esconderse en ella.
const WILD_MAX = 4;                 // a la vez en el mapa
const WILD_SPAWN_MS = 2500;         // cada cuánto se intenta que aparezca uno
const WILD_SPAWN_P = 0.45;          // probabilidad de que aparezca en cada intento (si hay lugar)
const WILD_DIST: [number, number] = [8, 18];   // a qué distancia del jugador (tiles) pueden aparecer
const WILD_WANDER_STEP = 340;       // ms por casilla al pasear
const WILD_CHASE_STEP = 240;        // al perseguir (el jugador camina a 200: si corre, se les escapa)
const WILD_RETURN_STEP = 260;       // al volver a su lugar
const WILD_LEASH = 10;              // un agresivo persigue hasta esta distancia (casillas) de donde apareció
const WILD_CALM_MS: [number, number] = [8000, 14000];   // tras rendirse no vuelve a notar al jugador por este rato
const WILD_ROAM = 8;                // pasea como mucho a esta distancia de su lugar
const WILD_FLEE_STEP = 185;         // al huir
const WILD_LIFE: [number, number] = [26000, 52000];   // cuánto se quedan antes de volver a la hierba
const WILD_SIGHT = 7;               // distancia a la que un agresivo nota al jugador
const WILD_FLEE_DIST = 5;           // distancia a la que uno huidizo sale corriendo
const ORDER_STEP_MS = 175;          // ms por casilla de un Pokémon al que se le da una orden
const ORDER_HOLD_MS = 7000;         // tras una orden se queda por ahí antes de volver con el jugador
const THROW_RANGE = 9;              // tiles que alcanza la Pokébola
const BALL_NEAR = 3;                // un Pokémon salvaje a esta distancia (tiles) de donde cae la bola entra en batalla

type Temper = 'aggressive' | 'neutral' | 'skittish';
interface Wild {
  sp: PokemonDef; level: number; img: Phaser.GameObjects.Image; temper: Temper;
  tx: number; ty: number; dir: Dir;
  mv: { fx: number; fy: number; tx: number; ty: number; t: number } | null;
  state: 'wander' | 'alert' | 'chase' | 'return' | 'flee' | 'leave' | 'gone';
  home: [number, number];       // donde apareció: a donde vuelve si deja de perseguir
  calmUntil: number;            // hasta esta hora (this.now) no vuelve a notar al jugador
  wait: number; goal: [number, number] | null;
  age: number; life: number; until: number; fleeT: number; chaseT: number;
}
type Order = { kind: 'move'; goal: [number, number] } | { kind: 'attack'; target: Wild };
const SPECIES = new Map(POKEMON.map((p) => [p.id, p]));

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
  order: Order | null;       // orden del jugador (ir a un punto, atacar a un salvaje)
  stuckAt: number;           // desde cuándo (this.now) lo bloquea algo en el camino de su orden; 0 = libre
  hold: number;              // ms que le quedan de quedarse por donde lo mandaron antes de volver con el jugador
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
  private party: Party = {};       // PS y PP de cada Pokémon del equipo; no se recuperan solos
  private items = { potion: 3, ether: 3 };
  private stillMs = 0;             // hace cuánto no camina el jugador
  private menuLayer!: Phaser.GameObjects.Container;
  private busy = false;          // transición hacia la batalla
  private safeSteps = 0;
  private encounterRate = ENCOUNTER_RATE;
  private hint!: Phaser.GameObjects.Text;
  private rival!: Phaser.GameObjects.Image;
  private route!: RouteDef;
  private routeId = 'aromos';
  private challenged = false;   // el rival ya vio al jugador y la batalla está por empezar
  private rv: { x: number; y: number; dir: Dir } = { x: -9, y: -9, dir: 'left' };   // dónde espera el rival en este mapa
  private wilds: Wild[] = [];
  private encounterTiles: [number, number][] = [];   // casillas de hierba alta / matorral de la ruta
  private spawnT = 0;
  private wildGrace = 0;           // ms sin que ningún salvaje agresivo ataque (al entrar o volver de una batalla)
  private selected = 0;            // Pokémon elegido en la barra de abajo
  private barLayer!: Phaser.GameObjects.Container;
  private throwing = false;
  private pointerMoved = false;

  constructor() {
    super('World');
  }

  create(data: WorldData) {
    this.team = data.team ?? [0, 1, 2];
    this.routeId = data.route && ROUTES[data.route] ? data.route : 'aromos';
    this.route = ROUTES[this.routeId];
    this.map = this.route.build();
    this.rv = this.map.rival ?? { x: -9, y: -9, dir: 'left' };
    this.encounterTiles = [];
    this.map.tiles.forEach((row, y) => row.forEach((t, x) => { if (isEncounterTile(t)) this.encounterTiles.push([x, y]); }));
    if (data.warp) this.cameras.main.fadeIn(300, 0, 0, 0);   // llegada desde otra ruta
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
    // Al perder se vuelve a la entrada y el equipo se cura (como volver al Centro Pokémon); si no, se conserva lo que quedó.
    this.party = back && !lost ? { ...(data.party ?? {}) } : {};
    if (lost) {   // al perder se pierde el camino y se cura el equipo, pero no lo aprendido: conserva nivel y EXP
      for (const [k, v] of Object.entries(data.party ?? {})) {
        if (v.level === undefined) continue;
        const def = POKEMON[v.species ?? Number(k)];
        const moves = v.moves ?? defaultMoves(def.id, v.level);
        this.party[Number(k)] = { hp: makeCombatant(def, v.level).maxHp, pp: moves.map((m) => maxUses(moveByKey(m))), level: v.level, exp: v.exp, moves, species: v.species };
      }
    }
    this.items = back && data.items ? { ...data.items } : { potion: 3, ether: 3 };
    this.followers = [];
    this.stillMs = 0;
    this.outIds = back ? [...(data.out ?? [])] : [];
    this.busy = false;
    this.safeSteps = back ? SAFE_STEPS : 0;
    this.challenged = false;
    this.wilds = [];
    this.spawnT = 0;
    this.wildGrace = back ? 3500 : 2000;
    this.selected = 0;
    this.throwing = false;
    this.pointerMoved = false;
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
    if (this.hasRival()) {
      this.rival = this.add.image((this.rv.x + 0.5) * TILE, (this.rv.y + 1) * TILE, 'trainer-rival', ROW[this.rv.dir] * 3)
        .setOrigin(0.5, 1).setScale(2).setDepth((this.rv.y + 1) * TILE + 1);
    }
    this.grassOver = this.add.image(0, 0, 'tile-tall-over').setOrigin(0, 0).setScale(2).setVisible(false);
    this.pathMark = this.add.graphics().setDepth(5);
    this.updateGrassOver(this.tx, this.ty);
    this.outIds.forEach((id) => this.spawnFollower(id, false));   // los que estaban fuera siguen fuera al volver de una batalla

    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.map.w * TILE, this.map.h * TILE);
    cam.startFollow(this.player, true, 0.18, 0.18);
    cam.roundPixels = true;

    // Cartel con el nombre de la ruta y ayuda de controles.
    const banner = this.add.text(480, 56, this.route.name, {
      fontSize: '30px', color: '#ffffff', stroke: '#1b2a1e', strokeThickness: 6, fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2e6);
    this.tweens.add({ targets: banner, alpha: 0, delay: 2400, duration: 700 });
    this.hint = this.add.text(480, 628, '', { fontSize: '13px', color: '#ffffff', stroke: '#1b2a1e', strokeThickness: 4 })
      .setOrigin(0.5).setScrollFactor(0).setDepth(2e6);
    this.refreshHint();

    this.keys = this.input.keyboard!.addKeys('W,A,S,D') as Record<string, Phaser.Input.Keyboard.Key>;
    this.menuLayer = this.add.container(0, 0).setScrollFactor(0).setDepth(3e6);
    const born = performance.now(); // la tecla que inició la escena no debe contar
    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => {
      if (e.timeStamp >= born) this.onKey(e);
    });
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => this.onPointer(ptr));
    this.input.on('pointermove', () => { this.pointerMoved = true; });
    this.barLayer = this.add.container(0, 0).setScrollFactor(0).setDepth(2e6 - 1);
    this.refreshBar();
  }

  // ---------- mapa ----------

  private tileTexture(k: TileKey, x: number, y: number): string {
    const v = (x * 7 + y * 13) % 3;
    switch (k) {
      case 'grass': return `tile-grass-${v}`;
      case 'flower': return 'tile-flower';
      case 'path': return 'tile-path';
      case 'tall': return 'tile-tall';
      case 'tree': return 'tile-tree';
      case 'water': return 'tile-water-0';
      case 'fence': return 'tile-fence';
      case 'rock': return 'tile-rock';
      case 'sand': return `tile-sand-${v}`;
      case 'dune': return 'tile-dune';
      case 'brush': return 'tile-brush';
      case 'road': return 'tile-road';
      case 'cliff': return 'tile-cliff';
      case 'salt': return 'tile-salt';
      case 'cactus': return 'tile-cactus';
      default: return 'tile-rock-d';
    }
  }

  private drawMap() {
    const { tiles, w, h } = this.map;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const k = tiles[y][x];
      const img = this.add.image(x * TILE, y * TILE, this.tileTexture(k, x, y)).setOrigin(0, 0).setScale(2);
      // árboles, cercos, rocas y cactus se ordenan por su base para que el entrenador pase por detrás o por delante
      img.setDepth(k === 'tree' || k === 'fence' || k === 'rock' || k === 'cactus' || k === 'rockd' ? (y + 1) * TILE : 0);
      if (k === 'water') this.water.push(img);
    }
  }

  /** La especie actual de un integrante del equipo (cambia si evolucionó; la clave del equipo es la especie original). */
  private sp(uid: number): PokemonDef { return POKEMON[this.party[uid]?.species ?? uid]; }

  private hasRival() { return this.route.trainer && !!this.map.rival; }

  private walkable(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.map.w && y < this.map.h && isWalkable(this.map.tiles[y][x]) && !(this.hasRival() && x === this.rv.x && y === this.rv.y);
  }

  private refreshHint() {
    this.hint.setText('WASD: caminar · ← → o 1-6: elegir Pokémon · P: soltar / guardar · clic: ordenarle · ENTER: menú');
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
    for (const f of this.followers) {   // marca de la orden que lleva cada Pokémon
      const o = f.order;
      if (!o) continue;
      const r = 14 + 2 * Math.sin(this.now / 120);
      if (o.kind === 'move') this.pathMark.lineStyle(4, 0x7fd6ff, 0.9).strokeCircle((o.goal[0] + 0.5) * TILE, (o.goal[1] + 0.5) * TILE, r);
      else this.pathMark.lineStyle(4, 0xff7a6b, 0.9).strokeCircle(o.target.img.x, o.target.img.y - 30, 26 + 2 * Math.sin(this.now / 90));
    }
    if (this.menuOpen || this.busy) return;
    this.now += delta;
    this.updateFollowers(delta);
    this.updateWilds(delta);
    if (this.moving) this.advance(delta);
    else this.tryStart();
  }

  private keyDir(): Dir | null {
    const k = this.keys;
    if (k.W.isDown) return 'up';
    if (k.S.isDown) return 'down';
    if (k.A.isDown) return 'left';
    if (k.D.isDown) return 'right';
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
    const bump = this.wildAt(nx, ny);
    if (bump) { this.setFrame(0); this.engage(bump); return; }   // chocar con un Pokémon salvaje: batalla
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
    const t = this.map.tiles[ty]?.[tx], inTall = t !== undefined && isEncounterTile(t);
    this.grassOver.setVisible(inTall);
    if (inTall) this.grassOver.setTexture(t === 'brush' ? 'tile-brush-over' : 'tile-tall-over').setPosition(tx * TILE, ty * TILE).setDepth(this.player.depth + 1);
  }

  private onArrive() {
    const safe = this.safeSteps > 0;          // este paso aún cuenta como "seguro" (sin encuentros)
    if (safe) this.safeSteps--;
    const ex = this.map.exits.find((e) => e.x === this.tx && e.y === this.ty);
    if (ex) { this.warp(ex); return; }
    if (this.checkRival()) return;
    if (!isEncounterTile(this.map.tiles[this.ty][this.tx])) return;
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
    const e = pickEncounter(Math.random(), Math.random, this.route.encounters);
    this.scene.start('Battle', {
      team: this.team, wild: true, wildId: e.id, wildLevel: e.level, party: this.party, items: this.items,
      returnTo: { team: this.team, tx: this.tx, ty: this.ty, dir: this.dir, out: this.outIds, route: this.routeId },
    });
  }


  // ---------- paso entre rutas ----------

  /** Salida del mapa hacia otra ruta: se oscurece la pantalla y se aparece en la entrada de la ruta vecina (como las conexiones de los juegos). */
  private warp(ex: Exit) {
    this.busy = true;
    this.path = [];
    this.setFrame(0);
    this.cameras.main.fadeOut(280, 0, 0, 0);
    this.time.delayedCall(300, () => this.scene.start('World', { team: this.team, party: this.party, items: this.items, route: ex.to, tx: ex.tx, ty: ex.ty, dir: ex.dir, out: this.outIds, warp: true }));
  }

  // ---------- Pokémon fuera de su bola ----------

  private isOut(id: number) { return this.outIds.includes(id); }

  /** Casilla del jugador, o a la que va si está caminando. */
  private playerTile(): [number, number] { return this.moving ? [this.moving.tx, this.moving.ty] : [this.tx, this.ty]; }

  private occupied(x: number, y: number, self?: Follower | Wild) {
    const [px, py] = this.playerTile();
    if ((x === px && y === py) || (x === this.tx && y === this.ty)) return true;
    return this.followers.some((f) => f !== self && ((f.tx === x && f.ty === y) || (f.mv && f.mv.tx === x && f.mv.ty === y))) || !!this.wildAt(x, y);
  }

  /** El Pokémon salvaje que está en esa casilla (o yendo hacia ella), si hay. */
  private wildAt(x: number, y: number, self?: Wild): Wild | undefined {
    return this.wilds.find((w) => w !== self && w.state !== 'gone' && ((w.tx === x && w.ty === y) || (w.mv && w.mv.tx === x && w.mv.ty === y)));
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
    this.refreshBar();
  }

  private spawnFollower(id: number, pop: boolean, landing?: [number, number]) {
    const [px, py] = this.playerTile();
    const back = VEC[this.dir];
    // la casilla libre más cercana al jugador, empezando por la de atrás
    const cands: [number, number][] = [[px - back[0], py - back[1]], [px + back[1], py - back[0]], [px - back[1], py + back[0]], [px + back[0], py + back[1]]];
    for (let r = 2; r <= 3; r++) for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) if (Math.max(Math.abs(dx), Math.abs(dy)) === r) cands.push([px + dx, py + dy]);
    if (landing) cands.unshift(landing);
    const at = cands.find(([x, y]) => this.walkable(x, y) && !this.occupied(x, y)) ?? [px, py];
    const img = this.add.image((at[0] + 0.5) * TILE, (at[1] + 1) * TILE, `${this.sp(id).id}-walk`, ROW[this.dir] * 2).setOrigin(0.5, 1).setScale(2 * walkScale(this.sp(id).id)).setDepth((at[1] + 1) * TILE + 1);
    const f: Follower = { id, img, tx: at[0], ty: at[1], dir: this.dir, mv: null, wait: 600 + Math.random() * 800, goal: null, away: 0, returning: false, order: null, stuckAt: 0, hold: 0 };
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
    if (f.hold > 0) {   // tras una orden se queda cerca de donde lo mandaron
      for (let k = 0; k < 12; k++) {
        const x = f.tx + Phaser.Math.Between(-3, 3), y = f.ty + Phaser.Math.Between(-3, 3);
        if (this.walkable(x, y) && !this.occupied(x, y, f) && (x !== f.tx || y !== f.ty) && this.findPath([f.tx, f.ty], [x, y])) return [x, y];
      }
      return null;
    }
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
      if (f.hold > 0) f.hold -= dt;
      f.away = dist > NEAR_AWAY && !f.order && f.hold <= 0 ? f.away + dt : 0;
      if (!f.returning && !f.order && f.hold <= 0 && (f.away > AWAY_MAX || dist > MAX_DIST)) { f.returning = true; f.goal = null; }   // pueden alejarse, pero siempre vuelven
      if (f.mv) {
        const ms = f.order ? ORDER_STEP_MS : f.returning ? RETURN_STEP_MS : FOLLOW_STEP_MS;
        f.mv.t += dt;
        const k = Math.min(1, f.mv.t / ms);
        const x = Phaser.Math.Linear((f.mv.fx + 0.5) * TILE, (f.mv.tx + 0.5) * TILE, k), y = Phaser.Math.Linear((f.mv.fy + 1) * TILE, (f.mv.ty + 1) * TILE, k);
        f.img.setPosition(x, y).setDepth(y + 1).setFrame(ROW[f.dir] * 2 + (k < 0.5 ? 1 : 0));
        if (k >= 1) { f.tx = f.mv.tx; f.ty = f.mv.ty; f.mv = null; f.img.setFrame(ROW[f.dir] * 2); }
        continue;
      }
      if (f.order) { this.followerOrder(f); continue; }
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

  // ---------- barra de Pokémon, órdenes y Pokébola ----------

  /** Dibuja la barra de abajo: un casillero por Pokémon del equipo; en gris si está en su bola, a color si está afuera. */
  private refreshBar() {
    if (!this.barLayer) return;
    this.barLayer.removeAll(true);
    const n = this.team.length, size = 52, gap = 8, y = 590, x0 = 480 - (n * size + (n - 1) * gap) / 2 + size / 2;
    this.team.forEach((id, i) => {
      const x = x0 + i * (size + gap), out = this.isOut(id), faint = !!this.party[id] && this.party[id].hp <= 0, sel = i === this.selected;
      const def = this.sp(id), level = this.party[id]?.level ?? START_LEVEL, c = makeCombatant(def, level);
      const hpf = Phaser.Math.Clamp((this.party[id]?.hp ?? c.maxHp) / c.maxHp, 0, 1);
      const objs: Phaser.GameObjects.GameObject[] = [
        this.add.rectangle(x, y, size, size, out ? 0x2b4a33 : 0x1d2a22, 0.92).setStrokeStyle(sel ? 4 : 2, sel ? 0xffd23f : out ? 0x7fd69a : 0x4a5a50),
      ];
      const img = this.add.image(x, y - 3, `${def.id}-front`).setScale(0.5);
      if (faint) img.setTint(0x552222).setTintMode(Phaser.TintModes.FILL).setAlpha(0.7);
      else if (!out) img.setTint(0x8b8f8c).setTintMode(Phaser.TintModes.FILL);   // en su bola: silueta gris
      objs.push(img);
      objs.push(this.add.text(x - size / 2 + 4, y - size / 2 + 1, `${i + 1}`, { fontSize: '13px', color: sel ? '#ffd23f' : '#ffffff', fontStyle: 'bold', stroke: '#000000', strokeThickness: 3 }));
      objs.push(this.add.rectangle(x, y + size / 2 - 5, size - 8, 5, 0x000000, 0.7));
      objs.push(this.add.rectangle(x - (size - 8) / 2, y + size / 2 - 5, Math.max(0.01, (size - 8) * hpf), 3, hpf > 0.5 ? 0x4fd14f : hpf > 0.2 ? 0xffd23f : 0xe84a4a).setOrigin(0, 0.5));
      this.barLayer.add(objs);
    });
  }

  private select(d: number) {
    const n = this.team.length;
    this.selected = (this.selected + d + n) % n;
    this.refreshBar();
  }

  private say(msg: string, color = '#ffffff') {
    const t = this.add.text(480, 540, msg, { fontSize: '17px', color, stroke: '#1b2a1e', strokeThickness: 5 }).setOrigin(0.5).setScrollFactor(0).setDepth(2e6);
    this.tweens.add({ targets: t, alpha: 0, y: 520, delay: 1300, duration: 500, onComplete: () => t.destroy() });
  }

  private popMark(x: number, y: number, txt: string, color = '#c0392b') {
    const m = this.add.text(x, y, txt, { fontSize: '40px', color: '#ffffff', stroke: color, strokeThickness: 7, fontStyle: 'bold' }).setOrigin(0.5).setDepth(1e6);
    this.tweens.add({ targets: m, y: y - 14, duration: 220, yoyo: true });
    this.tweens.add({ targets: m, alpha: 0, delay: 650, duration: 250, onComplete: () => m.destroy() });
  }

  /** P: guarda al Pokémon elegido si está afuera; si está en su bola, lanza la bola hacia el cursor y lo suelta. */
  private pressP() {
    if (this.busy || this.throwing) return;
    const id = this.team[this.selected];
    if (this.isOut(id)) { this.toggleOut(id); return; }
    if (this.party[id] && this.party[id].hp <= 0) { this.say(`${this.sp(id).name} está debilitado.`, '#ff9d9d'); return; }
    this.throwBall(id);
  }

  private throwBall(id: number) {
    const [px, py] = this.playerTile();
    const ptr = this.input.activePointer;
    ptr.updateWorldPoint(this.cameras.main);
    let tx: number, ty: number;
    if (this.pointerMoved) { tx = Math.floor(ptr.worldX / TILE); ty = Math.floor(ptr.worldY / TILE); }
    else { const [dx, dy] = VEC[this.dir]; tx = px + dx * 4; ty = py + dy * 4; }   // sin cursor: unos pasos al frente
    let dx = tx - px, dy = ty - py;
    const d = Math.hypot(dx, dy) || 1;
    const k = Phaser.Math.Clamp(d, 2, THROW_RANGE) / d;
    tx = Math.round(px + dx * k); ty = Math.round(py + dy * k);
    // la casilla libre más cercana al punto de caída
    let land: [number, number] | null = null;
    for (let r = 0; r <= 3 && !land; r++) for (let ox = -r; ox <= r && !land; ox++) for (let oy = -r; oy <= r && !land; oy++) {
      if (Math.max(Math.abs(ox), Math.abs(oy)) !== r) continue;
      if (this.walkable(tx + ox, ty + oy) && !this.occupied(tx + ox, ty + oy)) land = [tx + ox, ty + oy];
    }
    if (!land) { this.say('No hay dónde soltarlo ahí.', '#ff9d9d'); return; }
    this.throwing = true;
    const [lx, ly] = land;
    const sx = this.player.x, sy = this.player.y - 70, ex = (lx + 0.5) * TILE, ey = (ly + 0.8) * TILE;
    dx = ex - sx; dy = ey - sy;
    const ball = this.add.image(sx, sy, 'ball').setScale(0.9).setDepth(1e6);
    sfx.rustle();
    this.tweens.addCounter({
      from: 0, to: 1, duration: 320 + Math.hypot(dx, dy) * 0.75,
      onUpdate: (t) => {
        const q = t.getValue()!;
        ball.setPosition(sx + dx * q, sy + dy * q - Math.sin(Math.PI * q) * 110).setAngle(q * 720);
      },
      onComplete: () => {
        ball.destroy();
        this.cameras.main.flash(90, 255, 255, 255);
        this.outIds.push(id);
        this.spawnFollower(id, true, land!);
        const f = this.followers.find((q) => q.id === id);
        if (f) f.hold = ORDER_HOLD_MS;
        this.throwing = false;
        this.refreshBar();
        // si cae cerca de un Pokémon salvaje, empieza la batalla (huya o no)
        const near = this.wilds.filter((w) => w.state !== 'gone' && Math.max(Math.abs(w.tx - lx), Math.abs(w.ty - ly)) <= BALL_NEAR)
          .sort((a, b) => Math.hypot(a.tx - lx, a.ty - ly) - Math.hypot(b.tx - lx, b.ty - ly))[0];
        if (near) this.time.delayedCall(450, () => this.engage(near, id));
      },
    });
  }

  /** Orden con el mouse: el Pokémon elegido (si está afuera) camina hasta ese punto, o va a atacar al salvaje señalado. */
  private onPointer(ptr: Phaser.Input.Pointer) {
    if (this.menuOpen || this.busy || !ptr.leftButtonDown()) return;
    const id = this.team[this.selected], f = this.followers.find((q) => q.id === id);
    if (!f) { this.say(`${this.sp(id).name} está en su bola: ¡suéltalo con P!`, '#ffe066'); return; }
    const tx = Math.floor(ptr.worldX / TILE), ty = Math.floor(ptr.worldY / TILE);
    const target = this.wilds.find((w) => w.state !== 'gone' && (Math.hypot(w.img.x - ptr.worldX, w.img.y - 30 - ptr.worldY) < 48 || (w.tx === tx && w.ty === ty)));
    f.goal = null; f.returning = false; f.hold = ORDER_HOLD_MS;
    if (target) { f.order = { kind: 'attack', target }; return; }
    if (!this.walkable(tx, ty)) return;
    f.order = { kind: 'move', goal: [tx, ty] };
  }

  /** Un paso de la orden que lleva el Pokémon (ir a un punto o atacar a un salvaje). */
  private followerOrder(f: Follower) {
    const o = f.order!;
    if (o.kind === 'move') {
      const [gx, gy] = o.goal;
      if (f.tx === gx && f.ty === gy) { f.order = null; f.hold = ORDER_HOLD_MS; f.wait = 700; return; }
      const path = this.findPath([f.tx, f.ty], [gx, gy]);
      if (path && path.length && !this.occupied(path[0][0], path[0][1], f)) { f.stuckAt = 0; this.followerStep(f, path[0][0], path[0][1]); }
      else if (!path) { f.order = null; f.hold = ORDER_HOLD_MS; }                          // no se puede llegar
      else if (!f.stuckAt) f.stuckAt = this.now;                                         // algo le tapa el paso: espera un poco
      else if (this.now - f.stuckAt > 1500) { f.order = null; f.hold = ORDER_HOLD_MS; f.stuckAt = 0; }
      return;
    }
    const w = o.target;
    if (w.state === 'gone' || !this.wilds.includes(w)) { f.order = null; f.hold = ORDER_HOLD_MS; return; }   // se escapó
    if (Math.abs(f.tx - w.tx) + Math.abs(f.ty - w.ty) <= 1) { this.engage(w, f.id); return; }
    const path = this.findPath([f.tx, f.ty], [w.tx, w.ty]);
    if (path && path.length && !this.occupied(path[0][0], path[0][1], f)) this.followerStep(f, path[0][0], path[0][1]);
  }

  // ---------- Pokémon salvajes visibles ----------

  private leadLevel() { return this.party[this.team[0]]?.level ?? START_LEVEL; }

  /** Temperamento según el nivel del salvaje frente al tuyo y su velocidad: los más fuertes atacan, los rápidos huyen. */
  private pickTemper(sp: PokemonDef, level: number): Temper {
    const diff = level - this.leadLevel();
    const wa = Phaser.Math.Clamp(24 + 6 * diff, 4, 70);
    const ws = Phaser.Math.Clamp(30 - 3 * diff, 4, 50) + (sp.base.spe >= 95 ? 18 : 0);
    const wn = 36;
    let r = Math.random() * (wa + ws + wn);
    if ((r -= wa) < 0) return 'aggressive';
    if ((r -= ws) < 0) return 'skittish';
    return 'neutral';
  }

  private spawnWild() {
    if (!this.encounterTiles.length) return;
    const [px, py] = this.playerTile();
    for (let k = 0; k < 40; k++) {
      const [x, y] = this.encounterTiles[Math.floor(Math.random() * this.encounterTiles.length)];
      const d = Math.hypot(x - px, y - py);
      if (d < WILD_DIST[0] || d > WILD_DIST[1] || this.occupied(x, y) || !this.walkable(x, y)) continue;
      const e = pickEncounter(Math.random(), Math.random, this.route.encounters), sp = SPECIES.get(e.id);
      if (!sp) return;
      const img = this.add.image((x + 0.5) * TILE, (y + 1) * TILE, `${sp.id}-walk`, 0).setOrigin(0.5, 1).setScale(0.2).setAlpha(0.2).setDepth((y + 1) * TILE + 1);
      const full = 2 * walkScale(sp.id);
      this.tweens.add({ targets: img, scale: full, alpha: 1, duration: 320, ease: 'Back.easeOut' });
      const v = this.cameras.main.worldView;
      if (v.contains(img.x, img.y)) sfx.rustle();
      this.wilds.push({
        sp, level: e.level, img, temper: this.pickTemper(sp, e.level), tx: x, ty: y, dir: 'down', mv: null, state: 'wander', home: [x, y], calmUntil: 0,
        wait: 700 + Math.random() * 1200, goal: null, age: 0, life: Phaser.Math.Between(WILD_LIFE[0], WILD_LIFE[1]), until: 0, fleeT: 0, chaseT: 0,
      });
      return;
    }
  }

  private wildStepMs(w: Wild) { return w.state === 'flee' || w.state === 'leave' ? WILD_FLEE_STEP : w.state === 'chase' ? WILD_CHASE_STEP : w.state === 'return' ? WILD_RETURN_STEP : WILD_WANDER_STEP; }

  private wildStep(w: Wild, nx: number, ny: number) {
    const dx = nx - w.tx, dy = ny - w.ty;
    w.dir = dx > 0 ? 'right' : dx < 0 ? 'left' : dy > 0 ? 'down' : 'up';
    w.mv = { fx: w.tx, fy: w.ty, tx: nx, ty: ny, t: 0 };
  }

  /** El salvaje se va: se achica y desaparece (en la hierba suena el roce). */
  private vanishWild(w: Wild, inGrass: boolean) {
    w.state = 'gone';
    if (inGrass && this.cameras.main.worldView.contains(w.img.x, w.img.y)) sfx.rustle();
    this.tweens.add({ targets: w.img, alpha: 0, scale: 0.3, duration: 280, onComplete: () => w.img.destroy() });
  }

  /** Camino más corto a la casilla más cercana que cumpla `pred` (para volver a la hierba). */
  private pathToNearest(from: [number, number], pred: (x: number, y: number) => boolean): [number, number][] | null {
    const key = (x: number, y: number) => y * this.map.w + x;
    const prev = new Map<number, number>([[key(from[0], from[1]), -1]]);
    const queue: [number, number][] = [from];
    while (queue.length) {
      const [x, y] = queue.shift()!;
      if ((x !== from[0] || y !== from[1]) && pred(x, y)) {
        const out: [number, number][] = [];
        for (let k = key(x, y); k !== key(from[0], from[1]); k = prev.get(k)!) out.unshift([k % this.map.w, Math.floor(k / this.map.w)]);
        return out;
      }
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const nx = x + dx, ny = y + dy;
        if (!this.walkable(nx, ny) || prev.has(key(nx, ny))) continue;
        prev.set(key(nx, ny), key(x, y));
        queue.push([nx, ny]);
      }
    }
    return null;
  }

  private updateWilds(dt: number) {
    this.wildGrace = Math.max(0, this.wildGrace - dt);
    this.spawnT += dt;
    if (this.spawnT >= WILD_SPAWN_MS) {
      this.spawnT = 0;
      if (this.wilds.filter((w) => w.state !== 'gone').length < WILD_MAX && Math.random() < WILD_SPAWN_P) this.spawnWild();
    }
    for (const w of this.wilds) if (w.state !== 'gone') this.stepWild(w, dt);
    this.wilds = this.wilds.filter((w) => w.state !== 'gone');
  }

  private stepWild(w: Wild, dt: number) {
    w.age += dt;
    if (w.mv) {   // caminando hacia la siguiente casilla
      w.mv.t += dt;
      const k = Math.min(1, w.mv.t / this.wildStepMs(w));
      const x = Phaser.Math.Linear((w.mv.fx + 0.5) * TILE, (w.mv.tx + 0.5) * TILE, k), y = Phaser.Math.Linear((w.mv.fy + 1) * TILE, (w.mv.ty + 1) * TILE, k);
      w.img.setPosition(x, y).setDepth(y + 1).setFrame(ROW[w.dir] * 2 + (k < 0.5 ? 1 : 0));
      if (k >= 1) { w.tx = w.mv.tx; w.ty = w.mv.ty; w.mv = null; w.img.setFrame(ROW[w.dir] * 2); }
      return;
    }
    const [px, py] = this.playerTile();
    const dist = Math.abs(w.tx - px) + Math.abs(w.ty - py);
    const here = this.map.tiles[w.ty]?.[w.tx];
    const tryStep = (path: [number, number][] | null) => {
      if (path && path.length && !this.occupied(path[0][0], path[0][1], w) && !(path[0][0] === px && path[0][1] === py)) { this.wildStep(w, path[0][0], path[0][1]); return true; }
      return false;
    };
    if (w.state === 'alert') {
      if (this.now >= w.until) { w.state = 'chase'; w.chaseT = 0; }
      return;
    }
    if (w.age > w.life + 12000 || (w.age > w.life && w.state !== 'chase' && w.state !== 'flee')) w.state = 'leave';
    if (w.state === 'leave') {   // vuelve a esconderse en la hierba alta
      if (here !== undefined && isEncounterTile(here) && w.age > 1500) { this.vanishWild(w, true); return; }
      const path = this.pathToNearest([w.tx, w.ty], (x, y) => isEncounterTile(this.map.tiles[y][x]));
      if (!path) { this.vanishWild(w, false); return; }
      if (!tryStep(path)) w.wait = 200;
      return;
    }
    if (w.state === 'return') {   // dejó de perseguir: vuelve al lugar donde apareció y no hace caso al jugador por un rato
      if (Math.abs(w.tx - w.home[0]) + Math.abs(w.ty - w.home[1]) <= 1) { w.state = 'wander'; w.goal = null; w.wait = 1500 + Math.random() * 2500; return; }
      if (!tryStep(this.findPath([w.tx, w.ty], w.home))) { w.state = 'wander'; w.goal = null; w.wait = 800; }
      return;
    }
    if (w.temper === 'aggressive' && this.wildGrace <= 0) {
      if (w.state === 'wander' && dist <= WILD_SIGHT && this.now >= w.calmUntil) {   // los agresivos te notan y se lanzan
        w.state = 'alert'; w.until = this.now + 550;
        this.popMark(w.img.x, w.img.y - 90, '!');
        return;
      }
      if (w.state === 'chase') {
        w.chaseT += this.wildStepMs(w);
        if (dist <= 1) { this.engage(w); return; }
        // rango de acción: si se alejó demasiado de su lugar, o ya lleva mucho persiguiendo, se rinde y vuelve
        if (Math.hypot(w.tx - w.home[0], w.ty - w.home[1]) > WILD_LEASH || w.chaseT > 12000) {
          w.state = 'return';
          w.calmUntil = this.now + Phaser.Math.Between(WILD_CALM_MS[0], WILD_CALM_MS[1]);
          this.popMark(w.img.x, w.img.y - 90, '…', '#7f8c8d');
          return;
        }
        tryStep(this.findPath([w.tx, w.ty], [px, py]));
        return;
      }
    }
    if (w.temper === 'skittish') {
      if (w.state === 'wander' && dist <= WILD_FLEE_DIST) { w.state = 'flee'; w.fleeT = 0; this.popMark(w.img.x, w.img.y - 90, '?', '#3b7dc4'); }
      if (w.state === 'flee') {
        w.fleeT += this.wildStepMs(w);
        if (dist > 11) { w.state = 'wander'; w.wait = 1500; return; }
        if (w.fleeT > 7000) { w.state = 'leave'; return; }
        if (here !== undefined && isEncounterTile(here) && w.fleeT > 1800) { this.vanishWild(w, true); return; }
        // el vecino que más lo aleja del jugador (y que no sea un callejón sin salida)
        let best: [number, number] | null = null, bs = dist * 2 + 1;
        for (const [dx, dy] of Object.values(VEC)) {
          const nx = w.tx + dx, ny = w.ty + dy;
          if (!this.walkable(nx, ny) || this.occupied(nx, ny, w) || (nx === px && ny === py)) continue;
          const free = Object.values(VEC).filter(([ax, ay]) => this.walkable(nx + ax, ny + ay)).length;
          const sc = (Math.abs(nx - px) + Math.abs(ny - py)) * 2 + free * 0.5;
          if (sc > bs) { bs = sc; best = [nx, ny]; }
        }
        if (best) this.wildStep(w, best[0], best[1]);
        else if (dist <= 1) this.engage(w);   // acorralado: no le queda más que pelear
        return;
      }
    }
    // pasea por los alrededores
    if (w.goal) {
      if (w.tx === w.goal[0] && w.ty === w.goal[1]) { w.goal = null; w.wait = 1200 + Math.random() * 2800; return; }
      if (!tryStep(this.findPath([w.tx, w.ty], w.goal))) { w.goal = null; w.wait = 500; }
      return;
    }
    w.wait -= dt;
    if (w.wait > 0) return;
    for (let k = 0; k < 10; k++) {
      const x = w.tx + Phaser.Math.Between(-6, 6), y = w.ty + Phaser.Math.Between(-6, 6);
      if (!this.walkable(x, y) || this.occupied(x, y, w) || (x === w.tx && y === w.ty) || Math.hypot(x - w.home[0], y - w.home[1]) > WILD_ROAM) continue;
      if (this.findPath([w.tx, w.ty], [x, y])) { w.goal = [x, y]; return; }
    }
    w.wait = 800;
  }

  /** Empieza la batalla con un Pokémon salvaje de la ruta; `lead` es el Pokémon del equipo que sale primero. */
  private engage(w: Wild, lead?: number) {
    if (this.busy) return;
    this.busy = true;
    this.path = [];
    this.setFrame(0);
    const [px, py] = this.playerTile();
    if (Math.abs(w.tx - px) + Math.abs(w.ty - py) <= 2) this.dir = w.tx > px ? 'right' : w.tx < px ? 'left' : w.ty > py ? 'down' : 'up';
    this.setFrame(0);
    sfx.encounter();
    this.popMark(this.player.x, this.player.y - 90, '!');
    this.cameras.main.flash(160, 255, 255, 255);
    this.time.delayedCall(320, () => this.cameras.main.flash(160, 255, 255, 255));
    const team = lead !== undefined && this.team.includes(lead) ? [lead, ...this.team.filter((i) => i !== lead)] : this.team;
    this.time.delayedCall(800, () => this.scene.start('Battle', {
      team, wild: true, wildId: w.sp.id, wildLevel: w.level, party: this.party, items: this.items,
      returnTo: { team: this.team, tx: this.tx, ty: this.ty, dir: this.dir, out: this.outIds, route: this.routeId },
    }));
  }

  // ---------- entrenador rival ----------

  /** ¿El jugador está dentro de la línea de visión del rival, sin nada que la tape? */
  private rivalSees(): boolean {
    const [dx, dy] = VEC[this.rv.dir];
    for (let i = 1; i <= RIVAL.sight; i++) {
      const x = this.rv.x + dx * i, y = this.rv.y + dy * i;
      if (!this.walkable(x, y)) return false;
      if (x === this.tx && y === this.ty) return true;
    }
    return false;
  }

  private checkRival(): boolean {
    if (!this.hasRival() || rivalBeaten || this.challenged || !this.rivalSees()) return false;
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
    const [dx, dy] = VEC[this.rv.dir];
    const steps = Math.max(0, Math.abs(this.tx - this.rv.x) + Math.abs(this.ty - this.rv.y) - 1);
    this.dir = this.rv.dir === 'left' ? 'right' : this.rv.dir === 'right' ? 'left' : this.rv.dir === 'up' ? 'down' : 'up';
    this.setFrame(0);
    this.time.delayedCall(600, () => {
      if (steps === 0) return this.rivalSpeech();
      this.tweens.add({
        targets: this.rival, x: this.rival.x + dx * steps * TILE, y: this.rival.y + dy * steps * TILE,
        duration: steps * STEP_MS, onComplete: () => this.rivalSpeech(),
      });
      this.tweens.addCounter({ from: 0, to: steps * 2, duration: steps * STEP_MS, onUpdate: (t) => this.rival.setFrame(ROW[this.rv.dir] * 3 + (Math.floor(t.getValue()!) % 2 ? 1 : 2)) });
    });
    return true;
  }

  private rivalSpeech() {
    this.rival.setFrame(ROW[this.rv.dir] * 3);
    const box = this.add.rectangle(480, 560, 820, 80, 0x1b2a1e).setStrokeStyle(4, 0xffd23f).setScrollFactor(0).setDepth(2e6);
    const txt = this.add.text(480, 560, `${RIVAL.name}: ¡Eh, tú! Nadie cruza mi camino sin pelear.`, { fontSize: '22px', color: '#ffffff' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(2e6);
    this.time.delayedCall(1700, () => { box.destroy(); txt.destroy(); this.cameras.main.flash(160, 255, 255, 255); });
    this.time.delayedCall(2100, () => this.scene.start('Battle', {
      team: this.team, trainer: RIVAL.name, trainerLevel: RIVAL.level, party: this.party, items: this.items,
      returnTo: { team: this.team, tx: this.tx, ty: this.ty, dir: this.dir, out: this.outIds, route: this.routeId },
    }));
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
      const saved = this.party[i];
      const level = saved?.level ?? START_LEVEL;
      const base = this.sp(i);
      const def = withMoves(base, saved?.moves ?? defaultMoves(base.id, level));   // en la aventura, los ataques que le tocan por nivel
      const pp = saved && saved.pp.length === def.moves.length ? saved.pp : def.moves.map(maxUses);
      const c = makeCombatant(def, level);
      const exp = { cur: saved?.exp ?? expAt(level), from: expAt(level), to: expAt(level + 1) };
      return { def, level, hp: saved ? Math.min(c.maxHp, saved.hp) : c.maxHp, maxHp: c.maxHp, stats: c.stats, pp, exp, tag: [k === 0 ? 'abre las batallas' : '', this.isOut(i) ? 'fuera' : ''].filter(Boolean).join(' · ') || undefined };
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
    const rows = scr === 'actions' ? 1 : n, cm = cardMetrics(rows), listH = rows * (cm.h + cm.gap);
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
      else if (e.key === 'ArrowLeft') this.select(-1);
      else if (e.key === 'ArrowRight') this.select(1);
      else if (/^[1-6]$/.test(e.key) && Number(e.key) <= this.team.length) { this.selected = Number(e.key) - 1; this.refreshBar(); }
      else if (e.key === 'p' || e.key === 'P') this.pressP();
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
          if (!was && this.party[id] && this.party[id].hp <= 0) { this.menuMsg = `${this.sp(id).name} está debilitado.`; this.renderMenu(); return; }
          this.toggleOut(id);
          this.menuMsg = was ? `${this.sp(id).name} volvió a su bola.` : `${this.sp(id).name} salió a caminar contigo.`;
        } else this.openMenuScreen('team', this.menuSel);
      } else if (scr === 'move') {
        const from = this.menuSel, to = this.menuIdx;
        if (to !== from) [this.team[from], this.team[to]] = [this.team[to], this.team[from]];   // el que quede primero abre las batallas
        this.openMenuScreen('team', to);
        this.menuMsg = to !== from ? `${this.sp(this.team[to]).name} pasó al puesto ${to + 1}.` : '';
      }
    } else return;
    this.renderMenu();
  }
}
