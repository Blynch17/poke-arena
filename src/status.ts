// Estados alterados de los juegos (quemadura, parálisis, sueño...) traducidos al tiempo real de la arena.
//
// Los juegos cuentan en turnos; aquí un "turno" es lo que tarda un Pokémon en lanzar un ataque de promedio:
//   - un ataque de poder ~70 cuesta ~34 de energía y la energía se recupera a 12/s  ->  ~2,8 s entre ataques
//     (la recarga del propio ataque, ~1,9 s, queda por debajo, así que manda la energía).
// Todas las duraciones se escriben en turnos y se pasan a milisegundos con TURN_MS.

export type StatusId = 'burn' | 'poison' | 'toxic' | 'paralysis' | 'sleep' | 'freeze' | 'confusion';

/** Efecto secundario de un ataque: qué estado causa y con qué probabilidad (%). 'flinch' = retroceso, 'tri' = Triataque. */
export interface Inflict { status: StatusId | 'flinch' | 'tri'; chance: number }

export const TURN_MS = 2800;

/** Retroceso: el rival pierde el ataque en curso; dura un instante, no un turno entero (en los juegos solo vale si el
 *  que retrocede iba a actuar después, aquí basta con interrumpirlo un rato). */
export const FLINCH_MS = 900;

/** Un ataque fallido por parálisis o confusión cuesta este tiempo sin poder atacar (en los juegos pierde el turno). */
export const FAIL_BLOCK_MS = 1500;

/** Probabilidades de los juegos (generación 5). */
export const PARALYSIS_FAIL = 0.25;   // de no poder moverse en cada intento
export const CONFUSION_SELF = 0.5;    // de golpearse a sí mismo en cada intento
export const THAW_CHANCE = 0.2;       // de descongelarse en cada turno
export const CONFUSION_SELF_POWER = 40;

/** Tras curarse (o despertar), un Pokémon resiste nuevos estados este tiempo, para no encadenar sueño tras sueño. */
export const STATUS_GRACE_MS = 7000;

/** Ataques de estado del rival: tiempo mínimo hasta volver a usar uno, y si el último sí causó el estado, mucho más. */
export const AI_STATUS_COOLDOWN_MS = 9000;
export const AI_STATUS_COOLDOWN_HIT_MS = 20000;

/** Daño por turno como fracción de los PS máximos (gen. 5): quemadura 1/8, veneno 1/8, tóxico n/16 (n sube cada turno).
 *  BattleScene lo divide entre HP_MULT: la vida está multiplicada por 5 pero los ataques no, así que sin dividir una
 *  quemadura haría más daño que un ataque de verdad. Con la división queda en la misma proporción que en los juegos. */
export const BURN_FRAC = 1 / 8;
export const POISON_FRAC = 1 / 8;
export const TOXIC_STEP = 1 / 16;
export const TOXIC_MAX_N = 15;

export const BURN_ATK_MULT = 0.5;     // la quemadura reduce a la mitad el daño de los ataques físicos

const randInt = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));

/** Duración de un estado recién aplicado, en milisegundos.
 *  - Dormir: 1 a 3 turnos (gen. 5).
 *  - Congelación: en los juegos se descongela con 20 % por turno (5 turnos de promedio), aquí con tope de 9.
 *  - Confusión: 1 a 4 turnos (gen. 5).
 *  - Quemadura, veneno, tóxico y parálisis duran todo el combate en los juegos; aquí 8 turnos (~22 s) los de daño
 *    y 5 (~14 s) la parálisis, que además deja inmóvil (en los juegos solo baja la velocidad). */
export function rollDuration(id: StatusId): number {
  switch (id) {
    case 'sleep': return randInt(1, 3) * TURN_MS;
    case 'confusion': return randInt(1, 4) * TURN_MS;
    case 'freeze': { let n = 1; while (n < 9 && Math.random() > THAW_CHANCE) n++; return n * TURN_MS; }
    case 'paralysis': return 5 * TURN_MS;
    default: return 8 * TURN_MS;
  }
}

export interface StatusInfo { name: string; abbr: string; color: number; tint: number; text: string; cured: string }

export const STATUS_INFO: Record<StatusId, StatusInfo> = {
  burn: { name: 'Quemado', abbr: 'QUE', color: 0xe8541c, tint: 0xff9a86, text: '¡Se quemó!', cured: 'Ya no está quemado' },
  poison: { name: 'Envenenado', abbr: 'ENV', color: 0x9c4fc4, tint: 0xd49aff, text: '¡Se envenenó!', cured: 'Ya no está envenenado' },
  toxic: { name: 'Muy envenenado', abbr: 'TOX', color: 0x7a2fa8, tint: 0xc07cf0, text: '¡Se envenenó gravemente!', cured: 'Ya no está envenenado' },
  paralysis: { name: 'Paralizado', abbr: 'PAR', color: 0xe0b800, tint: 0xfff2a0, text: '¡Se paralizó!', cured: 'Ya no está paralizado' },
  sleep: { name: 'Dormido', abbr: 'DOR', color: 0x6a74b8, tint: 0xc6cae6, text: '¡Se durmió!', cured: '¡Se despertó!' },
  freeze: { name: 'Congelado', abbr: 'CON', color: 0x4fb4e8, tint: 0x9edcff, text: '¡Se congeló!', cured: '¡Se descongeló!' },
  confusion: { name: 'Confuso', abbr: 'CNF', color: 0xd98a2b, tint: 0xffffff, text: '¡Quedó confuso!', cured: 'Ya no está confuso' },
};
