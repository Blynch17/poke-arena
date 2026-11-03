import Phaser from 'phaser';
import { Area, powerScale, seeded } from './area';
import { Hit, HIT_LIFE, drawHit } from './hitfx';

// Efectos visuales de los ataques, en pixel art: cabezas dibujadas pixel a pixel, estelas de partículas
// cuadradas con paleta limitada y destellos de impacto. Todo se actualiza con el tiempo del combate,
// así que se congela solo cuando el juego está en pausa.

const FIRE = [0xfff3a8, 0xffd23f, 0xff8c1a, 0xd9411e, 0x5a2a1f];
const PAL: Record<string, number[]> = {
  fire: FIRE,
  water: [0xffffff, 0xbfe6ff, 0x66b8ff, 0x2f7fe0],
  ice: [0xffffff, 0xd8f6ff, 0x8ae6ff, 0x4aa3c7],
  leaf: [0xc8f56a, 0x6fd14f, 0x2f8f3a],
  sun: [0xffffff, 0xfff3a8, 0xffd23f, 0xa6e64a],
  sludge: [0xe0a3ff, 0xb45cd6, 0x7a2fa0, 0x4a1a66],
  elec: [0xffffff, 0xfff3a8, 0xffe135],
  psy: [0xffd1ec, 0xff8fcf, 0xff5cae, 0xb43f8a],
  shadow: [0x9a6fd0, 0x6b3fa0, 0x3a1f5c, 0x1b0f2e],
  hit: [0xffffff, 0xfff3a8, 0xffd23f],
  fairy: [0xffffff, 0xffd1ec, 0xf4a0c0, 0xd070a0],
  steel: [0xffffff, 0xd8dcea, 0xaab0c8, 0x6a7088],
  earth: [0xe0c68a, 0xc09a5a, 0xa07840, 0x6a4a28],
  rock: [0xd0d4de, 0xa0a6b4, 0x7a808c, 0x555a66],
  bug: [0xe8f4a0, 0xc8e038, 0x90b020, 0x506010],
  dark: [0x9a6a8a, 0x6a3a5a, 0x3a1f3a, 0x1a1020],
  dragon: [0xffffff, 0xb08cff, 0x7a45f8, 0x3a2a8a],
  punch: [0xffffff, 0xffd23f, 0xff8c1a, 0xd9411e],
  wind: [0xffffff, 0xd8f6ff, 0x9fd8ff, 0x6aa8d8],
  star: [0xffffff, 0xfff3a8, 0xffd23f, 0xe0a010],
  bone: [0xffffff, 0xf4ecd8, 0xc9bfa0, 0x8a7a5a],
};

const PAL_OF: Record<string, string> = {
  ember: 'fire', flame: 'fire', water: 'water', hydro: 'water', ice: 'ice', leaf: 'leaf', solar: 'sun',
  sludge: 'sludge', spark: 'elec', bolt: 'elec', thunder: 'elec', psy: 'psy', psychic: 'psy',
  shadow: 'shadow', wing: 'hit', lick: 'hit', slam: 'hit',
  blizzard: 'ice', fairy: 'fairy', steel: 'steel', earth: 'earth', rock: 'rock', bug: 'bug', dark: 'dark', dragon: 'dragon', punch: 'punch',
  wind: 'wind', star: 'star', bubble: 'water', bone: 'bone',
  jet: 'water', hyper: 'hit', aurora: 'ice', icebeam: 'ice', vine: 'leaf', blade: 'leaf', razor: 'leaf', psybeam: 'psy',
  dragonbreath: 'dragon', darkbeam: 'dark', flash: 'hit', moon: 'fairy', gleam: 'fairy', blast: 'fire', note: 'ice',
  cone: 'sludge', toxic: 'sludge', sludgebomb: 'sludge', tornado: 'wind', zap: 'elec', tri: 'psy', egg: 'fairy',
  ghost: 'shadow', ancient: 'rock', dream: 'shadow', mind: 'psy', buzz: 'bug', notes: 'fairy',
};

// Colores de los efectos de impacto según el tipo del ataque.
const TYPE_PAL: Record<string, string> = {
  fire: 'fire', water: 'water', grass: 'leaf', electric: 'elec', ice: 'ice', poison: 'sludge', flying: 'wind', psychic: 'psy',
  ghost: 'shadow', fighting: 'punch', ground: 'earth', rock: 'rock', bug: 'bug', dragon: 'dragon', steel: 'steel',
  dark: 'dark', fairy: 'fairy', normal: 'hit',
};

// Los efectos nuevos que se parecen a uno viejo usan su impacto.
const IMPACT_ALIAS: Record<string, string> = {
  jet: 'water', hyper: 'flame', aurora: 'ice', icebeam: 'ice', vine: 'leaf', blade: 'leaf', razor: 'leaf', psybeam: 'psy',
  dragonbreath: 'dragon', darkbeam: 'dark', flash: 'steel', moon: 'fairy', gleam: 'fairy', blast: 'flame', note: 'ice',
  cone: 'sludge', toxic: 'sludge', sludgebomb: 'sludge', tornado: 'wind', zap: 'spark', tri: 'psy', egg: 'fairy',
  ghost: 'shadow', ancient: 'rock', dream: 'shadow', mind: 'psychic', buzz: 'bug', notes: 'fairy',
};

export const HEAD_TEXTURE: Record<string, string> = {
  ember: 'head-fire', flame: 'head-fire', water: 'head-water', hydro: 'head-water', ice: 'head-ice',
  leaf: 'head-leaf', solar: 'head-sun', sludge: 'head-sludge', spark: 'head-spark', bolt: 'head-spark',
  thunder: 'head-spark', psy: 'head-psy', psychic: 'head-psy', shadow: 'head-shadow',
  fairy: 'head-fairy', steel: 'head-steel', earth: 'head-earth', rock: 'head-rock', bug: 'head-bug', dark: 'head-dark',
  wind: 'head-wind', star: 'head-star', bubble: 'head-bubble', bone: 'head-bone',
  note: 'head-note', razor: 'head-razor', blast: 'head-fireblast', cone: 'head-cone', toxic: 'head-toxic',
  sludgebomb: 'head-toxic', tri: 'head-tri', egg: 'head-egg', ghost: 'head-ghost', ancient: 'head-ancient', zap: 'head-spark',
};

// Proyectiles que no se dibujan como una cabeza (el efecto se pinta solo en la estela).
export const HIDE_HEAD = new Set(['tornado']);

// Ataques que se dibujan como un chorro continuo desde el Pokémon (ver Fx.stream).
export const STREAM_FX = new Set(['hydro', 'flame', 'solar', 'dragon', 'blizzard', 'jet', 'hyper', 'aurora', 'icebeam', 'vine', 'blade', 'psybeam', 'dragonbreath', 'darkbeam', 'flash', 'moon', 'gleam']);
const CUSTOM_STREAMS = new Set(['jet', 'hyper', 'aurora', 'icebeam', 'vine', 'blade', 'psybeam', 'darkbeam', 'flash', 'moon', 'gleam', 'dragonbreath']);

// Giro de la cabeza del proyectil, en rad/s.
export const SPIN: Record<string, number> = {
  leaf: 7, ice: 3, spark: 9, bolt: 6, thunder: 6, psy: 4, psychic: 4, solar: 2, fairy: 5, rock: 6, steel: 4, bug: 8, star: 10, bone: 12, razor: 16, egg: 6, ancient: 3, ghost: 2, tri: 5, blast: 1.5,
};

// ---------- sprites de las cabezas (pixel art dibujado con texto) ----------

type Art = { rows: string[]; pal: Record<string, number> };

const ART: Record<string, Art> = {
  'head-fire': {
    pal: { r: 0xd9411e, o: 0xff8c1a, y: 0xffe14d },
    rows: [
      '.....r.....', '....rrr....', '...rroor...', '..rroyoor..', '.rrooyyoor.', '.rooyyyyor.',
      '.rooyyyyor.', '..rooyyoo..', '...rooor...', '....rrr....', '.....r.....',
    ],
  },
  'head-water': {
    pal: { b: 0x3d9bff, w: 0xe8f6ff, d: 0x1f63c4 },
    rows: [
      '.....b.....', '....bbb....', '...bbwbb...', '..bbwbbbb..', '..bwbbbbb..', '..bbbbbbd..',
      '..bbbbbdd..', '...bbbdd...', '....ddd....',
    ],
  },
  'head-ice': {
    pal: { c: 0x8ae6ff, w: 0xffffff, d: 0x4aa3c7 },
    rows: [
      '.....w.....', '....cwc....', '...ccwcc...', '..ccwwccc..', '.cccwccccc.', '..ccwcccc..',
      '...cccdc...', '....cdd....', '.....d.....',
    ],
  },
  'head-leaf': {
    pal: { g: 0x4fd14f, l: 0xc8f56a, d: 0x2f8f3a },
    rows: ['.......ggg', '....ggggdl', '..ggglggd.', '.gglgggd..', 'gglggdd...', 'ggdd......'],
  },
  'head-sun': {
    pal: { y: 0xffd23f, w: 0xffffff, o: 0xff9d1a },
    rows: [
      '.....y.....', '..y..y..y..', '...ooooo...', '..oyyyyyo..', 'yyoyywyyoyy', '..oyyyyyo..',
      '...ooooo...', '..y..y..y..', '.....y.....',
    ],
  },
  'head-sludge': {
    pal: { p: 0xb45cd6, l: 0xe0a3ff, d: 0x7a2fa0 },
    rows: [
      '...ppppp...', '..ppllppp..', '.ppplpppdp.', '.pppppppdp.', '.ppppppddp.', '..pppddpp..', '...ppppp...',
    ],
  },
  'head-spark': {
    pal: { y: 0xffe135, w: 0xffffff },
    rows: [
      '....y....', '....y....', '..y.y.y..', '...yyy...', 'yyyywyyyy', '...yyy...', '..y.y.y..', '....y....', '....y....',
    ],
  },
  'head-psy': {
    pal: { p: 0xff5cae, w: 0xffd1ec, q: 0xb43f8a },
    rows: [
      '...ppp...', '..pwwwp..', '.pwppppp.', '.pwpppqp.', '.pppppqp.', '..pqqqp..', '...ppp...',
    ],
  },
  'head-fairy': {
    pal: { p: 0xf4a0c0, w: 0xffffff, q: 0xd070a0 },
    rows: ['...ppp...', '..pwwwp..', '.pwwwwwp.', '.pwwwwwq.', '..pwwwq..', '...qqq...'],
  },
  'head-steel': {
    pal: { g: 0x8a90a8, l: 0xc8ccd8, w: 0xffffff, d: 0x5a6078 },
    rows: [
      '...gggg...', '..glllld..', '.glwwlldd.', '.glwllldd.', '.glllllld.', '.gllllldd.', '..gddddd..', '...gggg...',
    ],
  },
  'head-earth': {
    pal: { b: 0xa07840, l: 0xd0a868, d: 0x6a4a28 },
    rows: ['..bbbb..', '.bllbbb.', 'bllbbbdb', 'bllbbbdb', '.bbbbddb', '..bbddd.'],
  },
  'head-rock': {
    pal: { g: 0x8c929c, l: 0xc0c6d0, d: 0x5a6068 },
    rows: ['..gg.gg...', '.glggllgg.', 'glllggdgg.', 'gllggggdg.', '.ggggdddg.', '..gddddg..'],
  },
  'head-bug': {
    pal: { y: 0xb8d820, o: 0x303a10, w: 0xe8f4a0 },
    rows: ['w.....w', '.w.y.w.', '..yyy..', '.yyoyy.', '..yyy..', '.w...w.'],
  },
  'head-dark': {
    pal: { r: 0x8a2a40, k: 0x1a1020, v: 0x4a2a6a },
    rows: ['...rrr...', '..rkkkr..', '.rkvvvkr.', '.rkvvvkr.', '..rkkkr..', '...rrr...'],
  },
  ball: {
    pal: { t: 0x3a8fe0, h: 0x9fd0f8, k: 0x1b1520, b: 0xf4ecd8, s: 0xc9bfa0, w: 0xffffff },
    rows: [
      '...ttttt...', '..thhtttt..', '.thttttttt.', '.ttttttttt.', 'kkkkkkkkkkk', 'bbbbkwkbbbb',
      'kkkkkkkkkkk', '.bbbbbbbbs.', '.bbbbbbbss.', '..bbbbbss..', '...bbbss...',
    ],
  },
  'head-wind': {
    pal: { w: 0xffffff, c: 0x9fd8ff },
    rows: ['ww......', '.wwc....', '..wwc...', '...wwc..', '....wwc.', '....wwc.', '....wwc.', '...wwc..', '..wwc...', '.wwc....', 'ww......'],
  },
  'head-star': {
    pal: { y: 0xffd23f, w: 0xffffff, o: 0xe0a010 },
    rows: ['....y....', '....y....', '...yyy...', 'yyyywyyyy', '.yyywyyy.', '..yyyyy..', '..yyoyy..', '.yy...yy.', '.y.....y.'],
  },
  'head-bubble': {
    pal: { b: 0x66b8ff, w: 0xffffff, d: 0x2f7fe0 },
    rows: ['..bbbbb..', '.bwwbbbd.', 'bwb...bbd', 'bw.....bd', 'b.......d', 'bb.....bd', '.bb...bd.', '..bbddd..'],
  },
  'head-bone': {
    pal: { w: 0xf4ecd8, s: 0xc9bfa0 },
    rows: ['ww.....ww', 'wwwwwwwww', 'wwwwwwwss', 'ww.....ss'],
  },
  'head-note': {
    pal: { w: 0xffffff, c: 0x8ae6ff, d: 0x4aa3c7 },
    rows: ['....ww....', '....wwww..', '....w..ww.', '....w..ww.', '....w.....', '....w.....', '..wwcw....', '.wwwcc....', '.wwcdd....', '..cdd.....'],
  },
  'head-razor': {
    pal: { g: 0x2f8f3a, l: 0xe8ffe0, d: 0x1f6a2c, w: 0xffffff },
    rows: ['...ggg......', '.gglllggg...', 'gglwwwwwlggg', '.gdddddddgg.', '...ddd......'],
  },
  'head-fireblast': {
    pal: { r: 0xd9411e, o: 0xff8c1a, y: 0xffe14d },
    rows: ['.....ro......', '.....roo.....', '....rooyo....', 'rrrrooyyoorrr', '.roooyyyyoor.', '..rooyyyyor..', '...rooyyor...', '...roooyor...', '..roo.r.oor..', '..ro.....or..', '.rr.......rr.'],
  },
  'head-cone': {
    pal: { p: 0xb45cd6, l: 0xc8ff7a, d: 0x4a1a66 },
    rows: ['ppp.......', 'pppppp....', 'pllpppppp.', 'plllllllpp', 'pdlpppppp.', 'pppppp....', 'ppp.......'],
  },
  'head-toxic': {
    pal: { p: 0x8a3fb0, l: 0xc8ff7a, d: 0x3a1a56, g: 0x7ad14f },
    rows: ['...pppppp...', '..ppglppppp.', '.pppppplpppp', '.ppgpppppppd', 'pppppppgppdd', 'pplpppppppdd', 'ppppgpppppdd', '.ppppplpppd.', '.pppppppdd..', '..ppdddddp..', '...pdddddp..'],
  },
  'head-tri': {
    pal: { y: 0xffe135, r: 0xff4a4a, b: 0x3d9bff, w: 0xffffff },
    rows: ['...yrr...', '..yyyrr..', '.yywyrrr.', '.yyyyrrr.', '.bbbbbbb.', '..bbbbb..', '...bbb...'],
  },
  'head-egg': {
    pal: { e: 0xf4ecd8, s: 0xc9bfa0, k: 0x8a7a5a },
    rows: ['..eee..', '.eeeee.', '.eekee.', 'eeeeeee', 'ekeeeke', 'eeeeeee', 'eeekeee', '.eeeess', '..sss..'],
  },
  'head-ghost': {
    pal: { p: 0x9a6fd0, d: 0x3a1f5c, k: 0x1b0f2e, e: 0xff4a4a, w: 0xffffff },
    rows: ['...ppppp...', '..pdddddp..', '.pddddddpp.', '.pdewdewdp.', '.pddkddkdp.', '.pdddkkddp.', '.pddkkkkdp.', '..pdkkkdp..', '...pdddp...', '....ppp....'],
  },
  'head-ancient': {
    pal: { g: 0x8c929c, l: 0xc0c6d0, d: 0x5a6068, y: 0xffd23f },
    rows: ['..gg.gg...', '.glggllgg.', 'glyllggdgg', 'gllgyggdg.', '.ggygdddg.', '..gddddg..'],
  },
  'head-shadow': {
    pal: { p: 0x9a6fd0, d: 0x3a1f5c, k: 0x1b0f2e },
    rows: [
      '...ppppp...', '..pddddddp.', '.pdkkkkkdp.', '.pdkkkkkdp.', '.pdkkkkkdp.', '..pdddddp..', '...ppppp...',
    ],
  },
};

export function makeFxTextures(scene: Phaser.Scene, scale = 3) {
  for (const [key, art] of Object.entries(ART)) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    let w = 0;
    art.rows.forEach((row, y) => {
      w = Math.max(w, row.length);
      [...row].forEach((c, x) => {
        const col = art.pal[c];
        if (col !== undefined) g.fillStyle(col, 1).fillRect(x * scale, y * scale, scale, scale);
      });
    });
    g.generateTexture(key, w * scale, art.rows.length * scale);
    g.destroy();
  }
}

// ---------- partículas ----------

interface PartOpts {
  vx?: number; vy?: number; life: number; s0: number; s1?: number; a0?: number; a1?: number;
  g?: number; colors: number[]; spin?: number; rot?: number; len?: number; depth?: number;
}

interface Part {
  obj: Phaser.GameObjects.Rectangle;
  x: number; y: number; vx: number; vy: number; g: number;
  life: number; age: number; s0: number; s1: number; a0: number; a1: number;
  colors: number[]; spin: number; len: number;
}

interface Ring { obj: Phaser.GameObjects.Arc; age: number; life: number; r0: number; r1: number }
interface Ghost { img: Phaser.GameObjects.Image; age: number; life: number }
interface Tongue {
  rect: Phaser.GameObjects.Rectangle; tip: Phaser.GameObjects.Rectangle;
  x: number; y: number; ang: number; reach: number; age: number; life: number;
}

export interface TrailShot {
  x: number; y: number; vx: number; vy: number; fx: string; ox: number; oy: number; acc: number; age: number; mul?: number;
}

const rnd = (a: number) => (Math.random() - 0.5) * 2 * a;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const snap = (v: number) => Math.round(v / 2) * 2; // posiciones de 2 px: look pixelado

export class Fx {
  private gfx: Phaser.GameObjects.Graphics;
  private top: Phaser.GameObjects.Graphics; // por encima de los Pokémon: picos, rocas que caen, rayos
  private free: Part[] = [];
  private live: Part[] = [];
  private rings: Ring[] = [];
  private ghosts: Ghost[] = [];
  private tongues: Tongue[] = [];
  private hits: Hit[] = [];
  private decals: { x: number; y: number; r: number; color: number; life: number; age: number }[] = [];
  private floaters: { img: Phaser.GameObjects.Image; vx: number; vy: number; age: number; life: number; spin: number }[] = [];

  constructor(private scene: Phaser.Scene) {
    this.gfx = scene.add.graphics().setDepth(9);
    this.top = scene.add.graphics().setDepth(12);
  }

  /** Borra los rayos del cuadro anterior (se redibujan cada cuadro). */
  beginFrame() {
    this.gfx.clear();
    this.top.clear();
  }

  update(dt: number) {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];
      p.age += dt;
      if (p.age >= p.life) {
        p.obj.setVisible(false);
        this.free.push(p);
        this.live.splice(i, 1);
        continue;
      }
      p.vy += p.g * (dt / 1000);
      p.x += p.vx * (dt / 1000);
      p.y += p.vy * (dt / 1000);
      p.obj.rotation += p.spin * (dt / 1000);
      this.paint(p);
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.age += dt;
      if (r.age >= r.life) { r.obj.destroy(); this.rings.splice(i, 1); continue; }
      const t = r.age / r.life;
      r.obj.setRadius(lerp(r.r0, r.r1, 1 - (1 - t) * (1 - t))).setAlpha(1 - t);
    }
    for (let i = this.ghosts.length - 1; i >= 0; i--) {
      const g = this.ghosts[i];
      g.age += dt;
      if (g.age >= g.life) { g.img.destroy(); this.ghosts.splice(i, 1); continue; }
      g.img.setAlpha(0.55 * (1 - g.age / g.life));
    }
    for (let i = this.tongues.length - 1; i >= 0; i--) {
      const t = this.tongues[i];
      t.age += dt;
      if (t.age >= t.life) { t.rect.destroy(); t.tip.destroy(); this.tongues.splice(i, 1); continue; }
      const k = t.age / t.life;
      const len = t.reach * (k < 0.4 ? k / 0.4 : 1 - (k - 0.4) / 0.6);
      t.rect.setScale(Math.max(0.01, len / 8), 2.1);
      t.tip.setPosition(t.x + Math.cos(t.ang) * len, t.y + Math.sin(t.ang) * len);
    }
    for (let i = this.hits.length - 1; i >= 0; i--) {
      const h = this.hits[i];
      h.age += dt;
      if (h.age >= h.life) { this.hits.splice(i, 1); continue; }
      drawHit(h, this.top, this);
    }
    for (let i = this.decals.length - 1; i >= 0; i--) {
      const d = this.decals[i];
      d.age += dt;
      if (d.age >= d.life) { this.decals.splice(i, 1); continue; }
      const al = 0.55 * (1 - d.age / d.life);
      this.gfx.fillStyle(d.color, al).fillCircle(d.x, d.y, d.r);
      this.gfx.fillStyle(0x7ad14f, al * 0.8).fillCircle(d.x - d.r * 0.3, d.y - d.r * 0.2, d.r * 0.25);
    }
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.age += dt;
      if (f.age >= f.life) { f.img.destroy(); this.floaters.splice(i, 1); continue; }
      f.img.x += f.vx * (dt / 1000); f.img.y += f.vy * (dt / 1000); f.img.rotation += f.spin * (dt / 1000);
      f.img.setAlpha(1 - f.age / f.life);
    }
  }

  private make(): Part {
    const obj = this.scene.add.rectangle(0, 0, 8, 8, 0xffffff).setVisible(false);
    return { obj, x: 0, y: 0, vx: 0, vy: 0, g: 0, life: 1, age: 0, s0: 4, s1: 4, a0: 1, a1: 0, colors: [0xffffff], spin: 0, len: 0 };
  }

  private paint(p: Part) {
    const t = p.age / p.life;
    const size = lerp(p.s0, p.s1, t);
    p.obj.setPosition(snap(p.x), snap(p.y))
      .setScale((p.len || size) / 8, size / 8)
      .setAlpha(lerp(p.a0, p.a1, t))
      .setFillStyle(p.colors[Math.min(p.colors.length - 1, Math.floor(t * p.colors.length))]);
  }

  spawn(x: number, y: number, o: PartOpts) {
    const p = this.free.pop() ?? this.make();
    Object.assign(p, {
      x, y, vx: o.vx ?? 0, vy: o.vy ?? 0, g: o.g ?? 0, life: o.life, age: 0, s0: o.s0, s1: o.s1 ?? o.s0,
      a0: o.a0 ?? 1, a1: o.a1 ?? 0, colors: o.colors, spin: o.spin ?? 0, len: o.len ?? 0,
    });
    p.obj.setVisible(true).setDepth(o.depth ?? 8).setRotation(o.rot ?? 0);
    this.live.push(p);
    this.paint(p);
  }

  ring(x: number, y: number, color: number, r0: number, r1: number, life: number, width = 3) {
    const obj = this.scene.add.circle(x, y, r0, color, 0).setStrokeStyle(width, color).setDepth(9);
    this.rings.push({ obj, age: 0, life, r0, r1 });
  }

  /** Rayo dentado entre dos puntos (se redibuja cada cuadro). */
  bolt(x1: number, y1: number, x2: number, y2: number, w: number) {
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len < 6) return;
    const steps = Math.max(2, Math.floor(len / 22));
    const nx = -(y2 - y1) / len, ny = (x2 - x1) / len;
    const pts = [new Phaser.Math.Vector2(x1, y1)];
    for (let i = 1; i < steps; i++) {
      const t = i / steps, off = rnd(w * 2 + 6);
      pts.push(new Phaser.Math.Vector2(snap(x1 + (x2 - x1) * t + nx * off), snap(y1 + (y2 - y1) * t + ny * off)));
    }
    pts.push(new Phaser.Math.Vector2(x2, y2));
    this.gfx.lineStyle(w + 6, 0xffd23f, 0.45).strokePoints(pts, false);
    this.gfx.lineStyle(w, 0xfff3a8, 1).strokePoints(pts, false);
    this.gfx.lineStyle(Math.max(2, w / 3), 0xffffff, 1).strokePoints(pts, false);
  }

  private rays(x: number, y: number, n: number, len: number, color: number, life = 200) {
    const a0 = Math.random() * Math.PI;
    for (let i = 0; i < n; i++) {
      const a = a0 + (i * Math.PI * 2) / n;
      this.spawn(x + Math.cos(a) * 10, y + Math.sin(a) * 10, {
        vx: Math.cos(a) * 90, vy: Math.sin(a) * 90, life, s0: 4, len, rot: a, colors: [color], a0: 1, a1: 0,
      });
    }
  }

  // ---------- estelas de los proyectiles ----------

  trail(sh: TrailShot, dt: number) {
    const sp = Math.hypot(sh.vx, sh.vy) || 1;
    const dx = sh.vx / sp, dy = sh.vy / sp;
    const { x, y } = sh;
    const k = dt / 16.67;
    const count = (rate: number) => {
      sh.acc += rate * k * (sh.mul ?? 1);
      const n = Math.floor(sh.acc);
      sh.acc -= n;
      return n;
    };
    const every = (ms: number) => Math.floor((sh.age + dt) / ms) !== Math.floor(sh.age / ms);
    const bx = x - dx * 10, by = y - dy * 10; // detrás de la cabeza
    switch (sh.fx) {
      case 'ember':
        for (let i = count(1.3); i > 0; i--)
          this.spawn(bx + rnd(4), by + rnd(4), { vx: rnd(20), vy: -25 + rnd(15), life: 380, s0: 12, s1: 2, colors: FIRE });
        break;
      case 'flame':
        for (let i = count(3.6); i > 0; i--)
          this.spawn(bx + rnd(8), by + rnd(8), { vx: -sh.vx * 0.1 + rnd(40), vy: -30 + rnd(30), life: 580, s0: 16, s1: 40, a0: 0.95, colors: FIRE });
        break;
      case 'water':
        for (let i = count(1.6); i > 0; i--)
          this.spawn(bx + rnd(5), by + rnd(5), { vx: rnd(40), vy: rnd(20), life: 420, s0: 7, s1: 3, g: 260, colors: PAL.water });
        break;
      case 'hydro':
        for (let i = count(4.5); i > 0; i--)
          this.spawn(bx + rnd(10), by + rnd(10), { vx: rnd(55), vy: rnd(40), life: 520, s0: 16, s1: 32, a0: 0.9, g: 120, colors: PAL.water });
        break;
      case 'ice':
        for (let i = count(1.2); i > 0; i--)
          this.spawn(bx + rnd(10), by + rnd(10), { vx: rnd(30), vy: rnd(30), life: 460, s0: 7, s1: 0, spin: 6, colors: PAL.ice });
        if (every(110)) this.spawn(x + rnd(14), y + rnd(14), { life: 280, s0: 12, s1: 0, rot: 0.8, colors: [0xffffff] });
        break;
      case 'leaf':
        for (let i = count(1.1); i > 0; i--)
          this.spawn(bx + rnd(8), by + rnd(8), { vx: rnd(30), vy: rnd(30), life: 340, s0: 6, s1: 2, spin: 8, colors: PAL.leaf });
        break;
      case 'solar':
        for (let i = count(2.4); i > 0; i--)
          this.spawn(bx + rnd(8), by + rnd(8), { vx: rnd(35), vy: rnd(35), life: 420, s0: 14, s1: 2, colors: PAL.sun });
        if (every(130)) this.ring(x, y, 0xffd23f, 8, 34, 340);
        break;
      case 'sludge':
        for (let i = count(1); i > 0; i--)
          this.spawn(bx + rnd(8), by + rnd(8), { vx: rnd(25), vy: rnd(15), life: 520, s0: 10, s1: 4, g: 200, colors: PAL.sludge });
        break;
      case 'spark':
        for (let i = count(1.2); i > 0; i--)
          this.spawn(bx + rnd(6), by + rnd(6), { vx: rnd(60), vy: rnd(60), life: 240, s0: 5, s1: 1, colors: PAL.elec });
        if (every(50)) this.bolt(x - dx * 26 + rnd(6), y - dy * 26 + rnd(6), x, y, 3);
        break;
      case 'bolt':
      case 'thunder': {
        const tail = Math.min(Math.hypot(x - sh.ox, y - sh.oy), sh.fx === 'thunder' ? 340 : 280);
        this.bolt(x - dx * tail, y - dy * tail, x, y, sh.fx === 'thunder' ? 9 : 7);
        if (sh.fx === 'bolt') {   // ramificaciones que salen del rayo
          for (let b = 0; b < 3; b++) {
            const u = Math.random(), bx0 = x - dx * tail * u, by0 = y - dy * tail * u, a = Math.atan2(dy, dx) + (Math.random() < 0.5 ? 1 : -1) * (0.5 + Math.random() * 0.8), l = 30 + Math.random() * 50;
            this.bolt(bx0, by0, bx0 + Math.cos(a) * l, by0 + Math.sin(a) * l, 3);
          }
        }
        for (let i = count(1.5); i > 0; i--) {
          const t = Math.random() * tail;
          this.spawn(x - dx * t + rnd(10), y - dy * t + rnd(10), { vx: rnd(70), vy: rnd(70), life: 220, s0: 5, s1: 1, colors: PAL.elec });
        }
        break;
      }
      case 'psy':
        if (every(95)) this.ring(x, y, 0xff8fcf, 6, 30, 380);
        for (let i = count(0.8); i > 0; i--)
          this.spawn(bx + rnd(8), by + rnd(8), { vx: rnd(25), vy: rnd(25), life: 360, s0: 6, s1: 1, colors: PAL.psy });
        break;
      case 'psychic': {   // orbe con satélites que giran, anillos que laten y una espiral detrás
        if (every(80)) this.ring(x, y, 0xff5cae, 10, 54, 420, 4);
        const a = (sh.age + dt) * 0.014;
        this.gfx.fillStyle(0xff8fcf, 0.28).fillCircle(x, y, 30 + 4 * Math.sin(a * 3));
        for (let q = 0; q < 3; q++) {
          const aa = a + (q * Math.PI * 2) / 3, sx = x + Math.cos(aa) * 34, sy = y + Math.sin(aa) * 34;
          this.gfx.fillStyle(0xffd1ec, 1).fillCircle(sx, sy, 6);
          this.gfx.lineStyle(2, 0xff5cae, 0.6).strokeCircle(sx, sy, 9);
          this.spawn(sx, sy, { life: 240, s0: 7, s1: 1, colors: PAL.psy });
        }
        this.gfx.lineStyle(2, 0xffd1ec, 0.5).strokeCircle(x, y, 34);
        for (let i = count(1.2); i > 0; i--) { const aa = a * -2 + Math.random() * 6.28; this.spawn(bx + Math.cos(aa) * 14, by + Math.sin(aa) * 14, { vx: rnd(20), vy: rnd(20), life: 420, s0: 6, s1: 0, colors: PAL.psy }); }
        break;
      }
      case 'zap':   // rayo finito y débil
        this.bolt(x - dx * Math.min(Math.hypot(x - sh.ox, y - sh.oy), 190), y - dy * Math.min(Math.hypot(x - sh.ox, y - sh.oy), 190), x, y, 3);
        if (every(60)) this.spawn(x + rnd(8), y + rnd(8), { life: 180, s0: 4, s1: 0, colors: PAL.elec });
        break;
      case 'note':   // nota helada que deja copos
        for (let i = count(1.3); i > 0; i--) this.spawn(bx + rnd(8), by + rnd(8), { vx: rnd(30), vy: rnd(30), life: 420, s0: 7, s1: 0, spin: 4, colors: PAL.ice });
        break;
      case 'razor': // hoja muy afilada: destellos blancos cortantes
        this.spawn(x - dx * 16, y - dy * 16, { life: 160, s0: 3, len: 30, rot: Math.atan2(dy, dx), colors: [0xffffff, 0xc8f56a], a0: 0.9 });
        for (let i = count(0.6); i > 0; i--) this.spawn(bx + rnd(6), by + rnd(6), { vx: rnd(30), vy: rnd(30), life: 260, s0: 5, s1: 1, spin: 8, colors: PAL.leaf });
        break;
      case 'blast':  // estrella de fuego que se va agrandando
        for (let i = count(3); i > 0; i--) this.spawn(x + rnd(20), y + rnd(20), { vx: rnd(60), vy: -30 + rnd(40), life: 520, s0: 16, s1: 3, colors: FIRE, a0: 0.95 });
        if (every(110)) this.ring(x, y, 0xff8c1a, 10, 60, 340, 4);
        break;
      case 'cone':   // cono venenoso que gotea
        for (let i = count(1.4); i > 0; i--) this.spawn(bx + rnd(5), by + rnd(5), { vx: rnd(25), vy: 30, g: 300, life: 460, s0: 6, s1: 2, colors: [0xc8ff7a, 0xb45cd6] });
        break;
      case 'toxic':
        for (let i = count(1.8); i > 0; i--) this.spawn(bx + rnd(8), by + rnd(8), { vx: rnd(30), vy: 20, g: 260, life: 560, s0: 10, s1: 3, colors: [0xc8ff7a, 0x8a3fb0, 0x7a2fa0] });
        break;
      case 'sludgebomb':   // bola enorme muy venenosa que deja el suelo corroído
        for (let i = count(2.2); i > 0; i--) this.spawn(bx + rnd(12), by + rnd(12), { vx: rnd(35), vy: 25, g: 280, life: 620, s0: 14, s1: 3, colors: [0xc8ff7a, 0x8a3fb0, 0x7a2fa0] });
        if (every(70)) this.decal(x + rnd(6), y + 12 + rnd(6), 12 + Math.random() * 12, 0x2a4a1a, 2200);
        break;
      case 'tornado': {   // tornado pequeño: embudo de anillos que giran
        const ph = (sh.age + dt) * 0.02;
        for (let i = 0; i < 6; i++) {
          const u = i / 5, rr = 8 + 20 * u, yy = y + 18 - 46 * u, off = Math.sin(ph + i * 1.2) * 4;
          this.gfx.lineStyle(4, i % 2 ? 0xffffff : 0xd8f6ff, 0.55 + 0.4 * u).strokeEllipse(x + off, yy, rr * 2, rr * 0.7);
        }
        this.gfx.fillStyle(0x000000, 0.22).fillEllipse(x, y + 24, 36, 12);
        for (let i = count(1.2); i > 0; i--) { const aa = Math.random() * 6.28; this.spawn(x + Math.cos(aa) * 26, y + 10 + rnd(10), { vx: -Math.sin(aa) * 120, vy: -60, life: 300, s0: 4, s1: 1, colors: PAL.wind }); }
        break;
      }
      case 'tri':    // orbe de tres colores: chispas amarillas, rojas y azules
        for (let i = count(1.8); i > 0; i--) this.spawn(bx + rnd(10), by + rnd(10), { vx: rnd(40), vy: rnd(40), life: 320, s0: 7, s1: 1, colors: [[0xffe135, 0xff4a4a, 0x3d9bff][Math.floor(Math.random() * 3)]] });
        break;
      case 'egg':
        for (let i = count(0.6); i > 0; i--) this.spawn(bx, by, { vx: rnd(20), vy: rnd(20), life: 300, s0: 5, s1: 1, colors: [0xffffff, 0xf4ecd8] });
        break;
      case 'ghost':  // bola sombría envuelta en gas fantasmal
        this.gfx.fillStyle(0x9a6fd0, 0.18).fillCircle(x, y, 44); this.gfx.fillStyle(0xd8c8ff, 0.12).fillCircle(x, y, 30);
        for (let i = count(2.4); i > 0; i--) { const aa = Math.random() * 6.28; this.spawn(x + Math.cos(aa) * 30, y + Math.sin(aa) * 30, { vx: Math.cos(aa) * 20 + rnd(20), vy: -35 + rnd(20), life: 640, s0: 22, s1: 4, a0: 0.55, colors: [0xd8c8ff, 0x9a6fd0, 0x6b3fa0] }); }
        break;
      case 'ancient': // rocas místicas con motas doradas
        this.gfx.lineStyle(2, 0xffd23f, 0.5).strokeCircle(x, y, 20 + 3 * Math.sin((sh.age + dt) * 0.01));
        for (let i = count(1.6); i > 0; i--) this.spawn(x + rnd(14), y + rnd(14), { vx: rnd(20), vy: -30 - Math.random() * 30, life: 520, s0: 5, s1: 0, spin: 3, colors: [0xffd23f, 0xfff3a8, 0xffffff] });
        break;
      case 'fairy':
        for (let i = count(1.6); i > 0; i--)
          this.spawn(bx + rnd(10), by + rnd(10), { vx: rnd(30), vy: rnd(30), life: 520, s0: 8, s1: 0, spin: 4, colors: PAL.fairy });
        if (every(100)) this.ring(x, y, 0xf4a0c0, 6, 28, 340);
        break;
      case 'steel':
        for (let i = count(1.4); i > 0; i--)
          this.spawn(bx + rnd(6), by + rnd(6), { vx: -dx * 60 + rnd(50), vy: -dy * 60 + rnd(50), life: 260, s0: 5, s1: 1, colors: PAL.steel });
        this.spawn(x - dx * 18, y - dy * 18, { life: 140, s0: 4, len: 26, rot: Math.atan2(dy, dx), colors: [0xffffff], a0: 0.8 });
        break;
      case 'earth':
        for (let i = count(1.8); i > 0; i--)
          this.spawn(bx + rnd(8), by + rnd(8), { vx: rnd(60), vy: -40 + rnd(40), life: 560, s0: 10, s1: 4, g: 420, colors: PAL.earth });
        for (let i = count(0.5); i > 0; i--)
          this.spawn(bx, by + 8, { vx: -dx * 20, vy: -10, life: 520, s0: 18, s1: 30, a0: 0.5, colors: [0xc0a070] });
        break;
      case 'rock':
        for (let i = count(1.3); i > 0; i--)
          this.spawn(bx + rnd(6), by + rnd(6), { vx: rnd(60), vy: rnd(40), life: 480, s0: 7, s1: 3, g: 300, spin: 6, colors: PAL.rock });
        break;
      case 'bug':
        for (let i = count(2.2); i > 0; i--)
          this.spawn(x + rnd(18), y + rnd(18), { vx: rnd(140), vy: rnd(140), life: 260, s0: 4, s1: 2, colors: PAL.bug });
        break;
      case 'dark':
        if (every(110)) this.ring(x, y, 0x8a2a40, 8, 36, 400, 4);
        for (let i = count(1.8); i > 0; i--)
          this.spawn(bx + rnd(10), by + rnd(10), { vx: rnd(40), vy: -20 + rnd(30), life: 520, s0: 14, s1: 3, a0: 0.9, colors: PAL.dark });
        break;
      case 'shadow':
        for (let i = count(1.8); i > 0; i--)
          this.spawn(bx + rnd(10), by + rnd(10), { vx: rnd(40), vy: -20 + rnd(30), life: 520, s0: 16, s1: 4, a0: 0.9, colors: PAL.shadow });
        break;
      case 'wind':   // media luna de viento: rayas blancas que se quedan atrás
        for (let i = count(1.4); i > 0; i--)
          this.spawn(bx + rnd(14) * -dy, by + rnd(14) * dx, { vx: -dx * 90, vy: -dy * 90, life: 240, s0: 3, len: 26, rot: Math.atan2(dy, dx), colors: PAL.wind, a0: 0.9 });
        break;
      case 'star':   // estrella que deja un rastro de destellos
        for (let i = count(1.3); i > 0; i--)
          this.spawn(bx + rnd(8), by + rnd(8), { vx: rnd(50), vy: rnd(50), life: 320, s0: 7, s1: 0, spin: 8, colors: PAL.star });
        break;
      case 'bubble': // burbujas que se separan y estallan
        for (let i = count(1.1); i > 0; i--)
          this.spawn(bx + rnd(8), by + rnd(8), { vx: rnd(35), vy: -20 + rnd(25), life: 460, s0: 9, s1: 2, a0: 0.7, colors: [0xbfe6ff, 0x66b8ff] });
        break;
      case 'bone':   // huesito que gira dejando polvo
        for (let i = count(0.8); i > 0; i--)
          this.spawn(bx + rnd(6), by + rnd(6), { vx: rnd(30), vy: rnd(30), life: 360, s0: 6, s1: 2, a0: 0.7, colors: PAL.bone });
        break;
    }
  }

  // ---------- chorros continuos ----------

  /**
   * Chorro que nace en (x1,y1) —la boca del Pokémon— y llega hasta la punta (x2,y2).
   * k (0..1) es cuánto se ha recogido la base al terminar; age son los ms desde el disparo.
   * Se dibuja con bloques de 4 px sobre el gráfico del cuadro, más partículas de agua, llamas o chispas.
   */
  stream(kind: string, x1: number, y1: number, x2: number, y2: number, k: number, age: number, size: number) {
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len < 10) return;
    if (CUSTOM_STREAMS.has(kind)) { this.customStream(kind, x1, y1, x2, y2, k, age, size); return; }
    const dx = (x2 - x1) / len, dy = (y2 - y1) / len, nx = -dy, ny = dx;
    const sx = x1 + (x2 - x1) * k, sy = y1 + (y2 - y1) * k, L = len * (1 - k);
    if (L < 6) return;
    const sc = size / 1.4, fade = 1 - k * 0.7;
    const g = this.gfx;
    const q = (v: number) => Math.max(4, Math.round(v / 4) * 4);
    const at = (u: number, off: number) => ({ x: sx + dx * L * u + nx * off, y: sy + dy * L * u + ny * off });

    // [multiplicador de ancho, color, opacidad] de fuera hacia dentro
    const layers: [number, number, number][] =
      kind === 'hydro' ? [[1, 0x2f7fe0, 0.95], [0.78, 0x66b8ff, 1], [0.5, 0xbfe6ff, 1], [0.2, 0xffffff, 1]]
      : kind === 'flame' ? [[1, 0xd9411e, 0.9], [0.78, 0xff8c1a, 1], [0.52, 0xffd23f, 1], [0.26, 0xfff3a8, 1]]
      : kind === 'blizzard' ? [[1, 0x4aa3c7, 0.92], [0.78, 0x8ae6ff, 1], [0.52, 0xd8f6ff, 1], [0.26, 0xffffff, 1]]
      : kind === 'dragon' ? [[1, 0x3a2a8a, 0.92], [0.78, 0x7a45f8, 1], [0.52, 0xb08cff, 1], [0.26, 0xffffff, 1]]
      : [[1.35, 0xa6e64a, 0.35], [1, 0xffd23f, 0.95], [0.62, 0xfff3a8, 1], [0.3, 0xffffff, 1]];

    const n = Math.max(2, Math.floor(L / 6));
    // Primero se calculan los bloques del cuerpo; luego se pinta capa por capa (de fuera hacia dentro),
    // para que el centro claro no quede tapado por el borde del bloque siguiente.
    const blocks: { x: number; y: number; w: number; f: number }[] = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n, p = k + u * (1 - k); // p: posición a lo largo de todo el chorro (0 = boca)
      let w: number, off = 0, rise = 0;
      if (kind === 'hydro') { w = (34 + 64 * Math.pow(p, 0.7)) * sc; off = Math.sin(age * 0.018 + p * 9) * 5; }
      else if (kind === 'flame') { w = (22 + 86 * Math.pow(p, 0.8)) * sc; off = rnd(5); rise = p * 10; }
      else if (kind === 'blizzard') { w = (30 + 74 * Math.pow(p, 0.75)) * sc; off = Math.sin(age * 0.016 + p * 10) * 7; }
      else if (kind === 'dragon') { w = (26 + 80 * Math.pow(p, 0.8)) * sc; off = Math.sin(age * 0.02 + p * 11) * 6 + rnd(3); }
      else { w = (62 + 8 * Math.sin(age * 0.03 + p * 8)) * sc; }
      const c = at(u, off);
      blocks.push({ x: c.x, y: c.y - rise, w, f: 0.9 + Math.random() * 0.2 });
    }
    for (const [mul, color, a] of layers) {
      g.fillStyle(color, a * fade);
      for (const b of blocks) {
        const ww = q(b.w * mul * b.f);
        g.fillRect(q(b.x - ww / 2), q(b.y - ww / 2), ww, ww);
      }
    }
    const last = { w: blocks[blocks.length - 1].w };

    // punta y partículas
    const tip = { x: x2, y: y2 };
    if (kind === 'hydro') {
      // la punta revienta en una nube de espuma de bloques de distinto tamaño
      for (let i = 0; i < 7; i++) {
        const bw = q(last.w * (0.25 + Math.random() * 0.35));
        const colr = [0xbfe6ff, 0xffffff, 0x66b8ff][i % 3];
        g.fillStyle(colr, 0.95 * fade).fillRect(q(tip.x + rnd(last.w * 0.55) - bw / 2), q(tip.y + rnd(last.w * 0.55) - bw / 2), bw, bw);
      }
      for (let i = 0; i < 4; i++) {
        const c = at(Math.random(), rnd(14));
        this.spawn(c.x, c.y, { vx: nx * rnd(90) + dx * 30, vy: ny * rnd(90) + dy * 30, life: 420, s0: 10, s1: 2, g: 240, colors: PAL.water });
      }
      for (let i = 0; i < 3; i++)
        this.spawn(tip.x + rnd(10), tip.y + rnd(10), { vx: dx * 80 + rnd(110), vy: dy * 80 + rnd(110), life: 460, s0: 18, s1: 4, g: 160, colors: PAL.water });
    } else if (kind === 'flame') {
      for (let i = 0; i < 6; i++) {
        const c = at(Math.random(), rnd(18));
        this.spawn(c.x, c.y, { vx: rnd(50), vy: -40 + rnd(40), life: 480, s0: 16, s1: 2, colors: FIRE, a0: 0.95 });
      }
      this.spawn(tip.x + rnd(14), tip.y + rnd(14), { vx: dx * 70 + rnd(60), vy: -30 + rnd(40), life: 520, s0: 30, s1: 6, colors: FIRE, a0: 0.9 });
    } else if (kind === 'blizzard') {
      for (let i = 0; i < 6; i++) { // nieve y cristales que se desprenden del chorro
        const c = at(Math.random(), rnd(24));
        this.spawn(c.x, c.y, { vx: rnd(70), vy: rnd(40) + 20, life: 520, s0: 8, s1: 0, g: 80, spin: 5, colors: PAL.ice });
      }
      this.spawn(tip.x + rnd(14), tip.y + rnd(14), { vx: dx * 60 + rnd(70), vy: rnd(70), life: 500, s0: 24, s1: 4, colors: PAL.ice, a0: 0.9 });
      if (Math.floor((age + 16) / 150) !== Math.floor(age / 150)) this.ring(tip.x, tip.y, 0xd8f6ff, 10, 48, 320);
    } else if (kind === 'dragon') {
      for (let i = 0; i < 6; i++) {
        const c = at(Math.random(), rnd(18));
        this.spawn(c.x, c.y, { vx: rnd(60), vy: rnd(60), life: 480, s0: 14, s1: 2, colors: PAL.dragon, a0: 0.95 });
      }
      this.spawn(tip.x + rnd(14), tip.y + rnd(14), { vx: dx * 70 + rnd(60), vy: rnd(60), life: 520, s0: 30, s1: 6, colors: PAL.dragon, a0: 0.9 });
      if (Math.floor((age + 16) / 160) !== Math.floor(age / 160)) this.ring(tip.x, tip.y, 0x7a45f8, 10, 50, 340);
    } else {
      g.fillStyle(0xffd23f, 0.5 * fade).fillCircle(x1, y1, 26 + 4 * Math.sin(age * 0.04));
      g.fillStyle(0xffffff, 0.8 * fade).fillCircle(x1, y1, 14);
      g.fillStyle(0xfff3a8, 0.9 * fade).fillCircle(tip.x, tip.y, 26 + 5 * Math.sin(age * 0.05));
      g.fillStyle(0xffffff, fade).fillCircle(tip.x, tip.y, 14);
      for (let i = 0; i < 3; i++) {
        const c = at(Math.random(), rnd(26));
        this.spawn(c.x, c.y, { vx: rnd(80), vy: rnd(80), life: 380, s0: 8, s1: 0, spin: 6, colors: PAL.sun });
      }
      if (Math.floor((age + 16) / 140) !== Math.floor(age / 140)) this.ring(tip.x, tip.y, 0xffd23f, 10, 46, 320);
    }
  }

  // ---------- impactos ----------

  impact(fx: string, x: number, y: number, ang: number, power = 60) {
    const pal = PAL[PAL_OF[fx] ?? 'hit'];
    const burst = (n: number, sp: number, s0: number, s1: number, life: number, g = 0, spin = 0) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, v = sp * (0.4 + Math.random() * 0.8);
        this.spawn(x, y, { vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: life * (0.7 + Math.random() * 0.6), s0, s1, g, spin, colors: pal });
      }
    };
    // destello central: da peso al golpe antes de que se abran las partículas
    this.spawn(x, y, { life: 150, s0: 36, s1: 8, rot: Math.PI / 4, colors: [0xffffff, pal[Math.min(1, pal.length - 1)]], a0: 0.95 });
    switch (IMPACT_ALIAS[fx] ?? fx) {
      case 'ember': burst(9, 150, 10, 2, 450, -80); this.ring(x, y, 0xff8c1a, 6, 34, 260); break;
      case 'flame':
        burst(18, 230, 16, 3, 620, -120); this.ring(x, y, 0xff8c1a, 10, 58, 340); this.ring(x, y, 0xffd23f, 6, 38, 260); break;
      case 'water': burst(10, 190, 7, 2, 500, 420); this.ring(x, y, 0x8fd0ff, 6, 32, 240); break;
      case 'hydro':
        burst(20, 270, 10, 2, 620, 520); this.ring(x, y, 0xbfe6ff, 10, 62, 340); this.ring(x, y, 0x3d9bff, 6, 42, 280); break;
      case 'ice': burst(12, 210, 8, 0, 520, 200, 12); this.rays(x, y, 6, 30, 0xd8f6ff); this.ring(x, y, 0xd8f6ff, 6, 40, 260); break;
      case 'leaf': burst(11, 170, 8, 2, 540, 140, 10); break;
      case 'solar':
        this.rays(x, y, 12, 44, 0xfff3a8, 260); burst(14, 250, 10, 2, 520);
        this.ring(x, y, 0xffd23f, 10, 74, 380); this.ring(x, y, 0xffffff, 4, 44, 280); break;
      case 'sludge': burst(13, 170, 10, 3, 580, 380); this.ring(x, y, 0xb45cd6, 6, 38, 280); break;
      case 'spark': this.rays(x, y, 6, 28, 0xffe135); burst(6, 150, 5, 1, 300); break;
      case 'bolt': this.rays(x, y, 8, 42, 0xfff3a8); burst(8, 190, 6, 1, 320); this.ring(x, y, 0xffe135, 6, 42, 240); break;
      case 'thunder':
        this.rays(x, y, 12, 58, 0xffffff, 240); burst(14, 250, 8, 1, 420);
        this.ring(x, y, 0xffffff, 10, 84, 320); this.ring(x, y, 0xffe135, 6, 56, 260); break;
      case 'psy': this.ring(x, y, 0xff8fcf, 6, 40, 360); this.ring(x, y, 0xffd1ec, 3, 26, 300); burst(8, 120, 6, 1, 420); break;
      case 'psychic':
        this.ring(x, y, 0xff5cae, 8, 58, 420, 4); this.ring(x, y, 0xffd1ec, 4, 40, 340); this.ring(x, y, 0xb43f8a, 2, 26, 280);
        burst(12, 170, 8, 1, 540); break;
      case 'shadow': burst(12, 130, 14, 4, 660, -20); this.ring(x, y, 0x6b3fa0, 8, 46, 360); break;
      case 'blizzard':
        this.rays(x, y, 10, 44, 0xd8f6ff, 240); burst(18, 220, 10, 0, 600, 140, 8);
        this.ring(x, y, 0xd8f6ff, 10, 66, 360); this.ring(x, y, 0x8ae6ff, 6, 44, 280); break;
      case 'fairy':
        this.rays(x, y, 8, 26, 0xffd1ec); burst(12, 170, 9, 0, 560, -40, 5);
        this.ring(x, y, 0xf4a0c0, 8, 52, 380); this.ring(x, y, 0xffffff, 4, 32, 300); break;
      case 'punch':
        this.rays(x, y, 10, 40, 0xffd23f, 240); burst(8, 190, 8, 1, 360);
        this.ring(x, y, 0xff8c1a, 8, 52, 280); this.ring(x, y, 0xffffff, 3, 30, 220); break;
      case 'steel':
        this.rays(x, y, 12, 46, 0xd8dcea, 260); burst(10, 230, 6, 1, 360);
        this.ring(x, y, 0xaab0c8, 8, 48, 300); break;
      case 'earth': burst(16, 200, 12, 3, 640, 520); this.ring(x, y, 0xc09a5a, 10, 58, 360); break;
      case 'rock': burst(14, 210, 10, 3, 600, 560, 8); this.rays(x, y, 6, 30, 0xd0d4de); this.ring(x, y, 0xa0a6b4, 8, 44, 300); break;
      case 'bug': burst(14, 150, 6, 1, 420); this.ring(x, y, 0xc8e038, 6, 38, 280); break;
      case 'dark': burst(14, 140, 14, 3, 640, -20); this.ring(x, y, 0x8a2a40, 8, 56, 380, 4); this.ring(x, y, 0x1a1020, 4, 38, 300); break;
      case 'dragon':
        this.rays(x, y, 12, 50, 0xb08cff, 260); burst(16, 250, 14, 2, 600);
        this.ring(x, y, 0x7a45f8, 10, 70, 380); this.ring(x, y, 0xffffff, 4, 42, 280); break;
      case 'wing': this.slash(x, y, ang, 0xe8f6ff, 46); this.rays(x, y, 8, 30, 0xffffff); break;
      case 'lick': this.rays(x, y, 6, 24, 0xff9fc0); burst(6, 120, 6, 1, 320); break;
      case 'wind': this.slash(x, y, ang, 0xd8f6ff, 44); this.rays(x, y, 6, 28, 0xffffff); burst(6, 150, 5, 1, 320); break;
      case 'star': this.rays(x, y, 8, 30, 0xfff3a8); burst(10, 180, 7, 0, 420, 0, 8); break;
      case 'bubble': burst(8, 150, 8, 2, 440, 200); this.ring(x, y, 0xbfe6ff, 6, 30, 260); break;
      case 'bone': burst(10, 170, 7, 2, 460, 420, 8); this.ring(x, y, 0xc9bfa0, 6, 34, 260); break;
      default: this.rays(x, y, 8, 36, 0xffffff); burst(8, 160, 8, 1, 380); this.ring(x, y, 0xffffff, 6, 44, 240); break;
    }
    // Cuanto más poder, más grande el impacto: más partículas, más anillos y rayos más largos.
    const lv = power >= 100 ? 3 : power >= 80 ? 2 : power >= 55 ? 1 : 0;
    if (lv >= 1) burst(4 + lv * 3, 150 + lv * 40, 8 + lv * 2, 1, 480);
    if (lv >= 2) { this.ring(x, y, pal[1] ?? pal[0], 10, 50 + lv * 14, 340, 4); this.rays(x, y, 8, 34 + lv * 10, pal[0], 240); }
    if (lv >= 3) {
      this.ring(x, y, pal[0], 6, 120, 420, 5);
      this.spawn(x, y, { life: 220, s0: 70, s1: 10, rot: Math.PI / 4, colors: [0xffffff, pal[1] ?? pal[0]], a0: 0.8 });
    }
  }

  // ---------- aura de los ataques de contacto ----------

  /** Efecto alrededor de quien embiste, según el tipo del ataque; crece con el poder (poder 40 = discreto, 120 = enorme). */
  aura(fx: string, x: number, y: number, power: number, dt: number) {
    const sc = 0.7 + power / 70;
    const k = dt / 16.67;
    const n = (rate: number) => Math.floor(rate * sc * k + Math.random());
    const around = (r: number) => { const a = Math.random() * Math.PI * 2; return { x: x + Math.cos(a) * r, y: y + Math.sin(a) * r * 0.8, a }; };
    const key = PAL_OF[fx] ?? 'hit';
    // halo del color del tipo: casi invisible con poder bajo y bien marcado con poder alto
    this.gfx.fillStyle((PAL[key] ?? PAL.hit)[1] ?? 0xffffff, Math.min(0.32, 0.07 * sc)).fillCircle(x, y, 32 + sc * 10);
    switch (key) {
      case 'fire':
        for (let i = n(1.9); i > 0; i--) this.spawn(x + rnd(30), y + 10 + rnd(16), { vx: rnd(36), vy: -80 - Math.random() * 80, life: 420, s0: 14 + sc * 4, s1: 2, colors: FIRE, a0: 0.95 });
        break;
      case 'elec':
        for (let i = n(0.5); i > 0; i--) { const p = around(34 + sc * 8); this.bolt(x + rnd(10), y + rnd(10), p.x, p.y, 2 + Math.floor(sc)); }
        for (let i = n(0.8); i > 0; i--) { const p = around(30); this.spawn(p.x, p.y, { vx: rnd(60), vy: rnd(60), life: 220, s0: 5, s1: 1, colors: PAL.elec }); }
        break;
      case 'water':
        for (let i = n(1); i > 0; i--) { const p = around(32); this.spawn(p.x, p.y, { vx: Math.cos(p.a + 1.6) * 90, vy: Math.sin(p.a + 1.6) * 90 - 40, life: 420, s0: 8, s1: 2, g: 200, colors: PAL.water }); }
        break;
      case 'leaf':
        for (let i = n(0.9); i > 0; i--) { const p = around(30); this.spawn(p.x, p.y, { vx: Math.cos(p.a) * 80, vy: Math.sin(p.a) * 80 - 20, life: 450, s0: 7, s1: 2, spin: 9, colors: PAL.leaf }); }
        break;
      case 'ice':
        for (let i = n(0.8); i > 0; i--) { const p = around(32); this.spawn(p.x, p.y, { vx: rnd(40), vy: rnd(40), life: 450, s0: 9, s1: 0, spin: 6, colors: PAL.ice }); }
        this.gfx.lineStyle(2, 0xd8f6ff, 0.5).strokeCircle(x, y + 4, 38 + sc * 4);
        break;
      case 'psy':
        for (let i = n(0.5); i > 0; i--) this.ring(x, y, 0xff8fcf, 18, 46 + sc * 6, 320);
        for (let i = n(0.8); i > 0; i--) { const p = around(34); this.spawn(p.x, p.y, { vx: rnd(30), vy: -40, life: 360, s0: 6, s1: 1, colors: PAL.psy }); }
        break;
      case 'shadow':
      case 'dark':
        for (let i = n(1); i > 0; i--) this.spawn(x + rnd(24), y + rnd(16), { vx: rnd(30), vy: -50 - Math.random() * 30, life: 480, s0: 14, s1: 3, a0: 0.9, colors: PAL[key] });
        break;
      case 'sludge':
        for (let i = n(0.8); i > 0; i--) this.spawn(x + rnd(24), y + 14 + rnd(10), { vx: rnd(20), vy: -60, life: 480, s0: 9, s1: 3, colors: PAL.sludge });
        break;
      case 'bug':
        for (let i = n(1.2); i > 0; i--) { const p = around(30 + Math.random() * 14); this.spawn(p.x, p.y, { vx: rnd(120), vy: rnd(120), life: 240, s0: 4, s1: 2, colors: PAL.bug }); }
        break;
      case 'earth':
      case 'rock':
        for (let i = n(1); i > 0; i--) this.spawn(x + rnd(24), y + 22, { vx: rnd(90), vy: -120 - Math.random() * 90, life: 460, s0: 8, s1: 4, g: 700, spin: 5, colors: PAL[key] });
        break;
      case 'steel':
        for (let i = n(0.9); i > 0; i--) { const p = around(32); this.spawn(p.x, p.y, { life: 160, s0: 3, len: 14 + sc * 4, rot: Math.random() * 3, colors: [0xffffff], a0: 0.9 }); }
        break;
      case 'punch':   // golpes de lucha: chispas naranjas
        for (let i = n(1); i > 0; i--) { const p = around(30); this.spawn(p.x, p.y, { vx: Math.cos(p.a) * 140, vy: Math.sin(p.a) * 140, life: 220, s0: 6, s1: 1, colors: PAL.punch }); }
        break;
      case 'wind':
      case 'hit':   // aire: rayas que rodean al Pokémon
        for (let i = n(1); i > 0; i--) { const p = around(34); this.spawn(p.x, p.y, { vx: Math.cos(p.a + 1.6) * 160, vy: Math.sin(p.a + 1.6) * 160, life: 220, s0: 3, len: 22, rot: p.a + 1.6, colors: [0xffffff, 0xd8f6ff], a0: 0.85 }); }
        break;
      case 'fairy':
      case 'star':
        for (let i = n(1); i > 0; i--) { const p = around(32); this.spawn(p.x, p.y, { vx: rnd(30), vy: -30 - Math.random() * 30, life: 420, s0: 7, s1: 0, spin: 5, colors: PAL[key] }); }
        break;
      case 'dragon':
        for (let i = n(1); i > 0; i--) this.spawn(x + rnd(24), y + 8 + rnd(14), { vx: rnd(40), vy: -60 - Math.random() * 50, life: 420, s0: 13, s1: 2, colors: PAL.dragon, a0: 0.95 });
        break;
      default:
        for (let i = n(0.8); i > 0; i--) { const p = around(32); this.spawn(p.x, p.y, { vx: rnd(40), vy: rnd(40), life: 260, s0: 6, s1: 1, colors: PAL.hit }); }
    }
  }

  /** Destello en la boca del Pokémon al lanzar un proyectil: más grande cuanto más poder tiene el ataque. */
  muzzle(fx: string, x: number, y: number, dx: number, dy: number, power: number) {
    const pal = PAL[PAL_OF[fx] ?? 'hit'];
    const sc = powerScale(power), a0 = Math.atan2(dy, dx);
    const n = Math.round(4 + Math.max(0, power - 40) / 8);
    for (let i = 0; i < n; i++) {
      const a = a0 + rnd(0.45), v = 140 + Math.random() * 160;
      this.spawn(x, y, { vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 260, s0: 8 * sc, s1: 1, colors: pal });
    }
    if (power >= 80) this.ring(x, y, pal[1] ?? pal[0], 8, 34 * sc, 260);
  }

  /** Partículas que suben (mejoras de stats). */
  rise(x: number, y: number, color: number, n: number) {
    for (let i = 0; i < n; i++)
      this.spawn(x + rnd(26), y + 20 + rnd(10), { vx: rnd(14), vy: -90 - Math.random() * 60, life: 700, s0: 8, s1: 2, a0: 0.95, colors: [0xffffff, color] });
  }

  // ---------- ataques de área ----------

  /** Dibuja un ataque de área en su instante actual (a.t) y suelta sus partículas. */
  area(a: Area, dt: number) {
    const sc = powerScale(a.power);
    switch (a.kind) {
      case 'ground': this.quake(a, sc, dt); break;
      case 'spikes': this.spikes(a, sc); break;
      case 'rain': this.rockRain(a, sc); break;
      case 'nova': this.nova(a, sc, dt); break;
      case 'strike': this.strike(a); break;
      case 'wave': this.wave(a, sc, dt); break;
      case 'storm': this.storm(a, sc, dt); break;
    }
  }

  private crossed(a: Area, ms: number) { return a.lastT < ms && a.t >= ms; }

  /** Terremoto: una grieta avanza por el suelo lanzando tierra, y luego el suelo se recompone. */
  private quake(a: Area, sc: number, dt: number) {
    const g = this.gfx, t = a.t, rng = seeded(a.seed);
    const front = Math.min(a.range, (t * a.speed) / 1000);
    const step = 26, n = Math.floor((a.range - 40) / step);
    const nx = -a.dy, ny = a.dx;
    const offs: number[] = [], branch: { ang: number; len: number }[] = [];
    for (let i = 0; i <= n; i++) { offs.push((rng() - 0.5) * 20); branch.push({ ang: (rng() < 0.5 ? 1 : -1) * (0.45 + rng() * 0.55), len: (30 + rng() * 55) * sc }); }
    const P = (i: number) => ({ x: a.ox + a.dx * (40 + i * step) + nx * offs[i], y: a.oy + a.dy * (40 + i * step) + ny * offs[i] });
    const heading = Math.atan2(a.dy, a.dx);
    for (let i = 1; i <= n; i++) {
      const u = 40 + i * step;
      if (u > front) break;
      const age = t - (u / a.speed) * 1000;
      const alpha = 1 - Phaser.Math.Clamp((age - 250) / 600, 0, 1);   // el suelo se recompone rápido
      if (alpha <= 0) continue;
      const p0 = P(i - 1), p1 = P(i), w = (5 + 3 * (1 - u / a.range)) * sc;
      g.lineStyle(w + 5, 0xd8b878, alpha * 0.8).lineBetween(p0.x, p0.y, p1.x, p1.y);
      g.lineStyle(w, 0x2a190a, alpha).lineBetween(p0.x, p0.y, p1.x, p1.y);
      if (i % 3 === 1) {
        const ang = heading + branch[i].ang, bl = branch[i].len * Math.min(1, age / 220);
        const ex = p1.x + Math.cos(ang) * bl, ey = p1.y + Math.sin(ang) * bl;
        g.lineStyle(w * 0.6 + 4, 0xd8b878, alpha * 0.7).lineBetween(p1.x, p1.y, ex, ey);
        g.lineStyle(w * 0.6, 0x2a190a, alpha).lineBetween(p1.x, p1.y, ex, ey);
      }
    }
    if (t > 0 && front < a.range) {
      const k = dt / 16.67, fx0 = a.ox + a.dx * front, fy0 = a.oy + a.dy * front;
      for (let i = Math.floor(2.4 * sc * k + Math.random()); i > 0; i--)   // tierra que salta del frente
        this.spawn(fx0 + nx * rnd(20), fy0 + ny * rnd(20), { vx: nx * rnd(150) + a.dx * 40, vy: -190 - Math.random() * 190, g: 1000, life: 520, s0: 9 * sc, s1: 5, colors: PAL.earth });
      for (let i = Math.floor(0.8 * k + Math.random()); i > 0; i--)
        this.spawn(fx0 + rnd(10), fy0 + rnd(10), { vx: rnd(40), vy: -20, life: 520, s0: 16, s1: 34, a0: 0.45, colors: [0xc0a070, 0xa08050] });
      for (let i = Math.floor(1.2 * k + Math.random()); i > 0; i--) {   // guijarros que saltan sobre la grieta ya abierta
        const u = 40 + Math.random() * Math.max(10, front - 40);
        this.spawn(a.ox + a.dx * u + nx * rnd(14), a.oy + a.dy * u + ny * rnd(14), { vx: rnd(40), vy: -110 - Math.random() * 70, g: 900, life: 420, s0: 6, s1: 3, colors: PAL.earth });
      }
    }
  }

  /** Avalancha: sombras en el suelo avisan y luego caen las rocas. */
  private rockRain(a: Area, sc: number) {
    const g = this.gfx, top = this.top;
    a.zones.forEach((z) => {
      const land = z.t0, t = a.t;
      if (t < land) {
        const k = t / land, rad = z.r * (0.4 + 0.5 * k);
        g.fillStyle(0x000000, 0.18 + 0.28 * k).fillEllipse(z.x, z.y + 6, rad * 2, rad * 1.1);
      }
      if (t > land - 190 && t < land) {
        const k = (t - (land - 190)) / 190, ry = z.y - 22 - 280 * (1 - k * k), rr = 20 * sc;
        top.fillStyle(0x555a66, 1).fillCircle(z.x, ry, rr);
        top.fillStyle(0x7a808c, 1).fillCircle(z.x - rr * 0.25, ry - rr * 0.25, rr * 0.7);
        top.fillStyle(0xc0c6d0, 1).fillCircle(z.x - rr * 0.4, ry - rr * 0.45, rr * 0.28);
      }
      if (this.crossed(a, land)) {
        for (let i = 0; i < 9; i++) this.spawn(z.x + rnd(10), z.y - 6, { vx: rnd(190), vy: -170 - Math.random() * 150, g: 950, life: 520, s0: 9 * sc, s1: 3, spin: 7, colors: PAL.rock });
        this.ring(z.x, z.y, 0xa0a6b4, 8, 56 * sc, 320, 4);
        this.spawn(z.x, z.y, { life: 500, s0: 20, s1: 50, a0: 0.4, colors: [0xc0a070] });
      }
      if (t >= land && t < land + 480) {   // escombros que se quedan un instante
        const al = 1 - (t - land) / 480;
        for (const [ox, oy, s] of [[-12, 4, 8], [10, 8, 10], [2, -6, 7]] as [number, number, number][])
          g.fillStyle(0x7a808c, al).fillRect(z.x + ox * sc, z.y + oy, s * sc, s * sc);
      }
    });
  }

  /** Onda expansiva que sale del Pokémon en todas direcciones hasta su alcance; cada tipo se ve distinto. */
  private nova(a: Area, sc: number, dt: number) {
    const g = this.gfx, dur = (a.range / a.speed) * 1000;
    const p = Math.min(1, a.t / dur), f = a.range * (1 - (1 - p) * (1 - p));
    const al = 1 - p * p, k = dt / 16.67;
    if (a.t > dur + 100) return;
    if (this.novaSpecial(a, f, al, sc, dt)) return;
    const ring = (r: number, w: number, color: number, alpha: number) => {
      if (r > 4) g.lineStyle(w, color, alpha * al).strokeCircle(a.ox, a.oy, r);
    };
    const onRing = (spread = 0) => { const an = Math.random() * Math.PI * 2, r = f + rnd(spread); return { x: a.ox + Math.cos(an) * r, y: a.oy + Math.sin(an) * r * 0.9, an }; };
    const cnt = (rate: number) => Math.floor(rate * sc * k + Math.random());
    switch (PAL_OF[a.fx] ?? 'hit') {
      case 'water':
        ring(f, 18 * sc, 0x2f7fe0, 0.55); ring(f, 11 * sc, 0x66b8ff, 0.8); ring(f - 6, 4, 0xffffff, 0.9);
        for (let i = cnt(5); i > 0; i--) { const q = onRing(10); this.spawn(q.x, q.y, { vx: Math.cos(q.an) * 70, vy: Math.sin(q.an) * 70 - 40, g: 300, life: 440, s0: 10, s1: 3, colors: PAL.water }); }
        break;
      case 'fire':
        ring(f, 12 * sc, 0xd9411e, 0.6); ring(f - 4, 6, 0xffd23f, 0.85);
        for (let i = cnt(7); i > 0; i--) { const q = onRing(8); this.spawn(q.x, q.y, { vx: Math.cos(q.an) * 40, vy: -60 + rnd(20), life: 480, s0: 18, s1: 2, colors: FIRE, a0: 0.95 }); }
        break;
      case 'ice':
        ring(f, 9 * sc, 0x8ae6ff, 0.8); ring(f, 3, 0xffffff, 1);
        for (let i = cnt(4); i > 0; i--) { const q = onRing(10); this.spawn(q.x, q.y, { vx: Math.cos(q.an) * 40, vy: Math.sin(q.an) * 40, life: 520, s0: 11, s1: 0, spin: 6, colors: PAL.ice }); }
        break;
      case 'leaf':   // espiral de pétalos
        ring(f, 4, 0x6fd14f, 0.4);
        for (let i = cnt(4); i > 0; i--) {
          const an = a.t * 0.016 + (i * Math.PI) / 2, v = a.range / 0.7;
          this.spawn(a.ox, a.oy, { vx: Math.cos(an) * v, vy: Math.sin(an) * v, life: 700, s0: 11, s1: 3, spin: 10, colors: PAL.leaf });
        }
        break;
      case 'bug':    // ondas de zumbido
        for (let q = 0; q < 3; q++) ring(f - q * 26, 5 - q, q ? 0xe8f4a0 : 0xc8e038, 0.9 - q * 0.25);
        for (let i = cnt(3); i > 0; i--) { const q = onRing(24); this.spawn(q.x, q.y, { vx: rnd(120), vy: rnd(120), life: 240, s0: 4, s1: 2, colors: PAL.bug }); }
        break;
      case 'fairy':  // anillo de luz con rayos
        ring(f, 9 * sc, 0xffd1ec, 0.8); ring(f - 8, 3, 0xffffff, 1);
        for (let r = 0; r < 12; r++) {
          const an = (r * Math.PI) / 6 + a.t * 0.002;
          g.lineStyle(3, 0xffffff, 0.3 * al).lineBetween(a.ox + Math.cos(an) * f * 0.2, a.oy + Math.sin(an) * f * 0.2, a.ox + Math.cos(an) * f * 0.95, a.oy + Math.sin(an) * f * 0.95);
        }
        for (let i = cnt(4); i > 0; i--) { const q = onRing(12); this.spawn(q.x, q.y, { vx: rnd(30), vy: -30, life: 440, s0: 8, s1: 0, spin: 5, colors: PAL.fairy }); }
        break;
      case 'psy':
        for (let q = 0; q < 3; q++) ring(f - q * 24, 6 - q, q ? 0xff8fcf : 0xff5cae, 0.9 - q * 0.2);
        break;
      case 'dragon':
        ring(f, 12 * sc, 0x3a2a8a, 0.6); ring(f - 4, 6, 0xb08cff, 0.9);
        for (let i = cnt(6); i > 0; i--) { const q = onRing(8); this.spawn(q.x, q.y, { vx: Math.cos(q.an) * 40, vy: -40 + rnd(20), life: 460, s0: 15, s1: 2, colors: PAL.dragon, a0: 0.95 }); }
        break;
      case 'shadow':
      case 'dark':
        ring(f, 18 * sc, 0x1a1020, 0.6); ring(f, 6, 0x8a2a40, 0.9);
        for (let i = cnt(4); i > 0; i--) { const q = onRing(10); this.spawn(q.x, q.y, { vx: rnd(30), vy: -40, life: 520, s0: 14, s1: 3, a0: 0.9, colors: PAL.dark }); }
        break;
      case 'elec':
        for (let r = 0; r < 7; r++) {
          const an = (r * Math.PI * 2) / 7 + (a.seed % 7);
          this.bolt(a.ox, a.oy, a.ox + Math.cos(an) * f, a.oy + Math.sin(an) * f * 0.9, 4);
        }
        break;
      case 'wind':   // remolino de rayas
        ring(f, 5, 0xffffff, 0.5);
        for (let i = cnt(5); i > 0; i--) { const q = onRing(14); this.spawn(q.x, q.y, { vx: Math.cos(q.an + 1.5) * 200, vy: Math.sin(q.an + 1.5) * 200, life: 240, s0: 3, len: 26, rot: q.an + 1.5, colors: PAL.wind, a0: 0.9 }); }
        break;
      default:
        ring(f, 10 * sc, 0xffffff, 0.7); ring(f - 6, 4, 0xffd23f, 0.8);
    }
  }

  /** Trueno: un círculo avisa dónde caerá el rayo; luego cae desde el cielo. */
  private strike(a: Area) {
    const z = a.zones[0], g = this.gfx, t = a.t, at0 = z.t0;
    if (t < at0) {
      const k = t / at0, rad = 84 - 54 * k;
      g.lineStyle(3, 0xffe135, 0.9).strokeCircle(z.x, z.y, rad);
      g.lineStyle(2, 0xffffff, 0.6).strokeCircle(z.x, z.y, rad * 0.55);
      g.lineStyle(2, k * at0 > a.trackUntil ? 0xff6b6b : 0xffe135, 0.45).strokeCircle(z.x, z.y, z.r);   // se pone roja cuando ya no sigue al rival
      g.fillStyle(0xffe135, 0.05 + 0.12 * k).fillCircle(z.x, z.y, z.r);
      if (Math.random() < 0.3) this.spawn(z.x + rnd(z.r), z.y + rnd(z.r * 0.6), { vy: -40, life: 260, s0: 5, s1: 1, colors: PAL.elec });
    }
    if (this.crossed(a, at0)) {
      this.ring(z.x, z.y, 0xffffff, 10, 90, 360, 5);
      this.ring(z.x, z.y, 0xffe135, 6, 64, 300);
      this.rays(z.x, z.y, 12, 60, 0xffffff, 240);
      for (let i = 0; i < 14; i++) { const an = Math.random() * Math.PI * 2, v = 120 + Math.random() * 180; this.spawn(z.x, z.y, { vx: Math.cos(an) * v, vy: Math.sin(an) * v, life: 380, s0: 7, s1: 1, colors: PAL.elec }); }
    }
    if (t >= at0 && t < at0 + 240) {
      const k = (t - at0) / 240;
      this.top.fillStyle(0xffffff, 0.4 * (1 - k)).fillRect(z.x - 28, z.y - 480, 56, 480);
      this.bolt(z.x + rnd(16), z.y - 480, z.x, z.y, 12);
    }
    if (t >= at0) g.fillStyle(0x1a1008, 0.32 * (1 - Phaser.Math.Clamp((t - at0) / 700, 0, 1))).fillCircle(z.x, z.y, z.r * 0.7);   // chamusquina
  }

  // ---------- efectos de impacto (garras, puños, mordiscos...) ----------

  /** Anima sobre el rival el efecto `kind` (ver hitfx.ts), con los colores del tipo del ataque. */
  play(kind: string, x: number, y: number, ang: number, power: number, type: string, ox: number, oy: number) {
    const life = HIT_LIFE[kind];
    if (!life) return;
    const pal = PAL[TYPE_PAL[type] ?? 'hit'] ?? PAL.hit;
    this.hits.push({ kind, x, y, ang, power, pal, ox, oy, type, age: 0, life, seed: Math.random() * 100, fired: false, mark: -1 });
  }

  shake(ms: number, intensity: number) { this.scene.cameras.main.shake(ms, intensity); }

  /** Mancha en el suelo que se desvanece (Bomba Lodo deja el suelo corroído). */
  decal(x: number, y: number, r: number, color: number, life: number) {
    this.decals.push({ x, y, r, color, life, age: 0 });
  }

  /** Imagen que flota y se desvanece (notas musicales). */
  floater(tex: string, x: number, y: number, vx: number, vy: number, life: number, scale: number, tint: number) {
    const img = this.scene.add.image(x, y, tex).setScale(scale).setTint(tint).setDepth(11);
    this.floaters.push({ img, vx, vy, age: 0, life, spin: (Math.random() - 0.5) * 3 });
  }

  /** Explosión de un ataque lanzado (Bomba Huevo): destello, anillos y una nube de partículas. */
  explosion(x: number, y: number, r: number, palKey: string) {
    const pal = PAL[palKey] ?? PAL.hit;
    this.spawn(x, y, { life: 220, s0: r * 0.9, s1: r * 0.2, rot: Math.PI / 4, colors: [0xffffff, pal[1] ?? pal[0]], a0: 0.9 });
    this.ring(x, y, pal[0], 8, r * 1.1, 380, 5);
    this.ring(x, y, pal[1] ?? pal[0], 4, r * 0.7, 300, 4);
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2, v = 120 + Math.random() * 220;
      this.spawn(x, y, { vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, life: 520, s0: 12, s1: 2, g: 200, colors: pal });
    }
  }

  /** Carga de un ataque (Rayo Solar): luz que se junta en la boca del Pokémon y un orbe que crece. */
  charge(x: number, y: number, dx: number, dy: number, k: number, dt: number) {
    const mx = x + dx * 40, my = y + dy * 40, f = dt / 16.67;
    this.gfx.fillStyle(0xfff3a8, 0.25 + 0.3 * k).fillCircle(mx, my, 10 + 34 * k);
    this.gfx.fillStyle(0xffffff, 0.8).fillCircle(mx, my, 6 + 16 * k);
    this.gfx.lineStyle(3, 0xffd23f, 0.7).strokeCircle(x, y + 4, 52 + 10 * Math.sin(k * 30));
    for (let i = Math.floor(2.2 * f + Math.random()); i > 0; i--) {
      const a = Math.random() * Math.PI * 2, r = 110;
      this.spawn(mx + Math.cos(a) * r, my + Math.sin(a) * r, { vx: -Math.cos(a) * 330, vy: -Math.sin(a) * 330, life: 330, s0: 9, s1: 2, a0: 0.9, colors: PAL.sun });
    }
  }

  /** Marca en el suelo de un ataque que cae desde el aire o emerge del subsuelo (Vuelo, Bote, Excavar). */
  leapMark(kind: string, x: number, y: number, k: number, locked: boolean) {
    const g = this.gfx, pulse = 0.5 + 0.5 * Math.sin(k * 40);
    if (kind === 'dig') {
      g.fillStyle(0x4a3418, 0.35 + 0.25 * k).fillEllipse(x, y + 6, 70 * (0.5 + k * 0.6), 28 * (0.6 + k * 0.5));
      g.lineStyle(4, 0x2a190a, 0.8).strokeCircle(x, y + 6, 26 + 30 * (1 - k));
      for (let i = 0; i < 7; i++) { const a = i * 0.9 + k * 2; g.lineBetween(x + Math.cos(a) * 12, y + 6 + Math.sin(a) * 6, x + Math.cos(a) * (40 + 14 * i % 3), y + 6 + Math.sin(a) * 20); }
      if (Math.random() < 0.5) this.spawn(x + (Math.random() - 0.5) * 50, y + 4, { vx: (Math.random() - 0.5) * 60, vy: -70 - Math.random() * 60, g: 500, life: 420, s0: 8, s1: 3, colors: PAL.earth });
    } else {
      g.fillStyle(0x000000, 0.18 + 0.3 * k).fillEllipse(x, y + 8, 40 + 90 * k, 16 + 36 * k);
      g.lineStyle(3, locked ? 0xff6b6b : 0xffffff, 0.5 + 0.4 * pulse).strokeCircle(x, y + 6, 90 - 50 * k);
      g.lineStyle(2, 0xffffff, 0.4).strokeCircle(x, y + 6, 40);
    }
  }

  // ---------- chorros con diseño propio ----------

  /** Puntos de una línea desde la base hasta la punta, con ondulación opcional. */
  private line(x1: number, y1: number, x2: number, y2: number, n: number, amp: number, freq: number, phase: number, k0 = 0): { x: number; y: number }[] {
    const len = Math.hypot(x2 - x1, y2 - y1) || 1, nx = -(y2 - y1) / len, ny = (x2 - x1) / len, out = [];
    for (let i = 0; i <= n; i++) {
      const u = k0 + (i / n) * (1 - k0), off = Math.sin(u * freq + phase) * amp * Math.sin(Math.PI * Math.min(1, u * 1.1));
      out.push({ x: snap(x1 + (x2 - x1) * u + nx * off), y: snap(y1 + (y2 - y1) * u + ny * off) });
    }
    return out;
  }

  private stroke(pts: { x: number; y: number }[], w: number, color: number, alpha: number) {
    this.gfx.lineStyle(w, color, alpha).strokePoints(pts as unknown as Phaser.Math.Vector2[], false);
  }

  private customStream(kind: string, x1: number, y1: number, x2: number, y2: number, k: number, age: number, size: number) {
    const len = Math.hypot(x2 - x1, y2 - y1);
    const dx = (x2 - x1) / len, dy = (y2 - y1) / len, nx = -dy, ny = dx;
    const sx = x1 + (x2 - x1) * k, sy = y1 + (y2 - y1) * k, L = len * (1 - k);
    if (L < 6) return;
    const sc = size / 1.4, fade = 1 - k * 0.7, g = this.gfx, n = Math.max(4, Math.floor(L / 14));
    const t = age * 0.001;
    const at = (u: number, off = 0) => ({ x: sx + dx * L * u + nx * off, y: sy + dy * L * u + ny * off });
    const tip = { x: x2, y: y2 };
    const pop = (cols: number[], life = 360, s0 = 8) => this.spawn(tip.x + rnd(8), tip.y + rnd(8), { vx: dx * 60 + rnd(90), vy: dy * 60 + rnd(90), life, s0, s1: 1, colors: cols });
    switch (kind) {
      case 'jet': {   // chorro fino de agua
        const p = this.line(sx, sy, x2, y2, n, 2, 14, age * 0.02);
        this.stroke(p, 13 * sc + 6, 0x3d9bff, 0.9 * fade); this.stroke(p, 8 * sc + 3, 0xbfe6ff, fade); this.stroke(p, 3, 0xffffff, fade);
        if (Math.random() < 0.7) pop(PAL.water, 360, 7);
        break;
      }
      case 'hyper': {   // haz blanco, delgado y rapidísimo
        const w = 12 * sc + 8;
        this.stroke([{ x: sx, y: sy }, tip], w * 2, 0xbcd4ff, 0.3 * fade); this.stroke([{ x: sx, y: sy }, tip], w, 0xffffff, fade); this.stroke([{ x: sx, y: sy }, tip], w * 0.4, 0xffffff, fade);
        g.fillStyle(0xffffff, 0.8 * fade).fillCircle(x1, y1, w * 1.1); g.fillStyle(0xffffff, fade).fillCircle(tip.x, tip.y, w * 0.9);
        for (let i = 0; i < 3; i++) { const c = at(Math.random(), rnd(w)); this.spawn(c.x, c.y, { vx: rnd(120), vy: rnd(120), life: 260, s0: 6, s1: 0, colors: [0xffffff, 0xbcd4ff] }); }
        break;
      }
      case 'aurora': {   // haz celeste delgado que ondula
        const p = this.line(sx, sy, x2, y2, n, 5, 11, age * 0.012);
        this.stroke(p, 14 * sc + 5, 0x9fe8ff, 0.35 * fade); this.stroke(p, 8 * sc + 2, 0xd8f6ff, 0.95 * fade); this.stroke(p, 3, 0xffffff, fade);
        for (let i = 0; i < 2; i++) { const c = at(Math.random(), rnd(10)); this.spawn(c.x, c.y, { vx: rnd(30), vy: rnd(30), life: 360, s0: 6, s1: 0, spin: 5, colors: [0xffffff, 0x9fe8ff] }); }
        break;
      }
      case 'icebeam': {   // rayo helado: un vidrio que se trizaba al avanzar
        const p = this.line(sx, sy, x2, y2, n, 0, 1, 0);
        this.stroke(p, 22 * sc + 6, 0x4aa3c7, 0.85 * fade); this.stroke(p, 14 * sc + 4, 0x8ae6ff, fade); this.stroke(p, 6, 0xffffff, fade);
        const hash = (i: number) => (Math.sin(i * 12.9898) * 43758.5453) % 1;
        for (let i = 1; i < n; i++) {   // grietas blancas y cristales a lo largo del rayo
          const u = i / n, c = at(u), side = i % 2 ? 1 : -1, ln = (20 + Math.abs(hash(i)) * 26) * sc, a1 = side * (0.6 + Math.abs(hash(i + 7)) * 0.7);
          const e1 = { x: c.x + (Math.cos(a1) * dx - Math.sin(a1) * dy) * ln, y: c.y + (Math.sin(a1) * dx + Math.cos(a1) * dy) * ln };
          const mid = { x: (c.x + e1.x) / 2 + nx * hash(i + 3) * 6, y: (c.y + e1.y) / 2 + ny * hash(i + 3) * 6 };
          g.lineStyle(2, 0xffffff, 0.9 * fade).lineBetween(c.x, c.y, mid.x, mid.y).lineBetween(mid.x, mid.y, e1.x, e1.y);
          if (i % 2 === 0) g.fillStyle(0xd8f6ff, fade).fillTriangle(e1.x - nx * 4, e1.y - ny * 4, e1.x + nx * 4, e1.y + ny * 4, e1.x + (e1.x - c.x) * 0.5, e1.y + (e1.y - c.y) * 0.5);
        }
        for (let i = 0; i < 3; i++) g.fillStyle(0xffffff, fade).fillTriangle(tip.x + nx * 8, tip.y + ny * 8, tip.x - nx * 8, tip.y - ny * 8, tip.x + dx * (16 + i * 8) + nx * (i - 1) * 7, tip.y + dy * (16 + i * 8) + ny * (i - 1) * 7);
        if (Math.random() < 0.5) pop(PAL.ice, 400, 8);
        break;
      }
      case 'vine':
      case 'blade': {   // látigo de planta / de hojas afiladas que avanza
        const blade = kind === 'blade';
        const p = this.line(sx, sy, x2, y2, n * 2, 11, 9, age * 0.014 + (blade ? 1 : 0));
        this.stroke(p, 9 * sc + 2, 0x2f8f3a, fade); this.stroke(p, 5 * sc, blade ? 0xc8f56a : 0x6fd14f, fade);
        for (let i = 2; i < p.length - 1; i += blade ? 3 : 4) {
          const c = p[i], d = i % 2 ? 1 : -1, ln = (blade ? 30 : 17) * sc + 5;
          const tipP = { x: c.x + nx * d * ln + dx * ln * 0.4, y: c.y + ny * d * ln + dy * ln * 0.4 };
          if (blade) {
            g.fillStyle(0xe8ffff, fade).fillTriangle(c.x - dx * 6, c.y - dy * 6, c.x + dx * 6, c.y + dy * 6, tipP.x, tipP.y);
            g.lineStyle(2, 0x2f8f3a, fade).strokeTriangle(c.x - dx * 6, c.y - dy * 6, c.x + dx * 6, c.y + dy * 6, tipP.x, tipP.y);
          } else g.fillStyle(0x4fd14f, fade).fillTriangle(c.x - dx * 5, c.y - dy * 5, c.x + dx * 5, c.y + dy * 5, tipP.x, tipP.y);
        }
        g.fillStyle(blade ? 0xffffff : 0x8bd96a, fade).fillCircle(tip.x, tip.y, blade ? 9 : 7);
        if (blade && Math.random() < 0.5) this.spawn(tip.x, tip.y, { life: 200, s0: 3, len: 24, rot: Math.atan2(dy, dx), colors: [0xffffff], a0: 0.9 });
        break;
      }
      case 'psybeam': {   // doble hélice psíquica
        for (const ph of [0, Math.PI]) {
          const p = this.line(sx, sy, x2, y2, n * 2, 13, 10, age * 0.02 + ph);
          this.stroke(p, 8 * sc + 3, 0xff5cae, 0.9 * fade); this.stroke(p, 4, 0xffd1ec, fade);
        }
        this.stroke([{ x: sx, y: sy }, tip], 4, 0xffffff, 0.7 * fade);
        if (Math.floor((age + 16) / 140) !== Math.floor(age / 140)) this.ring(tip.x, tip.y, 0xff8fcf, 8, 40, 300, 3);
        break;
      }
      case 'darkbeam': {   // rayo siniestro: dentado, negro con borde rojo
        const p = this.line(sx, sy, x2, y2, n * 2, 0, 1, 0).map((q, i, arr) => (i === 0 || i === arr.length - 1 ? q : { x: q.x + rnd(9), y: q.y + rnd(9) }));
        this.stroke(p, 16 * sc + 4, 0x1a1020, 0.9 * fade); this.stroke(p, 9 * sc + 2, 0x8a2a40, fade); this.stroke(p, 3, 0xff6b8a, fade);
        for (let i = 0; i < 2; i++) { const c = at(Math.random(), rnd(14)); this.spawn(c.x, c.y, { vx: rnd(40), vy: -30, life: 480, s0: 12, s1: 3, a0: 0.9, colors: PAL.dark }); }
        break;
      }
      case 'flash': {   // haz resplandeciente muy rápido
        const w = 20 * sc + 6;
        this.stroke([{ x: sx, y: sy }, tip], w * 1.9, 0xfff3a8, 0.35 * fade); this.stroke([{ x: sx, y: sy }, tip], w, 0xffffff, fade); this.stroke([{ x: sx, y: sy }, tip], w * 0.45, 0xffffff, fade);
        for (const [cx, cy, r] of [[tip.x, tip.y, w * 1.5], [x1, y1, w]] as [number, number, number][]) {
          g.fillStyle(0xfff3a8, 0.5 * fade).fillCircle(cx, cy, r * 1.4);
          for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 2 + t * 4; g.lineStyle(3, 0xffffff, fade).lineBetween(cx, cy, cx + Math.cos(a) * r * 2.2, cy + Math.sin(a) * r * 2.2); }
        }
        break;
      }
      case 'moon': {   // gran chorro de energía lunar
        const w = 34 * sc + 10;
        const p = this.line(sx, sy, x2, y2, n, 4, 8, age * 0.01);
        this.stroke(p, w * 1.7, 0x4a5aa8, 0.5 * fade); this.stroke(p, w * 1.25, 0x8a9ae0, 0.85 * fade); this.stroke(p, w * 0.8, 0xd8e0ff, fade); this.stroke(p, w * 0.35, 0xffffff, fade);
        for (let i = 1; i < 5; i++) {   // medias lunas que viajan por el chorro
          const u = ((t * 1.3 + i * 0.22) % 1), c = at(u), r = w * 0.7;
          g.lineStyle(4, 0xffffff, 0.8 * fade * Math.sin(Math.PI * u)).beginPath().arc(c.x, c.y, r, Math.atan2(dy, dx) + Math.PI / 2, Math.atan2(dy, dx) + Math.PI * 1.5).strokePath();
        }
        for (let i = 0; i < 3; i++) { const c = at(Math.random(), rnd(w)); this.spawn(c.x, c.y, { vx: rnd(40), vy: rnd(40), life: 420, s0: 8, s1: 0, spin: 5, colors: [0xffffff, 0xd8e0ff] }); }
        break;
      }
      case 'gleam': {   // chorro rosado resplandeciente con destellos
        const w = 20 * sc + 6;
        const p = this.line(sx, sy, x2, y2, n, 3, 12, age * 0.015);
        this.stroke(p, w * 1.7, 0xf4a0c0, 0.45 * fade); this.stroke(p, w, 0xffd1ec, 0.95 * fade); this.stroke(p, w * 0.35, 0xffffff, fade);
        for (let i = 0; i < 5; i++) { const c = at(Math.random(), rnd(w * 0.9)), r = 3 + Math.random() * 6; g.lineStyle(2, 0xffffff, fade).lineBetween(c.x - r, c.y, c.x + r, c.y).lineBetween(c.x, c.y - r, c.x, c.y + r); }
        break;
      }
      case 'dragonbreath': {   // aliento dragón: delgado y con llamas moradas
        const p = this.line(sx, sy, x2, y2, n, 4, 10, age * 0.02);
        this.stroke(p, 18 * sc + 4, 0x3a2a8a, 0.9 * fade); this.stroke(p, 11 * sc + 2, 0x7a45f8, fade); this.stroke(p, 4, 0xb08cff, fade);
        for (let i = 0; i < 3; i++) { const c = at(Math.random(), rnd(12)); this.spawn(c.x, c.y, { vx: rnd(50), vy: -30 + rnd(40), life: 420, s0: 12, s1: 2, colors: PAL.dragon, a0: 0.95 }); }
        break;
      }
    }
  }

  // ---------- olas, ventiscas y ondas especiales ----------

  /** Surf: una ola grande que avanza en una sola dirección. */
  private wave(a: Area, sc: number, dt: number) {
    const g = this.gfx, dur = (a.range / a.speed) * 1000;
    const front = Math.min(a.range, (a.t * a.speed) / 1000), p = front / a.range;
    const hw = 120 + 50 * p, al = a.t > dur ? 1 - Phaser.Math.Clamp((a.t - dur) / 350, 0, 1) : 1, k = dt / 16.67;
    const nx = -a.dy, ny = a.dx;
    const crest = (back: number) => {
      const pts = [];
      for (let i = 0; i <= 14; i++) {
        const v = (i / 14 - 0.5) * 2 * hw, u = front - back + 34 * (1 - Math.pow(v / hw, 2)) * sc;
        pts.push({ x: snap(a.ox + a.dx * u + nx * v), y: snap(a.oy + a.dy * u + ny * v) });
      }
      return pts as unknown as Phaser.Math.Vector2[];
    };
    const cols = [0xffffff, 0xbfe6ff, 0x66b8ff, 0x3d9bff, 0x2f7fe0];
    for (let q = 4; q >= 0; q--) g.lineStyle(28 * sc - q * 3, cols[q], (0.55 - q * 0.06) * al).strokePoints(crest(q * 30), false);
    g.lineStyle(9 * sc, 0xffffff, 0.95 * al).strokePoints(crest(0), false);
    for (let i = Math.floor(6 * sc * k + Math.random()); i > 0; i--) {   // espuma y gotas en la cresta
      const v = (Math.random() - 0.5) * 2 * hw, u = front + 34 * (1 - Math.pow(v / hw, 2)) * sc;
      this.spawn(a.ox + a.dx * u + nx * v, a.oy + a.dy * u + ny * v, { vx: a.dx * 60 + rnd(60), vy: a.dy * 60 - 70 - Math.random() * 60, g: 320, life: 460, s0: 10, s1: 2, colors: PAL.water });
    }
  }

  /** Ventisca: una tormenta de viento blanco que avanza barriendo. */
  private storm(a: Area, sc: number, dt: number) {
    const g = this.gfx, dur = (a.range / a.speed) * 1000;
    const front = Math.min(a.range, (a.t * a.speed) / 1000), p = front / a.range, r = 60 + 40 * p, k = dt / 16.67;
    const al = a.t > dur ? 1 - Phaser.Math.Clamp((a.t - dur) / 500, 0, 1) : 1;
    const cx = a.ox + a.dx * front, cy = a.oy + a.dy * front;
    g.fillStyle(0xd8f6ff, 0.10 * al).fillCircle(cx, cy, r * 1.15);
    g.fillStyle(0xffffff, 0.12 * al).fillCircle(cx, cy, r * 0.8);
    g.lineStyle(3, 0xffffff, 0.35 * al).strokeCircle(cx, cy, r);
    if (a.t > dur + 150) return;
    for (let i = Math.floor(14 * k + Math.random()); i > 0; i--) {
      const an = Math.random() * Math.PI * 2, rr = r * Math.sqrt(Math.random()), px = cx + Math.cos(an) * rr, py = cy + Math.sin(an) * rr * 0.9;
      const v = 170 + Math.random() * 90;
      this.spawn(px, py, { vx: -Math.sin(an) * v + a.dx * 170, vy: Math.cos(an) * v + a.dy * 170, life: 520, s0: 6, s1: 2, colors: [0xffffff, 0xd8f6ff, 0x8ae6ff] });
    }
    for (let i = Math.floor(3 * k + Math.random()); i > 0; i--) {
      const an = Math.random() * Math.PI * 2, rr = r * (0.5 + Math.random() * 0.5);
      this.spawn(cx + Math.cos(an) * rr, cy + Math.sin(an) * rr * 0.9, { vx: -Math.sin(an) * 260 + a.dx * 200, vy: Math.cos(an) * 260 + a.dy * 200, life: 260, s0: 3, len: 40, rot: an + Math.PI / 2, colors: [0xffffff], a0: 0.85 });
    }
  }

  /** Ondas expansivas con diseño propio (notas, sueño, mente, zumbido). Devuelve true si dibujó algo. */
  private novaSpecial(a: Area, f: number, al: number, sc: number, dt: number): boolean {
    const g = this.gfx, k = dt / 16.67, cnt = (rate: number) => Math.floor(rate * k + Math.random());
    const ring = (r: number, w: number, color: number, alpha: number) => { if (r > 4) g.lineStyle(w, color, alpha * al).strokeCircle(a.ox, a.oy, r); };
    switch (a.fx) {
      case 'notes':   // notas musicales que se alejan
        ring(f, 4, 0xffd1ec, 0.5);
        for (let i = cnt(2.6); i > 0; i--) {
          const an = Math.random() * Math.PI * 2, v = 160 + Math.random() * 90;
          this.floater('head-note', a.ox + Math.cos(an) * 30, a.oy + Math.sin(an) * 30, Math.cos(an) * v, Math.sin(an) * v, 520, 0.9 + Math.random() * 0.5, [0xffd1ec, 0xf4a0c0, 0xffffff, 0x9fd8ff][Math.floor(Math.random() * 4)]);
        }
        return true;
      case 'dream': {   // onda malvada con ojos rojos
        ring(f, 20 * sc, 0x1a1020, 0.7); ring(f, 9, 0x8a2a40, 0.9); ring(f - 14, 4, 0xff3b6b, 0.7);
        for (let i = cnt(5); i > 0; i--) { const an = Math.random() * Math.PI * 2; this.spawn(a.ox + Math.cos(an) * f, a.oy + Math.sin(an) * f * 0.9, { vx: Math.cos(an) * 30 + rnd(30), vy: -40 + rnd(20), life: 520, s0: 16, s1: 3, a0: 0.9, colors: PAL.shadow }); }
        for (let i = 0; i < 3; i++) {   // un par de ojos que se abre y brilla en el borde
          const an = (a.seed % 6) + i * 2.1 + a.t * 0.002, px = a.ox + Math.cos(an) * f, py = a.oy + Math.sin(an) * f * 0.9, o = 5 + 3 * Math.sin(a.t * 0.02 + i);
          g.fillStyle(0xff3b6b, al).fillEllipse(px - 8, py, 11, o).fillEllipse(px + 8, py, 11, o);
          g.fillStyle(0x1a1020, al).fillRect(px - 9, py - 1, 3, 2).fillRect(px + 7, py - 1, 3, 2);
        }
        return true;
      }
      case 'mind': {   // onda que "altera la realidad": anillos con colores desfasados y cuadros que fallan
        ring(f, 10, 0xff3b6b, 0.7); ring(f - 9, 10, 0x3bffd9, 0.7); ring(f - 18, 10, 0xb43fff, 0.7); ring(f - 28, 5, 0xffffff, 0.8);
        for (let i = 0; i < 4; i++) {
          const an = Math.random() * Math.PI * 2, rr = f * (0.4 + Math.random() * 0.6), w = 14 + Math.random() * 40;
          g.fillStyle([0xff3b6b, 0x3bffd9, 0xb43fff][i % 3], 0.22 * al).fillRect(a.ox + Math.cos(an) * rr - w / 2, a.oy + Math.sin(an) * rr * 0.9 - 4, w, 8);
        }
        for (let r = 0; r < 16; r++) { const an = (r * Math.PI) / 8 + a.t * 0.003; g.lineStyle(2, 0xffffff, 0.18 * al).lineBetween(a.ox + Math.cos(an) * f * 0.85, a.oy + Math.sin(an) * f * 0.85, a.ox + Math.cos(an + 0.35) * f * 1.02, a.oy + Math.sin(an + 0.35) * f * 1.02); }
        return true;
      }
      case 'buzz': {   // zumbido: un anillo que vibra con abejas
        const pts = [];
        for (let i = 0; i <= 44; i++) { const an = (i / 44) * Math.PI * 2, rr = f + rnd(7) * sc; pts.push({ x: a.ox + Math.cos(an) * rr, y: a.oy + Math.sin(an) * rr * 0.92 }); }
        g.lineStyle(9, 0x303a10, 0.8 * al).strokePoints(pts as unknown as Phaser.Math.Vector2[], true, true);
        g.lineStyle(4, 0xe8d820, 0.95 * al).strokePoints(pts as unknown as Phaser.Math.Vector2[], true, true);
        for (let i = cnt(5); i > 0; i--) { const an = Math.random() * Math.PI * 2, rr = f + rnd(26); this.spawn(a.ox + Math.cos(an) * rr, a.oy + Math.sin(an) * rr, { vx: rnd(150), vy: rnd(150), life: 240, s0: 5, s1: 2, colors: [0xe8d820, 0x303a10, 0xe8d820] }); }
        return true;
      }
    }
    return false;
  }

  /** Roca Afilada: peñascos irregulares que brotan del suelo a destiempo. */
  private shard(x: number, y: number, w: number, h: number, lean: number, seed: number) {
    const g = this.top, rng = seeded(seed), N = 5;
    const left: { x: number; y: number }[] = [], right: { x: number; y: number }[] = [], mid: { x: number; y: number }[] = [];
    for (let j = 0; j <= N; j++) {
      const u = j / N, jit = j > 0 && j < N ? 1 : 0;
      const yy = y - h * u + jit * (rng() - 0.5) * h * 0.07, tx = lean * u;
      left.push({ x: x - (w / 2) * (1 - u) + tx + jit * (rng() - 0.5) * w * 0.2, y: yy });
      right.push({ x: x + (w / 2) * (1 - u) + tx + jit * (rng() - 0.5) * w * 0.2, y: yy + jit * (rng() - 0.5) * h * 0.05 });
      mid.push({ x: x + tx + (rng() - 0.5) * w * 0.12 * jit, y: yy });
    }
    const V = (a: { x: number; y: number }[]) => a as unknown as Phaser.Math.Vector2[];
    g.fillStyle(0x8a909c, 1).fillPoints(V([...left, ...right.slice(0, -1).reverse()]), true);
    g.fillStyle(0xbcc2ce, 1).fillPoints(V([...left, ...mid.slice(0, -1).reverse()]), true);
    g.fillStyle(0x636976, 1).fillPoints(V([...mid, ...right.slice(0, -1).reverse()]), true);
    for (const u of [0.3, 0.55, 0.78]) {   // grietas y facetas de la roca
      const j = Math.max(1, Math.round(u * N)), a = left[j], b = mid[j], c = right[j];
      g.lineStyle(2, 0x3d424c, 0.8).lineBetween(a.x, a.y, b.x + (rng() - 0.5) * 6, b.y + (rng() - 0.5) * 8).lineBetween(b.x, b.y, c.x - w * 0.1, c.y + 3);
    }
    g.lineStyle(3, 0x3d424c, 1).strokePoints(V([...left, ...right.slice(0, -1).reverse()]), true, true);
    g.lineStyle(2, 0xe6eaf0, 0.9).strokePoints(V(left.slice(0, -1)), false);
  }

  private spikes(a: Area, sc: number) {
    const g = this.top;
    a.zones.forEach((z, i) => {
      const pop = z.pop ?? i * 80, size = z.size ?? 1;
      if (this.crossed(a, pop)) {
        for (let k = 0; k < 8; k++) this.spawn(z.x + rnd(16), z.y, { vx: rnd(150), vy: -150 - Math.random() * 150, g: 900, life: 520, s0: (5 + Math.random() * 7) * sc, s1: 2, spin: 6, colors: PAL.rock });
        this.spawn(z.x, z.y + 4, { life: 480, s0: 18, s1: 46, a0: 0.4, colors: [0xc0a070] });
        this.ring(z.x, z.y + 4, 0xa0a6b4, 8, 42 * sc * size, 300);
      }
      const rng = seeded(a.seed + i * 31);
      const parts: [number, number, number, number, number, number][] = [   // dx, dy, alto, ancho, inclinación, retraso
        [-0.85, 4, 0.5 + rng() * 0.2, 0.62, -12 - rng() * 6, 30], [0.75, 3, 0.55 + rng() * 0.2, 0.66, 10 + rng() * 6, 55],
        [-0.15, 8, 0.36 + rng() * 0.14, 0.5, -4, 15], [0, 0, 1, 1, (rng() - 0.5) * 14, 0],
      ];
      const w0 = (28 + rng() * 14) * sc * size, h0 = (68 + rng() * 52) * sc * size;
      const age0 = a.t - pop;
      if (age0 < 0 || age0 > 820) return;
      g.fillStyle(0x4a3418, 0.5).fillEllipse(z.x, z.y + 4, w0 * 2.1, w0 * 0.7);
      parts.forEach(([dx, dy, hs, ws, lean, delay], j) => {
        const age = age0 - delay, up = age < 90 ? 1 - Math.pow(1 - Math.max(0, age) / 90, 2) : age > 600 ? 1 - (age - 600) / 200 : 1;
        if (age < 0 || up <= 0) return;
        this.shard(z.x + dx * w0, z.y + dy, w0 * ws, h0 * hs * up, lean, a.seed + i * 17 + j);
      });
    });
  }

  /** Media luna de un golpe (se expande y se desvanece). */
  slash(x: number, y: number, ang: number, color: number, r: number) {
    const deg = Phaser.Math.RadToDeg(ang);
    const arc = this.scene.add.arc(x, y, r * 0.6, deg - 60, deg + 60, false, color, 0)
      .setClosePath(false).setStrokeStyle(8, color).setDepth(9);
    this.rings.push({ obj: arc, age: 0, life: 240, r0: r * 0.6, r1: r * 1.2 });
  }

  // ---------- movimientos de contacto ----------

  /** Imagen residual del Pokémon durante una embestida. */
  afterimage(src: Phaser.GameObjects.Image, tint: number) {
    const img = this.scene.add.image(src.x, src.y, src.texture.key, src.frame.name)
      .setScale(src.scaleX).setTint(tint).setAlpha(0.55).setDepth(src.depth - 0.01);
    this.ghosts.push({ img, age: 0, life: 240 });
  }

  /** Líneas de velocidad detrás de quien embiste. */
  streak(x: number, y: number, dx: number, dy: number) {
    const a = Math.atan2(dy, dx);
    for (let i = 0; i < 2; i++) {
      this.spawn(x - dx * 30 + rnd(18) * -dy, y - dy * 30 + rnd(18) * dx, {
        vx: -dx * 120, vy: -dy * 120, life: 200, s0: 3, len: 34, rot: a, colors: [0xffffff], a0: 0.9,
      });
    }
  }

  /** Lengua de Lengüetazo: sale de la boca hacia el rival y vuelve. */
  tongue(x: number, y: number, ang: number, reach: number) {
    const rect = this.scene.add.rectangle(x, y, 8, 8, 0xff7aa8).setOrigin(0, 0.5).setRotation(ang).setScale(0.01, 2.1).setDepth(11);
    const tip = this.scene.add.rectangle(x, y, 18, 18, 0xd9457a).setRotation(ang).setDepth(11);
    this.tongues.push({ rect, tip, x, y, ang, reach, age: 0, life: 320 });
  }

  /** Pequeña nube cuando un proyectil se apaga sin dar en el blanco. */
  fizzle(fx: string, x: number, y: number) {
    const pal = PAL[PAL_OF[fx] ?? 'hit'];
    for (let i = 0; i < 4; i++)
      this.spawn(x, y, { vx: rnd(60), vy: rnd(60), life: 300, s0: 8, s1: 1, colors: pal });
  }
}
