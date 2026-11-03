// Ataques de área: la geometría de cada uno (dónde y cuándo hace daño) se calcula una sola vez al lanzarlo.
// BattleScene mueve el reloj y comprueba las zonas; Fx.area dibuja el efecto a partir del mismo objeto.

import type { Move } from './data';

/** Un círculo que hace daño entre los instantes t0 y t1 (ms desde el lanzamiento). */
export interface Zone { t0: number; t1: number; x: number; y: number; r: number; pop?: number; size?: number }

export type AreaKind = 'ground' | 'spikes' | 'rain' | 'nova' | 'strike' | 'wave' | 'storm';

export interface Area {
  kind: AreaKind;
  fx: string;          // efecto visual del ataque (define colores y partículas)
  ox: number; oy: number; // dónde se lanzó
  dx: number; dy: number; // hacia dónde miraba quien lo lanzó
  range: number;
  power: number;
  seed: number;
  speed: number;       // px/s a los que avanza el frente (onda del suelo y onda expansiva)
  life: number;        // ms hasta que desaparece del todo
  zones: Zone[];
  t: number;
  lastT: number;
  hit: boolean;        // ya dio en el blanco: un ataque de área solo golpea una vez
  trackUntil: number;  // rayo del cielo: hasta cuándo sigue al rival antes de fijar su objetivo
}

export interface Bounds { x: number; y: number; w: number; h: number }

export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Escala de tamaño del efecto según el poder: 0,8 con poder 40 y 1,3 con poder 120. */
export const powerScale = (power: number) => 0.8 + Math.max(0, power - 40) / 160;

export function buildArea(mv: Move, ox: number, oy: number, dx: number, dy: number, bounds: Bounds, target?: { x: number; y: number }): Area {
  const seed = Math.floor(Math.random() * 1e9);
  const rnd = seeded(seed);
  const sc = powerScale(mv.power);
  const clampX = (x: number) => Math.min(bounds.x + bounds.w - 20, Math.max(bounds.x + 20, x));
  const clampY = (y: number) => Math.min(bounds.y + bounds.h - 20, Math.max(bounds.y + 20, y));
  const a: Area = {
    kind: mv.style as AreaKind, fx: mv.fx ?? 'slam', ox, oy, dx, dy, range: mv.range ?? 300, power: mv.power, seed,
    speed: 520, life: 1000, zones: [], t: 0, lastT: 0, hit: false, trackUntil: 0,
  };
  const along = (u: number, off = 0) => ({ x: clampX(ox + dx * u - dy * off), y: clampY(oy + dy * u + dx * off) });

  if (a.kind === 'ground') {
    // La onda recorre el suelo en línea recta; la zona de daño es el frente en cada instante.
    a.speed = 640;
    for (let u = 60; u <= a.range; u += 40) {
      const t = (u / a.speed) * 1000, p = along(u);
      a.zones.push({ t0: t - 40, t1: t + 90, x: p.x, y: p.y, r: 46 * sc });
    }
    a.life = (a.range / a.speed) * 1000 + 900;
  } else if (a.kind === 'spikes') {
    // Siete peñascos que brotan a destiempo, con separaciones y tamaños desiguales.
    const n = 7;
    for (let i = 0; i < n; i++) {
      const pop = i * 65 + rnd() * 110, u = Math.max(70, 70 + (a.range - 70) * ((i + (rnd() - 0.5) * 0.8) / (n - 1)));
      const p = along(u, (rnd() - 0.5) * 90), size = 0.75 + rnd() * 0.6;
      a.zones.push({ t0: pop + 60, t1: pop + 460, x: p.x, y: p.y, r: 42 * sc * size, pop, size });
    }
    a.life = 6 * 65 + 110 + 900;
  } else if (a.kind === 'rain') {
    // Rocas que caen en puntos repartidos delante del que ataca; cada una avisa con su sombra.
    const n = 7;
    for (let i = 0; i < n; i++) {
      const land = 450 + i * 100, p = along(110 + rnd() * (a.range - 110), (rnd() - 0.5) * 170);
      a.zones.push({ t0: land, t1: land + 130, x: p.x, y: p.y, r: 50 * sc });
    }
    a.life = 450 + (n - 1) * 100 + 700;
  } else if (a.kind === 'wave') {
    a.speed = 480;
    a.life = (a.range / a.speed) * 1000 + 350;
  } else if (a.kind === 'storm') {
    a.speed = 380;
    a.life = (a.range / a.speed) * 1000 + 500;
  } else if (a.kind === 'nova') {
    a.speed = 520;
    a.life = (a.range / a.speed) * 1000 + 250;
  } else {
    // Rayo del cielo: marca el punto, lo sigue medio segundo y cae al segundo (queda ~0,5 s para esquivarlo).
    const p = target ?? { x: ox + dx * 200, y: oy + dy * 200 };
    a.zones.push({ t0: 1000, t1: 1140, x: p.x, y: p.y, r: 60 });
    a.trackUntil = 500;
    a.life = 1700;
  }
  return a;
}
