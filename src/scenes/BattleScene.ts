import Phaser from 'phaser';
import {
  POKEMON, PokemonDef, Move, effectiveness, TYPE_COLOR, ITEMS, ItemId, ENERGY_MAX, ENERGY_REGEN,
} from '../data';

const A = { x: 20, y: 84, w: 920, h: 480 }; // arena
const R = 30; // radio de colisión de los Pokémon
const MOVE_KEYS = ['U', 'I', 'O', 'P'];

interface Member { def: PokemonDef; hp: number; energy: number }

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
}

interface Shot {
  img: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  owner: Side;
  move: Move;
  dieAt: number;
}

type MenuScreen = '' | 'main' | 'team' | 'items';

export class BattleScene extends Phaser.Scene {
  private player!: Side;
  private enemy!: Side;
  private shots: Shot[] = [];
  private t = 0;
  private paused = false;
  private over = false;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private inventory: Record<ItemId, number> = { potion: 3, ether: 3 };

  private hud!: Phaser.GameObjects.Graphics;
  private hudTexts!: Record<string, Phaser.GameObjects.Text>;
  private moveTexts: Phaser.GameObjects.Text[][] = [];
  private noEnergyAt = -9999;
  private enemySwapAt = 0;

  private menuLayer!: Phaser.GameObjects.Container;
  private menu = { screen: '' as MenuScreen, idx: 0, forced: false, msg: '' };

  private ai = {
    nextFire: 1500, strafe: 1, strafeUntil: 0, aimErr: 0, aimUntil: 0,
    dodgeUntil: 0, dodge: new Phaser.Math.Vector2(), ideal: 240,
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
    this.input.keyboard!.addCapture('UP,DOWN,LEFT,RIGHT,ENTER,SPACE');

    this.drawArena();

    const mine = data.team.map((i) => POKEMON[i]);
    const others = Phaser.Utils.Array.Shuffle([...POKEMON]).slice(0, 3);
    this.player = this.makeSide(true, mine, A.x + 160, A.y + A.h / 2);
    this.enemy = this.makeSide(false, others, A.x + A.w - 160, A.y + A.h / 2);

    this.hud = this.add.graphics().setDepth(50);
    this.buildHudTexts();
    this.refreshMoveTexts();
    this.menuLayer = this.add.container(0, 0).setDepth(100);

    this.keys = this.input.keyboard!.addKeys('W,A,S,D,U,I,O,P') as Record<string, Phaser.Input.Keyboard.Key>;
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
    const team = defs.map((def) => ({ def, hp: def.maxHp, energy: ENERGY_MAX }));
    const facing = new Phaser.Math.Vector2(isPlayer ? 1 : -1, 0);
    const sprite = this.add.image(x, y, `${defs[0].id}-front`).setDepth(10);
    const shadow = this.add.ellipse(x, y + 36, 60, 18, 0x000000, 0.3).setDepth(5);
    const arrow = this.add.triangle(0, 0, 0, -9, 18, 0, 0, 9, 0xffffff, 0.85).setDepth(6);
    return {
      isPlayer, team, active: 0, sprite, shadow, arrow, facing,
      cd: [0, 0, 0, 0], invuln: 0, kb: new Phaser.Math.Vector2(), down: false,
    };
  }

  private cur(s: Side): Member { return s.team[s.active]; }

  // ---------- bucle principal ----------

  update(_time: number, delta: number) {
    const dt = Math.min(delta, 50);
    if (!this.paused && !this.over) {
      this.t += dt;
      const s = dt / 1000;
      this.playerInput(s);
      this.aiUpdate(s);
      this.separate();
      this.updateShots(s);
      this.regen(this.player, s);
      this.regen(this.enemy, s);
      if (this.enemy.down && this.enemySwapAt && this.t >= this.enemySwapAt) this.sendNextEnemy();
    }
    this.updateVisuals();
    this.drawHud();
  }

  private move(side: Side, vx: number, vy: number, s: number) {
    side.kb.scale(Math.pow(0.04, s)); // el empujón se amortigua rápido
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
    const dir = new Phaser.Math.Vector2(
      (k.D.isDown ? 1 : 0) - (k.A.isDown ? 1 : 0),
      (k.S.isDown ? 1 : 0) - (k.W.isDown ? 1 : 0),
    );
    let vx = 0, vy = 0;
    if (dir.lengthSq() > 0) {
      dir.normalize();
      p.facing.copy(dir);
      const sp = this.cur(p).def.speed;
      vx = dir.x * sp; vy = dir.y * sp;
    }
    this.move(p, vx, vy, s);
    MOVE_KEYS.forEach((key, i) => {
      if (k[key].isDown) this.tryFire(p, i);
    });
  }

  // ---------- ataques ----------

  private tryFire(side: Side, i: number): boolean {
    if (side.down || this.t < side.cd[i]) return false;
    const m = this.cur(side);
    const mv = m.def.moves[i];
    if (m.energy < mv.cost) {
      if (side.isPlayer) this.noEnergyAt = this.t;
      return false;
    }
    m.energy -= mv.cost;
    side.cd[i] = this.t + mv.cooldown;
    const f = side.facing;
    const img = this.add.image(side.sprite.x + f.x * 44, side.sprite.y + f.y * 44, 'orb')
      .setTint(TYPE_COLOR[mv.type]).setScale(mv.size).setDepth(8);
    this.shots.push({
      img, vx: f.x * mv.speed, vy: f.y * mv.speed, owner: side, move: mv, dieAt: this.t + mv.life,
    });
    return true;
  }

  private updateShots(s: number) {
    for (let n = this.shots.length - 1; n >= 0; n--) {
      const sh = this.shots[n];
      sh.img.x += sh.vx * s;
      sh.img.y += sh.vy * s;
      const out = sh.img.x < A.x || sh.img.x > A.x + A.w || sh.img.y < A.y || sh.img.y > A.y + A.h;
      let done = out || this.t > sh.dieAt;
      const target = sh.owner === this.player ? this.enemy : this.player;
      if (!done && !target.down && this.t >= target.invuln) {
        const d = Math.hypot(target.sprite.x - sh.img.x, target.sprite.y - sh.img.y);
        if (d < R + 14 * sh.move.size) {
          this.hit(sh, target);
          done = true;
        }
      }
      if (done) {
        sh.img.destroy();
        this.shots.splice(n, 1);
      }
    }
  }

  private hit(sh: Shot, target: Side) {
    const mem = this.cur(target);
    const eff = effectiveness(sh.move.type, mem.def.types);
    const dmg = Math.round(sh.move.power * eff * (0.9 + Math.random() * 0.2));
    mem.hp = Math.max(0, mem.hp - dmg);

    const len = Math.hypot(sh.vx, sh.vy) || 1;
    target.kb.add(new Phaser.Math.Vector2((sh.vx / len) * 170, (sh.vy / len) * 170));

    const color = TYPE_COLOR[sh.move.type];
    const fx = this.add.circle(sh.img.x, sh.img.y, 10, color, 0.8).setDepth(9);
    this.tweens.add({ targets: fx, scale: 3.5, alpha: 0, duration: 260, onComplete: () => fx.destroy() });
    target.sprite.setTint(0xff7777);
    this.time.delayedCall(110, () => target.sprite.clearTint());

    const tx = target.sprite.x, ty = target.sprite.y - 50;
    if (eff === 0) this.floatText(tx, ty, 'No afecta...', '#cccccc');
    else {
      this.floatText(tx, ty, `-${dmg}`, eff > 1 ? '#ffd23f' : '#ffffff');
      if (eff > 1) this.floatText(tx, ty - 22, '¡Muy eficaz!', '#ff9d3f');
      else if (eff < 1) this.floatText(tx, ty - 22, 'Poco eficaz...', '#9fb8d8');
    }
    if (mem.hp <= 0) this.faint(target);
  }

  // ---------- debilitados / cambios ----------

  private faint(side: Side) {
    side.down = true;
    side.sprite.setVisible(false);
    side.shadow.setVisible(false);
    side.arrow.setVisible(false);
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
    side.active = idx;
    side.down = false;
    side.cd = [this.t + 300, this.t + 300, this.t + 300, this.t + 300];
    side.sprite.setVisible(true).setTexture(`${this.cur(side).def.id}-front`);
    side.shadow.setVisible(true);
    side.arrow.setVisible(true);
    if (side.isPlayer) this.refreshMoveTexts();
  }

  private finish(victory: boolean) {
    this.over = true;
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
    const dx = p.sprite.x - e.sprite.x, dy = p.sprite.y - e.sprite.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist, ny = dy / dist;

    if (this.t > ai.aimUntil) {
      ai.aimErr = (Math.random() - 0.5) * 0.3;
      ai.aimUntil = this.t + 500 + Math.random() * 500;
    }
    const ang = Math.atan2(dy, dx) + ai.aimErr;
    e.facing.set(Math.cos(ang), Math.sin(ang));

    if (this.t > ai.strafeUntil) {
      ai.strafe = Math.random() < 0.5 ? 1 : -1;
      ai.strafeUntil = this.t + 900 + Math.random() * 1600;
    }
    let mx = 0, my = 0;
    if (dist > ai.ideal + 60) { mx = nx; my = ny; }
    else if (dist < ai.ideal - 70) { mx = -nx; my = -ny; }
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
    // alejarse de las paredes
    if (e.sprite.x < A.x + 90) mx += 1;
    if (e.sprite.x > A.x + A.w - 90) mx -= 1;
    if (e.sprite.y < A.y + 90) my += 1;
    if (e.sprite.y > A.y + A.h - 90) my -= 1;

    const len = Math.hypot(mx, my);
    const sp = this.cur(e).def.speed * 0.85;
    this.move(e, len ? (mx / len) * sp : 0, len ? (my / len) * sp : 0, s);

    if (this.t >= ai.nextFire) {
      const mem = this.cur(e);
      let best = -1, bestScore = -1;
      mem.def.moves.forEach((mv, i) => {
        if (this.t < e.cd[i] || mem.energy < mv.cost) return;
        if (dist > ((mv.speed * mv.life) / 1000) * 0.9) return;
        const score = mv.power * effectiveness(mv.type, this.cur(p).def.types) + Math.random() * 10;
        if (score > bestScore) { bestScore = score; best = i; }
      });
      if (best >= 0 && this.tryFire(e, best)) ai.nextFire = this.t + 400 + Math.random() * 600;
      else ai.nextFire = this.t + 150;
    }
  }

  // ---------- visuales ----------

  private updateVisuals() {
    for (const side of [this.player, this.enemy]) {
      if (side.down) continue;
      const f = side.facing;
      const goingUp = f.y < 0 && Math.abs(f.y) > Math.abs(f.x);
      const id = this.cur(side).def.id;
      side.sprite.setTexture(`${id}-${goingUp ? 'back' : 'front'}`);
      side.sprite.setFlipX(goingUp ? f.x < 0 : f.x > 0);
      side.sprite.setAlpha(this.t < side.invuln && Math.floor(this.t / 100) % 2 ? 0.4 : 1);
      side.shadow.setPosition(side.sprite.x, side.sprite.y + 36);
      side.arrow.setPosition(side.sprite.x + f.x * 62, side.sprite.y + f.y * 62).setRotation(Math.atan2(f.y, f.x));
      side.sprite.setDepth(10 + side.sprite.y / 1000);
    }
  }

  private buildHudTexts() {
    const st = (size: number, color = '#fff') => ({ fontSize: `${size}px`, color });
    this.hudTexts = {
      pName: this.add.text(20, 8, '', st(20)).setDepth(51),
      pHp: this.add.text(330, 33, '', st(13)).setOrigin(1, 0).setDepth(51),
      eName: this.add.text(940, 8, '', st(20)).setOrigin(1, 0).setDepth(51),
      eHp: this.add.text(630, 33, '', st(13)).setDepth(51),
      items: this.add.text(940, 575, '', st(15, '#cfe8cf')).setOrigin(1, 0).setDepth(51),
      help: this.add.text(940, 600, 'WASD mover · U I O P atacar · ENTER menú', st(15, '#9fb8a6')).setOrigin(1, 0).setDepth(51),
      toast: this.add.text(480, 110, '', { fontSize: '26px', color: '#fff', stroke: '#000', strokeThickness: 5 })
        .setOrigin(0.5).setDepth(60).setAlpha(0),
    };
    for (let i = 0; i < 4; i++) {
      const x = 20 + i * 150;
      this.moveTexts.push([
        this.add.text(x + 8, 578, MOVE_KEYS[i], { fontSize: '20px', color: '#ffd23f', fontStyle: 'bold' }).setDepth(51),
        this.add.text(x + 32, 580, '', { fontSize: '14px', color: '#fff' }).setDepth(51),
        this.add.text(x + 32, 600, '', { fontSize: '12px', color: '#9fb8a6' }).setDepth(51),
      ]);
    }
  }

  private refreshMoveTexts() {
    const def = this.cur(this.player).def;
    def.moves.forEach((mv, i) => {
      this.moveTexts[i][1].setText(mv.name);
      this.moveTexts[i][2].setText(`${mv.type} · ⚡${mv.cost}`);
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
    this.hudTexts.items.setText(`Poción x${this.inventory.potion}   Éter x${this.inventory.ether}`);

    pm.def.moves.forEach((mv, i) => {
      const x = 20 + i * 150;
      g.lineStyle(3, TYPE_COLOR[mv.type]).strokeRect(x, 576, 140, 56);
      const cdLeft = Phaser.Math.Clamp((this.player.cd[i] - this.t) / mv.cooldown, 0, 1);
      if (cdLeft > 0) g.fillStyle(0x000000, 0.55).fillRect(x, 576 + 56 * (1 - cdLeft), 140, 56 * cdLeft);
      if (pm.energy < mv.cost) g.fillStyle(0x7a1f1f, 0.45).fillRect(x, 576, 140, 56);
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
    else if (e.key === 'Enter') { this.activate(m.idx); return; }
    else if (e.key === 'Escape' || e.key === 'Backspace') {
      if (m.forced) return;
      if (m.screen === 'main') { this.closeMenu(); return; }
      m.screen = 'main'; m.idx = 0; m.msg = '';
    } else return;
    this.renderMenu();
  }

  private menuOptions(): string[] {
    const m = this.menu;
    if (m.screen === 'main') return ['Continuar', 'Pokémon', 'Objetos', 'Salir al menú de equipos'];
    if (m.screen === 'team') {
      const list = this.player.team.map((mem, i) => {
        const tag = mem.hp <= 0 ? '  (debilitado)' : i === this.player.active && !this.player.down ? '  (en combate)' : '';
        return `${mem.def.name}   PS ${Math.ceil(mem.hp)}/${mem.def.maxHp}${tag}`;
      });
      return m.forced ? list : [...list, 'Volver'];
    }
    return [
      ...(['potion', 'ether'] as ItemId[]).map((k) => `${ITEMS[k].name} x${this.inventory[k]}   ${ITEMS[k].desc}`),
      'Volver',
    ];
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
    const opts = this.menuOptions();
    const h = 120 + opts.length * 40;
    const y0 = 320 - h / 2;
    const title = { main: 'PAUSA', team: 'POKÉMON', items: 'OBJETOS', '': '' }[m.screen];
    const items: Phaser.GameObjects.GameObject[] = [
      this.add.rectangle(480, 320, 960, 640, 0x000000, 0.55),
      this.add.rectangle(480, 320, 520, h, 0x1b2a1e).setStrokeStyle(4, 0xffd23f),
      this.add.text(480, y0 + 26, title, { fontSize: '26px', color: '#ffd23f', fontStyle: 'bold' }).setOrigin(0.5),
    ];
    opts.forEach((o, i) => {
      const sel = i === m.idx;
      items.push(this.add.text(250, y0 + 64 + i * 40, `${sel ? '▶ ' : '   '}${o}`, {
        fontSize: '22px', color: sel ? '#ffffff' : '#9fb8a6', fontStyle: sel ? 'bold' : 'normal',
      }));
    });
    items.push(this.add.text(480, y0 + h - 22, m.msg || '↑ ↓ mover · ENTER aceptar · ESC volver', {
      fontSize: '15px', color: '#cfe8cf',
    }).setOrigin(0.5));
    this.menuLayer.add(items);
  }

  private activate(i: number) {
    const m = this.menu;
    const p = this.player;
    if (m.screen === 'main') {
      if (i === 0) this.closeMenu();
      else if (i === 1) { m.screen = 'team'; m.idx = p.active; m.msg = ''; }
      else if (i === 2) { m.screen = 'items'; m.idx = 0; m.msg = ''; }
      else this.scene.start('Select');
    } else if (m.screen === 'team') {
      if (i >= p.team.length) { m.screen = 'main'; m.idx = 1; m.msg = ''; }
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
      if (i >= 2) { m.screen = 'main'; m.idx = 2; m.msg = ''; }
      else {
        const k = (['potion', 'ether'] as ItemId[])[i];
        const mem = this.cur(p);
        const full = k === 'potion' ? mem.hp >= mem.def.maxHp : mem.energy >= ENERGY_MAX;
        if (this.inventory[k] <= 0) m.msg = 'No te quedan.';
        else if (full) m.msg = 'No tendría efecto.';
        else {
          this.inventory[k]--;
          mem.hp = Math.min(mem.def.maxHp, mem.hp + ITEMS[k].hp);
          mem.energy = Math.min(ENERGY_MAX, mem.energy + ITEMS[k].energy);
          m.msg = `${mem.def.name} usó ${ITEMS[k].name}.`;
        }
      }
    }
    this.renderMenu();
  }
}
