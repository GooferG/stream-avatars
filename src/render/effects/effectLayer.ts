import { Container, Sprite, Texture } from 'pixi.js'
import { drawParts } from '../sprites/pixelKit'
import { EFFECT_NAMES, EFFECTS, effectFrameParts, type EffectName } from './effectArt'
import { effectAt, effectDone, type EffectCue } from './effectMotion'

/** At most this many effects show at once; the oldest goes first. */
export const MAX_LIVE_EFFECTS = 64

interface Live {
  cue: EffectCue
  at: number
  groundY: number
  sprite: Sprite
}

/**
 * Shows cued effects above the characters and below the name plates:
 * code-painted frames (painted once), pooled sprites, crisp pixels at the
 * sprite scale. Does nothing while no effect is live.
 */
export class EffectLayer {
  private layer: Container
  private scale: number
  private frames: Record<EffectName, Texture[]>
  private live: Live[] = []
  private pool: Sprite[] = []

  constructor(layer: Container, scale: number) {
    this.layer = layer
    this.scale = scale
    this.frames = Object.fromEntries(EFFECT_NAMES.map((name) => [name, paintFrames(name)])) as Record<
      EffectName,
      Texture[]
    >
  }

  /** Shows a cue; `groundY` is the stage y its `rise` counts up from. */
  spawn(cue: EffectCue, groundY: number, now: number): void {
    if (this.live.length >= MAX_LIVE_EFFECTS) this.release(0)
    const sprite = this.pool.pop() ?? new Sprite()
    sprite.anchor.set(0.5)
    sprite.visible = false
    this.layer.addChild(sprite)
    this.live.push({ cue, at: now, groundY, sprite })
  }

  update(now: number): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const fx = this.live[i]
      if (!fx) continue
      const age = now - fx.at
      if (effectDone(fx.cue, age)) {
        this.release(i)
        continue
      }
      const pose = effectAt(fx.cue, age)
      if (!pose) {
        fx.sprite.visible = false // still waiting out its delay
        continue
      }
      const textures = this.frames[fx.cue.name]
      fx.sprite.texture = textures[pose.frame] ?? textures[0] ?? Texture.EMPTY
      fx.sprite.visible = true
      fx.sprite.alpha = pose.alpha
      fx.sprite.scale.set(this.scale * pose.scale)
      fx.sprite.position.set(
        Math.round(fx.cue.x + pose.dx * this.scale),
        Math.round(fx.groundY + (pose.dy - fx.cue.rise) * this.scale),
      )
    }
  }

  destroy(): void {
    for (const fx of this.live) fx.sprite.destroy()
    for (const sprite of this.pool) sprite.destroy()
    for (const textures of Object.values(this.frames)) for (const t of textures) t.destroy(true)
    this.live = []
    this.pool = []
  }

  private release(index: number): void {
    const [fx] = this.live.splice(index, 1)
    if (!fx) return
    this.layer.removeChild(fx.sprite)
    this.pool.push(fx.sprite)
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
