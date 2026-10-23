// Fórmula de captura de la generación actual de los juegos (Gen. VIII), según la descripción de Dragonfly Cave
// (https://dragonflycave.com/mechanics/gen-viii-capturing). Se omiten los factores que este juego no tiene:
// estados alterados (S = 1), el modificador de hierba (G = 1), la dificultad por medallas (D = 1) y las capturas
// críticas, que dependen de cuántas especies tiene registradas el jugador en la Pokédex.

import { BALLS, BallId } from './data';

/**
 * Tasa de captura modificada X:
 *   X = ((3·PSmáx − 2·PSactual) · índice de la especie · bonus de la bola / (3·PSmáx)) · L
 * donde L = (30 − nivel) / 10 si el nivel es menor a 21 (los Pokémon de nivel bajo son más fáciles) y 1 si no.
 */
export function catchX(maxHp: number, hp: number, speciesRate: number, ball: BallId, level: number): number {
  const L = level < 21 ? (30 - level) / 10 : 1;
  return (((3 * maxHp - 2 * hp) * speciesRate * BALLS[ball].mult) / (3 * maxHp)) * L;
}

/** Probabilidad (sobre 65536) de que pase una sacudida: Y = ⌊65536 / (255 / X)^(3/16)⌋. */
export function shakeY(x: number): number {
  return Math.floor(65536 / Math.pow(255 / Math.max(x, 1e-9), 3 / 16));
}

const guaranteed = (x: number, ball: BallId) => BALLS[ball].sure || x >= 255;

/** Probabilidad total de captura: las 4 sacudidas deben pasar, (Y/65536)^4. */
export function captureChance(x: number, ball: BallId): number {
  if (guaranteed(x, ball)) return 1;
  return Math.pow(Math.min(1, shakeY(x) / 65536), 4);
}

/** Tira la captura: cuántas sacudidas pasan (0 a 4) y si el Pokémon queda capturado (las 4). */
export function rollCapture(x: number, ball: BallId, rand: () => number = Math.random): { success: boolean; shakes: number } {
  if (guaranteed(x, ball)) return { success: true, shakes: 4 };
  const y = shakeY(x);
  let shakes = 0;
  while (shakes < 4 && Math.floor(rand() * 65536) < y) shakes++;
  return { success: shakes === 4, shakes };
}
