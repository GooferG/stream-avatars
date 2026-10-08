import type { Part } from '../sprites/pixelKit'

/** Everything the effect layer shows: code-drawn pixel art in fixed colors, like the characters. */
export type EffectName = 'spark' | 'heart' | 'cloud' | 'fist' | 'shoe' | 'star' | 'puff' | 'smoke' | 'tinyStar'

export interface EffectSpec {
  /** Frame size in frame px; an effect is drawn centered on its spot. */
  w: number
  h: number
  frames: number
  fps: number
  lifeMs: number
  /** Rise speed in frame px per second (negative is up), unless the cue sets one. */
  vy: number
  /** The scale it reaches at the end of its life. */
  grow: number
  /** Fades out over this last fraction of its life; 0 never fades. */
  fade: number
}

export const EFFECTS: Record<EffectName, EffectSpec> = {
  spark: { w: 15, h: 15, frames: 4, fps: 10, lifeMs: 400, vy: 0, grow: 1, fade: 0 },
  heart: { w: 9, h: 8, frames: 1, fps: 1, lifeMs: 1200, vy: -16, grow: 1, fade: 0.4 },
  cloud: { w: 80, h: 48, frames: 4, fps: 8, lifeMs: 3000, vy: 0, grow: 1, fade: 0 },
  fist: { w: 10, h: 9, frames: 1, fps: 1, lifeMs: 200, vy: 0, grow: 1, fade: 0 },
  shoe: { w: 12, h: 7, frames: 1, fps: 1, lifeMs: 200, vy: 0, grow: 1, fade: 0 },
  star: { w: 9, h: 9, frames: 1, fps: 1, lifeMs: 200, vy: 0, grow: 1, fade: 0 },
  puff: { w: 8, h: 8, frames: 1, fps: 1, lifeMs: 400, vy: 0, grow: 0.6, fade: 0.5 },
  smoke: { w: 10, h: 10, frames: 1, fps: 1, lifeMs: 1500, vy: -14, grow: 1.6, fade: 0.6 },
  tinyStar: { w: 5, h: 5, frames: 1, fps: 1, lifeMs: 3000, vy: 0, grow: 1, fade: 0 },
}
export const EFFECT_NAMES = Object.keys(EFFECTS) as EffectName[]

const SPARK = '#fff3a0'
const SPARK_CORE = '#ffd23f'
const HEART = '#ff5a7a'
const HEART_SHINE = '#ffd0da'
const CLOUD = '#ece7de'
const CLOUD_SHADE = '#c9c2b6'
const GLOVE = '#ffffff'
const GLOVE_SHADE = '#d6d6d6'
const SHOE = '#a8322c'
const SHOE_SHADE = '#7d2420'
const SOLE = '#f4f1ea'
const STAR = '#ffd23f'
const SMOKE = 'rgba(225, 225, 225, 0.85)'
const SMOKE_LIGHT = 'rgba(255, 255, 255, 0.6)'

/** The cloud's puffs as [cx, cy, radius]; each swells a pixel on its own frame, so the cloud churns. */
const CLOUD_PUFFS: readonly (readonly [number, number, number])[] = [
  [20, 28, 12],
  [34, 20, 13],
  [48, 20, 13],
  [60, 28, 12],
  [40, 30, 14],
  [26, 36, 9],
  [54, 36, 9],
]

const HEART_PARTS: Part[] = [
  { t: 'r', x: 2, y: 1, w: 2, h: 1, col: HEART },
  { t: 'r', x: 5, y: 1, w: 2, h: 1, col: HEART },
  { t: 'r', x: 1, y: 2, w: 7, h: 2, col: HEART },
  { t: 'r', x: 2, y: 4, w: 5, h: 1, col: HEART },
  { t: 'r', x: 3, y: 5, w: 3, h: 1, col: HEART },
  { t: 'r', x: 4, y: 6, w: 1, h: 1, col: HEART },
  { t: 'r', x: 2, y: 2, w: 1, h: 1, col: HEART_SHINE, noOutline: true },
]

/** The parts of one frame of an effect, in its own w x h box. */
export function effectFrameParts(name: EffectName, frame: number): Part[] {
  switch (name) {
    case 'spark':
      return spark(frame)
    case 'heart':
      return HEART_PARTS
    case 'cloud':
      return CLOUD_PUFFS.map(([cx, cy, r], i): Part => {
        const swell = (frame + i) % 4 === 0 ? 1 : 0
        return { t: 'e', cx, cy, rx: r + 2 + swell, ry: r + swell, col: CLOUD, shade: CLOUD_SHADE }
      })
    case 'fist':
      return [
        { t: 'r', x: 1, y: 2, w: 2, h: 5, col: GLOVE, shade: GLOVE_SHADE },
        { t: 'e', cx: 5, cy: 4.5, rx: 3, ry: 3, col: GLOVE, shade: GLOVE_SHADE },
      ]
    case 'shoe':
      return [
        { t: 'e', cx: 5.5, cy: 3, rx: 4, ry: 2, col: SHOE, shade: SHOE_SHADE },
        { t: 'r', x: 2, y: 4, w: 8, h: 1, col: SOLE },
      ]
    case 'star':
      return [
        { t: 'r', x: 4, y: 1, w: 1, h: 7, col: STAR },
        { t: 'r', x: 1, y: 3, w: 7, h: 1, col: STAR },
        { t: 'r', x: 3, y: 2, w: 3, h: 4, col: STAR },
        { t: 'r', x: 2, y: 6, w: 1, h: 1, col: STAR },
        { t: 'r', x: 6, y: 6, w: 1, h: 1, col: STAR },
      ]
    case 'puff':
      return [{ t: 'e', cx: 3.5, cy: 3.5, rx: 2.5, ry: 2.5, col: CLOUD, shade: CLOUD_SHADE }]
    case 'smoke':
      return [
        { t: 'e', cx: 4.5, cy: 4.5, rx: 3.5, ry: 3, col: SMOKE, noOutline: true },
        { t: 'e', cx: 3.5, cy: 3.5, rx: 1.5, ry: 1.2, col: SMOKE_LIGHT, noOutline: true },
      ]
    case 'tinyStar':
      return [
        { t: 'r', x: 2, y: 1, w: 1, h: 3, col: STAR },
        { t: 'r', x: 1, y: 2, w: 3, h: 1, col: STAR },
      ]
  }
}

/** A starburst: four rays that lengthen frame by frame, diagonal sparks from frame 2, a bright core. */
function spark(frame: number): Part[] {
  const c = 7
  const len = 2 + frame
  const parts: Part[] = [
    { t: 'r', x: c - len, y: c, w: len * 2 + 1, h: 1, col: SPARK },
    { t: 'r', x: c, y: c - len, w: 1, h: len * 2 + 1, col: SPARK },
  ]
  if (frame > 0) {
    const d = frame + 1
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      parts.push({ t: 'r', x: c + sx * d, y: c + sy * d, w: 1, h: 1, col: SPARK })
    }
  }
  parts.push({ t: 'r', x: c - 1, y: c - 1, w: 3, h: 3, col: SPARK_CORE })
  return parts
}
