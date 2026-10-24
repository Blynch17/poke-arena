import Phaser from 'phaser';

// Gráficos de los tiles de la ruta, dibujados píxel a píxel por código. Cada tile mide 32x32 y se muestra x2.
// Los pixeles salpicados usan una semilla fija, así que todo se ve igual en cada partida.

const mulberry = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const S = 32;
type Px = (x: number, y: number, c: number) => void;
type Paint = (px: Px, r: () => number) => void;

function tile(scene: Phaser.Scene, key: string, seed: number, paint: Paint) {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const px: Px = (x, y, c) => {
    x = ((Math.round(x) % S) + S) % S;   // se envuelve en los bordes para que el tile encaje con sus vecinos
    y = ((Math.round(y) % S) + S) % S;
    g.fillStyle(c, 1).fillRect(x, y, 1, 1);
  };
  paint(px, mulberry(seed));
  g.generateTexture(key, S, S);
  g.destroy();
}

const fill = (px: Px, c: number, y0 = 0, y1 = S) => { for (let y = y0; y < y1; y++) for (let x = 0; x < S; x++) px(x, y, c); };
const rect = (px: Px, x: number, y: number, w: number, h: number, c: number) => {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(x + i, y + j, c);
};
const disc = (px: Px, cx: number, cy: number, r: number, c: number) => {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px(x, y, c);
};

// Paleta
const G0 = 0x5bb04c, G1 = 0x4a9a40, G2 = 0x76c862;                   // pasto
const T0 = 0x2c7a30, T1 = 0x1c5a24, T2 = 0x8ce07a;                   // hierba alta
const P0 = 0xd9bc7c, P1 = 0xc29d5a, P2 = 0xeed7a0;                   // camino
const C0 = 0x2d8a38, C1 = 0x1f6a2c, C2 = 0x62b84e, CO = 0x174d22;    // copa del árbol
const TR0 = 0x6b4226, TR1 = 0x4a2c18;                                // tronco
const W0 = 0x3b86d6, W1 = 0x2f72bf, W2 = 0x8fd0f6;                   // agua
const F0 = 0xb07a46, F1 = 0x7a5230;                                  // cerco
const R0 = 0x8f949e, R1 = 0x636873, R2 = 0xc4c9d2;                   // roca

const grass: Paint = (px, r) => {
  fill(px, G0);
  for (let i = 0; i < 16; i++) px(r() * S, r() * S, G1);
  for (let i = 0; i < 12; i++) px(r() * S, r() * S, G2);
  for (let i = 0; i < 3; i++) {                    // pequeñas matas en forma de V
    const x = 3 + r() * 26, y = 3 + r() * 26;
    px(x, y, G1); px(x + 1, y + 1, G1); px(x + 2, y, G1);
  }
};

// Mata de hierba alta: tres hojas claras sobre tallos oscuros.
const tuft = (px: Px, cx: number, cy: number) => {
  for (const dx of [-3, 0, 3]) {
    px(cx + dx, cy - 4 + Math.abs(dx) / 3, T2);
    for (let dy = -3; dy <= 0; dy++) px(cx + dx, cy + dy, T1);
  }
  px(cx - 1, cy - 2, T1); px(cx + 1, cy - 2, T1);
};

const tallBlades = (px: Px, from = 0) => {
  for (const [y, xs] of [[7, [4, 12, 20, 28]], [15, [8, 16, 24, 0]], [23, [4, 12, 20, 28]], [31, [8, 16, 24, 0]]] as [number, number[]][])
    if (y >= from) for (const x of xs) tuft(px, x, y);
};

export function makeTileTextures(scene: Phaser.Scene) {
  for (let v = 0; v < 3; v++) tile(scene, `tile-grass-${v}`, 100 + v, grass);

  tile(scene, 'tile-flower', 7, (px, r) => {
    grass(px, r);
    for (const [fx, fy, c] of [[7, 8, 0xffffff], [21, 12, 0xffd23f], [12, 22, 0xff8fcf], [26, 26, 0xffffff]] as [number, number, number][]) {
      px(fx, fy, c); px(fx - 1, fy, c); px(fx + 1, fy, c); px(fx, fy - 1, c); px(fx, fy + 1, c);
      px(fx, fy, 0xf2a900);
    }
  });

  tile(scene, 'tile-path', 3, (px, r) => {
    fill(px, P0);
    for (let i = 0; i < 18; i++) px(r() * S, r() * S, P1);
    for (let i = 0; i < 12; i++) px(r() * S, r() * S, P2);
    for (let i = 0; i < 3; i++) { const x = r() * 28, y = r() * 28; px(x, y, P1); px(x + 1, y, P1); }
  });

  tile(scene, 'tile-tall', 5, (px) => {
    fill(px, T0);
    tallBlades(px);
  });

  // Capa que tapa los pies del entrenador al caminar entre la hierba alta.
  tile(scene, 'tile-tall-over', 5, (px) => {
    fill(px, T0, 22, S);
    tallBlades(px, 22);
    for (let x = 0; x < S; x += 4) px(x, 21, T1);
  });

  tile(scene, 'tile-tree', 9, (px, r) => {
    grass(px, r);
    for (let x = 4; x < 28; x++) for (let y = 27; y < 31; y++) if (((x - 16) / 12) ** 2 + ((y - 29) / 2.5) ** 2 <= 1) px(x, y, G1);   // sombra
    rect(px, 13, 21, 6, 10, TR0); rect(px, 17, 21, 2, 10, TR1);                                                                     // tronco
    disc(px, 16, 13, 13.4, CO);                                                                                                       // contorno de la copa
    disc(px, 16, 13, 12, C1);
    disc(px, 15, 12, 11, C0);
    disc(px, 9, 16, 6, C0); disc(px, 23, 16, 6, C0);
    disc(px, 11, 8, 5, C2);
    for (let i = 0; i < 10; i++) px(8 + r() * 16, 6 + r() * 14, C2);
    for (let i = 0; i < 8; i++) px(8 + r() * 16, 14 + r() * 10, C1);
  });

  for (let f = 0; f < 2; f++)
    tile(scene, `tile-water-${f}`, 21, (px, r) => {
      fill(px, W0);
      for (let i = 0; i < 12; i++) px(r() * S, r() * S, W1);
      for (const [x, y, len] of [[3, 6, 6], [18, 12, 5], [8, 20, 5], [22, 26, 6], [2, 29, 4]] as [number, number, number][])
        for (let i = 0; i < len; i++) px(x + i + (f ? 3 : 0), y, W2);
    });

  tile(scene, 'tile-fence', 13, (px, r) => {
    grass(px, r);
    rect(px, 0, 13, S, 3, F0); rect(px, 0, 14, S, 1, F1);
    rect(px, 0, 21, S, 3, F0); rect(px, 0, 22, S, 1, F1);
    for (const x of [2, 26]) { rect(px, x, 8, 4, 18, F1); rect(px, x, 8, 2, 18, F0); rect(px, x, 8, 4, 1, 0xd9a86a); }
  });

  tile(scene, 'tile-rock', 17, (px, r) => {
    grass(px, r);
    for (let x = 5; x < 29; x++) for (let y = 14; y < 29; y++) if (((x - 17) / 12) ** 2 + ((y - 22) / 7.5) ** 2 <= 1) px(x, y, R0);
    for (let x = 7; x < 24; x++) for (let y = 15; y < 24; y++) if (((x - 14) / 7) ** 2 + ((y - 19) / 4) ** 2 <= 1) px(x, y, R2);
    for (let x = 12; x < 30; x++) for (let y = 22; y < 29; y++) if (((x - 20) / 9) ** 2 + ((y - 25) / 4) ** 2 <= 1) px(x, y, R1);
  });
}
