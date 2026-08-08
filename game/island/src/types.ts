export type Direction = 'down' | 'left' | 'right' | 'up';

export const DIRECTIONS: readonly Direction[] = ['down', 'left', 'right', 'up'];

/** 面向 -> 單位向量，互動偵測與動畫都會用到。 */
export const FACING_VECTOR: Record<Direction, { x: number; y: number }> = {
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
};

export interface DialogueChoice {
  label: string;
  /** 選完之後跳到哪一段對話；沒有就直接結束。 */
  next?: string;
  /** 選完之後設定的旗標。 */
  setFlag?: string;
}

export interface DialogueNode {
  speaker: string;
  /** 一頁一句，按互動鍵翻頁。 */
  pages: string[];
  /** 這段講完就設旗標，用來記「已經見過某人」之類的狀態。 */
  setFlag?: string;
  /** 講完自動接下一段。 */
  next?: string;
  /** 講完後給玩家選項。與 next 併用時 choices 優先。 */
  choices?: DialogueChoice[];
  /** 若旗標已存在，改成播另一段（第二次講話講不一樣的內容）。 */
  redirectIfFlag?: { flag: string; to: string };
}

export interface NpcDefinition {
  name: string;
  /** 對應 public/assets/characters/<texture>.png */
  texture: string;
  facing?: Direction;
  dialogueId: string;
}

/** 場上任何可以按空白鍵互動的東西。 */
export interface Interactable {
  x: number;
  y: number;
  label: string;
  dialogueId: string;
}
