import { ANIMATIONS, type AnimName } from '../render/sprites/contract'

/** What a viewer's own character can do on stream; the high-five, hug and dizzy rows need a second character. */
export const PREVIEW_ANIMS: readonly AnimName[] = [
  'idle',
  'walk',
  'jump',
  'talk',
  'cheer',
  'sad',
  'sit',
  'clap',
  'wave',
  'dance',
  'smoke',
  'bong',
]
/** While cycling, each animation shows at least this long; slower ones play through once. */
export const MIN_SHOW_MS = 2400

/** How long an animation shows while the preview cycles. */
export function showMs(anim: AnimName): number {
  const { frames, fps } = ANIMATIONS[anim]
  return Math.max(MIN_SHOW_MS, Math.ceil((frames / fps) * 1000))
}

/** The animation and how far into it, `elapsedMs` into the cycle; a pinned animation plays on its own. */
export function previewFrame(elapsedMs: number, pinned: AnimName | null): { anim: AnimName; ms: number } {
  if (pinned) return { anim: pinned, ms: elapsedMs }
  const cycle = PREVIEW_ANIMS.reduce((sum, anim) => sum + showMs(anim), 0)
  let t = ((elapsedMs % cycle) + cycle) % cycle
  for (const anim of PREVIEW_ANIMS) {
    const span = showMs(anim)
    if (t < span) return { anim, ms: t }
    t -= span
  }
  return { anim: 'idle', ms: 0 }
}
