// Experiencia y niveles del modo aventura (en la arena todos siguen a nivel 50).
//
// Se usa la curva "rápida-media" de los juegos (EXP total = nivel al cubo) y la fórmula de la generación 5 para lo que
// da cada Pokémon derrotado:  EXP = (a · b · Lf / (5 · s)) · ((2·Lf + 10) / (Lf + Lp + 10))^2.5 + 1
//   a  = 1,5 si el rival es un entrenador (1 si es salvaje)
//   b  = EXP base de la especie del derrotado
//   Lf = nivel del derrotado,  Lp = nivel de quien recibe la EXP
//   s  = cuántos Pokémon participaron en la pelea y siguen con PS
// Solo ganan EXP los que pelearon contra ese rival y no están debilitados; el resto no recibe nada.

import type { PokemonDef } from './data';

/** Nivel con el que empieza cualquier Pokémon del equipo en la aventura. */
export const START_LEVEL = 8;
export const MAX_LEVEL = 100;
export const TRAINER_EXP_MULT = 1.5;

/** EXP total que hace falta para estar en ese nivel. */
export const expAt = (level: number) => (level <= 1 ? 0 : level * level * level);

/** Nivel que corresponde a una cantidad de EXP total. */
export function levelFor(exp: number): number {
  let lv = 1;
  while (lv < MAX_LEVEL && exp >= expAt(lv + 1)) lv++;
  return lv;
}

/** EXP base de una especie, estimada con sus stats base (en los juegos es un dato aparte por especie).
 *  Da ~40 a los Pokémon más débiles (Magikarp), ~110 a Pikachu y ~300 a Mewtwo. */
export function baseExp(def: PokemonDef): number {
  const b = def.base;
  const total = b.hp + b.atk + b.def + b.spa + b.spd + b.spe;
  return Math.max(36, Math.min(340, Math.round(total * 0.55 - 70)));
}

/** EXP que da `foe` (a su nivel) a un Pokémon de nivel `myLevel` si participó junto a `sharers - 1` más. */
export function expYield(foe: PokemonDef, foeLevel: number, myLevel: number, trainer: boolean, sharers = 1): number {
  const a = trainer ? TRAINER_EXP_MULT : 1;
  const raw = (a * baseExp(foe) * foeLevel) / (5 * Math.max(1, sharers));
  return Math.max(1, Math.floor(raw * Math.pow((2 * foeLevel + 10) / (foeLevel + myLevel + 10), 2.5) + 1));
}
