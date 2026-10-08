import { EFFECTS, type EffectName } from './effectArt'

/** What a choreographer or an emote asks the effect layer to show. */
export interface EffectCue {
  name: EffectName
  /** Stage px. */
  x: number
  /** Frame px above the ground line of the characters it belongs to. */
  rise: number
  /** Shows this long after it is cued. */
  delayMs?: number
  /** Replaces the effect's own life (the cloud lasts the whole brawl). */
  lifeMs?: number
  /** Frame px per second; `vy` replaces the effect's own rise speed. */
  vx?: number
  vy?: number
  /** Circles its spot at this radius (frame px), starting at this angle (radians), once a second. */
  orbit?: { radius: number; phase: number }
}

export interface EffectPose {
  /** Offset from the cued spot in frame px; positive y is down. */
  dx: number
  dy: number
  frame: number
  alpha: number
  scale: number
}

/** Where a cued effect is `ageMs` after it was cued: null before its delay and after its life. */
export function effectAt(cue: EffectCue, ageMs: number): EffectPose | null {
  const spec = EFFECTS[cue.name]
  const t = ageMs - (cue.delayMs ?? 0)
  const life = cue.lifeMs ?? spec.lifeMs
  if (t < 0 || t >= life) return null
  const sec = t / 1000
  const progress = t / life
  let dx = (cue.vx ?? 0) * sec
  let dy = (cue.vy ?? spec.vy) * sec
  if (cue.orbit) {
    const angle = cue.orbit.phase + sec * Math.PI * 2
    dx += Math.cos(angle) * cue.orbit.radius
    dy += Math.sin(angle) * cue.orbit.radius * 0.4 // flattened, like a halo seen from the side
  }
  if (cue.name === 'cloud') dy += Math.round(Math.sin(sec * 9)) // bobs a pixel
  const fading = spec.fade > 0 && progress > 1 - spec.fade
  return {
    dx,
    dy,
    frame: Math.floor(sec * spec.fps) % spec.frames,
    alpha: fading ? (1 - progress) / spec.fade : 1,
    scale: 1 + (spec.grow - 1) * progress,
  }
}

/** Whether a cued effect is over: past its delay and its life. */
export function effectDone(cue: EffectCue, ageMs: number): boolean {
  return ageMs - (cue.delayMs ?? 0) >= (cue.lifeMs ?? EFFECTS[cue.name].lifeMs)
}
