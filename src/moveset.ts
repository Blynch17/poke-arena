// Ataques por nivel y evoluciones del modo aventura. Los datos salen de `learnsets.ts` (generado por
// tools/gen_learnsets.py): qué ataque aprende cada especie en cada nivel y a qué nivel evoluciona.

import { POKEMON, PokemonDef, Move, moveByKey } from './data';
import { LEARNSETS, EVOLUTIONS } from './learnsets';

export const MAX_MOVES = 4;

const INDEX = new Map(POKEMON.map((p, i) => [p.id, i]));
/** Índice en POKEMON de una especie por su id (-1 si todavía no está en el juego). */
export const speciesIndex = (id: string) => INDEX.get(id) ?? -1;

const learnset = (id: string): [number, string][] => LEARNSETS[id] ?? [];

/** Los ataques con los que sale un Pokémon salvaje o recién obtenido a ese nivel: los últimos que aprendió (hasta 4). */
export function defaultMoves(id: string, level: number): string[] {
  const known: string[] = [];
  for (const [lv, key] of learnset(id)) if (lv <= level && !known.includes(key)) known.push(key);
  return known.slice(-MAX_MOVES);
}

/** Ataques que aprende al pasar del nivel `from` (sin incluir) al `to` (incluido) y que todavía no conoce. */
export function movesLearnedBetween(id: string, from: number, to: number, known: string[]): string[] {
  const out: string[] = [];
  for (const [lv, key] of learnset(id)) if (lv > from && lv <= to && !known.includes(key) && !out.includes(key)) out.push(key);
  return out;
}

/** La especie con otros ataques (los suyos por defecto no se tocan). Sin ataques válidos conserva los de siempre. */
export function withMoves(def: PokemonDef, keys: string[]): PokemonDef {
  const moves: Move[] = keys.map(moveByKey);
  return moves.length ? { ...def, moves } : def;
}

export interface Evolution { to: string; toIndex: number; level: number; how: string }

/** A qué puede evolucionar una especie a ese nivel (solo especies que ya están en el juego). Si tiene varias ramas
 *  (Eevee, Slowpoke, Tyrogue, Gloom...) y alguna ya se cumple, se ofrecen todas para elegir. */
export function evolutionsAt(id: string, level: number): Evolution[] {
  const all = (EVOLUTIONS[id] ?? []).filter((e) => speciesIndex(e.to) >= 0).map((e) => ({ ...e, toIndex: speciesIndex(e.to) }));
  return all.some((e) => e.level <= level) ? all : [];
}
