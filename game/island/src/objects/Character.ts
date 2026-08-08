import Phaser from 'phaser';
import { BODY_HEIGHT, BODY_WIDTH, DEPTH, FRAME_HEIGHT, FRAME_WIDTH } from '../config';
import { idleFrame, registerCharacterAnimations, walkAnimKey } from '../systems/animations';
import type { Direction } from '../types';

/**
 * 玩家與 NPC 的共同base：一個有腳下碰撞盒、會依方向播動畫、
 * 並且會依 y 座標自動排前後關係的 sprite。
 */
export class Character extends Phaser.Physics.Arcade.Sprite {
  facing: Direction = 'down';

  constructor(scene: Phaser.Scene, x: number, y: number, textureKey: string, facing: Direction = 'down') {
    super(scene, x, y, textureKey, idleFrame(facing));
    this.facing = facing;

    scene.add.existing(this);
    scene.physics.add.existing(this);
    registerCharacterAnimations(scene, textureKey);

    const body = this.body as Phaser.Physics.Arcade.Body;
    // 碰撞盒貼在腳底，不是整張圖
    body.setSize(BODY_WIDTH, BODY_HEIGHT);
    body.setOffset((FRAME_WIDTH - BODY_WIDTH) / 2, FRAME_HEIGHT - BODY_HEIGHT - 1);
    body.setCollideWorldBounds(true);

    this.setFacing(facing);
  }

  setFacing(facing: Direction): void {
    this.facing = facing;
    if (!this.anims.isPlaying) this.setFrame(idleFrame(facing));
  }

  /** 依速度決定要播走路動畫還是站著，並更新面向。 */
  protected refreshAnimation(vx: number, vy: number): void {
    if (vx === 0 && vy === 0) {
      this.anims.stop();
      this.setFrame(idleFrame(this.facing));
      return;
    }

    // 斜走時以水平為主，這樣角色不會在對角線上抖動
    if (Math.abs(vx) >= Math.abs(vy)) this.facing = vx > 0 ? 'right' : 'left';
    else this.facing = vy > 0 ? 'down' : 'up';

    this.anims.play(walkAnimKey(this.texture.key, this.facing), true);
  }

  override preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    // y 越大代表越靠近畫面下方，就該蓋在別人前面
    this.setDepth(DEPTH.characterBase + this.y);
  }
}
