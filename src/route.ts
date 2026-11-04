// La ruta del mundo: un mapa de tiles generado con una semilla fija (siempre sale igual) y la tabla de
// Pokémon salvajes que aparecen en su hierba alta.

export const TILE = 64; // px en pantalla de cada tile (el arte mide 32 px y se amplía x2, como el sprite del entrenador)

/** El entrenador rival: espera en el borde del camino y reta a quien cruce su línea de visión. */
export const RIVAL = { x: 12, y: 16, dir: 'left' as const, sight: 4, name: 'El huaso Anselmo' };

export type TileKey =
  | 'grass' | 'flower' | 'path' | 'tall' | 'tree' | 'water' | 'fence' | 'rock'
  | 'sand' | 'dune' | 'brush' | 'road' | 'cliff' | 'salt' | 'cactus' | 'rockd';   // las del desierto

/** Una salida hacia otra ruta: al pisar la casilla, se aparece en (tx, ty) de la ruta `to`, como las conexiones entre rutas de los juegos. */
export interface Exit { x: number; y: number; to: string; tx: number; ty: number; dir: 'up' | 'down' | 'left' | 'right' }

export interface RouteMap {
  w: number;
  h: number;
  tiles: TileKey[][];
  start: { x: number; y: number };
  exits: Exit[];
}

export const isWalkable = (t: TileKey) =>
  t === 'grass' || t === 'flower' || t === 'path' || t === 'tall' || t === 'sand' || t === 'dune' || t === 'brush' || t === 'road' || t === 'salt';

/** Casillas donde pueden aparecer Pokémon salvajes: la hierba alta y el matorral seco. */
export const isEncounterTile = (t: TileKey) => t === 'tall' || t === 'brush';

/** Generador pseudoaleatorio con semilla (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildRoute(): RouteMap {
  const W = 40, H = 28, rnd = rng(20261023);
  const tiles: TileKey[][] = Array.from({ length: H }, () => Array<TileKey>(W).fill('grass'));
  const set = (x: number, y: number, t: TileKey) => { if (x >= 0 && y >= 0 && x < W && y < H) tiles[y][x] = t; };
  const inEllipse = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) =>
    ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;

  // Bosque que rodea la ruta: dos tiles de grosor y un tercero salpicado.
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const d = Math.min(x, y, W - 1 - x, H - 1 - y);
    if (d < 2 || (d === 2 && rnd() < 0.45)) set(x, y, 'tree');
  }

  // Camino de 2 tiles de ancho, en zigzag desde la entrada (abajo) hasta el fondo de la ruta.
  const path: [number, number][] = [];
  const carve = (x0: number, y0: number, x1: number, y1: number) => {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1) + (y0 === y1 ? 0 : 1); x++)
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1) + (x0 === x1 ? 0 : 1); y++) { set(x, y, 'path'); path.push([x, y]); }
  };
  carve(19, 25, 19, 21);   // entrada
  carve(10, 21, 19, 21);   // hacia el oeste
  carve(10, 12, 10, 21);   // sube por el oeste
  carve(10, 12, 27, 12);   // cruza hacia el este
  carve(26, 4, 26, 12);    // sube hasta el fondo
  const distPath = (x: number, y: number) => path.reduce((m, [px, py]) => Math.min(m, Math.hypot(px - x, py - y)), 99);

  // Hierba alta: parches ovalados junto al camino.
  const patches = [[27, 19, 7, 3.6], [6, 17, 4.5, 5], [18, 8, 6.5, 3.2], [32, 24, 4, 2.6], [32, 10, 3.2, 3]];
  const inPatch = (x: number, y: number) => patches.some(([cx, cy, rx, ry]) => inEllipse(x, y, cx, cy, rx, ry));
  for (let y = 3; y < H - 3; y++) for (let x = 3; x < W - 3; x++)
    if (tiles[y][x] === 'grass' && inPatch(x, y)) set(x, y, 'tall');

  // Estanque en la esquina superior derecha.
  for (let y = 3; y < H - 3; y++) for (let x = 3; x < W - 3; x++)
    if (tiles[y][x] !== 'path' && inEllipse(x, y, 34, 6, 3.8, 2.4)) set(x, y, 'water');

  // Cercos junto a la entrada.
  for (const x of [13, 14, 15, 16, 22, 23, 24, 25]) if (tiles[24][x] === 'grass') set(x, 24, 'fence');

  // Árboles, rocas y flores sueltos, sin tapar el camino ni la hierba alta.
  for (let y = 3; y < H - 3; y++) for (let x = 3; x < W - 3; x++) {
    if (tiles[y][x] !== 'grass') continue;
    const r = rnd();
    if (distPath(x, y) > 2.2 && !inPatch(x, y)) {
      if (r < 0.1) set(x, y, 'tree');
      else if (r < 0.14) set(x, y, 'rock');
      else if (r < 0.26) set(x, y, 'flower');
    } else if (r < 0.07) set(x, y, 'flower');
  }

  set(RIVAL.x, RIVAL.y, 'grass');   // el rival se para sobre pasto despejado

  // Salida al norte, hacia el desierto: el camino del fondo sigue hasta el borde del mapa abriendo el bosque.
  for (let y = 0; y <= 3; y++) for (const x of [26, 27]) set(x, y, 'path');
  set(25, 0, 'tree'); set(28, 0, 'tree');

  // Todo lo caminable debe ser alcanzable desde la entrada: lo aislado se cierra con árboles.
  const start = { x: 19, y: 25 };
  const seen = Array.from({ length: H }, () => Array<boolean>(W).fill(false));
  const queue: [number, number][] = [[start.x, start.y]];
  seen[start.y][start.x] = true;
  while (queue.length) {
    const [x, y] = queue.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[ny][nx] || !isWalkable(tiles[ny][nx])) continue;
      seen[ny][nx] = true;
      queue.push([nx, ny]);
    }
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
    if (isWalkable(tiles[y][x]) && !seen[y][x]) set(x, y, 'tree');

  const exits: Exit[] = [26, 27].map((x) => ({ x, y: 0, to: 'atacama', tx: 22 + (x - 26), ty: ATACAMA_H - 2, dir: 'up' as const }));
  return { w: W, h: H, tiles, start, exits };
}

// ---------- Desierto de Atacama ----------

const ATACAMA_W = 44;
const ATACAMA_H = 40;

export function buildAtacama(): RouteMap {
  const W = ATACAMA_W, H = ATACAMA_H, rnd = rng(20262024);
  const tiles: TileKey[][] = Array.from({ length: H }, () => Array<TileKey>(W).fill('sand'));
  const set = (x: number, y: number, t: TileKey) => { if (x >= 0 && y >= 0 && x < W && y < H) tiles[y][x] = t; };
  const inEllipse = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;

  // Muralla de roca roja alrededor (como las paredes del Valle de la Luna).
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const d = Math.min(x, y, W - 1 - x, H - 1 - y);
    if (d < 2 || (d === 2 && rnd() < 0.5)) set(x, y, 'cliff');
  }

  // Camino de tierra compactada de 2 casillas, en zigzag desde la entrada (abajo) hacia el salar (arriba a la derecha).
  const road: [number, number][] = [];
  const carve = (x0: number, y0: number, x1: number, y1: number) => {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1) + (y0 === y1 ? 0 : 1); x++)
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1) + (x0 === x1 ? 0 : 1); y++) { set(x, y, 'road'); road.push([x, y]); }
  };
  carve(22, 38, 22, 30);
  carve(10, 30, 22, 30);
  carve(10, 19, 10, 30);
  carve(10, 19, 30, 19);
  carve(30, 9, 30, 19);
  const distRoad = (x: number, y: number) => road.reduce((m, [px, py]) => Math.min(m, Math.hypot(px - x, py - y)), 99);

  // Matorral seco (donde aparecen Pokémon): parches junto al camino.
  const patches = [[28, 33, 7, 3.4], [6, 25, 3.6, 4.6], [20, 24, 5, 3], [38, 22, 3.6, 5], [20, 14, 6.5, 3], [15, 8, 5, 3.4], [37, 31, 3.6, 3]];
  const inPatch = (x: number, y: number) => patches.some(([cx, cy, rx, ry]) => inEllipse(x, y, cx, cy, rx, ry));
  for (let y = 3; y < H - 3; y++) for (let x = 3; x < W - 3; x++) if (tiles[y][x] === 'sand' && inPatch(x, y)) set(x, y, 'brush');

  // Salar con su laguna (arriba a la derecha, como la Laguna Chaxa).
  for (let y = 3; y < H - 3; y++) for (let x = 3; x < W - 3; x++) {
    if (tiles[y][x] === 'road') continue;
    if (inEllipse(x, y, 35, 8, 7.5, 4.2)) set(x, y, inEllipse(x, y, 35, 8, 3.4, 1.9) ? 'water' : 'salt');
  }

  // Formaciones de roca roja (Valle de la Luna), alejadas del camino.
  const blobs = [[16, 34, 3, 2], [4, 14, 2.5, 3.5], [24, 28, 2.2, 1.6], [34, 28, 2.6, 2.2], [18, 4, 4, 1.8], [27, 5, 2.4, 2], [6, 6, 3, 2.4], [39, 15, 2, 3], [14, 22, 2.2, 1.8]];
  for (let y = 3; y < H - 3; y++) for (let x = 3; x < W - 3; x++)
    if (tiles[y][x] === 'sand' && blobs.some(([cx, cy, rx, ry]) => inEllipse(x, y, cx, cy, rx, ry)) && distRoad(x, y) > 2) set(x, y, 'cliff');

  // Cardones, piedras y dunas sueltos, sin tapar el camino ni el matorral.
  for (let y = 3; y < H - 3; y++) for (let x = 3; x < W - 3; x++) {
    if (tiles[y][x] !== 'sand') continue;
    const r = rnd();
    if (distRoad(x, y) > 2.2 && !inPatch(x, y)) {
      if (r < 0.07) set(x, y, 'cactus');
      else if (r < 0.10) set(x, y, 'rockd');
      else if (r < 0.24) set(x, y, 'dune');
    } else if (r < 0.04) set(x, y, 'dune');
  }

  // Entrada abierta al sur (conecta con la Ruta Los Aromos) y todo lo caminable alcanzable desde ahí.
  for (let y = H - 3; y < H; y++) for (const x of [22, 23]) set(x, y, 'road');
  const start = { x: 22, y: H - 2 };
  const seen = Array.from({ length: H }, () => Array<boolean>(W).fill(false));
  const queue: [number, number][] = [[start.x, start.y]];
  seen[start.y][start.x] = true;
  while (queue.length) {
    const [x, y] = queue.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[ny][nx] || !isWalkable(tiles[ny][nx])) continue;
      seen[ny][nx] = true;
      queue.push([nx, ny]);
    }
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (isWalkable(tiles[y][x]) && !seen[y][x]) set(x, y, 'cliff');

  const exits: Exit[] = [22, 23].map((x) => ({ x, y: H - 1, to: 'aromos', tx: 26 + (x - 22), ty: 1, dir: 'down' as const }));
  return { w: W, h: H, tiles, start, exits };
}

// ---------- Pokémon salvajes de la ruta ----------

export interface Encounter { id: string; weight: number; min: number; max: number }

/** Quién aparece en la hierba alta y a qué nivel. Los de más abajo son raros. */
export const ROUTE_ENCOUNTERS: Encounter[] = [
  { id: 'pikachu', weight: 30, min: 6, max: 12 },
  { id: 'wigglytuff', weight: 20, min: 7, max: 12 },
  { id: 'machamp', weight: 12, min: 8, max: 13 },
  { id: 'golem', weight: 12, min: 8, max: 13 },
  { id: 'gengar', weight: 10, min: 9, max: 14 },
  { id: 'alakazam', weight: 7, min: 9, max: 14 },
  { id: 'venusaur', weight: 3, min: 10, max: 15 },
  { id: 'charizard', weight: 2, min: 10, max: 15 },
  { id: 'blastoise', weight: 2, min: 10, max: 15 },
  { id: 'lapras', weight: 1.5, min: 12, max: 16 },
  { id: 'dragonite', weight: 0.5, min: 14, max: 18 },
];

/** Elige un encuentro según los pesos; r es un número en [0, 1). */
export function pickEncounter(r: number, rand: () => number = Math.random, table: Encounter[] = ROUTE_ENCOUNTERS): { id: string; level: number } {
  const total = table.reduce((a, e) => a + e.weight, 0);
  let x = r * total;
  const e = table.find((c) => (x -= c.weight) < 0) ?? table[0];
  return { id: e.id, level: e.min + Math.floor(rand() * (e.max - e.min + 1)) };
}

/** Quién aparece en el matorral del desierto: Pokémon de tierra, roca y fuego, más difíciles que los de la Ruta Los Aromos. */
export const ATACAMA_ENCOUNTERS: Encounter[] = [
  { id: 'sandshrew', weight: 24, min: 13, max: 18 },
  { id: 'diglett', weight: 18, min: 13, max: 18 },
  { id: 'geodude', weight: 14, min: 14, max: 19 },
  { id: 'cubone', weight: 11, min: 14, max: 19 },
  { id: 'ekans', weight: 9, min: 14, max: 19 },
  { id: 'doduo', weight: 8, min: 15, max: 20 },
  { id: 'ponyta', weight: 6, min: 16, max: 21 },
  { id: 'rhyhorn', weight: 5, min: 16, max: 21 },
  { id: 'sandslash', weight: 4, min: 18, max: 23 },
  { id: 'onix', weight: 4, min: 17, max: 22 },
  { id: 'graveler', weight: 3, min: 18, max: 23 },
  { id: 'marowak', weight: 2.5, min: 20, max: 25 },
  { id: 'arcanine', weight: 1, min: 22, max: 26 },
  { id: 'aerodactyl', weight: 0.5, min: 24, max: 28 },
];

export interface RouteDef {
  id: string;
  name: string;
  build: () => RouteMap;
  encounters: Encounter[];
  trainer: boolean;   // si hay un entrenador esperando en la ruta (el huaso Anselmo)
  desert: boolean;    // usa los gráficos del desierto
}

export const ROUTES: Record<string, RouteDef> = {
  aromos: { id: 'aromos', name: 'Ruta Los Aromos', build: buildRoute, encounters: ROUTE_ENCOUNTERS, trainer: true, desert: false },
  atacama: { id: 'atacama', name: 'Desierto de Atacama', build: buildAtacama, encounters: ATACAMA_ENCOUNTERS, trainer: false, desert: true },
};
