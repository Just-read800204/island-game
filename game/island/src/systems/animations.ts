import type Phaser from 'phaser';
import { DIRECTIONS, type Direction } from '../types';

/**
 * 角色圖集是 4 欄 x 4 列、row-major 排列，所以：
 *   下 = 0..3、左 = 4..7、右 = 8..11、上 = 12..15
 * 換成別人做的素材包時，通常只要改這張表就能對上。
 */
const ROW_OF: Record<Direction, number> = { down: 0, left: 1, right: 2, up: 3 };
const FRAMES_PER_ROW = 4;

export const idleFrame = (facing: Direction): number => ROW_OF[facing] * FRAMES_PER_ROW;

export const walkAnimKey = (textureKey: string, facing: Direction): string =>
  `${textureKey}-walk-${facing}`;

/**
 * 幫一張角色圖集註冊四個方向的走路動畫。
 * Phaser 的動畫是全域的，同一張圖只要註冊一次，所以這裡會先檢查存在與否。
 */
export function registerCharacterAnimations(scene: Phaser.Scene, textureKey: string): void {
  for (const facing of DIRECTIONS) {
    const key = walkAnimKey(textureKey, facing);
    if (scene.anims.exists(key)) continue;

    const start = ROW_OF[facing] * FRAMES_PER_ROW;
    scene.anims.create({
      key,
      frames: scene.anims.generateFrameNumbers(textureKey, {
        start,
        end: start + FRAMES_PER_ROW - 1,
      }),
      frameRate: 8,
      repeat: -1,
    });
  }
}
