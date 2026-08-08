// 產生角色圖集：16x24 的 frame，4 欄（走路循環）x 4 列（下/左/右/上）。
//
// frame index 的排法是 row-major，所以：
//   下 = 0..3、左 = 4..7、右 = 8..11、上 = 12..15
// 這是最常見的 RPG 角色圖排法，換成 itch.io 上的素材包時通常可以直接對上。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Canvas } from './png.mjs';

export const FRAME_WIDTH = 16;
export const FRAME_HEIGHT = 24;
export const DIRECTIONS = ['down', 'left', 'right', 'up'];

const PALETTES = {
  hero: {
    hair: [58, 44, 38],
    hairLight: [82, 62, 52],
    skin: [232, 186, 148],
    skinShade: [204, 158, 122],
    shirt: [72, 108, 168],
    shirtShade: [56, 84, 133],
    pants: [66, 62, 84],
    shoes: [48, 40, 44],
    eye: [30, 26, 32],
  },
  elder: {
    hair: [216, 212, 200],
    hairLight: [238, 236, 228],
    skin: [222, 178, 142],
    skinShade: [194, 150, 116],
    shirt: [118, 92, 140],
    shirtShade: [94, 72, 112],
    pants: [70, 58, 82],
    shoes: [52, 44, 48],
    eye: [30, 26, 32],
  },
  merchant: {
    hair: [122, 74, 44],
    hairLight: [150, 96, 58],
    skin: [214, 166, 128],
    skinShade: [186, 140, 106],
    shirt: [176, 98, 66],
    shirtShade: [146, 78, 52],
    pants: [88, 74, 56],
    shoes: [58, 46, 40],
    eye: [30, 26, 32],
  },
};

const SHADOW = [16, 18, 26, 80];
const SHADOW_SOFT = [16, 18, 26, 45];

/**
 * 畫一個 frame。side=true 時畫的是「面向右」的側面，
 * 左邊的四格再由呼叫端水平鏡射，省一半工。
 */
function drawFrame(c, ox, oy, p, facing, step) {
  // step 0/2 是站立，1 和 3 是左右腳各跨一步
  const phase = [0, 1, 0, -1][step];
  const side = facing === 'left' || facing === 'right';

  // 腳下的影子先畫，才會被身體蓋住
  for (let x = 4; x < 12; x++) c.set(ox + x, oy + 22, x < 5 || x > 9 ? SHADOW_SOFT : SHADOW);
  for (let x = 6; x < 10; x++) c.set(ox + x, oy + 23, SHADOW_SOFT);

  if (side) {
    // ---- 側面 ----
    c.rect(ox + 4, oy + 2, 8, 8, p.hair); // 整顆頭先鋪頭髮
    c.rect(ox + 4, oy + 2, 8, 1, p.hairLight);
    c.rect(ox + 8, oy + 6, 4, 4, p.skin); // 前半邊露出臉
    c.set(ox + 10, oy + 7, p.eye);
    c.rect(ox + 11, oy + 9, 1, 1, p.skinShade); // 下巴

    c.rect(ox + 5, oy + 10, 6, 6, p.shirt);
    c.rect(ox + 5, oy + 10, 6, 1, p.shirtShade);

    // 手臂前後擺動
    const armX = 7 + phase;
    c.rect(ox + armX, oy + 11, 2, 4, p.shirtShade);
    c.rect(ox + armX, oy + 15, 2, 1, p.skin);

    c.rect(ox + 5, oy + 16, 6, 2, p.pants);
    // 兩腿一前一後
    c.rect(ox + 5 - Math.min(phase, 0), oy + 18, 3, 3, p.pants);
    c.rect(ox + 8 + Math.max(phase, 0), oy + 18, 3, 3, p.pants);
    c.rect(ox + 5 - Math.min(phase, 0), oy + 21, 3, 1, p.shoes);
    c.rect(ox + 8 + Math.max(phase, 0), oy + 21, 3, 1, p.shoes);
    return;
  }

  // ---- 正面 / 背面 ----
  const front = facing === 'down';
  c.rect(ox + 4, oy + 2, 8, front ? 4 : 8, p.hair);
  c.rect(ox + 4, oy + 2, 8, 1, p.hairLight);
  c.rect(ox + 3, oy + 3, 1, 5, p.hair); // 兩側鬢角
  c.rect(ox + 12, oy + 3, 1, 5, p.hair);

  if (front) {
    c.rect(ox + 4, oy + 6, 8, 4, p.skin);
    c.rect(ox + 4, oy + 9, 8, 1, p.skinShade);
    c.set(ox + 6, oy + 7, p.eye);
    c.set(ox + 9, oy + 7, p.eye);
  }

  c.rect(ox + 4, oy + 10, 8, 6, p.shirt);
  c.rect(ox + 4, oy + 10, 8, 1, p.shirtShade);

  // 手臂：走路時一邊上一邊下
  c.rect(ox + 3, oy + 11 + phase, 1, 4, p.shirtShade);
  c.rect(ox + 12, oy + 11 - phase, 1, 4, p.shirtShade);
  c.set(ox + 3, oy + 15 + phase, p.skin);
  c.set(ox + 12, oy + 15 - phase, p.skin);

  c.rect(ox + 4, oy + 16, 8, 2, p.pants);
  // 前腳踩滿、後腳縮一格，做出踏步感
  const leftLen = phase > 0 ? 4 : 3;
  const rightLen = phase < 0 ? 4 : 3;
  c.rect(ox + 5, oy + 18, 3, leftLen, p.pants);
  c.rect(ox + 8, oy + 18, 3, rightLen, p.pants);
  c.rect(ox + 5, oy + 18 + leftLen - 1, 3, 1, p.shoes);
  c.rect(ox + 8, oy + 18 + rightLen - 1, 3, 1, p.shoes);
}

/** 把 src frame 水平鏡射到 dst frame。 */
function mirrorFrame(c, srcX, srcY, dstX, dstY) {
  for (let y = 0; y < FRAME_HEIGHT; y++) {
    for (let x = 0; x < FRAME_WIDTH; x++) {
      const i = ((srcY + y) * c.width + (srcX + x)) * 4;
      const px = [c.data[i], c.data[i + 1], c.data[i + 2], c.data[i + 3]];
      if (px[3] === 0) continue;
      c.set(dstX + (FRAME_WIDTH - 1 - x), dstY + y, px);
    }
  }
}

export function buildCharacter(paletteName) {
  const p = PALETTES[paletteName];
  const canvas = new Canvas(FRAME_WIDTH * 4, FRAME_HEIGHT * DIRECTIONS.length);

  DIRECTIONS.forEach((facing, row) => {
    if (facing === 'left') return; // 等右列畫完再鏡射
    for (let step = 0; step < 4; step++) {
      drawFrame(canvas, step * FRAME_WIDTH, row * FRAME_HEIGHT, p, facing, step);
    }
  });

  const rightRow = DIRECTIONS.indexOf('right') * FRAME_HEIGHT;
  const leftRow = DIRECTIONS.indexOf('left') * FRAME_HEIGHT;
  for (let step = 0; step < 4; step++) {
    mirrorFrame(canvas, step * FRAME_WIDTH, rightRow, step * FRAME_WIDTH, leftRow);
  }

  return canvas;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const dir = path.join(root, 'public/assets/characters');
  fs.mkdirSync(dir, { recursive: true });
  for (const name of Object.keys(PALETTES)) {
    const file = path.join(dir, `${name}.png`);
    fs.writeFileSync(file, buildCharacter(name).toPNG());
    console.log(`寫入 ${path.relative(root, file)}`);
  }
}
