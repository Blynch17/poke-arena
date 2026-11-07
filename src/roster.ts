// El resto de la primera generación: ataques y especies como datos planos. `data.ts` los convierte en combatientes.
// Los stats base y los tipos son los de los juegos actuales; los ataques son movimientos que cada especie aprende de
// verdad (por nivel, MT/MO o tutor) en alguna entrega. Para sumar o cambiar un ataque basta editar `MOVES`.

import type { PType, Category, Stages } from './data';
import type { StatusId, Inflict } from './status';

/** Datos opcionales de un ataque: alcance (área), proyectiles en abanico (multi, spread) y bumerán. */
type MoveExtra = {
  range?: number; multi?: number; spread?: number; boomerang?: boolean;
  hit?: string; tint?: number; grow?: number; charge?: number; lob?: number; leap?: 'fly' | 'dig' | 'bounce'; speed?: number; size?: number;
};

/**
 * Ataque de daño: nombre, tipo, categoría, poder, PP, efecto visual y forma: 'p' proyectil, 'd' embestida, 'r' alcance
 * corto, 'g' onda por el suelo, 's' picos de roca, 'a' lluvia de rocas, 'n' onda expansiva, 't' rayo del cielo, 'w' ola,
 * 'b' ventisca y 'l' salto (desaparece y cae). `hit` es la animación que se suma sobre el rival al conectar (ver hitfx.ts).
 */
type MoveRow = [string, PType, Category, number, number, string, 'p' | 'd' | 'r' | 'g' | 's' | 'a' | 'n' | 't' | 'w' | 'b' | 'l', MoveExtra?];

export const MOVES: Record<string, MoveRow> = {
  // normal
  tackle: ['Placaje', 'normal', 'physical', 40, 35, 'slam', 'd'],
  scratch: ['Arañazo', 'normal', 'physical', 40, 35, 'wing', 'd', { hit: 'claw' }],
  quick: ['Ataque Rápido', 'normal', 'physical', 40, 30, 'slam', 'd'],
  bodyslam: ['Golpe Cuerpo', 'normal', 'physical', 85, 15, 'slam', 'd'],
  headbutt: ['Golpe Cabeza', 'normal', 'physical', 70, 15, 'slam', 'd', { hit: 'headbutt' }],
  slash: ['Cuchillada', 'normal', 'physical', 70, 20, 'wing', 'd', { hit: 'claw' }],
  hyperfang: ['Hipercolmillo', 'normal', 'physical', 80, 15, 'slam', 'd', { hit: 'fang' }],
  swift: ['Rapidez', 'normal', 'special', 60, 20, 'star', 'p', { multi: 5, spread: 0.16 }],
  hyperbeam: ['Hiperrayo', 'normal', 'special', 150, 5, 'hyper', 'p', { speed: 1150 }],
  triattack: ['Triataque', 'normal', 'special', 80, 10, 'tri', 'p'],
  doubleedge: ['Doble Filo', 'normal', 'physical', 120, 15, 'slam', 'd', { hit: 'megaimpact' }],
  takedown: ['Derribo', 'normal', 'physical', 90, 20, 'slam', 'd', { hit: 'bigimpact' }],
  megakick: ['Megapatada', 'normal', 'physical', 120, 5, 'punch', 'd', { hit: 'kick' }],
  megapunch: ['Megapuño', 'normal', 'physical', 80, 20, 'punch', 'd', { hit: 'fist' }],
  stomp: ['Pisotón', 'normal', 'physical', 65, 20, 'slam', 'd', { hit: 'stomp' }],
  furyswipes: ['Golpes Furia', 'normal', 'physical', 50, 15, 'wing', 'd', { hit: 'claws' }],
  hornattack: ['Cornada', 'normal', 'physical', 65, 25, 'slam', 'd', { hit: 'horn' }],
  vicegrip: ['Agarre', 'normal', 'physical', 55, 30, 'slam', 'd'],
  slam: ['Atizar', 'normal', 'physical', 80, 20, 'slam', 'd', { hit: 'tail' }],
  extremespeed: ['Velocidad Extrema', 'normal', 'physical', 80, 5, 'slam', 'd', { hit: 'speedlines' }],
  eggbomb: ['Bomba Huevo', 'normal', 'physical', 100, 10, 'egg', 'p', { lob: 85 }],
  flail: ['Azote', 'normal', 'physical', 60, 15, 'slam', 'd', { hit: 'whip' }],
  // volador
  peck: ['Picotazo', 'flying', 'physical', 35, 35, 'wing', 'd', { hit: 'jab' }],
  drillpeck: ['Pico Taladro', 'flying', 'physical', 80, 20, 'wing', 'd', { hit: 'jab' }],
  wingattack: ['Ataque Ala', 'flying', 'physical', 60, 35, 'wing', 'd', { hit: 'wing' }],
  aerialace: ['Golpe Aéreo', 'flying', 'physical', 60, 20, 'wing', 'd', { hit: 'airblades' }],
  gust: ['Tornado', 'flying', 'special', 40, 35, 'tornado', 'p'],
  airslash: ['Tajo Aéreo', 'flying', 'special', 75, 15, 'wind', 'p'],
  fly: ['Vuelo', 'flying', 'physical', 90, 15, 'wing', 'l', { leap: 'fly' }],
  bounce: ['Bote', 'flying', 'physical', 85, 5, 'wing', 'l', { leap: 'bounce' }],
  // tierra y roca
  earthquake: ['Terremoto', 'ground', 'physical', 100, 10, 'earth', 'g'],
  dig: ['Excavar', 'ground', 'physical', 80, 10, 'earth', 'l', { leap: 'dig' }],
  bonemerang: ['Huesomerang', 'ground', 'physical', 90, 10, 'bone', 'p', { boomerang: true }],
  rockthrow: ['Lanzarrocas', 'rock', 'physical', 50, 15, 'rock', 'p'],
  rockslide: ['Avalancha', 'rock', 'physical', 75, 10, 'rock', 'a'],
  stoneedge: ['Roca Afilada', 'rock', 'physical', 100, 5, 'rock', 's'],
  ancientpower: ['Poder Pasado', 'rock', 'special', 60, 5, 'ancient', 'p', { multi: 3, spread: 0.35 }],
  // fuego
  ember: ['Ascuas', 'fire', 'special', 40, 25, 'ember', 'p'],
  flamethrower: ['Lanzallamas', 'fire', 'special', 90, 15, 'flame', 'p'],
  fireblast: ['Llamarada', 'fire', 'special', 110, 5, 'blast', 'p', { grow: 2.4, speed: 330 }],
  heatwave: ['Onda Ígnea', 'fire', 'special', 95, 10, 'flame', 'n', { range: 260 }],
  firepunch: ['Puño Fuego', 'fire', 'physical', 75, 15, 'ember', 'd', { hit: 'fist' }],
  flamewheel: ['Rueda Fuego', 'fire', 'physical', 60, 25, 'ember', 'd', { hit: 'firewheel' }],
  flareblitz: ['Envite Ígneo', 'fire', 'physical', 120, 15, 'ember', 'd', { hit: 'megaimpact' }],
  // agua
  watergun: ['Pistola Agua', 'water', 'special', 40, 25, 'jet', 'p'],
  bubblebeam: ['Rayo Burbuja', 'water', 'special', 65, 20, 'bubble', 'p', { multi: 3, spread: 0.3 }],
  surf: ['Surf', 'water', 'special', 90, 15, 'hydro', 'w'],
  hydropump: ['Hidrobomba', 'water', 'special', 110, 5, 'hydro', 'p'],
  waterfall: ['Cascada', 'water', 'physical', 80, 15, 'water', 'd', { hit: 'waterfall' }],
  aquajet: ['Acua Jet', 'water', 'physical', 40, 20, 'water', 'd', { hit: 'speedlines' }],
  crabhammer: ['Martillazo', 'water', 'physical', 100, 10, 'water', 'd', { hit: 'hammer' }],
  // planta
  vinewhip: ['Látigo Cepa', 'grass', 'physical', 45, 25, 'vine', 'p', { multi: 2, spread: 0.3 }],
  razorleaf: ['Hoja Afilada', 'grass', 'physical', 55, 25, 'razor', 'p', { speed: 800 }],
  megadrain: ['Megaagotar', 'grass', 'special', 40, 15, 'leaf', 'p'],
  gigadrain: ['Gigadrenado', 'grass', 'special', 75, 10, 'leaf', 'p'],
  solarbeam: ['Rayo Solar', 'grass', 'special', 120, 10, 'solar', 'p', { speed: 700, charge: 1800 }],
  petaldance: ['Danza Pétalo', 'grass', 'special', 120, 10, 'leaf', 'n', { range: 240 }],
  leafblade: ['Hoja Aguda', 'grass', 'physical', 90, 15, 'blade', 'p', { multi: 3, spread: 0.32 }],
  powerwhip: ['Latigazo', 'grass', 'physical', 120, 10, 'leaf', 'd', { hit: 'vinewhips' }],
  // eléctrico
  thundershock: ['Impactrueno', 'electric', 'special', 40, 30, 'zap', 'p'],
  thunderbolt: ['Rayo', 'electric', 'special', 90, 15, 'bolt', 'p'],
  thunder: ['Trueno', 'electric', 'special', 110, 10, 'thunder', 't'],
  thunderpunch: ['Puño Trueno', 'electric', 'physical', 75, 15, 'spark', 'd', { hit: 'fist' }],
  spark: ['Chispazo', 'electric', 'physical', 65, 20, 'spark', 'd'],
  // hielo
  icebeam: ['Rayo Hielo', 'ice', 'special', 90, 10, 'icebeam', 'p', { speed: 360 }],
  blizzard: ['Ventisca', 'ice', 'special', 110, 5, 'blizzard', 'b'],
  icepunch: ['Puño Hielo', 'ice', 'physical', 75, 15, 'ice', 'd', { hit: 'fist' }],
  aurorabeam: ['Rayo Aurora', 'ice', 'special', 65, 20, 'aurora', 'p'],
  // psíquico y fantasma
  confusion: ['Confusión', 'psychic', 'special', 50, 25, 'psy', 'p'],
  psybeam: ['Psicorrayo', 'psychic', 'special', 65, 20, 'psybeam', 'p'],
  psychic: ['Psíquico', 'psychic', 'special', 90, 10, 'psychic', 'p'],
  psystrike: ['Onda Mental', 'psychic', 'special', 100, 10, 'mind', 'n', { range: 380 }],
  zenheadbutt: ['Cabezazo Zen', 'psychic', 'physical', 80, 15, 'psy', 'd', { hit: 'headbutt' }],
  dreameater: ['Come Sueños', 'psychic', 'special', 100, 15, 'dream', 'n', { range: 270 }],
  shadowball: ['Bola Sombra', 'ghost', 'special', 80, 15, 'ghost', 'p', { size: 1.5 }],
  shadowpunch: ['Puño Sombra', 'ghost', 'physical', 60, 20, 'shadow', 'd', { hit: 'fist' }],
  lick: ['Lengüetazo', 'ghost', 'physical', 30, 30, 'lick', 'r'],
  // siniestro
  bite: ['Mordisco', 'dark', 'physical', 60, 25, 'dark', 'd', { hit: 'bite' }],
  crunch: ['Triturar', 'dark', 'physical', 80, 15, 'dark', 'd', { hit: 'crunch' }],
  darkpulse: ['Pulso Umbrío', 'dark', 'special', 80, 15, 'darkbeam', 'p'],
  nightslash: ['Tajo Umbrío', 'dark', 'physical', 70, 15, 'dark', 'd', { hit: 'darkslash' }],
  // veneno
  sludge: ['Residuos', 'poison', 'special', 65, 20, 'toxic', 'p'],
  sludgebomb: ['Bomba Lodo', 'poison', 'special', 90, 10, 'sludgebomb', 'p', { size: 1.6 }],
  acid: ['Ácido', 'poison', 'special', 40, 30, 'sludge', 'p'],
  poisonjab: ['Puya Nociva', 'poison', 'physical', 80, 20, 'sludge', 'd', { hit: 'jab' }],
  psting: ['Picotazo Veneno', 'poison', 'physical', 15, 35, 'cone', 'p'],
  // bicho
  bugbite: ['Picadura', 'bug', 'physical', 60, 20, 'bug', 'd'],
  bugbuzz: ['Zumbido', 'bug', 'special', 90, 10, 'buzz', 'n', { range: 230 }],
  silverwind: ['Viento Plata', 'bug', 'special', 60, 5, 'wind', 'n', { range: 200 }],
  xscissor: ['Tijera X', 'bug', 'physical', 80, 15, 'bug', 'd', { hit: 'xcut' }],
  megahorn: ['Megacuerno', 'bug', 'physical', 120, 10, 'bug', 'd', { hit: 'megahorn' }],
  leechlife: ['Chupavidas', 'bug', 'physical', 80, 10, 'bug', 'd', { hit: 'drain' }],
  // lucha
  karatechop: ['Golpe Kárate', 'fighting', 'physical', 50, 25, 'punch', 'd', { hit: 'chop' }],
  crosschop: ['Machada', 'fighting', 'physical', 100, 5, 'punch', 'd', { hit: 'crosschop' }],
  brickbreak: ['Demolición', 'fighting', 'physical', 75, 15, 'punch', 'd', { hit: 'bricks' }],
  dynamicpunch: ['Puño Dinámico', 'fighting', 'physical', 100, 5, 'punch', 'd', { hit: 'dynpunch' }],
  submission: ['Sumisión', 'fighting', 'physical', 80, 20, 'punch', 'd', { hit: 'grapple' }],
  rollingkick: ['Patada Giro', 'fighting', 'physical', 60, 15, 'punch', 'd', { hit: 'spinkick' }],
  jumpkick: ['Patada Salto', 'fighting', 'physical', 100, 10, 'punch', 'd', { hit: 'kick' }],
  superpower: ['Fuerza Bruta', 'fighting', 'physical', 120, 5, 'punch', 'd', { hit: 'superpower' }],
  // acero, dragón, hada
  irontail: ['Cola Férrea', 'steel', 'physical', 100, 15, 'steel', 'd', { hit: 'tail' }],
  flashcannon: ['Foco Resplandor', 'steel', 'special', 80, 10, 'flash', 'p'],
  dragonpulse: ['Pulso Dragón', 'dragon', 'special', 85, 10, 'dragon', 'p', { size: 1.5 }],
  dragonbreath: ['Dragoaliento', 'dragon', 'special', 60, 20, 'dragonbreath', 'p'],
  twister: ['Ciclón', 'dragon', 'special', 40, 20, 'dragon', 'n', { range: 190 }],
  outrage: ['Enfado', 'dragon', 'physical', 120, 10, 'dragon', 'd', { hit: 'megaimpact', tint: 0xff3b30 }],
  disarming: ['Voz Cautivadora', 'fairy', 'special', 40, 15, 'notes', 'n', { range: 210 }],
  moonblast: ['Fuerza Lunar', 'fairy', 'special', 95, 15, 'moon', 'p', { size: 1.4 }],
  dazzlinggleam: ['Brillo Mágico', 'fairy', 'special', 80, 10, 'gleam', 'p'],
};

/** Ataque de estado que mejora los stats de quien lo usa: nombre, tipo, PP y mejora. */
type BoostRow = [string, PType, number, Partial<Stages>];

export const BOOSTS: Record<string, BoostRow> = {
  swordsdance: ['Danza Espada', 'normal', 20, { atk: 2 }],
  agility: ['Agilidad', 'psychic', 30, { spe: 2 }],
  amnesia: ['Amnesia', 'psychic', 20, { spd: 2 }],
  harden: ['Fortaleza', 'normal', 30, { def: 1 }],
  withdraw: ['Refugio', 'water', 40, { def: 1 }],
  irondefense: ['Defensa Férrea', 'steel', 15, { def: 2 }],
  acidarmor: ['Armadura Ácida', 'poison', 20, { def: 2 }],
  barrier: ['Barrera', 'psychic', 20, { def: 2 }],
  growth: ['Desarrollo', 'normal', 20, { atk: 1, spa: 1 }],
  calmmind: ['Paz Mental', 'psychic', 20, { spa: 1, spd: 1 }],
  bulkup: ['Corpulencia', 'fighting', 20, { atk: 1, def: 1 }],
  dragondance: ['Danza Dragón', 'dragon', 20, { atk: 1, spe: 1 }],
  rockpolish: ['Pulido', 'rock', 20, { spe: 2 }],
  nastyplot: ['Maquinación', 'dark', 20, { spa: 2 }],
  meditate: ['Meditación', 'psychic', 40, { atk: 1 }],
  splash: ['Salpicadura', 'normal', 40, {}],          // no hace nada, como en los juegos
  transform: ['Transformación', 'normal', 10, {}],    // todavía sin efecto
};


/** Ataque de estado que causa un estado alterado al rival: nombre, tipo, PP, efecto del proyectil y estado. Se lanza
 *  como proyectil y, si da en el blanco, aplica el estado (sin daño). */
type StatusMoveRow = [string, PType, number, string, StatusId];

export const STATUS_MOVES: Record<string, StatusMoveRow> = {
  hypnosis: ['Hipnosis', 'psychic', 20, 'psy', 'sleep'],
  sleeppowder: ['Somnífero', 'grass', 15, 'cone', 'sleep'],
  spore: ['Espora', 'grass', 15, 'leaf', 'sleep'],
  sing: ['Canto', 'normal', 15, 'note', 'sleep'],
  lovelykiss: ['Beso Amoroso', 'normal', 10, 'fairy', 'sleep'],
  thunderwave: ['Onda Trueno', 'electric', 20, 'zap', 'paralysis'],
  stunspore: ['Paralizador', 'grass', 30, 'cone', 'paralysis'],
  glare: ['Deslumbrar', 'normal', 30, 'star', 'paralysis'],
  toxic: ['Tóxico', 'poison', 10, 'toxic', 'toxic'],
  poisonpowder: ['Polvo Veneno', 'poison', 35, 'sludge', 'poison'],
  willowisp: ['Fuego Fatuo', 'fire', 15, 'ember', 'burn'],
  supersonic: ['Supersónico', 'normal', 20, 'wind', 'confusion'],
  confuseray: ['Rayo Confuso', 'ghost', 10, 'ghost', 'confusion'],
};

/**
 * Efecto secundario de los ataques de daño, por nombre: [estado, probabilidad %]. Son las probabilidades de los juegos
 * (generación 5). 'flinch' es retroceso y 'tri' el de Triataque (quemar, paralizar o congelar, al azar).
 */
export const INFLICT: Record<string, [Inflict['status'], number]> = {
  // quemar
  'Ascuas': ['burn', 10], 'Lanzallamas': ['burn', 10], 'Llamarada': ['burn', 10], 'Onda Ígnea': ['burn', 10],
  'Puño Fuego': ['burn', 10], 'Rueda Fuego': ['burn', 10], 'Envite Ígneo': ['burn', 10],
  // paralizar
  'Impactrueno': ['paralysis', 10], 'Rayo': ['paralysis', 10], 'Trueno': ['paralysis', 30], 'Puño Trueno': ['paralysis', 10],
  'Chispazo': ['paralysis', 30], 'Lengüetazo': ['paralysis', 30], 'Golpe Cuerpo': ['paralysis', 30], 'Dragoaliento': ['paralysis', 30],
  'Bote': ['paralysis', 30],
  // congelar
  'Rayo Hielo': ['freeze', 10], 'Ventisca': ['freeze', 10], 'Puño Hielo': ['freeze', 10],
  // envenenar
  'Picotazo Veneno': ['poison', 30], 'Residuos': ['poison', 30], 'Bomba Lodo': ['poison', 30], 'Puya Nociva': ['poison', 30],
  // confundir
  'Confusión': ['confusion', 10], 'Psicorrayo': ['confusion', 10], 'Puño Dinámico': ['confusion', 100],
  // retroceso
  'Mordisco': ['flinch', 30], 'Golpe Cabeza': ['flinch', 30], 'Pisotón': ['flinch', 30], 'Hipercolmillo': ['flinch', 10],
  'Avalancha': ['flinch', 30], 'Cascada': ['flinch', 20], 'Ciclón': ['flinch', 20], 'Tajo Aéreo': ['flinch', 30],
  'Pulso Umbrío': ['flinch', 20], 'Cabezazo Zen': ['flinch', 20],
  // al azar entre quemar, paralizar y congelar
  'Triataque': ['tri', 20],
};

/** Precisión de los ataques que no son del 100 %, por nombre (valores de los juegos, gen. 5). Los demás nunca fallan. */
export const ACCURACY: Record<string, number> = {
  // normal
  'Hipercolmillo': 90, 'Hiperrayo': 90, 'Derribo': 85, 'Megapatada': 75, 'Megapuño': 85, 'Golpes Furia': 80, 'Atizar': 75, 'Bomba Huevo': 75,
  // volador, tierra, roca
  'Tajo Aéreo': 95, 'Vuelo': 95, 'Bote': 85, 'Huesomerang': 90, 'Lanzarrocas': 90, 'Avalancha': 90, 'Roca Afilada': 80,
  // fuego, agua, planta
  'Llamarada': 85, 'Onda Ígnea': 90, 'Hidrobomba': 80, 'Martillazo': 90, 'Hoja Afilada': 95, 'Latigazo': 85,
  // eléctrico, hielo, psíquico, bicho, lucha, acero
  'Trueno': 70, 'Ventisca': 70, 'Canto Helado': 95, 'Cabezazo Zen': 90, 'Megacuerno': 85,
  'Machada': 80, 'Puño Dinámico': 50, 'Sumisión': 80, 'Patada Giro': 85, 'Patada Salto': 95, 'Cola Férrea': 75,
  // ataques de estado
  'Hipnosis': 60, 'Somnífero': 75, 'Canto': 55, 'Beso Amoroso': 75, 'Paralizador': 75, 'Deslumbrar': 90, 'Tóxico': 90,
  'Polvo Veneno': 75, 'Fuego Fatuo': 75, 'Supersónico': 55,
};

type Base = [number, number, number, number, number, number]; // PS, Atq, Def, AtqEsp, DefEsp, Vel

/** id, nombre, número de Pokédex, tipos, stats base, índice de captura y 4 ataques (de `MOVES` o `BOOSTS`). */
export type SpeciesRow = [string, string, number, PType[], Base, number, string[]];

export const SPECIES: SpeciesRow[] = [
  ['bulbasaur', 'Bulbasaur', 1, ['grass', 'poison'], [45, 49, 49, 65, 65, 45], 45, ['vinewhip', 'razorleaf', 'sludgebomb', 'sleeppowder']],
  ['ivysaur', 'Ivysaur', 2, ['grass', 'poison'], [60, 62, 63, 80, 80, 60], 45, ['razorleaf', 'sludgebomb', 'solarbeam', 'sleeppowder']],
  ['charmander', 'Charmander', 4, ['fire'], [39, 52, 43, 60, 50, 65], 45, ['scratch', 'ember', 'dragonbreath', 'flamethrower']],
  ['charmeleon', 'Charmeleon', 5, ['fire'], [58, 64, 58, 80, 65, 80], 45, ['slash', 'firepunch', 'flamethrower', 'swordsdance']],
  ['squirtle', 'Squirtle', 7, ['water'], [44, 48, 65, 50, 64, 43], 45, ['tackle', 'watergun', 'bubblebeam', 'withdraw']],
  ['wartortle', 'Wartortle', 8, ['water'], [59, 63, 80, 65, 80, 58], 45, ['watergun', 'bubblebeam', 'icebeam', 'withdraw']],
  ['caterpie', 'Caterpie', 10, ['bug'], [45, 30, 35, 20, 20, 45], 255, ['tackle', 'bugbite']],
  ['metapod', 'Metapod', 11, ['bug'], [50, 20, 55, 25, 25, 30], 120, ['harden', 'bugbite']],
  ['butterfree', 'Butterfree', 12, ['bug', 'flying'], [60, 45, 50, 90, 80, 70], 45, ['psybeam', 'sleeppowder', 'psychic', 'gigadrain']],
  ['weedle', 'Weedle', 13, ['bug', 'poison'], [40, 35, 30, 20, 20, 50], 255, ['psting', 'bugbite']],
  ['kakuna', 'Kakuna', 14, ['bug', 'poison'], [45, 25, 50, 25, 25, 35], 120, ['harden', 'bugbite']],
  ['beedrill', 'Beedrill', 15, ['bug', 'poison'], [65, 90, 40, 45, 80, 75], 45, ['xscissor', 'poisonjab', 'swordsdance', 'aerialace']],
  ['pidgey', 'Pidgey', 16, ['normal', 'flying'], [40, 45, 40, 35, 35, 56], 255, ['gust', 'quick', 'wingattack', 'aerialace']],
  ['pidgeotto', 'Pidgeotto', 17, ['normal', 'flying'], [63, 60, 55, 50, 50, 71], 120, ['wingattack', 'quick', 'aerialace', 'fly']],
  ['pidgeot', 'Pidgeot', 18, ['normal', 'flying'], [83, 80, 75, 70, 70, 101], 45, ['wingattack', 'fly', 'hyperbeam', 'quick']],
  ['rattata', 'Rattata', 19, ['normal'], [30, 56, 35, 25, 35, 72], 255, ['tackle', 'quick', 'bite', 'hyperfang']],
  ['raticate', 'Raticate', 20, ['normal'], [55, 81, 60, 50, 70, 97], 127, ['quick', 'crunch', 'hyperfang', 'bodyslam']],
  ['spearow', 'Spearow', 21, ['normal', 'flying'], [40, 60, 30, 31, 31, 70], 255, ['peck', 'drillpeck', 'aerialace', 'agility']],
  ['fearow', 'Fearow', 22, ['normal', 'flying'], [65, 90, 65, 61, 61, 100], 90, ['drillpeck', 'aerialace', 'fly', 'agility']],
  ['ekans', 'Ekans', 23, ['poison'], [35, 60, 44, 40, 54, 55], 255, ['bite', 'glare', 'crunch', 'sludgebomb']],
  ['arbok', 'Arbok', 24, ['poison'], [60, 95, 69, 65, 79, 80], 90, ['crunch', 'sludgebomb', 'earthquake', 'glare']],
  ['raichu', 'Raichu', 26, ['electric'], [60, 90, 55, 90, 80, 110], 75, ['thunderbolt', 'thunder', 'thunderwave', 'irontail']],
  ['sandshrew', 'Sandshrew', 27, ['ground'], [50, 75, 85, 20, 30, 40], 255, ['scratch', 'slash', 'dig', 'earthquake']],
  ['sandslash', 'Sandslash', 28, ['ground'], [75, 100, 110, 45, 55, 65], 90, ['slash', 'dig', 'earthquake', 'swordsdance']],
  ['nidoran-f', 'Nidoran♀', 29, ['poison'], [55, 47, 52, 40, 40, 41], 235, ['scratch', 'bite', 'furyswipes', 'bodyslam']],
  ['nidorina', 'Nidorina', 30, ['poison'], [70, 62, 67, 55, 55, 56], 120, ['bite', 'furyswipes', 'bodyslam', 'icebeam']],
  ['nidoqueen', 'Nidoqueen', 31, ['poison', 'ground'], [90, 92, 87, 75, 85, 76], 45, ['bodyslam', 'earthquake', 'sludgebomb', 'toxic']],
  ['nidoran-m', 'Nidoran♂', 32, ['poison'], [46, 57, 40, 40, 40, 50], 235, ['peck', 'hornattack', 'bodyslam', 'sludgebomb']],
  ['nidorino', 'Nidorino', 33, ['poison'], [61, 72, 57, 55, 55, 65], 120, ['hornattack', 'bodyslam', 'sludgebomb', 'thunderbolt']],
  ['nidoking', 'Nidoking', 34, ['poison', 'ground'], [81, 102, 77, 85, 75, 85], 45, ['earthquake', 'sludgebomb', 'thunderbolt', 'toxic']],
  ['clefairy', 'Clefairy', 35, ['fairy'], [70, 45, 48, 60, 65, 35], 150, ['disarming', 'bodyslam', 'moonblast', 'sing']],
  ['clefable', 'Clefable', 36, ['fairy'], [95, 70, 73, 95, 90, 60], 25, ['moonblast', 'bodyslam', 'flamethrower', 'sing']],
  ['vulpix', 'Vulpix', 37, ['fire'], [38, 41, 40, 50, 65, 65], 190, ['ember', 'willowisp', 'flamethrower', 'fireblast']],
  ['ninetales', 'Ninetales', 38, ['fire'], [73, 76, 75, 81, 100, 100], 75, ['flamethrower', 'fireblast', 'quick', 'willowisp']],
  ['jigglypuff', 'Jigglypuff', 39, ['normal', 'fairy'], [115, 45, 20, 45, 25, 20], 170, ['disarming', 'bodyslam', 'shadowball', 'sing']],
  ['zubat', 'Zubat', 41, ['poison', 'flying'], [40, 45, 35, 30, 40, 55], 255, ['bite', 'wingattack', 'airslash', 'supersonic']],
  ['golbat', 'Golbat', 42, ['poison', 'flying'], [75, 80, 70, 65, 75, 90], 90, ['crunch', 'airslash', 'poisonjab', 'supersonic']],
  ['oddish', 'Oddish', 43, ['grass', 'poison'], [45, 50, 55, 75, 65, 30], 255, ['sleeppowder', 'megadrain', 'sludgebomb', 'solarbeam']],
  ['gloom', 'Gloom', 44, ['grass', 'poison'], [60, 65, 70, 85, 75, 40], 120, ['sludgebomb', 'gigadrain', 'sleeppowder', 'solarbeam']],
  ['vileplume', 'Vileplume', 45, ['grass', 'poison'], [75, 80, 85, 110, 90, 50], 45, ['petaldance', 'sludgebomb', 'solarbeam', 'sleeppowder']],
  ['paras', 'Paras', 46, ['bug', 'grass'], [35, 70, 55, 45, 55, 25], 190, ['scratch', 'leechlife', 'spore', 'swordsdance']],
  ['parasect', 'Parasect', 47, ['bug', 'grass'], [60, 95, 80, 60, 80, 30], 75, ['slash', 'xscissor', 'gigadrain', 'spore']],
  ['venonat', 'Venonat', 48, ['bug', 'poison'], [60, 55, 50, 40, 55, 45], 190, ['confusion', 'leechlife', 'psybeam', 'sleeppowder']],
  ['venomoth', 'Venomoth', 49, ['bug', 'poison'], [70, 65, 60, 90, 75, 90], 75, ['psybeam', 'bugbuzz', 'sleeppowder', 'sludgebomb']],
  ['diglett', 'Diglett', 50, ['ground'], [10, 55, 25, 35, 45, 95], 255, ['scratch', 'dig', 'slash', 'earthquake']],
  ['dugtrio', 'Dugtrio', 51, ['ground'], [35, 100, 50, 50, 70, 120], 50, ['dig', 'earthquake', 'slash', 'rockslide']],
  ['meowth', 'Meowth', 52, ['normal'], [40, 45, 35, 40, 40, 90], 255, ['scratch', 'bite', 'furyswipes', 'slash']],
  ['persian', 'Persian', 53, ['normal'], [65, 70, 60, 65, 65, 115], 90, ['slash', 'furyswipes', 'bodyslam', 'thunderbolt']],
  ['psyduck', 'Psyduck', 54, ['water'], [50, 52, 48, 65, 50, 55], 190, ['watergun', 'confusion', 'surf', 'psychic']],
  ['golduck', 'Golduck', 55, ['water'], [80, 82, 78, 95, 80, 85], 75, ['surf', 'hydropump', 'psychic', 'icebeam']],
  ['mankey', 'Mankey', 56, ['fighting'], [40, 80, 35, 35, 45, 70], 190, ['scratch', 'karatechop', 'furyswipes', 'crosschop']],
  ['primeape', 'Primeape', 57, ['fighting'], [65, 105, 60, 60, 70, 95], 75, ['karatechop', 'crosschop', 'bodyslam', 'earthquake']],
  ['growlithe', 'Growlithe', 58, ['fire'], [55, 70, 45, 70, 50, 60], 190, ['bite', 'ember', 'flamethrower', 'takedown']],
  ['arcanine', 'Arcanine', 59, ['fire'], [90, 110, 80, 100, 80, 95], 75, ['flamethrower', 'flareblitz', 'extremespeed', 'crunch']],
  ['poliwag', 'Poliwag', 60, ['water'], [40, 50, 40, 40, 40, 90], 255, ['watergun', 'bubblebeam', 'bodyslam', 'hypnosis']],
  ['poliwhirl', 'Poliwhirl', 61, ['water'], [65, 65, 65, 50, 50, 90], 120, ['bubblebeam', 'bodyslam', 'hydropump', 'hypnosis']],
  ['poliwrath', 'Poliwrath', 62, ['water', 'fighting'], [90, 95, 95, 70, 90, 70], 45, ['dynamicpunch', 'hydropump', 'submission', 'bulkup']],
  ['abra', 'Abra', 63, ['psychic'], [25, 20, 15, 105, 55, 90], 200, ['psychic', 'shadowball', 'dreameater', 'calmmind']],
  ['kadabra', 'Kadabra', 64, ['psychic'], [40, 35, 30, 120, 70, 105], 100, ['psybeam', 'psychic', 'shadowball', 'calmmind']],
  ['machop', 'Machop', 66, ['fighting'], [70, 80, 50, 35, 35, 35], 180, ['karatechop', 'megapunch', 'submission', 'crosschop']],
  ['machoke', 'Machoke', 67, ['fighting'], [80, 100, 70, 50, 60, 45], 90, ['crosschop', 'megapunch', 'earthquake', 'bulkup']],
  ['bellsprout', 'Bellsprout', 69, ['grass', 'poison'], [50, 75, 35, 70, 30, 40], 255, ['vinewhip', 'sleeppowder', 'razorleaf', 'sludgebomb']],
  ['weepinbell', 'Weepinbell', 70, ['grass', 'poison'], [65, 90, 50, 85, 45, 55], 120, ['razorleaf', 'sludgebomb', 'solarbeam', 'sleeppowder']],
  ['victreebel', 'Victreebel', 71, ['grass', 'poison'], [80, 105, 65, 100, 70, 70], 45, ['leafblade', 'sludgebomb', 'solarbeam', 'sleeppowder']],
  ['tentacool', 'Tentacool', 72, ['water', 'poison'], [40, 40, 35, 50, 100, 70], 190, ['toxic', 'bubblebeam', 'sludgebomb', 'hydropump']],
  ['tentacruel', 'Tentacruel', 73, ['water', 'poison'], [80, 70, 65, 80, 120, 100], 60, ['sludgebomb', 'hydropump', 'icebeam', 'toxic']],
  ['geodude', 'Geodude', 74, ['rock', 'ground'], [40, 80, 100, 30, 30, 20], 255, ['tackle', 'rockthrow', 'earthquake', 'rockpolish']],
  ['graveler', 'Graveler', 75, ['rock', 'ground'], [55, 95, 115, 45, 45, 35], 120, ['rockslide', 'earthquake', 'stoneedge', 'rockpolish']],
  ['ponyta', 'Ponyta', 77, ['fire'], [50, 85, 55, 65, 65, 90], 190, ['ember', 'flamewheel', 'stomp', 'agility']],
  ['rapidash', 'Rapidash', 78, ['fire'], [65, 100, 70, 80, 80, 105], 60, ['flareblitz', 'megahorn', 'fireblast', 'agility']],
  ['slowpoke', 'Slowpoke', 79, ['water', 'psychic'], [90, 65, 65, 40, 40, 15], 190, ['watergun', 'confusion', 'zenheadbutt', 'amnesia']],
  ['slowbro', 'Slowbro', 80, ['water', 'psychic'], [95, 75, 110, 100, 80, 30], 75, ['surf', 'psychic', 'icebeam', 'amnesia']],
  ['magnemite', 'Magnemite', 81, ['electric', 'steel'], [25, 35, 70, 95, 55, 45], 190, ['thundershock', 'thunderwave', 'flashcannon', 'thunderbolt']],
  ['magneton', 'Magneton', 82, ['electric', 'steel'], [50, 60, 95, 120, 70, 70], 60, ['thunderbolt', 'thunder', 'thunderwave', 'triattack']],
  ['farfetchd', "Farfetch'd", 83, ['normal', 'flying'], [52, 90, 55, 58, 62, 60], 45, ['slash', 'aerialace', 'nightslash', 'swordsdance']],
  ['doduo', 'Doduo', 84, ['normal', 'flying'], [35, 85, 45, 35, 35, 75], 190, ['peck', 'drillpeck', 'triattack', 'agility']],
  ['dodrio', 'Dodrio', 85, ['normal', 'flying'], [60, 110, 70, 60, 60, 110], 45, ['drillpeck', 'triattack', 'bodyslam', 'agility']],
  ['seel', 'Seel', 86, ['water'], [65, 45, 55, 45, 70, 45], 190, ['headbutt', 'aurorabeam', 'icebeam', 'takedown']],
  ['dewgong', 'Dewgong', 87, ['water', 'ice'], [90, 70, 80, 70, 95, 70], 75, ['icebeam', 'surf', 'bodyslam', 'blizzard']],
  ['grimer', 'Grimer', 88, ['poison'], [80, 80, 50, 40, 50, 25], 190, ['sludge', 'sludgebomb', 'toxic', 'bodyslam']],
  ['muk', 'Muk', 89, ['poison'], [105, 105, 75, 65, 100, 50], 75, ['sludgebomb', 'bodyslam', 'firepunch', 'toxic']],
  ['shellder', 'Shellder', 90, ['water'], [30, 65, 100, 45, 25, 40], 190, ['tackle', 'aurorabeam', 'icebeam', 'withdraw']],
  ['cloyster', 'Cloyster', 91, ['water', 'ice'], [50, 95, 180, 85, 45, 70], 60, ['icebeam', 'hydropump', 'blizzard', 'irondefense']],
  ['gastly', 'Gastly', 92, ['ghost', 'poison'], [30, 35, 30, 100, 35, 80], 190, ['lick', 'shadowball', 'sludgebomb', 'hypnosis']],
  ['haunter', 'Haunter', 93, ['ghost', 'poison'], [45, 50, 45, 115, 55, 95], 90, ['shadowpunch', 'shadowball', 'sludgebomb', 'confuseray']],
  ['onix', 'Onix', 95, ['rock', 'ground'], [35, 45, 160, 30, 45, 70], 45, ['rockslide', 'earthquake', 'stoneedge', 'irontail']],
  ['drowzee', 'Drowzee', 96, ['psychic'], [60, 48, 45, 43, 90, 42], 190, ['confusion', 'headbutt', 'psychic', 'hypnosis']],
  ['hypno', 'Hypno', 97, ['psychic'], [85, 73, 70, 73, 115, 67], 75, ['psychic', 'zenheadbutt', 'shadowball', 'hypnosis']],
  ['krabby', 'Krabby', 98, ['water'], [30, 105, 90, 25, 25, 50], 225, ['bubblebeam', 'vicegrip', 'stomp', 'crabhammer']],
  ['kingler', 'Kingler', 99, ['water'], [55, 130, 115, 50, 50, 75], 60, ['crabhammer', 'stomp', 'bodyslam', 'swordsdance']],
  ['voltorb', 'Voltorb', 100, ['electric'], [40, 30, 50, 55, 55, 100], 190, ['thunderwave', 'spark', 'swift', 'thunderbolt']],
  ['electrode', 'Electrode', 101, ['electric'], [60, 50, 70, 80, 80, 150], 60, ['thunderbolt', 'thunder', 'swift', 'thunderwave']],
  ['exeggcute', 'Exeggcute', 102, ['grass', 'psychic'], [60, 40, 80, 60, 45, 40], 90, ['hypnosis', 'gigadrain', 'psychic', 'solarbeam']],
  ['exeggutor', 'Exeggutor', 103, ['grass', 'psychic'], [95, 95, 85, 125, 75, 55], 45, ['psychic', 'solarbeam', 'gigadrain', 'hypnosis']],
  ['cubone', 'Cubone', 104, ['ground'], [50, 50, 95, 40, 50, 35], 190, ['headbutt', 'bonemerang', 'earthquake', 'doubleedge']],
  ['marowak', 'Marowak', 105, ['ground'], [60, 80, 110, 50, 80, 45], 75, ['bonemerang', 'earthquake', 'rockslide', 'swordsdance']],
  ['hitmonlee', 'Hitmonlee', 106, ['fighting'], [50, 120, 53, 35, 110, 87], 45, ['rollingkick', 'jumpkick', 'megakick', 'brickbreak']],
  ['hitmonchan', 'Hitmonchan', 107, ['fighting'], [50, 105, 79, 35, 110, 76], 45, ['firepunch', 'icepunch', 'thunderpunch', 'megapunch']],
  ['lickitung', 'Lickitung', 108, ['normal'], [90, 55, 75, 60, 75, 30], 45, ['lick', 'stomp', 'bodyslam', 'powerwhip']],
  ['koffing', 'Koffing', 109, ['poison'], [40, 65, 95, 60, 45, 35], 190, ['toxic', 'sludge', 'sludgebomb', 'flamethrower']],
  ['weezing', 'Weezing', 110, ['poison'], [65, 90, 120, 85, 70, 60], 60, ['sludgebomb', 'flamethrower', 'thunderbolt', 'toxic']],
  ['rhyhorn', 'Rhyhorn', 111, ['ground', 'rock'], [80, 85, 95, 30, 30, 25], 120, ['hornattack', 'stomp', 'earthquake', 'rockslide']],
  ['rhydon', 'Rhydon', 112, ['ground', 'rock'], [105, 130, 120, 45, 45, 40], 60, ['earthquake', 'megahorn', 'stoneedge', 'swordsdance']],
  ['chansey', 'Chansey', 113, ['normal'], [250, 5, 5, 35, 105, 50], 30, ['eggbomb', 'icebeam', 'thunderbolt', 'sing']],
  ['tangela', 'Tangela', 114, ['grass'], [65, 55, 115, 100, 40, 60], 45, ['vinewhip', 'gigadrain', 'powerwhip', 'sleeppowder']],
  ['kangaskhan', 'Kangaskhan', 115, ['normal'], [105, 95, 80, 40, 80, 90], 45, ['megapunch', 'crunch', 'earthquake', 'bodyslam']],
  ['horsea', 'Horsea', 116, ['water'], [30, 40, 70, 70, 25, 60], 225, ['watergun', 'bubblebeam', 'twister', 'hydropump']],
  ['seadra', 'Seadra', 117, ['water'], [55, 65, 95, 95, 45, 85], 75, ['bubblebeam', 'hydropump', 'dragonbreath', 'icebeam']],
  ['goldeen', 'Goldeen', 118, ['water'], [45, 67, 60, 35, 50, 63], 225, ['peck', 'hornattack', 'waterfall', 'agility']],
  ['seaking', 'Seaking', 119, ['water'], [80, 92, 65, 65, 80, 68], 60, ['megahorn', 'waterfall', 'icebeam', 'surf']],
  ['staryu', 'Staryu', 120, ['water'], [30, 45, 55, 70, 55, 85], 225, ['watergun', 'swift', 'psychic', 'hydropump']],
  ['starmie', 'Starmie', 121, ['water', 'psychic'], [60, 75, 85, 100, 85, 115], 60, ['surf', 'psychic', 'icebeam', 'thunderbolt']],
  ['mr-mime', 'Mr. Mime', 122, ['psychic', 'fairy'], [40, 45, 65, 100, 120, 90], 45, ['psybeam', 'psychic', 'dazzlinggleam', 'calmmind']],
  ['scyther', 'Scyther', 123, ['bug', 'flying'], [70, 110, 80, 55, 80, 105], 45, ['xscissor', 'aerialace', 'slash', 'swordsdance']],
  ['jynx', 'Jynx', 124, ['ice', 'psychic'], [65, 50, 35, 115, 95, 95], 45, ['icebeam', 'psychic', 'blizzard', 'lovelykiss']],
  ['electabuzz', 'Electabuzz', 125, ['electric'], [65, 83, 57, 95, 85, 105], 45, ['thunderpunch', 'thunderbolt', 'thunder', 'thunderwave']],
  ['magmar', 'Magmar', 126, ['fire'], [65, 95, 57, 100, 85, 93], 45, ['firepunch', 'flamethrower', 'fireblast', 'psychic']],
  ['pinsir', 'Pinsir', 127, ['bug'], [65, 125, 100, 55, 70, 85], 45, ['xscissor', 'brickbreak', 'superpower', 'swordsdance']],
  ['tauros', 'Tauros', 128, ['normal'], [75, 100, 95, 40, 70, 110], 45, ['hornattack', 'bodyslam', 'earthquake', 'hyperbeam']],
  ['magikarp', 'Magikarp', 129, ['water'], [20, 10, 55, 15, 20, 80], 255, ['splash']],
  ['gyarados', 'Gyarados', 130, ['water', 'flying'], [95, 125, 79, 60, 100, 81], 45, ['waterfall', 'crunch', 'earthquake', 'dragondance']],
  ['ditto', 'Ditto', 132, ['normal'], [48, 48, 48, 48, 48, 48], 35, ['transform']],
  ['eevee', 'Eevee', 133, ['normal'], [55, 55, 50, 45, 65, 55], 45, ['quick', 'bite', 'swift', 'takedown']],
  ['vaporeon', 'Vaporeon', 134, ['water'], [130, 65, 60, 110, 95, 65], 45, ['hydropump', 'icebeam', 'quick', 'acidarmor']],
  ['jolteon', 'Jolteon', 135, ['electric'], [65, 65, 60, 110, 95, 130], 45, ['thunderbolt', 'thunder', 'quick', 'thunderwave']],
  ['flareon', 'Flareon', 136, ['fire'], [65, 130, 60, 95, 110, 65], 45, ['flamethrower', 'flareblitz', 'quick', 'bite']],
  ['porygon', 'Porygon', 137, ['normal'], [65, 60, 70, 85, 75, 40], 45, ['triattack', 'psybeam', 'thunderbolt', 'icebeam']],
  ['omanyte', 'Omanyte', 138, ['rock', 'water'], [35, 40, 100, 90, 55, 35], 45, ['watergun', 'ancientpower', 'hydropump', 'withdraw']],
  ['omastar', 'Omastar', 139, ['rock', 'water'], [70, 60, 125, 115, 70, 55], 45, ['hydropump', 'ancientpower', 'icebeam', 'withdraw']],
  ['kabuto', 'Kabuto', 140, ['rock', 'water'], [30, 80, 90, 55, 45, 55], 45, ['scratch', 'aquajet', 'ancientpower', 'harden']],
  ['kabutops', 'Kabutops', 141, ['rock', 'water'], [60, 115, 105, 65, 70, 80], 45, ['slash', 'aquajet', 'stoneedge', 'swordsdance']],
  ['aerodactyl', 'Aerodactyl', 142, ['rock', 'flying'], [80, 105, 65, 60, 75, 130], 45, ['wingattack', 'rockslide', 'crunch', 'earthquake']],
  ['snorlax', 'Snorlax', 143, ['normal'], [160, 110, 65, 65, 110, 30], 25, ['bodyslam', 'earthquake', 'hyperbeam', 'crunch']],
  ['articuno', 'Articuno', 144, ['ice', 'flying'], [90, 85, 100, 95, 125, 85], 3, ['icebeam', 'blizzard', 'fly', 'agility']],
  ['zapdos', 'Zapdos', 145, ['electric', 'flying'], [90, 90, 85, 125, 90, 100], 3, ['thunderbolt', 'thunder', 'drillpeck', 'thunderwave']],
  ['moltres', 'Moltres', 146, ['fire', 'flying'], [90, 100, 90, 125, 85, 90], 3, ['flamethrower', 'heatwave', 'wingattack', 'agility']],
  ['dratini', 'Dratini', 147, ['dragon'], [41, 64, 45, 50, 50, 50], 45, ['twister', 'thunderwave', 'outrage', 'dragondance']],
  ['dragonair', 'Dragonair', 148, ['dragon'], [61, 84, 65, 70, 70, 70], 45, ['dragonpulse', 'outrage', 'thunderwave', 'dragondance']],
  ['mewtwo', 'Mewtwo', 150, ['psychic'], [106, 110, 90, 154, 90, 130], 3, ['psystrike', 'shadowball', 'icebeam', 'calmmind']],
  ['mew', 'Mew', 151, ['psychic'], [100, 100, 100, 100, 100, 100], 45, ['psychic', 'flamethrower', 'thunderbolt', 'calmmind']],
];
