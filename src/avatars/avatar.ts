import { AnimatedSprite, Container, Graphics } from 'pixi.js'
import type { SpeechBubble } from '../render/bubble'
import { ANIM_NAMES, ANIMATIONS, type AnimName } from '../render/sprites/contract'
import type { AnimationSet } from '../render/sprites/loader'
import { createNameLabel, NAME_LABEL_HEIGHT } from '../render/nameLabel'
import { labelOffset, overheadLayout } from '../render/placement'
import { JUMP_HEIGHT, type AvatarStateMachine } from './stateMachine'

/**
 * How far above the feet the tallest heads reach, in frame px (bunny ears
 * top out at row 4 of the 48px frame). Name plates sit just above this, so
 * every character's name is at the same height.
 */
const HEAD_CLEARANCE = 44
/** At the jump peak the shadow narrows and fades by these fractions. */
const SHADOW_JUMP_SHRINK = 0.45
const SHADOW_JUMP_FADE = 0.5

/**
 * Flat pixel ellipse in sprite pixels, centred under the feet (the feet's
 * last row is 46 of the 48px frame). Scaled with the sprite, stays on the
 * ground while the sprite jumps.
 */
function createGroundShadow(scale: number): Graphics {
  const shadow = new Graphics()
    .rect(-7, -3, 14, 1)
    .rect(-10, -2, 20, 1)
    .rect(-7, -1, 14, 1)
    .fill({ color: 0x000000, alpha: 0.35 })
  shadow.scale.set(scale)
  return shadow
}

/** One layer sheet of a character with the tint for its color role. */
export interface AvatarLayer {
  set: AnimationSet
  tint: number
}

interface AnimGroup {
  group: Container
  sprites: AnimatedSprite[]
}

export interface AvatarDisplayOptions {
  login: string
  labelText: string
  /** Name tag color: the chatter's color, see characterColors. */
  labelTint: number
  /** The character's layer stack, back to front (see layersFor). */
  layers: readonly AvatarLayer[]
  machine: AvatarStateMachine
  scale: number
  /** Ground line (feet position) in stage coordinates. */
  baseY: number
  /** Bubbles and name plates are kept inside [0, stageWidth]. */
  stageWidth: number
  /** Name plates render above every character, so a closer one never hides a name. */
  labelLayer: Container
  bubbleLayer: Container
}

/**
 * Binds one state machine to its Pixi display objects. One pre-built
 * animation group per sheet row is toggled by visibility instead of swapping textures
 * per frame. The name plate and bubble live on shared layers above every
 * character and follow the head each frame: plate just above the head,
 * bubble above the plate, so feet can stand on the very bottom edge.
 */
export class Avatar {
  readonly login: string
  readonly container: Container
  readonly machine: AvatarStateMachine
  lastActiveAt: number
  destroyed = false

  private spriteFlip: Container
  private shadow: Graphics
  private label: Container
  private labelHalfWidth: number
  private groups: Record<AnimName, AnimGroup>
  private currentAnim: AnimName | null = null
  private bubble: SpeechBubble | null = null
  private bubbleExpiresAt = 0
  private bubbleLayer: Container
  private baseY: number
  private stageWidth: number
  private scale: number

  constructor(options: AvatarDisplayOptions, now: number) {
    this.login = options.login
    this.machine = options.machine
    this.lastActiveAt = now
    this.bubbleLayer = options.bubbleLayer
    this.baseY = options.baseY
    this.stageWidth = options.stageWidth
    this.scale = options.scale

    this.container = new Container()
    this.container.y = options.baseY
    this.container.zIndex = options.baseY

    this.shadow = createGroundShadow(options.scale)
    this.spriteFlip = new Container()
    this.container.addChild(this.shadow, this.spriteFlip)

    this.groups = this.buildGroups(options.layers)

    this.label = createNameLabel(options.labelText, options.labelTint)
    this.label.zIndex = options.baseY // closer characters' names draw on top
    this.labelHalfWidth = this.label.width / 2
    options.labelLayer.addChild(this.label)
  }

  /** One pre-built group per sheet row; new animations need no edit here. */
  private buildGroups(layers: readonly AvatarLayer[]): Record<AnimName, AnimGroup> {
    return Object.fromEntries(
      ANIM_NAMES.map((name) => [name, this.buildGroup(name, layers)]),
    ) as Record<AnimName, AnimGroup>
  }

  private buildGroup(anim: AnimName, layers: readonly AvatarLayer[]): AnimGroup {
    const group = new Container()
    group.visible = false
    const sprites = layers.map((layer) => {
      const sprite = new AnimatedSprite(layer.set[anim])
      sprite.anchor.set(0.5, 1)
      sprite.tint = layer.tint
      sprite.animationSpeed = ANIMATIONS[anim].fps / 60
      group.addChild(sprite)
      return sprite
    })
    this.spriteFlip.addChild(group)
    return { group, sprites }
  }

  /**
   * Swaps the character's layers in place: same spot, state, name tag and
   * bubble. Textures are shared per sheet, so only the sprites are destroyed.
   */
  setLayers(layers: readonly AvatarLayer[]): void {
    for (const { group } of Object.values(this.groups)) group.destroy({ children: true })
    this.groups = this.buildGroups(layers)
    this.currentAnim = null // the next update shows the current row, restarted
  }

  touch(now: number): void {
    this.lastActiveAt = now
  }

  /** Replaces any current bubble; added last, so the newest bubble draws on top. */
  showBubble(bubble: SpeechBubble, now: number, durationMs: number): void {
    this.clearBubble()
    this.bubble = bubble
    this.bubbleExpiresAt = now + durationMs
    this.bubbleLayer.addChild(bubble.view)
  }

  update(dtSec: number, now: number): void {
    const snap = this.machine.update(dtSec)

    this.container.x = snap.x
    this.spriteFlip.y = snap.jumpOffsetY
    this.spriteFlip.scale.set(snap.facing * this.scale, this.scale)

    // plate and bubble ride along with jumps; the plate never flips with the sprite
    const headTop = this.baseY + snap.jumpOffsetY - HEAD_CLEARANCE * this.scale
    const { labelY, bubbleY } = overheadLayout(headTop, NAME_LABEL_HEIGHT)
    this.label.position.set(snap.x + labelOffset(snap.x, this.labelHalfWidth, this.stageWidth), labelY)

    const lift = -snap.jumpOffsetY / JUMP_HEIGHT
    this.shadow.scale.x = this.scale * (1 - SHADOW_JUMP_SHRINK * lift)
    this.shadow.alpha = 1 - SHADOW_JUMP_FADE * lift

    if (snap.anim !== this.currentAnim) {
      if (this.currentAnim) {
        const prev = this.groups[this.currentAnim]
        prev.group.visible = false
        for (const s of prev.sprites) s.stop()
      }
      const next = this.groups[snap.anim]
      next.group.visible = true
      for (const s of next.sprites) s.gotoAndPlay(0)
      this.currentAnim = snap.anim
    }

    if (this.bubble) {
      if (now >= this.bubbleExpiresAt) {
        this.clearBubble()
      } else {
        this.bubble.placeAt(snap.x, bubbleY, this.stageWidth)
      }
    }
  }

  clearBubble(): void {
    this.bubble?.destroy()
    this.bubble = null
  }

  destroy(): void {
    this.destroyed = true
    this.clearBubble()
    this.label.destroy({ children: true })
    this.container.destroy({ children: true })
  }
}
