import Phaser from 'phaser';
import dialoguesJson from '../data/dialogues.json';
import { FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { bus } from '../systems/events';
import { gameState } from '../systems/state';
import type { DialogueNode } from '../types';

const DIALOGUES = dialoguesJson as unknown as Record<string, DialogueNode>;

/** 打字機速度（字／秒）。中文一個字資訊量大，不要太快。 */
const CHARS_PER_SECOND = 42;

const PANEL = {
  x: 40,
  y: GAME_HEIGHT - 168,
  width: GAME_WIDTH - 80,
  height: 148,
  padding: 26,
};

const COLORS = {
  panelFill: 0x1b2030,
  panelStroke: 0xf4f0e8,
  namePlate: 0x2f3852,
  text: '#f4f0e8',
  dim: '#9aa2b8',
  highlight: '#ffd98a',
};

/**
 * 對話框。同時管狀態（現在播到哪一段、哪一頁、選到哪個選項）與畫面。
 *
 * 刻意不自己讀鍵盤 —— 按鍵一律由 WorldScene 收，再透過 bus 轉進來。
 * 兩個場景各自監聽同一顆按鍵的話，同一幀會被吃兩次。
 */
export class DialogueBox {
  private readonly container: Phaser.GameObjects.Container;
  private readonly nameText: Phaser.GameObjects.Text;
  private readonly namePlate: Phaser.GameObjects.Graphics;
  private readonly bodyText: Phaser.GameObjects.Text;
  private readonly choiceTexts: Phaser.GameObjects.Text[] = [];
  private readonly choiceLabels: string[] = [];
  private readonly nextIndicator: Phaser.GameObjects.Text;

  private node: DialogueNode | null = null;
  private pageIndex = 0;
  private revealedChars = 0;
  private awaitingChoice = false;
  private choiceIndex = 0;

  constructor(private readonly scene: Phaser.Scene) {
    const panel = scene.add.graphics();
    panel.fillStyle(COLORS.panelFill, 0.96);
    panel.fillRoundedRect(PANEL.x, PANEL.y, PANEL.width, PANEL.height, 6);
    panel.lineStyle(2, COLORS.panelStroke, 0.85);
    panel.strokeRoundedRect(PANEL.x, PANEL.y, PANEL.width, PANEL.height, 6);

    this.namePlate = scene.add.graphics();

    this.nameText = scene.add.text(PANEL.x + PANEL.padding, PANEL.y - 20, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '19px',
      color: COLORS.highlight,
    });

    this.bodyText = scene.add.text(PANEL.x + PANEL.padding, PANEL.y + PANEL.padding, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '22px',
      color: COLORS.text,
      lineSpacing: 10,
      // useAdvancedWrap 才會在沒有空白的中文句子裡斷行
      wordWrap: { width: PANEL.width - PANEL.padding * 2, useAdvancedWrap: true },
    });

    this.nextIndicator = scene.add
      .text(PANEL.x + PANEL.width - PANEL.padding, PANEL.y + PANEL.height - 30, '▼', {
        fontFamily: FONT_FAMILY,
        fontSize: '18px',
        color: COLORS.dim,
      })
      .setOrigin(1, 0);

    this.container = scene.add
      .container(0, 0, [panel, this.namePlate, this.nameText, this.bodyText, this.nextIndicator])
      .setDepth(1000)
      .setVisible(false);

    // 讓 ▼ 一閃一閃，玩家才知道可以按下一頁
    scene.tweens.add({
      targets: this.nextIndicator,
      alpha: { from: 1, to: 0.15 },
      duration: 600,
      yoyo: true,
      repeat: -1,
    });
  }

  get isOpen(): boolean {
    return this.node !== null;
  }

  /** 播放某一段對話。找不到 id 時只在 console 抱怨，不讓遊戲整個掛掉。 */
  start(dialogueId: string): void {
    const node = this.resolve(dialogueId);
    if (!node) {
      console.warn(`[dialogue] 找不到對話段落：${dialogueId}`);
      return;
    }

    const wasOpen = this.isOpen;
    this.node = node;
    this.pageIndex = 0;
    this.revealedChars = 0;
    this.awaitingChoice = false;
    this.choiceIndex = 0;

    this.nameText.setText(node.speaker);
    this.drawNamePlate();
    this.bodyText.setText('');
    this.clearChoices();
    this.container.setVisible(true);

    if (!wasOpen) bus.emit('dialogue:open');
  }

  /**
   * 順著 redirectIfFlag 找出真正該播的段落。
   * 設上限是為了萬一資料互指造成無窮迴圈時，能停下來而不是把分頁凍住。
   */
  private resolve(dialogueId: string): DialogueNode | null {
    let id = dialogueId;
    for (let hops = 0; hops < 8; hops++) {
      const node = DIALOGUES[id];
      if (!node) return null;
      const redirect = node.redirectIfFlag;
      if (!redirect || !gameState.hasFlag(redirect.flag)) return node;
      id = redirect.to;
    }
    console.warn(`[dialogue] ${dialogueId} 的 redirectIfFlag 疑似繞圈了`);
    return DIALOGUES[id] ?? null;
  }

  /** 每幀推進打字機。 */
  update(delta: number): void {
    if (!this.node) return;

    const page = this.node.pages[this.pageIndex] ?? '';
    if (this.revealedChars < page.length) {
      this.revealedChars = Math.min(page.length, this.revealedChars + (CHARS_PER_SECOND * delta) / 1000);
      this.bodyText.setText(page.slice(0, Math.floor(this.revealedChars)));
    }

    const pageDone = this.revealedChars >= page.length;
    const lastPage = this.pageIndex >= this.node.pages.length - 1;

    // 最後一頁講完就把選項攤出來
    if (pageDone && lastPage && this.node.choices && !this.awaitingChoice) {
      this.showChoices(this.node.choices);
    }

    this.nextIndicator.setVisible(pageDone && !this.awaitingChoice);
  }

  /** 互動鍵：先補完文字，再翻頁，最後才是結束或確認選項。 */
  advance(): void {
    if (!this.node) return;

    const page = this.node.pages[this.pageIndex] ?? '';
    if (this.revealedChars < page.length) {
      this.revealedChars = page.length;
      this.bodyText.setText(page);
      return;
    }

    if (this.awaitingChoice) {
      this.confirmChoice();
      return;
    }

    if (this.pageIndex < this.node.pages.length - 1) {
      this.pageIndex += 1;
      this.revealedChars = 0;
      this.bodyText.setText('');
      return;
    }

    this.finishNode();
  }

  /** 在選項之間上下移動。 */
  move(delta: number): void {
    if (!this.awaitingChoice || this.choiceTexts.length === 0) return;
    const count = this.choiceTexts.length;
    this.choiceIndex = (this.choiceIndex + delta + count) % count;
    this.paintChoices();
  }

  private finishNode(): void {
    const node = this.node;
    if (!node) return;
    if (node.setFlag) gameState.setFlag(node.setFlag);

    if (node.next) {
      this.start(node.next);
      return;
    }
    this.close();
  }

  private confirmChoice(): void {
    const node = this.node;
    const choice = node?.choices?.[this.choiceIndex];
    if (!node || !choice) return;

    if (node.setFlag) gameState.setFlag(node.setFlag);
    if (choice.setFlag) gameState.setFlag(choice.setFlag);

    this.clearChoices();
    if (choice.next) this.start(choice.next);
    else this.close();
  }

  private showChoices(choices: DialogueNode['choices'] = []): void {
    this.awaitingChoice = true;
    this.choiceIndex = 0;

    // 選項貼著對話框右下角排，不會蓋到正文
    const right = PANEL.x + PANEL.width - PANEL.padding;
    const bottom = PANEL.y + PANEL.height - PANEL.padding;
    choices.forEach((choice, index) => {
      const y = bottom - (choices.length - index) * 30;
      const text = this.scene.add
        .text(right, y, choice.label, {
          fontFamily: FONT_FAMILY,
          fontSize: '20px',
          color: COLORS.dim,
        })
        .setOrigin(1, 0);
      this.choiceTexts.push(text);
      this.choiceLabels.push(choice.label);
      this.container.add(text);
    });
    this.paintChoices();
  }

  private paintChoices(): void {
    this.choiceTexts.forEach((text, index) => {
      const selected = index === this.choiceIndex;
      const label = this.choiceLabels[index] ?? '';
      text.setColor(selected ? COLORS.highlight : COLORS.dim);
      text.setText(selected ? `▶ ${label}` : `　${label}`);
    });
  }

  private clearChoices(): void {
    for (const text of this.choiceTexts) text.destroy();
    this.choiceTexts.length = 0;
    this.choiceLabels.length = 0;
    this.awaitingChoice = false;
  }

  private drawNamePlate(): void {
    this.namePlate.clear();
    const width = this.nameText.width + 24;
    this.namePlate.fillStyle(COLORS.namePlate, 0.96);
    this.namePlate.fillRoundedRect(PANEL.x + PANEL.padding - 12, PANEL.y - 26, width, 30, 4);
    this.namePlate.lineStyle(2, COLORS.panelStroke, 0.85);
    this.namePlate.strokeRoundedRect(PANEL.x + PANEL.padding - 12, PANEL.y - 26, width, 30, 4);
  }

  private close(): void {
    this.node = null;
    this.clearChoices();
    this.container.setVisible(false);
    bus.emit('dialogue:close');
  }
}
