// La ruta del mundo: un mapa de tiles generado con una semilla fija (siempre sale igual) y la tabla de
// Pokémon salvajes que aparecen en su hierba alta.

export const TILE = 64; // px en pantalla de cada tile (el arte mide 32 px y se amplía x2, como el sprite del entrenador)

/** El entrenador rival: espera en el borde del camino y reta a quien cruce su línea de visión. */
export const RIVAL = { sight: 4, name: 'El huaso Anselmo', level: 10 };   // dónde espera lo fija cada mapa (RouteMap.rival)

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
  rival?: { x: number; y: number; dir: 'up' | 'down' | 'left' | 'right' };   // dónde espera el rival (si la ruta tiene)
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

// ---------- generador de rutas abiertas ----------
//
// Las rutas son amplias (unos 80 × 70 tiles, varias pantallas): un camino en zigzag de lado a lado, arboledas o formaciones
// de roca que dejan claros grandes, charcos o salares, y muchos parches de hierba alta (o matorral) donde se esconden los
// Pokémon y de donde salen a pasear. Todo sale de una semilla fija: la ruta es siempre la misma.

interface OpenCfg {
  w: number; h: number; seed: number;
  ground: TileKey; border: TileKey; road: TileKey; tall: TileKey; obstacle: TileKey;
  entryX: number;                 // columna de la entrada (abajo); el camino ocupa esa columna y la siguiente
  entryOpen?: boolean;            // la entrada se abre al borde de abajo (conexión con otra ruta)
  exitX?: number;                 // columna de la salida de arriba (conexión con otra ruta); sin ella el camino termina dentro del mapa
  clumps: number;                 // arboledas / formaciones de roca
  patches: number;                // parches de hierba alta o matorral
  lakes: { cx: number; cy: number; rx: number; ry: number; ring?: TileKey }[];   // cx, cy como fracción del mapa; rx, ry en tiles
  decor: [TileKey, number][];     // adornos sueltos lejos del camino (probabilidades acumuladas)
  nearDecor: [TileKey, number];   // y cerca del camino
  fenceEntry?: boolean;
  rival?: boolean;
}

function buildOpen(c: OpenCfg): RouteMap {
  const W = c.w, H = c.h, rnd = rng(c.seed);
  const tiles: TileKey[][] = Array.from({ length: H }, () => Array<TileKey>(W).fill(c.ground));
  const set = (x: number, y: number, t: TileKey) => { if (x >= 0 && y >= 0 && x < W && y < H) tiles[y][x] = t; };
  const inEllipse = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
  const between = (a: number, b: number) => a + rnd() * (b - a);

  // Borde que rodea la ruta: dos tiles de grosor y un tercero salpicado.
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const d = Math.min(x, y, W - 1 - x, H - 1 - y);
    if (d < 2 || (d === 2 && rnd() < 0.45)) set(x, y, c.border);
  }

  // Camino de 2 tiles de ancho, en zigzag desde la entrada (abajo) hasta la salida o el fondo (arriba).
  const path: [number, number][] = [];
  const carve = (x0: number, y0: number, x1: number, y1: number) => {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1) + (y0 === y1 ? 0 : 1); x++)
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1) + (x0 === x1 ? 0 : 1); y++) { set(x, y, c.road); path.push([x, y]); }
  };
  const startY = c.entryOpen ? H - 2 : H - 3;
  const target = c.exitX ?? Math.round(W * 0.68);
  const pts: [number, number][] = [[c.entryX, startY]];
  const segs = Math.max(3, Math.round((H - 8) / 16));
  let lastX = c.entryX;
  for (let i = 1; i <= segs; i++) {
    const y = Math.round(startY - (i / segs) * (startY - 5));
    let nx = target;
    if (i < segs) do nx = 12 + Math.floor(rnd() * (W - 26)); while (Math.abs(nx - lastX) < 14);
    pts.push([nx, y]);
    lastX = nx;
  }
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    carve(ax, ay, ax, by);   // primero sube...
    carve(ax, by, bx, by);   // ...y luego cruza hacia el lado
  }
  if (c.entryOpen) for (let y = H - 3; y < H; y++) for (const x of [c.entryX, c.entryX + 1]) set(x, y, c.road);
  if (c.exitX !== undefined) {
    for (let y = 0; y <= 4; y++) for (const x of [c.exitX, c.exitX + 1]) { set(x, y, c.road); path.push([x, y]); }
    set(c.exitX - 1, 0, c.border); set(c.exitX + 2, 0, c.border);
  }
  const distPath = (x: number, y: number) => path.reduce((m, [px, py]) => Math.min(m, Math.hypot(px - x, py - y)), 99);

  // Lagunas o salares.
  for (const l of c.lakes) {
    const cx = Math.round(l.cx * W), cy = Math.round(l.cy * H);
    for (let y = 3; y < H - 3; y++) for (let x = 3; x < W - 3; x++) {
      if (tiles[y][x] === c.road) continue;
      if (inEllipse(x, y, cx, cy, l.rx, l.ry)) set(x, y, l.ring ? (inEllipse(x, y, cx, cy, l.rx * 0.45, l.ry * 0.45) ? 'water' : l.ring) : 'water');
    }
  }

  // Arboledas o formaciones de roca: dejan claros amplios entre ellas, lejos del camino.
  for (let k = 0; k < c.clumps; k++) {
    const cx = Math.round(between(6, W - 7)), cy = Math.round(between(6, H - 7)), rx = between(2.2, 5.5), ry = between(1.8, 4.5);
    if (distPath(cx, cy) < Math.max(rx, ry) + 3) continue;
    for (let y = 3; y < H - 3; y++) for (let x = 3; x < W - 3; x++)
      if (tiles[y][x] === c.ground && inEllipse(x, y, cx, cy, rx, ry) && distPath(x, y) > 2) set(x, y, c.obstacle);
  }

  // Parches de hierba alta (o matorral): la mayoría junto al camino, otros en pleno claro.
  const patch = Array.from({ length: H }, () => Array<boolean>(W).fill(false));
  for (let k = 0; k < c.patches; k++) {
    let cx: number, cy: number;
    if (rnd() < 0.7) {
      const [px, py] = path[Math.floor(rnd() * path.length)], a = rnd() * Math.PI * 2, d = between(4, 9);
      cx = Math.round(px + Math.cos(a) * d); cy = Math.round(py + Math.sin(a) * d);
    } else { cx = Math.round(between(6, W - 7)); cy = Math.round(between(6, H - 7)); }
    const rx = between(2.4, 6.4), ry = between(2, 4.8);
    for (let y = Math.max(3, Math.floor(cy - ry)); y <= Math.min(H - 4, Math.ceil(cy + ry)); y++)
      for (let x = Math.max(3, Math.floor(cx - rx)); x <= Math.min(W - 4, Math.ceil(cx + rx)); x++)
        if (tiles[y][x] === c.ground && inEllipse(x, y, cx, cy, rx, ry)) { set(x, y, c.tall); patch[y][x] = true; }
  }

  // Cercos junto a la entrada.
  if (c.fenceEntry) for (let d = 3; d <= 9; d++) for (const x of [c.entryX - d, c.entryX + 1 + d]) if (tiles[H - 4][x] === c.ground) set(x, H - 4, 'fence');

  // Adornos sueltos, sin tapar el camino ni la hierba alta.
  for (let y = 3; y < H - 3; y++) for (let x = 3; x < W - 3; x++) {
    if (tiles[y][x] !== c.ground) continue;
    const r = rnd();
    if (distPath(x, y) > 2.2 && !patch[y][x]) {
      let acc = 0;
      for (const [t, p] of c.decor) { acc += p; if (r < acc) { set(x, y, t); break; } }
    } else if (r < c.nearDecor[1]) set(x, y, c.nearDecor[0]);
  }

  // El rival espera junto a un tramo recto del camino, mirando hacia él.
  let rival: RouteMap['rival'];
  if (c.rival) {
    for (let i = Math.floor(path.length * 0.4); i < path.length && !rival; i++) {
      const [px, py] = path[i];
      const vertical = [-3, 3].every((d) => tiles[py + d]?.[px] === c.road);
      if (!vertical || px + 5 >= W - 4 || tiles[py][px + 1] !== c.road) continue;
      for (let x = px + 2; x <= px + 5; x++) set(x, py, c.ground);
      rival = { x: px + 5, y: py, dir: 'left' };
    }
  }

  // Todo lo caminable debe ser alcanzable desde la entrada: lo aislado se cierra.
  const start = { x: c.entryX, y: startY };
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
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (isWalkable(tiles[y][x]) && !seen[y][x]) set(x, y, c.obstacle);
  return { w: W, h: H, tiles, start, exits: [], rival };
}

// Tamaños y conexiones entre rutas.
const AROMOS = { w: 80, h: 72, entryX: 28, exitX: 52 };
const ATACAMA = { w: 88, h: 80, entryX: 40 };

export function buildRoute(): RouteMap {
  const map = buildOpen({
    ...AROMOS, seed: 20261023, ground: 'grass', border: 'tree', road: 'path', tall: 'tall', obstacle: 'tree',
    clumps: 34, patches: 26, fenceEntry: true, rival: true,
    lakes: [{ cx: 0.8, cy: 0.3, rx: 6, ry: 4 }, { cx: 0.18, cy: 0.5, rx: 4.5, ry: 3.2 }],
    decor: [['tree', 0.06], ['rock', 0.04], ['flower', 0.12]], nearDecor: ['flower', 0.07],
  });
  map.exits = [AROMOS.exitX, AROMOS.exitX + 1].map((x) => ({ x, y: 0, to: 'atacama', tx: ATACAMA.entryX + (x - AROMOS.exitX), ty: ATACAMA.h - 2, dir: 'up' as const }));
  return map;
}

// ---------- Desierto de Atacama ----------

export function buildAtacama(): RouteMap {
  const map = buildOpen({
    w: ATACAMA.w, h: ATACAMA.h, entryX: ATACAMA.entryX, entryOpen: true, seed: 20262024,
    ground: 'sand', border: 'cliff', road: 'road', tall: 'brush', obstacle: 'cliff', clumps: 40, patches: 28,
    lakes: [{ cx: 0.74, cy: 0.14, rx: 12, ry: 6, ring: 'salt' }],   // salar con laguna, como la Laguna Chaxa
    decor: [['cactus', 0.06], ['rockd', 0.03], ['dune', 0.14]], nearDecor: ['dune', 0.04],
  });
  map.exits = [ATACAMA.entryX, ATACAMA.entryX + 1].map((x) => ({ x, y: ATACAMA.h - 1, to: 'aromos', tx: AROMOS.exitX + (x - ATACAMA.entryX), ty: 1, dir: 'down' as const }));
  return map;
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
