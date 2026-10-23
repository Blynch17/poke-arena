import Phaser from 'phaser';
import {
  POKEMON, PokemonDef, Move, Stages, StatKey, calcDamage, TYPE_COLOR, ITEMS, ItemId, ENERGY_MAX, ENERGY_REGEN,
  STRUGGLE, newStages, stageMult, maxUses, STAT_NAME, STAGE_MAX, SPEED_STAGE_EFFECT,
} from '../data';
import { Fx, HEAD_TEXTURE, SPIN, STREAM_FX } from '../fx';
import { music } from '../music';
import { sfx } from '../sfx';
import { settings, saveSettings } from '../settings';

const A = { x: 20, y: 84, w: 920, h: 480 }; // arena
const R = 30; // radio de colisión de los Pokémon
// Teclas de ataque según el esquema de controles (ajustes).
const KEY_SETS = { keys: ['U', 'I', 'O', 'P'], mouse: ['Q', 'W', 'E', 'R'] };
const SPRITE_SCALE = 3; // los sprites de overworld miden 32x32

// Hoja de caminata: 2 cuadros por fila; filas = abajo, arriba, izquierda, derecha.
function walkRow(f: Phaser.Math.Vector2): number {
  if (Math.abs(f.x) >= Math.abs(f.y)) return f.x >= 0 ? 3 : 2;
  return f.y >= 0 ? 0 : 1;
}

interface Member { def: PokemonDef; hp: number; energy: number; stages: Stages; pp: number[] }

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
}

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
}

type MenuScreen = '' | 'main' | 'team' | 'items' | 'settings' | 'controls';

export class BattleScene extends Phaser.Scene {
  private player!: Side;
  private enemy!: Side;
  private shots: Shot[] = [];
  private t = 0;
  private paused = false;
  private over = false;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private inventory: Record<ItemId, number> = { potion: 3, ether: 3 };

  private fx!: Fx;
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
  private menu = { screen: '' as MenuScreen, idx: 0, forced: false, msg: '' };

  private ai = {
    nextFire: 1500, strafe: 1, strafeUntil: 0, aimErr: 0, aimUntil: 0,
    dodgeUntil: 0, dodge: new Phaser.Math.Vector2(), ideal: 240, hist: [] as number[], waits: 0,
    checkAt: 0, lastX: 0, lastY: 0, unstickUntil: 0, lastAct: 0,
  };

  constructor() {
    super('Battle');
  }

  create(data: { team: number[] }) {
    this.shots = [];
    this.moveTexts = [];
    this.t = 0;
    this.paused = false;
    this.over = false;
    this.inventory = { potion: 3, ether: 3 };
    this.enemySwapAt = 0;
    this.menu = { screen: '', idx: 0, forced: false, msg: '' };
    this.ai.nextFire = 1500;
    this.ai.hist = [];
    this.ai.waits = 0;
    this.ai.checkAt = 0;
    this.ai.unstickUntil = 0;
    this.ai.lastAct = 0;
    this.input.keyboard!.addCapture('UP,DOWN,LEFT,RIGHT,ENTER,SPACE');

    music.play('battle');
    void sfx.preload();
    this.drawArena();
    this.fx = new Fx(this);

    const mine = data.team.map((i) => POKEMON[i]);
    const others = Phaser.Utils.Array.Shuffle([...POKEMON]).slice(0, 3);
    this.player = this.makeSide(true, mine, A.x + 160, A.y + A.h / 2);
    this.enemy = this.makeSide(false, others, A.x + A.w - 160, A.y + A.h / 2);

    this.hud = this.add.graphics().setDepth(50);
    this.buildHudTexts();
    this.refreshMoveTexts();
    this.menuLayer = this.add.container(0, 0).setDepth(100);

    this.keys = this.input.keyboard!.addKeys('W,A,S,D,Q,E,R,U,I,O,P') as Record<string, Phaser.Input.Keyboard.Key>;
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

    this.toast('¡Comienza el combate!');
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

  private makeSide(isPlayer: boolean, defs: PokemonDef[], x: number, y: number): Side {
    const team: Member[] = defs.map((def) => ({
      def, hp: def.maxHp, energy: ENERGY_MAX, stages: newStages(), pp: def.moves.map(maxUses),
    }));
    const facing = new Phaser.Math.Vector2(isPlayer ? 1 : -1, 0);
    const sprite = this.add.image(x, y, `${defs[0].id}-walk`, 0).setScale(SPRITE_SCALE).setDepth(10);
    const shadow = this.add.ellipse(x, y + 36, 60, 18, 0x000000, 0.3).setDepth(5);
    const arrow = this.add.triangle(0, 0, 0, -9, 18, 0, 0, 9, 0xffffff, 0.85).setDepth(6);
    const aura = this.add.ellipse(x, y, 96, 104, 0xffe066, 0.3).setStrokeStyle(3, 0xffe066).setDepth(4).setVisible(false);
    return {
      isPlayer, team, active: 0, sprite, shadow, arrow, facing,
      cd: [0, 0, 0, 0], invuln: 0, kb: new Phaser.Math.Vector2(), down: false, moving: false,
      lockUntil: 0, dash: null, auraUntil: 0, aura,
    };
  }

  private cur(s: Side): Member { return s.team[s.active]; }

  // Velocidad de movimiento (px/s). Las etapas de Velocidad se notan solo en parte (SPEED_STAGE_EFFECT):
  // en los juegos deciden quién ataca primero; aquí un multiplicador completo se sentía demasiado rápido.
  private speedOf(s: Side): number {
    const m = this.cur(s);
    const base = 100 + m.def.stats.spe * 1.1;
    return Math.round(base * (1 + (stageMult(m.stages.spe) - 1) * SPEED_STAGE_EFFECT));
  }

  // ---------- bucle principal ----------

  update(_time: number, delta: number) {
    const dt = Math.min(delta, 50);
    if (!this.paused && !this.over) {
      this.t += dt;
      const s = dt / 1000;
      this.fx.beginFrame();
      this.playerInput(s);
      this.aiUpdate(s);
      this.updateDashes();
      this.separate();
      this.updateShots(s);
      this.regen(this.player, s);
      this.regen(this.enemy, s);
      if (this.enemy.down && this.enemySwapAt && this.t >= this.enemySwapAt) this.sendNextEnemy();
      this.fx.update(dt);
    }
    this.updateVisuals();
    this.drawHud();
  }

  private move(side: Side, vx: number, vy: number, s: number) {
    if (side.dash) { vx = side.dash.vx; vy = side.dash.vy; } // la embestida manda sobre el control
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
    if (this.player.down || this.enemy.down) return;
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
    const free = this.t >= p.lockUntil;
    if (settings.controls === 'keys') {
      // WASD: se camina y se apunta hacia donde se camina.
      const dir = new Phaser.Math.Vector2(
        (k.D.isDown ? 1 : 0) - (k.A.isDown ? 1 : 0),
        (k.S.isDown ? 1 : 0) - (k.W.isDown ? 1 : 0),
      );
      if (dir.lengthSq() > 0 && free) {
        dir.normalize();
        p.facing.copy(dir);
        const sp = this.speedOf(p);
        vx = dir.x * sp; vy = dir.y * sp;
      }
    } else {
      // Mouse: se camina hasta el punto del clic y se apunta siempre hacia el cursor.
      const ptr = this.input.activePointer;
      if (this.pointerSeen && free && !p.dash) {
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
  }

  // Clic izquierdo (o arrastrar con el botón apretado): fija el destino en la arena.
  private onPointer(ptr: Phaser.Input.Pointer) {
    this.pointerSeen = true;
    if (settings.controls !== 'mouse' || this.paused || this.over || this.player.down) return;
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

  private tryFire(side: Side, i: number): boolean {
    if (side.down || this.t < side.lockUntil) return false;
    const m = this.cur(side);
    const struggle = m.pp.every((n) => n <= 0); // sin PP en ningún ataque: Forcejeo
    const ci = struggle ? 0 : i; // Forcejeo comparte una sola recarga
    if (this.t < side.cd[ci]) return false;
    const mv = struggle ? STRUGGLE : m.def.moves[i];
    if (!struggle && m.pp[i] <= 0) {
      if (side.isPlayer && this.t - this.noPpAt > 700) {
        this.noPpAt = this.t;
        this.floatText(side.sprite.x, side.sprite.y - 60, '¡Sin PP!', '#ff8888');
      }
      return false;
    }
    if (m.energy < mv.cost) {
      if (side.isPlayer) this.noEnergyAt = this.t;
      return false;
    }
    m.energy -= mv.cost;
    if (side === this.enemy) this.ai.lastAct = this.t;
    if (!struggle) m.pp[i]--;
    side.cd[ci] = this.t + mv.cooldown;
    if (struggle && side.isPlayer) this.floatText(side.sprite.x, side.sprite.y - 60, '¡Forcejeo!', '#ffb86b');
    if (mv.category === 'status') {
      sfx.boost(side.sprite.x);
      this.applyBoost(side, m, mv);
      return true;
    }
    sfx.cast(mv.fx ?? 'slam', side.sprite.x);
    if (mv.style === 'dash') { this.startDash(side, m, mv); return true; }
    if (mv.style === 'reach') { this.reachAttack(side, m, mv); return true; }
    const f = side.facing;
    const fx = mv.fx ?? 'ember';
    const ox = side.sprite.x + f.x * 44, oy = side.sprite.y + f.y * 44;
    const isStream = STREAM_FX.has(fx);
    const img = this.add.image(ox, oy, HEAD_TEXTURE[fx] ?? 'orb').setScale(mv.size).setDepth(8).setVisible(!isStream);
    this.shots.push({
      img, vx: f.x * mv.speed, vy: f.y * mv.speed, owner: side, att: m, move: mv, dieAt: this.t + mv.life,
      fx, ox, oy, acc: 0, age: 0,
      stream: isStream ? { dx: f.x, dy: f.y, state: 'fly', endAt: 0 } : undefined,
    });
    return true;
  }

  // Embestida: quien ataca se lanza hacia adelante y daña a lo primero que toca.
  private startDash(side: Side, m: Member, mv: Move) {
    const f = side.facing, speed = 950;
    const ms = ((mv.dash ?? 200) / speed) * 1000;
    side.dash = { vx: f.x * speed, vy: f.y * speed, until: this.t + ms, move: mv, att: m, ghostAt: 0 };
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
      if (!target.down && this.t >= target.invuln && dist < R * 2 + 6) {
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
    const ang = Math.atan2(f.y, f.x);
    this.fx.tongue(side.sprite.x + f.x * 22, side.sprite.y + f.y * 22 - 6, ang, reach);
    side.lockUntil = this.t + 340;
    const target = side === this.player ? this.enemy : this.player;
    if (target.down || this.t < target.invuln) return;
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
    const rings = Math.max(1, Math.ceil((mv.lock ?? 0) / 450));
    for (let r = 0; r < rings; r++) {
      const ring = this.add.circle(x, y, 28, 0xffe066, 0).setStrokeStyle(4, 0xffe066).setDepth(7).setAlpha(0);
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
      sh.img.x += sh.vx * s;
      sh.img.y += sh.vy * s;
      sh.img.rotation += (SPIN[sh.fx] ?? 0) * s;
      const tr = { x: sh.img.x, y: sh.img.y, vx: sh.vx, vy: sh.vy, fx: sh.fx, ox: sh.ox, oy: sh.oy, acc: sh.acc, age: sh.age };
      this.fx.trail(tr, s * 1000);
      sh.acc = tr.acc;
      sh.age += s * 1000;
      const out = sh.img.x < A.x || sh.img.x > A.x + A.w || sh.img.y < A.y || sh.img.y > A.y + A.h;
      let done = out || this.t > sh.dieAt;
      let hitSomething = false;
      const target = sh.owner === this.player ? this.enemy : this.player;
      if (!done && !target.down && this.t >= target.invuln) {
        const d = Math.hypot(target.sprite.x - sh.img.x, target.sprite.y - sh.img.y);
        if (d < R + 14 * sh.move.size) {
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
      if (!target.down && this.t >= target.invuln) {
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
    const { damage: dmg, eff, crit } = calcDamage(att.def, mem.def, mv, true, att.stages, mem.stages);
    mem.hp = Math.max(0, mem.hp - dmg);

    target.kb.add(new Phaser.Math.Vector2(dirx * 170 * kbMul, diry * 170 * kbMul));

    this.fx.impact(mv.fx ?? 'slam', px, py, Math.atan2(diry, dirx));
    const strong = dmg >= target.team[target.active].def.maxHp * 0.1; // golpe fuerte
    if (strong) this.cameras.main.shake(110, 0.004);
    sfx.hit(mv.fx ?? 'slam', eff, crit, strong, target.sprite.x);
    target.sprite.setTint(0xff7777);
    this.time.delayedCall(110, () => target.sprite.clearTint());

    const tx = target.sprite.x, ty = target.sprite.y - 50;
    if (eff === 0) this.floatText(tx, ty, 'No afecta...', '#cccccc');
    else {
      this.floatText(tx, ty, `-${dmg}`, eff > 1 ? '#ffd23f' : '#ffffff');
      const notes = [crit ? '¡Golpe crítico!' : '', eff > 1 ? '¡Muy eficaz!' : eff < 1 ? 'Poco eficaz...' : ''].filter(Boolean);
      notes.forEach((n, i) => this.floatText(tx, ty - 22 * (i + 1), n, n.startsWith('¡G') ? '#ff6b6b' : eff > 1 ? '#ff9d3f' : '#9fb8d8'));
    }
    if (mem.hp <= 0) this.faint(target);

    if (mv.recoil && att.hp > 0) {
      const back = Math.floor(att.def.maxHp / 4);
      att.hp = Math.max(0, att.hp - back);
      this.floatText(owner.sprite.x, owner.sprite.y - 50, `-${back} (retroceso)`, '#ff9d9d');
      if (att.hp <= 0 && this.cur(owner) === att && !owner.down) this.faint(owner);
    }
  }

  // ---------- debilitados / cambios ----------

  private faint(side: Side) {
    side.down = true;
    sfx.faint(side.sprite.x);
    side.dash = null;
    side.sprite.setVisible(false);
    side.shadow.setVisible(false);
    side.arrow.setVisible(false);
    side.aura.setVisible(false);
    this.floatText(side.sprite.x, side.sprite.y - 30, `¡${this.cur(side).def.name} se debilitó!`, '#ff6666');
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
    e.sprite.setPosition(A.x + A.w - 160, A.y + A.h / 2);
    e.invuln = this.t + 1200;
    this.toast(`El rival envía a ${this.cur(e).def.name}`);
  }

  private switchTo(side: Side, idx: number) {
    this.cur(side).stages = newStages(); // las mejoras se pierden al retirar al Pokémon
    side.active = idx;
    this.cur(side).stages = newStages();
    side.lockUntil = 0;
    side.auraUntil = 0;
    side.dash = null;
    side.down = false;
    side.cd = [this.t + 300, this.t + 300, this.t + 300, this.t + 300];
    side.sprite.setVisible(true).setTexture(`${this.cur(side).def.id}-walk`, 0);
    side.shadow.setVisible(true);
    side.arrow.setVisible(true);
    if (side.isPlayer) this.refreshMoveTexts();
  }

  private finish(victory: boolean) {
    if (this.over) return;
    this.over = true;
    music.play(victory ? 'victory' : 'defeat');
    const bg = this.add.rectangle(480, 320, 960, 640, 0x000000, 0.6).setDepth(90);
    const t1 = this.add.text(480, 270, victory ? '¡VICTORIA!' : 'DERROTA', {
      fontSize: '72px', color: victory ? '#ffd23f' : '#ff6666', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(91);
    const t2 = this.add.text(480, 350, 'ENTER para volver a elegir equipo', { fontSize: '24px', color: '#fff' })
      .setOrigin(0.5).setDepth(91);
    this.menuLayer.add([bg, t1, t2]);
  }

  // ---------- IA rival ----------

  private aiUpdate(s: number) {
    const e = this.enemy, p = this.player, ai = this.ai;
    if (e.down) return;
    const locked = this.t < e.lockUntil; // concentrándose tras un ataque de mejora
    const dx = p.sprite.x - e.sprite.x, dy = p.sprite.y - e.sprite.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist, ny = dy / dist;

    if (this.t > ai.aimUntil) {
      ai.aimErr = (Math.random() - 0.5) * 0.3;
      ai.aimUntil = this.t + 500 + Math.random() * 500;
    }
    const ang = Math.atan2(dy, dx) + ai.aimErr;
    if (!locked) e.facing.set(Math.cos(ang), Math.sin(ang));

    if (this.t > ai.strafeUntil) {
      ai.strafe = Math.random() < 0.5 ? 1 : -1;
      ai.strafeUntil = this.t + 900 + Math.random() * 1600;
    }
    // Con un ataque de contacto casi listo se acerca hasta su alcance; si no, mantiene la distancia.
    const memE = this.cur(e);
    const meleeR = memE.def.moves.reduce(
      (best, mv, i) => (mv.style && memE.pp[i] > 0 && this.t >= e.cd[i] - 800 ? Math.min(best, this.rangeOf(mv)) : best), 1e9);
    let ideal = meleeR < 1e9 ? Math.min(ai.ideal, meleeR * 0.7) : ai.ideal;
    let margin = meleeR < 1e9 ? 20 : 60;
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
    mx += -ny * ai.strafe * 0.8;
    my += nx * ai.strafe * 0.8;

    // esquivar proyectiles que vienen hacia el rival
    if (this.t < ai.dodgeUntil) {
      mx += ai.dodge.x * 2.4; my += ai.dodge.y * 2.4;
    } else {
      for (const sh of this.shots) {
        if (sh.owner !== p) continue;
        const rx = e.sprite.x - sh.img.x, ry = e.sprite.y - sh.img.y;
        const d = Math.hypot(rx, ry);
        const sp = Math.hypot(sh.vx, sh.vy);
        if (d < 280 && (sh.vx * rx + sh.vy * ry) / (sp * d) > 0.92 && Math.random() < 0.05) {
          const side = Math.random() < 0.5 ? 1 : -1;
          ai.dodge.set((-sh.vy / sp) * side, (sh.vx / sp) * side);
          ai.dodgeUntil = this.t + 350;
          break;
        }
      }
    }
    mx += wx;
    my += wy;

    // Red de seguridad: si lleva ~1 s casi sin moverse (y no está concentrándose), va hacia el centro.
    if (this.t >= ai.checkAt) {
      const moved = Math.hypot(e.sprite.x - ai.lastX, e.sprite.y - ai.lastY);
      if (moved < 45 && !locked && this.t > 1500) ai.unstickUntil = this.t + 900;
      ai.lastX = e.sprite.x; ai.lastY = e.sprite.y;
      ai.checkAt = this.t + 1000;
    }
    if (this.t < ai.unstickUntil) {
      const L = Math.hypot(cx - e.sprite.x, cy - e.sprite.y) || 1;
      mx = ((cx - e.sprite.x) / L) * 1.5;
      my = ((cy - e.sprite.y) / L) * 1.5;
    }

    const len = Math.hypot(mx, my);
    const sp = this.speedOf(e) * 0.85;
    const go = len && !locked;
    this.move(e, go ? (mx / len) * sp : 0, go ? (my / len) * sp : 0, s);

    if (this.t >= ai.nextFire && !locked) this.aiAttack(dist);
  }

  // Elige el siguiente ataque del rival: varía entre los que le hacen buen daño, evita los que no
  // afectan, respeta PP y energía, y de vez en cuando se concentra para mejorar sus stats.
  private rangeOf(mv: Move): number {
    return mv.style === 'dash' ? (mv.dash ?? 200) + R * 2 : mv.style === 'reach' ? (mv.reach ?? 150) + R : (mv.speed * mv.life) / 1000;
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
    const dmg = moves.map((mv) =>
      mv.category === 'status' || !inRange(mv) ? 0 : calcDamage(mem.def, foe.def, mv, false, mem.stages, foe.stages).damage);

    // Mejora de stats: lejos del rival, con energía de sobra y si aún tiene margen de subida.
    const boost = moves.findIndex((mv, i) =>
      mv.category === 'status' && ready(i) && mem.energy >= mv.cost + 10 &&
      (Object.keys(mv.boost!) as StatKey[]).some((k) => mem.stages[k] < 2));
    // Con la energía casi llena (al empezar o tras descansar) es más probable que abra con una mejora.
    const boostChance = mem.energy >= 90 ? 0.75 : 0.4;
    if (boost >= 0 && dist > 140 && Math.random() < boostChance && this.tryFire(e, boost)) {
      ai.nextFire = this.t + 1500;
      return;
    }

    const cand = moves.map((_, i) => i).filter((i) => dmg[i] > 0 && ready(i));
    let pick = -1;
    if (cand.length) {
      const topC = Math.max(...cand.map((i) => dmg[i]));
      const pool = cand.filter((i) => dmg[i] >= topC * 0.55); // solo los que valen la pena
      // Pesos por daño, castigando repetir el mismo ataque para que vaya variando.
      const w = pool.map((i) => {
        const [last, prev] = [ai.hist[ai.hist.length - 1], ai.hist[ai.hist.length - 2]];
        return dmg[i] ** 2 * (i === last ? 0.3 : i === prev ? 0.7 : 1);
      });
      let r = Math.random() * w.reduce((a, b) => a + b, 0);
      pick = pool[pool.length - 1];
      for (let k = 0; k < pool.length; k++) {
        r -= w[k];
        if (r <= 0) { pick = pool[k]; break; }
      }
    }
    // No gastar la energía en un ataque flojo si el mejor está casi listo.
    const top = Math.max(...dmg);
    if (pick >= 0 && dmg[pick] < top * 0.6) {
      const j = dmg.indexOf(top);
      if (moves[j].cost - mem.energy <= 25 && e.cd[j] - this.t <= 1500 && mem.pp[j] > 0) pick = -1;
    }
    // Si iba a repetir el último ataque y hay otro igual de bueno casi listo, espera por ese.
    if (pick >= 0 && pick === ai.hist[ai.hist.length - 1] && ai.waits < 14) {
      const alt = moves.findIndex((mv, j) =>
        j !== pick && dmg[j] >= top * 0.55 && mem.pp[j] > 0 && mv.cost - mem.energy <= 22 && e.cd[j] - this.t <= 1200);
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
      const f = side.facing;
      const step = side.moving ? Math.floor(this.t / 180) % 2 : 0; // alterna los 2 cuadros al caminar
      side.sprite.setTexture(`${this.cur(side).def.id}-walk`, walkRow(f) * 2 + step);
      side.sprite.setAlpha(this.t < side.invuln && Math.floor(this.t / 100) % 2 ? 0.4 : 1);
      side.shadow.setPosition(side.sprite.x, side.sprite.y + 36);
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
    def.moves.forEach((mv, i) => {
      this.moveTexts[i][1].setText(mv.name);
      this.moveTexts[i][2].setText(`⚡${mv.cost}`);
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
      const frac = m.hp / m.def.maxHp;
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
    this.hudTexts.pName.setText(pm.def.name);
    this.hudTexts.pHp.setText(`${Math.ceil(pm.hp)}/${pm.def.maxHp}`);
    this.hudTexts.eName.setText(em.def.name);
    this.hudTexts.eHp.setText(`${Math.ceil(em.hp)}/${em.def.maxHp}`);
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
    if (this.over) {
      if (e.key === 'Enter') this.scene.start('Select');
      return;
    }
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
      if (m.forced) return;
      if (m.screen === 'main') { this.closeMenu(); return; }
      if (m.screen === 'controls') { m.screen = 'settings'; m.idx = 2; m.msg = ''; }
      else if (m.screen === 'settings') { m.screen = 'main'; m.idx = 3; m.msg = ''; }
      else { m.screen = 'main'; m.idx = 0; m.msg = ''; }
    } else return;
    this.renderMenu();
  }

  private menuOptions(): string[] {
    const m = this.menu;
    if (m.screen === 'main') return ['Continuar', 'Pokémon', 'Objetos', 'Configuración', 'Salir al menú de equipos'];
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
      const list = this.player.team.map((mem, i) => {
        const tag = mem.hp <= 0 ? '  (debilitado)' : i === this.player.active && !this.player.down ? '  (en combate)' : '';
        return `${mem.def.name}   PS ${Math.ceil(mem.hp)}/${mem.def.maxHp}${tag}`;
      });
      return m.forced ? list : [...list, 'Atrás'];
    }
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
    this.menu = { screen, idx: 0, forced, msg: forced ? 'Elige tu siguiente Pokémon' : '' };
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
    const opts = this.menuOptions();
    const h = 120 + opts.length * 40 + (m.screen === 'controls' ? 30 : 0);
    const y0 = 320 - h / 2;
    const title = {
      main: 'PAUSA', team: 'POKÉMON', items: 'OBJETOS', settings: 'CONFIGURACIÓN', controls: 'CONTROLES', '': '',
    }[m.screen];
    const hint = m.screen === 'settings' ? '← → ajustar volumen · ENTER abrir · ESC volver'
      : m.screen === 'controls' ? this.controlsHint(m.idx) : '↑ ↓ mover · ENTER aceptar · ESC volver';
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
      if (i === 0) { this.closeMenu(); return; } // al cerrar no se vuelve a dibujar el menú
      else if (i === 1) { m.screen = 'team'; m.idx = p.active; m.msg = ''; }
      else if (i === 2) { m.screen = 'items'; m.idx = 0; m.msg = ''; }
      else if (i === 3) { m.screen = 'settings'; m.idx = 0; m.msg = ''; }
      else this.scene.start('Select');
    } else if (m.screen === 'settings') {
      if (i === 2) { m.screen = 'controls'; m.idx = settings.controls === 'keys' ? 0 : 1; m.msg = ''; }
      else if (i === 3) { m.screen = 'main'; m.idx = 3; m.msg = ''; }
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
      else if (p.team[i].hp <= 0) m.msg = 'Ese Pokémon está debilitado.';
      else if (i === p.active && !p.down) m.msg = 'Ya está en combate.';
      else {
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
        const full = k === 'potion' ? mem.hp >= mem.def.maxHp : mem.energy >= ENERGY_MAX;
        if (this.inventory[k] <= 0) m.msg = 'No te quedan.';
        else if (full) m.msg = 'No tendría efecto.';
        else {
          const hp0 = mem.hp, en0 = mem.energy;
          this.inventory[k]--;
          mem.hp = Math.min(mem.def.maxHp, mem.hp + ITEMS[k].hp);
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
