// La ruta del mundo: un mapa de tiles generado con una semilla fija (siempre sale igual) y la tabla de
// Pokémon salvajes que aparecen en su hierba alta.

export const TILE = 64; // px en pantalla de cada tile (el arte mide 32 px y se amplía x2, como el sprite del entrenador)

/** El entrenador rival: espera en el borde del camino y reta a quien cruce su línea de visión. */
export const RIVAL = {
  sight: 4, name: 'El huaso Anselmo',   // dónde espera lo fija el mapa (los entrenadores de cada ruta están en RouteMap.trainers)
  team: [{ id: 'starly', level: 10 }, { id: 'bidoof', level: 10 }, { id: 'pikachu', level: 11 }],
};

export type TileKey =
  | 'grass' | 'flower' | 'path' | 'tall' | 'tree' | 'water' | 'fence' | 'rock'
  | 'sand' | 'dune' | 'brush' | 'road' | 'cliff' | 'salt' | 'cactus' | 'rockd'   // las del desierto
  | 'pasto' | 'forest' | 'poppy' | 'lupine' | 'vine' | 'reed';                  // las del Valle Central

/** Una salida hacia otra ruta: al pisar la casilla, se aparece en (tx, ty) de la ruta `to`, como las conexiones entre rutas de los juegos. */
export interface Exit { x: number; y: number; to: string; tx: number; ty: number; dir: 'up' | 'down' | 'left' | 'right' }

export interface RouteMap {
  w: number;
  h: number;
  tiles: TileKey[][];
  start: { x: number; y: number };
  exits: Exit[];
  trainers: TrainerSpot[];   // los entrenadores que esperan en la ruta
}

export const isWalkable = (t: TileKey) =>
  t === 'grass' || t === 'flower' || t === 'path' || t === 'tall' || t === 'sand' || t === 'dune' || t === 'brush' || t === 'road' || t === 'salt' ||
  t === 'pasto' || t === 'forest' || t === 'poppy' || t === 'lupine';

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

// ---------- generador de rutas ----------
//
// Cada ruta es un mapa grande (unos 80 × 70 tiles, varias pantallas) que se arma de una de tres maneras:
//   'open'  — naturaleza abierta: claros amplios, arboledas, lagunas y parches de hierba; con o sin camino marcado.
//   'rooms' — salas separadas por cercos, hileras de parras o arboledas, unidas por puertas: unas abiertas, otras
//             llenas de hierba alta (si quieres pasar, pasas por la hierba) y otras vigiladas por un entrenador.
//   'maze'  — laberinto de pasillos de 3 tiles entre muros de árboles, con tramos de hierba obligada y entrenadores.
// Todo sale de una semilla fija: cada ruta es siempre la misma.

type Dir4 = 'up' | 'down' | 'left' | 'right';

/** Un entrenador que espera en la ruta y reta a quien entre en su campo de visión. */
export interface TrainerSpot {
  id: string; x: number; y: number; dir: Dir4; name: string; taunt: string;
  team: { id: string; level: number }[];
  sight: number;      // hasta cuántas casillas al frente ve (y una casilla a cada lado)
  tint: number;       // tinte del sprite, para distinguirlos
  rival?: boolean;
}

/** Una puerta al borde del mapa que lleva a otra ruta. `at` es la posición a lo largo de ese borde (0 a 1). */
interface Gate { side: 'N' | 'S' | 'E' | 'W'; at: number; to: string }

interface OpenCfg {
  w: number; h: number; seed: number;
  layout?: 'open' | 'rooms' | 'maze';
  ground: TileKey; border: TileKey; road: TileKey; tall: TileKey; obstacle: TileKey;
  gates: Gate[];
  showRoad?: boolean;             // dibujar el camino ('open'; por defecto sí). Sin él, los caminos existen pero son pasto
  hub?: [number, number];         // dónde se juntan los caminos (fracción del mapa); por defecto, cerca del centro
  start?: [number, number];       // dónde empieza el jugador si no llega por una puerta
  wall?: TileKey;                 // muros de las salas / del laberinto
  wallAlt?: [TileKey, number];    // otro tile que se mezcla en los muros con esa probabilidad
  rooms?: [number, number];       // columnas y filas de salas
  clumps: number;                 // arboledas / formaciones de roca
  clumpSize?: number;
  patches: number;                // parches de hierba alta o matorral
  lakeRing?: boolean;             // hierba alta alrededor de las lagunas
  lakes: { cx: number; cy: number; rx: number; ry: number; ring?: TileKey }[];   // cx, cy como fracción del mapa; rx, ry en tiles
  reeds?: boolean;
  vineyards?: number;
  meadows?: { tile: TileKey; count: number }[];
  decor: [TileKey, number][];
  nearDecor: [TileKey, number];
  fenceEntry?: boolean;
  rival?: boolean;                // el huaso Anselmo junto a un tramo recto del camino
  trainers?: { n: number; names: string[]; bonus?: [number, number] };   // entrenadores de la ruta
}

const TRAINER_TINTS = [0xffd9b3, 0xb3d9ff, 0xd9ffb3, 0xffb3d9, 0xe0b3ff, 0xfff0a0, 0xb3fff0];
const TAUNTS = ['¡Alto ahí! Mis Pokémon quieren pelear.', '¡Por aquí no se pasa gratis!', '¡Te vi! ¡Prepárate!', '¡Pasaste por mi terreno, ahora peleas!', '¡Un duelo, forastero!', '¡Aquí mando yo!'];
const clampN = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Tamaño de cada ruta y sus puertas. Cada puerta debe tener su pareja (lado opuesto) en la ruta a la que lleva. */
const SIZE: Record<string, { w: number; h: number }> = {
  aromos: { w: 80, h: 72 }, atacama: { w: 88, h: 80 }, pastizal: { w: 84, h: 64 }, flores: { w: 80, h: 68 },
  vinas: { w: 80, h: 72 }, laguna: { w: 76, h: 68 }, bosque: { w: 84, h: 76 },
};
const GATES: Record<string, Gate[]> = {
  aromos: [{ side: 'N', at: 0.65, to: 'atacama' }, { side: 'W', at: 0.45, to: 'pastizal' }, { side: 'E', at: 0.4, to: 'vinas' }],
  atacama: [{ side: 'S', at: 0.46, to: 'aromos' }],
  pastizal: [{ side: 'E', at: 0.45, to: 'aromos' }, { side: 'N', at: 0.5, to: 'flores' }],
  flores: [{ side: 'S', at: 0.5, to: 'pastizal' }, { side: 'E', at: 0.45, to: 'laguna' }, { side: 'N', at: 0.5, to: 'bosque' }],
  laguna: [{ side: 'W', at: 0.45, to: 'flores' }, { side: 'S', at: 0.5, to: 'vinas' }],
  vinas: [{ side: 'W', at: 0.4, to: 'aromos' }, { side: 'N', at: 0.5, to: 'laguna' }],
  bosque: [{ side: 'S', at: 0.5, to: 'flores' }],
};

const gateAlong = (id: string, g: Gate) => Math.round(g.at * (g.side === 'N' || g.side === 'S' ? SIZE[id].w : SIZE[id].h));

/** Casilla de llegada (un paso dentro del mapa) de la puerta `g` de la ruta `id`, desplazada `k` casillas a lo largo del borde. */
function arrival(id: string, g: Gate, k: number): { x: number; y: number; dir: Exit['dir'] } {
  const { w, h } = SIZE[id], a = gateAlong(id, g) + k;
  return g.side === 'N' ? { x: a, y: 1, dir: 'down' } : g.side === 'S' ? { x: a, y: h - 2, dir: 'up' }
    : g.side === 'W' ? { x: 1, y: a, dir: 'right' } : { x: w - 2, y: a, dir: 'left' };
}

/** Las salidas de una ruta: al pisar el borde de una puerta se aparece junto a la puerta pareja de la ruta vecina. */
function exitsOf(id: string): Exit[] {
  const { w, h } = SIZE[id], out: Exit[] = [];
  for (const g of GATES[id]) {
    const partner = GATES[g.to].find((q) => q.to === id)!;
    for (let k = 0; k < 2; k++) {
      const a = gateAlong(id, g) + k, to = arrival(g.to, partner, k);
      const [x, y] = g.side === 'N' ? [a, 0] : g.side === 'S' ? [a, h - 1] : g.side === 'W' ? [0, a] : [w - 1, a];
      out.push({ x, y, to: g.to, tx: to.x, ty: to.y, dir: to.dir });
    }
  }
  return out;
}

function buildMap(id: string, c: OpenCfg): RouteMap {
  const W = c.w, H = c.h, rnd = rng(c.seed), layout = c.layout ?? 'open';
  const tiles: TileKey[][] = Array.from({ length: H }, () => Array<TileKey>(W).fill(c.ground));
  const set = (x: number, y: number, t: TileKey) => { if (x >= 0 && y >= 0 && x < W && y < H) tiles[y][x] = t; };
  const inEllipse = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
  const between = (a: number, b: number) => a + rnd() * (b - a);
  const rint = (a: number, b: number) => Math.floor(between(a, b + 1));
  const wallTile = (): TileKey => (c.wallAlt && rnd() < c.wallAlt[1] ? c.wallAlt[0] : c.wall ?? c.obstacle);
  const trainers: TrainerSpot[] = [];
  const names = [...(c.trainers?.names ?? [])];
  const wantTrainers = c.trainers?.n ?? 0;

  /** Equipo de un entrenador: de 1 a 3 Pokémon de la tabla de la ruta, un poco por encima del nivel de los salvajes. */
  const makeTeam = (size: number): { id: string; level: number }[] => {
    const table = ROUTES[id].encounters, total = table.reduce((a, e) => a + e.weight, 0), out: { id: string; level: number }[] = [];
    for (let k = 0; k < size; k++) {
      let r = rnd() * total;
      const e = table.find((q) => (r -= q.weight) < 0) ?? table[0];
      const [b0, b1] = c.trainers?.bonus ?? [0, 2];
      out.push({ id: e.id, level: e.max + rint(b0, b1) });
    }
    return out;
  };
  const addTrainer = (x: number, y: number, dir: Dir4, sight: number) => {
    const name = names.length ? names.splice(rint(0, names.length - 1), 1)[0] : 'Entrenador';
    trainers.push({
      id: `t${trainers.length}`, x, y, dir, name, taunt: TAUNTS[rint(0, TAUNTS.length - 1)], team: makeTeam(rint(1, 3)), sight,
      tint: TRAINER_TINTS[trainers.length % TRAINER_TINTS.length],
    });
  };
  const DV: Record<Dir4, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  /** Despeja las casillas que el entrenador ve al frente (hasta 4), para que nada le tape la vista. */
  const clearAhead = (x: number, y: number, dir: Dir4, n = 4) => {
    const [dx, dy] = DV[dir];
    set(x, y, c.ground);
    for (let i = 1; i <= n; i++) if (!isWalkable(tiles[y + dy * i]?.[x + dx * i] ?? 'tree')) set(x + dx * i, y + dy * i, c.ground);
  };

  // Borde que rodea la ruta: dos tiles de grosor y un tercero salpicado.
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const d = Math.min(x, y, W - 1 - x, H - 1 - y);
    if (d < 2 || (d === 2 && rnd() < 0.45)) set(x, y, c.border);
  }

  const path: [number, number][] = [];          // puntos que se mantienen despejados (caminos, puertas)
  const roadTile = c.showRoad === false || layout !== 'open' ? c.ground : c.road;
  const carve = (x0: number, y0: number, x1: number, y1: number, wide = 2) => {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1) + (y0 === y1 ? 0 : wide - 1); x++)
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1) + (x0 === x1 ? 0 : wide - 1); y++) { set(x, y, roadTile); path.push([x, y]); }
  };
  const gateGeom = (g: Gate) => {
    const a = gateAlong(id, g);
    const [bx, by] = g.side === 'N' ? [a, 0] : g.side === 'S' ? [a, H - 1] : g.side === 'W' ? [0, a] : [W - 1, a];
    return { a, bx, by, ns: g.side === 'N' || g.side === 'S' };
  };
  let start = { x: 0, y: 0 };
  const patch = Array.from({ length: H }, () => Array<boolean>(W).fill(false));
  const distPath = (x: number, y: number) => path.reduce((m, [px, py]) => Math.min(m, Math.hypot(px - x, py - y)), 99);
  const tallAt = (x: number, y: number) => { set(x, y, c.tall); patch[y][x] = true; };
  const lateTrainers: (() => void)[] = [];       // se colocan al final, cuando el terreno ya está listo

  if (layout === 'maze') {
    // ----- laberinto: pasillos de 3 tiles y muros de 2, con el algoritmo del "retroceso" -----
    const P = 5, ox = 3, oy = 3, nx = Math.floor((W - 2 * ox + 2) / P), ny = Math.floor((H - 2 * oy + 2) / P);
    const wall = c.wall ?? c.obstacle;
    for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) set(x, y, wall);
    const cellX = (i: number) => ox + i * P, cellY = (j: number) => oy + j * P;
    const open = Array.from({ length: ny }, () => Array.from({ length: nx }, () => ({ r: false, d: false })));   // pasaje hacia la derecha / hacia abajo
    const seenC = Array.from({ length: ny }, () => Array<boolean>(nx).fill(false));
    const stack: [number, number][] = [[Math.floor(nx / 2), Math.floor(ny / 2)]];
    seenC[stack[0][1]][stack[0][0]] = true;
    while (stack.length) {
      const [i, j] = stack[stack.length - 1];
      const opts = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).filter(([di, dj]) => i + di >= 0 && j + dj >= 0 && i + di < nx && j + dj < ny && !seenC[j + dj][i + di]);
      if (!opts.length) { stack.pop(); continue; }
      const [di, dj] = opts[rint(0, opts.length - 1)];
      if (di === 1) open[j][i].r = true; else if (di === -1) open[j][i - 1].r = true; else if (dj === 1) open[j][i].d = true; else open[j - 1][i].d = true;
      seenC[j + dj][i + di] = true;
      stack.push([i + di, j + dj]);
    }
    for (let k = 0; k < Math.floor(nx * ny * 0.12); k++) {   // algunos muros menos: rutas alternativas
      const i = rint(0, nx - 2), j = rint(0, ny - 2);
      if (rnd() < 0.5) open[j][i].r = true; else open[j][i].d = true;
    }
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) set(cellX(i) + x, cellY(j) + y, c.ground);
      if (open[j][i].r) for (let y = 0; y < 3; y++) for (let x = 3; x < 5; x++) set(cellX(i) + x, cellY(j) + y, c.ground);
      if (open[j][i].d) for (let y = 3; y < 5; y++) for (let x = 0; x < 3; x++) set(cellX(i) + x, cellY(j) + y, c.ground);
      path.push([cellX(i) + 1, cellY(j) + 1]);
    }
    // puertas: un pasillo desde el borde hasta la celda más cercana
    const gateCells: [number, number][] = [];
    c.gates.forEach((g) => {
      const { a, ns } = gateGeom(g);
      const i = clampN(Math.round((a - ox) / P), 0, nx - 1), j = clampN(Math.round((a - oy) / P), 0, ny - 1);
      if (ns) {
        const cx = cellX(i), top = g.side === 'N';
        const yEnd = top ? 0 : cellY(ny - 1) + 3;
        for (let y = top ? 0 : yEnd; y <= (top ? 2 : H - 1); y++) for (let x = Math.min(a, cx); x <= Math.max(a + 1, cx + 2); x++) if (y <= 2 || y >= H - 3 || (x >= cx && x < cx + 3)) set(x, y, c.ground);
        gateCells.push([i, top ? 0 : ny - 1]);
      } else {
        const cy = cellY(j), left = g.side === 'W';
        const xEnd = left ? 0 : cellX(nx - 1) + 3;
        for (let x = left ? 0 : xEnd; x <= (left ? 2 : W - 1); x++) for (let y = Math.min(a, cy); y <= Math.max(a + 1, cy + 2); y++) if (x <= 2 || x >= W - 3 || (y >= cy && y < cy + 3)) set(x, y, c.ground);
        gateCells.push([left ? 0 : nx - 1, j]);
      }
    });
    const start0 = arrival(id, c.gates[0], 0);
    start = { x: start0.x, y: start0.y };
    const isGateCell = (i: number, j: number) => gateCells.some(([gi, gj]) => Math.abs(gi - i) <= 1 && Math.abs(gj - j) <= 1);
    // hierba obligada: muchas celdas (y el pasillo que sale a la derecha) se llenan de hierba alta; hay que cruzarlas
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      if (isGateCell(i, j) || rnd() > 0.36) continue;
      for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) tallAt(cellX(i) + x, cellY(j) + y);
      if (open[j][i].r) for (let y = 0; y < 3; y++) for (let x = 3; x < 5; x++) tallAt(cellX(i) + x, cellY(j) + y);
    }
    // entrenadores en cruces y tramos (no en callejones), lejos de las entradas
    const cand: [number, number][] = [];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) if (!isGateCell(i, j) && Math.hypot(cellX(i) - start.x, cellY(j) - start.y) > 14) cand.push([i, j]);
    for (let guard = 0; trainers.length < wantTrainers && cand.length && guard < 400; guard++) {
      const [i, j] = cand.splice(rint(0, cand.length - 1), 1)[0];
      const dirs: Dir4[] = [];
      if (open[j][i].r) dirs.push('right');
      if (i > 0 && open[j][i - 1].r) dirs.push('left');
      if (open[j][i].d) dirs.push('down');
      if (j > 0 && open[j - 1][i].d) dirs.push('up');
      if (dirs.length < 2 || trainers.some((t) => Math.hypot(t.x - cellX(i), t.y - cellY(j)) < 16)) { cand.push([i, j]); cand.splice(0, 0); continue; }
      const dir = dirs[rint(0, dirs.length - 1)];
      tiles[cellY(j) + 1][cellX(i) + 1] = c.ground; patch[cellY(j) + 1][cellX(i) + 1] = false;
      addTrainer(cellX(i) + 1, cellY(j) + 1, dir, 5);
    }
  } else {
    // ----- 'open' y 'rooms' -----
    let hub: [number, number] = [0, 0];
    const jx = rnd(), jy = rnd();   // (siempre se sortean, para que cambiar el cruce no mueva el resto del mapa)
    hub = c.hub ? [Math.round(W * c.hub[0]), Math.round(H * c.hub[1])] : [Math.round(W * (0.5 + (jx - 0.5) * 0.24)), Math.round(H * (0.5 + (jy - 0.5) * 0.24))];

    if (layout === 'rooms') {
      // ----- salas con muros y puertas -----
      const [cols, rows] = c.rooms ?? [3, 3];
      const x0 = 2, y0 = 2, iw = W - 4, ih = H - 4;
      const bxs = (i: number) => Math.round(x0 + (i * iw) / cols), bys = (j: number) => Math.round(y0 + (j * ih) / rows);
      for (let i = 1; i < cols; i++) for (let y = y0; y < y0 + ih; y++) { set(bxs(i) - 1, y, wallTile()); set(bxs(i), y, wallTile()); }
      for (let j = 1; j < rows; j++) for (let x = x0; x < x0 + iw; x++) { set(x, bys(j) - 1, wallTile()); set(x, bys(j), wallTile()); }
      // qué salas se unen: un árbol que las conecta a todas, más algunas puertas de más (rutas alternativas)
      type Edge = { i: number; j: number; dir: 'r' | 'd'; loop: boolean };
      const edges: Edge[] = [], seenR = Array.from({ length: rows }, () => Array<boolean>(cols).fill(false)), st: [number, number][] = [[rint(0, cols - 1), rint(0, rows - 1)]];
      seenR[st[0][1]][st[0][0]] = true;
      const used = new Set<string>();
      while (st.length) {
        const [i, j] = st[st.length - 1];
        const opts = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).filter(([di, dj]) => i + di >= 0 && j + dj >= 0 && i + di < cols && j + dj < rows && !seenR[j + dj][i + di]);
        if (!opts.length) { st.pop(); continue; }
        const [di, dj] = opts[rint(0, opts.length - 1)];
        const e: Edge = di === 1 ? { i, j, dir: 'r', loop: false } : di === -1 ? { i: i - 1, j, dir: 'r', loop: false } : dj === 1 ? { i, j, dir: 'd', loop: false } : { i, j: j - 1, dir: 'd', loop: false };
        edges.push(e); used.add(`${e.i},${e.j},${e.dir}`);
        seenR[j + dj][i + di] = true;
        st.push([i + di, j + dj]);
      }
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) for (const dir of ['r', 'd'] as const) {
        if ((dir === 'r' && i === cols - 1) || (dir === 'd' && j === rows - 1) || used.has(`${i},${j},${dir}`)) continue;
        if (rnd() < 0.4) edges.push({ i, j, dir, loop: true });
      }
      // tipo de cada puerta: abierta, llena de hierba alta (hay que cruzarla) o vigilada por un entrenador; siempre algunas vigiladas
      const types = edges.map((e): 'open' | 'grass' | 'trainer' => { const r = rnd(); return e.loop ? (r < 0.5 ? 'grass' : 'trainer') : r < 0.3 ? 'open' : r < 0.65 ? 'grass' : 'trainer'; });
      const minT = Math.min(wantTrainers, 3);
      for (let guard = 0; types.filter((t) => t === 'trainer').length < minT && guard < 50; guard++) types[rint(0, types.length - 1)] = 'trainer';
      let trainerDoors = 0;
      for (let ei = 0; ei < edges.length; ei++) {
        const e = edges[ei];
        let type = types[ei];
        if (type === 'trainer' && trainerDoors >= wantTrainers) type = 'grass';
        if (type === 'trainer') trainerDoors++;
        if (e.dir === 'r') {   // puerta en el muro vertical entre la sala (i, j) y la (i + 1, j)
          const wx0 = bxs(e.i + 1) - 1, wx1 = bxs(e.i + 1), ya = bys(e.j) + 4, yb = bys(e.j + 1) - 5, cy = rint(ya, Math.max(ya, yb));
          for (let x = wx0; x <= wx1; x++) for (let y = cy - 1; y <= cy + 1; y++) { set(x, y, c.ground); path.push([x, y]); }
          if (type === 'grass') for (let x = wx0 - 3; x <= wx1 + 3; x++) for (let y = cy - 1; y <= cy + 1; y++) tallAt(x, y);
          if (type === 'trainer') lateTrainers.push(() => { clearAhead(wx1 + 3, cy, 'left', 3); for (let x = wx1 + 1; x <= wx1 + 3; x++) set(x, cy, c.ground); addTrainer(wx1 + 3, cy, 'left', 6); });
        } else {              // puerta en el muro horizontal entre la sala (i, j) y la (i, j + 1)
          const wy0 = bys(e.j + 1) - 1, wy1 = bys(e.j + 1), xa = bxs(e.i) + 4, xb = bxs(e.i + 1) - 5, cx = rint(xa, Math.max(xa, xb));
          for (let y = wy0; y <= wy1; y++) for (let x = cx - 1; x <= cx + 1; x++) { set(x, y, c.ground); path.push([x, y]); }
          if (type === 'grass') for (let y = wy0 - 3; y <= wy1 + 3; y++) for (let x = cx - 1; x <= cx + 1; x++) tallAt(x, y);
          if (type === 'trainer') lateTrainers.push(() => { clearAhead(cx, wy1 + 3, 'up', 3); for (let y = wy1 + 1; y <= wy1 + 3; y++) set(cx, y, c.ground); addTrainer(cx, wy1 + 3, 'up', 6); });
        }
      }
      // puertas hacia otras rutas: un pasillo de 3 tiles desde el borde hacia dentro
      c.gates.forEach((g) => {
        const { a, ns } = gateGeom(g);
        for (let d = 0; d < 9; d++) for (let k = 0; k < 3; k++) {
          const [x, y] = g.side === 'N' ? [a + k - 0, d] : g.side === 'S' ? [a + k, H - 1 - d] : g.side === 'W' ? [d, a + k] : [W - 1 - d, a + k];
          set(x, y, c.ground);
          if (d >= 3) path.push([x, y]);
        }
        void ns;
      });
    } else {
      // ----- naturaleza abierta: una red de caminos que une las puertas (se ven o no, según la ruta) -----
      const branch = (px: number, py: number, vertical: boolean) => {
        let pts: [number, number][];
        if (vertical) {
          const my = Math.round((py + hub[1]) / 2), mx = Math.abs(px - hub[0]) > 14 ? Math.round(between(12, W - 14)) : px;
          pts = [[px, py], [px, my], [mx, my], [mx, hub[1]], hub];
        } else {
          const mx = Math.round((px + hub[0]) / 2), my = Math.abs(py - hub[1]) > 12 ? Math.round(between(12, H - 14)) : py;
          pts = [[px, py], [mx, py], [mx, my], [hub[0], my], hub];
        }
        for (let i = 0; i + 1 < pts.length; i++) {
          const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
          if (ax === bx && ay === by) continue;
          if (ax === bx || ay === by) carve(ax, ay, bx, by);
          else { carve(ax, ay, ax, by); carve(ax, by, bx, by); }
        }
      };
      c.gates.forEach((g) => {
        const { a, bx, by, ns } = gateGeom(g);
        const [ix, iy] = g.side === 'N' ? [a, 5] : g.side === 'S' ? [a, H - 6] : g.side === 'W' ? [5, a] : [W - 6, a];
        carve(bx, by, ix, iy);
        branch(ix, iy, ns);
      });
      if (c.start) { carve(c.start[0], c.start[1], c.start[0], c.start[1] - 6); branch(c.start[0], c.start[1] - 6, true); }
    }
    if (c.start) start = { x: c.start[0], y: c.start[1] };
    else { const t = arrival(id, c.gates[0], 0); start = { x: t.x, y: t.y }; }

    // Lagunas o salares (con totoras en la orilla y hierba alrededor si toca).
    for (const l of c.lakes) {
      const cx = Math.round(l.cx * W), cy = Math.round(l.cy * H);
      for (let y = 3; y < H - 3; y++) for (let x = 3; x < W - 3; x++) {
        if (tiles[y][x] !== c.ground || distPath(x, y) <= 2.5) continue;
        if (inEllipse(x, y, cx, cy, l.rx, l.ry)) set(x, y, l.ring ? (inEllipse(x, y, cx, cy, l.rx * 0.45, l.ry * 0.45) ? 'water' : l.ring) : 'water');
      }
      if (c.lakeRing) for (let y = 3; y < H - 3; y++) for (let x = 3; x < W - 3; x++)
        if (tiles[y][x] === c.ground && inEllipse(x, y, cx, cy, l.rx + 4, l.ry + 3) && rnd() < 0.72) tallAt(x, y);
    }
    if (c.reeds) {
      const shore: [number, number][] = [];
      for (let y = 3; y < H - 3; y++) for (let x = 3; x < W - 3; x++)
        if ((tiles[y][x] === c.ground || tiles[y][x] === c.tall) && ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).some(([dx, dy]) => tiles[y + dy][x + dx] === 'water') && rnd() < 0.4) shore.push([x, y]);
      for (const [x, y] of shore) set(x, y, 'reed');
    }

    // Viñas: bloques de hileras de vides con pasillos entre ellas.
    for (let k = 0; k < (c.vineyards ?? 0); k++) {
      for (let tryN = 0; tryN < 30; tryN++) {
        const bw = Math.round(between(14, 22)), bh = Math.round(between(8, 12)), x0 = Math.round(between(7, W - bw - 7)), y0 = Math.round(between(7, H - bh - 7));
        let clear = true;
        for (let y = y0 - 2; y <= y0 + bh + 2 && clear; y++) for (let x = x0 - 2; x <= x0 + bw + 2; x++) if (tiles[y]?.[x] !== c.ground) { clear = false; break; }
        if (!clear) continue;
        for (let y = y0; y < y0 + bh; y++) if ((y - y0) % 3 === 1) for (let x = x0 + 2; x < x0 + bw - 2; x++) set(x, y, 'vine');
        break;
      }
    }

    // Manchas de flores (se pisan, no esconden Pokémon).
    for (const m of c.meadows ?? []) for (let k = 0; k < m.count; k++) {
      const cx = Math.round(between(8, W - 9)), cy = Math.round(between(8, H - 9)), rx = between(4, 10), ry = between(3, 7);
      for (let y = 3; y < H - 3; y++) for (let x = 3; x < W - 3; x++) if (tiles[y][x] === c.ground && inEllipse(x, y, cx, cy, rx, ry) && rnd() < 0.9) set(x, y, m.tile);
    }

    // Arboledas o formaciones de roca.
    const cs = c.clumpSize ?? 1;
    for (let k = 0; k < c.clumps; k++) {
      const cx = Math.round(between(6, W - 7)), cy = Math.round(between(6, H - 7)), rx = between(2.2, 5.5) * cs, ry = between(1.8, 4.5) * cs;
      if (distPath(cx, cy) < Math.max(rx, ry) + 3) continue;
      for (let y = 3; y < H - 3; y++) for (let x = 3; x < W - 3; x++)
        if (tiles[y][x] === c.ground && inEllipse(x, y, cx, cy, rx, ry) && distPath(x, y) > 2) set(x, y, c.obstacle);
    }

    // Parches de hierba alta (o matorral): la mayoría junto a los caminos / puertas, otros en pleno claro.
    for (let k = 0; k < c.patches; k++) {
      let cx: number, cy: number;
      if (path.length && rnd() < 0.7) {
        const [px, py] = path[Math.floor(rnd() * path.length)], a = rnd() * Math.PI * 2, d = between(4, 9);
        cx = Math.round(px + Math.cos(a) * d); cy = Math.round(py + Math.sin(a) * d);
      } else { cx = Math.round(between(6, W - 7)); cy = Math.round(between(6, H - 7)); }
      const rx = between(2.4, 6.4), ry = between(2, 4.8);
      for (let y = Math.max(3, Math.floor(cy - ry)); y <= Math.min(H - 4, Math.ceil(cy + ry)); y++)
        for (let x = Math.max(3, Math.floor(cx - rx)); x <= Math.min(W - 4, Math.ceil(cx + rx)); x++)
          if ((tiles[y][x] === c.ground || tiles[y][x] === 'poppy' || tiles[y][x] === 'lupine' || tiles[y][x] === 'flower') && inEllipse(x, y, cx, cy, rx, ry)) tallAt(x, y);
    }

    // Cercos junto a la entrada del jugador.
    if (c.fenceEntry && c.start) for (let d = 3; d <= 9; d++) for (const x of [c.start[0] - d, c.start[0] + 1 + d]) if (tiles[H - 4][x] === c.ground) set(x, H - 4, 'fence');

    // Adornos sueltos, sin tapar caminos, puertas ni hierba alta.
    for (let y = 3; y < H - 3; y++) for (let x = 3; x < W - 3; x++) {
      if (tiles[y][x] !== c.ground) continue;
      const r = rnd();
      if (distPath(x, y) > 2.2 && !patch[y][x]) {
        let acc = 0;
        for (const [t, p] of c.decor) { acc += p; if (r < acc) { set(x, y, t); break; } }
      } else if (r < c.nearDecor[1]) set(x, y, c.nearDecor[0]);
    }

    // Entrenadores en naturaleza abierta: junto a un tramo recto de los caminos (aunque no se vean), mirando hacia ellos.
    if (layout === 'open') {
      const pset = new Set(path.map(([x, y]) => y * W + x));
      const isP = (x: number, y: number) => pset.has(y * W + x);
      const sides = (px: number, py: number): { x: number; y: number; dir: Dir4 }[] => {
        const out: { x: number; y: number; dir: Dir4 }[] = [];
        if ([-3, -1, 1, 3].every((d) => isP(px, py + d))) {
          let ex = px; while (isP(ex + 1, py)) ex++;
          let sx = px; while (isP(sx - 1, py)) sx--;
          out.push({ x: ex + 4, y: py, dir: 'left' }, { x: sx - 4, y: py, dir: 'right' });
        }
        if ([-3, -1, 1, 3].every((d) => isP(px + d, py))) {
          let ey = py; while (isP(px, ey + 1)) ey++;
          let sy = py; while (isP(px, sy - 1)) sy--;
          out.push({ x: px, y: ey + 4, dir: 'up' }, { x: px, y: sy - 4, dir: 'down' });
        }
        return out.filter((o) => o.x > 4 && o.y > 4 && o.x < W - 5 && o.y < H - 5);
      };
      const place = (dir0: Dir4 | null, spec: { name?: string; rival?: boolean }, fromFrac: number): boolean => {
        for (let tryN = 0; tryN < 200; tryN++) {
          const [px, py] = path[Math.floor(path.length * (fromFrac + rnd() * 0.5))] ?? path[0];
          const opts = sides(px, py).filter((o) => (!dir0 || o.dir === dir0) && trainers.every((t) => Math.hypot(t.x - o.x, t.y - o.y) > 12) && Math.hypot(o.x - start.x, o.y - start.y) > 12 && !['water', 'cliff'].includes(tiles[o.y][o.x]));
          if (!opts.length) continue;
          const o = opts[rint(0, opts.length - 1)];
          const [dx, dy] = DV[o.dir];
          for (let i = 0; i <= 4; i++) set(o.x + dx * i, o.y + dy * i, c.ground);   // despeja el campo de visión
          if (spec.rival) trainers.push({ id: 'anselmo', x: o.x, y: o.y, dir: o.dir, name: RIVAL.name, taunt: '¡Eh, tú! Nadie cruza mi camino sin pelear.', team: RIVAL.team, sight: RIVAL.sight, tint: 0xffffff, rival: true });
          else addTrainer(o.x, o.y, o.dir, 4);
          return true;
        }
        return false;
      };
      if (c.rival) place(null, { rival: true }, 0.3);
      for (let k = 0; k < wantTrainers; k++) place(null, {}, 0.15);
    }
    lateTrainers.forEach((f) => f());
  }

  // Todo lo caminable debe ser alcanzable desde la entrada: lo aislado se cierra.
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
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (isWalkable(tiles[y][x]) && !seen[y][x]) set(x, y, c.wall ?? c.obstacle);
  return { w: W, h: H, tiles, start, exits: exitsOf(id), trainers };
}

const dims = (id: string) => ({ ...SIZE[id], gates: GATES[id] });

/** Ruta Los Aromos: la pradera de la primera ruta, con camino marcado, lagunitas, Anselmo y otro entrenador. */
export function buildRoute(): RouteMap {
  return buildMap('aromos', {
    ...dims('aromos'), start: [28, SIZE.aromos.h - 3], seed: 20261023, ground: 'grass', border: 'tree', road: 'path', tall: 'tall', obstacle: 'tree',
    clumps: 34, patches: 26, fenceEntry: true, rival: true,
    trainers: { n: 1, names: ['Caminante Rodrigo', 'Niña Javiera'], bonus: [0, 1] },
    lakes: [{ cx: 0.8, cy: 0.3, rx: 6, ry: 4 }, { cx: 0.18, cy: 0.5, rx: 4.5, ry: 3.2 }],
    decor: [['tree', 0.06], ['rock', 0.04], ['flower', 0.12]], nearDecor: ['flower', 0.07],
  });
}

/** Pastizales del Rodeo: corrales de cercos de madera con puertas de hierba o vigiladas por huasos, pasto dorado. */
export function buildPastizal(): RouteMap {
  return buildMap('pastizal', {
    ...dims('pastizal'), layout: 'rooms', rooms: [3, 3], wall: 'fence', wallAlt: ['tree', 0.12],
    seed: 20263001, ground: 'pasto', border: 'tree', road: 'path', tall: 'tall', obstacle: 'tree',
    clumps: 8, patches: 14,
    trainers: { n: 4, names: ['Jinete Don Abel', 'Huasa Carmen', 'Arriero Tito', 'Domador Fermín', 'Lazadora Pía'], bonus: [0, 2] },
    lakes: [{ cx: 0.3, cy: 0.7, rx: 3.5, ry: 2.4 }],
    decor: [['tree', 0.015], ['rock', 0.02]], nearDecor: ['flower', 0.03],
  });
}

/** Valle de las Flores: huertos separados por setos de árboles y rocas, con praderas de amapolas y lupinos. */
export function buildFlores(): RouteMap {
  return buildMap('flores', {
    ...dims('flores'), layout: 'rooms', rooms: [3, 3], wall: 'tree', wallAlt: ['rock', 0.08],
    seed: 20263002, ground: 'grass', border: 'tree', road: 'path', tall: 'tall', obstacle: 'tree',
    clumps: 8, patches: 14,
    meadows: [{ tile: 'poppy', count: 9 }, { tile: 'lupine', count: 9 }, { tile: 'flower', count: 10 }],
    trainers: { n: 4, names: ['Florista Rosita', 'Apicultor Don Gaspar', 'Niña Camila', 'Jardinero Lalo', 'Pintora Francisca'], bonus: [0, 2] },
    lakes: [{ cx: 0.78, cy: 0.22, rx: 5, ry: 3 }, { cx: 0.2, cy: 0.35, rx: 3.2, ry: 2.2 }],
    decor: [['tree', 0.02], ['flower', 0.14]], nearDecor: ['flower', 0.1],
  });
}

/** Viñas de Colchagua: cuarteles separados por hileras de parras; las puertas son hierba o tienen un vendimiador. */
export function buildVinas(): RouteMap {
  return buildMap('vinas', {
    ...dims('vinas'), layout: 'rooms', rooms: [3, 3], wall: 'vine',
    seed: 20263003, ground: 'grass', border: 'tree', road: 'path', tall: 'tall', obstacle: 'tree',
    vineyards: 5, clumps: 8, patches: 14,
    trainers: { n: 5, names: ['Vendimiador Chelo', 'Enóloga Valentina', 'Capataz Sandoval', 'Tractorista Juanito', 'Catador Don Hernán'], bonus: [0, 2] },
    lakes: [{ cx: 0.85, cy: 0.8, rx: 4, ry: 2.6 }],   // el embalse de riego
    decor: [['tree', 0.025], ['rock', 0.02], ['flower', 0.04]], nearDecor: ['flower', 0.04],
  });
}

/** Laguna de Aculeo: naturaleza abierta, sin camino marcado: laguna central con totoras, rodeada de hierba. */
export function buildLaguna(): RouteMap {
  return buildMap('laguna', {
    ...dims('laguna'), seed: 20263004, ground: 'grass', border: 'tree', road: 'path', tall: 'tall', obstacle: 'tree', showRoad: false,
    hub: [0.2, 0.82], clumps: 14, patches: 18, reeds: true, lakeRing: true,
    trainers: { n: 3, names: ['Pescador Nico', 'Salvavidas Rodrigo', 'Ornitólogo Dr. Pinto'], bonus: [0, 2] },
    lakes: [{ cx: 0.5, cy: 0.48, rx: 15, ry: 10 }, { cx: 0.14, cy: 0.18, rx: 3.5, ry: 2.4 }, { cx: 0.86, cy: 0.82, rx: 3.5, ry: 2.4 }],
    decor: [['tree', 0.03], ['rock', 0.015], ['flower', 0.07]], nearDecor: ['flower', 0.05],
  });
}

/** Bosque de Quillay: laberinto cerrado de pasillos entre muros de árboles, con tramos de hierba obligada y entrenadores. */
export function buildBosque(): RouteMap {
  return buildMap('bosque', {
    ...dims('bosque'), layout: 'maze', wall: 'tree',
    seed: 20263005, ground: 'forest', border: 'tree', road: 'path', tall: 'tall', obstacle: 'tree',
    clumps: 0, patches: 0,
    trainers: { n: 6, names: ['Leñador Hernán', 'Guardaparque Olga', 'Coleccionista Benja', 'Excursionista Ximena', 'Ermitaño Don Pancho', 'Scout Matías'], bonus: [0, 2] },
    lakes: [], decor: [], nearDecor: ['flower', 0],
  });
}

// ---------- Desierto de Atacama ----------

export function buildAtacama(): RouteMap {
  return buildMap('atacama', {
    ...dims('atacama'), seed: 20262024,
    ground: 'sand', border: 'cliff', road: 'road', tall: 'brush', obstacle: 'cliff', clumps: 40, patches: 28,
    trainers: { n: 3, names: ['Minero Beto', 'Arriero Chino', 'Geólogo Dr. Salas'], bonus: [0, 3] },
    lakes: [{ cx: 0.74, cy: 0.14, rx: 12, ry: 6, ring: 'salt' }],   // salar con laguna, como la Laguna Chaxa
    decor: [['cactus', 0.06], ['rockd', 0.03], ['dune', 0.14]], nearDecor: ['dune', 0.04],
  });
}

// ---------- Pokémon salvajes de la ruta ----------

export interface Encounter { id: string; weight: number; min: number; max: number }

/** Ruta Los Aromos (la primera): los Pokémon de principio de juego, de nivel bajo. */
export const ROUTE_ENCOUNTERS: Encounter[] = [
  { id: 'bidoof', weight: 22, min: 3, max: 9 },
  { id: 'starly', weight: 20, min: 3, max: 9 },
  { id: 'pidgey', weight: 18, min: 3, max: 9 },
  { id: 'rattata', weight: 14, min: 3, max: 9 },
  { id: 'sentret', weight: 8, min: 4, max: 9 },
  { id: 'zigzagoon', weight: 6, min: 4, max: 9 },
  { id: 'caterpie', weight: 5, min: 3, max: 8 },
  { id: 'weedle', weight: 4, min: 3, max: 8 },
  { id: 'hoppip', weight: 3, min: 4, max: 9 },
  { id: 'pikachu', weight: 1, min: 5, max: 10 },
  { id: 'eevee', weight: 0.5, min: 5, max: 10 },
];

/** Pastizales del Rodeo: los de siempre más los de campo (cuadrúpedos, aves de pradera). */
export const PASTIZAL_ENCOUNTERS: Encounter[] = [
  { id: 'rattata', weight: 14, min: 5, max: 11 },
  { id: 'spearow', weight: 14, min: 5, max: 11 },
  { id: 'doduo', weight: 12, min: 6, max: 11 },
  { id: 'pidgey', weight: 9, min: 5, max: 10 },
  { id: 'nidoran-m', weight: 9, min: 5, max: 10 },
  { id: 'nidoran-f', weight: 9, min: 5, max: 10 },
  { id: 'sentret', weight: 7, min: 5, max: 10 },
  { id: 'bidoof', weight: 6, min: 5, max: 10 },
  { id: 'ponyta', weight: 6, min: 7, max: 12 },
  { id: 'mankey', weight: 6, min: 6, max: 11 },
  { id: 'miltank', weight: 3, min: 8, max: 12 },
  { id: 'growlithe', weight: 3, min: 7, max: 12 },
  { id: 'tauros', weight: 2, min: 9, max: 13 },
  { id: 'farfetchd', weight: 1, min: 8, max: 12 },
];

/** Valle de las Flores: plantas, abejas y mariposas. */
export const FLORES_ENCOUNTERS: Encounter[] = [
  { id: 'oddish', weight: 14, min: 7, max: 13 },
  { id: 'bellsprout', weight: 14, min: 7, max: 13 },
  { id: 'hoppip', weight: 12, min: 7, max: 13 },
  { id: 'sunkern', weight: 12, min: 7, max: 12 },
  { id: 'budew', weight: 9, min: 7, max: 12 },
  { id: 'roselia', weight: 6, min: 9, max: 13 },
  { id: 'combee', weight: 8, min: 7, max: 12 },
  { id: 'ledyba', weight: 7, min: 7, max: 12 },
  { id: 'caterpie', weight: 7, min: 7, max: 11 },
  { id: 'pidgey', weight: 5, min: 7, max: 11 },
  { id: 'jigglypuff', weight: 4, min: 8, max: 13 },
  { id: 'skiploom', weight: 4, min: 10, max: 14 },
  { id: 'cherubi', weight: 3, min: 8, max: 12 },
  { id: 'gloom', weight: 3, min: 11, max: 14 },
  { id: 'weepinbell', weight: 2.5, min: 11, max: 14 },
  { id: 'butterfree', weight: 1.5, min: 11, max: 14 },
];

/** Viñas de Colchagua: frutas, bichos de la parra, aves que picotean y algún vendimiador. */
export const VINAS_ENCOUNTERS: Encounter[] = [
  { id: 'exeggcute', weight: 14, min: 8, max: 14 },
  { id: 'venonat', weight: 10, min: 8, max: 13 },
  { id: 'paras', weight: 10, min: 8, max: 13 },
  { id: 'spinda', weight: 9, min: 9, max: 14 },
  { id: 'pineco', weight: 8, min: 8, max: 13 },
  { id: 'ledyba', weight: 8, min: 8, max: 13 },
  { id: 'hoothoot', weight: 8, min: 8, max: 13 },
  { id: 'starly', weight: 8, min: 8, max: 12 },
  { id: 'oddish', weight: 8, min: 8, max: 13 },
  { id: 'cherubi', weight: 6, min: 9, max: 13 },
  { id: 'bellsprout', weight: 6, min: 8, max: 13 },
  { id: 'machop', weight: 5, min: 9, max: 14 },
  { id: 'mankey', weight: 4, min: 9, max: 14 },
  { id: 'slowpoke', weight: 4, min: 9, max: 14 },
  { id: 'mareep', weight: 3, min: 9, max: 14 },
  { id: 'murkrow', weight: 3, min: 10, max: 14 },
];

/** Laguna de Aculeo: agua dulce, patos y peces. */
export const LAGUNA_ENCOUNTERS: Encounter[] = [
  { id: 'psyduck', weight: 14, min: 9, max: 15 },
  { id: 'poliwag', weight: 14, min: 9, max: 15 },
  { id: 'goldeen', weight: 12, min: 9, max: 15 },
  { id: 'magikarp', weight: 12, min: 9, max: 14 },
  { id: 'marill', weight: 10, min: 9, max: 14 },
  { id: 'wooper', weight: 10, min: 9, max: 14 },
  { id: 'lotad', weight: 10, min: 9, max: 14 },
  { id: 'surskit', weight: 8, min: 9, max: 14 },
  { id: 'barboach', weight: 6, min: 10, max: 15 },
  { id: 'slowpoke', weight: 6, min: 10, max: 15 },
  { id: 'shellos', weight: 5, min: 10, max: 14 },
  { id: 'azurill', weight: 4, min: 9, max: 13 },
  { id: 'buizel', weight: 4, min: 10, max: 14 },
  { id: 'corphish', weight: 4, min: 10, max: 14 },
  { id: 'poliwhirl', weight: 2, min: 13, max: 16 },
  { id: 'golduck', weight: 1.5, min: 14, max: 17 },
  { id: 'dratini', weight: 0.8, min: 12, max: 16 },
  { id: 'lapras', weight: 0.4, min: 14, max: 17 },
];

/** Bosque de Quillay: sobre todo bichos, más aves nocturnas y osos. Es donde hay más Pokémon a la vez. */
export const BOSQUE_ENCOUNTERS: Encounter[] = [
  { id: 'caterpie', weight: 12, min: 11, max: 16 },
  { id: 'weedle', weight: 12, min: 11, max: 16 },
  { id: 'wurmple', weight: 10, min: 11, max: 16 },
  { id: 'kricketot', weight: 10, min: 11, max: 16 },
  { id: 'metapod', weight: 6, min: 12, max: 17 },
  { id: 'kakuna', weight: 6, min: 12, max: 17 },
  { id: 'burmy', weight: 8, min: 11, max: 16 },
  { id: 'spinarak', weight: 8, min: 11, max: 16 },
  { id: 'ledyba', weight: 7, min: 11, max: 16 },
  { id: 'pineco', weight: 8, min: 11, max: 16 },
  { id: 'paras', weight: 8, min: 12, max: 17 },
  { id: 'venonat', weight: 7, min: 12, max: 17 },
  { id: 'nincada', weight: 6, min: 12, max: 17 },
  { id: 'shroomish', weight: 6, min: 12, max: 17 },
  { id: 'hoothoot', weight: 6, min: 11, max: 16 },
  { id: 'yanma', weight: 4, min: 13, max: 17 },
  { id: 'oddish', weight: 4, min: 11, max: 16 },
  { id: 'teddiursa', weight: 3, min: 13, max: 17 },
  { id: 'heracross', weight: 2, min: 14, max: 18 },
  { id: 'scyther', weight: 1.5, min: 14, max: 18 },
  { id: 'pinsir', weight: 1.5, min: 14, max: 18 },
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
  wildMax?: number;   // Pokémon salvajes visibles a la vez (por defecto, 4)
}

export const ROUTES: Record<string, RouteDef> = {
  aromos: { id: 'aromos', name: 'Ruta Los Aromos', build: buildRoute, encounters: ROUTE_ENCOUNTERS, trainer: true, desert: false },
  pastizal: { id: 'pastizal', name: 'Pastizales del Rodeo', build: buildPastizal, encounters: PASTIZAL_ENCOUNTERS, trainer: false, desert: false },
  flores: { id: 'flores', name: 'Valle de las Flores', build: buildFlores, encounters: FLORES_ENCOUNTERS, trainer: false, desert: false },
  vinas: { id: 'vinas', name: 'Viñas de Colchagua', build: buildVinas, encounters: VINAS_ENCOUNTERS, trainer: false, desert: false },
  laguna: { id: 'laguna', name: 'Laguna de Aculeo', build: buildLaguna, encounters: LAGUNA_ENCOUNTERS, trainer: false, desert: false },
  bosque: { id: 'bosque', name: 'Bosque de Quillay', build: buildBosque, encounters: BOSQUE_ENCOUNTERS, trainer: false, desert: false, wildMax: 7 },
  atacama: { id: 'atacama', name: 'Desierto de Atacama', build: buildAtacama, encounters: ATACAMA_ENCOUNTERS, trainer: false, desert: true },
};
