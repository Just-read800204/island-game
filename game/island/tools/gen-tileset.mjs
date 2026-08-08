// 產生 public/assets/tilesets/terrain.png（16px tile，8 欄 x 2 列 = 16 個 tile）。
// 這是「能跑就好」的佔位素材：先把玩法做出來，之後換成真的素材包時，
// 只要保持相同的 tile 順序，地圖就完全不用改。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Canvas, makeRng } from './png.mjs';

export const TILE = 16;
export const COLUMNS = 8;

/**
 * tile 在圖集裡的順序。索引就是 tileset 的 local id，
 * Tiled 地圖裡的 gid = 這個 index + 1（firstgid 為 1）。
 */
export const TILES = [
  { name: 'grass' },
  { name: 'grass_flowers' },
  { name: 'dirt' },
  { name: 'sand' },
  { name: 'water', collides: true },
  { name: 'water_deep', collides: true },
  { name: 'stone_wall', collides: true },
  { name: 'cobble' },
  { name: 'wood_floor' },
  { name: 'tree_trunk', collides: true },
  { name: 'tree_canopy' },
  { name: 'bush', collides: true },
  { name: 'rock', collides: true },
  { name: 'fence', collides: true },
  { name: 'sign', collides: true },
  { name: 'empty' },
];

const C = {
  grass: [74, 122, 58],
  grassDark: [63, 107, 50],
  grassLight: [90, 140, 68],
  flowerA: [214, 196, 96],
  flowerB: [198, 106, 122],
  dirt: [122, 90, 58],
  dirtDark: [104, 76, 48],
  sand: [216, 194, 138],
  sandDark: [201, 176, 120],
  water: [47, 90, 143],
  waterLight: [63, 116, 176],
  waterDeep: [35, 71, 112],
  stone: [107, 107, 120],
  stoneDark: [78, 78, 89],
  stoneLight: [138, 138, 150],
  wood: [138, 106, 68],
  woodDark: [111, 84, 54],
  bark: [90, 63, 40],
  barkDark: [74, 51, 32],
  leaf: [47, 94, 44],
  leafLight: [63, 122, 58],
  leafDark: [36, 74, 34],
};

/** 在整格上鋪底色，再灑上固定的雜訊點，避免大片死板的純色。 */
function speckle(c, ox, oy, base, specks, rng, density = 0.22) {
  c.rect(ox, oy, TILE, TILE, base);
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      if (rng() < density) c.set(ox + x, oy + y, specks[(rng() * specks.length) | 0]);
    }
  }
}

/** 用圓形遮罩畫一團東西（樹冠、灌木、石頭都靠這個）。 */
function blob(c, ox, oy, cx, cy, radius, color) {
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const dx = x - cx;
      const dy = (y - cy) * 1.15;
      if (dx * dx + dy * dy <= radius * radius) c.set(ox + x, oy + y, color);
    }
  }
}

const painters = {
  grass: (c, ox, oy, rng) => speckle(c, ox, oy, C.grass, [C.grassDark, C.grassLight], rng),

  grass_flowers: (c, ox, oy, rng) => {
    speckle(c, ox, oy, C.grass, [C.grassDark, C.grassLight], rng);
    for (let i = 0; i < 5; i++) {
      const x = 2 + ((rng() * 12) | 0);
      const y = 2 + ((rng() * 12) | 0);
      c.set(ox + x, oy + y, rng() < 0.5 ? C.flowerA : C.flowerB);
    }
  },

  dirt: (c, ox, oy, rng) => speckle(c, ox, oy, C.dirt, [C.dirtDark], rng, 0.3),

  sand: (c, ox, oy, rng) => speckle(c, ox, oy, C.sand, [C.sandDark], rng, 0.25),

  water: (c, ox, oy, rng) => {
    speckle(c, ox, oy, C.water, [C.waterDeep], rng, 0.15);
    // 兩道錯開的波紋，讓水面有方向感
    for (const [wy, wx] of [[4, 2], [11, 8]]) {
      for (let i = 0; i < 6; i++) c.set(ox + wx + i, oy + wy, C.waterLight);
    }
  },

  water_deep: (c, ox, oy, rng) => speckle(c, ox, oy, C.waterDeep, [C.water], rng, 0.12),

  stone_wall: (c, ox, oy) => {
    c.rect(ox, oy, TILE, TILE, C.stone);
    // 上下兩排交錯的磚，接縫用暗色、頂緣用亮色做出厚度
    for (let x = 0; x < TILE; x++) {
      c.set(ox + x, oy, C.stoneLight);
      c.set(ox + x, oy + 7, C.stoneDark);
      c.set(ox + x, oy + 15, C.stoneDark);
    }
    for (let y = 1; y < 7; y++) c.set(ox + 8, oy + y, C.stoneDark);
    for (let y = 8; y < 15; y++) {
      c.set(ox + 3, oy + y, C.stoneDark);
      c.set(ox + 12, oy + y, C.stoneDark);
    }
  },

  cobble: (c, ox, oy) => {
    c.rect(ox, oy, TILE, TILE, C.dirtDark); // 石縫用泥土色，石塊才跳得出來
    // 兩排交錯的圓角石塊
    for (const [sx, sy] of [[1, 1], [8, 1], [4, 6], [11, 6], [1, 11], [8, 11]]) {
      c.rect(ox + sx + 1, oy + sy, 4, 4, C.stone);
      c.rect(ox + sx, oy + sy + 1, 6, 2, C.stone);
      c.rect(ox + sx + 1, oy + sy, 4, 1, C.stoneLight);
    }
  },

  wood_floor: (c, ox, oy) => {
    c.rect(ox, oy, TILE, TILE, C.wood);
    for (let x = 0; x < TILE; x++) {
      c.set(ox + x, oy + 5, C.woodDark);
      c.set(ox + x, oy + 11, C.woodDark);
    }
    for (const [x, y] of [[6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [11, 6], [11, 7], [11, 8], [11, 9], [11, 10]]) {
      c.set(ox + x, oy + y, C.woodDark);
    }
  },

  tree_trunk: (c, ox, oy, rng) => {
    speckle(c, ox, oy, C.grass, [C.grassDark], rng, 0.15);
    c.rect(ox + 6, oy, 5, TILE, C.bark);
    for (let y = 0; y < TILE; y++) c.set(ox + 6, oy + y, C.barkDark);
    c.rect(ox + 4, oy + 13, 9, 3, C.barkDark); // 根部往外撐開
  },

  tree_canopy: (c, ox, oy, rng) => {
    blob(c, ox, oy, 8, 9, 8.5, C.leafDark);
    blob(c, ox, oy, 8, 8, 7.5, C.leaf);
    blob(c, ox, oy, 6, 6, 4, C.leafLight);
    for (let i = 0; i < 18; i++) {
      const x = (rng() * TILE) | 0;
      const y = (rng() * TILE) | 0;
      const dx = x - 8;
      const dy = (y - 8) * 1.15;
      if (dx * dx + dy * dy <= 56) c.set(ox + x, oy + y, rng() < 0.5 ? C.leafDark : C.leafLight);
    }
  },

  bush: (c, ox, oy, rng) => {
    speckle(c, ox, oy, C.grass, [C.grassDark], rng, 0.15);
    blob(c, ox, oy, 8, 10, 6.5, C.leafDark);
    blob(c, ox, oy, 8, 9, 5.5, C.leaf);
    blob(c, ox, oy, 6, 7, 2.5, C.leafLight);
  },

  rock: (c, ox, oy, rng) => {
    speckle(c, ox, oy, C.grass, [C.grassDark], rng, 0.15);
    blob(c, ox, oy, 8, 10, 6, C.stoneDark);
    blob(c, ox, oy, 8, 10, 5, C.stone);
    blob(c, ox, oy, 6, 8, 2, C.stoneLight);
  },

  fence: (c, ox, oy) => {
    c.rect(ox, oy + 4, TILE, 2, C.wood);
    c.rect(ox, oy + 9, TILE, 2, C.wood);
    c.rect(ox + 2, oy + 1, 3, 14, C.woodDark);
    c.rect(ox + 11, oy + 1, 3, 14, C.woodDark);
  },

  sign: (c, ox, oy, rng) => {
    speckle(c, ox, oy, C.grass, [C.grassDark], rng, 0.15);
    c.rect(ox + 7, oy + 8, 2, 8, C.woodDark);
    c.rect(ox + 2, oy + 2, 12, 7, C.wood);
    c.rect(ox + 2, oy + 2, 12, 1, C.woodDark);
    for (let i = 0; i < 8; i++) {
      c.set(ox + 4 + i, oy + 5, C.woodDark);
      if (i < 5) c.set(ox + 4 + i, oy + 7, C.woodDark);
    }
  },

  empty: () => {},
};

export function buildTileset() {
  const rows = Math.ceil(TILES.length / COLUMNS);
  const canvas = new Canvas(COLUMNS * TILE, rows * TILE);
  TILES.forEach((tile, index) => {
    // 每個 tile 自己的種子，改動其中一個不會連帶改變其他 tile 的雜訊
    const rng = makeRng(0x9e3779b9 + index * 2654435761);
    const ox = (index % COLUMNS) * TILE;
    const oy = ((index / COLUMNS) | 0) * TILE;
    painters[tile.name](canvas, ox, oy, rng);
  });
  return canvas;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const out = path.join(root, 'public/assets/tilesets/terrain.png');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, buildTileset().toPNG());
  console.log(`寫入 ${path.relative(root, out)}（${TILES.length} 個 tile）`);
}
