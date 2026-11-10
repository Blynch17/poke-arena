import Phaser from 'phaser';
import {
  POKEMON, PokemonDef, Party, Move, Stages, Stats, Fighter, StatKey, calcDamage, TYPE_COLOR, ITEMS, ItemId, ENERGY_MAX, ENERGY_REGEN,
  STRUGGLE, newStages, stageMult, maxUses, STAT_NAME, STAGE_MAX, SPEED_STAGE_EFFECT,
  BALLS, BallId, walkScale, makeCombatant, WILD_LEVEL_MIN, WILD_LEVEL_MAX, HP_MULT, effectiveness, moveByKey, Debuff, HEAL_LOCK, DRAIN_SCALE, LEGENDARY,
} from '../data';
import { MAX_MOVES, defaultMoves, movesLearnedBetween, withMoves, evolutionsAt, Evolution } from '../moveset';
import { START_LEVEL, MAX_LEVEL, expAt, expYield } from '../exp';
import { catchX, captureChance, rollCapture, statusCatchMult } from '../capture';
import {
  StatusId, Inflict, STATUS_INFO, rollDuration, TURN_MS, FLINCH_MS, FAIL_BLOCK_MS, PARALYSIS_FAIL, CONFUSION_SELF, CONFUSION_SELF_POWER,
  BURN_FRAC, POISON_FRAC, TOXIC_STEP, TOXIC_MAX_N, BURN_ATK_MULT, STATUS_GRACE_MS, AI_STATUS_COOLDOWN_MS, AI_STATUS_COOLDOWN_HIT_MS,
} from '../status';
import { StatusFx, StatusView } from '../statusfx';
import { Fx, HEAD_TEXTURE, HIDE_HEAD, SPIN, STREAM_FX } from '../fx';
import { Area, buildArea } from '../area';
import { music } from '../music';
import { sfx } from '../sfx';
import { settings, saveSettings } from '../settings';
import { Entry, teamCards, dataPanel, cardMetrics } from '../teamui';

const A = { x: 20, y: 84, w: 920, h: 480 }; // arena
const R = 30; // radio de colisión de los Pokémon
// Teclas de ataque según el esquema de controles (ajustes).
const KEY_SETS = { keys: ['U', 'I', 'O', 'P'], mouse: ['Q', 'W', 'E', 'R'] };
const SPRITE_SCALE = 3; // los sprites de overworld miden 32x32
// Efectos nuevos que reutilizan el sonido de otro.
const SFX_ALIAS: Record<string, string> = {
  wind: 'wing', star: 'fairy', bubble: 'water', bone: 'rock', jet: 'water', hyper: 'solar', aurora: 'ice', icebeam: 'ice',
  vine: 'leaf', blade: 'leaf', razor: 'leaf', psybeam: 'psy', dragonbreath: 'dragon', darkbeam: 'shadow', flash: 'steel',
  moon: 'fairy', gleam: 'fairy', blast: 'flame', note: 'fairy', notes: 'fairy', cone: 'sludge', toxic: 'sludge',
  sludgebomb: 'sludge', tornado: 'wing', zap: 'spark', tri: 'psy', egg: 'rock', ghost: 'shadow', ancient: 'rock',
  dream: 'shadow', mind: 'psychic', buzz: 'spark',
};

// Ataques en dos tiempos (Vuelo, Bote, Excavar): ms que tarda en irse, que se ve la marca (el rival puede esquivar),
// que dura la caída, cuánto sigue al rival antes de fijar el punto y el radio del golpe.
const LEAP: Record<string, { up: number; mark: number; dive: number; track: number; r: number }> = {
  fly: { up: 450, mark: 1000, dive: 250, track: 500, r: 70 },
  bounce: { up: 300, mark: 700, dive: 200, track: 350, r: 100 },
  dig: { up: 400, mark: 1000, dive: 0, track: 500, r: 70 },
};
const LIFT_MAX = 560; // px que sube un Pokémon que vuela
const sfxKey = (fx: string) => SFX_ALIAS[fx] ?? fx;

// Hoja de caminata: 2 cuadros por fila; filas = abajo, arriba, izquierda, derecha.
function walkRow(f: Phaser.Math.Vector2): number {
  if (Math.abs(f.x) >= Math.abs(f.y)) return f.x >= 0 ? 3 : 2;
  return f.y >= 0 ? 0 : 1;
}

// Un combatiente en la batalla: la especie a un nivel, con sus stats y su vida máxima ya calculados.
interface Member {
  def: PokemonDef; level: number; stats: Stats; maxHp: number; hp: number; energy: number; stages: Stages; pp: number[];
  exp: number;                                                                     // EXP total (solo cuenta en la aventura)
  own: string[] | null;                                                            // claves de sus ataques (jugador en la aventura); null = los de la especie
  acc: number;                                                                     // etapas de precisión (baja con Ataque Arena, Pantalla de Humo...)
  status: StatusId | null; statusLeft: number; statusAge: number; tickIn: number; // estado principal (ms que le quedan, ms que lleva)
  confLeft: number;                                                                // confusión (ms que le quedan)
  graceLeft: number;                                                               // ms que resiste nuevos estados tras curarse
}

const fighter = (m: Member): Fighter => ({ types: m.def.types, stats: m.stats, level: m.level });

// Pasos de después de la batalla (aventura): aprender un ataque nuevo o evolucionar.
type PostStep = { kind: 'learn'; idx: number; key: string } | { kind: 'evolve'; idx: number };

// Pokébola lanzada contra el Pokémon salvaje.
interface Thrown { img: Phaser.GameObjects.Image; vx: number; vy: number; id: BallId; dieAt: number }

const STAT_SHORT: Record<StatKey, string> = { atk: 'Atq', def: 'Def', spa: 'AtE', spd: 'DeE', spe: 'Vel' };

interface Side {
  isPlayer: boolean;
  team: Member[];
  active: number;
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
  arrow: Phaser.GameObjects.Triangle;
  facing: Phaser.Math.Vector2;
  cd: number[];
  invuln: number;
  kb: Phaser.Math.Vector2;
  down: boolean;
  moving: boolean;
  lockUntil: number; // inmóvil hasta este instante (ataques de mejora y recuperación de golpes)
  dash: Dash | null; // embestida en curso
  auraUntil: number; // aura amarilla mientras se concentra tras una mejora
  aura: Phaser.GameObjects.Ellipse;
  glow: { fx: string; power: number; until: number; tint?: number } | null; // aura del tipo mientras dura un ataque de contacto
  charging: { mv: Move; m: Member; at: number } | null; // cargando un ataque (Rayo Solar): se puede apuntar pero no caminar
  leap: Leap | null;   // ataque en dos tiempos en curso
  lift: number;        // altura visual sobre el suelo (px)
  hidden: boolean;     // fuera de la vista y sin poder ser golpeado (Vuelo, Excavar)
  flashUntil: number;  // destello rojo al recibir un golpe
  blockUntil: number;  // no puede atacar hasta este instante (falló por parálisis o confusión)
}

interface Leap { mv: Move; att: Member; t0: number; mx: number; my: number; started: boolean; off: { x: number; y: number } }

interface Dash {
  vx: number; vy: number; until: number; move: Move; att: Member; ghostAt: number;
}

interface Shot {
  img: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  owner: Side;
  att: Member; // quien lo lanzó, para usar sus stats aunque se cambie de Pokémon
  move: Move;
  dieAt: number;
  fx: string;
  ox: number;
  oy: number;
  acc: number;
  age: number;
  stream?: { dx: number; dy: number; state: 'fly' | 'end'; endAt: number }; // chorro continuo
  flipped?: boolean; // bumerán: ya dio la vuelta
  lob?: { x0: number; y0: number; lx: number; ly: number; flight: number }; // lanzado en arco hacia un punto
}

// Ataque de área en curso (ver area.ts).
interface ActiveArea { a: Area; owner: Side; att: Member; move: Move; off?: { x: number; y: number } }

type MenuScreen = '' | 'main' | 'team' | 'teamActions' | 'data' | 'items' | 'balls' | 'settings' | 'controls';

const MAIN_LABEL: Record<string, string> = {
  resume: 'Continuar', team: 'Pokémon', items: 'Objetos', balls: 'Poké Balls', settings: 'Configuración', exit: 'Salir al menú de equipos',
};

export class BattleScene extends Phaser.Scene {
  private player!: Side;
  private enemy!: Side;
  private shots: Shot[] = [];
  private areas: ActiveArea[] = [];
  private t = 0;
  private paused = false;
  private over = false;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private inventory: Record<ItemId, number> = { potion: 3, ether: 3 };
  private wild = false; // combate contra un Pokémon salvaje: se pueden lanzar Pokébolas
  private balls: Record<BallId, number> = { poke: 10, great: 5, ultra: 3, master: 1 };
  private armed: BallId | null = null; // bola elegida en el menú, lista para lanzar con ESPACIO
  private thrown: Thrown[] = [];
  private catching = false; // secuencia de captura en curso: el combate se congela
  private teamIds: number[] = [];   // índice en POKEMON de cada Pokémon del jugador
  private trainer: string | null = null; // combate contra un entrenador: no se puede huir ni capturar
  private returnTo: Record<string, unknown> | null = null; // si viene del mundo, a dónde volver al terminar
  private adventure = false;                  // modo aventura: los Pokémon ganan EXP y suben de nivel
  private foeSeen = new Set<Member>();         // quiénes han peleado contra el rival que está en pie
  private expPool = new Map<Member, number>(); // EXP ganada en esta batalla, por Pokémon
  private expGain: { mem: Member; idx: number; gained: number; from: number; to: number; stats: string }[] = [];
  private speciesIdx: number[] = [];            // especie actual (índice en POKEMON) de cada Pokémon del jugador; cambia al evolucionar
  private queue: PostStep[] = [];               // pasos tras la batalla: aprender ataques y evolucionar
  private postObjs: Phaser.GameObjects.GameObject[] = [];
  private choice: { sel: number; title: string; sub: string; options: string[]; pick: (i: number) => void } | null = null;
  private hintText: Phaser.GameObjects.Text | null = null;
  private wildFleeAt = 0;   // un salvaje con Teletransporte huye a esta hora (this.t) después de que le pegan

  private fx!: Fx;
  private statusFx!: StatusFx;
  private pills: Phaser.GameObjects.Text[][] = [];   // etiquetas de estado junto al nombre (jugador, rival)
  private pv = { x: 0, y: 0, vx: 0, vy: 0 };           // velocidad estimada del jugador, para que la IA le apunte con adelanto
  private hud!: Phaser.GameObjects.Graphics;
  private hudTexts!: Record<string, Phaser.GameObjects.Text>;
  private moveTexts: Phaser.GameObjects.Text[][] = [];
  private noEnergyAt = -9999;
  private dest: Phaser.Math.Vector2 | null = null; // destino del clic (controles con mouse)
  private pointerSeen = false; // el cursor ya se movió sobre el juego
  private destMark!: Phaser.GameObjects.Graphics;
  private noPpAt = -9999;
  private enemySwapAt = 0;

  private menuLayer!: Phaser.GameObjects.Container;
  private menu = { screen: '' as MenuScreen, idx: 0, forced: false, msg: '', sel: 0 };

  private ai = {
    nextFire: 1500, strafe: 1, strafeUntil: 0, aimErr: 0, aimUntil: 0,
    dodgeUntil: 0, dodge: new Phaser.Math.Vector2(), ideal: 210, closeAt: 0, hist: [] as number[], waits: 0,
    checkAt: 0, lastX: 0, lastY: 0, unstickUntil: 0, lastAct: 0, lastSwitch: 0, switchCheck: 0, statusReadyAt: 0, reads: true, readUntil: 0, notice: new Map<object, { at: number; ignore: boolean }>(),
  };

  constructor() {
    super('Battle');
  }

  create(data: { team: number[]; wild?: boolean; wildId?: string; wildLevel?: number; trainer?: string; trainerLevel?: number; returnTo?: Record<string, unknown>; party?: Party; items?: { potion: number; ether: number } }) {
    this.shots = [];
    this.areas = [];
    this.moveTexts = [];
    this.t = 0;
    this.paused = false;
    this.over = false;
    this.inventory = data.items ? { ...data.items } : { potion: 3, ether: 3 };   // en la aventura los objetos gastados no vuelven
    this.teamIds = data.team;
    this.wild = !!data.wild;
    this.returnTo = data.returnTo ?? null;
    this.trainer = data.trainer ?? null;
    this.adventure = !!data.returnTo;
    this.foeSeen = new Set();
    this.expPool = new Map();
    this.expGain = [];
    this.queue = [];
    this.postObjs = [];
    this.choice = null;
    this.hintText = null;
    this.wildFleeAt = 0;
    this.balls = { poke: 10, great: 5, ultra: 3, master: 1 };
    this.armed = null;
    this.thrown = [];
    this.catching = false;
    this.enemySwapAt = 0;
    this.menu = { screen: '', idx: 0, forced: false, msg: '', sel: 0 };
    this.ai.nextFire = 1500;
    this.ai.strafeUntil = 0;   // los temporizadores de la IA usan this.t, que vuelve a 0: si no, quedan los del combate anterior
    this.ai.aimUntil = 0;
    this.ai.dodgeUntil = 0;
    this.ai.dodge.set(0, 0);
    this.ai.lastX = 0;
    this.ai.lastY = 0;
    this.ai.hist = [];
    this.ai.waits = 0;
    this.ai.checkAt = 0;
    this.ai.unstickUntil = 0;
    this.ai.lastAct = 0;
    this.ai.closeAt = 0;
    this.ai.lastSwitch = 0;
    this.ai.statusReadyAt = 0;
    this.ai.reads = true;
    this.ai.readUntil = 0;
    this.ai.switchCheck = 0;
    this.ai.notice.clear();
    this.input.keyboard!.addCapture('UP,DOWN,LEFT,RIGHT,ENTER,SPACE');

    music.play('battle');
    void sfx.preload();
    this.drawArena();
    this.fx = new Fx(this);
    this.statusFx = new StatusFx(this);

    this.speciesIdx = data.team.map((i) => data.party?.[i]?.species ?? i);   // la especie actual (puede haber evolucionado)
    const mine = this.speciesIdx.map((s) => POKEMON[s]);
    // En la aventura cada Pokémon va a su propio nivel (el de la partida, o el inicial); en la arena todos a nivel 50.
    const mineLevels = this.adventure ? data.team.map((i) => data.party?.[i]?.level ?? START_LEVEL) : [];
    const mineKeys = this.adventure ? mine.map((def, k) => data.party?.[data.team[k]]?.moves ?? defaultMoves(def.id, mineLevels[k])) : [];
    this.player = this.makeSide(true, mine, A.x + 160, A.y + A.h / 2, mineLevels, mineKeys);
    if (this.wild) {
      // Un solo Pokémon salvaje, de una especie y un nivel al azar.
      // Si viene de la ruta, ya trae la especie y el nivel; si no, se elige al azar.
      const def = POKEMON.find((p) => p.id === data.wildId) ?? (Phaser.Utils.Array.GetRandom(POKEMON) as PokemonDef);
      const level = data.wildLevel ?? Phaser.Math.Between(WILD_LEVEL_MIN, WILD_LEVEL_MAX);
      this.enemy = this.makeSide(false, [def], A.x + A.w - 160, A.y + A.h / 2, [level]);
    } else {
      const pool = data.trainerLevel ? POKEMON.filter((p) => !LEGENDARY.has(p.id)) : POKEMON;   // en la aventura, sin legendarios
      const others = Phaser.Utils.Array.Shuffle([...pool]).slice(0, Phaser.Math.Clamp(mine.length, 1, 6));   // el rival lleva tantos Pokémon como tú
      const lv = data.trainerLevel;   // los entrenadores de la aventura traen su nivel; sube 1 con cada Pokémon del equipo
      this.enemy = this.makeSide(false, others, A.x + A.w - 160, A.y + A.h / 2, lv ? others.map((_, i) => Math.min(MAX_LEVEL, lv + Math.floor(i / 2))) : []);
    }

    this.hud = this.add.graphics().setDepth(50);
    this.buildHudTexts();
    this.pv = { x: this.player.sprite.x, y: this.player.sprite.y, vx: 0, vy: 0 };
    this.refreshMoveTexts();
    // En la aventura cada Pokémon llega con los PS y PP que le quedaron; sale a pelear el primero que no esté debilitado.
    if (data.party) {
      this.player.team.forEach((mem, i) => {
        const saved = data.party![data.team[i]];
        if (!saved) return;
        mem.hp = Math.min(mem.maxHp, saved.hp);
        if (saved.exp !== undefined) mem.exp = saved.exp;
        if (saved.pp.length === mem.pp.length) mem.pp = saved.pp.map((n, k) => Math.min(n, maxUses(mem.def.moves[k])));
      });
      const first = this.player.team.findIndex((m) => m.hp > 0);
      if (first > 0) this.switchTo(this.player, first);
    }
    this.foeSeen.add(this.cur(this.player));
    this.menuLayer = this.add.container(0, 0).setDepth(100);

    this.keys = this.input.keyboard!.addKeys('W,A,S,D,Q,E,R,U,I,O,P,SPACE') as Record<string, Phaser.Input.Keyboard.Key>;
    this.dest = null;
    this.pointerSeen = false;
    this.destMark = this.add.graphics().setDepth(4);
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => this.onPointer(ptr));
    this.input.on('pointermove', (ptr: Phaser.Input.Pointer) => this.onPointer(ptr));
    this.applyControlLabels();
    const born = performance.now(); // el Enter que inició la escena no debe contar
    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => {
      if (e.timeStamp >= born) this.onKey(e);
    });

    const foe = this.cur(this.enemy);
    this.toast(this.wild ? `¡Apareció un ${foe.def.name} salvaje de nivel ${foe.level}!` : this.trainer ? `¡${this.trainer} te desafía!` : '¡Comienza el combate!');
  }

  // ---------- construcción ----------

  private drawArena() {
    const g = this.add.graphics().setDepth(0);
    g.fillStyle(0x2f4a35).fillRect(0, 0, 960, 640);
    g.fillStyle(0x3b6044).fillRect(A.x, A.y, A.w, A.h);
    g.lineStyle(1, 0x45704f, 1);
    for (let x = A.x; x <= A.x + A.w; x += 40) g.lineBetween(x, A.y, x, A.y + A.h);
    for (let y = A.y; y <= A.y + A.h; y += 40) g.lineBetween(A.x, y, A.x + A.w, y);
    g.lineStyle(3, 0x6f9c78, 0.8).lineBetween(A.x + A.w / 2, A.y, A.x + A.w / 2, A.y + A.h);
    g.strokeCircle(A.x + A.w / 2, A.y + A.h / 2, 70);
    g.lineStyle(6, 0xe8f2e8, 1).strokeRect(A.x, A.y, A.w, A.h);
  }

  private makeSide(isPlayer: boolean, defs: PokemonDef[], x: number, y: number, levels: number[] = [], keys: string[][] = []): Side {
    const team: Member[] = defs.map((rawDef, i) => {
      const c = makeCombatant(rawDef, levels[i] ?? rawDef.level);
      // En la aventura los ataques salen de la lista de aprendizaje por nivel (los de la especie en la arena).
      const own = this.adventure ? (keys[i] ?? defaultMoves(rawDef.id, c.level)) : null;
      const def = own ? withMoves(rawDef, own) : rawDef;
      return { def, own: isPlayer ? own : null, acc: 0, ...c, hp: c.maxHp, exp: expAt(c.level), energy: ENERGY_MAX, stages: newStages(), pp: def.moves.map(maxUses), status: null, statusLeft: 0, statusAge: 0, tickIn: 1000, confLeft: 0, graceLeft: 0 };
    });
    const facing = new Phaser.Math.Vector2(isPlayer ? 1 : -1, 0);
    const sprite = this.add.image(x, y, `${defs[0].id}-walk`, 0).setScale(SPRITE_SCALE * walkScale(defs[0].id)).setDepth(10);
    const shadow = this.add.ellipse(x, y + 36, 60, 18, 0x000000, 0.3).setDepth(5);
    const arrow = this.add.triangle(0, 0, 0, -9, 18, 0, 0, 9, 0xffffff, 0.85).setDepth(6);
    const aura = this.add.ellipse(x, y, 96, 104, 0xffe066, 0.3).setStrokeStyle(3, 0xffe066).setDepth(4).setVisible(false);
    return {
      isPlayer, team, active: 0, sprite, shadow, arrow, facing,
      cd: [0, 0, 0, 0], invuln: 0, kb: new Phaser.Math.Vector2(), down: false, moving: false,
      lockUntil: 0, dash: null, auraUntil: 0, aura, glow: null, charging: null, leap: null, lift: 0, hidden: false, flashUntil: 0, blockUntil: 0,
    };
  }

  private cur(s: Side): Member { return s.team[s.active]; }

  /** Escala del sprite del Pokémon en combate (los de cuadros de 64×64 se dibujan 1,4 veces más grandes que los de 32×32). */
  private ss(s: Side): number { return SPRITE_SCALE * walkScale(this.cur(s).def.id); }

  // ¿Puede recibir un golpe ahora? (no si está debilitado, escondido en pleno Vuelo/Excavar o recién llegado)
  private canHit(s: Side): boolean { return !s.down && !s.hidden && this.t >= s.invuln; }

  // Velocidad de movimiento (px/s). Las etapas de Velocidad se notan solo en parte (SPEED_STAGE_EFFECT):
  // en los juegos deciden quién ataca primero; aquí un multiplicador completo se sentía demasiado rápido.
  private speedOf(s: Side): number {
    const m = this.cur(s);
    const base = 100 + m.stats.spe * 1.1;
    return Math.round(base * (1 + (stageMult(m.stages.spe) - 1) * SPEED_STAGE_EFFECT));
  }

  // ---------- bucle principal ----------

  update(_time: number, delta: number) {
    const dt = Math.min(delta, 50);
    if (this.catching) {
      this.fx.beginFrame(); // durante la captura solo se animan los efectos
      this.fx.update(dt);
    } else if (!this.paused && !this.over) {
      this.t += dt;
      const s = dt / 1000;
      this.fx.beginFrame();
      this.trackPlayer(dt);
      this.playerInput(s);
      this.aiUpdate(s);
      this.updateDashes();
      this.separate();
      this.updateShots(s);
      this.updateAreas(dt);
      this.updateGlows(dt);
      this.updateCharging(dt);
      this.updateLeaps(dt);
      this.updateBalls(s);
      this.updateStatus(dt);
      this.regen(this.player, s);
      this.regen(this.enemy, s);
      if (this.enemy.down && this.enemySwapAt && this.t >= this.enemySwapAt) this.sendNextEnemy();
      if (this.wildFleeAt && this.t >= this.wildFleeAt && !this.catching && !this.enemy.down) { this.wildFleeAt = 0; this.escapeBattle(this.enemy, this.cur(this.enemy)); }
      this.fx.update(dt);
    }
    this.updateVisuals();
    this.statusFx.update(!this.paused && !this.over && !this.catching ? dt : 0, this.statusViews());
    this.drawHud();
  }

  private move(side: Side, vx: number, vy: number, s: number) {
    if (side.dash) { vx = side.dash.vx; vy = side.dash.vy; } // la embestida manda sobre el control
    if (this.immobile(side)) { vx = 0; vy = 0; side.dash = null; }   // dormido, congelado o paralizado: no se mueve
    side.kb.scale(Math.pow(0.04, s)); // el empujón se amortigua rápido
    side.moving = vx !== 0 || vy !== 0;
    side.sprite.x = Phaser.Math.Clamp(side.sprite.x + (vx + side.kb.x) * s, A.x + R, A.x + A.w - R);
    side.sprite.y = Phaser.Math.Clamp(side.sprite.y + (vy + side.kb.y) * s, A.y + R, A.y + A.h - R);
  }

  private regen(side: Side, s: number) {
    if (side.down) return;
    const m = this.cur(side);
    m.energy = Math.min(ENERGY_MAX, m.energy + ENERGY_REGEN * s);
  }

  private separate() {
    const a = this.player.sprite, b = this.enemy.sprite;
    if (this.player.down || this.enemy.down || this.player.hidden || this.enemy.hidden) return;
    const dx = b.x - a.x, dy = b.y - a.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < R * 2) {
      const push = (R * 2 - d) / 2;
      a.x -= (dx / d) * push; a.y -= (dy / d) * push;
      b.x += (dx / d) * push; b.y += (dy / d) * push;
    }
  }

  // ---------- jugador ----------

  private playerInput(s: number) {
    const p = this.player;
    if (p.down) return;
    const k = this.keys;
    let vx = 0, vy = 0;
    const unlocked = this.t >= p.lockUntil;
    const free = unlocked && !this.immobile(p);                          // paralizado, dormido o congelado: no camina
    const canAim = !this.incapable(p) && (unlocked || !!p.charging);   // cargando un ataque se puede apuntar, pero no caminar
    if (settings.controls === 'keys') {
      // WASD: se camina y se apunta hacia donde se camina.
      const dir = new Phaser.Math.Vector2(
        (k.D.isDown ? 1 : 0) - (k.A.isDown ? 1 : 0),
        (k.S.isDown ? 1 : 0) - (k.W.isDown ? 1 : 0),
      );
      if (dir.lengthSq() > 0 && canAim) {
        dir.normalize();
        p.facing.copy(dir);
        if (free) {
          const sp = this.speedOf(p);
          vx = dir.x * sp; vy = dir.y * sp;
        }
      }
    } else {
      // Mouse: se camina hasta el punto del clic y se apunta siempre hacia el cursor.
      const ptr = this.input.activePointer;
      if (this.pointerSeen && canAim && !p.dash) {
        const ax = ptr.worldX - p.sprite.x, ay = ptr.worldY - p.sprite.y;
        if (Math.hypot(ax, ay) > 4) p.facing.set(ax, ay).normalize();
      }
      if (this.dest && free) {
        const dx = this.dest.x - p.sprite.x, dy = this.dest.y - p.sprite.y, d = Math.hypot(dx, dy);
        if (d < 5) this.dest = null;
        else {
          const sp = Math.min(this.speedOf(p), d / s); // no pasarse del punto
          vx = (dx / d) * sp; vy = (dy / d) * sp;
        }
      }
    }
    this.move(p, vx, vy, s);
    KEY_SETS[settings.controls].forEach((key, i) => {
      if (k[key].isDown) this.tryFire(p, i);
    });
    if (this.armed && unlocked && !p.dash && Phaser.Input.Keyboard.JustDown(k.SPACE)) this.throwBall();
  }

  // ---------- captura ----------

  private wait(ms: number) {
    return new Promise<void>((resolve) => this.time.delayedCall(ms, resolve));
  }

  // Lanza la bola elegida en el menú hacia donde se mira.
  private throwBall() {
    const id = this.armed!;
    const p = this.player, f = p.facing;
    this.armed = null;
    this.balls[id]--;
    const img = this.add.image(p.sprite.x + f.x * 40, p.sprite.y + f.y * 40, 'ball').setScale(1.1).setDepth(12);
    this.thrown.push({ img, vx: f.x * 620, vy: f.y * 620, id, dieAt: this.t + 800 });
    sfx.throwBall(p.sprite.x);
  }

  private updateBalls(s: number) {
    const target = this.enemy;
    for (let n = this.thrown.length - 1; n >= 0; n--) {
      const b = this.thrown[n];
      b.img.x += b.vx * s;
      b.img.y += b.vy * s;
      b.img.rotation += 14 * s;
      const out = b.img.x < A.x || b.img.x > A.x + A.w || b.img.y < A.y || b.img.y > A.y + A.h;
      if (!target.down && this.t >= target.invuln && Math.hypot(target.sprite.x - b.img.x, target.sprite.y - b.img.y) < R + 12) {
        this.thrown.splice(n, 1);
        void this.captureSequence(b);
        return;
      }
      if (out || this.t > b.dieAt) {
        this.floatText(Phaser.Math.Clamp(b.img.x, A.x + 40, A.x + A.w - 40), Phaser.Math.Clamp(b.img.y, A.y + 30, A.y + A.h - 30), 'Fallaste...', '#cccccc');
        b.img.destroy();
        this.thrown.splice(n, 1);
      }
    }
  }

  // La bola golpea al Pokémon salvaje: la fórmula decide el resultado y se anima la secuencia completa.
  private async captureSequence(b: Thrown) {
    const e = this.enemy, mem = this.cur(e);
    const x = catchX(mem.maxHp, mem.hp, mem.def.catchRate, b.id, mem.level, statusCatchMult(mem.status));
    const roll = rollCapture(x, b.id);
    this.catching = true;
    const ex = e.sprite.x, ey = e.sprite.y;
    // 1) el Pokémon se vuelve luz y entra en la bola
    sfx.absorb(ex);
    e.sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL); // silueta blanca
    e.shadow.setVisible(false);
    e.arrow.setVisible(false);
    e.aura.setVisible(false);
    this.fx.ring(ex, ey, 0xffffff, 8, 56, 380);
    this.tweens.add({ targets: e.sprite, scale: 0, duration: 380 });
    b.img.setPosition(ex, ey - 6).setRotation(0);
    await this.wait(480);
    // 2) la bola cae al suelo y se sacude: una vez por cada comprobación que el Pokémon resiste (máx. 3 a la vista)
    this.tweens.add({ targets: b.img, y: ey + 24, duration: 320, ease: 'Bounce.easeOut' });
    await this.wait(620);
    const wobbles = roll.success ? 3 : Math.min(roll.shakes, 3);
    for (let i = 0; i < wobbles; i++) {
      sfx.ballShake(ex);
      this.tweens.add({ targets: b.img, rotation: { from: -0.35, to: 0.35 }, duration: 150, yoyo: true, onComplete: () => b.img.setRotation(0) });
      await this.wait(800);
    }
    if (roll.success) {
      sfx.captured(ex);
      this.fx.impact('fairy', ex, ey + 20, 0);
      this.toast(`¡Atrapaste a ${mem.def.name}!`);
      await this.wait(900);
      b.img.destroy();
      this.finishCaptured(mem);
      return;
    }
    // la bola se abre y el Pokémon vuelve a la arena
    sfx.escaped(ex);
    this.fx.impact('slam', ex, ey + 20, 0);
    b.img.destroy();
    e.sprite.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
    e.shadow.setVisible(true);
    e.arrow.setVisible(true);
    this.tweens.add({ targets: e.sprite, scale: this.ss(e), duration: 220 });
    const msgs = ['¡Se escapó al instante!', '¡Parecía que lo atrapabas!', '¡Casi lo atrapas!', '¡Por muy poco!'];
    this.toast(msgs[Math.min(roll.shakes, 3)]);
    await this.wait(300);
    e.invuln = this.t + 800;
    this.catching = false;
  }

  // Gancho para el futuro: cuando el juego tenga historia, aquí el Pokémon capturado se sumará al equipo.
  // De momento no se guarda nada: solo termina la batalla.
  private onCaptured(_mem: Member) { /* pendiente: agregar al equipo */ }

  private finishCaptured(mem: Member) {
    if (this.over) return;
    this.over = true;
    this.catching = false;
    this.onCaptured(mem);
    music.play('victory');
    this.awardExp(mem);   // capturar también da EXP
    this.applyExp();
    const lines = this.expLines();
    this.buildQueue();
    const bg = this.add.rectangle(480, 320, 960, 640, 0x000000, 0.6).setDepth(90);
    const t1 = this.add.text(480, lines.length ? 120 : 250, '¡CAPTURADO!', { fontSize: '68px', color: '#7fc4ff', fontStyle: 'bold' }).setOrigin(0.5).setDepth(91);
    const t2 = this.add.text(480, lines.length ? 185 : 320, `${mem.def.name}  Nv. ${mem.level}`, { fontSize: '30px', color: '#ffffff' }).setOrigin(0.5).setDepth(91);
    const t3 = this.add.text(480, lines.length ? 580 : 380, this.hintLabel(), { fontSize: '22px', color: '#cfe8cf' }).setOrigin(0.5).setDepth(91);
    this.hintText = t3;
    this.menuLayer.add([bg, t1, t2, t3, ...this.expTexts(lines, 240)]);
  }

  // Clic izquierdo (o arrastrar con el botón apretado): fija el destino en la arena.
  private onPointer(ptr: Phaser.Input.Pointer) {
    this.pointerSeen = true;
    if (settings.controls !== 'mouse' || this.paused || this.over || this.catching || this.player.down) return;
    if (!ptr.leftButtonDown()) return;
    if (ptr.worldX < A.x || ptr.worldX > A.x + A.w || ptr.worldY < A.y || ptr.worldY > A.y + A.h) return;
    this.dest = new Phaser.Math.Vector2(
      Phaser.Math.Clamp(ptr.worldX, A.x + R, A.x + A.w - R),
      Phaser.Math.Clamp(ptr.worldY, A.y + R, A.y + A.h - R),
    );
  }

  // Letras de los ataques y texto de ayuda según el esquema de controles.
  private applyControlLabels() {
    KEY_SETS[settings.controls].forEach((key, i) => this.moveTexts[i][0].setText(key));
    this.hudTexts.help.setText(
      settings.controls === 'keys'
        ? 'WASD mover · UIOP atacar · ENTER menú'
        : 'Clic mover · QWER atacar · ENTER menú',
    );
  }

  // ---------- ataques ----------

  /**
   * Precisión del ataque (campo `accuracy`, en %): 0 = sale justo donde se apuntó, 1 = desvío leve, 2 = desvío grande.
   * Con probabilidad (1 - precisión) se desvía; de esas veces el 60 % es leve y el 40 % grande. Con 100 % nunca se desvía.
   */
  private aimRoll(mv: Move, side?: Side): 0 | 1 | 2 {
    // Las etapas de precisión del atacante (Ataque Arena...) escalan la precisión: -1 = x3/4, -2 = x3/5, ... como en los juegos.
    const stage = side ? this.cur(side).acc : 0;
    const acc = (mv.accuracy ?? 100) * (stage >= 0 ? (3 + stage) / 3 : 3 / (3 - stage));
    if (acc >= 100) return 0;
    const miss = 1 - acc / 100, r = Math.random();
    return r < miss * 0.4 ? 2 : r < miss ? 1 : 0;
  }

  /** Ángulo de desvío (rad) de un ataque apuntado: se mide en píxeles a lo ancho a la distancia del rival (leve 25-90 px, que
   *  a veces aún pega; grande 130-250 px, que casi siempre falla), así que la precisión pesa igual de cerca que de lejos. */
  private aimAngle(kind: 0 | 1 | 2, side: Side): number {
    if (!kind) return 0;
    const foe = side === this.player ? this.enemy : this.player;
    const d = Math.max(150, Math.hypot(foe.sprite.x - side.sprite.x, foe.sprite.y - side.sprite.y));
    const lateral = kind === 1 ? 25 + Math.random() * 65 : 130 + Math.random() * 120;
    return (Math.random() < 0.5 ? -1 : 1) * Math.atan2(lateral, d);
  }

  private aimDeviation(mv: Move, side: Side): number { return this.aimAngle(this.aimRoll(mv, side), side); }

  /** Para los ataques que caen en un punto (rayo, Vuelo): cuánto se corre el punto cuando falla (leve ~70-120 px, grande ~170-270 px). */
  private missOffset(kind: 0 | 1 | 2): { x: number; y: number } {
    if (!kind) return { x: 0, y: 0 };
    const a = Math.random() * Math.PI * 2, d = kind === 1 ? 70 + Math.random() * 50 : 170 + Math.random() * 100;
    return { x: Math.cos(a) * d, y: Math.sin(a) * d };
  }

  private rotate(v: Phaser.Math.Vector2, ang: number): Phaser.Math.Vector2 {
    return ang ? v.clone().rotate(ang) : v;
  }

  private tryFire(side: Side, i: number): boolean {
    if (side.down || this.t < side.lockUntil || this.t < side.blockUntil) return false;
    const m = this.cur(side);
    if (this.incapable(side)) return false;   // dormido o congelado: no ataca
    const struggle = m.pp.every((n) => n <= 0); // sin PP en ningún ataque: Forcejeo
    const ci = struggle ? 0 : i; // Forcejeo comparte una sola recarga
    if (this.t < side.cd[ci]) return false;
    const mv = struggle ? STRUGGLE : m.def.moves[i];
    if (!mv) return false; // esa tecla no tiene ataque (Magikarp y Ditto tienen uno solo)
    if (!struggle && m.pp[i] <= 0) {
      if (side.isPlayer && this.t - this.noPpAt > 700) {
        this.noPpAt = this.t;
        this.floatText(side.sprite.x, side.sprite.y - 60, '¡Sin PP!', '#ff8888');
      }
      return false;
    }
    if (mv.heal && m.hp >= m.maxHp && !(mv.rest && m.status)) {   // curarse con la vida llena no sirve de nada: no gasta nada
      if (side.isPlayer && this.t - this.noPpAt > 700) { this.noPpAt = this.t; this.floatText(side.sprite.x, side.sprite.y - 60, '¡Los PS ya están al máximo!', '#9fe0a8'); }
      return false;
    }
    if (mv.teleport && !this.canTeleport(side)) {
      if (side.isPlayer && this.t - this.noPpAt > 700) { this.noPpAt = this.t; this.floatText(side.sprite.x, side.sprite.y - 60, '¡Pero falló! No queda a quién cambiar', '#cccccc'); }
      return false;
    }
    if (m.energy < mv.cost) {
      if (side.isPlayer) this.noEnergyAt = this.t;
      return false;
    }
    // Parálisis y confusión: a veces el intento falla y se pierde un rato (en los juegos, el turno). No gasta PP ni energía.
    if (m.status === 'paralysis' && Math.random() < PARALYSIS_FAIL) {
      side.blockUntil = this.t + FAIL_BLOCK_MS;
      this.floatText(side.sprite.x, side.sprite.y - 76, '¡Está paralizado! ¡No se puede mover!', '#ffe066');
      sfx.status('paralysis', side.sprite.x);
      return false;
    }
    if (m.confLeft > 0 && Math.random() < CONFUSION_SELF) {
      side.blockUntil = this.t + FAIL_BLOCK_MS;
      this.confusedHit(side);
      return false;
    }
    m.energy -= mv.cost;
    if (side === this.enemy) this.ai.lastAct = this.t;
    if (!struggle) m.pp[i]--;
    side.cd[ci] = this.t + mv.cooldown;
    if (struggle && side.isPlayer) this.floatText(side.sprite.x, side.sprite.y - 60, '¡Forcejeo!', '#ffb86b');
    if (mv.category === 'status' && (mv.inflict || mv.debuff)) {   // ataque de estado: un proyectil que causa el estado o baja stats si conecta
      sfx.cast(sfxKey(mv.fx ?? 'zap'), side.sprite.x);
      this.fireShots(side, m, mv);
      return true;
    }
    if (mv.category === 'status') {
      sfx.boost(side.sprite.x);
      if (mv.heal) this.applyHeal(side, m, mv);
      else if (mv.teleport) this.teleport(side, m);
      else if (mv.transform) this.transform(side, m);
      else if (Object.keys(mv.boost ?? {}).length === 0) this.splash(side);
      else this.applyBoost(side, m, mv);
      return true;
    }
    sfx.cast(sfxKey(mv.fx ?? 'slam'), side.sprite.x);
    if (mv.style === 'dash') { this.startDash(side, m, mv); return true; }
    if (mv.style === 'reach') { this.reachAttack(side, m, mv); return true; }
    if (mv.style === 'leap') { this.startLeap(side, m, mv); return true; }
    if (mv.style === 'ground' || mv.style === 'spikes' || mv.style === 'rain' || mv.style === 'nova' || mv.style === 'strike' || mv.style === 'wave' || mv.style === 'storm') {
      this.castArea(side, m, mv);
      return true;
    }
    if (mv.charge) { side.charging = { mv, m, at: this.t + mv.charge }; side.lockUntil = this.t + mv.charge; return true; }
    this.fireShots(side, m, mv);
    return true;
  }

  // Lanza el proyectil (o chorro) de un ataque.
  private fireShots(side: Side, m: Member, mv: Move) {
    const f = side.facing;
    const fx = mv.fx ?? 'ember';
    const isStream = STREAM_FX.has(fx);
    this.fx.muzzle(fx, side.sprite.x + f.x * 40, side.sprite.y + f.y * 40, f.x, f.y, Math.max(30, mv.power));
    if (mv.lob) { this.lobShot(side, m, mv, fx); return; }
    // Abanico: varios proyectiles que se reparten el daño del ataque (con uno solo al blanco, pega menos que el ataque entero).
    const n = mv.multi ?? 1, base = Math.atan2(f.y, f.x) + this.aimDeviation(mv, side);   // todo el abanico se desvía junto
    const shotMove = n > 1 ? { ...mv, power: Math.max(1, Math.round(mv.power * Math.min(0.8, 2.4 / n))) } : mv;
    for (let k = 0; k < n; k++) {
      const ang = base + (k - (n - 1) / 2) * (mv.spread ?? 0), dx = Math.cos(ang), dy = Math.sin(ang);
      const ox = side.sprite.x + dx * 44, oy = side.sprite.y + dy * 44;
      const img = this.add.image(ox, oy, HEAD_TEXTURE[fx] ?? 'orb').setScale(mv.size).setDepth(8).setVisible(!isStream && !HIDE_HEAD.has(fx));
      if (fx === 'wind' || fx === 'cone') img.setRotation(ang);
      this.shots.push({
        img, vx: dx * mv.speed, vy: dy * mv.speed, owner: side, att: m, move: shotMove, dieAt: this.t + mv.life,
        fx, ox, oy, acc: 0, age: 0,
        stream: isStream ? { dx, dy, state: 'fly', endAt: 0 } : undefined,
      });
    }
  }


  // Bomba Huevo: se lanza en arco hacia el punto donde está el rival y explota al caer, dañando en un área.
  private lobShot(side: Side, m: Member, mv: Move, fx: string) {
    const f = this.rotate(side.facing, this.aimDeviation(mv, side)), target = side === this.player ? this.enemy : this.player;
    const dist = Phaser.Math.Clamp(Math.hypot(target.sprite.x - side.sprite.x, target.sprite.y - side.sprite.y), 160, 520);
    const flight = 750, x0 = side.sprite.x + f.x * 40, y0 = side.sprite.y + f.y * 40;
    const lx = Phaser.Math.Clamp(side.sprite.x + f.x * dist, A.x + 20, A.x + A.w - 20), ly = Phaser.Math.Clamp(side.sprite.y + f.y * dist, A.y + 20, A.y + A.h - 20);
    const img = this.add.image(x0, y0, HEAD_TEXTURE[fx] ?? 'orb').setScale(mv.size * 1.6).setDepth(11);
    this.shots.push({
      img, vx: (lx - x0) / (flight / 1000), vy: (ly - y0) / (flight / 1000), owner: side, att: m, move: mv, dieAt: this.t + flight,
      fx, ox: x0, oy: y0, acc: 0, age: 0, lob: { x0, y0, lx, ly, flight },
    });
  }

  private explodeLob(sh: Shot) {
    const lob = sh.lob!, mv = sh.move, owner = sh.owner, target = owner === this.player ? this.enemy : this.player;
    this.fx.explosion(lob.lx, lob.ly, mv.lob!, 'fairy');
    this.cameras.main.shake(130, 0.0035);
    sfx.hit('rock', 1, false, true, lob.lx);
    if (this.canHit(target) && Math.hypot(target.sprite.x - lob.lx, target.sprite.y - lob.ly) < mv.lob! + R * 0.6) {
      const len = Math.hypot(target.sprite.x - lob.lx, target.sprite.y - lob.ly) || 1;
      this.applyHit(owner, sh.att, mv, target, target.sprite.x, target.sprite.y, (target.sprite.x - lob.lx) / len, (target.sprite.y - lob.ly) / len, 1);
    }
  }

  // Carga de un ataque (Rayo Solar): luz que se junta en la boca; al terminar se lanza hacia donde se apunta.
  private updateCharging(dt: number) {
    for (const side of [this.player, this.enemy]) {
      const c = side.charging;
      if (!c) continue;
      if (side.down || this.cur(side) !== c.m) { side.charging = null; continue; }
      const k = Phaser.Math.Clamp(1 - (c.at - this.t) / (c.mv.charge ?? 1), 0, 1);
      this.fx.charge(side.sprite.x, side.sprite.y, side.facing.x, side.facing.y, k, dt);
      if (this.t >= c.at) {
        side.charging = null;
        side.lockUntil = this.t + 120;
        this.fireShots(side, c.m, c.mv);
      }
    }
  }

  // ---------- ataques en dos tiempos (Vuelo, Bote, Excavar) ----------

  private startLeap(side: Side, m: Member, mv: Move) {
    const cfg = LEAP[mv.leap ?? 'fly'];
    side.leap = { mv, att: m, t0: this.t, mx: side.sprite.x, my: side.sprite.y, started: false, off: this.missOffset(this.aimRoll(mv, side)) };
    side.lockUntil = this.t + cfg.up + cfg.mark + cfg.dive + 300;
  }

  private endLeap(side: Side) {
    side.leap = null;
    side.hidden = false;
    side.lift = 0;
    side.sprite.setScale(this.ss(side));
  }

  private updateLeaps(dt: number) {
    for (const side of [this.player, this.enemy]) {
      const L = side.leap;
      if (!L) continue;
      if (side.down || this.cur(side) !== L.att) { this.endLeap(side); continue; }
      const kind = L.mv.leap ?? 'fly', cfg = LEAP[kind], t = this.t - L.t0, target = side === this.player ? this.enemy : this.player;
      const markEnd = cfg.up + cfg.mark, total = markEnd + cfg.dive;
      const sx = side.sprite.x, sy = side.sprite.y;
      if (t < cfg.up) {   // se va: sube hasta perderse de vista o se hunde bajo tierra
        const k = t / cfg.up;
        if (!L.started) { L.started = true; this.fx.ring(sx, sy + 20, kind === 'dig' ? 0xc09a5a : 0xffffff, 10, 70, 350, 4); }
        if (kind === 'dig') {
          side.sprite.setScale(this.ss(side) * (1 - 0.85 * k));
          for (let i = 0; i < 2; i++) this.fx.spawn(sx + (Math.random() - 0.5) * 50, sy + 24, { vx: (Math.random() - 0.5) * 140, vy: -100 - Math.random() * 100, g: 800, life: 460, s0: 10, s1: 3, colors: [0xe0c68a, 0xc09a5a, 0xa07840] });
        } else {
          side.lift = LIFT_MAX * k * k;
          this.fx.spawn(sx + (Math.random() - 0.5) * 30, sy + 10, { vx: (Math.random() - 0.5) * 60, vy: 120, life: 260, s0: 3, len: 30, rot: Math.PI / 2, colors: [0xffffff, 0xd8f6ff], a0: 0.8 });
        }
      } else if (t < markEnd) {   // escondido: se ve dónde va a caer
        if (!side.hidden) { side.hidden = true; L.mx = Phaser.Math.Clamp(target.sprite.x + L.off.x, A.x + R, A.x + A.w - R); L.my = Phaser.Math.Clamp(target.sprite.y + L.off.y, A.y + R, A.y + A.h - R); }
        const since = t - cfg.up;
        if (since < cfg.track && !target.down) { L.mx = Phaser.Math.Clamp(target.sprite.x + L.off.x, A.x + R, A.x + A.w - R); L.my = Phaser.Math.Clamp(target.sprite.y + L.off.y, A.y + R, A.y + A.h - R); }
        this.fx.leapMark(kind, L.mx, L.my, since / cfg.mark, since >= cfg.track);
      } else if (t < total) {      // cae en picada
        const kd = (t - markEnd) / cfg.dive;
        side.sprite.setPosition(L.mx, L.my);
        side.hidden = false;
        side.lift = LIFT_MAX * (1 - kd * kd);
        this.fx.spawn(L.mx + (Math.random() - 0.5) * 24, L.my - side.lift + 20, { vx: 0, vy: -140, life: 200, s0: 3, len: 34, rot: Math.PI / 2, colors: [0xffffff], a0: 0.85 });
      } else {                      // toca el suelo: daño en un círculo
        side.sprite.setPosition(L.mx, L.my);
        const mv = L.mv;
        this.endLeap(side);
        side.lockUntil = this.t + 250;
        const hitIt = this.canHit(target) && Math.hypot(target.sprite.x - L.mx, target.sprite.y - L.my) < cfg.r + R * 0.6;
        if (hitIt) {
          const len = Math.hypot(target.sprite.x - L.mx, target.sprite.y - L.my) || 1;
          this.applyHit(side, L.att, mv, target, target.sprite.x, target.sprite.y, (target.sprite.x - L.mx) / len || 1, (target.sprite.y - L.my) / len, 1.3);
        } else this.fx.impact(mv.fx ?? 'wing', L.mx, L.my, 0, mv.power);
        this.cameras.main.shake(160, 0.004);
        if (kind === 'bounce') for (let i = 0; i < 3; i++) this.fx.ring(L.mx, L.my, [0xffffff, 0xd8f6ff, 0x9fd8ff][i], 10, 90 + i * 40, 320 + i * 90, 5 - i);
        for (let i = 0; i < 10; i++) this.fx.spawn(L.mx, L.my, { vx: (Math.random() - 0.5) * 300, vy: -90 - Math.random() * 160, g: 700, life: 520, s0: 10, s1: 3, colors: kind === 'dig' ? [0xe0c68a, 0xc09a5a, 0xa07840] : [0xe0d8c0, 0xc0b898] });
      }
    }
  }

  // Ataque de área: se crea con su geometría y se va dibujando y comprobando cada cuadro (ver updateAreas).
  private castArea(side: Side, m: Member, mv: Move) {
    const kind = this.aimRoll(mv, side), target = side === this.player ? this.enemy : this.player;
    const f = mv.style === 'nova' || mv.style === 'strike' ? side.facing : this.rotate(side.facing, this.aimAngle(kind, side));   // las de dirección se desvían; la onda redonda y el rayo del cielo, no
    const off = mv.style === 'strike' ? this.missOffset(kind) : undefined;                                // el rayo del cielo cae corrido del rival
    const a = buildArea(mv, side.sprite.x, side.sprite.y + 6, f.x, f.y, A, { x: target.sprite.x + (off?.x ?? 0), y: target.sprite.y + 8 + (off?.y ?? 0) });
    if (mv.style === 'nova' && kind) { a.hit = true; this.floatText(side.sprite.x, side.sprite.y - 60, '¡Falló!', '#cccccc'); }   // la onda redonda no tiene a dónde desviarse: simplemente falla
    this.areas.push({ a, owner: side, att: m, move: mv, off });
    side.lockUntil = this.t + (mv.style === 'nova' ? 300 : 380);   // un instante concentrándose
    if (mv.style === 'ground') this.cameras.main.shake(260, 0.0035);
    if (mv.fx === 'mind') this.tweens.add({ targets: this.cameras.main, zoom: 1.045, duration: 260, yoyo: true, ease: 'Sine.easeInOut' });   // la realidad se deforma
  }

  private updateAreas(dt: number) {
    for (let n = this.areas.length - 1; n >= 0; n--) {
      const { a, owner, att, move, off } = this.areas[n];
      const target = owner === this.player ? this.enemy : this.player;
      a.lastT = a.t;
      a.t += dt;
      if (a.kind === 'strike' && a.t < a.trackUntil && !target.down) { a.zones[0].x = Phaser.Math.Clamp(target.sprite.x + (off?.x ?? 0), A.x + 20, A.x + A.w - 20); a.zones[0].y = Phaser.Math.Clamp(target.sprite.y + 8 + (off?.y ?? 0), A.y + 20, A.y + A.h - 20); }
      this.fx.area(a, dt);
      if (!a.hit && this.canHit(target)) {
        const tx = target.sprite.x, ty = target.sprite.y;
        let hit = false;
        if (a.kind === 'nova') {
          const dur = (a.range / a.speed) * 1000, p = Math.min(1, a.t / dur), front = a.range * (1 - (1 - p) * (1 - p));
          hit = a.t <= dur + 80 && Math.abs(Math.hypot(tx - a.ox, ty - a.oy) - front) < R + 28;   // el frente de la onda pasa por el rival
        } else if (a.kind === 'wave') {   // la ola es ancha: golpea a lo que esté a su ancho cuando pasa su frente
          const front = Math.min(a.range, (a.speed * a.t) / 1000), along = (tx - a.ox) * a.dx + (ty - a.oy) * a.dy, perp = -(tx - a.ox) * a.dy + (ty - a.oy) * a.dx;
          hit = a.t <= (a.range / a.speed) * 1000 + 80 && Math.abs(along - front) < 50 && Math.abs(perp) < 120 + 50 * (front / a.range) + R * 0.5;
        } else if (a.kind === 'storm') {  // la tormenta avanza y se ensancha
          const front = Math.min(a.range, (a.speed * a.t) / 1000), r = 60 + 40 * (front / a.range);
          hit = a.t <= (a.range / a.speed) * 1000 + 100 && Math.hypot(tx - (a.ox + a.dx * front), ty - (a.oy + a.dy * front)) < r + R * 0.6;
        } else {
          hit = a.zones.some((z) => a.t >= z.t0 && a.t <= z.t1 && Math.hypot(tx - z.x, ty - z.y) < z.r + R * 0.6);
        }
        if (hit) {
          a.hit = true;
          const along = a.kind === 'wave' || a.kind === 'storm';   // la ola y la ventisca empujan en la dirección en que avanzan
          const len = Math.hypot(tx - a.ox, ty - a.oy) || 1;
          this.applyHit(owner, att, move, target, tx, ty, along ? a.dx : (tx - a.ox) / len, along ? a.dy : (ty - a.oy) / len, 1);
        }
      }
      if (a.t >= a.life) this.areas.splice(n, 1);
    }
  }

  // Aura del tipo alrededor de quien usa un ataque de contacto; crece con el poder.
  private updateGlows(dt: number) {
    for (const side of [this.player, this.enemy]) {
      const g = side.glow;
      if (!g) continue;
      if (this.t >= g.until || side.down) { if (g.tint !== undefined) side.sprite.clearTint(); side.glow = null; continue; }
      this.fx.aura(g.fx, side.sprite.x, side.sprite.y, g.power, dt);
    }
  }

  // Salpicadura: no hace nada, como en los juegos.
  private splash(side: Side) {
    side.lockUntil = this.t + 360;
    this.floatText(side.sprite.x, side.sprite.y - 60, '¡Pero no pasó nada!', '#9fd8ff');
    this.fx.impact('water', side.sprite.x, side.sprite.y + 24, -Math.PI / 2, 30);
    this.tweens.add({ targets: side.sprite, scaleY: this.ss(side) * 1.22, scaleX: this.ss(side) * 0.85, duration: 120, yoyo: true, repeat: 1, onComplete: () => side.sprite.setScale(this.ss(side)) });
  }

  // Transformación (Ditto): copia especie, tipos, stats (menos los PS) y ataques del rival durante toda la batalla.
  // Como cada combate crea sus Pokémon desde cero, al empezar otra batalla Ditto vuelve a ser Ditto.
  private transform(side: Side, m: Member) {
    const foeSide = side === this.player ? this.enemy : this.player, foe = this.cur(foeSide);
    m.def = { ...foe.def, name: `Ditto (${foe.def.name})` };
    m.stats = { ...foe.stats, hp: m.stats.hp };
    m.pp = foe.def.moves.map((mv) => maxUses({ ...mv, pp: 5 }));   // 5 PP en cada ataque copiado
    side.cd = [0, 1, 2, 3].map(() => this.t + 500);
    this.floatText(side.sprite.x, side.sprite.y - 60, `¡Ditto se transformó en ${foe.def.name}!`, '#ffb3e6');
    this.fx.rise(side.sprite.x, side.sprite.y, 0xff8fcf, 10);
    this.fx.ring(side.sprite.x, side.sprite.y, 0xffd1ec, 20, 90, 450, 4);
    this.tweens.add({ targets: side.sprite, scaleX: this.ss(side) * 0.2, scaleY: this.ss(side) * 1.4, duration: 170, yoyo: true, onComplete: () => side.sprite.setScale(this.ss(side)) });
    if (side.isPlayer) this.refreshMoveTexts();
  }

  // Embestida: quien ataca se lanza hacia adelante y daña a lo primero que toca.
  private startDash(side: Side, m: Member, mv: Move) {
    const f = this.rotate(side.facing, this.aimDeviation(mv, side)), speed = 950;
    const ms = ((mv.dash ?? 200) / speed) * 1000;
    side.dash = { vx: f.x * speed, vy: f.y * speed, until: this.t + ms, move: mv, att: m, ghostAt: 0 };
    side.glow = { fx: mv.fx ?? 'slam', power: mv.power, until: this.t + ms + 380, tint: mv.tint };
    if (mv.tint !== undefined) side.sprite.setTint(mv.tint);   // se pone rojo mientras ataca (Enfado)
    side.lockUntil = this.t + ms + 260; // además queda un instante recuperándose
  }

  private updateDashes() {
    for (const side of [this.player, this.enemy]) {
      const d = side.dash;
      if (!d) continue;
      const f = side.facing;
      if (this.t >= d.ghostAt) {
        this.fx.afterimage(side.sprite, TYPE_COLOR[d.move.type]);
        d.ghostAt = this.t + 45;
      }
      this.fx.streak(side.sprite.x, side.sprite.y + 8, f.x, f.y);
      const target = side === this.player ? this.enemy : this.player;
      const dist = Math.hypot(target.sprite.x - side.sprite.x, target.sprite.y - side.sprite.y);
      if (this.canHit(target) && dist < R * 2 + 6) {
        const px = (side.sprite.x + target.sprite.x) / 2, py = (side.sprite.y + target.sprite.y) / 2;
        side.dash = null;
        side.lockUntil = this.t + 220;
        this.applyHit(side, d.att, d.move, target, px, py, f.x, f.y, 2);
      } else if (this.t >= d.until) {
        side.dash = null;
      }
    }
  }

  // Ataque de alcance corto (Lengüetazo): golpea al instante si el rival está al frente.
  private reachAttack(side: Side, m: Member, mv: Move) {
    const f = side.facing, reach = mv.reach ?? 150;
    const ang = Math.atan2(f.y, f.x) + this.aimDeviation(mv, side);
    this.fx.tongue(side.sprite.x + f.x * 22, side.sprite.y + f.y * 22 - 6, ang, reach);
    side.glow = { fx: mv.fx ?? 'lick', power: mv.power, until: this.t + 380 };
    side.lockUntil = this.t + 340;
    const target = side === this.player ? this.enemy : this.player;
    if (!this.canHit(target)) return;
    const dx = target.sprite.x - side.sprite.x, dy = target.sprite.y - side.sprite.y;
    const dist = Math.hypot(dx, dy);
    const diff = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(dy, dx) - ang));
    if (dist <= reach + R && diff < 0.5) {
      this.applyHit(side, m, mv, target, side.sprite.x + f.x * (dist - R), side.sprite.y + f.y * (dist - R), f.x, f.y, 1);
    }
  }

  // Ataque de estado: sube las etapas de stats y deja al usuario inmóvil mientras se concentra.
  private applyBoost(side: Side, m: Member, mv: Move) {
    const x = side.sprite.x, y = side.sprite.y;
    const notes: string[] = [];
    (Object.keys(mv.boost!) as StatKey[]).forEach((k) => {
      const before = m.stages[k];
      m.stages[k] = Phaser.Math.Clamp(before + mv.boost![k]!, -STAGE_MAX, STAGE_MAX);
      const gained = m.stages[k] - before;
      notes.push(gained === 0 ? `${STAT_NAME[k]} no puede subir más` : `${STAT_NAME[k]} ${gained >= 2 ? '▲▲' : '▲'}`);
    });
    side.lockUntil = this.t + (mv.lock ?? 0);
    side.auraUntil = side.lockUntil;
    notes.forEach((n, i) => this.floatText(x, y - 56 - i * 22, n, '#ffe066'));
    this.fx.rise(x, y, TYPE_COLOR[mv.type], 6 + Math.round((mv.lock ?? 0) / 500));   // partículas del tipo subiendo
    const rings = Math.max(1, Math.ceil((mv.lock ?? 0) / 450));
    for (let r = 0; r < rings; r++) {
      const ring = this.add.circle(x, y, 28, 0xffe066, 0).setStrokeStyle(4, TYPE_COLOR[mv.type]).setDepth(7).setAlpha(0);
      this.tweens.add({
        targets: ring, scale: 2.4, alpha: { from: 0.9, to: 0 }, duration: 650, delay: r * 450,
        onStart: () => ring.setPosition(side.sprite.x, side.sprite.y), onComplete: () => ring.destroy(),
      });
    }
  }

  private updateShots(s: number) {
    for (let n = this.shots.length - 1; n >= 0; n--) {
      const sh = this.shots[n];
      if (sh.stream) {
        if (this.updateStream(sh, s)) { sh.img.destroy(); this.shots.splice(n, 1); }
        continue;
      }
      if (sh.lob) {   // proyectil en arco: sigue su trayectoria y explota al llegar
        sh.age += s * 1000;
        const k = Math.min(1, sh.age / sh.lob.flight), lx = sh.lob.x0 + (sh.lob.lx - sh.lob.x0) * k, ly = sh.lob.y0 + (sh.lob.ly - sh.lob.y0) * k;
        sh.img.setPosition(lx, ly - 120 * Math.sin(Math.PI * k));
        sh.img.rotation += (SPIN[sh.fx] ?? 0) * s;
        this.fx.trail({ x: lx, y: ly - 120 * Math.sin(Math.PI * k), vx: sh.vx, vy: sh.vy, fx: sh.fx, ox: sh.ox, oy: sh.oy, acc: 0, age: sh.age }, s * 1000);
        if (k >= 1) { this.explodeLob(sh); sh.img.destroy(); this.shots.splice(n, 1); }
        continue;
      }
      if (sh.move.boomerang && !sh.flipped && this.t >= sh.dieAt - sh.move.life / 2) { sh.vx = -sh.vx; sh.vy = -sh.vy; sh.flipped = true; }   // da la vuelta
      sh.img.x += sh.vx * s;
      sh.img.y += sh.vy * s;
      sh.img.rotation += (SPIN[sh.fx] ?? 0) * s;
      if (sh.move.grow) sh.img.setScale(sh.move.size * (1 + (sh.move.grow - 1) * Math.min(1, sh.age / sh.move.life)));   // crece al alejarse
      const tr = { x: sh.img.x, y: sh.img.y, vx: sh.vx, vy: sh.vy, fx: sh.fx, ox: sh.ox, oy: sh.oy, acc: sh.acc, age: sh.age, mul: sh.move.size };
      this.fx.trail(tr, s * 1000);
      sh.acc = tr.acc;
      sh.age += s * 1000;
      const out = sh.img.x < A.x || sh.img.x > A.x + A.w || sh.img.y < A.y || sh.img.y > A.y + A.h;
      let done = out || this.t > sh.dieAt;
      let hitSomething = false;
      const target = sh.owner === this.player ? this.enemy : this.player;
      if (!done && this.canHit(target)) {
        const d = Math.hypot(target.sprite.x - sh.img.x, target.sprite.y - sh.img.y);
        if (d < R + 14 * sh.img.scaleX) {
          this.hit(sh, target);
          hitSomething = true;
          done = true;
        }
      }
      if (done) {
        if (!hitSomething) this.fx.fizzle(sh.fx, sh.img.x, sh.img.y);
        sh.img.destroy();
        this.shots.splice(n, 1);
      }
    }
  }

  // Chorro continuo: la base sigue al Pokémon y la punta avanza; daña a lo que toque a lo largo de él.
  // Devuelve true cuando ya terminó de recogerse.
  private updateStream(sh: Shot, s: number): boolean {
    const st = sh.stream!, owner = sh.owner;
    const bx = owner.sprite.x + st.dx * 34, by = owner.sprite.y + st.dy * 34 - 4;
    if (st.state === 'fly') {
      sh.img.x += sh.vx * s;
      sh.img.y += sh.vy * s;
      const target = owner === this.player ? this.enemy : this.player;
      if (this.canHit(target)) {
        // punto más cercano del chorro (base -> punta) al rival
        const sx = sh.img.x - bx, sy = sh.img.y - by, l2 = sx * sx + sy * sy || 1;
        const u = Phaser.Math.Clamp(((target.sprite.x - bx) * sx + (target.sprite.y - by) * sy) / l2, 0, 1);
        const cx = bx + sx * u, cy = by + sy * u;
        if (Math.hypot(target.sprite.x - cx, target.sprite.y - cy) < R + 14 * sh.move.size) {
          sh.img.setPosition(cx, cy); // la punta se queda en el punto de contacto
          this.applyHit(owner, sh.att, sh.move, target, cx, cy, st.dx, st.dy, 1);
          st.state = 'end';
          st.endAt = this.t;
        }
      }
      if (st.state === 'fly') {
        const out = sh.img.x < A.x || sh.img.x > A.x + A.w || sh.img.y < A.y || sh.img.y > A.y + A.h;
        if (out) sh.img.setPosition(Phaser.Math.Clamp(sh.img.x, A.x, A.x + A.w), Phaser.Math.Clamp(sh.img.y, A.y, A.y + A.h));
        if (out || this.t > sh.dieAt) { st.state = 'end'; st.endAt = this.t; }
      }
    }
    const k = st.state === 'end' ? Phaser.Math.Clamp((this.t - st.endAt) / 320, 0, 1) : 0;
    this.fx.stream(sh.fx, bx, by, sh.img.x, sh.img.y, k, sh.age, sh.move.size);
    sh.age += s * 1000;
    return st.state === 'end' && k >= 1;
  }

  private hit(sh: Shot, target: Side) {
    const len = Math.hypot(sh.vx, sh.vy) || 1;
    this.applyHit(sh.owner, sh.att, sh.move, target, sh.img.x, sh.img.y, sh.vx / len, sh.vy / len, 1);
  }

  // Daño de un ataque que conecta (proyectil, embestida o ataque corto), con sus efectos visuales.
  private applyHit(
    owner: Side, att: Member, mv: Move, target: Side, px: number, py: number, dirx: number, diry: number, kbMul: number,
  ) {
    const mem = this.cur(target);
    // Un Pokémon salvaje que sabe Teletransporte huye en cuanto le pegan (o le tiran un ataque de estado).
    if (this.wild && target === this.enemy && !this.wildFleeAt && !this.catching && mem.def.moves.some((m) => m.teleport)) this.wildFleeAt = this.t + 700;
    if (mv.category === 'status') { this.statusHit(mv, owner, target, px, py, dirx, diry); return; }
    if (mem.status === 'freeze' && mv.type === 'fire') this.cureStatus(target, 'status');   // el fuego descongela
    const { damage: dmg, eff, crit } = this.damageOf(att, mem, mv, true);
    mem.hp = Math.max(0, mem.hp - dmg);

    target.kb.add(new Phaser.Math.Vector2(dirx * 170 * kbMul, diry * 170 * kbMul));

    this.fx.impact(mv.fx ?? 'slam', px, py, Math.atan2(diry, dirx), mv.power);
    if (mv.hit) this.fx.play(mv.hit, target.sprite.x, target.sprite.y, Math.atan2(diry, dirx), mv.power, mv.type, owner.sprite.x, owner.sprite.y);   // garra, puño, mordisco...
    const strong = dmg >= target.team[target.active].maxHp * 0.1; // golpe fuerte
    if (strong || mv.power >= 100) this.cameras.main.shake(strong ? 110 : 90, strong ? 0.004 : 0.0028);
    sfx.hit(sfxKey(mv.fx ?? 'slam'), eff, crit, strong, target.sprite.x);
    target.flashUntil = this.t + 110;   // destello rojo (se pinta en updateVisuals)

    const tx = target.sprite.x, ty = target.sprite.y - 50;
    if (eff === 0) this.floatText(tx, ty, 'No afecta...', '#cccccc');
    else {
      this.floatText(tx, ty, `-${dmg}`, eff > 1 ? '#ffd23f' : '#ffffff');
      const notes = [crit ? '¡Golpe crítico!' : '', eff > 1 ? '¡Muy eficaz!' : eff < 1 ? 'Poco eficaz...' : ''].filter(Boolean);
      notes.forEach((n, i) => this.floatText(tx, ty - 22 * (i + 1), n, n.startsWith('¡G') ? '#ff6b6b' : eff > 1 ? '#ff9d3f' : '#9fb8d8'));
    }
    if (mv.drain && dmg > 0 && eff > 0 && att.hp > 0) {   // absorbe parte del daño: cura a quien ataca
      const gain = Math.min(att.maxHp - att.hp, Math.round(dmg * mv.drain * DRAIN_SCALE));
      if (gain > 0) {
        att.hp += gain;
        this.floatText(owner.sprite.x, owner.sprite.y - 50, `+${gain} PS`, '#7dff9a');
        this.fx.rise(owner.sprite.x, owner.sprite.y, 0x7dff9a, 5);
      }
    }
    if (mem.hp <= 0) this.faint(target);
    else {
      if (mv.inflict && eff > 0 && Math.random() * 100 < mv.inflict.chance) this.giveStatus(target, mv.inflict.status, false);
      if (mv.drop && eff > 0 && Math.random() * 100 < mv.drop.chance) this.applyDebuff(target, mv.drop.stages, mv.type);
    }

    if (mv.recoil && att.hp > 0) {
      const back = Math.floor(att.maxHp / 4);
      att.hp = Math.max(0, att.hp - back);
      this.floatText(owner.sprite.x, owner.sprite.y - 50, `-${back} (retroceso)`, '#ff9d9d');
      if (att.hp <= 0 && this.cur(owner) === att && !owner.down) this.faint(owner);
    }
  }

  // ---------- bajar stats, curar y teletransportarse ----------

  /** Baja stats (y precisión) del Pokémon de `target`: etapas de -6 a 6, como en los juegos. */
  private applyDebuff(target: Side, d: Debuff, type: Move['type']) {
    const m = this.cur(target), x = target.sprite.x, y = target.sprite.y - 56;
    const notes: string[] = [];
    (Object.keys(d) as (StatKey | 'acc')[]).forEach((k) => {
      const drop = d[k] ?? 0;
      if (!drop) return;
      const cur = k === 'acc' ? m.acc : m.stages[k];
      const next = Phaser.Math.Clamp(cur + drop, -STAGE_MAX, STAGE_MAX);
      if (k === 'acc') m.acc = next; else m.stages[k] = next;
      const name = k === 'acc' ? 'Precisión' : STAT_NAME[k];
      notes.push(next === cur ? `${name} no puede bajar más` : `${name} ${cur - next >= 2 ? '▼▼' : '▼'}`);
    });
    notes.forEach((n, i) => this.floatText(x, y - 22 * i, n, '#9fd0ff'));
    sfx.status('flinch', target.sprite.x);
    this.fx.rise(target.sprite.x, target.sprite.y + 20, TYPE_COLOR[type], 5);
  }

  /** Ataque que cura una fracción de los PS máximos de quien lo usa (Descanso además lo deja dormido 2 turnos). */
  private applyHeal(side: Side, m: Member, mv: Move) {
    const before = m.hp;
    if (mv.rest) { m.status = null; m.confLeft = 0; m.graceLeft = 0; }
    m.hp = Math.min(m.maxHp, m.hp + Math.round(m.maxHp * (mv.heal ?? 0.5)));
    const x = side.sprite.x, y = side.sprite.y;
    this.floatText(x, y - 56, `+${Math.round(m.hp - before)} PS`, '#7dff9a');
    this.fx.rise(x, y, 0x7dff9a, 10);
    side.lockUntil = this.t + (mv.lock ?? HEAL_LOCK);
    side.auraUntil = side.lockUntil;
    if (mv.rest) {
      this.giveStatus(side, 'sleep', true);
      m.statusLeft = 2 * TURN_MS;
    }
  }

  /** ¿Puede teletransportarse? Contra un salvaje siempre; contra un entrenador necesita a quién cambiar. */
  private canTeleport(side: Side): boolean {
    return this.wild || side.team.some((mm, i) => i !== side.active && mm.hp > 0);
  }

  /** Teletransporte, como en los juegos: con un Pokémon salvaje termina la batalla (huye quien lo use); contra un
   *  entrenador, quien lo usa se cambia por otro de su equipo. */
  private teleport(side: Side, m: Member) {
    this.floatText(side.sprite.x, side.sprite.y - 60, '¡Teletransporte!', '#ff9fd0');
    this.fx.rise(side.sprite.x, side.sprite.y, 0xff5cae, 12);
    if (this.wild) { this.escapeBattle(side, m); return; }
    if (side.isPlayer) { this.openMenu('team', true); return; }
    this.aiSwitchOut();
  }

  /** La batalla termina porque alguien huyó (Teletransporte contra un salvaje): sin EXP ni captura. */
  private escapeBattle(side: Side, m: Member) {
    if (this.over) return;
    this.over = true;
    this.paused = false;
    music.play('victory');
    const msg = side.isPlayer ? `¡${m.def.name} usó Teletransporte y escapó!` : `¡${m.def.name} salvaje usó Teletransporte y escapó!`;
    const bg = this.add.rectangle(480, 320, 960, 640, 0x000000, 0.6).setDepth(90);
    const t1 = this.add.text(480, 270, msg, { fontSize: '34px', color: '#ff9fd0', fontStyle: 'bold', align: 'center', wordWrap: { width: 800 } }).setOrigin(0.5).setDepth(91);
    const t2 = this.add.text(480, 360, this.returnTo ? 'ENTER para volver al camino' : 'ENTER para volver a elegir equipo', { fontSize: '24px', color: '#fff' }).setOrigin(0.5).setDepth(91);
    this.hintText = t2;
    this.menuLayer.add([bg, t1, t2]);
    this.queue = [];
  }

  /** El rival (entrenador) cambia de Pokémon al mejor que le quede. */
  private aiSwitchOut() {
    const e = this.enemy, foe = this.cur(this.player);
    let best = -1, bv = -9;
    e.team.forEach((m, i) => {
      if (i === e.active || m.hp <= 0) return;
      const v = this.aiMatchup(m, foe) + (m.hp / m.maxHp - 0.5) * 0.3;
      if (v > bv) { bv = v; best = i; }
    });
    if (best < 0) return;
    this.ai.lastSwitch = this.t;
    this.switchTo(e, best);
    e.invuln = this.t + 900;
    this.toast(`El rival cambia a ${this.cur(e).def.name}`);
  }

  // ---------- estados alterados ----------

  /** Dormido, congelado o paralizado: no puede caminar. */
  private immobile(s: Side): boolean {
    const st = this.cur(s).status;
    return st === 'sleep' || st === 'freeze' || st === 'paralysis';
  }

  /** Dormido o congelado: tampoco puede apuntar ni atacar. (El paralizado sí ataca, pero a veces falla.) */
  private incapable(s: Side): boolean {
    const st = this.cur(s).status;
    return st === 'sleep' || st === 'freeze';
  }

  /** Daño de un ataque entre dos Pokémon: calcDamage más la quemadura (los ataques físicos pegan la mitad). */
  private damageOf(att: Member, def: Member, mv: Move, random: boolean) {
    const r = calcDamage(fighter(att), fighter(def), mv, random, att.stages, def.stages);
    if (att.status === 'burn' && mv.category === 'physical' && r.damage > 0) r.damage = Math.max(1, Math.floor(r.damage * BURN_ATK_MULT));
    return r;
  }

  /**
   * Intenta causar un estado. `sure` es que viene de un ataque de estado (entonces avisa si no pudo).
   * Devuelve true si lo logró.
   */
  private giveStatus(target: Side, kind: Inflict['status'], sure: boolean): boolean {
    if (target.down) return false;
    const m = this.cur(target), x = target.sprite.x, y = target.sprite.y - 76;
    if (kind === 'tri') kind = (['burn', 'paralysis', 'freeze'] as const)[Math.floor(Math.random() * 3)];
    if (kind === 'flinch') {   // retroceso: pierde el ataque que estaba haciendo
      target.lockUntil = Math.max(target.lockUntil, this.t + FLINCH_MS);
      target.charging = null;
      target.dash = null;
      this.floatText(x, y, '¡Retrocedió!', '#cfd8e8');
      sfx.status('flinch', x);
      return true;
    }
    const types = m.def.types;
    const immune = (kind === 'burn' && types.includes('fire')) || (kind === 'freeze' && types.includes('ice')) ||
      ((kind === 'poison' || kind === 'toxic') && (types.includes('poison') || types.includes('steel'))) ||
      (kind === 'paralysis' && types.includes('electric'));
    if (immune) { if (sure) this.floatText(x, y, 'No afecta...', '#cccccc'); return false; }
    if (m.graceLeft > 0) { if (sure) this.floatText(x, y, '¡Resistió!', '#cccccc'); return false; }   // acaba de curarse: aguanta un rato
    if (kind === 'confusion') {
      if (m.confLeft > 0) { if (sure) this.floatText(x, y, '¡Pero ya está confuso!', '#cccccc'); return false; }
      m.confLeft = rollDuration('confusion');
    } else {
      if (m.status) { if (sure) this.floatText(x, y, '¡Pero falló!', '#cccccc'); return false; }
      m.status = kind;
      m.statusLeft = rollDuration(kind);
      m.statusAge = 0;
      m.tickIn = 1000;
      if (kind === 'sleep' || kind === 'freeze' || kind === 'paralysis') { target.dash = null; target.charging = null; }
    }
    const info = STATUS_INFO[kind];
    this.floatText(x, y, info.text, '#' + info.color.toString(16).padStart(6, '0'));
    sfx.status(kind, target.sprite.x);
    this.fx.rise(target.sprite.x, target.sprite.y, info.color, 8);
    this.fx.ring(target.sprite.x, target.sprite.y, info.color, 16, 80, 420, 4);
    return true;
  }

  private cureStatus(side: Side, what: 'status' | 'confusion') {
    const m = this.cur(side), x = side.sprite.x, y = side.sprite.y - 76;
    if (what === 'confusion') {
      m.confLeft = 0;
      m.graceLeft = STATUS_GRACE_MS;
      this.floatText(x, y, STATUS_INFO.confusion.cured, '#cfe8cf');
      return;
    }
    if (!m.status) return;
    this.floatText(x, y, STATUS_INFO[m.status].cured, '#cfe8cf');
    if (m.status === 'freeze') this.fx.ring(x, side.sprite.y, 0xbfeaff, 20, 90, 380, 3);
    m.status = null;
    m.statusLeft = 0;
    m.graceLeft = STATUS_GRACE_MS;
  }

  // Cuenta atrás de los estados y daño de la quemadura y el veneno (cada segundo, en la misma proporción que en los juegos:
  // fracción de los PS máximos por turno dividida entre HP_MULT y repartida en los segundos que dura un turno).
  private updateStatus(dt: number) {
    for (const side of [this.player, this.enemy]) {
      if (side.down) continue;
      const m = this.cur(side);
      if (m.graceLeft > 0) m.graceLeft -= dt;
      if (m.confLeft > 0) {
        m.confLeft -= dt;
        if (m.confLeft <= 0) this.cureStatus(side, 'confusion');
      }
      if (!m.status) continue;
      m.statusLeft -= dt;
      m.statusAge += dt;
      if (m.status === 'burn' || m.status === 'poison' || m.status === 'toxic') {
        m.tickIn -= dt;
        if (m.tickIn <= 0) {
          m.tickIn += 1000;
          const frac = m.status === 'burn' ? BURN_FRAC : m.status === 'poison' ? POISON_FRAC
            : TOXIC_STEP * Math.min(TOXIC_MAX_N, 1 + Math.floor(m.statusAge / TURN_MS));
          const dmg = Math.max(1, Math.round((m.maxHp * frac) / HP_MULT / (TURN_MS / 1000)));
          m.hp = Math.max(0, m.hp - dmg);
          const col = m.status === 'burn' ? '#ff9d6b' : '#d49aff';
          this.floatText(side.sprite.x + (Math.random() - 0.5) * 24, side.sprite.y - 44, `-${dmg}`, col);
          if (m.hp <= 0) { this.faint(side); continue; }
        }
      }
      if (m.statusLeft <= 0) this.cureStatus(side, 'status');
    }
  }

  // Ataque de estado que conecta: no daña, solo intenta aplicar el estado.
  private statusHit(mv: Move, owner: Side, target: Side, px: number, py: number, dirx: number, diry: number) {
    this.fx.impact(mv.fx ?? 'zap', px, py, Math.atan2(diry, dirx), 30);
    const mem = this.cur(target);
    if (mv.debuff) {
      if (mv.type === 'electric' && effectiveness('electric', mem.def.types) === 0) { this.floatText(target.sprite.x, target.sprite.y - 76, 'No afecta...', '#cccccc'); return; }
      this.applyDebuff(target, mv.debuff, mv.type);
      if (owner === this.enemy) this.ai.statusReadyAt = Math.max(this.ai.statusReadyAt, this.t + AI_STATUS_COOLDOWN_MS * 0.6);
      return;
    }
    if (mv.type === 'electric' && effectiveness('electric', mem.def.types) === 0) {   // Onda Trueno no afecta a los de tipo tierra
      this.floatText(target.sprite.x, target.sprite.y - 76, 'No afecta...', '#cccccc');
      return;
    }
    // Si el rival (IA) logró causar el estado, tarda bastante más en volver a intentarlo.
    if (this.giveStatus(target, mv.inflict!.status, true) && owner === this.enemy) this.ai.statusReadyAt = Math.max(this.ai.statusReadyAt, this.t + AI_STATUS_COOLDOWN_HIT_MS);
  }

  // Confuso: se golpea a sí mismo con un ataque físico de 40 de poder sin tipo.
  private confusedHit(side: Side) {
    const m = this.cur(side);
    const self: Move = { name: 'Confusión', type: 'normal', category: 'physical', power: CONFUSION_SELF_POWER, pp: 1, cost: 0, cooldown: 0, speed: 0, life: 0, size: 0, typeless: true };
    const dmg = this.damageOf(m, m, self, true).damage;
    m.hp = Math.max(0, m.hp - dmg);
    side.flashUntil = this.t + 160;
    this.floatText(side.sprite.x, side.sprite.y - 76, '¡Está confuso! ¡Se hirió a sí mismo!', '#ffd28a');
    this.floatText(side.sprite.x, side.sprite.y - 44, `-${dmg}`, '#ffffff');
    this.fx.impact('slam', side.sprite.x, side.sprite.y, 0, 40);
    sfx.status('confusion', side.sprite.x);
    if (m.hp <= 0) this.faint(side);
  }

  // Color del sprite según el estado (un destello rojo al recibir un golpe tiene prioridad).
  private applyTint(side: Side) {
    const m = this.cur(side);
    let tint: number | undefined;
    if (this.t < side.flashUntil) tint = 0xff7777;
    else if (side.glow?.tint !== undefined) tint = side.glow.tint;
    else if (m.status) tint = STATUS_INFO[m.status].tint;
    if (tint === undefined) side.sprite.clearTint();
    else side.sprite.setTint(tint);
  }

  private statusViews(): StatusView[] {
    return [this.player, this.enemy].map((side, i) => {
      const m = this.cur(side);
      return { key: String(i), x: side.sprite.x, y: side.sprite.y, status: m.status, confused: m.confLeft > 0, visible: !side.down && !side.hidden && side.sprite.visible };
    });
  }

  // Velocidad estimada del jugador (suavizada), para que la IA apunte hacia donde va a estar.
  private trackPlayer(dt: number) {
    const p = this.player.sprite, pv = this.pv;
    if (dt <= 0) return;
    const k = Math.min(1, dt / 140);
    const vx = Phaser.Math.Clamp((p.x - pv.x) / (dt / 1000), -600, 600), vy = Phaser.Math.Clamp((p.y - pv.y) / (dt / 1000), -600, 600);
    pv.vx += (vx - pv.vx) * k;
    pv.vy += (vy - pv.vy) * k;
    pv.x = p.x; pv.y = p.y;
  }

  // ---------- debilitados / cambios ----------

  private faint(side: Side) {
    const fm = this.cur(side);
    fm.status = null; fm.statusLeft = 0; fm.confLeft = 0;   // al debilitarse se pierden los estados
    side.down = true;
    sfx.faint(side.sprite.x);
    side.dash = null;
    side.glow = null;
    side.charging = null;
    this.endLeap(side);
    side.sprite.clearTint();
    side.sprite.setVisible(false);
    side.shadow.setVisible(false);
    side.arrow.setVisible(false);
    side.aura.setVisible(false);
    this.floatText(side.sprite.x, side.sprite.y - 30, `¡${this.cur(side).def.name} se debilitó!`, '#ff6666');
    if (!side.isPlayer) this.awardExp(fm);
    const alive = side.team.some((m) => m.hp > 0);
    if (side.isPlayer) {
      if (alive) this.openMenu('team', true);
      else this.finish(false);
    } else if (alive) this.enemySwapAt = this.t + 900;
    else this.finish(true);
  }

  private sendNextEnemy() {
    const e = this.enemy;
    const next = e.team.findIndex((m) => m.hp > 0);
    this.enemySwapAt = 0;
    this.switchTo(e, next);
    this.foeSeen = new Set([this.cur(this.player)]);   // el siguiente rival lo enfrentan quienes estén en la arena ahora
    e.sprite.setPosition(A.x + A.w - 160, A.y + A.h / 2);
    e.invuln = this.t + 1200;
    this.toast(`El rival envía a ${this.cur(e).def.name}`);
  }

  private switchTo(side: Side, idx: number) {
    const old = this.cur(side);
    old.stages = newStages(); // las mejoras se pierden al retirar al Pokémon
    old.acc = 0;
    old.confLeft = 0;         // la confusión y el contador del tóxico se reinician al retirarlo; los demás estados siguen
    old.statusAge = 0;
    side.flashUntil = 0;
    side.blockUntil = 0;
    side.active = idx;
    this.cur(side).stages = newStages();
    this.cur(side).acc = 0;
    if (side.isPlayer) this.foeSeen.add(this.cur(side));
    side.lockUntil = 0;
    side.auraUntil = 0;
    side.dash = null;
    side.glow = null;
    side.charging = null;
    this.endLeap(side);
    side.sprite.clearTint();
    side.down = false;
    side.cd = [this.t + 300, this.t + 300, this.t + 300, this.t + 300];
    side.sprite.setVisible(true).setTexture(`${this.cur(side).def.id}-walk`, 0).setScale(this.ss(side));
    side.shadow.setVisible(true);
    side.arrow.setVisible(true);
    if (side.isPlayer) this.refreshMoveTexts();
  }

  private finish(victory: boolean) {
    if (this.over) return;
    this.over = true;
    if (this.returnTo) this.returnTo = { ...this.returnTo, result: victory ? 'win' : 'lose' };
    music.play(victory ? 'victory' : 'defeat');
    this.applyExp();   // aunque se pierda, lo que se alcanzó a derrotar cuenta
    const lines = this.expLines();
    this.buildQueue();
    const bg = this.add.rectangle(480, 320, 960, 640, 0x000000, 0.6).setDepth(90);
    const t1 = this.add.text(480, lines.length ? 150 : 270, victory ? '¡VICTORIA!' : 'DERROTA', {
      fontSize: '72px', color: victory ? '#ffd23f' : '#ff6666', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(91);
    const t2 = this.add.text(480, lines.length ? 560 : 350, this.hintLabel(), { fontSize: '24px', color: '#fff' })
      .setOrigin(0.5).setDepth(91);
    this.hintText = t2;
    this.menuLayer.add([bg, t1, t2, ...this.expTexts(lines, 220)]);
  }

  // ---------- experiencia y niveles (aventura) ----------

  /** El Pokémon rival `foe` fue derrotado: su EXP se reparte solo entre los Pokémon que pelearon contra él y siguen con PS. */
  private awardExp(foe: Member) {
    if (!this.adventure) return;
    const earners = this.player.team.filter((m) => this.foeSeen.has(m) && m.hp > 0);
    for (const mem of earners) {
      const amount = expYield(foe.def, foe.level, mem.level, !!this.trainer, earners.length);
      this.expPool.set(mem, (this.expPool.get(mem) ?? 0) + Math.max(1, amount));
    }
  }

  /** Suma la EXP ganada y sube de nivel lo que corresponda: recalcula stats y PS máximos (los PS nuevos se suman a los actuales, como en los juegos). */
  private applyExp() {
    if (!this.adventure || this.expGain.length) return;
    this.player.team.forEach((mem, idx) => {
      const gained = this.expPool.get(mem) ?? 0;
      if (gained <= 0) return;
      const from = mem.level, base = POKEMON[this.speciesIdx[idx]];
      mem.exp += gained;
      while (mem.level < MAX_LEVEL && mem.exp >= expAt(mem.level + 1)) mem.level++;
      let stats = '';
      if (mem.level > from) {
        const old = mem.stats, c = makeCombatant(base, mem.level);
        const d = (a: number, b: number) => `${a} → ${b}`;
        stats = `PS ${d(old.hp, c.stats.hp)} · Atq ${d(old.atk, c.stats.atk)} · Def ${d(old.def, c.stats.def)} · AtE ${d(old.spa, c.stats.spa)} · DeE ${d(old.spd, c.stats.spd)} · Vel ${d(old.spe, c.stats.spe)}`;
        if (mem.hp > 0) mem.hp += c.maxHp - mem.maxHp;
        mem.stats = c.stats;
        mem.maxHp = c.maxHp;
      }
      this.expGain.push({ mem, idx, gained, from, to: mem.level, stats });
    });
  }

  // ---------- aprender ataques y evolucionar (después de la batalla, en la aventura) ----------

  private hintLabel(): string {
    return this.queue.length ? 'ENTER para continuar' : this.returnTo ? 'ENTER para volver al camino' : 'ENTER para volver a elegir equipo';
  }

  /** Arma la lista de pasos: por cada Pokémon que subió de nivel, los ataques que aprende en esos niveles y luego su evolución. */
  private buildQueue() {
    this.queue = [];
    for (const g of this.expGain) {
      if (g.to <= g.from) continue;
      const base = POKEMON[this.speciesIdx[g.idx]];
      for (const key of movesLearnedBetween(base.id, g.from, g.to, g.mem.own ?? [])) this.queue.push({ kind: 'learn', idx: g.idx, key });
      if (evolutionsAt(base.id, g.to).length) this.queue.push({ kind: 'evolve', idx: g.idx });
    }
  }

  private clearPost() {
    this.postObjs.forEach((o) => o.destroy());
    this.postObjs = [];
  }

  /** Cuadro de mensaje sobre la pantalla de resultados. */
  private postPanel(title: string, lines: string[], sprites: string[] = []): void {
    this.clearPost();
    const add = <T extends Phaser.GameObjects.GameObject>(o: T) => { this.postObjs.push(o); return o; };
    add(this.add.rectangle(480, 320, 900, 470, 0x1b2a1e).setStrokeStyle(4, 0xffd23f).setDepth(120));
    add(this.add.text(480, 120, title, { fontSize: '30px', color: '#ffd23f', fontStyle: 'bold', align: 'center', wordWrap: { width: 840 } }).setOrigin(0.5, 0).setDepth(121));
    sprites.forEach((key, i) => {
      if (this.textures.exists(key)) add(this.add.image(480 + (i - (sprites.length - 1) / 2) * 260, 270, key).setScale(1.4).setDepth(121));
    });
    lines.forEach((l, i) => add(this.add.text(480, (sprites.length ? 390 : 230) + i * 34, l, { fontSize: '22px', color: '#e8f4e8', align: 'center', wordWrap: { width: 840 } }).setOrigin(0.5, 0).setDepth(121)));
    add(this.add.text(480, 506, this.queue.length ? 'ENTER para continuar' : this.returnTo ? 'ENTER para volver al camino' : 'ENTER para volver a elegir equipo', { fontSize: '18px', color: '#cfe8cf' }).setOrigin(0.5).setDepth(121));
  }

  /** Menú de opciones (↑ ↓ y ENTER) sobre la pantalla de resultados. */
  private showChoice(title: string, sub: string, options: string[], pick: (i: number) => void) {
    this.choice = { sel: 0, title, sub, options, pick };
    this.drawChoice();
  }

  private drawChoice() {
    const c = this.choice;
    if (!c) return;
    this.clearPost();
    const add = <T extends Phaser.GameObjects.GameObject>(o: T) => { this.postObjs.push(o); return o; };
    add(this.add.rectangle(480, 320, 900, 480, 0x1b2a1e).setStrokeStyle(4, 0xffd23f).setDepth(120));
    add(this.add.text(480, 100, c.title, { fontSize: '26px', color: '#ffd23f', fontStyle: 'bold', align: 'center', wordWrap: { width: 840 } }).setOrigin(0.5, 0).setDepth(121));
    add(this.add.text(480, 168, c.sub, { fontSize: '18px', color: '#cfe8cf', align: 'center', wordWrap: { width: 840 } }).setOrigin(0.5, 0).setDepth(121));
    c.options.forEach((o, i) => {
      const y = 232 + i * 52, on = i === c.sel;
      add(this.add.rectangle(480, y + 18, 780, 44, on ? 0x2f5236 : 0x24382a).setStrokeStyle(3, on ? 0xffd23f : 0x3f5c48).setDepth(121));
      add(this.add.text(120, y + 4, `${on ? '▶ ' : '   '}${o}`, { fontSize: '20px', color: on ? '#ffffff' : '#cfe8cf' }).setDepth(122));
    });
    add(this.add.text(480, 560, '↑ ↓ elegir · ENTER aceptar', { fontSize: '16px', color: '#cfe8cf' }).setOrigin(0.5).setDepth(121));
  }

  private onPostKey(e: KeyboardEvent) {
    const c = this.choice;
    if (c) {
      if (e.key === 'ArrowDown') c.sel = (c.sel + 1) % c.options.length;
      else if (e.key === 'ArrowUp') c.sel = (c.sel + c.options.length - 1) % c.options.length;
      else if (e.key === 'Enter') { this.choice = null; c.pick(c.sel); return; }
      this.drawChoice();
      return;
    }
    if (e.key !== 'Enter') return;
    if (this.postObjs.length === 0 && !this.queue.length) { this.leave(); return; }
    this.nextStep();
  }

  private nextStep() {
    this.clearPost();
    const step = this.queue.shift();
    this.hintText?.setText(this.hintLabel());
    if (!step) { this.leave(); return; }
    const mem = this.player.team[step.idx];
    if (step.kind === 'learn') this.learnStep(step.idx, step.key);
    else this.evolveStep(step.idx, mem);
  }

  private typeLine(m: ReturnType<typeof moveByKey>): string {
    return `${m.type} · ${m.category === 'status' ? 'Estado' : `Potencia ${m.power}`} · PP ${maxUses(m)}`;
  }

  private learnStep(idx: number, key: string) {
    const mem = this.player.team[idx], mv = moveByKey(key), own = mem.own ?? (mem.own = []);
    if (own.length < MAX_MOVES) {
      this.teach(mem, own.length, key);
      this.postPanel(`¡${mem.def.name} aprendió ${mv.name}!`, [this.typeLine(mv)]);
      return;
    }
    this.showChoice(
      `${mem.def.name} quiere aprender ${mv.name}`,
      `${this.typeLine(mv)}\nPero ya conoce 4 ataques. ¿Cuál olvida?`,
      [...own.map((k) => { const m = moveByKey(k); return `${m.name}   —   ${this.typeLine(m)}`; }), `No aprender ${mv.name}`],
      (i) => {
        if (i >= own.length) { this.postPanel(`${mem.def.name} no aprendió ${mv.name}.`, []); return; }
        const old = moveByKey(own[i]).name;
        this.teach(mem, i, key);
        this.postPanel(`1, 2 y... ¡Puf!`, [`${mem.def.name} olvidó ${old} y aprendió ${mv.name}.`]);
      },
    );
  }

  /** Pone el ataque `key` en el hueco `slot` (con sus PP completos) y actualiza lo que usa la batalla. */
  private teach(mem: Member, slot: number, key: string) {
    const own = mem.own ?? (mem.own = []);
    own[slot] = key;
    mem.pp[slot] = maxUses(moveByKey(key));
    mem.def = withMoves(mem.def, own);
  }

  private evolveStep(idx: number, mem: Member) {
    const base = POKEMON[this.speciesIdx[idx]];
    const options = evolutionsAt(base.id, mem.level);
    if (!options.length) { this.nextStep(); return; }
    if (options.length === 1) { this.evolve(idx, mem, options[0]); return; }
    this.showChoice(`¡${base.name} está evolucionando!`, '¿En qué quiere evolucionar?', options.map((o) => `${POKEMON[o.toIndex].name}   ·   ${o.how === 'nivel' ? `nivel ${o.level}` : o.how}`), (i) => this.evolve(idx, mem, options[i]));
  }

  private evolve(idx: number, mem: Member, evo: Evolution) {
    const from = POKEMON[this.speciesIdx[idx]], to = POKEMON[evo.toIndex];
    const c = makeCombatant(to, mem.level);
    if (mem.hp > 0) mem.hp += c.maxHp - mem.maxHp;
    mem.stats = c.stats;
    mem.maxHp = c.maxHp;
    this.speciesIdx[idx] = evo.toIndex;
    mem.def = withMoves(to, mem.own ?? []);
    if (evolutionsAt(to.id, mem.level).length) this.queue.unshift({ kind: 'evolve', idx });   // si ya cumple el nivel de la siguiente, sigue
    this.postPanel(`¡${from.name} evolucionó a ${to.name}!`, [`Nivel ${mem.level}  ·  PS ${c.stats.hp}  Atq ${c.stats.atk}  Def ${c.stats.def}  AtE ${c.stats.spa}  DeE ${c.stats.spd}  Vel ${c.stats.spe}`], [`${from.id}-front`, `${to.id}-front`]);
  }

  private expLines(): { text: string; color: string }[] {
    const out: { text: string; color: string }[] = [];
    for (const g of this.expGain) {
      out.push({ text: `${g.mem.def.name}  +${g.gained} EXP${g.to > g.from ? `   ¡Nivel ${g.from} → ${g.to}!` : ''}`, color: g.to > g.from ? '#ffd23f' : '#cfe8cf' });
      if (g.stats) out.push({ text: g.stats, color: '#9fd0ff' });
    }
    return out;
  }

  private expTexts(lines: { text: string; color: string }[], y0: number): Phaser.GameObjects.Text[] {
    const small = lines.length > 8;
    return lines.map((l, i) => this.add.text(480, y0 + i * (small ? 26 : 30), l.text, { fontSize: l.color === '#9fd0ff' ? '15px' : '21px', color: l.color }).setOrigin(0.5).setDepth(91));
  }

  // ---------- IA rival ----------

  private aiUpdate(s: number) {
    const e = this.enemy, p = this.player, ai = this.ai;
    if (e.down) return;
    const busy = this.t < e.lockUntil;                  // concentrándose tras un ataque de mejora
    const incap = this.incapable(e);                    // dormido o congelado: ni se mueve ni ataca
    const locked = busy || this.immobile(e);            // sin poder caminar (el paralizado sí puede apuntar y atacar)
    const dx = p.sprite.x - e.sprite.x, dy = p.sprite.y - e.sprite.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist, ny = dy / dist;

    if (this.t > ai.aimUntil) {
      ai.aimErr = (Math.random() - 0.5) * 0.18;
      ai.aimUntil = this.t + 500 + Math.random() * 500;
    }
    // Apunta adelantándose: hacia donde va a estar el rival cuando llegue el proyectil (a corta distancia, de frente).
    const lead = dist > 240 ? Phaser.Math.Clamp(dist / 520, 0, 0.7) * 0.9 : 0;
    const ang = Math.atan2(dy + this.pv.vy * lead, dx + this.pv.vx * lead) + ai.aimErr;
    if (!incap && (!busy || e.charging)) e.facing.set(Math.cos(ang), Math.sin(ang));

    if (this.t > ai.strafeUntil) {
      ai.strafe = Math.random() < 0.5 ? 1 : -1;
      ai.strafeUntil = this.t + 900 + Math.random() * 1600;
    }
    // Con un ataque de contacto casi listo se acerca hasta su alcance; si no, mantiene la distancia.
    const memE = this.cur(e);
    const meleeR = memE.def.moves.reduce(
      (best, mv, i) => (mv.style && memE.pp[i] > 0 && this.t >= e.cd[i] - 800 ? Math.min(best, this.rangeOf(mv)) : best), 1e9);
    let ideal = meleeR < 1e9 ? Math.min(ai.ideal, meleeR * 0.7) : ai.ideal;
    let margin = meleeR < 1e9 ? 20 : 35;
    // Rival dormido, congelado o paralizado: no puede esquivar ni alejarse, así que se acerca a pegarle de cerca.
    if (this.immobile(p)) { ideal = Math.min(ideal, 150); margin = 10; }
    // Presión: si lleva un rato sin estar cerca del rival (porque este se queda lejos o quieto), la distancia que
    // le gusta mantener se va acortando, hasta ir a buscarlo. Al llegar a su alcance vuelve a pelear con normalidad.
    if (dist < 190) ai.closeAt = this.t;
    const pressure = Phaser.Math.Clamp((this.t - ai.closeAt - 2000) / 4000, 0, 1);
    ideal = Phaser.Math.Linear(ideal, 120, pressure);
    margin = Phaser.Math.Linear(margin, 10, pressure);
    // Seguro contra cualquier estancamiento: si lleva más de 5 s sin lanzar nada, se acerca decididamente.
    if (this.t > 6000 && this.t - ai.lastAct > 5000 && !locked) { ideal = Math.min(ideal, 150); margin = 0; }
    // Empuje de las paredes: crece al acercarse, para que nunca se anule justo en un borde.
    const wallM = 130, cx = A.x + A.w / 2, cy = A.y + A.h / 2;
    const dl = e.sprite.x - A.x, dr = A.x + A.w - e.sprite.x, dtp = e.sprite.y - A.y, dbt = A.y + A.h - e.sprite.y;
    let wx = 0, wy = 0;
    if (dl < wallM) wx += (1 - dl / wallM) * 2.4;
    if (dr < wallM) wx -= (1 - dr / wallM) * 2.4;
    if (dtp < wallM) wy += (1 - dtp / wallM) * 2.4;
    if (dbt < wallM) wy -= (1 - dbt / wallM) * 2.4;
    const cornered = Math.hypot(wx, wy) > 0.5;

    let mx = 0, my = 0;
    if (dist > ideal + margin) { mx = nx; my = ny; }
    else if (dist < ideal - 70) {
      if (cornered) {
        // Retroceder lo empujaría contra la pared: rodea al rival por el lado que da al centro.
        const sgn = -ny * (cx - e.sprite.x) + nx * (cy - e.sprite.y) >= 0 ? 1 : -1;
        mx = -ny * sgn * 1.3; my = nx * sgn * 1.3;
        ai.strafe = sgn;
        ai.strafeUntil = this.t + 700;
      } else { mx = -nx; my = -ny; }
    }
    // Si dar vueltas en este sentido lo empujaría contra una pared, cambia de sentido en vez de quedarse pegado a ella.
    const wallPush = Math.hypot(wx, wy);
    if (wallPush > 0.8 && (-ny * ai.strafe * wx + nx * ai.strafe * wy) < -0.5 * wallPush) {
      ai.strafe = -ai.strafe;
      ai.strafeUntil = this.t + 1500;
    }
    mx += -ny * ai.strafe * 0.8;
    my += nx * ai.strafe * 0.8;

    // esquivar lo que viene hacia el rival: proyectiles, chorros, ataques de área, caídas y embestidas
    const threat = this.aiThreat();
    mx += threat.x * 3.2;
    my += threat.y * 3.2;
    mx += wx;
    my += wy;

    // Red de seguridad: si lleva ~1 s casi sin moverse (y no está concentrándose), va hacia el centro.
    if (this.t >= ai.checkAt) {
      const moved = Math.hypot(e.sprite.x - ai.lastX, e.sprite.y - ai.lastY);
      if (moved < 45 && !locked && this.t > 1500 && Math.hypot(cx - e.sprite.x, cy - e.sprite.y) > 70) ai.unstickUntil = this.t + 900;   // en el centro no hay a dónde ir: se quedaría vibrando
      ai.lastX = e.sprite.x; ai.lastY = e.sprite.y;
      ai.checkAt = this.t + 1000;
    }
    if (this.t < ai.unstickUntil) {
      const L = Math.hypot(cx - e.sprite.x, cy - e.sprite.y) || 1;
      if (L < 50) ai.unstickUntil = 0;   // ya llegó al centro: seguir empujando hacia él lo haría vibrar en el lugar
      else { mx = ((cx - e.sprite.x) / L) * 1.5; my = ((cy - e.sprite.y) / L) * 1.5; }
    }

    const len = Math.hypot(mx, my);
    const sp = this.speedOf(e) * 0.85;
    const go = len && !locked;
    this.move(e, go ? (mx / len) * sp : 0, go ? (my / len) * sp : 0, s);

    if (this.t >= ai.nextFire && !busy && !incap) this.aiAttack(dist);
    if (this.t >= ai.switchCheck) { ai.switchCheck = this.t + 1000; this.aiConsiderSwitch(); }
  }

  // Peligros que vienen hacia el rival: devuelve hacia dónde apartarse (largo hasta 1; 0 si no hay peligro). Tarda un
  // instante en reaccionar a cada proyectil y a veces ni lo ve, para que no esquive perfecto.
  private aiThreat(): Phaser.Math.Vector2 {
    const e = this.enemy, p = this.player, ai = this.ai, out = new Phaser.Math.Vector2();
    const ex = e.sprite.x, ey = e.sprite.y;
    const flee = (fx: number, fy: number, w: number) => {   // se aparta de ese punto
      const dx = ex - fx, dy = ey - fy, d = Math.hypot(dx, dy) || 1;
      out.x += (dx / d) * w; out.y += (dy / d) * w;
    };
    const roomAt = (x: number, y: number) => x > A.x + 60 && x < A.x + A.w - 60 && y > A.y + 60 && y < A.y + A.h - 60;
    const sidestep = (ox: number, oy: number, ux: number, uy: number, w: number) => {   // se aparta de la recta (ox,oy)+t(ux,uy), hacia su lado
      const perp = -(ex - ox) * uy + (ey - oy) * ux;
      let sgn = perp >= 0 ? 1 : -1;
      if (!roomAt(ex - uy * sgn * 130, ey + ux * sgn * 130) && roomAt(ex + uy * sgn * 130, ey - ux * sgn * 130)) sgn = -sgn;   // si por ahí choca con la pared, va por el otro lado
      out.x += -uy * sgn * w; out.y += ux * sgn * w;
    };
    for (const sh of this.shots) {
      if (sh.owner !== p) continue;
      let note = ai.notice.get(sh);
      if (!note) { note = { at: this.t + 90 + Math.random() * 170, ignore: Math.random() < 0.12 }; ai.notice.set(sh, note); }
      if (note.ignore || this.t < note.at) continue;
      if (sh.stream) {   // chorro: una recta desde quien lo lanzó
        if (sh.stream.state !== 'fly') continue;
        const ox = p.sprite.x, oy = p.sprite.y, along = (ex - ox) * sh.stream.dx + (ey - oy) * sh.stream.dy;
        const perp = Math.abs(-(ex - ox) * sh.stream.dy + (ey - oy) * sh.stream.dx);
        if (along > 0 && perp < R + 40 + 14 * sh.move.size) sidestep(ox, oy, sh.stream.dx, sh.stream.dy, 1);
        continue;
      }
      if (sh.lob) {   // en arco: se aparta de donde va a caer
        if (Math.hypot(ex - sh.lob.lx, ey - sh.lob.ly) < (sh.move.lob ?? 85) + R + 30) flee(sh.lob.lx, sh.lob.ly, 1.2);
        continue;
      }
      const sp = Math.hypot(sh.vx, sh.vy) || 1;
      const rx = ex - sh.img.x, ry = ey - sh.img.y;
      const tt = (rx * sh.vx + ry * sh.vy) / (sp * sp);   // segundos hasta el punto de mayor acercamiento
      if (tt < 0 || tt > 0.8) continue;
      const mx = rx - sh.vx * tt, my = ry - sh.vy * tt, miss = Math.hypot(mx, my);
      if (miss > R + 16 + 14 * sh.img.scaleX + 25) continue;
      const w = 1 - (tt / 0.8) * 0.5;
      if (miss < 3) sidestep(sh.img.x, sh.img.y, sh.vx / sp, sh.vy / sp, w);
      else { out.x += (mx / miss) * w; out.y += (my / miss) * w; }
    }
    // Lee la puntería del rival: si apunta hacia aquí y puede disparar, se sale de su línea de tiro antes de que dispare
    // (no siempre: presta atención ~70 % del tiempo).
    if (this.t > ai.readUntil) { ai.reads = Math.random() < 0.7; ai.readUntil = this.t + 700; }
    const pm = this.cur(p);
    if (ai.reads && !this.incapable(p) && pm.energy >= 20 && p.cd.some((c) => this.t >= c - 200)) {
      const f = p.facing, rx = ex - p.sprite.x, ry = ey - p.sprite.y;
      const along = rx * f.x + ry * f.y, perp = Math.abs(-rx * f.y + ry * f.x);
      if (along > 80 && along < 650 && perp < R + 36) sidestep(p.sprite.x, p.sprite.y, f.x, f.y, 0.9);
    }
    if (ai.notice.size > 80) for (const k of [...ai.notice.keys()]) if (!this.shots.includes(k as Shot)) ai.notice.delete(k);
    for (const { a, owner } of this.areas) {   // ataques de área
      if (owner !== p || a.hit) continue;
      const rx = ex - a.ox, ry = ey - a.oy;
      if (a.kind === 'nova') {
        const d = Math.hypot(rx, ry), dur = (a.range / a.speed) * 1000, prog = Math.min(1, a.t / dur), front = a.range * (1 - (1 - prog) * (1 - prog));
        if (a.t < dur + 80 && d > front - (R + 28) && d < a.range + R + 30) flee(a.ox, a.oy, 1.1);
      } else if (a.kind === 'wave') {
        const front = Math.min(a.range, (a.speed * a.t) / 1000), along = rx * a.dx + ry * a.dy, perp = -rx * a.dy + ry * a.dx;
        if (along > front - 60 && along < a.range + 60 && Math.abs(perp) < 210 + 50 * (front / a.range)) {
          const sgn = perp >= 0 ? 1 : -1;
          out.x += -a.dy * sgn * 1.3; out.y += a.dx * sgn * 1.3;
        }
      } else if (a.kind === 'storm') {
        const front = Math.min(a.range, (a.speed * a.t) / 1000), r = 60 + 40 * (front / a.range);
        const cx = a.ox + a.dx * front, cy = a.oy + a.dy * front;
        if (Math.hypot(ex - cx, ey - cy) < r + R + 50) flee(cx, cy, 1.2);
      } else {
        for (const z of a.zones) if (a.t <= z.t1 && z.t0 - a.t < 900 && Math.hypot(ex - z.x, ey - z.y) < z.r + R + 45) flee(z.x, z.y, 1.2);
      }
    }
    if (p.leap && p.hidden) {   // Vuelo, Bote o Excavar del rival: se aparta de la marca de caída
      const cfg = LEAP[p.leap.mv.leap ?? 'fly'];
      if (Math.hypot(ex - p.leap.mx, ey - p.leap.my) < cfg.r + R + 50) flee(p.leap.mx, p.leap.my, 1.3);
    }
    if (p.dash) {   // embestida que viene de frente: un paso al costado
      const dx = ex - p.sprite.x, dy = ey - p.sprite.y, d = Math.hypot(dx, dy) || 1, sp = Math.hypot(p.dash.vx, p.dash.vy) || 1;
      if (d < 360 && (dx * p.dash.vx + dy * p.dash.vy) / (d * sp) > 0.8) sidestep(p.sprite.x, p.sprite.y, p.dash.vx / sp, p.dash.vy / sp, 1);
    }
    const len = out.length();
    if (len > 1) out.scale(1 / len);
    return out;
  }

  // Qué tan bien le va a `a` contra `b`: la fracción de los PS de b que le saca con su mejor ataque, menos la fracción de
  // los suyos que b le saca con el suyo. Positivo = le conviene pelear contra él.
  private aiMatchup(a: Member, b: Member): number {
    const best = (x: Member, y: Member) => Math.min(1.5, Math.max(0, ...x.def.moves.map((mv, i) =>
      mv.category === 'status' || x.pp[i] <= 0 ? 0 : this.damageOf(x, y, mv, false).damage)) / Math.max(1, y.hp));
    return best(a, b) - best(b, a);
  }

  // De vez en cuando evalúa cambiar de Pokémon (solo contra entrenadores y con enfriamiento): si el actual está
  // atrapado dormido o congelado, casi sin vida o en una mala pelea de tipos, entra un compañero que le convenga más.
  private aiConsiderSwitch() {
    const e = this.enemy, ai = this.ai;
    if (this.wild || e.down || this.enemySwapAt || this.over || this.t < ai.lastSwitch + 9000 || this.t < e.lockUntil || e.leap || e.charging || e.dash) return;
    if (Math.random() < 0.4) return;
    const cur = this.cur(e), foe = this.cur(this.player);
    let best = -1, bv = -9;
    e.team.forEach((m, i) => {
      if (i === e.active || m.hp <= 0) return;
      const v = this.aiMatchup(m, foe) + (m.hp / m.maxHp - 0.5) * 0.3 - (m.status === 'sleep' || m.status === 'freeze' ? 0.5 : 0);
      if (v > bv) { bv = v; best = i; }
    });
    if (best < 0) return;
    const here = this.aiMatchup(cur, foe) - (cur.status === 'burn' ? 0.15 : 0);
    const trapped = (cur.status === 'sleep' || cur.status === 'freeze') && cur.statusLeft > 3000;
    const weak = cur.hp < cur.maxHp * 0.25 && e.team[best].hp > e.team[best].maxHp * 0.5;
    const bad = here < -0.1 && bv - here > 0.35;
    if (!trapped && !weak && !bad) return;
    ai.lastSwitch = this.t;
    this.switchTo(e, best);
    e.invuln = this.t + 900;
    this.toast(`El rival cambia a ${this.cur(e).def.name}`);
  }

  // ¿Vale la pena bajarle estos stats al rival? Sí si alguno es relevante para él y todavía no está muy bajo.
  private aiWorthDebuff(mv: Move, foe: Member): boolean {
    return (Object.keys(mv.debuff!) as (StatKey | 'acc')[]).some((k) => {
      const drop = mv.debuff![k] ?? 0;
      if (!drop) return false;
      if (k === 'acc') return foe.acc > -2;
      if (foe.stages[k] <= -2) return false;
      if (k === 'atk') return foe.stats.atk >= foe.stats.spa * 0.8;
      if (k === 'spa') return foe.stats.spa >= foe.stats.atk * 0.8;
      return true;
    });
  }

  // ¿Vale la pena lanzarle este ataque de estado al rival?
  private aiWorthStatus(mv: Move, foe: Member): boolean {
    const st = mv.inflict!.status as StatusId, t = foe.def.types;
    if (foe.graceLeft > 0) return false;   // acaba de curarse: no vale la pena
    if (st === 'confusion') return foe.confLeft <= 0;
    if (foe.status) return false;
    if (st === 'paralysis' && (t.includes('electric') || (mv.type === 'electric' && effectiveness('electric', t) === 0))) return false;
    if (st === 'burn' && (t.includes('fire') || foe.stats.atk < foe.stats.spa * 0.8)) return false;   // quemar sirve contra atacantes físicos
    if ((st === 'poison' || st === 'toxic') && (t.includes('poison') || t.includes('steel') || foe.hp < foe.maxHp * 0.3)) return false;
    return true;
  }

  // Elige el siguiente ataque del rival: varía entre los que le hacen buen daño, evita los que no
  // afectan, respeta PP y energía, y de vez en cuando se concentra para mejorar sus stats.
  private rangeOf(mv: Move): number {
    if (mv.style === 'dash') return (mv.dash ?? 200) + R * 2;
    if (mv.style === 'reach') return (mv.reach ?? 150) + R;
    if (mv.style === 'strike') return 450;
    if (mv.style) return mv.range ?? 300;   // ataques de área
    return (mv.speed * mv.life) / 1000;
  }

  private aiAttack(dist: number) {
    const e = this.enemy, ai = this.ai;
    const mem = this.cur(e), foe = this.cur(this.player);
    const moves = mem.def.moves;
    if (mem.pp.every((n) => n <= 0)) {
      this.tryFire(e, 0); // Forcejeo
      ai.nextFire = this.t + 600;
      return;
    }
    const inRange = (mv: Move) => dist <= this.rangeOf(mv) * 0.9;
    const ready = (i: number) => mem.pp[i] > 0 && this.t >= e.cd[i] && mem.energy >= moves[i].cost;
    // Ditto se transforma lo antes posible en cuanto puede.
    const tf = moves.findIndex((mv, i) => mv.transform && ready(i));
    if (tf >= 0 && this.tryFire(e, tf)) { ai.nextFire = this.t + 1500; return; }
    // Curarse: con poca vida y un ataque que cura (Descanso solo si está muy mal).
    const heal = moves.findIndex((mv, i) => mv.heal && ready(i) && mem.hp < mem.maxHp * (mv.rest ? 0.3 : 0.45));
    if (heal >= 0 && Math.random() < 0.85 && this.tryFire(e, heal)) { ai.nextFire = this.t + 1500; return; }
    // Teletransporte (rival entrenador): si no tiene con qué hacer daño, se cambia por otro Pokémon de vez en cuando.
    const tp = moves.findIndex((mv, i) => mv.teleport && ready(i));
    if (tp >= 0 && !this.wild && this.t >= ai.lastSwitch + 6000 && moves.every((mv) => mv.category === 'status') && this.tryFire(e, tp)) { ai.nextFire = this.t + 1500; return; }
    // Bajar stats del rival: de vez en cuando, si le sirve y no está ya muy bajo.
    const dbIdx = moves.findIndex((mv, i) => mv.debuff && ready(i) && inRange(mv) && this.aiWorthDebuff(mv, foe));
    if (dbIdx >= 0 && this.t >= ai.statusReadyAt && Math.random() < 0.5 && this.tryFire(e, dbIdx)) {
      ai.nextFire = this.t + 700 + Math.random() * 500;
      ai.statusReadyAt = this.t + AI_STATUS_COOLDOWN_MS * 0.5 + Math.random() * 2000;
      return;
    }
    // Ataque de estado (dormir, paralizar...): si el rival está libre de estados y le sirve, lo prueba antes que otro ataque.
    const stIdx = moves.findIndex((mv, i) => mv.category === 'status' && mv.inflict && ready(i) && inRange(mv) && this.aiWorthStatus(mv, foe));
    if (stIdx >= 0 && this.t >= ai.statusReadyAt && Math.random() < 0.65 && this.tryFire(e, stIdx)) {
      ai.nextFire = this.t + 800 + Math.random() * 500;
      ai.statusReadyAt = this.t + AI_STATUS_COOLDOWN_MS + Math.random() * 3000;   // se enfría aunque falle; si conecta, sube más (statusHit)
      return;
    }
    const dmg = moves.map((mv) => (mv.category === 'status' || !inRange(mv) ? 0 : this.damageOf(mem, foe, mv, false).damage));
    // Valor de cada ataque: el daño, ×2 si remata al rival, un poco más si puede causarle un estado, y más si el rival no
    // puede esquivar (dormido, congelado o paralizado) y el ataque es lento de ver venir.
    const foeStuck = this.immobile(this.player);
    const score = dmg.map((d, i) => {
      if (d <= 0) return 0;
      const mv = moves[i];
      let sc = d;
      if (d >= foe.hp) sc *= 2;
      if (mv.inflict && !foe.status && mv.inflict.status !== 'confusion') sc *= 1 + (mv.inflict.chance / 100) * 0.35;
      if (foeStuck && (mv.charge || mv.style === 'strike' || mv.style === 'leap' || mv.style === 'storm' || mv.style === 'wave')) sc *= 1.6;
      return sc * (1 + (mem.energy - mv.cost) / 250) * (0.5 + 0.5 * (mv.accuracy ?? 100) / 100);
    });

    // Mejora de stats: lejos del rival, con energía de sobra y si aún tiene margen de subida.
    const boost = moves.findIndex((mv, i) =>
      mv.category === 'status' && !mv.inflict && ready(i) && mem.energy >= mv.cost + 10 &&
      (Object.keys(mv.boost!) as StatKey[]).some((k) => mem.stages[k] < 2));
    // Con la energía casi llena (al empezar o tras descansar) es más probable que abra con una mejora.
    const boostChance = foeStuck ? 0.9 : mem.energy >= 90 ? 0.75 : 0.4;   // con el rival inmóvil es el momento de prepararse
    if (boost >= 0 && dist > 140 && Math.random() < boostChance && this.tryFire(e, boost)) {
      ai.nextFire = this.t + 1500;
      return;
    }

    const cand = moves.map((_, i) => i).filter((i) => dmg[i] > 0 && ready(i));
    if (!cand.length) {   // sin ataques que hagan daño (Magikarp): usa el que no hace nada, de vez en cuando
      const idle = moves.findIndex((mv, i) => mv.category === 'status' && !mv.inflict && !mv.transform && !mv.teleport && !mv.heal && !mv.debuff && Object.keys(mv.boost ?? {}).length === 0 && ready(i));
      if (idle >= 0 && this.tryFire(e, idle)) { ai.nextFire = this.t + 1200; return; }
    }
    let pick = -1;
    if (cand.length) {
      const topC = Math.max(...cand.map((i) => score[i]));
      const pool = cand.filter((i) => score[i] >= topC * 0.55); // solo los que valen la pena
      // Pesos por daño, castigando repetir el mismo ataque para que vaya variando.
      const w = pool.map((i) => {
        const [last, prev] = [ai.hist[ai.hist.length - 1], ai.hist[ai.hist.length - 2]];
        return score[i] ** 2 * (i === last ? 0.3 : i === prev ? 0.7 : 1);
      });
      let r = Math.random() * w.reduce((a, b) => a + b, 0);
      pick = pool[pool.length - 1];
      for (let k = 0; k < pool.length; k++) {
        r -= w[k];
        if (r <= 0) { pick = pool[k]; break; }
      }
    }
    // No gastar la energía en un ataque flojo si el mejor está casi listo.
    const top = Math.max(...score);
    if (pick >= 0 && score[pick] < top * 0.6) {
      const j = score.indexOf(top);
      if (moves[j].cost - mem.energy <= 25 && e.cd[j] - this.t <= 1500 && mem.pp[j] > 0) pick = -1;
    }
    // Si iba a repetir el último ataque y hay otro igual de bueno casi listo, espera por ese.
    if (pick >= 0 && pick === ai.hist[ai.hist.length - 1] && ai.waits < 14) {
      const alt = moves.findIndex((mv, j) =>
        j !== pick && score[j] >= top * 0.55 && mem.pp[j] > 0 && mv.cost - mem.energy <= 22 && e.cd[j] - this.t <= 1200);
      if (alt >= 0) { pick = -1; ai.waits++; }
    }
    if (pick >= 0 && this.tryFire(e, pick)) {
      ai.waits = 0;
      ai.hist.push(pick);
      if (ai.hist.length > 3) ai.hist.shift();
      ai.nextFire = this.t + 400 + Math.random() * 600;
    } else ai.nextFire = this.t + 150;
  }

  // ---------- visuales ----------

  private updateVisuals() {
    const dm = this.destMark;
    dm.clear();
    if (settings.controls === 'mouse' && this.dest && !this.player.down && !this.over) {
      const r = 10 + 2 * Math.sin(this.t / 120);
      dm.lineStyle(3, 0xffe066, 0.9).strokeCircle(this.dest.x, this.dest.y, r);
      dm.fillStyle(0xffe066, 0.9).fillRect(this.dest.x - 2, this.dest.y - 2, 4, 4);
    }
    for (const side of [this.player, this.enemy]) {
      if (side.down) continue;
      if (!this.catching) this.applyTint(side);
      const f = side.facing;
      const step = side.moving ? Math.floor(this.t / 180) % 2 : 0; // alterna los 2 cuadros al caminar
      side.sprite.setTexture(`${this.cur(side).def.id}-walk`, walkRow(f) * 2 + step);
      side.sprite.setAlpha(this.t < side.invuln && Math.floor(this.t / 100) % 2 ? 0.4 : 1);
      side.sprite.setVisible(!side.hidden).setOrigin(0.5, 0.5 + side.lift / 96);   // la altura se dibuja moviendo el origen: la posición real no cambia
      side.shadow.setPosition(side.sprite.x, side.sprite.y + 36).setVisible(!side.hidden);
      side.arrow.setVisible(!side.hidden);
      side.arrow.setPosition(side.sprite.x + f.x * 62, side.sprite.y + f.y * 62).setRotation(Math.atan2(f.y, f.x));
      side.sprite.setDepth(10 + side.sprite.y / 1000);
      const glowing = this.t < side.auraUntil;
      side.aura.setVisible(glowing);
      if (glowing) {
        side.aura.setPosition(side.sprite.x, side.sprite.y + 4)
          .setFillStyle(0xffe066, 0.18 + 0.14 * Math.sin(this.t / 110));
      }
    }
  }

  private buildHudTexts() {
    const st = (size: number, color = '#fff') => ({ fontSize: `${size}px`, color });
    this.hudTexts = {
      ball: this.add.text(480, 16, '', st(14, '#7fc4ff')).setOrigin(0.5, 0).setDepth(51),
      pName: this.add.text(20, 8, '', st(20)).setDepth(51),
      pHp: this.add.text(330, 33, '', st(13)).setOrigin(1, 0).setDepth(51),
      eName: this.add.text(940, 8, '', st(20)).setOrigin(1, 0).setDepth(51),
      eHp: this.add.text(630, 33, '', st(13)).setDepth(51),
      pSt: this.add.text(96, 68, '', st(12, '#ffe066')).setDepth(51),
      eSt: this.add.text(940, 68, '', st(12, '#ffe066')).setOrigin(1, 0).setDepth(51),
      items: this.add.text(940, 575, '', st(15, '#cfe8cf')).setOrigin(1, 0).setDepth(51),
      help: this.add.text(940, 604, 'WASD mover · UIOP atacar · ENTER menú', st(12, '#9fb8a6')).setOrigin(1, 0).setDepth(51),
      toast: this.add.text(480, 110, '', { fontSize: '26px', color: '#fff', stroke: '#000', strokeThickness: 5 })
        .setOrigin(0.5).setDepth(60).setAlpha(0),
    };
    this.pills = [0, 1].map(() => [0, 1].map(() => this.add.text(0, 0, '', { fontSize: '12px', color: '#fff', fontStyle: 'bold', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setDepth(52).setVisible(false)));
    for (let i = 0; i < 4; i++) {
      const x = 20 + i * 150;
      this.moveTexts.push([
        this.add.text(x + 8, 578, KEY_SETS[settings.controls][i], { fontSize: '20px', color: '#ffd23f', fontStyle: 'bold' }).setDepth(51),
        this.add.text(x + 32, 580, '', { fontSize: '14px', color: '#fff' }).setDepth(51),
        this.add.text(x + 32, 600, '', { fontSize: '12px', color: '#9fb8a6' }).setDepth(51),
      ]);
    }
  }

  private refreshMoveTexts() {
    const def = this.cur(this.player).def;
    this.moveTexts.forEach((texts, i) => {
      const mv = def.moves[i];
      texts.forEach((t) => t.setVisible(!!mv));   // las teclas sin ataque se ocultan
      if (!mv) return;
      texts[1].setText(mv.name);
      texts[2].setText(`⚡${mv.cost}`);
    });
  }

  private bar(x: number, y: number, w: number, h: number, frac: number, color: number) {
    this.hud.fillStyle(0x000000, 0.6).fillRect(x - 2, y - 2, w + 4, h + 4);
    this.hud.fillStyle(color).fillRect(x, y, w * Phaser.Math.Clamp(frac, 0, 1), h);
  }

  private drawHud() {
    const g = this.hud;
    g.clear();
    g.fillStyle(0x14221a).fillRect(0, 0, 960, 84).fillRect(0, 570, 960, 70);
    const sides: [Side, number][] = [[this.player, 20], [this.enemy, 640]];
    for (const [side, x] of sides) {
      const m = this.cur(side);
      const frac = m.hp / m.maxHp;
      this.bar(x, 34, 300, 14, frac, frac > 0.5 ? 0x4fd14f : frac > 0.2 ? 0xffd23f : 0xe84a4a);
      const flash = side.isPlayer && this.t - this.noEnergyAt < 250;
      this.bar(x, 56, 300, 8, m.energy / ENERGY_MAX, flash ? 0xff4444 : 0x3d9bff);
      side.team.forEach((mem, i) => {
        const cx = x + 8 + i * 22;
        g.fillStyle(mem.hp > 0 ? 0xffd23f : 0x555555).fillCircle(cx, 74, 6);
        if (i === side.active) g.lineStyle(2, 0xffffff).strokeCircle(cx, 74, 8);
      });
    }
    const pm = this.cur(this.player), em = this.cur(this.enemy);
    this.hudTexts.pName.setText(`${pm.def.name}  Nv.${pm.level}`);
    this.hudTexts.ball.setText(this.armed ? `${BALLS[this.armed].name} lista · ESPACIO para lanzar` : '');
    // etiquetas de estado (QUE, PAR...) junto al nombre
    ([[this.player, this.hudTexts.pName], [this.enemy, this.hudTexts.eName]] as [Side, Phaser.GameObjects.Text][]).forEach(([side, name], i) => {
      const m = this.cur(side), ids = [m.status, m.confLeft > 0 ? 'confusion' : null].filter(Boolean) as StatusId[];
      const w = 40;
      let x = side.isPlayer ? name.x + name.width + 12 : name.x - name.width - 12 - w;
      this.pills[i].forEach((t, k) => {
        const id = ids[k];
        t.setVisible(!!id);
        if (!id) return;
        g.fillStyle(STATUS_INFO[id].color).fillRoundedRect(x, 11, w, 18, 5);
        g.lineStyle(1.5, 0x000000, 0.6).strokeRoundedRect(x, 11, w, 18, 5);
        t.setText(STATUS_INFO[id].abbr).setPosition(x + w / 2, 20);
        x += side.isPlayer ? w + 4 : -(w + 4);
      });
    });
    this.hudTexts.pHp.setText(`${Math.ceil(pm.hp)}/${pm.maxHp}`);
    this.hudTexts.eName.setText(`${this.wild ? 'Salvaje ' : ''}${em.def.name}  Nv.${em.level}`);
    this.hudTexts.eHp.setText(`${Math.ceil(em.hp)}/${em.maxHp}`);
    const stagesLine = (m: Member) =>
      (Object.keys(m.stages) as StatKey[]).filter((k) => m.stages[k] !== 0)
        .map((k) => `${STAT_SHORT[k]} ${m.stages[k] > 0 ? '+' : ''}${m.stages[k]}`).join('  ');
    this.hudTexts.pSt.setText(stagesLine(pm));
    this.hudTexts.eSt.setText(stagesLine(em));
    this.hudTexts.items.setText(`Poción x${this.inventory.potion}   Éter x${this.inventory.ether}`);

    pm.def.moves.forEach((mv, i) => {
      const x = 20 + i * 150;
      g.lineStyle(3, TYPE_COLOR[mv.type]).strokeRect(x, 576, 140, 56);
      const cdLeft = Phaser.Math.Clamp((this.player.cd[i] - this.t) / mv.cooldown, 0, 1);
      if (cdLeft > 0) g.fillStyle(0x000000, 0.55).fillRect(x, 576 + 56 * (1 - cdLeft), 140, 56 * cdLeft);
      if (pm.energy < mv.cost || pm.pp[i] <= 0) g.fillStyle(0x7a1f1f, 0.45).fillRect(x, 576, 140, 56);
      this.moveTexts[i][2].setText(`⚡${mv.cost}  PP ${pm.pp[i]}/${maxUses(mv)}`).setFontSize(11)
        .setColor(pm.pp[i] <= 0 ? '#ff8888' : '#9fb8a6');
    });
  }

  private floatText(x: number, y: number, str: string, color: string) {
    const t = this.add.text(x, y, str, { fontSize: '20px', color, stroke: '#000', strokeThickness: 4, fontStyle: 'bold' })
      .setOrigin(0.5).setDepth(70);
    this.tweens.add({ targets: t, y: y - 40, alpha: 0, duration: 900, onComplete: () => t.destroy() });
  }

  private toast(msg: string) {
    const t = this.hudTexts.toast;
    this.tweens.killTweensOf(t);
    t.setText(msg).setAlpha(1);
    this.tweens.add({ targets: t, alpha: 0, delay: 1400, duration: 500 });
  }

  // ---------- menú de pausa ----------

  private onKey(e: KeyboardEvent) {
    if (e.key === 'm' || e.key === 'M') { // el interruptor de la música está en music.ts
      this.toast(music.isMuted ? 'Sonido desactivado (M)' : 'Sonido activado (M)');
      return;
    }
    if (this.catching) return; // la secuencia de captura no se interrumpe
    if (this.over) { this.onPostKey(e); return; }
    if (!this.paused) {
      if (e.key === 'Enter') this.openMenu('main');
      return;
    }
    const opts = this.menuOptions();
    const m = this.menu;
    if (e.key === 'ArrowDown') m.idx = (m.idx + 1) % opts.length;
    else if (e.key === 'ArrowUp') m.idx = (m.idx + opts.length - 1) % opts.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      if (m.screen !== 'settings' || m.idx > 1) return;
      this.adjustVolume(m.idx === 0 ? 'sfx' : 'music', e.key === 'ArrowRight' ? 1 : -1);
    } else if (e.key === 'Enter') { this.activate(m.idx); return; }
    else if (e.key === 'Escape' || e.key === 'Backspace') {
      if (m.forced && m.screen !== 'data' && m.screen !== 'teamActions') return;
      if (m.screen === 'main') { this.closeMenu(); return; }
      if (m.screen === 'data') { m.screen = 'teamActions'; m.idx = 0; m.msg = ''; }
      else if (m.screen === 'teamActions') { m.screen = 'team'; m.idx = m.sel; m.msg = this.menu.forced ? 'Elige tu siguiente Pokémon' : ''; }
      else if (m.screen === 'controls') { m.screen = 'settings'; m.idx = 2; m.msg = ''; }
      else if (m.screen === 'settings') { m.screen = 'main'; m.idx = this.mainActions().indexOf('settings'); m.msg = ''; }
      else { m.screen = 'main'; m.idx = 0; m.msg = ''; }
    } else return;
    this.renderMenu();
  }

  // Termina la batalla: vuelve al camino si venía del mundo, o a la selección de equipo.
  private leave() {
    if (this.returnTo) this.scene.start('World', { ...this.returnTo, party: this.collectParty(), items: { ...this.inventory } });
    else this.scene.start('Select');
  }

  // PS y PP con los que sale cada Pokémon del jugador de la batalla (para la aventura).
  private collectParty(): Party {
    const out: Party = {};
    this.player.team.forEach((mem, i) => {
      const base = POKEMON[this.speciesIdx[i]];
      const transformed = mem.def.id !== base.id;   // Ditto copió los ataques del rival: sus PP propios no cambian
      const own = mem.own;
      const ownPp = own && own.length ? own.map((k) => maxUses(moveByKey(k))) : base.moves.map(maxUses);
      out[this.teamIds[i]] = {
        hp: mem.hp, pp: transformed ? ownPp : [...mem.pp], level: mem.level, exp: mem.exp,
        moves: own ? [...own] : undefined, species: this.speciesIdx[i],
      };
    });
    return out;
  }

  // Acciones del menú principal; "Poké Balls" solo existe frente a un Pokémon salvaje.
  private mainActions(): string[] {
    return ['resume', 'team', 'items', ...(this.wild ? ['balls'] : []), 'settings', ...(this.trainer ? [] : ['exit'])];
  }

  private menuOptions(): string[] {
    const m = this.menu;
    if (m.screen === 'main') return this.mainActions().map((a) => (a === 'exit' && this.returnTo ? 'Huir al camino' : MAIN_LABEL[a]));
    if (m.screen === 'balls') {
      const e = this.cur(this.enemy);
      return [
        ...(Object.keys(BALLS) as BallId[]).map((id) => {
          const pct = captureChance(catchX(e.maxHp, e.hp, e.def.catchRate, id, e.level, statusCatchMult(e.status)), id) * 100;
          return `${BALLS[id].name} x${this.balls[id]}   ${pct < 10 ? pct.toFixed(1) : Math.round(pct)}%`;
        }),
        'Atrás',
      ];
    }
    if (m.screen === 'settings') {
      const bar = (v: number) => `${'█'.repeat(v)}${'░'.repeat(10 - v)} ${v}`;
      return [
        `Efectos   ${bar(settings.sfx)}`,
        `Música    ${bar(settings.music)}`,
        `Controles: ${settings.controls === 'keys' ? 'Teclado' : 'Mouse'}`,
        'Atrás',
      ];
    }
    if (m.screen === 'controls') {
      return [
        `${settings.controls === 'keys' ? '●' : '○'} Teclado: WASD + UIOP`,
        `${settings.controls === 'mouse' ? '●' : '○'} Mouse: clic + QWER`,
        'Atrás',
      ];
    }
    if (m.screen === 'team') {
      const list = this.player.team.map((mem) => mem.def.name);
      return m.forced ? list : [...list, 'Atrás'];
    }
    if (m.screen === 'teamActions') return ['Datos', 'Cambiar Pokémon', 'Atrás'];
    if (m.screen === 'data') return ['Atrás'];
    if (m.screen === 'items') {
      return [
        ...(['potion', 'ether'] as ItemId[]).map((k) => `${ITEMS[k].name} x${this.inventory[k]}   ${ITEMS[k].desc}`),
        'Atrás',
      ];
    }
    return [];
  }

  private openMenu(screen: MenuScreen, forced = false) {
    this.paused = true;
    this.menu = { screen, idx: 0, forced, msg: forced ? 'Elige tu siguiente Pokémon' : '', sel: 0 };
    this.renderMenu();
  }

  private closeMenu() {
    this.paused = false;
    this.menu.screen = '';
    this.menuLayer.removeAll(true);
  }

  private renderMenu() {
    const m = this.menu;
    this.menuLayer.removeAll(true);
    if (!this.paused || !m.screen) return; // sin menú abierto no hay nada que dibujar
    if (m.screen === 'team' || m.screen === 'teamActions' || m.screen === 'data') { this.renderTeamMenu(); return; }
    const opts = this.menuOptions();
    const h = 120 + opts.length * 40 + (m.screen === 'controls' ? 30 : 0);
    const y0 = 320 - h / 2;
    const title = {
      main: 'PAUSA', team: 'POKÉMON', items: 'OBJETOS', balls: 'POKÉ BALLS', settings: 'CONFIGURACIÓN', controls: 'CONTROLES', '': '',
    }[m.screen];
    const hint = m.screen === 'settings' ? '← → ajustar volumen · ENTER abrir · ESC volver'
      : m.screen === 'controls' ? this.controlsHint(m.idx)
      : m.screen === 'balls' ? 'ENTER elige la bola · el % es la probabilidad de captura ahora'
      : '↑ ↓ mover · ENTER aceptar · ESC volver';
    const items: Phaser.GameObjects.GameObject[] = [
      this.add.rectangle(480, 320, 960, 640, 0x000000, 0.55),
      this.add.rectangle(480, 320, 580, h, 0x1b2a1e).setStrokeStyle(4, 0xffd23f),
      this.add.text(480, y0 + 26, title, { fontSize: '26px', color: '#ffd23f', fontStyle: 'bold' }).setOrigin(0.5),
    ];
    opts.forEach((o, i) => {
      const sel = i === m.idx;
      items.push(this.add.text(214, y0 + 64 + i * 40, `${sel ? '▶ ' : '  '}${o}`, {
        fontSize: '22px', color: sel ? '#ffffff' : '#9fb8a6',
      }));
    });
    items.push(this.add.text(480, y0 + h - (m.screen === 'controls' ? 32 : 22), m.msg || hint, {
      fontSize: '15px', color: '#cfe8cf', align: 'center', wordWrap: { width: 540 },
    }).setOrigin(0.5));
    this.menuLayer.add(items);
  }


  // Los Pokémon del jugador con su vida y los PP que les quedan (para las tarjetas y el panel de datos).
  private teamEntries(): Entry[] {
    const p = this.player;
    return p.team.map((mem, i) => ({
      def: mem.def, level: mem.level, hp: mem.hp, maxHp: mem.maxHp, stats: mem.stats, pp: mem.pp,
      tag: i === p.active && !p.down ? 'en combate' : undefined,
      exp: this.adventure ? { cur: mem.exp, from: expAt(mem.level), to: expAt(mem.level + 1) } : undefined,
    }));
  }

  // Pantalla Pokémon: tarjetas con imagen, nivel y PS; al elegir uno se ofrece ver sus datos o cambiarlo.
  private renderTeamMenu() {
    const m = this.menu, entries = this.teamEntries(), n = entries.length;
    const objs: Phaser.GameObjects.GameObject[] = [this.add.rectangle(480, 320, 960, 640, 0x000000, 0.6)];
    if (m.screen === 'data') {
      objs.push(...dataPanel(this, entries[m.sel], 480, 320));
      this.menuLayer.add(objs);
      return;
    }
    const hint = m.msg || (m.screen === 'team' ? '↑ ↓ elegir · ENTER abrir opciones · ESC volver' : '↑ ↓ mover · ENTER aceptar · ESC volver');
    const options = this.menuOptions();
    const rows = m.screen === 'team' ? n : 1;
    const cm = cardMetrics(m.screen === 'team' ? n : 1), listH = rows * (cm.h + cm.gap);
    const extra = m.screen === 'team' ? (m.forced ? 0 : 46) : options.length * 40 + 8;
    const h = 100 + listH + extra + 36, y0 = 320 - h / 2;
    objs.push(this.add.rectangle(480, 320, 640, h, 0x1b2a1e).setStrokeStyle(4, 0xffd23f));
    objs.push(this.add.text(480, y0 + 26, 'POKÉMON', { fontSize: '26px', color: '#ffd23f', fontStyle: 'bold' }).setOrigin(0.5));
    if (m.screen === 'team') {
      objs.push(...teamCards(this, entries, m.idx < n ? m.idx : -1, 480, y0 + 56, 580));
      if (!m.forced) objs.push(this.add.text(214, y0 + 56 + listH + 4, `${m.idx === n ? '▶ ' : '  '}Atrás`, { fontSize: '22px', color: m.idx === n ? '#ffffff' : '#9fb8a6' }));
    } else {
      objs.push(...teamCards(this, [entries[m.sel]], -1, 480, y0 + 56, 580));
      options.forEach((o, i) => objs.push(this.add.text(214, y0 + 56 + listH + 4 + i * 40, `${i === m.idx ? '▶ ' : '  '}${o}`, { fontSize: '22px', color: i === m.idx ? '#ffffff' : '#9fb8a6' })));
    }
    objs.push(this.add.text(480, y0 + h - 22, hint, { fontSize: '15px', color: '#cfe8cf', align: 'center', wordWrap: { width: 600 } }).setOrigin(0.5));
    this.menuLayer.add(objs);
  }

  // Explicación de cada esquema de controles, según la opción resaltada.
  private controlsHint(idx: number): string {
    if (idx === 0) return 'Mover con W A S D y atacar con U I O P. El ataque sale hacia donde caminas.';
    if (idx === 1) return 'Mover con clic izquierdo (mantén apretado para seguir al cursor) y atacar con Q W E R. El ataque sale hacia donde apunta el cursor.';
    return 'ESC también vuelve.';
  }

  private adjustVolume(which: 'sfx' | 'music', delta: number) {
    const v = Phaser.Math.Clamp(settings[which] + delta, 0, 10);
    if (v === settings[which]) return;
    settings[which] = v;
    saveSettings();
    music.applyVolumes();
    if (which === 'sfx') sfx.hit('slam', 1, false, false); // muestra del nuevo volumen
  }

  private activate(i: number) {
    const m = this.menu;
    const p = this.player;
    if (m.screen === 'main') {
      const act = this.mainActions()[i];
      if (act === 'resume') { this.closeMenu(); return; } // al cerrar no se vuelve a dibujar el menú
      else if (act === 'team') { m.screen = 'team'; m.idx = p.active; m.msg = ''; }
      else if (act === 'items') { m.screen = 'items'; m.idx = 0; m.msg = ''; }
      else if (act === 'balls') { m.screen = 'balls'; m.idx = 0; m.msg = ''; }
      else if (act === 'settings') { m.screen = 'settings'; m.idx = 0; m.msg = ''; }
      else this.leave();
    } else if (m.screen === 'balls') {
      const ids = Object.keys(BALLS) as BallId[];
      if (i >= ids.length) { m.screen = 'main'; m.idx = 0; m.msg = ''; }
      else if (this.balls[ids[i]] <= 0) m.msg = 'No te quedan.';
      else {
        this.armed = ids[i];
        this.closeMenu();
        this.toast(`${BALLS[ids[i]].name} lista: ESPACIO para lanzar`);
        return;
      }
    } else if (m.screen === 'settings') {
      if (i === 2) { m.screen = 'controls'; m.idx = settings.controls === 'keys' ? 0 : 1; m.msg = ''; }
      else if (i === 3) { m.screen = 'main'; m.idx = this.mainActions().indexOf('settings'); m.msg = ''; }
      else m.msg = 'Usa ← → para cambiar el volumen.';
    } else if (m.screen === 'controls') {
      if (i >= 2) { m.screen = 'settings'; m.idx = 2; m.msg = ''; }
      else {
        settings.controls = i === 0 ? 'keys' : 'mouse';
        saveSettings();
        this.dest = null;
        this.applyControlLabels();
        m.msg = `Controles: ${i === 0 ? 'teclado' : 'mouse'}.`;
      }
    } else if (m.screen === 'team') {
      if (i >= p.team.length) { m.screen = 'main'; m.idx = 0; m.msg = ''; } // el cursor queda en Continuar
      else { m.sel = i; m.screen = 'teamActions'; m.idx = 0; m.msg = ''; }   // elegir un Pokémon abre sus opciones
    } else if (m.screen === 'data') {
      m.screen = 'teamActions'; m.idx = 0; m.msg = '';
    } else if (m.screen === 'teamActions') {
      const k = m.sel;
      if (i === 0) { m.screen = 'data'; m.msg = ''; }
      else if (i === 2) { m.screen = 'team'; m.idx = k; m.msg = m.forced ? 'Elige tu siguiente Pokémon' : ''; }
      else if (p.team[k].hp <= 0) m.msg = 'Ese Pokémon está debilitado.';
      else if (k === p.active && !p.down) m.msg = 'Ya está en combate.';
      else {
        const i = k;
        const wasDown = p.down;
        this.switchTo(p, i);
        if (wasDown) {
          p.sprite.setPosition(A.x + 160, A.y + A.h / 2);
          p.invuln = this.t + 1500;
        }
        this.closeMenu();
        return;
      }
    } else if (m.screen === 'items') {
      if (i >= 2) { m.screen = 'main'; m.idx = 0; m.msg = ''; } // el cursor queda en Continuar
      else {
        const k = (['potion', 'ether'] as ItemId[])[i];
        const mem = this.cur(p);
        const full = k === 'potion' ? mem.hp >= mem.maxHp : mem.energy >= ENERGY_MAX;
        if (this.inventory[k] <= 0) m.msg = 'No te quedan.';
        else if (full) m.msg = 'No tendría efecto.';
        else {
          const hp0 = mem.hp, en0 = mem.energy;
          this.inventory[k]--;
          mem.hp = Math.min(mem.maxHp, mem.hp + ITEMS[k].hp);
          mem.energy = Math.min(ENERGY_MAX, mem.energy + ITEMS[k].energy);
          // Usar un objeto devuelve directamente a la batalla.
          this.closeMenu();
          this.toast(`${mem.def.name} usó ${ITEMS[k].name}`);
          const gain = k === 'potion' ? `+${Math.round(mem.hp - hp0)} PS` : `+${Math.round(mem.energy - en0)} Energía`;
          this.floatText(p.sprite.x, p.sprite.y - 56, gain, k === 'potion' ? '#7dff9a' : '#7fc4ff');
          return;
        }
      }
    }
    this.renderMenu();
  }
}
