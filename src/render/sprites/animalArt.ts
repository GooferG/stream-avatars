import { faceParts, TEAR } from './faces'
import { TINT_MAIN, TINT_SHADE } from './humanArt'
import { darken, uncovered, type Part } from './pixelKit'
import type { Arms, Pose } from './poses'
import type { Animal } from './roster'

/**
 * Upright chibi animals sharing one body template (so one collar fits all),
 * in two layers. The fur is painted in grays and tinted with the fur color
 * (natural or picked), and it draws the whole silhouette and its outline.
 * The details go on top in final colors, without outlines: face, nose, beak,
 * feet, and the belly and muzzle as see-through white over flat fur, which
 * lightens any fur color the same way. The collar is a third layer, tinted
 * with the chatter's color.
 */
const FUR = TINT_MAIN
/** Multiplied by the fur color, these give darken(fur, 0.25) and darken(fur, 0.3). */
const FUR_SHADE = '#bfbfbf'
const DOG_EAR = '#b3b3b3'
/** White at 55% over flat fur is exactly lighten(fur, 0.55), whatever the fur color. */
const BELLY = 'rgba(255, 255, 255, 0.55)'
/** Whiskers reach past the head, so they're opaque: the natural cat's lighten(fur, 0.8). */
const WHISKER = '#fcecdb'
/** A penguin's face and front: nearly white, with a hint of the fur color. */
const PENGUIN_WHITE = 'rgba(255, 255, 255, 0.92)'
const BEAK = '#f39c34'
const PINK = '#f5a0b8'
const NOSE = '#1a1020'
const WHITE = '#ffffff'

/** Birds talk with their beak, so their face has no mouth; they also get beak-colored feet. */
const BIRDS: readonly Animal[] = ['duck', 'penguin']

const CX = 24
const HEAD_Y = 21.5
const BODY_Y = 35
const COLLAR_Y = 28

type PawShape = 'down' | 'swing' | 'mid' | 'up' | 'limp'
const PAW_SHAPES: Record<Arms, [left: PawShape, right: PawShape]> = {
  down: ['down', 'down'],
  swingA: ['swing', 'down'],
  swingB: ['down', 'swing'],
  mid: ['mid', 'mid'],
  up: ['up', 'up'],
  limp: ['limp', 'limp'],
}

/** A paw, or for a penguin a flipper: narrower and longer. */
function paw(shape: PawShape, side: -1 | 1, u: number, flipper: boolean): Part {
  const at = (dx: number, cy: number, rx: number, ry: number): Part => ({
    t: 'e',
    cx: CX + side * dx,
    cy: cy + u,
    rx: flipper ? rx - 0.5 : rx,
    ry: flipper ? ry + 1 : ry,
    col: FUR,
    shade: FUR_SHADE,
  })
  switch (shape) {
    case 'swing': return at(8, 32, 2, 3)
    case 'mid': return at(9.5, 31, 2.5, 2)
    case 'up': return at(7, 25, 2, 3.5)
    case 'limp': return at(7, 35, 2, 3)
    default: return at(7.5, 33, 2, 3)
  }
}

const flat = (p: Part): Part => ({ ...p, noOutline: true })
const paws = (kind: Animal, pose: Pose): Part[] => {
  const [left, right] = PAW_SHAPES[pose.arms]
  return [paw(left, -1, pose.squash, kind === 'penguin'), paw(right, 1, pose.squash, kind === 'penguin')]
}
const cottontail = (u: number): Part => ({ t: 'e', cx: CX - 8, cy: 38 + u, rx: 2.5, ry: 2.5, col: WHITE })
const body = (u: number): Part => ({ t: 'e', cx: CX, cy: BODY_Y + u, rx: 7, ry: 7.5, col: FUR, shade: FUR_SHADE })
const feet = (pose: Pose): Part[] => [
  { t: 'e', cx: CX - 3.5, cy: 43.5 - (pose.leg === 1 ? 1 : 0), rx: 2.5, ry: 1.5, col: FUR },
  { t: 'e', cx: CX + 3.5, cy: 43.5 - (pose.leg === 2 ? 1 : 0), rx: 2.5, ry: 1.5, col: FUR },
]
const beak = (kind: Animal, u: number): Part =>
  kind === 'duck'
    ? { t: 'e', cx: CX + 8, cy: 23 + u, rx: 4, ry: 2, col: FUR }
    : { t: 'e', cx: CX + 8.5, cy: 23.5 + u, rx: 2.5, ry: 1.5, col: FUR }

/** The see-through white patches: belly and muzzle, or a penguin's face and front. */
function lightPatches(kind: Animal, u: number): Part[] {
  if (kind === 'penguin') {
    return [
      flat({ t: 'e', cx: CX + 1.5, cy: 22 + u, rx: 6, ry: 5, col: PENGUIN_WHITE }),
      flat({ t: 'e', cx: CX + 0.5, cy: 36 + u, rx: 5.5, ry: 6, col: PENGUIN_WHITE }),
    ]
  }
  const patches = [flat({ t: 'e', cx: CX + 0.5, cy: 36 + u, rx: 4, ry: 4.5, col: BELLY })]
  if (kind === 'dog' || kind === 'bear' || kind === 'fox' || kind === 'cat') {
    patches.push(flat({ t: 'e', cx: CX + 2, cy: 25 + u, rx: kind === 'bear' ? 4 : 3.5, ry: 2.5, col: kind === 'fox' ? WHITE : BELLY }))
  }
  return patches
}

/** The fur layer: every shape of the animal in grays, outlined as one silhouette. */
export function animalFurParts(kind: Animal, pose: Pose): Part[] {
  const u = pose.squash
  const sad = pose.face === 'sad'
  const furPart = { col: FUR, shade: FUR_SHADE }
  const parts: Part[] = []

  // tails, behind everything
  if (kind === 'cat') {
    parts.push({ t: 'r', x: CX - 11, y: 29 + u, w: 2, h: 10, col: FUR })
    parts.push({ t: 'r', x: CX - 13, y: 26 + u, w: 3, h: 4, col: FUR })
  }
  if (kind === 'fox') parts.push({ t: 'e', cx: CX - 10, cy: 34 + u, rx: 4, ry: 6, ...furPart })
  if (kind === 'dog') parts.push({ t: 'e', cx: CX - 9, cy: 32 + u, rx: 2, ry: 3.5, col: FUR })
  if (kind === 'bunny') parts.push({ ...cottontail(u), col: FUR })

  // ears behind the head; sad ones droop
  const droop = sad ? 2 : 0
  if (kind === 'cat') {
    for (const dx of [-5, 5]) parts.push({ t: 't', cx: CX + dx, top: 11 + u + droop, h: 6, w: 6, col: FUR })
  }
  if (kind === 'fox') {
    for (const dx of [-5, 5]) parts.push({ t: 't', cx: CX + dx, top: 9 + u + droop, h: 8, w: 6, col: FUR })
  }
  if (kind === 'bunny') {
    for (const side of [-1, 1]) parts.push({ t: 'e', ...bunnyEar(side, u, sad), rx: 2, col: FUR })
  }
  if (kind === 'bear') for (const dx of [-6.5, 6.5]) parts.push({ t: 'e', cx: CX + dx, cy: 15 + u, rx: 2.5, ry: 2.5, col: FUR })

  // feet, paws/flippers, body, head
  parts.push(...feet(pose))
  parts.push(...paws(kind, pose), body(u))
  const frog = kind === 'frog'
  parts.push({ t: 'e', cx: CX, cy: HEAD_Y + u, rx: frog ? 10 : 8.5, ry: frog ? 6.5 : 7.5, ...furPart })
  if (frog) for (const dx of [-5, 5]) parts.push({ t: 'e', cx: CX + dx, cy: 15 + u, rx: 3, ry: 3, col: FUR })
  if (kind === 'dog') {
    for (const dx of [-8.5, 8.5]) parts.push({ t: 'e', cx: CX + dx, cy: 22 + u + droop, rx: 2.5, ry: 5, col: DOG_EAR })
  }
  if (BIRDS.includes(kind)) parts.push(beak(kind, u))
  if (kind === 'duck') {
    parts.push(flat({ t: 'r', x: CX - 1, y: 12 + u, w: 1, h: 2, col: FUR }))
    parts.push(flat({ t: 'r', x: CX + 1, y: 11 + u, w: 1, h: 3, col: FUR }))
  }
  // flat, unshaded fur under each see-through patch, so the patch lightens the fur evenly
  for (const patch of lightPatches(kind, u)) parts.push({ ...patch, col: FUR })
  return parts
}

/** The details layer: final colors over the fur, and the face. */
export function animalDetailParts(kind: Animal, pose: Pose): Part[] {
  const u = pose.squash
  const sad = pose.face === 'sad'
  const droop = sad ? 2 : 0
  const frog = kind === 'frog'
  const parts: Part[] = []

  // bird feet and the bunny's white tail sit behind the body: only the parts left showing
  if (BIRDS.includes(kind)) {
    for (const foot of feet(pose)) parts.push(...uncovered(flat({ ...foot, col: BEAK }), [body(u)]))
  }
  if (kind === 'bunny') parts.push(...uncovered(flat(cottontail(u)), [...feet(pose), ...paws(kind, pose), body(u)]))
  parts.push(...lightPatches(kind, u))
  if (BIRDS.includes(kind)) parts.push(flat({ ...beak(kind, u), col: BEAK }))
  if (kind === 'cat' || kind === 'fox') {
    parts.push(flat({ t: 'r', x: CX - 6, y: 14 + u + droop, w: 2, h: 2, col: PINK }))
    parts.push(flat({ t: 'r', x: CX + 4, y: 14 + u + droop, w: 2, h: 2, col: PINK }))
  }
  if (kind === 'bunny') {
    for (const side of [-1, 1]) {
      const ear = bunnyEar(side, u, sad)
      parts.push(flat({ t: 'e', cx: ear.cx, cy: ear.cy, rx: 0.8, ry: ear.ry - 1.5, col: PINK }))
    }
  }
  if (frog) {
    parts.push(flat({ t: 'r', x: CX - 6, y: 14 + u, w: 3, h: 3, col: WHITE }))
    parts.push(flat({ t: 'r', x: CX + 4, y: 14 + u, w: 3, h: 3, col: WHITE }))
  }
  if (kind === 'dog' || kind === 'bear' || kind === 'fox') parts.push(flat({ t: 'r', x: CX + 4, y: 24 + u, w: 2, h: 1, col: NOSE }))
  if (kind === 'cat') {
    parts.push(flat({ t: 'r', x: CX + 3, y: 24 + u, w: 2, h: 1, col: '#e0607e' }))
    parts.push(flat({ t: 'r', x: CX + 7, y: 24 + u, w: 3, h: 1, col: WHISKER }))
    parts.push(flat({ t: 'r', x: CX + 7, y: 26 + u, w: 3, h: 1, col: WHISKER }))
  }
  if (kind === 'duck') parts.push(flat({ t: 'r', x: CX + 6, y: 23 + u, w: 6, h: 1, col: darken(BEAK, 0.35) }))

  // the face: frogs look out of their eye bumps
  const eyeY = frog ? 15 + u : 20 + u
  const face = faceParts(pose.face, {
    eyeL: frog ? CX - 5 : CX - 1,
    eyeR: frog ? CX + 5 : CX + 4,
    eyeY,
    mouthX: CX + 2,
    mouthY: frog ? 25 + u : 26 + u,
    blush: false,
    mouth: !BIRDS.includes(kind),
  })
  // a frog's tear would sit on its white eye; nudge it below the bump instead
  return parts.concat(frog ? face.map((p) => (p.col === TEAR && p.t === 'r' ? { ...p, y: p.y + 2 } : p)) : face)
}

/** Where a bunny ear stands (or droops, when sad); the pink inside follows it. */
function bunnyEar(side: number, u: number, sad: boolean): { cx: number; cy: number; ry: number } {
  return { cx: CX + side * (sad ? 5 : 3.5), cy: 10.5 + u + (sad ? 3 : 0), ry: sad ? 4 : 5.5 }
}

/** One collar for every animal: all share the neck row. Tinted with the chat color. */
export function collarParts(pose: Pose): Part[] {
  return [{ t: 'r', x: CX - 6, y: COLLAR_Y + pose.squash, w: 13, h: 2, col: TINT_MAIN, shade: TINT_SHADE }]
}
