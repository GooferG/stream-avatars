import {
  ANIM_NAMES,
  ANIMATIONS,
  EYE_LINE,
  FRAME_SIZE,
  SHEET_HEIGHT,
  SHEET_WIDTH,
  type AnimName,
} from './contract'

/**
 * Runtime-generated grayscale sprite sheets that follow the exact same
 * contract as hand-drawn PNGs. Three body types (slime, bot, ghost) with
 * always-visible arms, and four accessories (cap, bow, glasses, scarf).
 * White/gray areas take the per-avatar tint; black stays black.
 */

const OUTLINE = '#000000'
const MAIN = '#ffffff'
const SHADE = '#9c9c9c'

/** Arm pose for the whole character; ARM_POSES maps it to a shape per side. */
export type Arms = 'down' | 'swingA' | 'swingB' | 'mid' | 'up' | 'gesture' | 'limp'
export type Face = 'normal' | 'talk' | 'happy' | 'grin' | 'sad'

export interface Pose {
  /** Vertical offset for the whole character (negative = up / airborne). */
  dy: number
  /** Pixels removed from the top of the body (landing/crouch squash, slump). */
  squash: number
  /** 0 = feet together, 1 = left forward, 2 = right forward. */
  leg: number
  arms: Arms
  face: Face
}

function pose(
  dy = 0,
  squash = 0,
  extra: Partial<Pick<Pose, 'leg' | 'arms' | 'face'>> = {},
): Pose {
  return { dy, squash, leg: 0, arms: 'down', face: 'normal', ...extra }
}

export const POSES: Record<AnimName, Pose[]> = {
  idle: [pose(0), pose(-1), pose(-1), pose(0)],
  walk: [
    pose(0, 0, { leg: 1, arms: 'swingA' }),
    pose(-1),
    pose(0, 0, { leg: 2, arms: 'swingB' }),
    pose(0, 0, { leg: 1, arms: 'swingA' }),
    pose(-1),
    pose(0, 0, { leg: 2, arms: 'swingB' }),
  ],
  jump: [
    pose(2, 3),
    pose(-3, 0, { arms: 'mid' }),
    pose(-6, 0, { arms: 'up' }),
    pose(-6, 0, { arms: 'up' }),
    pose(-3, 0, { arms: 'mid' }),
    pose(2, 3),
  ],
  talk: [
    pose(0),
    pose(0, 0, { arms: 'gesture', face: 'talk' }),
    pose(0),
    pose(0, 0, { arms: 'gesture', face: 'talk' }),
  ],
  cheer: [
    pose(0, 0, { arms: 'mid', face: 'happy' }),
    pose(-3, 0, { arms: 'up', face: 'grin' }),
    pose(-4, 0, { arms: 'up', face: 'grin' }),
    pose(-2, 0, { arms: 'mid', face: 'happy' }),
  ],
  sad: [
    pose(1, 2, { arms: 'limp', face: 'sad' }),
    pose(1, 2, { arms: 'limp', face: 'sad' }),
    pose(2, 3, { arms: 'limp', face: 'sad' }),
    pose(2, 3, { arms: 'limp', face: 'sad' }),
  ],
}

// ---- arms -------------------------------------------------------------

type ArmShape = 'down' | 'raised' | 'mid' | 'up' | 'limp'
type Cell = [dx: number, dy: number, w: number, h: number]

/** Left arm, relative to the body's left edge and shoulder line; the right arm mirrors it. */
const ARM_SHAPES: Record<ArmShape, { outline: Cell[]; fill: Cell[] }> = {
  down: { outline: [[-2, -1, 3, 7]], fill: [[-1, 0, 1, 5]] },
  raised: {
    outline: [[-2, -1, 3, 3], [-3, 1, 3, 4]],
    fill: [[-1, 0, 1, 1], [-2, 2, 1, 2]],
  },
  mid: {
    outline: [[-2, -1, 3, 3], [-4, -2, 3, 3], [-7, -4, 4, 4]],
    fill: [[-1, 0, 1, 1], [-3, -1, 1, 1], [-6, -3, 2, 2]],
  },
  up: {
    outline: [[-2, -1, 3, 3], [-3, -3, 3, 3], [-4, -5, 3, 3], [-6, -9, 4, 5]],
    fill: [[-1, 0, 1, 1], [-2, -2, 1, 1], [-3, -4, 1, 1], [-5, -8, 2, 3]],
  },
  limp: { outline: [[-2, 0, 3, 6]], fill: [[-1, 1, 1, 4]] },
}

const ARM_POSES: Record<Arms, [left: ArmShape, right: ArmShape]> = {
  down: ['down', 'down'],
  swingA: ['raised', 'down'],
  swingB: ['down', 'raised'],
  mid: ['mid', 'mid'],
  up: ['up', 'up'],
  gesture: ['down', 'mid'],
  limp: ['limp', 'limp'],
}

export interface PixelRect {
  x: number
  y: number
  w: number
  h: number
  ink: 'outline' | 'main'
}

/** Both arms as frame-pixel rects (before the pose's dy), outlines first so fills sit on top. */
export function armRects(arms: Arms, geo: BodyGeometry): PixelRect[] {
  const rects: PixelRect[] = []
  const [leftShape, rightShape] = ARM_POSES[arms]
  for (const ink of ['outline', 'main'] as const) {
    for (const [shape, side] of [[leftShape, 'left'], [rightShape, 'right']] as const) {
      const cells = ink === 'outline' ? ARM_SHAPES[shape].outline : ARM_SHAPES[shape].fill
      for (const [dx, dy, w, h] of cells) {
        const x = side === 'left' ? geo.left + dx : geo.right - dx - w + 1
        rects.push({ x, y: geo.shoulderY + dy, w, h, ink })
      }
    }
  }
  return rects
}

// ---- faces ------------------------------------------------------------

/** Eyes at x 14 and 19 on every body; the mouth sits 5px below the eye line. */
function drawFace(ctx: CanvasRenderingContext2D, eyeY: number, face: Face): void {
  const px = (x: number, y: number, w = 1, h = 1) => ctx.fillRect(x, y, w, h)
  ctx.fillStyle = OUTLINE
  switch (face) {
    case 'happy':
    case 'grin':
      // ^ ^ eyes
      px(14, eyeY + 1); px(15, eyeY); px(16, eyeY + 1)
      px(19, eyeY + 1); px(20, eyeY); px(21, eyeY + 1)
      if (face === 'grin') {
        px(15, eyeY + 4, 5, 1); px(16, eyeY + 5, 3, 1)
      } else {
        px(15, eyeY + 4); px(16, eyeY + 5, 3, 1); px(19, eyeY + 4)
      }
      return
    case 'sad':
      // droopy eyes, worried brows (inner ends raised), frown, tear
      px(14, eyeY + 1, 2, 1); px(19, eyeY + 1, 2, 1)
      px(14, eyeY - 1); px(15, eyeY - 2); px(20, eyeY - 1); px(19, eyeY - 2)
      px(16, eyeY + 5, 3, 1); px(15, eyeY + 6); px(19, eyeY + 6)
      px(11, eyeY + 2, 3, 4)
      ctx.fillStyle = MAIN
      px(12, eyeY + 3, 1, 2)
      return
    default:
      px(14, eyeY, 2, 2); px(19, eyeY, 2, 2)
      if (face === 'talk') px(16, eyeY + 5, 3, 3)
      else px(16, eyeY + 5, 3, 1)
  }
}

// ---- bodies -----------------------------------------------------------

export interface BodyGeometry {
  /** Outline columns of the body at shoulder height; arms attach outside them. */
  left: number
  right: number
  shoulderY: number
  eyeY: number
}

export interface Body {
  geometry(p: Pose): BodyGeometry
  paint(ctx: CanvasRenderingContext2D, p: Pose): void
}

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

const slime: Body = {
  geometry: (p) => ({ left: 9, right: 24, shoulderY: 21 + p.squash, eyeY: EYE_LINE + p.squash }),
  paint(ctx, p) {
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
  },
}

const bot: Body = {
  geometry: (p) => ({ left: 9, right: 23, shoulderY: 19 + p.squash, eyeY: EYE_LINE + p.squash }),
  paint(ctx, p) {
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
    // feet, alternating with the walk cycle
    const leftX = p.leg === 1 ? 13 : 11
    const rightX = p.leg === 2 ? 20 : 18
    ctx.fillStyle = OUTLINE
    ctx.fillRect(leftX, 27, 3, 2)
    ctx.fillRect(rightX, 27, 3, 2)
  },
}

const ghost: Body = {
  geometry: (p) => ({ left: 9, right: 23, shoulderY: 16 + p.squash, eyeY: EYE_LINE + p.squash }),
  paint(ctx, p) {
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
  },
}

export const BODIES: Body[] = [slime, bot, ghost]

type Painter = (ctx: CanvasRenderingContext2D, p: Pose) => void

/** Arms first so the body outline covers each shoulder joint, then body, then face. */
function bodyPainter(body: Body): Painter {
  return (ctx, p) => {
    const geo = body.geometry(p)
    for (const r of armRects(p.arms, geo)) {
      ctx.fillStyle = r.ink === 'outline' ? OUTLINE : MAIN
      ctx.fillRect(r.x, r.y, r.w, r.h)
    }
    body.paint(ctx, p)
    drawFace(ctx, geo.eyeY, p.face)
  }
}

const BODY_PAINTERS: Painter[] = BODIES.map(bodyPainter)

// ---- accessories ------------------------------------------------------

// Accessories align to the body origin, not the body shape (per the
// contract): hats and bows to a nominal head top, glasses to EYE_LINE.
// They ride the same pose offsets.
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

/** Shades: the frame starts one row above EYE_LINE so the lenses cover the eyes on every body. */
const glasses: Painter = (ctx, p) => {
  const y = EYE_LINE - 1 + p.squash
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

// ---- sheets -----------------------------------------------------------

function paintSheet(painter: Painter): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = SHEET_WIDTH
  canvas.height = SHEET_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2d canvas context unavailable')

  for (const anim of ANIM_NAMES) {
    const { row } = ANIMATIONS[anim]
    POSES[anim].forEach((framePose, frame) => {
      ctx.save()
      ctx.translate(frame * FRAME_SIZE, row * FRAME_SIZE)
      // never paint into a neighbouring frame, whatever the pose offset
      ctx.beginPath()
      ctx.rect(0, 0, FRAME_SIZE, FRAME_SIZE)
      ctx.clip()
      ctx.translate(0, framePose.dy)
      painter(ctx, framePose)
      ctx.restore()
    })
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
