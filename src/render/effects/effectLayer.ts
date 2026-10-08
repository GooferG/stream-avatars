import { Container, Sprite, Texture } from 'pixi.js'
import { drawParts } from '../sprites/pixelKit'
import { EFFECT_NAMES, EFFECTS, effectFrameParts, type EffectName } from './effectArt'
import { EffectBook, type Showing } from './effectBook'
import type { EffectCue, EffectPose } from './effectMotion'

/** At most this many effects show at once (delayed ones waiting don't count); see EffectBook. */
export const MAX_LIVE_EFFECTS = 64

/**
 * Shows cued effects above the characters and below the name plates:
 * code-painted frames (painted once), pooled sprites, crisp pixels at the
 * sprite scale. Does nothing while no effect is cued.
 */
export class EffectLayer {
  private layer: Container
  private scale: number
  private frames: Record<EffectName, Texture[]>
  private book = new EffectBook<Sprite>(MAX_LIVE_EFFECTS)
  private pool: Sprite[] = []
  private acquire = (): Sprite => this.takeSprite()
  private release = (sprite: Sprite): void => this.returnSprite(sprite)
  private show = (fx: Showing<Sprite>, pose: EffectPose): void => this.place(fx, pose)

  constructor(layer: Container, scale: number) {
    this.layer = layer
    this.scale = scale
    this.frames = Object.fromEntries(EFFECT_NAMES.map((name) => [name, paintFrames(name)])) as Record<
      EffectName,
      Texture[]
    >
  }

  /** Cues an effect; `groundY` is the stage y its `rise` counts up from. */
  spawn(cue: EffectCue, groundY: number): void {
    this.book.add(cue, groundY)
  }

  /** Advances every effect by the frame's time: the same clamped delta the interactions run on. */
  update(dtMs: number): void {
    this.book.advance(dtMs, this.acquire, this.release, this.show)
  }

  destroy(): void {
    this.book.clear(this.release)
    for (const sprite of this.pool) sprite.destroy()
    for (const textures of Object.values(this.frames)) for (const t of textures) t.destroy(true)
    this.pool = []
  }

  private takeSprite(): Sprite {
    const sprite = this.pool.pop() ?? new Sprite()
    sprite.anchor.set(0.5)
    sprite.visible = false
    this.layer.addChild(sprite)
    return sprite
  }

  private returnSprite(sprite: Sprite): void {
    this.layer.removeChild(sprite)
    this.pool.push(sprite)
  }

  private place(fx: Showing<Sprite>, pose: EffectPose): void {
    const textures = this.frames[fx.cue.name]
    const sprite = fx.item
    sprite.texture = textures[pose.frame] ?? textures[0] ?? Texture.EMPTY
    sprite.visible = true
    sprite.alpha = pose.alpha
    sprite.scale.set(this.scale * pose.scale)
    sprite.position.set(
      Math.round(fx.cue.x + pose.dx * this.scale),
      Math.round(fx.groundY + (pose.dy - fx.cue.rise) * this.scale),
    )
  }
}

/** One texture per frame, painted with the same pixel kit as the characters. */
function paintFrames(name: EffectName): Texture[] {
  const { w, h, frames } = EFFECTS[name]
  return Array.from({ length: frames }, (_, f) => {
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2d canvas context unavailable')
    drawParts(ctx, effectFrameParts(name, f))
    return Texture.from(canvas)
  })
}
