import Phaser from 'phaser';
import { FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { bus } from '../systems/events';
import { DialogueBox } from '../ui/DialogueBox';

/**
 * UI 疊在 WorldScene 上面跑（scene.launch，兩個場景同時存在）。
 *
 * 分開的理由是鏡頭：WorldScene 的鏡頭 zoom 2、而且會跟著玩家捲動，
 * UI 需要的是固定不動、zoom 1 的座標系。與其對每個 UI 元素設
 * setScrollFactor(0) 再反向縮放，不如讓 UI 自己有一個乾淨的場景。
 */
export class UIScene extends Phaser.Scene {
  private dialogue!: DialogueBox;
  private hintText!: Phaser.GameObjects.Text;

  constructor() {
    super('UIScene');
  }

  create(): void {
    this.dialogue = new DialogueBox(this);

    this.hintText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 40, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '19px',
        color: '#f4f0e8',
        backgroundColor: '#1b2030dd',
        padding: { x: 14, y: 7 },
      })
      .setOrigin(0.5)
      .setDepth(900)
      .setVisible(false);

    this.add
      .text(GAME_WIDTH - 10, 10, '方向鍵／WASD 移動　Shift 跑　空白鍵 互動　F1 除錯　F9 重來', {
        fontFamily: FONT_FAMILY,
        fontSize: '13px',
        color: '#b9c1d4',
        // 底色是必要的：這行字會壓在花花綠綠的地圖上
        backgroundColor: '#15181fcc',
        padding: { x: 10, y: 6 },
      })
      .setOrigin(1, 0)
      .setDepth(900);

    bus.on('dialogue:start', this.handleStart, this);
    bus.on('dialogue:advance', this.handleAdvance, this);
    bus.on('dialogue:move', this.handleMove, this);
    bus.on('hint:show', this.handleHint, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
  }

  override update(_time: number, delta: number): void {
    this.dialogue.update(delta);
  }

  private handleStart(dialogueId: string): void {
    this.dialogue.start(dialogueId);
  }

  private handleAdvance(): void {
    this.dialogue.advance();
  }

  private handleMove(delta: number): void {
    this.dialogue.move(delta);
  }

  private handleHint(text: string | null): void {
    if (!text) {
      this.hintText.setVisible(false);
      return;
    }
    this.hintText.setText(text).setVisible(true);
  }

  private handleShutdown(): void {
    bus.off('dialogue:start', this.handleStart, this);
    bus.off('dialogue:advance', this.handleAdvance, this);
    bus.off('dialogue:move', this.handleMove, this);
    bus.off('hint:show', this.handleHint, this);
  }
}
