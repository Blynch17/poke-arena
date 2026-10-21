import Phaser from 'phaser';

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
};

const PAL_OF: Record<string, string> = {
  ember: 'fire', flame: 'fire', water: 'water', hydro: 'water', ice: 'ice', leaf: 'leaf', solar: 'sun',
  sludge: 'sludge', spark: 'elec', bolt: 'elec', thunder: 'elec', psy: 'psy', psychic: 'psy',
  shadow: 'shadow', wing: 'hit', lick: 'hit', slam: 'hit',
};

export const HEAD_TEXTURE: Record<string, string> = {
  ember: 'head-fire', flame: 'head-fire', water: 'head-water', hydro: 'head-water', ice: 'head-ice',
  leaf: 'head-leaf', solar: 'head-sun', sludge: 'head-sludge', spark: 'head-spark', bolt: 'head-spark',
  thunder: 'head-spark', psy: 'head-psy', psychic: 'head-psy', shadow: 'head-shadow',
};

// Ataques que se dibujan como un chorro continuo desde el Pokémon (ver Fx.stream).
export const STREAM_FX = new Set(['hydro', 'flame', 'solar']);

// Giro de la cabeza del proyectil, en rad/s.
export const SPIN: Record<string, number> = { leaf: 7, ice: 3, spark: 9, bolt: 6, thunder: 6, psy: 4, psychic: 4, solar: 2 };

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
  x: number; y: number; vx: number; vy: number; fx: string; ox: number; oy: number; acc: number; age: number;
}

const rnd = (a: number) => (Math.random() - 0.5) * 2 * a;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const snap = (v: number) => Math.round(v / 2) * 2; // posiciones de 2 px: look pixelado

export class Fx {
  private gfx: Phaser.GameObjects.Graphics;
  private free: Part[] = [];
  private live: Part[] = [];
  private rings: Ring[] = [];
  private ghosts: Ghost[] = [];
  private tongues: Tongue[] = [];

  constructor(private scene: Phaser.Scene) {
    this.gfx = scene.add.graphics().setDepth(9);
  }

  /** Borra los rayos del cuadro anterior (se redibujan cada cuadro). */
  beginFrame() {
    this.gfx.clear();
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
      t.rect.setScale(Math.max(0.01, len / 8), 0.9);
      t.tip.setPosition(t.x + Math.cos(t.ang) * len, t.y + Math.sin(t.ang) * len);
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
      sh.acc += rate * k;
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
        this.bolt(x - dx * tail, y - dy * tail, x, y, sh.fx === 'thunder' ? 9 : 5);
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
      case 'psychic': {
        if (every(80)) this.ring(x, y, 0xff5cae, 10, 46, 420, 4);
        const a = (sh.age + dt) * 0.012;
        for (let q = 0; q < 3; q++) {
          const aa = a + (q * Math.PI * 2) / 3;
          this.spawn(x + Math.cos(aa) * 20, y + Math.sin(aa) * 20, { life: 160, s0: 8, s1: 2, colors: PAL.psy });
        }
        break;
      }
      case 'shadow':
        for (let i = count(1.8); i > 0; i--)
          this.spawn(bx + rnd(10), by + rnd(10), { vx: rnd(40), vy: -20 + rnd(30), life: 520, s0: 16, s1: 4, a0: 0.9, colors: PAL.shadow });
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

  impact(fx: string, x: number, y: number, ang: number) {
    const pal = PAL[PAL_OF[fx] ?? 'hit'];
    const burst = (n: number, sp: number, s0: number, s1: number, life: number, g = 0, spin = 0) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, v = sp * (0.4 + Math.random() * 0.8);
        this.spawn(x, y, { vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: life * (0.7 + Math.random() * 0.6), s0, s1, g, spin, colors: pal });
      }
    };
    // destello central: da peso al golpe antes de que se abran las partículas
    this.spawn(x, y, { life: 150, s0: 36, s1: 8, rot: Math.PI / 4, colors: [0xffffff, pal[Math.min(1, pal.length - 1)]], a0: 0.95 });
    switch (fx) {
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
      case 'wing': this.slash(x, y, ang, 0xe8f6ff, 46); this.rays(x, y, 8, 30, 0xffffff); break;
      case 'lick': this.rays(x, y, 6, 24, 0xff9fc0); burst(6, 120, 6, 1, 320); break;
      default: this.rays(x, y, 8, 36, 0xffffff); burst(8, 160, 8, 1, 380); this.ring(x, y, 0xffffff, 6, 44, 240); break;
    }
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
    const rect = this.scene.add.rectangle(x, y, 8, 8, 0xff7aa8).setOrigin(0, 0.5).setRotation(ang).setScale(0.01, 0.9).setDepth(11);
    const tip = this.scene.add.rectangle(x, y, 10, 10, 0xd9457a).setRotation(ang).setDepth(11);
    this.tongues.push({ rect, tip, x, y, ang, reach, age: 0, life: 320 });
  }

  /** Pequeña nube cuando un proyectil se apaga sin dar en el blanco. */
  fizzle(fx: string, x: number, y: number) {
    const pal = PAL[PAL_OF[fx] ?? 'hit'];
    for (let i = 0; i < 4; i++)
      this.spawn(x, y, { vx: rnd(60), vy: rnd(60), life: 300, s0: 8, s1: 1, colors: pal });
  }
}
