// 產生 public/assets/maps/island.tmj —— 一張真正的 Tiled 地圖檔。
//
// 產生出來的檔案可以直接用 Tiled（mapeditor.org）打開繼續手改；
// 改完存檔即可，不需要再跑這支腳本。這支只是給你一個「不是空白」的起點。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeRng } from './png.mjs';
import { TILE, COLUMNS, TILES } from './gen-tileset.mjs';

const WIDTH = 60;
const HEIGHT = 40;

/** 名稱 -> gid。Tiled 的 gid 從 1 開始，0 代表這格是空的。 */
const GID = Object.fromEntries(TILES.map((t, i) => [t.name, i + 1]));

const rng = makeRng(20260808);

function createLayerData() {
  return new Array(WIDTH * HEIGHT).fill(0);
}

const at = (x, y) => y * WIDTH + x;
const inBounds = (x, y) => x >= 0 && y >= 0 && x < WIDTH && y < HEIGHT;

const ground = createLayerData();
const decor = createLayerData();
const above = createLayerData();

// ---------------------------------------------------------------- 島的輪廓
// 橢圓 + 每個角度一點固定偏移，邊緣就不會是完美的幾何形狀。
const cx = WIDTH / 2;
const cy = HEIGHT / 2;
const wobble = Array.from({ length: 64 }, () => 0.86 + rng() * 0.28);

function shoreDistance(x, y) {
  const dx = (x + 0.5 - cx) / (WIDTH * 0.42);
  const dy = (y + 0.5 - cy) / (HEIGHT * 0.42);
  const angle = Math.atan2(dy, dx);
  const bucket = Math.floor(((angle + Math.PI) / (Math.PI * 2)) * wobble.length) % wobble.length;
  return Math.sqrt(dx * dx + dy * dy) / wobble[bucket];
}

for (let y = 0; y < HEIGHT; y++) {
  for (let x = 0; x < WIDTH; x++) {
    const d = shoreDistance(x, y);
    let gid;
    if (d > 1.18) gid = GID.water_deep;
    else if (d > 1.0) gid = GID.water;
    else if (d > 0.86) gid = GID.sand;
    else gid = rng() < 0.12 ? GID.grass_flowers : GID.grass;
    ground[at(x, y)] = gid;
  }
}

const isGrass = (x, y) =>
  inBounds(x, y) && (ground[at(x, y)] === GID.grass || ground[at(x, y)] === GID.grass_flowers);

// ---------------------------------------------------------------- 石屋
const HUT = { x: 25, y: 10, w: 9, h: 6, doorX: 29 };
for (let y = HUT.y; y < HUT.y + HUT.h; y++) {
  for (let x = HUT.x; x < HUT.x + HUT.w; x++) {
    const onWall = x === HUT.x || x === HUT.x + HUT.w - 1 || y === HUT.y || y === HUT.y + HUT.h - 1;
    ground[at(x, y)] = GID.wood_floor;
    // 門口那格留空，不然玩家進不去
    if (onWall && !(y === HUT.y + HUT.h - 1 && x === HUT.doorX)) decor[at(x, y)] = GID.stone_wall;
  }
}

// 從門口往南鋪一條石板路到沙灘
for (let y = HUT.y + HUT.h; y < 30; y++) {
  ground[at(HUT.doorX, y)] = GID.cobble;
  if (y % 2 === 0) ground[at(HUT.doorX + 1, y)] = GID.cobble;
  else ground[at(HUT.doorX - 1, y)] = GID.cobble;
}

const occupied = new Set();
for (let y = HUT.y - 1; y < HUT.y + HUT.h + 1; y++) {
  for (let x = HUT.x - 1; x < HUT.x + HUT.w + 1; x++) occupied.add(at(x, y));
}
for (let y = 0; y < HEIGHT; y++) {
  for (let x = 0; x < WIDTH; x++) {
    if (ground[at(x, y)] === GID.cobble) {
      occupied.add(at(x, y));
      occupied.add(at(x - 1, y));
      occupied.add(at(x + 1, y));
    }
  }
}

// ---------------------------------------------------------------- 植被
// 樹是兩格：樹幹在 decor（會擋路），樹冠在 above（蓋在玩家頭上）。
function plantTree(x, y) {
  if (!isGrass(x, y) || occupied.has(at(x, y)) || !inBounds(x, y - 1)) return false;
  decor[at(x, y)] = GID.tree_trunk;
  above[at(x, y - 1)] = GID.tree_canopy;
  occupied.add(at(x, y));
  occupied.add(at(x, y - 1));
  return true;
}

let planted = 0;
for (let attempt = 0; attempt < 900 && planted < 110; attempt++) {
  if (plantTree((rng() * WIDTH) | 0, (rng() * HEIGHT) | 0)) planted++;
}

for (let attempt = 0; attempt < 400; attempt++) {
  const x = (rng() * WIDTH) | 0;
  const y = (rng() * HEIGHT) | 0;
  if (!isGrass(x, y) || occupied.has(at(x, y))) continue;
  decor[at(x, y)] = rng() < 0.62 ? GID.bush : GID.rock;
  occupied.add(at(x, y));
}

// 屋子門口兩側各立一段圍籬，順便當作「碰撞是資料驅動的」示範
for (const x of [HUT.doorX - 3, HUT.doorX - 2, HUT.doorX + 2, HUT.doorX + 3]) {
  const y = HUT.y + HUT.h;
  if (decor[at(x, y)] === 0 && ground[at(x, y)] !== GID.cobble) decor[at(x, y)] = GID.fence;
}
decor[at(HUT.doorX + 2, HUT.y + HUT.h + 3)] = GID.sign;

// ---------------------------------------------------------------- 物件層
// 只放「這裡有東西」的標記，實際長相與對話寫在 src/data/npcs.json。
let nextObjectId = 1;
const point = (name, type, tileX, tileY, properties) => ({
  id: nextObjectId++,
  name,
  type,
  point: true,
  rotation: 0,
  visible: true,
  width: 0,
  height: 0,
  x: tileX * TILE + TILE / 2,
  y: tileY * TILE + TILE / 2,
  ...(properties ? { properties } : {}),
});

const prop = (name, value, type = 'string') => ({ name, type, value });

const objects = [
  point('player_spawn', 'spawn', HUT.doorX, HUT.y + HUT.h + 2),
  point('elder', 'npc', HUT.x + 2, HUT.y + 2, [prop('npcId', 'elder')]),
  point('merchant', 'npc', HUT.doorX - 4, HUT.y + HUT.h + 6, [prop('npcId', 'merchant')]),
  point('signpost', 'interactable', HUT.doorX + 2, HUT.y + HUT.h + 3, [
    prop('dialogueId', 'signpost'),
  ]),
];

// ---------------------------------------------------------------- 輸出
const tileLayer = (id, name, data) => ({
  data,
  height: HEIGHT,
  id,
  name,
  opacity: 1,
  type: 'tilelayer',
  visible: true,
  width: WIDTH,
  x: 0,
  y: 0,
});

const map = {
  compressionlevel: -1,
  height: HEIGHT,
  infinite: false,
  layers: [
    tileLayer(1, 'ground', ground),
    tileLayer(2, 'decor', decor),
    tileLayer(3, 'above', above),
    {
      draworder: 'topdown',
      id: 4,
      name: 'objects',
      objects,
      opacity: 1,
      type: 'objectgroup',
      visible: true,
      x: 0,
      y: 0,
    },
  ],
  nextlayerid: 5,
  nextobjectid: nextObjectId,
  orientation: 'orthogonal',
  renderorder: 'right-down',
  tiledversion: '1.10.2',
  tileheight: TILE,
  tilesets: [
    {
      columns: COLUMNS,
      firstgid: 1,
      image: '../tilesets/terrain.png',
      imageheight: Math.ceil(TILES.length / COLUMNS) * TILE,
      imagewidth: COLUMNS * TILE,
      margin: 0,
      name: 'terrain',
      spacing: 0,
      tilecount: TILES.length,
      tileheight: TILE,
      tilewidth: TILE,
      // 碰撞寫在 tileset 的 tile property 上，程式端用
      // map.setCollisionByProperty({ collides: true }) 一行套用。
      tiles: TILES.map((tile, id) => (tile.collides ? { id, properties: [prop('collides', true, 'bool')] } : null))
        .filter(Boolean),
    },
  ],
  tilewidth: TILE,
  type: 'map',
  version: '1.10',
  width: WIDTH,
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'public/assets/maps/island.tmj');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(map));
console.log(`寫入 ${path.relative(root, out)}（${WIDTH}x${HEIGHT} tiles，${planted} 棵樹）`);
