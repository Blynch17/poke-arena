// Efectos que se dibujan sobre el rival cuando un ataque de contacto le da: garras, puños, mordiscos, cuernos...
// Se suman al impacto de siempre (llamas, rayos, agua...). Cada efecto es una pequeña animación en el tiempo (h.age, ms)
// dibujada cada cuadro; los colores salen de la paleta del tipo del ataque.

import Phaser from 'phaser';

export interface Hit {
  kind: string;
  x: number; y: number;       // dónde está el rival
  ang: number;                // dirección del golpe (de quien ataca hacia el rival)
  power: number;
  pal: number[];              // de más claro a más oscuro
  ox: number; oy: number;     // dónde está quien ataca
  type: string;               // tipo del ataque (para detalles como las llamas del fuego)
  age: number;
  life: number;
  seed: number;
  fired: boolean;             // las partículas de la animación ya se soltaron
  mark: number;               // cuántos golpes de la animación ya soltaron su destello
}

export interface HitApi {
  spawn(x: number, y: number, o: { vx?: number; vy?: number; life: number; s0: number; s1?: number; a0?: number; a1?: number; g?: number; colors: number[]; spin?: number; rot?: number; len?: number }): void;
  ring(x: number, y: number, color: number, r0: number, r1: number, life: number, width?: number): void;
  shake(ms: number, intensity: number): void;
}

/** Duración (ms) de cada efecto. */
export const HIT_LIFE: Record<string, number> = {
  claw: 420, claws: 480, chop: 330, crosschop: 520, dragonclaw: 520, darkslash: 420, xcut: 600, whip: 460, vinewhips: 620,
  horn: 440, megahorn: 520, jab: 460, stomp: 520, fang: 460, bite: 440, crunch: 780, fist: 460, dynpunch: 640, superpower: 760,
  kick: 520, spinkick: 520, tail: 560, bigimpact: 520, megaimpact: 680, firewheel: 560, hammer: 560, wing: 460, airblades: 460,
  drain: 700, bricks: 620, grapple: 620, headbutt: 400, waterfall: 520, speedlines: 360,
};

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (k: number) => 1 - (1 - k) * (1 - k);
type P = { x: number; y: number };
const at = (h: Hit, u: number, v: number): P => ({ x: h.x + Math.cos(h.ang) * u - Math.sin(h.ang) * v, y: h.y + Math.sin(h.ang) * u + Math.cos(h.ang) * v });

/** Polígono relleno a partir de puntos en coordenadas locales (u hacia el golpe, v hacia el costado). */
function poly(g: Phaser.GameObjects.Graphics, h: Hit, pts: [number, number][], color: number, alpha = 1, line?: number) {
  const w = pts.map(([u, v]) => at(h, u, v));
  g.fillStyle(color, alpha).fillPoints(w as unknown as Phaser.Math.Vector2[], true);
  if (line !== undefined) g.lineStyle(3, line, alpha).strokePoints(w as unknown as Phaser.Math.Vector2[], true, true);
}

/** Trazo que se afina en las puntas siguiendo una curva. */
function taper(g: Phaser.GameObjects.Graphics, pts: P[], w: number, color: number, alpha = 1) {
  if (pts.length < 2) return;
  const L: P[] = [], R: P[] = [];
  pts.forEach((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const tx = b.x - a.x, ty = b.y - a.y, len = Math.hypot(tx, ty) || 1;
    const ww = w * Math.pow(Math.sin((Math.PI * i) / (pts.length - 1)), 0.7);
    L.push({ x: p.x - (ty / len) * ww, y: p.y + (tx / len) * ww });
    R.push({ x: p.x + (ty / len) * ww, y: p.y - (tx / len) * ww });
  });
  g.fillStyle(color, alpha).fillPoints([...L, ...R.reverse()] as unknown as Phaser.Math.Vector2[], true);
}

/** Puntos de una curva entre dos puntos, con una panza hacia un costado; se dibuja solo la fracción k. */
function curve(a: P, b: P, bulge: number, k: number, n = 12): P[] {
  const out: P[] = [], dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const m = Math.max(2, Math.round(n * clamp(k)) + 1);
  for (let i = 0; i < m; i++) {
    const u = (i / (m - 1)) * clamp(k), s = Math.sin(Math.PI * u) * bulge;
    out.push({ x: a.x + dx * u + nx * s, y: a.y + dy * u + ny * s });
  }
  return out;
}

/** Tajo con brillo: una franja ancha tenue debajo y el filo claro encima. */
function slash(g: Phaser.GameObjects.Graphics, a: P, b: P, bulge: number, w: number, h: Hit, k: number, alpha: number) {
  const pts = curve(a, b, bulge, k);
  taper(g, pts, w * 1.9, h.pal[2] ?? h.pal[1] ?? h.pal[0], 0.45 * alpha);
  taper(g, pts, w, h.pal[1] ?? h.pal[0], alpha);
  taper(g, pts, w * 0.45, h.pal[0], alpha);
}

const scale = (h: Hit) => clamp(0.75 + (h.power - 40) / 90, 0.75, 1.6);

function burstStar(g: Phaser.GameObjects.Graphics, h: Hit, spikes: number, len: number, k: number, alpha: number) {
  const rng = (i: number) => (Math.sin(h.seed + i * 12.9898) * 43758.5453) % 1;
  for (let i = 0; i < spikes; i++) {
    const a = (i * Math.PI * 2) / spikes + (h.seed % 1), l = len * (i % 2 ? 0.55 : 1) * (0.85 + 0.3 * Math.abs(rng(i)));
    const w = 0.13 + 0.05 * (i % 2);
    const tip = { x: h.x + Math.cos(a) * l * ease(k), y: h.y + Math.sin(a) * l * ease(k) };
    const b1 = { x: h.x + Math.cos(a + Math.PI / 2) * len * w * 0.45, y: h.y + Math.sin(a + Math.PI / 2) * len * w * 0.45 };
    const b2 = { x: h.x - Math.cos(a + Math.PI / 2) * len * w * 0.45, y: h.y - Math.sin(a + Math.PI / 2) * len * w * 0.45 };
    g.fillStyle(i % 2 ? h.pal[1] ?? h.pal[0] : h.pal[0], alpha).fillTriangle(b1.x, b1.y, tip.x, tip.y, b2.x, b2.y);
  }
}

/** Puño: llega desde atrás, golpea y se queda un instante. Llamas, rayos o cristales lo rodean según el tipo. */
function fist(g: Phaser.GameObjects.Graphics, h: Hit, api: HitApi, big: number) {
  const s = scale(h) * big, t = h.age;
  const k = ease(clamp(t / 110)), fade = 1 - clamp((t - 280) / (h.life - 280));
  const back = -90 * s * (1 - k);
  const U = (u: number, v: number): [number, number] => [u + back, v];
  const c0 = h.pal[0], c1 = h.pal[1] ?? c0, c2 = h.pal[2] ?? c1, c3 = h.pal[h.pal.length - 1];
  const dot = (u: number, v: number, r: number, color: number, a = 1) => { const q = at(h, u + back, v); g.fillStyle(color, a * fade).fillCircle(q.x, q.y, r); };
  poly(g, h, [U(-100 * s, -16 * s), U(-30 * s, -12 * s), U(-30 * s, 12 * s), U(-100 * s, 16 * s)], c1, 0.3 * fade);   // estela
  poly(g, h, [U(-62 * s, -15 * s), U(-30 * s, -17 * s), U(-30 * s, 17 * s), U(-62 * s, 15 * s)], c3, 0.85 * fade);   // muñeca
  // palma y dedos cerrados: cuerpo redondeado con cuatro nudillos al frente
  poly(g, h, [U(-34 * s, -22 * s), U(6 * s, -24 * s), U(18 * s, -16 * s), U(18 * s, 16 * s), U(6 * s, 24 * s), U(-34 * s, 22 * s)], c2, fade, c3);
  poly(g, h, [U(-30 * s, -18 * s), U(4 * s, -20 * s), U(4 * s, -6 * s), U(-30 * s, -6 * s)], c1, 0.9 * fade);        // luz
  for (const v of [-16, -5.5, 5.5, 16]) { dot(16 * s, v * s, 8 * s, c2); dot(16 * s, v * s, 8 * s, 0x000000, 0.0); dot(14 * s, (v - 2) * s, 3.5 * s, c0, 0.9); }
  for (const v of [-10.5, 0, 10.5]) { const a = at(h, 4 * s + back, v * s), b = at(h, 20 * s + back, v * s); g.lineStyle(3, c3, fade).lineBetween(a.x, a.y, b.x, b.y); }
  poly(g, h, [U(-14 * s, 20 * s), U(12 * s, 22 * s), U(14 * s, 34 * s), U(-6 * s, 36 * s)], c2, fade, c3);          // pulgar
  if (!h.fired) { h.fired = true; for (let i = 0; i < 6 + s * 4; i++) api.spawn(h.x, h.y, { vx: (Math.random() - 0.5) * 240, vy: (Math.random() - 0.5) * 240 - 40, life: 360, s0: 8 * s, s1: 1, colors: h.pal }); }
  if (t < 340) {   // el tipo se nota alrededor del puño: llamas, chispas, hielo...
    const fire = h.type === 'fire' || h.type === 'dragon';
    for (let i = 0; i < (fire ? 3 : 2); i++) {
      const o = at(h, (-30 + Math.random() * 56) * s + back, (Math.random() - 0.5) * 56 * s);
      api.spawn(o.x, o.y, { vx: (Math.random() - 0.5) * 70, vy: fire ? -90 - Math.random() * 60 : (Math.random() - 0.5) * 120, life: fire ? 420 : 300, s0: (fire ? 18 : 9) * s, s1: 2, colors: h.pal, a0: 0.95 });
    }
  }
}

/** Mordisco: dos filas de dientes que se cierran sobre el rival. */
function jaws(g: Phaser.GameObjects.Graphics, h: Hit, api: HitApi, teeth: number, size: number, chomps: number) {
  const s = scale(h) * size, per = h.life / chomps;
  const cycle = (h.age % per) / per, n = Math.floor(h.age / per);
  if (n >= chomps) return;
  const close = ease(clamp(cycle / 0.35)), open = clamp((cycle - 0.7) / 0.3);
  const gap = (70 * (1 - close) + 4) * s + open * 30 * s * (n < chomps - 1 ? 1 : 0);
  const fade = n === chomps - 1 ? 1 - clamp((cycle - 0.75) / 0.25) : 1;
  const w = (teeth * 15 * s), dark = h.pal[h.pal.length - 1], mid = h.pal[2] ?? h.pal[1] ?? h.pal[0];
  for (const dir of [-1, 1]) {
    const base = h.y + dir * (gap + 26 * s);
    g.fillStyle(dark, 0.55 * fade).fillRect(h.x - w / 2, Math.min(base, base + dir * 10 * s), w, 10 * s);
    for (let i = 0; i < teeth; i++) {
      const x0 = h.x - w / 2 + i * 15 * s, tip = h.y + dir * gap, th = i % 2 ? 0.8 : 1;
      g.fillStyle(0xffffff, fade).fillTriangle(x0, base, x0 + 15 * s, base, x0 + 7.5 * s, tip + dir * (1 - th) * 14 * s);
      g.lineStyle(2, mid, fade).strokeTriangle(x0, base, x0 + 15 * s, base, x0 + 7.5 * s, tip + dir * (1 - th) * 14 * s);
    }
  }
  if (cycle > 0.35 && h.mark < n) {
    h.mark = n;
    api.ring(h.x, h.y, mid, 6, 38 * s, 240, 3);
    for (let i = 0; i < 4; i++) api.spawn(h.x, h.y, { vx: (Math.random() - 0.5) * 220, vy: (Math.random() - 0.5) * 220, life: 280, s0: 6 * s, s1: 1, colors: h.pal });
  }
}

export function drawHit(h: Hit, g: Phaser.GameObjects.Graphics, api: HitApi) {
  const t = h.age, s = scale(h);
  const c0 = h.pal[0], c1 = h.pal[1] ?? c0, c2 = h.pal[2] ?? c1, c3 = h.pal[h.pal.length - 1];
  const fadeAfter = (ms: number) => 1 - clamp((t - ms) / Math.max(1, h.life - ms));
  switch (h.kind) {
    case 'claw':
    case 'dragonclaw': {   // tres garras paralelas
      const big = h.kind === 'dragonclaw' ? 1.5 : 1, n = 3, sc = s * big;
      for (let i = 0; i < n; i++) {
        const k = clamp((t - i * 35) / 110), off = (i - 1) * 22 * sc;
        slash(g, { x: h.x + off - 28 * sc, y: h.y - 50 * sc }, { x: h.x + off + 28 * sc, y: h.y + 50 * sc }, 10 * sc, 6 * sc, h, k, fadeAfter(220));
      }
      if (!h.fired) { h.fired = true; if (h.kind === 'dragonclaw') for (let i = 0; i < 10; i++) api.spawn(h.x + (Math.random() - 0.5) * 60, h.y + (Math.random() - 0.5) * 80, { vy: -50, life: 420, s0: 14, s1: 2, colors: h.pal }); }
      break;
    }
    case 'claws': {   // muchas garras pequeñas muy rápido
      for (let i = 0; i < 7; i++) {
        const k = clamp((t - i * 46) / 80), ox = Math.sin(h.seed + i * 3.1) * 34 * s, oy = Math.cos(h.seed + i * 1.7) * 26 * s, d = (i % 2 ? 1 : -1);
        slash(g, { x: h.x + ox - 16 * d, y: h.y + oy - 26 }, { x: h.x + ox + 16 * d, y: h.y + oy + 26 }, 5 * d, 3.5, h, k, fadeAfter(i * 46 + 120));
      }
      break;
    }
    case 'chop':
      slash(g, { x: h.x + 44 * s, y: h.y - 52 * s }, { x: h.x - 30 * s, y: h.y + 40 * s }, -8 * s, 8 * s, h, clamp(t / 70), fadeAfter(150));
      if (t > 60 && !h.fired) { h.fired = true; api.ring(h.x, h.y, c1, 6, 40 * s, 220, 3); }
      break;
    case 'crosschop':
      for (let i = 0; i < 2; i++) {
        const k = clamp((t - i * 110) / 80), d = i ? -1 : 1;
        slash(g, { x: h.x - 50 * s * d, y: h.y - 54 * s }, { x: h.x + 50 * s * d, y: h.y + 54 * s }, 0, 10 * s, h, k, fadeAfter(300));
      }
      if (t > 190 && !h.fired) { h.fired = true; api.ring(h.x, h.y, c1, 8, 64 * s, 300, 4); api.shake(120, 0.003); }
      break;
    case 'darkslash': {
      const pts = curve({ x: h.x - 62 * s, y: h.y + 46 * s }, { x: h.x + 62 * s, y: h.y - 46 * s }, 22 * s, clamp(t / 110));
      const a = fadeAfter(200);
      taper(g, pts, 20 * s, c2, 0.5 * a);
      taper(g, pts, 11 * s, c3, a);
      taper(g, pts, 4 * s, 0xff5c7a, a);
      break;
    }
    case 'xcut': {   // dos cuchillas que bajan desde arriba y forman una X
      for (let i = 0; i < 2; i++) {
        const k = clamp((t - i * 130) / 120), d = i ? -1 : 1, a = fadeAfter(330);
        const from = { x: h.x - 54 * s * d, y: h.y - 64 * s }, to = { x: h.x + 54 * s * d, y: h.y + 64 * s };
        slash(g, from, to, 0, 8 * s, h, k, a);
        const tip = { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k };   // la punta de la cuchilla
        g.fillStyle(0xffffff, a * (k < 1 ? 1 : 0.5)).fillTriangle(tip.x - 9 * d, tip.y - 4, tip.x + 9 * d, tip.y - 4, tip.x + 4 * d, tip.y + 16);
      }
      if (t > 250 && !h.fired) { h.fired = true; api.ring(h.x, h.y, c1, 6, 56 * s, 280, 3); for (let i = 0; i < 8; i++) api.spawn(h.x, h.y, { vx: (Math.random() - 0.5) * 260, vy: (Math.random() - 0.5) * 260, life: 340, s0: 7, s1: 1, colors: h.pal }); }
      break;
    }
    case 'whip':
    case 'vinewhips': {   // látigo: un arco que barre al rival y restalla
      const lashes = h.kind === 'vinewhips' ? 3 : 1;
      for (let i = 0; i < lashes; i++) {
        const k = clamp((t - i * 120) / 130), r = (46 + i * 8) * s, a0 = h.ang + Math.PI * (0.6 + i * 0.55), dir = i % 2 ? -1 : 1;
        const pts: P[] = [];
        const m = Math.max(2, Math.round(14 * k) + 1);
        for (let j = 0; j < m; j++) { const aa = a0 + dir * (j / 13) * 2.1; pts.push({ x: h.x + Math.cos(aa) * r * (1 - 0.3 * (j / 13)), y: h.y + Math.sin(aa) * r * (1 - 0.3 * (j / 13)) }); }
        const al = fadeAfter(i * 120 + 220);
        taper(g, pts, 8 * s, h.kind === 'vinewhips' ? 0x2f8f3a : c2, al);
        taper(g, pts, 4 * s, c0, al);
        if (h.kind === 'vinewhips') for (let j = 2; j < pts.length; j += 3) g.fillStyle(0x6fd14f, al).fillTriangle(pts[j].x, pts[j].y, pts[j].x + 12, pts[j].y - 6, pts[j].x + 4, pts[j].y + 10);
        if (k >= 1 && t < i * 120 + 260) { const e = pts[pts.length - 1]; g.lineStyle(3, 0xffffff, al); for (let q = 0; q < 6; q++) { const a = q * 1.05; g.lineBetween(e.x, e.y, e.x + Math.cos(a) * 16, e.y + Math.sin(a) * 16); } }
      }
      break;
    }
    case 'horn':
    case 'megahorn': {
      const big = h.kind === 'megahorn' ? 1.5 : 1, sc = s * big;
      const k = ease(clamp(t / 110)), a = fadeAfter(260), back = -90 * sc * (1 - k);
      poly(g, h, [[-72 * sc + back, -17 * sc], [0 + back, 0], [-72 * sc + back, 17 * sc]], c2, a, c3);
      poly(g, h, [[-72 * sc + back, -17 * sc], [0 + back, 0], [-72 * sc + back, -2 * sc]], c0, a);
      if (t > 100 && !h.fired) { h.fired = true; api.ring(h.x, h.y, c1, 6, 46 * sc, 260, 3); }
      break;
    }
    case 'jab': {   // tres agujas que pinchan
      for (let i = 0; i < 3; i++) {
        const k = ease(clamp((t - i * 90) / 90)), a = fadeAfter(i * 90 + 200), ang = h.ang + (i - 1) * 0.5, c = { x: h.x + (i - 1) * 8, y: h.y + (i - 1) * 6 };
        const tip = c, base = { x: c.x - Math.cos(ang) * 62 * (0.4 + 0.6 * k), y: c.y - Math.sin(ang) * 62 * (0.4 + 0.6 * k) };
        g.fillStyle(c1, a).fillTriangle(base.x - Math.sin(ang) * 6, base.y + Math.cos(ang) * 6, tip.x, tip.y, base.x + Math.sin(ang) * 6, base.y - Math.cos(ang) * 6);
        g.fillStyle(c0, a).fillCircle(tip.x, tip.y, 4);
      }
      break;
    }
    case 'stomp': {   // la sombra de un pie que cae
      const k = ease(clamp(t / 130)), sc = (2.3 - 0.9 * k) * s, a = (0.15 + 0.5 * k) * fadeAfter(280);
      const fx = h.x, fy = h.y - 6;
      g.fillStyle(0x000000, a).fillEllipse(fx, fy + 22 * sc, 40 * sc, 48 * sc);
      g.fillEllipse(fx, fy - 4 * sc, 48 * sc, 56 * sc);
      for (const [dx, dy, r] of [[-22, -36, 8], [-11, -42, 9], [0, -44, 10], [11, -42, 9], [22, -36, 8]] as [number, number, number][]) g.fillCircle(fx + dx * sc, fy + dy * sc, r * sc);
      if (t > 120 && !h.fired) { h.fired = true; api.ring(h.x, h.y, c1, 10, 70 * s, 320, 4); api.shake(110, 0.003); for (let i = 0; i < 8; i++) api.spawn(h.x, h.y, { vx: (Math.random() - 0.5) * 220, vy: -60 - Math.random() * 100, g: 600, life: 420, s0: 10, s1: 3, colors: [0xc0a070, 0xa08050] }); }
      break;
    }
    case 'fang': {   // dos colmillos grandes que se cierran
      const k = ease(clamp(t / 120)), a = fadeAfter(260), gap = 66 * s * (1 - k) + 5;
      for (const dir of [-1, 1]) {
        const tip = h.y + dir * gap, base = h.y + dir * (gap + 74 * s);
        g.fillStyle(0xffffff, a).fillTriangle(h.x - 17 * s, base, h.x + 17 * s, base, h.x, tip);
        g.lineStyle(3, c2, a).strokeTriangle(h.x - 17 * s, base, h.x + 17 * s, base, h.x, tip);
      }
      if (t > 110 && !h.fired) { h.fired = true; api.ring(h.x, h.y, c1, 6, 44 * s, 260, 3); }
      break;
    }
    case 'bite': jaws(g, h, api, 3, 0.8, 1); break;
    case 'crunch': jaws(g, h, api, 5, 1.2, 3); break;
    case 'fist': fist(g, h, api, 1); break;
    case 'dynpunch':
      fist(g, h, api, 1.35);
      for (let i = 0; i < 3; i++) { const k = clamp((t - 110 - i * 90) / 260); if (k > 0 && k < 1) g.lineStyle(5 - i, i ? c1 : c0, 1 - k).strokeCircle(h.x, h.y, 14 + 90 * s * ease(k)); }
      burstStar(g, h, 10, 80 * s, clamp((t - 110) / 140), clamp(1 - (t - 110) / 300));
      break;
    case 'superpower':
      fist(g, h, api, 1.9);
      for (let i = 0; i < 3; i++) { const k = clamp((t - 110 - i * 110) / 300); if (k > 0 && k < 1) g.lineStyle(7 - i * 2, i ? c1 : 0xffffff, 1 - k).strokeCircle(h.x, h.y, 20 + 130 * s * ease(k)); }
      burstStar(g, h, 14, 110 * s, clamp((t - 110) / 140), clamp(1 - (t - 110) / 360));
      break;
    case 'kick': {
      const k = ease(clamp(t / 110)), a = fadeAfter(300), back = -110 * s * (1 - k);
      poly(g, h, [[-130 * s + back, -15 * s], [-24 * s + back, -17 * s], [-12 * s + back, -26 * s], [18 * s + back, -24 * s], [28 * s + back, -8 * s], [28 * s + back, 14 * s], [-12 * s + back, 18 * s], [-130 * s + back, 15 * s]], c2, a, c3);
      poly(g, h, [[-20 * s + back, -20 * s], [16 * s + back, -20 * s], [16 * s + back, -8 * s], [-20 * s + back, -8 * s]], c1, a);
      poly(g, h, [[-170 * s, -10 * s], [-130 * s, -4 * s], [-130 * s, 4 * s], [-170 * s, 10 * s]], c1, 0.3 * a);
      burstStar(g, h, 8, 70 * s, clamp((t - 90) / 120), clamp(1 - (t - 90) / 260) * (t > 90 ? 1 : 0));
      if (t > 100 && !h.fired) { h.fired = true; api.ring(h.x, h.y, c1, 8, 80 * s, 300, 4); api.shake(110, 0.003); }
      break;
    }
    case 'spinkick': {   // patada giratoria: un arco enorme alrededor del rival
      const k = clamp(t / 200), a = fadeAfter(260), r = 52 * s;
      const pts: P[] = [], m = Math.max(2, Math.round(24 * k) + 1);
      for (let j = 0; j < m; j++) { const aa = h.ang + Math.PI + (j / 23) * Math.PI * 1.7; pts.push({ x: h.x + Math.cos(aa) * r, y: h.y + Math.sin(aa) * r * 0.85 }); }
      taper(g, pts, 18 * s, c2, 0.5 * a);
      taper(g, pts, 10 * s, c1, a);
      taper(g, pts, 4 * s, c0, a);
      break;
    }
    case 'tail': {   // cola que barre el golpe
      const k = clamp(t / 150), a = fadeAfter(300);
      const pts: P[] = [], m = Math.max(2, Math.round(16 * k) + 1);
      for (let j = 0; j < m; j++) { const aa = h.ang + Math.PI * 0.55 + (j / 15) * Math.PI * 1.1, r = (70 - j * 1.5) * s; pts.push({ x: h.x + Math.cos(aa) * r, y: h.y + Math.sin(aa) * r }); }
      taper(g, pts, 17 * s, c3, a);
      taper(g, pts, 11 * s, c2, a);
      taper(g, pts, 4 * s, c0, a);
      burstStar(g, h, 10, 80 * s, clamp((t - 120) / 140), clamp(1 - (t - 120) / 320) * (t > 120 ? 1 : 0));
      if (t > 130 && !h.fired) { h.fired = true; api.ring(h.x, h.y, c1, 8, 90 * s, 320, 4); api.shake(120, 0.003); }
      break;
    }
    case 'bigimpact':
    case 'megaimpact': {
      const mega = h.kind === 'megaimpact', sc = s * (mega ? 1.3 : 1);
      const k = clamp(t / 140), a = fadeAfter(260);
      burstStar(g, h, mega ? 16 : 11, 105 * sc, k, a);
      g.fillStyle(0xffffff, a * 0.9).fillCircle(h.x, h.y, 34 * sc * (1 - clamp(t / 320) * 0.6));
      g.fillStyle(c1, a * 0.5).fillCircle(h.x, h.y, 54 * sc * ease(k));
      if (!h.fired) {
        h.fired = true;
        api.ring(h.x, h.y, c0, 8, 110 * sc, 380, 6);
        api.ring(h.x, h.y, c1, 4, 70 * sc, 300, 4);
        if (mega) api.ring(h.x, h.y, c2, 6, 150 * sc, 460, 4);
        const n = mega ? 18 : 10;
        for (let i = 0; i < n; i++) {
          const an = Math.random() * Math.PI * 2, v = 160 + Math.random() * 220;
          api.spawn(h.x, h.y, { vx: Math.cos(an) * v, vy: Math.sin(an) * v - (h.type === 'fire' ? 90 : 0), life: 520, s0: (h.type === 'fire' ? 20 : 11) * sc, s1: 2, g: h.type === 'fire' ? -60 : 200, colors: h.pal, a0: 0.95 });
        }
        if (h.type === 'fire') for (let i = 0; i < 16; i++) api.spawn(h.x + (Math.random() - 0.5) * 50, h.y + (Math.random() - 0.5) * 30, { vx: (Math.random() - 0.5) * 120, vy: -100 - Math.random() * 120, life: 700, s0: 26, s1: 3, colors: h.pal, a0: 0.95 });
      }
      break;
    }
    case 'firewheel': {
      const a = fadeAfter(300), rot = t * 0.02, r = 40 * s;
      g.lineStyle(7, c2, 0.8 * a).strokeCircle(h.x, h.y, r);
      g.lineStyle(3, c0, a).strokeCircle(h.x, h.y, r);
      for (let i = 0; i < 8; i++) {
        const aa = rot + (i * Math.PI) / 4;
        const p1 = { x: h.x + Math.cos(aa) * r, y: h.y + Math.sin(aa) * r }, p2 = { x: h.x + Math.cos(aa) * (r + 18 * s), y: h.y + Math.sin(aa) * (r + 18 * s) };
        g.fillStyle(c1, a).fillTriangle(p1.x - Math.sin(aa) * 6, p1.y + Math.cos(aa) * 6, p2.x, p2.y, p1.x + Math.sin(aa) * 6, p1.y - Math.cos(aa) * 6);
      }
      for (let i = 0; i < 6; i++) { const aa = Math.random() * 6.28; api.spawn(h.x + Math.cos(aa) * r, h.y + Math.sin(aa) * r, { vy: -40, life: 320, s0: 10, s1: 2, colors: h.pal }); }
      break;
    }
    case 'hammer': {   // martillo de agua que cae
      const k = ease(clamp(t / 140)), a = fadeAfter(300), top = h.y - 120 * s * (1 - k);
      g.fillStyle(c3, 0.7 * a).fillRect(h.x - 7 * s, top - 90 * s, 14 * s, 90 * s);
      g.fillStyle(c1, 0.85 * a).fillRect(h.x - 36 * s, top - 28 * s, 72 * s, 38 * s);
      g.fillStyle(c0, 0.9 * a).fillRect(h.x - 36 * s, top - 28 * s, 72 * s, 10 * s);
      g.lineStyle(3, c3, a).strokeRect(h.x - 36 * s, top - 28 * s, 72 * s, 38 * s);
      if (t > 130 && !h.fired) { h.fired = true; api.ring(h.x, h.y, c0, 8, 90 * s, 360, 5); api.shake(130, 0.004); for (let i = 0; i < 14; i++) api.spawn(h.x, h.y, { vx: (Math.random() - 0.5) * 300, vy: -100 - Math.random() * 160, g: 600, life: 560, s0: 10, s1: 2, colors: h.pal }); }
      break;
    }
    case 'wing': {   // ala que barre
      const k = clamp(t / 180), a = fadeAfter(260), sweep = -1 + 2 * ease(k);
      const px = h.x - Math.cos(h.ang) * 30 * s, py = h.y - Math.sin(h.ang) * 30 * s + 24 * s;
      for (let i = 0; i < 6; i++) {
        const aa = h.ang + sweep + (i - 2.5) * 0.28, len = (88 - Math.abs(i - 2.5) * 8) * s;
        const e = { x: px + Math.cos(aa) * len, y: py + Math.sin(aa) * len };
        g.fillStyle(i % 2 ? c1 : c0, 0.9 * a).fillTriangle(px - Math.sin(aa) * 9 * s, py + Math.cos(aa) * 9 * s, e.x, e.y, px + Math.sin(aa) * 9 * s, py - Math.cos(aa) * 9 * s);
        g.lineStyle(2, c2, a).lineBetween(px, py, e.x, e.y);
      }
      break;
    }
    case 'airblades': {   // medias lunas de aire que cruzan al rival
      for (let i = 0; i < 5; i++) {
        const k = clamp((t - i * 55) / 180), a = fadeAfter(i * 55 + 200), off = (i - 2) * 22 * s;
        const c = at(h, -90 * s + 220 * s * k, off), pts: P[] = [];
        for (let j = 0; j < 9; j++) { const aa = h.ang - 1.0 + (j / 8) * 2.0, r = 26 * s; pts.push({ x: c.x + Math.cos(aa) * r * 0.5 - Math.cos(h.ang) * 6, y: c.y + Math.sin(aa) * r }); }
        taper(g, pts, 5 * s, c1, 0.7 * a);
        taper(g, pts, 2.5 * s, c0, a);
      }
      break;
    }
    case 'drain': {   // la vida sube hacia quien ataca
      if (!h.fired) {
        h.fired = true;
        const dx = h.ox - h.x, dy = h.oy - h.y, d = Math.hypot(dx, dy) || 1;
        for (let i = 0; i < 16; i++) api.spawn(h.x + (Math.random() - 0.5) * 50, h.y + (Math.random() - 0.5) * 50, { vx: (dx / d) * (240 + Math.random() * 140) + (Math.random() - 0.5) * 60, vy: (dy / d) * (240 + Math.random() * 140) + (Math.random() - 0.5) * 60, life: 600, s0: 9, s1: 3, a0: 0.95, colors: [0xffffff, 0xff7a9a, 0x7ad14f] });
      }
      const k = clamp(t / 500);
      g.lineStyle(4, 0xff7a9a, 0.8 * (1 - k)).strokeCircle(h.x, h.y, 60 * (1 - k) + 6);
      g.lineStyle(2, 0x7ad14f, 0.8 * (1 - k)).strokeCircle(h.x, h.y, 40 * (1 - k) + 4);
      break;
    }
    case 'bricks': {   // ladrillos que saltan en pedazos
      if (!h.fired) {
        h.fired = true;
        for (let i = 0; i < 9 + s * 4; i++) { const an = Math.random() * Math.PI * 2, v = 150 + Math.random() * 200; api.spawn(h.x, h.y, { vx: Math.cos(an) * v, vy: Math.sin(an) * v - 90, g: 700, life: 600, s0: 14, s1: 12, a0: 1, a1: 0.2, colors: [0xc9b79a, 0xa8957a, 0x8a7a62], spin: (Math.random() - 0.5) * 12, len: 22 }); }
        api.ring(h.x, h.y, c1, 8, 70 * s, 300, 4); api.shake(120, 0.0035);
      }
      const a = fadeAfter(200);
      g.lineStyle(4, 0x2a2018, a);
      for (let i = 0; i < 7; i++) { const aa = i * 0.9 + (h.seed % 1), r = (28 + (i % 3) * 14) * s * ease(clamp(t / 100)); g.lineBetween(h.x, h.y, h.x + Math.cos(aa) * r, h.y + Math.sin(aa) * r); }
      break;
    }
    case 'grapple': {   // llave: espirales que aprietan al rival
      const a = fadeAfter(320);
      for (let i = 0; i < 3; i++) {
        const k = clamp((t - i * 60) / 200), r = (58 - 34 * k) * s;
        g.lineStyle(6 - i, i ? c1 : c0, a * clamp(1 - Math.abs(k - 0.5))).strokeCircle(h.x, h.y, r);
        for (let q = 0; q < 4; q++) { const aa = t * 0.012 + i + (q * Math.PI) / 2; g.lineBetween(h.x + Math.cos(aa) * r, h.y + Math.sin(aa) * r, h.x + Math.cos(aa + 0.6) * (r - 12), h.y + Math.sin(aa + 0.6) * (r - 12)); }
      }
      break;
    }
    case 'headbutt': {
      const k = clamp(t / 100), a = fadeAfter(200);
      burstStar(g, h, 8, 70 * s, k, a);
      g.fillStyle(0xffffff, a).fillCircle(h.x, h.y, 18 * s * (1 - clamp(t / 260) * 0.5));
      break;
    }
    case 'waterfall': {   // una columna de agua cae sobre el rival
      const k = ease(clamp(t / 140)), a = fadeAfter(260), top = h.y - 300 * (1 - k);
      g.fillStyle(c1, 0.55 * a).fillRect(h.x - 30 * s, top - 300, 60 * s, 300 + (h.y - top) * 0);
      g.fillStyle(c0, 0.8 * a).fillRect(h.x - 12 * s, top - 300, 24 * s, 300);
      if (t > 120 && !h.fired) { h.fired = true; api.ring(h.x, h.y, c0, 10, 80 * s, 360, 5); for (let i = 0; i < 12; i++) api.spawn(h.x, h.y, { vx: (Math.random() - 0.5) * 260, vy: -80 - Math.random() * 140, g: 600, life: 500, s0: 9, s1: 2, colors: h.pal }); }
      break;
    }
    case 'speedlines': {
      const a = fadeAfter(120);
      for (let i = 0; i < 9; i++) {
        const v = (i - 4) * 12 * s, k = ease(clamp((t - i * 12) / 110)), p0 = at(h, -140 * s + 90 * s * k, v), p1 = at(h, -60 * s + 90 * s * k, v);
        g.lineStyle(3, i % 2 ? c1 : c0, a).lineBetween(p0.x, p0.y, p1.x, p1.y);
      }
      break;
    }
    default: break;
  }
}
