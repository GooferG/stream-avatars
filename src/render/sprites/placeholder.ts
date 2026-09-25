import {
  ANIMATIONS,
  FRAME_SIZE,
  SHEET_HEIGHT,
  SHEET_WIDTH,
  type AnimationSpec,
  type AnimName,
} from './contract'

/**
 * Runtime-generated grayscale sprite sheets that follow the exact same
 * contract as future hand-drawn PNGs. Three body types (slime, bot, ghost)
 * and four accessories (cap, bow, glasses, scarf). White/gray areas take
 * the per-avatar tint; black stays black.
 */

const OUTLINE = '#000000'
const MAIN = '#ffffff'
const SHADE = '#9c9c9c'

interface Pose {
  /** Vertical offset for the whole character (negative = up / airborne). */
  dy: number
  /** Pixels removed from the top of the body (landing/crouch squash). */
  squash: number
  /** 0 = feet together, 1 = left forward, 2 = right forward. */
  leg: number
  mouthOpen: boolean
}

function pose(dy = 0, squash = 0, leg = 0, mouthOpen = false): Pose {
  return { dy, squash, leg, mouthOpen }
}

const POSES: Record<AnimName, Pose[]> = {
  idle: [pose(0), pose(-1), pose(-1), pose(0)],
  walk: [pose(0, 0, 1), pose(-1), pose(0, 0, 2), pose(0, 0, 1), pose(-1), pose(0, 0, 2)],
  jump: [pose(2, 3), pose(-3), pose(-6), pose(-6), pose(-3), pose(2, 3)],
  talk: [pose(0), pose(0, 0, 0, true), pose(0), pose(0, 0, 0, true)],
  cheer: [pose(0), pose(-3, 0, 0, true), pose(-4, 0, 0, true), pose(-2)],
  sad: [pose(1, 2), pose(1, 2), pose(2, 3), pose(2, 3)],
}

type Painter = (ctx: CanvasRenderingContext2D, p: Pose) => void

/** Rect with 1px cut corners; reads as a rounded pixel blob. */
function blob(
  ctx: CanvasRenderingContext2D,
  color: string,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): void {
  ctx.fillStyle = color
  ctx.fillRect(x0 + 1, y0, x1 - x0 - 1, 1)
  ctx.fillRect(x0, y0 + 1, x1 - x0 + 1, y1 - y0 - 1)
  ctx.fillRect(x0 + 1, y1, x1 - x0 - 1, 1)
}

function eyes(ctx: CanvasRenderingContext2D, y: number): void {
  ctx.fillStyle = OUTLINE
  ctx.fillRect(14, y, 2, 2)
  ctx.fillRect(19, y, 2, 2)
}

function mouth(ctx: CanvasRenderingContext2D, y: number, open: boolean): void {
  ctx.fillStyle = OUTLINE
  if (open) ctx.fillRect(16, y, 3, 3)
  else ctx.fillRect(16, y, 3, 1)
}

const slime: Painter = (ctx, p) => {
  const t = 13 + p.squash
  // stepped dome silhouette: narrow crown widening to the base
  ctx.fillStyle = OUTLINE
  ctx.fillRect(12, t, 10, 29 - t)
  ctx.fillRect(10, t + 2, 14, 27 - t)
  ctx.fillRect(9, t + 4, 16, 25 - t)
  ctx.fillStyle = MAIN
  ctx.fillRect(13, t + 1, 8, 27 - t)
  ctx.fillRect(11, t + 3, 12, 25 - t)
  ctx.fillRect(10, t + 5, 14, 23 - t)
  ctx.fillStyle = SHADE
  ctx.fillRect(11, 24, 4, 3)
  eyes(ctx, t + 6)
  mouth(ctx, t + 11, p.mouthOpen)
}

const bot: Painter = (ctx, p) => {
  const top = 12 + p.squash
  // antenna
  ctx.fillStyle = OUTLINE
  ctx.fillRect(15, top - 5, 2, 5)
  ctx.fillRect(14, top - 7, 4, 3)
  ctx.fillStyle = SHADE
  ctx.fillRect(15, top - 6, 2, 1)
  // body
  blob(ctx, OUTLINE, 9, top, 23, 26)
  blob(ctx, MAIN, 10, top + 1, 22, 25)
  ctx.fillStyle = SHADE
  ctx.fillRect(11, 21, 4, 3)
  eyes(ctx, top + 4)
  mouth(ctx, top + 9, p.mouthOpen)
  // feet, alternating with the walk cycle
  const leftX = p.leg === 1 ? 13 : 11
  const rightX = p.leg === 2 ? 20 : 18
  ctx.fillStyle = OUTLINE
  ctx.fillRect(leftX, 27, 3, 2)
  ctx.fillRect(rightX, 27, 3, 2)
}

const ghost: Painter = (ctx, p) => {
  const top = 7 + p.squash
  blob(ctx, OUTLINE, 9, top, 23, 25)
  blob(ctx, MAIN, 10, top + 1, 22, 25)
  // scalloped hem
  ctx.fillStyle = OUTLINE
  ctx.fillRect(10, 26, 3, 2)
  ctx.fillRect(15, 26, 3, 2)
  ctx.fillRect(20, 26, 3, 2)
  ctx.fillStyle = MAIN
  ctx.fillRect(11, 26, 1, 1)
  ctx.fillRect(16, 26, 1, 1)
  ctx.fillRect(21, 26, 1, 1)
  ctx.fillStyle = SHADE
  ctx.fillRect(11, 21, 4, 4)
  eyes(ctx, top + 6)
  mouth(ctx, top + 11, p.mouthOpen)
}

const BODY_PAINTERS: Painter[] = [slime, bot, ghost]

// Accessories align to a nominal head area around y 12-20 (body origin,
// not body shape, per the contract) and ride the same pose offsets.
const cap: Painter = (ctx, p) => {
  const y = 9 + p.squash
  blob(ctx, OUTLINE, 9, y, 23, y + 4)
  blob(ctx, MAIN, 10, y + 1, 22, y + 3)
  ctx.fillStyle = OUTLINE
  ctx.fillRect(22, y + 3, 5, 2)
  ctx.fillStyle = SHADE
  ctx.fillRect(23, y + 3, 3, 1)
}

const bow: Painter = (ctx, p) => {
  const y = 8 + p.squash
  ctx.fillStyle = OUTLINE
  ctx.fillRect(10, y, 8, 5)
  ctx.fillStyle = MAIN
  ctx.fillRect(11, y + 1, 2, 3)
  ctx.fillRect(15, y + 1, 2, 3)
  ctx.fillStyle = SHADE
  ctx.fillRect(13, y + 1, 2, 3)
}

const glasses: Painter = (ctx, p) => {
  const y = 16 + p.squash
  ctx.fillStyle = OUTLINE
  ctx.fillRect(12, y, 10, 4)
  ctx.fillStyle = MAIN
  ctx.fillRect(13, y + 1, 3, 2)
  ctx.fillRect(18, y + 1, 3, 2)
}

const scarf: Painter = (ctx, p) => {
  const y = 23 + p.squash
  blob(ctx, OUTLINE, 9, y, 23, y + 3)
  ctx.fillStyle = MAIN
  ctx.fillRect(10, y + 1, 12, 1)
  ctx.fillStyle = OUTLINE
  ctx.fillRect(8, y + 1, 3, 5)
  ctx.fillStyle = SHADE
  ctx.fillRect(9, y + 2, 1, 3)
}

const ACCESSORY_PAINTERS: Painter[] = [cap, bow, glasses, scarf]

function paintSheet(painter: Painter): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = SHEET_WIDTH
  canvas.height = SHEET_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2d canvas context unavailable')

  for (const [anim, spec] of Object.entries(ANIMATIONS) as [AnimName, AnimationSpec][]) {
    const poses = POSES[anim]
    for (let frame = 0; frame < spec.frames; frame++) {
      const framePose = poses[frame] ?? pose()
      ctx.save()
      ctx.translate(frame * FRAME_SIZE, spec.row * FRAME_SIZE + framePose.dy)
      painter(ctx, framePose)
      ctx.restore()
    }
  }
  return canvas
}

export function paintBodySheet(bodyIndex: number): HTMLCanvasElement {
  const painter = BODY_PAINTERS[bodyIndex % BODY_PAINTERS.length]
  if (!painter) throw new Error(`no body painter for index ${bodyIndex}`)
  return paintSheet(painter)
}

export function paintAccessorySheet(accessoryIndex: number): HTMLCanvasElement {
  const painter = ACCESSORY_PAINTERS[accessoryIndex % ACCESSORY_PAINTERS.length]
  if (!painter) throw new Error(`no accessory painter for index ${accessoryIndex}`)
  return paintSheet(painter)
}
