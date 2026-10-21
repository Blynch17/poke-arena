export type PType =
  | 'normal' | 'fire' | 'water' | 'grass' | 'electric'
  | 'ice' | 'poison' | 'flying' | 'psychic' | 'ghost';

export type Category = 'physical' | 'special' | 'status';
export type StatKey = 'atk' | 'def' | 'spa' | 'spd' | 'spe';
export type Stages = Record<StatKey, number>;

export interface Move {
  name: string;
  type: PType;
  category: Category;
  power: number;     // poder base del juego original (0 en los de estado)
  pp: number;        // PP original del juego
  cost: number;      // energía
  cooldown: number;  // ms
  speed: number;     // px/s del proyectil
  life: number;      // ms de vuelo
  size: number;      // escala del proyectil
  boost?: Partial<Stages>; // mejoras de stats para quien lo usa (ataques de estado)
  lock?: number;     // ms que queda inmóvil quien lo usa
  fx?: string;        // efecto visual (ver fx.ts)
  style?: 'dash' | 'reach'; // embestida con contacto / ataque de alcance corto (por defecto, proyectil)
  dash?: number;      // px que recorre la embestida
  reach?: number;     // px de alcance del ataque corto
  typeless?: boolean; // sin tipo: ignora STAB y efectividad (Forcejeo)
  recoil?: boolean;   // el usuario pierde 1/4 de sus PS máximos al golpear
}

export interface BaseStats {
  hp: number; atk: number; def: number; spa: number; spd: number; spe: number;
}

export interface Stats extends BaseStats {}

export interface PokemonDef {
  id: string;
  name: string;
  types: PType[];
  base: BaseStats;
  stats: Stats;    // stats calculados al nivel de combate
  maxHp: number;   // PS en combate (stat de PS x HP_MULT)
  speed: number;   // px/s de movimiento con el stat de velocidad sin modificar
  moves: [Move, Move, Move, Move]; // teclas U, I, O, P
}

export const LEVEL = 50;
export const HP_MULT = 5; // la vida se multiplica por 5 para que los combates duren más
export const ENERGY_MAX = 100;
export const ENERGY_REGEN = 12; // por segundo
export const PP_FACTOR = 1.5; // usos por combate = PP original x PP_FACTOR (luego x PP_DOUBLE)
export const PP_MIN = 5;
export const PP_DOUBLE = 2;
export const STAGE_MAX = 6;
export const STATUS_COST = 50;            // energía de los ataques de mejora
export const STATUS_COOLDOWN = 8000;      // ms de recarga
export const STATUS_LOCK_PER_STAGE = 2000; // ms inmóvil por etapa subida
// Cuánto de la etapa de Velocidad se nota al caminar (0 = nada, 1 = el multiplicador completo del juego).
export const SPEED_STAGE_EFFECT = 0.3;

export const TYPE_COLOR: Record<PType, number> = {
  normal: 0xd0d0c0, fire: 0xff7a1a, water: 0x3d9bff, grass: 0x4fd14f,
  electric: 0xffe135, ice: 0x8ae6ff, poison: 0xb45cd6, flying: 0xa9b9ff,
  psychic: 0xff5cae, ghost: 0x7a5cc9,
};

export const STAT_NAME: Record<StatKey, string> = {
  atk: 'Ataque', def: 'Defensa', spa: 'At. Esp.', spd: 'Def. Esp.', spe: 'Velocidad',
};

// Multiplicadores del atacante (fila) sobre el defensor (columna). Lo omitido es x1.
const CHART: Partial<Record<PType, Partial<Record<PType, number>>>> = {
  normal: { ghost: 0 },
  fire: { grass: 2, ice: 2, fire: 0.5, water: 0.5 },
  water: { fire: 2, water: 0.5, grass: 0.5 },
  grass: { water: 2, fire: 0.5, grass: 0.5, poison: 0.5, flying: 0.5 },
  electric: { water: 2, flying: 2, grass: 0.5, electric: 0.5 },
  ice: { grass: 2, flying: 2, fire: 0.5, water: 0.5, ice: 0.5 },
  poison: { grass: 2, poison: 0.5, ghost: 0.5 },
  flying: { grass: 2, electric: 0.5 },
  psychic: { poison: 2, psychic: 0.5 },
  ghost: { ghost: 2, psychic: 2, normal: 0 },
};

export function effectiveness(move: PType, defender: PType[]): number {
  return defender.reduce((m, t) => m * (CHART[move]?.[t] ?? 1), 1);
}

export const newStages = (): Stages => ({ atk: 0, def: 0, spa: 0, spd: 0, spe: 0 });

// Etapas de stats del juego: +1 = x1.5, +2 = x2 ... / -1 = x2/3, -2 = x1/2 ...
export const stageMult = (n: number) => (n >= 0 ? (2 + n) / 2 : 2 / (2 - n));

/** Usos máximos de un ataque por combate: PP original ponderado por PP_FACTOR. */
export const maxUses = (m: Move) => Math.max(PP_MIN, Math.round(m.pp * PP_FACTOR)) * PP_DOUBLE;

// Stats del juego (IV 31, EV 0, naturaleza neutra).
function computeStats(b: BaseStats): Stats {
  const other = (v: number) => Math.floor(((2 * v + 31) * LEVEL) / 100) + 5;
  return {
    hp: Math.floor(((2 * b.hp + 31) * LEVEL) / 100) + LEVEL + 10,
    atk: other(b.atk), def: other(b.def), spa: other(b.spa), spd: other(b.spd), spe: other(b.spe),
  };
}

export interface DamageResult { damage: number; eff: number; crit: boolean; stab: boolean }

/**
 * Daño de la fórmula del juego: ((2L/5+2) * poder * A/D / 50 + 2) * crítico * aleatorio * STAB * tipos.
 * A y D incluyen las etapas de stats; en un crítico se ignoran las bajadas del atacante y las subidas del
 * defensor. Con random=false devuelve el daño esperado (sin variación ni crítico), útil para la IA.
 */
export function calcDamage(
  att: PokemonDef, def: PokemonDef, move: Move, random = true,
  attStages: Stages = newStages(), defStages: Stages = newStages(),
): DamageResult {
  const physical = move.category === 'physical';
  const crit = random && Math.random() < 1 / 24;
  const aKey: StatKey = physical ? 'atk' : 'spa';
  const dKey: StatKey = physical ? 'def' : 'spd';
  const aStage = crit ? Math.max(0, attStages[aKey]) : attStages[aKey];
  const dStage = crit ? Math.min(0, defStages[dKey]) : defStages[dKey];
  const A = Math.floor(att.stats[aKey] * stageMult(aStage));
  const D = Math.max(1, Math.floor(def.stats[dKey] * stageMult(dStage)));
  const eff = move.typeless ? 1 : effectiveness(move.type, def.types);
  const stab = !move.typeless && att.types.includes(move.type);
  let dmg = Math.floor(Math.floor((Math.floor((2 * LEVEL) / 5) + 2) * move.power * A / D) / 50) + 2;
  if (crit) dmg = Math.floor(dmg * 1.5);
  if (random) dmg = Math.floor(dmg * (0.85 + Math.random() * 0.15));
  if (stab) dmg = Math.floor(dmg * 1.5);
  dmg = Math.floor(dmg * eff);
  return { damage: eff === 0 ? 0 : Math.max(1, dmg), eff, crit, stab };
}

// Ataque de daño: nombre, tipo, categoría, poder, PP, costo, recarga, y datos del proyectil.
const mv = (
  name: string, type: PType, category: 'physical' | 'special', power: number, pp: number, cost: number,
  cooldown: number, speed: number, life: number, size: number, fx: string, extra: Partial<Move> = {},
): Move => ({ name, type, category, power, pp, cost, cooldown, speed, life, size, fx, ...extra });

// Ataque de estado que mejora los stats de quien lo usa. Inmoviliza 2 s por etapa subida.
const st = (name: string, type: PType, pp: number, cost: number, boost: Partial<Stages>): Move => {
  const stages = Object.values(boost).reduce((a, b) => a + (b ?? 0), 0);
  return {
    name, type, category: 'status', power: 0, pp, cost, cooldown: STATUS_COOLDOWN, speed: 0, life: 0, size: 0,
    boost, lock: stages * STATUS_LOCK_PER_STAGE,
  };
};

// Cuando se acaban los PP de todos los ataques, el juego obliga a usar Forcejeo.
export const STRUGGLE: Move = {
  name: 'Forcejeo', type: 'normal', category: 'physical', power: 50, pp: 1, cost: 0, cooldown: 1500,
  speed: 460, life: 550, size: 1, typeless: true, recoil: true, fx: 'slam', style: 'dash', dash: 200,
};

type Raw = Omit<PokemonDef, 'stats' | 'maxHp' | 'speed'>;

const RAW: Raw[] = [
  {
    id: 'charizard', name: 'Charizard', types: ['fire', 'flying'],
    base: { hp: 78, atk: 84, def: 78, spa: 109, spd: 85, spe: 100 },
    moves: [
      mv('Ascuas', 'fire', 'special', 40, 25, 22, 1100, 480, 800, 0.7, 'ember'),
      mv('Ataque Ala', 'flying', 'physical', 60, 35, 31, 1700, 560, 650, 0.9, 'wing', { style: 'dash', dash: 260 }),
      mv('Lanzallamas', 'fire', 'special', 90, 15, 42, 2600, 420, 1000, 1.3, 'flame'),
      st('Danza Espada', 'normal', 20, STATUS_COST, { atk: 2 }),
    ],
  },
  {
    id: 'blastoise', name: 'Blastoise', types: ['water'],
    base: { hp: 79, atk: 83, def: 100, spa: 85, spd: 105, spe: 78 },
    moves: [
      mv('Pistola Agua', 'water', 'special', 40, 25, 22, 1100, 500, 800, 0.7, 'water'),
      mv('Rayo Hielo', 'ice', 'special', 90, 10, 42, 2500, 560, 900, 0.9, 'ice'),
      mv('Hidrobomba', 'water', 'special', 110, 5, 49, 3200, 400, 1000, 1.4, 'hydro'),
      st('Defensa Férrea', 'normal', 15, STATUS_COST, { def: 2 }),
    ],
  },
  {
    id: 'venusaur', name: 'Venusaur', types: ['grass', 'poison'],
    base: { hp: 80, atk: 82, def: 83, spa: 100, spd: 100, spe: 80 },
    moves: [
      st('Desarrollo', 'normal', 20, STATUS_COST, { atk: 1, spa: 1 }),
      mv('Hoja Afilada', 'grass', 'physical', 55, 25, 29, 1500, 640, 800, 0.8, 'leaf'),
      mv('Rayo Solar', 'grass', 'special', 120, 10, 52, 3200, 430, 1000, 1.4, 'solar'),
      mv('Bomba Lodo', 'poison', 'special', 90, 10, 42, 2500, 450, 900, 1.0, 'sludge'),
    ],
  },
  {
    id: 'pikachu', name: 'Pikachu', types: ['electric'],
    base: { hp: 35, atk: 55, def: 40, spa: 50, spd: 50, spe: 90 },
    moves: [
      mv('Impactrueno', 'electric', 'special', 40, 30, 22, 1000, 620, 750, 0.6, 'spark'),
      st('Agilidad', 'psychic', 30, STATUS_COST, { spe: 2 }),
      mv('Rayo', 'electric', 'special', 90, 15, 42, 2400, 700, 900, 1.0, 'bolt'),
      mv('Trueno', 'electric', 'special', 110, 10, 49, 3000, 480, 1000, 1.1, 'thunder'),
    ],
  },
  {
    id: 'alakazam', name: 'Alakazam', types: ['psychic'],
    base: { hp: 55, atk: 50, def: 45, spa: 135, spd: 95, spe: 120 },
    moves: [
      mv('Confusión', 'psychic', 'special', 50, 25, 26, 1300, 520, 850, 0.8, 'psy'),
      mv('Psíquico', 'psychic', 'special', 90, 10, 42, 2500, 480, 1000, 1.2, 'psychic'),
      mv('Bola Sombra', 'ghost', 'special', 80, 15, 38, 2200, 500, 950, 1.0, 'shadow'),
      st('Paz Mental', 'psychic', 20, STATUS_COST, { spa: 1, spd: 1 }),
    ],
  },
  {
    id: 'gengar', name: 'Gengar', types: ['ghost', 'poison'],
    base: { hp: 60, atk: 65, def: 60, spa: 130, spd: 75, spe: 110 },
    moves: [
      mv('Lengüetazo', 'ghost', 'physical', 30, 30, 18, 900, 520, 650, 0.7, 'lick', { style: 'reach', reach: 190 }),
      mv('Bola Sombra', 'ghost', 'special', 80, 15, 38, 2200, 500, 950, 1.0, 'shadow'),
      mv('Bomba Lodo', 'poison', 'special', 90, 10, 42, 2500, 460, 900, 1.0, 'sludge'),
      st('Maquinación', 'psychic', 20, STATUS_COST, { spa: 2 }),
    ],
  },
];

export const POKEMON: PokemonDef[] = RAW.map((r) => {
  const stats = computeStats(r.base);
  return { ...r, stats, maxHp: stats.hp * HP_MULT, speed: Math.round(100 + stats.spe * 1.1) };
});

// Las curaciones también se multiplican por HP_MULT (Poción original: 20 PS).
export const ITEMS = {
  potion: { name: 'Poción', desc: `+${20 * HP_MULT} PS`, hp: 20 * HP_MULT, energy: 0 },
  ether: { name: 'Éter', desc: '+60 Energía', hp: 0, energy: 60 },
} as const;
export type ItemId = keyof typeof ITEMS;
