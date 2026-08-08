import type Phaser from 'phaser';
import type { NpcDefinition } from '../types';
import { Character } from './Character';

export class Npc extends Character {
  readonly definition: NpcDefinition;

  constructor(scene: Phaser.Scene, x: number, y: number, definition: NpcDefinition) {
    super(scene, x, y, definition.texture, definition.facing ?? 'down');
    this.definition = definition;

    const body = this.body as Phaser.Physics.Arcade.Body;
    // 玩家推不動 NPC，但走過去會被擋住
    body.setImmovable(true);
    body.moves = false;
  }
}
