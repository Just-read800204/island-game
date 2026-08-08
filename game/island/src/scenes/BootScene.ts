import Phaser from 'phaser';
import { FONT_FAMILY, FRAME_HEIGHT, FRAME_WIDTH, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { gameState } from '../systems/state';

/**
 * 載入畫面。所有資源集中在這裡讀，之後的場景就能假設東西都在了。
 *
 * 專案變大之後，比較好的做法是每個場景只 preload 自己要的東西
 * （像原作那樣先 exists() 檢查再 load），但在資源還不多的時候，
 * 一次載完最省事也最不會出錯。
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    const barWidth = 360;
    const barX = (GAME_WIDTH - barWidth) / 2;
    const barY = GAME_HEIGHT / 2;

    const label = this.add
      .text(GAME_WIDTH / 2, barY - 34, '載入中…', {
        fontFamily: FONT_FAMILY,
        fontSize: '20px',
        color: '#f4f0e8',
      })
      .setOrigin(0.5);

    const bar = this.add.graphics();
    this.load.on(Phaser.Loader.Events.PROGRESS, (value: number) => {
      bar.clear();
      bar.lineStyle(2, 0xf4f0e8, 0.6);
      bar.strokeRect(barX, barY, barWidth, 12);
      bar.fillStyle(0xf4f0e8, 0.9);
      bar.fillRect(barX + 2, barY + 2, (barWidth - 4) * value, 8);
    });
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      bar.destroy();
      label.destroy();
    });

    this.load.image('terrain', 'assets/tilesets/terrain.png');
    this.load.tilemapTiledJSON('island', 'assets/maps/island.tmj');

    for (const key of ['hero', 'elder', 'merchant']) {
      this.load.spritesheet(key, `assets/characters/${key}.png`, {
        frameWidth: FRAME_WIDTH,
        frameHeight: FRAME_HEIGHT,
      });
    }
  }

  create(): void {
    gameState.load();
    this.scene.start('WorldScene');
  }
}
