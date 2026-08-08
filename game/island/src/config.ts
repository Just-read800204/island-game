/**
 * 全域常數。想調手感先來這裡改。
 */

// canvas 的內部解析度。用 960x540 而不是 480x270，是為了讓中文字有足夠的像素可以畫。
// 世界本身則靠 CAMERA_ZOOM 放大，所以視野等同 480x270 的低解析度畫面。
// 兩者兼顧：地圖是像素風，UI 文字卻是清楚的。
export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;

export const TILE_SIZE = 16;
export const CAMERA_ZOOM = 2;

/** 角色圖集的單格尺寸。 */
export const FRAME_WIDTH = 16;
export const FRAME_HEIGHT = 24;

/**
 * 碰撞盒只取腳下一小塊，而不是整張圖。
 * 這是俯視角遊戲的關鍵手感 —— 頭可以疊在樹叢前面，腳才會被擋住。
 */
export const BODY_WIDTH = 10;
export const BODY_HEIGHT = 8;

export const WALK_SPEED = 72;
export const RUN_SPEED = 132;

/** 按互動鍵時，往面向方向前方多遠的位置去找可互動物。 */
export const INTERACT_REACH = 16;
export const INTERACT_RADIUS = 18;

/**
 * 繪製層級。角色的 depth 是 CHARACTER_BASE + y，
 * 這樣站在下面的角色會蓋住站在上面的，形成正確的前後關係。
 */
export const DEPTH = {
  ground: 0,
  decor: 1,
  characterBase: 100,
  above: 100000,
} as const;

export const SAVE_KEY = 'island-pixel-starter/save/v1';

export const FONT_FAMILY =
  'system-ui, -apple-system, "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif';
