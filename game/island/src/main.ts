import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './config';
import { BootScene } from './scenes/BootScene';
import { UIScene } from './scenes/UIScene';
import { WorldScene } from './scenes/WorldScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#15181f',

  // pixelArt 會把貼圖過濾器設成 NEAREST，放大時才不會糊成一團
  pixelArt: true,
  // 讓繪製座標對齊整數像素，避免捲動時貼圖邊緣抖動
  roundPixels: true,

  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },

  physics: {
    default: 'arcade',
    arcade: {
      // 俯視角沒有重力
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },

  scene: [BootScene, WorldScene, UIScene],
};

const game = new Phaser.Game(config);

// 開發時把 game 掛到 window，方便在 devtools 直接戳場景：
//   game.scene.getScene('WorldScene')
// 這段在 production build 會被整段搖掉，不會進正式包。
if (import.meta.env.DEV) {
  (window as unknown as { game: Phaser.Game }).game = game;
}
