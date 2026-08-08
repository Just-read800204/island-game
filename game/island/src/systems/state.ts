import { SAVE_KEY } from '../config';
import type { Direction } from '../types';
import { bus } from './events';

interface SaveData {
  version: 1;
  player: { x: number; y: number; facing: Direction };
  flags: string[];
}

/**
 * 整個遊戲的存檔狀態。刻意做得很薄：
 * 只有「玩家在哪」跟「哪些旗標被設過」。劇情分支全部靠旗標表達。
 */
class GameState {
  readonly flags = new Set<string>();
  player: { x: number; y: number; facing: Direction } | null = null;

  hasFlag(flag: string): boolean {
    return this.flags.has(flag);
  }

  setFlag(flag: string): void {
    if (this.flags.has(flag)) return;
    this.flags.add(flag);
    bus.emit('flag:set', flag);
  }

  rememberPlayer(x: number, y: number, facing: Direction): void {
    this.player = { x: Math.round(x), y: Math.round(y), facing };
  }

  save(): void {
    const data: SaveData = {
      version: 1,
      player: this.player ?? { x: 0, y: 0, facing: 'down' },
      flags: [...this.flags],
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch {
      // 無痕模式 / 停用 storage 時不該讓遊戲爆掉
    }
  }

  load(): void {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(SAVE_KEY);
    } catch {
      return;
    }
    if (!raw) return;

    try {
      const data = JSON.parse(raw) as Partial<SaveData>;
      if (data.version !== 1) return; // 版本不合就當作沒存檔，不要硬讀
      this.flags.clear();
      for (const flag of data.flags ?? []) this.flags.add(flag);
      this.player = data.player ?? null;
    } catch {
      // 壞掉的存檔直接忽略
    }
  }

  reset(): void {
    this.flags.clear();
    this.player = null;
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* 同上 */
    }
  }
}

export const gameState = new GameState();
