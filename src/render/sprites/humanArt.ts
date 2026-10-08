import { faceParts } from './faces'
import { darken, partCenter, type Part } from './pixelKit'
import type { Arms, Pose } from './poses'
import type { AccessoryName, Build, HairStyle, HumanLayer } from './roster'

/**
 * Chibi humans as part geometry, one function per layer sheet. Tinted
 * layers (shirt, skin, hair, accessory) are painted in grays: white takes
 * the tint, gray shades it, black outlines stay black. Pants and the face
 * are fixed layers painted in final colors.
 */
export const TINT_MAIN = '#ffffff'
export const TINT_SHADE = '#c4c4c4'
const SKIN_SHADE = '#dcdcdc'
const HAIR_SHADE = '#c8c8c8'
const PANTS = '#3b4a6b'
const SHOES = '#3a2a2a'
const LENS = '#707070'

const CX = 24
/** Shared by every build so hair, face and accessories fit all of them. */
export const HEAD = { y: 16, rx: 8.5, ry: 8 } as const
const TORSO_Y = 33
const LEG_TOP = 36
const LEG_BOT = 44
/** Last painted row of the feet; their outline lands on the ground row, 46. */
const FEET_BOTTOM = LEG_BOT + 1
/** Sitting lowers a human's upper body this far, so the hips meet the ground. */
const SEAT_DROP = 4

/** How far a pose sinks the head, torso and arms: its squash, plus the seat when seated. */
const sink = (pose: Pose): number => pose.squash + (pose.seated ? SEAT_DROP : 0)

interface BuildShape {
  rx: number
  ry: number
  arm: number
  leg: number
}

const BUILD_SHAPES: Record<Build, BuildShape> = {
  skinny: { rx: 4.5, ry: 6, arm: 2, leg: 2 },
  average: { rx: 6.5, ry: 6, arm: 3, leg: 3 },
  chubby: { rx: 9, ry: 7, arm: 3, leg: 4 },
}

type ArmShape =
  | 'down'
  | 'swing'
  | 'mid'
  | 'up'
  | 'limp'
  | 'reach'
  | 'forward'
  | 'front'
  | 'frontOpen'
  | 'waveOut'
  | 'waveIn'
  | 'mouth'
  | 'holdLow'
const ARM_SHAPES: Record<Arms, [left: ArmShape, right: ArmShape]> = {
  down: ['down', 'down'],
  swingA: ['swing', 'down'],
  swingB: ['down', 'swing'],
  mid: ['mid', 'mid'],
  up: ['up', 'up'],
  limp: ['limp', 'limp'],
  reachUp: ['down', 'reach'],
  hug: ['front', 'forward'],
  clap: ['front', 'front'],
  clapOpen: ['frontOpen', 'frontOpen'],
  waveA: ['down', 'waveOut'],
  waveB: ['down', 'waveIn'],
  toMouth: ['down', 'mouth'],
  holdFront: ['holdLow', 'holdLow'],
}

/** Sleeve (shirt layer) and hand (skin layer) for one arm; `over` arms cross in front of the torso and draw on top. */
interface ArmParts {
  sleeve: Part
  hand: Part
  over: boolean
}

function arm(shape: ArmShape, side: -1 | 1, b: BuildShape, u: number): ArmParts {
  const top = TORSO_Y - b.ry + 1 + u
  const len = Math.round(b.ry * 1.5)
  const shoulder = CX + side * b.rx
  const x = side < 0 ? Math.round(CX - b.rx - b.arm) : Math.round(CX + b.rx)
  const cloth = { col: TINT_MAIN, shade: TINT_SHADE }
  const hand = (cx: number, cy: number): Part => ({ t: 'e', cx, cy, rx: 1.5, ry: 1.5, col: TINT_MAIN })
  /** A raised forearm and hand (skin), clear of the head so it reads as a hand up. */
  const raised = (dx: number, dy: number): Part => ({ t: 'e', cx: shoulder + side * dx, cy: top + dy, rx: 1.5, ry: 3, col: TINT_MAIN })
  const upperArm = (dx: number): Part => ({ t: 'e', cx: shoulder + side * dx, cy: top - 3, rx: b.arm / 2 + 1, ry: 4, ...cloth })
  /** An arm across the body to a hand in front of it, outlined over the torso. */
  const across = (handX: number, handY: number): ArmParts => ({
    sleeve: {
      t: 'e',
      cx: (shoulder + handX) / 2,
      cy: (top + 2 + handY) / 2,
      rx: Math.abs(shoulder - handX) / 2 + 1,
      ry: b.arm / 2 + 1,
      ...cloth,
      onTop: true,
    },
    hand: hand(handX, handY),
    over: true,
  })
  switch (shape) {
    case 'mid':
      return {
        sleeve: { t: 'e', cx: shoulder + side * 3.5, cy: top + 2, rx: 3.5, ry: b.arm / 2 + 0.5, ...cloth },
        hand: hand(shoulder + side * 7, top + 1.5),
        over: false,
      }
    case 'up':
      return {
        sleeve: { t: 'e', cx: shoulder + side * 3, cy: top - 5, rx: b.arm / 2 + 0.5, ry: 5.5, ...cloth },
        hand: hand(shoulder + side * 4, top - 11),
        over: false,
      }
    case 'reach':
      return { sleeve: upperArm(3.5), hand: raised(6.5, -11), over: false }
    case 'forward':
      return {
        sleeve: { t: 'e', cx: shoulder + side * 4, cy: top + 2, rx: 4.5, ry: b.arm / 2 + 0.5, ...cloth },
        hand: hand(shoulder + side * 8.5, top + 2),
        over: false,
      }
    case 'waveOut':
      return { sleeve: upperArm(4), hand: raised(8, -10), over: false }
    case 'waveIn':
      return { sleeve: upperArm(3), hand: raised(5.5, -11), over: false }
    case 'front':
      return across(CX + side * 1.5, top + 2)
    case 'frontOpen':
      return across(CX + side * 4.5, top + 2)
    case 'holdLow':
      return across(CX + side * 3, top + 6)
    case 'mouth': {
      // the forearm up the chest to the mouth; the hand is outlined over the head's edge
      const handY = HEAD.y + 5 + u
      return {
        sleeve: { t: 'e', cx: CX + 7, cy: (top + 3 + handY) / 2, rx: b.arm / 2 + 0.5, ry: (top + 3 - handY) / 2 + 1, ...cloth, onTop: true },
        hand: { ...hand(CX + 6.5, handY), onTop: true },
        over: true,
      }
    }
    default: {
      // hanging arms: swing steps out and shortens, limp hangs lower and closer
      const dx = shape === 'swing' ? side : shape === 'limp' ? -side : 0
      const dy = shape === 'limp' ? 1 : 0
      const h = shape === 'swing' ? len - 1 : len
      return {
        sleeve: { t: 'r', x: x + dx, y: top + dy, w: b.arm, h, ...cloth },
        hand: { t: 'r', x: x + dx, y: top + dy + h - 2, w: b.arm, h: 2, col: TINT_MAIN },
        over: false,
      }
    }
  }
}

/** Pants/shoes, shirt (torso + sleeves) or skin (head + hands) for one build. */
export function humanBodyParts(layer: HumanLayer, build: Build, pose: Pose): Part[] {
  const b = BUILD_SHAPES[build]
  const u = sink(pose)
  if (layer === 'pants') {
    if (pose.seated) return seatedLegs(b)
    const legs: Part[] = []
    for (const side of [-1, 1] as const) {
      const lifted = (pose.leg === 1 && side < 0) || (pose.leg === 2 && side > 0) ? 1 : 0
      const x = side < 0 ? CX - 1 - b.leg : CX + 1
      legs.push({ t: 'r', x, y: LEG_TOP, w: b.leg, h: LEG_BOT - LEG_TOP - lifted, col: PANTS, shade: darken(PANTS, 0.2) })
      legs.push({ t: 'r', x, y: LEG_BOT - lifted, w: b.leg + 1, h: 2, col: SHOES })
    }
    return legs
  }
  const [leftShape, rightShape] = ARM_SHAPES[pose.arms]
  const arms = [arm(leftShape, -1, b, u), arm(rightShape, 1, b, u)]
  if (layer === 'shirt') {
    // arms held across the body draw over the torso; the rest hang behind it
    return [
      ...arms.filter((a) => !a.over).map((a) => a.sleeve),
      { t: 'e', cx: CX, cy: TORSO_Y + u, rx: b.rx, ry: b.ry, col: TINT_MAIN, shade: TINT_SHADE },
      ...arms.filter((a) => a.over).map((a) => a.sleeve),
    ]
  }
  // skin: head first (tests rely on it), hands after so raised hands show over the head's edge
  return [
    { t: 'e', cx: CX, cy: HEAD.y + u, rx: HEAD.rx, ry: HEAD.ry, col: TINT_MAIN, shade: SKIN_SHADE },
    ...arms.map((a) => a.hand),
  ]
}

/** The center of a hand (side 1 is the front one), for the prop layer. */
export function humanHandSpot(build: Build, pose: Pose, side: -1 | 1): { x: number; y: number } {
  const [left, right] = ARM_SHAPES[pose.arms]
  return partCenter(arm(side < 0 ? left : right, side, BUILD_SHAPES[build], sink(pose)).hand)
}

/** The right end of the mouth (see humanFaceParts), where a joint goes. */
export function humanMouthSpot(pose: Pose): { x: number; y: number } {
  return { x: CX + 3, y: HEAD.y + 5 + sink(pose) }
}

/** Both legs out in front along the ground, shoes up; the far leg a row higher, behind the near one. */
function seatedLegs(b: BuildShape): Part[] {
  const pants = { col: PANTS, shade: darken(PANTS, 0.2) }
  const legY = FEET_BOTTOM + 1 - b.leg
  return [
    { t: 'r', x: CX - 3, y: legY - 1, w: 10, h: b.leg, ...pants },
    { t: 'r', x: CX + 7, y: legY - 4, w: 2, h: b.leg + 3, col: SHOES },
    { t: 'r', x: CX - 2, y: legY, w: 11, h: b.leg, ...pants },
    { t: 'r', x: CX + 9, y: legY - 3, w: 2, h: b.leg + 3, col: SHOES },
  ]
}

/** The human face, looking a little to the right (the walking direction). */
export function humanFaceParts(pose: Pose): Part[] {
  const eyeY = HEAD.y + 1 + sink(pose)
  return faceParts(pose.face, {
    eyeL: CX, eyeR: CX + 4, eyeY, mouthX: CX + 2, mouthY: eyeY + 4, blush: true, mouth: true,
  })
}

/** Front hair, or (back = true) the part behind the head; only long hair has one. */
export function hairParts(style: HairStyle, back: boolean, pose: Pose): Part[] {
  const u = sink(pose)
  const hair = { col: TINT_MAIN, shade: HAIR_SHADE }
  if (back) {
    if (style !== 'long') return []
    const strandH = Math.round(HEAD.ry + 4)
    return [
      { t: 'e', cx: CX, cy: HEAD.y + u - 0.5, rx: HEAD.rx + 1.5, ry: HEAD.ry + 1, ...hair },
      { t: 'r', x: Math.round(CX - HEAD.rx - 1.5), y: HEAD.y + u, w: 3, h: strandH, ...hair },
      { t: 'r', x: Math.round(CX + HEAD.rx - 1.5), y: HEAD.y + u, w: 3, h: strandH, ...hair },
    ]
  }
  const top: Part = { t: 'e', cx: CX - 0.5, cy: HEAD.y + u - HEAD.ry * 0.55, rx: HEAD.rx + 0.5, ry: HEAD.ry * 0.5, ...hair }
  switch (style) {
    case 'short':
      return [
        top,
        { t: 'r', x: Math.round(CX - HEAD.rx - 0.5), y: HEAD.y + u - 3, w: 2, h: 3, ...hair },
        { t: 'r', x: Math.round(CX + HEAD.rx - 1.5), y: HEAD.y + u - 3, w: 2, h: 3, ...hair },
      ]
    case 'long':
      return [top]
    case 'bun':
      return [top, { t: 'e', cx: CX - 2, cy: HEAD.y + u - HEAD.ry - 0.5, rx: 2.5, ry: 2, ...hair }]
    case 'spiky': {
      const spikeTop = Math.round(HEAD.y + u - HEAD.ry * 0.55 - HEAD.ry * 0.5 - 2)
      return [
        ...[-1, 0, 1].map((i): Part => ({ t: 't', cx: CX + i * 3.5, top: spikeTop, h: 3, w: 3, col: TINT_MAIN })),
        top,
      ]
    }
  }
}

/** Accessories sit on the shared head, so they fit every build. */
export function accessoryParts(name: AccessoryName, pose: Pose): Part[] {
  const u = sink(pose)
  const accent = { col: TINT_MAIN, shade: TINT_SHADE }
  switch (name) {
    case 'cap':
      return [
        { t: 'e', cx: CX - 0.5, cy: HEAD.y + u - HEAD.ry * 0.6, rx: HEAD.rx + 1, ry: HEAD.ry * 0.45, ...accent },
        { t: 'r', x: CX + 2, y: HEAD.y + u - 4, w: 9, h: 2, ...accent },
      ]
    case 'bow':
      return [
        { t: 'e', cx: CX - 6, cy: HEAD.y + u - 7, rx: 2, ry: 1.5, ...accent },
        { t: 'e', cx: CX - 2, cy: HEAD.y + u - 7, rx: 2, ry: 1.5, ...accent },
        { t: 'r', x: CX - 5, y: HEAD.y + u - 8, w: 2, h: 2, col: TINT_SHADE },
      ]
    case 'glasses': {
      const eyeY = HEAD.y + 1 + u
      return [
        { t: 'r', x: CX - 1, y: eyeY - 1, w: 4, h: 4, col: LENS },
        { t: 'r', x: CX + 3, y: eyeY - 1, w: 4, h: 4, col: LENS },
        { t: 'r', x: CX, y: eyeY, w: 1, h: 1, col: TINT_MAIN, noOutline: true },
        { t: 'r', x: CX + 4, y: eyeY, w: 1, h: 1, col: TINT_MAIN, noOutline: true },
      ]
    }
  }
}
