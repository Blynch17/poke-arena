// Efectos visuales de los estados alterados: rayitos (parálisis), Z Z Z (sueño), burbujas moradas (veneno), llamitas
// (quemadura), bloque de hielo (congelación) y estrellas giratorias (confusión). Se dibujan en una capa propia sobre los
// Pokémon; el tinte del sprite lo pone BattleScene.

import Phaser from 'phaser';
import type { StatusId } from './status';

interface Part {
  key: string; kind: 'z' | 'bubble' | 'flame' | 'bolt' | 'glint';
  x: number; y: number; vx: number; vy: number; age: number; life: number; size: number; color: number; pts?: number[];
}

/** Lo que hace falta saber de cada combatiente para dibujarle el estado. */
export interface StatusView { key: string; x: number; y: number; status: StatusId | null; confused: boolean; visible: boolean }

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export class StatusFx {
  private g: Phaser.GameObjects.Graphics;
  private parts: Part[] = [];
  private next = new Map<string, number>();
  private clock = 0;

  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(12);
  }

  destroy() { this.g.destroy(); }

  /** Avanza `dt` ms (0 con el juego en pausa: se ve todo quieto) y vuelve a dibujar. */
  update(dt: number, views: StatusView[]) {
    this.clock += dt;
    this.track(views);
    const g = this.g;
    g.clear();
    const live = new Set(views.filter((v) => v.visible).map((v) => v.key));
    this.parts = this.parts.filter((p) => live.has(p.key) && p.age < p.life);
    for (const v of views) {
      if (!v.visible) continue;
      if (dt > 0) this.spawn(v);
      if (v.status === 'freeze') this.iceBlock(v);
      if (v.confused) this.stars(v);
    }
    for (const p of this.parts) {
      p.age += dt;
      p.x += (p.vx * dt) / 1000;
      p.y += (p.vy * dt) / 1000;
      this.drawPart(p);
    }
  }

  private due(key: string, every: number): boolean {
    if (this.clock < (this.next.get(key) ?? 0)) return false;
    this.next.set(key, this.clock + every * rnd(0.8, 1.25));
    return true;
  }

  private spawn(v: StatusView) {
    const { key, x, y } = v;
    switch (v.status) {
      case 'paralysis':
        if (this.due(key + 'b', 120)) {
          this.parts = this.parts.filter((p) => !(p.key === key && p.kind === 'bolt'));   // cada destello reemplaza al anterior
          for (let i = 0; i < 4; i++) {
            const a = rnd(0, Math.PI * 2), r0 = rnd(28, 40), len = rnd(18, 30);
            const pts: number[] = [];
            let px = x + Math.cos(a) * r0, py = y + Math.sin(a) * r0 * 0.9;
            pts.push(px, py);
            for (let k = 1; k <= 3; k++) {
              const aa = a + rnd(-0.7, 0.7);
              px += Math.cos(aa) * len / 3; py += Math.sin(aa) * len / 3;
              pts.push(px, py);
            }
            this.parts.push({ key, kind: 'bolt', x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 150, size: rnd(2, 3.4), color: 0xfff27a, pts: pts.map((n, i) => n - (i % 2 === 0 ? x : y)) });
          }
        }
        break;
      case 'sleep':
        if (this.due(key + 'z', 800)) this.parts.push({ key, kind: 'z', x: x + 22, y: y - 38, vx: 15, vy: -32, age: 0, life: 2000, size: 10, color: 0xe4ecff });
        break;
      case 'poison':
      case 'toxic':
        if (this.due(key + 'p', v.status === 'toxic' ? 150 : 230)) {
          this.parts.push({ key, kind: 'bubble', x: x + rnd(-28, 28), y: y + rnd(0, 30), vx: rnd(-8, 8), vy: -rnd(34, 62), age: 0, life: rnd(800, 1200), size: rnd(3, 7), color: v.status === 'toxic' ? 0x8a35c0 : 0xb45cd6 });
        }
        break;
      case 'burn':
        if (this.due(key + 'f', 110)) {
          this.parts.push({ key, kind: 'flame', x: x + rnd(-26, 26), y: y + rnd(-6, 26), vx: rnd(-14, 14), vy: -rnd(55, 95), age: 0, life: rnd(450, 700), size: rnd(4, 8), color: [0xff4d1a, 0xff8c1f, 0xffc93c][Math.floor(rnd(0, 3))] });
        }
        break;
      case 'freeze':
        if (this.due(key + 'g', 420)) this.parts.push({ key, kind: 'glint', x: x + rnd(-30, 30), y: y + rnd(-38, 36), vx: 0, vy: 0, age: 0, life: 420, size: rnd(5, 9), color: 0xffffff });
        break;
      default: break;
    }
  }

  private drawPart(p: Part) {
    const g = this.g, k = Math.min(1, p.age / p.life);
    if (p.kind === 'z') {   // una Z que sube, crece y se desvanece
      const s = p.size * (1 + k * 1.1), a = k < 0.15 ? k / 0.15 : 1 - Math.max(0, (k - 0.55) / 0.45);
      const pts = [[0, 0], [s, 0], [0, s], [s, s]].map(([dx, dy]) => [p.x + dx, p.y + dy]);
      for (const [w, col, al] of [[5, 0x20243c, 0.8 * a], [2.5, p.color, a]] as const) {
        g.lineStyle(w, col, al).beginPath().moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < 4; i++) g.lineTo(pts[i][0], pts[i][1]);
        g.strokePath();
      }
    } else if (p.kind === 'bubble') {
      const r = p.size * (1 - k * 0.3), a = 0.75 * (1 - k * k);
      g.fillStyle(p.color, a).fillCircle(p.x, p.y, r);
      g.lineStyle(1.5, 0xe2b8f5, a).strokeCircle(p.x, p.y, r);
      g.fillStyle(0xffffff, a * 0.7).fillCircle(p.x - r * 0.35, p.y - r * 0.35, Math.max(1, r * 0.25));
    } else if (p.kind === 'flame') {
      const r = p.size * (1 - k), a = 0.9 * (1 - k * 0.6);
      g.fillStyle(p.color, a);
      g.fillTriangle(p.x - r * 0.8, p.y + r * 0.6, p.x + r * 0.8, p.y + r * 0.6, p.x, p.y - r * 1.8);
      g.fillCircle(p.x, p.y + r * 0.3, r * 0.8);
    } else if (p.kind === 'glint') {
      const s = p.size * Math.sin(Math.PI * k);
      g.lineStyle(2, p.color, 0.95).lineBetween(p.x - s, p.y, p.x + s, p.y).lineBetween(p.x, p.y - s, p.x, p.y + s);
    } else if (p.kind === 'bolt' && p.pts) {
      const pts = p.pts;
      for (const [w, col] of [[p.size + 2, 0xc89a00], [p.size - 0.5, p.color]] as const) {
        g.lineStyle(w, col, 1 - k * 0.5).beginPath().moveTo(this.anchorX(p, pts[0]), this.anchorY(p, pts[1]));
        for (let i = 2; i < pts.length; i += 2) g.lineTo(this.anchorX(p, pts[i]), this.anchorY(p, pts[i + 1]));
        g.strokePath();
      }
    }
  }

  // Los rayitos se guardan relativos al Pokémon (para que lo sigan si se mueve).
  private pos = new Map<string, { x: number; y: number }>();
  private anchorX(p: Part, dx: number) { return (this.pos.get(p.key)?.x ?? 0) + dx; }
  private anchorY(p: Part, dy: number) { return (this.pos.get(p.key)?.y ?? 0) + dy; }

  /** Guarda dónde está cada combatiente (los rayitos son relativos a él). Llamar antes de `update`. */
  track(views: StatusView[]) { for (const v of views) this.pos.set(v.key, { x: v.x, y: v.y }); }

  private iceBlock(v: StatusView) {
    const g = this.g, w = 84, h = 96, x = v.x - w / 2, y = v.y - h / 2 - 2;
    g.fillStyle(0x8fe0ff, 0.34).fillRoundedRect(x, y, w, h, 12);
    g.fillStyle(0xffffff, 0.16).fillRoundedRect(x + 6, y + 6, w * 0.42, h - 12, 8);
    g.lineStyle(3, 0xe6f8ff, 0.9).strokeRoundedRect(x, y, w, h, 12);
    g.lineStyle(2, 0xffffff, 0.75).lineBetween(x + 14, y + 22, x + 30, y + 10).lineBetween(x + 18, y + 40, x + 44, y + 14);
    g.fillStyle(0xcdf1ff, 0.9).fillTriangle(x + 8, y - 2, x + 20, y - 2, x + 14, y - 14);   // puntas de hielo
    g.fillTriangle(x + w - 24, y - 2, x + w - 8, y - 2, x + w - 15, y - 17);
  }

  private stars(v: StatusView) {
    const g = this.g;
    for (let i = 0; i < 3; i++) {
      const a = this.clock / 240 + (i * Math.PI * 2) / 3;
      const sx = v.x + Math.cos(a) * 30, sy = v.y - 50 + Math.sin(a) * 9, r = 8 + Math.sin(a) * 2;
      const pts: Phaser.Math.Vector2[] = [];
      for (let k = 0; k < 10; k++) {
        const rr = k % 2 === 0 ? r : r * 0.45, aa = -Math.PI / 2 + (k * Math.PI) / 5 + this.clock / 500;
        pts.push(new Phaser.Math.Vector2(sx + Math.cos(aa) * rr, sy + Math.sin(aa) * rr));
      }
      g.fillStyle(0xffe45c, 1).fillPoints(pts as unknown as Phaser.Math.Vector2[], true);
      g.lineStyle(1.5, 0x8a6a00, 1).strokePoints(pts as unknown as Phaser.Math.Vector2[], true);
    }
  }
}
