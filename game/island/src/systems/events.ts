import Phaser from 'phaser';

/**
 * 場景之間唯一的溝通管道。
 *
 * WorldScene 不去抓 UIScene 的物件、UIScene 也不去抓玩家 —— 兩邊都只丟事件。
 * 遊戲一長大，這個界線會救你很多次。
 */
export interface GameEventMap {
  /** 請 UI 開始播某段對話。 */
  'dialogue:start': [dialogueId: string];
  /** 對話框真的開了 / 關了。WorldScene 靠這個決定要不要鎖住玩家。 */
  'dialogue:open': [];
  'dialogue:close': [];
  /** 對話開啟中，把玩家的按鍵轉給對話框。 */
  'dialogue:advance': [];
  'dialogue:move': [delta: number];
  /** 顯示 / 收起畫面下方的「空白鍵 互動」提示。null 代表收起。 */
  'hint:show': [text: string | null];
  /** 有旗標被設定，存檔系統與任何關心劇情進度的東西都可以聽。 */
  'flag:set': [flag: string];
}

type Handler<K extends keyof GameEventMap> = (...args: GameEventMap[K]) => void;

/** 在 Phaser 的 EventEmitter 外面包一層型別，打錯事件名稱會直接編譯失敗。 */
class TypedEventBus {
  private readonly emitter = new Phaser.Events.EventEmitter();

  on<K extends keyof GameEventMap & string>(event: K, handler: Handler<K>, context?: unknown): this {
    this.emitter.on(event, handler as (...args: unknown[]) => void, context);
    return this;
  }

  off<K extends keyof GameEventMap & string>(event: K, handler?: Handler<K>, context?: unknown): this {
    this.emitter.off(event, handler as (...args: unknown[]) => void, context);
    return this;
  }

  emit<K extends keyof GameEventMap & string>(event: K, ...args: GameEventMap[K]): this {
    this.emitter.emit(event, ...args);
    return this;
  }
}

export const bus = new TypedEventBus();
