import Phaser from 'phaser';
import npcsJson from '../data/npcs.json';
import {
  CAMERA_ZOOM,
  DEPTH,
  FONT_FAMILY,
  INTERACT_RADIUS,
  INTERACT_REACH,
  TILE_SIZE,
} from '../config';
import { Npc } from '../objects/Npc';
import { Player } from '../objects/Player';
import { bus } from '../systems/events';
import { gameState } from '../systems/state';
import { FACING_VECTOR, type Direction, type Interactable, type NpcDefinition } from '../types';

const NPC_DEFINITIONS = npcsJson as unknown as Record<string, NpcDefinition>;

/** Tiled 物件上的自訂屬性。Phaser 的型別把它標成 any，這裡收斂一下。 */
interface TiledProperty {
  name: string;
  value: unknown;
}

function getProperty(object: Phaser.Types.Tilemaps.TiledObject, name: string): string | undefined {
  const properties = object.properties as TiledProperty[] | undefined;
  const found = properties?.find((property) => property.name === name);
  return typeof found?.value === 'string' ? found.value : undefined;
}

export class WorldScene extends Phaser.Scene {
  private player!: Player;
  private map!: Phaser.Tilemaps.Tilemap;
  private interactables: Interactable[] = [];

  private interactKeys!: Phaser.Input.Keyboard.Key[];
  private upKeys!: Phaser.Input.Keyboard.Key[];
  private downKeys!: Phaser.Input.Keyboard.Key[];
  private debugKey!: Phaser.Input.Keyboard.Key;
  private resetKey!: Phaser.Input.Keyboard.Key;

  private dialogueOpen = false;
  private activeHint: string | null = null;
  private debugGraphics: Phaser.GameObjects.Graphics | null = null;
  private debugText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super('WorldScene');
  }

  create(): void {
    this.map = this.make.tilemap({ key: 'island' });
    const tileset = this.map.addTilesetImage('terrain', 'terrain');
    if (!tileset) throw new Error('地圖裡找不到名為 terrain 的 tileset');

    const ground = this.requireLayer('ground', tileset, DEPTH.ground);
    const decor = this.requireLayer('decor', tileset, DEPTH.decor);
    // 樹冠這層畫在所有角色之上，玩家才能走到樹後面
    this.requireLayer('above', tileset, DEPTH.above);

    // 碰撞完全由 tileset 裡的 collides 屬性決定 —— 在 Tiled 改，程式不用動
    ground.setCollisionByProperty({ collides: true });
    decor.setCollisionByProperty({ collides: true });

    const { spawn, npcs, points } = this.readObjectLayer();

    // 有存檔就從存檔位置開始，否則用地圖上的 player_spawn
    const start = gameState.player ?? spawn;
    this.player = new Player(this, start.x, start.y, start.facing);

    const npcSprites: Npc[] = [];
    for (const entry of npcs) {
      const definition = NPC_DEFINITIONS[entry.npcId];
      if (!definition) {
        console.warn(`[world] npcs.json 裡沒有 ${entry.npcId}`);
        continue;
      }
      const npc = new Npc(this, entry.x, entry.y, definition);
      npcSprites.push(npc);
      this.interactables.push({
        x: npc.x,
        y: npc.y,
        label: definition.name,
        dialogueId: definition.dialogueId,
      });
    }
    this.interactables.push(...points);

    this.physics.world.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
    this.physics.add.collider(this.player, ground);
    this.physics.add.collider(this.player, decor);
    this.physics.add.collider(this.player, npcSprites);

    const camera = this.cameras.main;
    camera.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
    camera.setZoom(CAMERA_ZOOM);
    camera.setRoundPixels(true);
    // lerp 小於 1，鏡頭才會有一點跟隨延遲，不會黏得死死的
    camera.startFollow(this.player, true, 0.12, 0.12);

    this.bindKeys();

    if (!this.scene.isActive('UIScene')) this.scene.launch('UIScene');

    bus.on('dialogue:open', this.handleDialogueOpen, this);
    bus.on('dialogue:close', this.handleDialogueClose, this);

    // 每 5 秒存一次就夠了，不需要每幀寫 localStorage
    this.time.addEvent({ delay: 5000, loop: true, callback: () => this.persist() });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
  }

  override update(_time: number, delta: number): void {
    if (this.dialogueOpen) {
      this.forwardDialogueInput();
    } else {
      this.updateInteractionHint();
      if (this.justPressed(this.interactKeys)) this.tryInteract();
    }

    if (Phaser.Input.Keyboard.JustDown(this.debugKey)) this.toggleDebug();
    if (Phaser.Input.Keyboard.JustDown(this.resetKey)) this.resetProgress();

    this.refreshDebug(delta);
  }

  // ------------------------------------------------------------ 建立場景用

  private requireLayer(
    name: string,
    tileset: Phaser.Tilemaps.Tileset,
    depth: number,
  ): Phaser.Tilemaps.TilemapLayer {
    const layer = this.map.createLayer(name, tileset, 0, 0);
    if (!layer) throw new Error(`地圖裡找不到圖層：${name}`);
    return layer.setDepth(depth);
  }

  /** 把 Tiled 的物件層翻成遊戲看得懂的東西。 */
  private readObjectLayer(): {
    spawn: { x: number; y: number; facing: Direction };
    npcs: { npcId: string; x: number; y: number }[];
    points: Interactable[];
  } {
    const spawn = { x: this.map.widthInPixels / 2, y: this.map.heightInPixels / 2, facing: 'down' as Direction };
    const npcs: { npcId: string; x: number; y: number }[] = [];
    const points: Interactable[] = [];

    const objects = this.map.getObjectLayer('objects')?.objects ?? [];
    for (const object of objects) {
      const x = object.x ?? 0;
      const y = object.y ?? 0;

      if (object.type === 'spawn') {
        spawn.x = x;
        spawn.y = y;
        continue;
      }

      if (object.type === 'npc') {
        const npcId = getProperty(object, 'npcId');
        if (npcId) npcs.push({ npcId, x, y });
        continue;
      }

      if (object.type === 'interactable') {
        const dialogueId = getProperty(object, 'dialogueId');
        if (dialogueId) points.push({ x, y, label: object.name || '查看', dialogueId });
      }
    }

    return { spawn, npcs, points };
  }

  private bindKeys(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error('這個環境沒有鍵盤輸入');

    const key = (code: number) => keyboard.addKey(code);
    const Codes = Phaser.Input.Keyboard.KeyCodes;

    this.interactKeys = [key(Codes.SPACE), key(Codes.E), key(Codes.ENTER)];
    this.upKeys = [key(Codes.UP), key(Codes.W)];
    this.downKeys = [key(Codes.DOWN), key(Codes.S)];
    this.debugKey = key(Codes.F1);
    this.resetKey = key(Codes.F9);

    // 別讓空白鍵和方向鍵把整個頁面捲來捲去
    keyboard.addCapture([
      Codes.SPACE,
      Codes.UP,
      Codes.DOWN,
      Codes.LEFT,
      Codes.RIGHT,
      Codes.F1,
      Codes.F9,
    ]);
  }

  // ------------------------------------------------------------ 互動

  private justPressed(keys: Phaser.Input.Keyboard.Key[]): boolean {
    return keys.some((k) => Phaser.Input.Keyboard.JustDown(k));
  }

  /**
   * 從玩家腳下往面向方向探出一小段距離，找最近的可互動物。
   * 用「面向 + 距離」而不是純距離，站在 NPC 旁邊背對他就不會誤觸。
   */
  private findFacingInteractable(): Interactable | null {
    const vector = FACING_VECTOR[this.player.facing];
    const probeX = this.player.x + vector.x * INTERACT_REACH;
    const probeY = this.player.y + 4 + vector.y * INTERACT_REACH;

    let best: Interactable | null = null;
    let bestDistance = INTERACT_RADIUS;
    for (const item of this.interactables) {
      const distance = Phaser.Math.Distance.Between(probeX, probeY, item.x, item.y + 4);
      if (distance < bestDistance) {
        best = item;
        bestDistance = distance;
      }
    }
    return best;
  }

  private updateInteractionHint(): void {
    const target = this.findFacingInteractable();
    const hint = target ? `空白鍵　${target.label}` : null;
    if (hint === this.activeHint) return; // 只在變化時發事件，不要每幀洗畫面
    this.activeHint = hint;
    bus.emit('hint:show', hint);
  }

  private tryInteract(): void {
    const target = this.findFacingInteractable();
    if (!target) return;
    bus.emit('dialogue:start', target.dialogueId);
  }

  /** 對話開啟時，按鍵只由這裡收，再轉給 UI，避免同一幀被兩個場景各吃一次。 */
  private forwardDialogueInput(): void {
    if (this.justPressed(this.interactKeys)) bus.emit('dialogue:advance');
    else if (this.justPressed(this.upKeys)) bus.emit('dialogue:move', -1);
    else if (this.justPressed(this.downKeys)) bus.emit('dialogue:move', 1);
  }

  private handleDialogueOpen(): void {
    this.dialogueOpen = true;
    this.player.frozen = true;
    this.activeHint = null;
    bus.emit('hint:show', null);
  }

  private handleDialogueClose(): void {
    this.dialogueOpen = false;
    this.player.frozen = false;
    this.persist();
  }

  // ------------------------------------------------------------ 存檔與除錯

  private persist(): void {
    gameState.rememberPlayer(this.player.x, this.player.y, this.player.facing);
    gameState.save();
  }

  private resetProgress(): void {
    gameState.reset();
    this.scene.stop('UIScene');
    this.scene.restart();
  }

  private toggleDebug(): void {
    if (this.debugGraphics) {
      this.debugGraphics.destroy();
      this.debugText?.destroy();
      this.debugGraphics = null;
      this.debugText = null;
      return;
    }

    this.debugGraphics = this.add.graphics().setDepth(DEPTH.above + 1).setAlpha(0.6);
    for (const name of ['ground', 'decor']) {
      this.map.getLayer(name)?.tilemapLayer.renderDebug(this.debugGraphics, {
        tileColor: null,
        collidingTileColor: new Phaser.Display.Color(255, 90, 90, 90),
        faceColor: new Phaser.Display.Color(255, 220, 120, 200),
      });
    }

    this.debugText = this.add
      .text(8, 8, '', { fontFamily: FONT_FAMILY, fontSize: '13px', color: '#ffd98a' })
      .setScrollFactor(0)
      .setDepth(DEPTH.above + 2);
  }

  private refreshDebug(delta: number): void {
    if (!this.debugText) return;
    const tileX = Math.floor(this.player.x / TILE_SIZE);
    const tileY = Math.floor(this.player.y / TILE_SIZE);
    this.debugText.setText(
      [
        `fps ${(1000 / delta).toFixed(0)}`,
        `tile ${tileX},${tileY}　px ${this.player.x.toFixed(0)},${this.player.y.toFixed(0)}`,
        `facing ${this.player.facing}`,
        `flags ${[...gameState.flags].join(', ') || '（無）'}`,
      ].join('\n'),
    );
  }

  private handleShutdown(): void {
    // 場景重啟時如果不解掉，舊的 handler 會留在 bus 上對著已死的物件呼叫
    bus.off('dialogue:open', this.handleDialogueOpen, this);
    bus.off('dialogue:close', this.handleDialogueClose, this);
    this.interactables = [];
  }
}
