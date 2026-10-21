export type PType =
  | 'normal' | 'fire' | 'water' | 'grass' | 'electric'
  | 'ice' | 'poison' | 'flying' | 'psychic' | 'ghost';

export interface Move {
  name: string;
  type: PType;
  power: number;
  cost: number;     // energía
  cooldown: number; // ms
  speed: number;    // px/s del proyectil
  life: number;     // ms de vuelo
  size: number;     // escala del proyectil
}

export interface PokemonDef {
  id: string;
  name: string;
  types: PType[];
  maxHp: number;
  speed: number;
  moves: [Move, Move, Move, Move]; // teclas U, I, O, P
}

export const TYPE_COLOR: Record<PType, number> = {
  normal: 0xd0d0c0, fire: 0xff7a1a, water: 0x3d9bff, grass: 0x4fd14f,
  electric: 0xffe135, ice: 0x8ae6ff, poison: 0xb45cd6, flying: 0xa9b9ff,
  psychic: 0xff5cae, ghost: 0x7a5cc9,
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

const mv = (
  name: string, type: PType, power: number, cost: number,
  cooldown: number, speed: number, life: number, size: number,
): Move => ({ name, type, power, cost, cooldown, speed, life, size });

export const POKEMON: PokemonDef[] = [
  {
    id: 'charizard', name: 'Charizard', types: ['fire', 'flying'], maxHp: 200, speed: 235,
    moves: [
      mv('Ascuas', 'fire', 11, 8, 280, 480, 800, 0.7),
      mv('Ataque Ala', 'flying', 17, 14, 600, 560, 650, 0.9),
      mv('Lanzallamas', 'fire', 27, 28, 1100, 420, 1000, 1.3),
      mv('Tajo', 'normal', 19, 16, 700, 520, 600, 0.9),
    ],
  },
  {
    id: 'blastoise', name: 'Blastoise', types: ['water'], maxHp: 230, speed: 190,
    moves: [
      mv('Pistola Agua', 'water', 11, 8, 280, 500, 800, 0.7),
      mv('Rayo Hielo', 'ice', 20, 18, 750, 560, 900, 0.9),
      mv('Hidrobomba', 'water', 30, 30, 1200, 400, 1000, 1.4),
      mv('Placaje', 'normal', 15, 10, 500, 460, 550, 1.0),
    ],
  },
  {
    id: 'venusaur', name: 'Venusaur', types: ['grass', 'poison'], maxHp: 220, speed: 190,
    moves: [
      mv('Látigo Cepa', 'grass', 12, 8, 300, 520, 750, 0.7),
      mv('Hoja Afilada', 'grass', 18, 15, 650, 640, 800, 0.8),
      mv('Rayo Solar', 'grass', 30, 32, 1250, 430, 1000, 1.4),
      mv('Bomba Lodo', 'poison', 21, 20, 800, 450, 900, 1.0),
    ],
  },
  {
    id: 'pikachu', name: 'Pikachu', types: ['electric'], maxHp: 160, speed: 275,
    moves: [
      mv('Impactrueno', 'electric', 11, 7, 260, 620, 750, 0.6),
      mv('Ataque Rápido', 'normal', 13, 8, 380, 700, 450, 0.7),
      mv('Rayo', 'electric', 25, 24, 1000, 700, 900, 1.0),
      mv('Bola Voltio', 'electric', 20, 18, 750, 480, 1000, 1.1),
    ],
  },
  {
    id: 'alakazam', name: 'Alakazam', types: ['psychic'], maxHp: 150, speed: 250,
    moves: [
      mv('Confusión', 'psychic', 12, 8, 300, 520, 850, 0.8),
      mv('Psíquico', 'psychic', 24, 22, 900, 480, 1000, 1.2),
      mv('Bola Sombra', 'ghost', 21, 18, 750, 500, 950, 1.0),
      mv('Rayo Hielo', 'ice', 19, 17, 700, 560, 900, 0.9),
    ],
  },
  {
    id: 'gengar', name: 'Gengar', types: ['ghost', 'poison'], maxHp: 170, speed: 240,
    moves: [
      mv('Lengüetazo', 'ghost', 11, 7, 280, 520, 650, 0.7),
      mv('Bola Sombra', 'ghost', 22, 20, 800, 500, 950, 1.0),
      mv('Bomba Lodo', 'poison', 21, 18, 750, 460, 900, 1.0),
      mv('Psíquico', 'psychic', 23, 22, 900, 470, 1000, 1.1),
    ],
  },
];

export const ENERGY_MAX = 100;
export const ENERGY_REGEN = 14; // por segundo

export const ITEMS = {
  potion: { name: 'Poción', desc: '+60 PS', hp: 60, energy: 0 },
  ether: { name: 'Éter', desc: '+60 Energía', hp: 0, energy: 60 },
} as const;
export type ItemId = keyof typeof ITEMS;
