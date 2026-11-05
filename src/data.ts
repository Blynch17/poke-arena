import { MOVES, BOOSTS, SPECIES } from './roster';

export type PType =
  | 'normal' | 'fire' | 'water' | 'grass' | 'electric'
  | 'ice' | 'poison' | 'flying' | 'psychic' | 'ghost'
  | 'fighting' | 'ground' | 'rock' | 'bug' | 'dragon' | 'steel' | 'dark' | 'fairy';

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
  // Forma del ataque (por defecto, proyectil): embestida con contacto, alcance corto o ataque de área
  // (onda por el suelo, picos de roca, lluvia de rocas, onda expansiva alrededor del Pokémon, rayo del cielo).
  style?: 'dash' | 'reach' | 'ground' | 'spikes' | 'rain' | 'nova' | 'strike' | 'wave' | 'storm' | 'leap';
  range?: number;     // alcance de los ataques de área, en px
  multi?: number;     // cantidad de proyectiles lanzados en abanico
  spread?: number;    // ángulo entre proyectiles contiguos, en radianes
  boomerang?: boolean; // el proyectil da la vuelta a mitad de camino
  transform?: boolean; // se transforma en el rival (Transformación)
  hit?: string;       // animación que se suma sobre el rival al conectar un ataque de contacto (ver hitfx.ts)
  tint?: number;      // color con el que se tiñe quien ataca mientras dura el ataque (Enfado)
  grow?: number;      // el proyectil crece hasta este múltiplo de su tamaño mientras vuela
  charge?: number;    // ms que se queda cargando antes de lanzarlo (se puede ir apuntando)
  lob?: number;       // proyectil lanzado en arco que explota al caer, con este radio de daño
  leap?: 'fly' | 'dig' | 'bounce'; // ataque en dos tiempos: desaparece, marca dónde va a caer y cae
  dash?: number;      // px que recorre la embestida
  reach?: number;     // px de alcance del ataque corto
  typeless?: boolean; // sin tipo: ignora STAB y efectividad (Forcejeo)
  recoil?: boolean;   // el usuario pierde 1/4 de sus PS máximos al golpear
}

export interface BaseStats {
  hp: number; atk: number; def: number; spa: number; spd: number; spe: number;
}

export interface Stats extends BaseStats {}

/** Lo mínimo que hace falta de un combatiente para calcular daño: sus tipos, sus stats y su nivel. */
export interface Fighter { types: PType[]; stats: Stats; level: number }

export interface PokemonDef {
  id: string;
  name: string;
  dex: number;         // número de Pokédex; la selección de equipo se ordena por él
  types: PType[];
  base: BaseStats;
  level: number;      // nivel con el que se calculan stats y daño por defecto
  catchRate: number;  // índice de captura de la especie (3 a 255)
  stats: Stats;    // stats calculados al nivel de combate
  maxHp: number;   // PS en combate (stat de PS x HP_MULT)
  speed: number;   // px/s de movimiento con el stat de velocidad sin modificar
  moves: Move[];      // hasta 4 ataques, en las teclas U, I, O, P
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
  psychic: 0xff5cae, ghost: 0x7a5cc9, fighting: 0xd9533f, ground: 0xe0c068, rock: 0xb8a038,
  bug: 0xa8c820, dragon: 0x7a45f8, steel: 0xb8bcd8, dark: 0x8a6a58, fairy: 0xf4a0c0,
};

export const STAT_NAME: Record<StatKey, string> = {
  atk: 'Ataque', def: 'Defensa', spa: 'At. Esp.', spd: 'Def. Esp.', spe: 'Velocidad',
};

// Multiplicadores del atacante (fila) sobre el defensor (columna). Lo omitido es x1.
const CHART: Partial<Record<PType, Partial<Record<PType, number>>>> = {
  normal: { rock: 0.5, steel: 0.5, ghost: 0 },
  fire: { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
  water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  grass: { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
  ice: { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
  fighting: { normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: 0.5 },
  poison: { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
  ground: { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
  flying: { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
  psychic: { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug: { fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5 },
  rock: { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
  ghost: { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
  dragon: { dragon: 2, steel: 0.5, fairy: 0 },
  dark: { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
  steel: { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
  fairy: { fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 },
};

export function effectiveness(move: PType, defender: PType[]): number {
  return defender.reduce((m, t) => m * (CHART[move]?.[t] ?? 1), 1);
}

export const newStages = (): Stages => ({ atk: 0, def: 0, spa: 0, spd: 0, spe: 0 });

// Etapas de stats del juego: +1 = x1.5, +2 = x2 ... / -1 = x2/3, -2 = x1/2 ...
export const stageMult = (n: number) => (n >= 0 ? (2 + n) / 2 : 2 / (2 - n));

/** Usos máximos de un ataque por combate: PP original ponderado por PP_FACTOR. */
export const maxUses = (m: Move) => Math.max(PP_MIN, Math.round(m.pp * PP_FACTOR)) * PP_DOUBLE;

// Stats del juego a un nivel dado (IV 31, EV 0, naturaleza neutra).
export function statsAt(b: BaseStats, level: number): Stats {
  const other = (v: number) => Math.floor(((2 * v + 31) * level) / 100) + 5;
  return {
    hp: Math.floor(((2 * b.hp + 31) * level) / 100) + level + 10,
    atk: other(b.atk), def: other(b.def), spa: other(b.spa), spd: other(b.spd), spe: other(b.spe),
  };
}

/** Un combatiente concreto: la especie a un nivel, con sus stats y su vida máxima ya calculados. */
export function makeCombatant(def: PokemonDef, level: number) {
  const stats = statsAt(def.base, level);
  return { level, stats, maxHp: stats.hp * HP_MULT };
}

export interface DamageResult { damage: number; eff: number; crit: boolean; stab: boolean }

/**
 * Daño de la fórmula del juego: ((2L/5+2) * poder * A/D / 50 + 2) * crítico * aleatorio * STAB * tipos.
 * A y D incluyen las etapas de stats; en un crítico se ignoran las bajadas del atacante y las subidas del
 * defensor. Con random=false devuelve el daño esperado (sin variación ni crítico), útil para la IA.
 */
export function calcDamage(
  att: Fighter, def: Fighter, move: Move, random = true,
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
  let dmg = Math.floor(Math.floor((Math.floor((2 * att.level) / 5) + 2) * move.power * A / D) / 50) + 2;
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

type Raw = Omit<PokemonDef, 'stats' | 'maxHp' | 'speed' | 'dex' | 'level' | 'catchRate'>;

const RAW: Raw[] = [
  {
    id: 'charizard', name: 'Charizard', types: ['fire', 'flying'],
    base: { hp: 78, atk: 84, def: 78, spa: 109, spd: 85, spe: 100 },
    moves: [
      mv('Ascuas', 'fire', 'special', 40, 25, 22, 1100, 480, 800, 0.7, 'ember'),
      mv('Ataque Ala', 'flying', 'physical', 60, 35, 31, 1700, 560, 650, 0.9, 'wing', { style: 'dash', dash: 260, hit: 'wing' }),
      mv('Lanzallamas', 'fire', 'special', 90, 15, 42, 2600, 420, 1000, 1.3, 'flame'),
      st('Danza Espada', 'normal', 20, STATUS_COST, { atk: 2 }),
    ],
  },
  {
    id: 'blastoise', name: 'Blastoise', types: ['water'],
    base: { hp: 79, atk: 83, def: 100, spa: 85, spd: 105, spe: 78 },
    moves: [
      mv('Pistola Agua', 'water', 'special', 40, 25, 22, 1100, 500, 800, 0.7, 'jet'),
      mv('Rayo Hielo', 'ice', 'special', 90, 10, 42, 2500, 360, 900, 0.9, 'icebeam'),
      mv('Hidrobomba', 'water', 'special', 110, 5, 49, 3200, 400, 1000, 1.4, 'hydro'),
      st('Defensa Férrea', 'normal', 15, STATUS_COST, { def: 2 }),
    ],
  },
  {
    id: 'venusaur', name: 'Venusaur', types: ['grass', 'poison'],
    base: { hp: 80, atk: 82, def: 83, spa: 100, spd: 100, spe: 80 },
    moves: [
      st('Desarrollo', 'normal', 20, STATUS_COST, { atk: 1, spa: 1 }),
      mv('Hoja Afilada', 'grass', 'physical', 55, 25, 29, 1500, 800, 650, 0.8, 'razor'),
      mv('Rayo Solar', 'grass', 'special', 120, 10, 52, 3200, 700, 1000, 1.4, 'solar', { charge: 1800 }),
      mv('Bomba Lodo', 'poison', 'special', 90, 10, 42, 2500, 450, 900, 1.6, 'sludgebomb'),
    ],
  },
  {
    id: 'pikachu', name: 'Pikachu', types: ['electric'],
    base: { hp: 35, atk: 55, def: 40, spa: 50, spd: 50, spe: 90 },
    moves: [
      mv('Impactrueno', 'electric', 'special', 40, 30, 22, 1000, 620, 750, 0.6, 'zap'),
      st('Agilidad', 'psychic', 30, STATUS_COST, { spe: 2 }),
      mv('Rayo', 'electric', 'special', 90, 15, 42, 2400, 700, 900, 1.0, 'bolt'),
      mv('Trueno', 'electric', 'special', 110, 10, 49, 3000, 0, 0, 1, 'thunder', { style: 'strike' }),
    ],
  },
  {
    id: 'alakazam', name: 'Alakazam', types: ['psychic'],
    base: { hp: 55, atk: 50, def: 45, spa: 135, spd: 95, spe: 120 },
    moves: [
      mv('Confusión', 'psychic', 'special', 50, 25, 26, 1300, 520, 850, 0.8, 'psy'),
      mv('Psíquico', 'psychic', 'special', 90, 10, 42, 2500, 480, 1000, 1.2, 'psychic'),
      mv('Bola Sombra', 'ghost', 'special', 80, 15, 38, 2200, 500, 950, 1.5, 'ghost'),
      st('Paz Mental', 'psychic', 20, STATUS_COST, { spa: 1, spd: 1 }),
    ],
  },
  {
    id: 'gengar', name: 'Gengar', types: ['ghost', 'poison'],
    base: { hp: 60, atk: 65, def: 60, spa: 130, spd: 75, spe: 110 },
    moves: [
      mv('Lengüetazo', 'ghost', 'physical', 30, 30, 18, 900, 520, 650, 0.7, 'lick', { style: 'reach', reach: 190 }),
      mv('Bola Sombra', 'ghost', 'special', 80, 15, 38, 2200, 500, 950, 1.5, 'ghost'),
      mv('Bomba Lodo', 'poison', 'special', 90, 10, 42, 2500, 460, 900, 1.6, 'sludgebomb'),
      st('Maquinación', 'psychic', 20, STATUS_COST, { spa: 2 }),
    ],
  },
  {
    id: 'wigglytuff', name: 'Wigglytuff', types: ['normal', 'fairy'],
    base: { hp: 140, atk: 70, def: 45, spa: 85, spd: 50, spe: 45 },
    moves: [
      mv('Voz Cautivadora', 'fairy', 'special', 40, 15, 22, 1100, 0, 0, 1, 'notes', { style: 'nova', range: 210 }),
      mv('Golpe Cuerpo', 'normal', 'physical', 85, 15, 40, 2300, 0, 0, 1, 'slam', { style: 'dash', dash: 240, hit: 'bigimpact' }),
      mv('Fuerza Lunar', 'fairy', 'special', 95, 15, 43, 2600, 420, 1000, 1.4, 'moon'),
      st('Paz Mental', 'psychic', 20, STATUS_COST, { spa: 1, spd: 1 }),
    ],
  },
  {
    id: 'machamp', name: 'Machamp', types: ['fighting'],
    base: { hp: 90, atk: 130, def: 80, spa: 65, spd: 85, spe: 55 },
    moves: [
      mv('Puño Bala', 'steel', 'physical', 40, 30, 22, 1100, 0, 0, 1, 'steel', { style: 'dash', dash: 200, hit: 'fist' }),
      mv('Demolición', 'fighting', 'physical', 75, 15, 36, 2000, 0, 0, 1, 'punch', { style: 'dash', dash: 230, hit: 'bricks' }),
      mv('Puño Dinámico', 'fighting', 'physical', 100, 5, 46, 2800, 0, 0, 1, 'punch', { style: 'dash', dash: 260, hit: 'dynpunch' }),
      st('Corpulencia', 'fighting', 20, STATUS_COST, { atk: 1, def: 1 }),
    ],
  },
  {
    id: 'golem', name: 'Golem', types: ['rock', 'ground'],
    base: { hp: 80, atk: 120, def: 130, spa: 55, spd: 65, spe: 45 },
    moves: [
      mv('Lanzarrocas', 'rock', 'physical', 50, 15, 26, 1300, 520, 800, 0.9, 'rock'),
      mv('Avalancha', 'rock', 'physical', 75, 10, 36, 2000, 0, 0, 1, 'rock', { style: 'rain', range: 440 }),
      mv('Terremoto', 'ground', 'physical', 100, 10, 46, 2800, 0, 0, 1, 'earth', { style: 'ground', range: 540 }),
      st('Defensa Férrea', 'steel', 15, STATUS_COST, { def: 2 }),
    ],
  },
  {
    id: 'lapras', name: 'Lapras', types: ['water', 'ice'],
    base: { hp: 130, atk: 85, def: 80, spa: 85, spd: 95, spe: 60 },
    moves: [
      mv('Canto Helado', 'ice', 'physical', 40, 30, 22, 1000, 640, 700, 0.9, 'note'),
      mv('Surf', 'water', 'special', 90, 15, 42, 2500, 0, 0, 1, 'hydro', { style: 'wave', range: 560 }),
      mv('Rayo Hielo', 'ice', 'special', 90, 10, 42, 2500, 360, 900, 0.9, 'icebeam'),
      mv('Ventisca', 'ice', 'special', 110, 5, 49, 3000, 0, 0, 1, 'blizzard', { style: 'storm', range: 560 }),
    ],
  },
  {
    id: 'dragonite', name: 'Dragonite', types: ['dragon', 'flying'],
    base: { hp: 91, atk: 134, def: 95, spa: 100, spd: 100, spe: 80 },
    moves: [
      mv('Ataque Ala', 'flying', 'physical', 60, 35, 31, 1700, 0, 0, 1, 'wing', { style: 'dash', dash: 230, hit: 'wing' }),
      mv('Garra Dragón', 'dragon', 'physical', 80, 15, 38, 2200, 0, 0, 1, 'dragon', { style: 'dash', dash: 250, hit: 'dragonclaw' }),
      mv('Pulso Dragón', 'dragon', 'special', 85, 10, 40, 2400, 420, 1000, 1.5, 'dragon'),
      st('Danza Dragón', 'dragon', 20, STATUS_COST, { atk: 1, spe: 1 }),
    ],
  },
];

// Convierte un ataque del catálogo de `roster.ts` en un `Move`. Costo, recarga y datos del proyectil salen del poder,
// siguiendo la escala de los ataques de arriba (poder 40 = 22 de energía y ~1 s; poder 120 = ~54 y ~3,3 s).
function fromCatalog(key: string): Move {
  const boost = BOOSTS[key];
  if (boost) return { ...st(boost[0], boost[1], boost[2], STATUS_COST, boost[3]), ...(key === 'transform' ? { transform: true } : {}) };
  const [name, type, cat, power, pp, fx, shape, extra = {}] = MOVES[key];
  const category = cat as 'physical' | 'special';
  const cost = Math.min(60, Math.max(14, Math.round(6 + power * 0.4)));
  const cooldown = Math.min(3800, Math.max(800, Math.round(1000 + (power - 40) * 29)));
  const over = Math.max(0, power - 40);
  if (shape === 'd') return mv(name, type, category, power, pp, cost, cooldown, 0, 0, 1, fx, { style: 'dash', dash: Math.round(200 + over * 0.7), ...extra });
  if (shape === 'r') return mv(name, type, category, power, pp, cost, cooldown, 520, 650, 0.7, fx, { style: 'reach', reach: 190, ...extra });
  const area = { g: ['ground', 540], s: ['spikes', 420], a: ['rain', 440], n: ['nova', 230], t: ['strike', 0], w: ['wave', 560], b: ['storm', 560], l: ['leap', 500] }[shape as 'g' | 's' | 'a' | 'n' | 't' | 'w' | 'b' | 'l'];
  if (area) return mv(name, type, category, power, pp, cost, cooldown, 0, 0, 1, fx, { style: area[0] as Move['style'], range: area[1] as number, ...extra });
  const size = Math.round((0.7 + over * 0.0095) * 100) / 100;
  return mv(name, type, category, power, pp, cost, cooldown, Math.round(520 - over * 1.1), Math.round(750 + over * 3), size, fx, extra);
}

// Las especies con pocos ataques (Metapod, Magikarp, Ditto...) simplemente tienen menos de 4.
const EXTRA_RAW: Raw[] = SPECIES.map(([id, name, , types, b, , keys]) => ({
  id, name, types, base: { hp: b[0], atk: b[1], def: b[2], spa: b[3], spd: b[4], spe: b[5] }, moves: keys.map(fromCatalog),
}));

// Números de Pokédex oficiales. Al sumar un combatiente, agrega también su número aquí.
const DEX: Record<string, number> = {
  venusaur: 3, charizard: 6, blastoise: 9, pikachu: 25, wigglytuff: 40, alakazam: 65, machamp: 68, golem: 76, gengar: 94, lapras: 131, dragonite: 149
};

// Índice de captura de cada especie (verificado en Pokémon Database). Si falta, se usa 45, el más común.
const CATCH: Record<string, number> = {
  venusaur: 45, charizard: 45, blastoise: 45, pikachu: 190, wigglytuff: 50, alakazam: 50,
  machamp: 45, golem: 45, gengar: 45, lapras: 45, dragonite: 45,
};

/** Todos los combatientes, ordenados por número de Pokédex. */
for (const [id, , dex, , , catchRate] of SPECIES) { DEX[id] = dex; CATCH[id] = catchRate; }

export const POKEMON: PokemonDef[] = [...RAW, ...EXTRA_RAW].map((r) => {
  const stats = statsAt(r.base, LEVEL);
  return {
    ...r, dex: DEX[r.id], level: LEVEL, catchRate: CATCH[r.id] ?? 45, stats,
    maxHp: stats.hp * HP_MULT, speed: Math.round(100 + stats.spe * 1.1),
  };
}).sort((a, b) => a.dex - b.dex);

/** Lo que conserva un Pokémon de su equipo entre batallas en la aventura: sus PS y los usos que le quedan de cada ataque. */
export interface PartyMon { hp: number; pp: number[] }
export type Party = Record<number, PartyMon>;   // por índice en POKEMON

// Las curaciones también se multiplican por HP_MULT (Poción original: 20 PS).
export const ITEMS = {
  potion: { name: 'Poción', desc: `+${20 * HP_MULT} PS`, hp: 20 * HP_MULT, energy: 0 },
  ether: { name: 'Éter', desc: '+60 Energía', hp: 0, energy: 60 },
} as const;
export type ItemId = keyof typeof ITEMS;

// ---------- captura de Pokémon salvajes ----------

/** Pokébolas: multiplicador de captura (la Master Ball captura siempre, sin usar la fórmula). */
export const BALLS = {
  poke: { name: 'Poké Ball', mult: 1, sure: false },
  great: { name: 'Super Ball', mult: 1.5, sure: false },
  ultra: { name: 'Ultra Ball', mult: 2, sure: false },
  master: { name: 'Master Ball', mult: 1, sure: true },
} as const;
export type BallId = keyof typeof BALLS;

/** Rango de niveles de los Pokémon salvajes. */
export const WILD_LEVEL_MIN = 5;
export const WILD_LEVEL_MAX = 60;
