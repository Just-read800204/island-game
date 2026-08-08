import Phaser from 'phaser';
import { RUN_SPEED, WALK_SPEED } from '../config';
import type { Direction } from '../types';
import { Character } from './Character';

interface MovementKeys {
  up: Phaser.Input.Keyboard.Key;
  down: Phaser.Input.Keyboard.Key;
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
  run: Phaser.Input.Keyboard.Key;
}

export class Player extends Character {
  private readonly cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private readonly keys: MovementKeys;

  /** 對話中要把玩家釘住，不然講話會邊走邊講。 */
  frozen = false;

  constructor(scene: Phaser.Scene, x: number, y: number, facing: Direction = 'down') {
    super(scene, x, y, 'hero', facing);

    const keyboard = scene.input.keyboard;
    if (!keyboard) throw new Error('這個環境沒有鍵盤輸入');

    this.cursors = keyboard.createCursorKeys();
    // 方向鍵與 WASD 都能用，習慣哪種的人都不會卡住
    this.keys = {
      up: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      run: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT),
    };
  }

  override preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);

    const body = this.body as Phaser.Physics.Arcade.Body;
    if (this.frozen) {
      body.setVelocity(0, 0);
      this.refreshAnimation(0, 0);
      return;
    }

    const left = this.cursors.left.isDown || this.keys.left.isDown;
    const right = this.cursors.right.isDown || this.keys.right.isDown;
    const up = this.cursors.up.isDown || this.keys.up.isDown;
    const down = this.cursors.down.isDown || this.keys.down.isDown;

    const vx = (right ? 1 : 0) - (left ? 1 : 0);
    const vy = (down ? 1 : 0) - (up ? 1 : 0);

    const speed = this.keys.run.isDown ? RUN_SPEED : WALK_SPEED;
    // normalize 之後再乘速度，斜走才不會比直走快 1.41 倍
    const velocity = new Phaser.Math.Vector2(vx, vy).normalize().scale(speed);
    body.setVelocity(velocity.x, velocity.y);

    this.refreshAnimation(velocity.x, velocity.y);
  }
}
