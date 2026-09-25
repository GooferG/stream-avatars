import { faceParts, TEAR } from './faces'
import { TINT_MAIN, TINT_SHADE } from './humanArt'
import { darken, lighten, type Part } from './pixelKit'
import type { Arms, Pose } from './poses'
import type { Animal } from './roster'

/**
 * Upright chibi animals sharing one body template (so one collar fits all),
 * painted in natural colors as fixed layers, face included. The collar is
 * a separate gray layer tinted with the chatter's color.
 */
export const ANIMAL_COLORS: Record<Animal, string> = {
  cat: '#f0a04b',
  dog: '#a0703c',
  duck: '#f5d547',
  frog: '#6bbf59',
  bunny: '#e8e2dc',
  bear: '#8a5a3c',
  fox: '#e8762c',
}
const BEAK = '#f39c34'
const PINK = '#f5a0b8'
const NOSE = '#1a1020'
const WHITE = '#ffffff'

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

function paw(shape: PawShape, side: -1 | 1, u: number, col: string, shade: string): Part {
  const at = (dx: number, cy: number, rx: number, ry: number): Part => ({
    t: 'e', cx: CX + side * dx, cy: cy + u, rx, ry, col, shade,
  })
  switch (shape) {
    case 'swing': return at(8, 32, 2, 3)
    case 'mid': return at(9.5, 31, 2.5, 2)
    case 'up': return at(7, 25, 2, 3.5)
    case 'limp': return at(7, 35, 2, 3)
    default: return at(7.5, 33, 2, 3)
  }
}

export function animalParts(kind: Animal, pose: Pose): Part[] {
  const u = pose.squash
  const sad = pose.face === 'sad'
  const fur = ANIMAL_COLORS[kind]
  const shade = darken(fur, 0.25)
  const belly = lighten(fur, 0.55)
  const furPart = { col: fur, shade }
  const parts: Part[] = []

  // tails, behind everything
  if (kind === 'cat') {
    parts.push({ t: 'r', x: CX - 11, y: 29 + u, w: 2, h: 10, col: fur })
    parts.push({ t: 'r', x: CX - 13, y: 26 + u, w: 3, h: 4, col: fur })
  }
  if (kind === 'fox') parts.push({ t: 'e', cx: CX - 10, cy: 34 + u, rx: 4, ry: 6, ...furPart })
  if (kind === 'dog') parts.push({ t: 'e', cx: CX - 9, cy: 32 + u, rx: 2, ry: 3.5, col: fur })
  if (kind === 'bunny') parts.push({ t: 'e', cx: CX - 8, cy: 38 + u, rx: 2.5, ry: 2.5, col: WHITE })

  // ears behind the head; sad ones droop
  const droop = sad ? 2 : 0
  if (kind === 'cat') {
    for (const dx of [-5, 5]) parts.push({ t: 't', cx: CX + dx, top: 11 + u + droop, h: 6, w: 6, col: fur })
  }
  if (kind === 'fox') {
    for (const dx of [-5, 5]) parts.push({ t: 't', cx: CX + dx, top: 9 + u + droop, h: 8, w: 6, col: fur })
  }
  if (kind === 'bunny') {
    for (const side of [-1, 1]) {
      parts.push({
        t: 'e', cx: CX + side * (sad ? 5 : 3.5), cy: 10.5 + u + (sad ? 3 : 0), rx: 2, ry: sad ? 4 : 5.5, col: fur,
      })
    }
  }
  if (kind === 'bear') for (const dx of [-6.5, 6.5]) parts.push({ t: 'e', cx: CX + dx, cy: 15 + u, rx: 2.5, ry: 2.5, col: fur })

  // feet, paws/wings, body, head
  const footCol = kind === 'duck' ? BEAK : fur
  parts.push({ t: 'e', cx: CX - 3.5, cy: 43.5 - (pose.leg === 1 ? 1 : 0), rx: 2.5, ry: 1.5, col: footCol })
  parts.push({ t: 'e', cx: CX + 3.5, cy: 43.5 - (pose.leg === 2 ? 1 : 0), rx: 2.5, ry: 1.5, col: footCol })
  const [left, right] = PAW_SHAPES[pose.arms]
  parts.push(paw(left, -1, u, fur, shade), paw(right, 1, u, fur, shade))
  parts.push({ t: 'e', cx: CX, cy: BODY_Y + u, rx: 7, ry: 7.5, ...furPart })
  const frog = kind === 'frog'
  parts.push({ t: 'e', cx: CX, cy: HEAD_Y + u, rx: frog ? 10 : 8.5, ry: frog ? 6.5 : 7.5, ...furPart })
  if (frog) for (const dx of [-5, 5]) parts.push({ t: 'e', cx: CX + dx, cy: 15 + u, rx: 3, ry: 3, col: fur })
  if (kind === 'dog') {
    for (const dx of [-8.5, 8.5]) parts.push({ t: 'e', cx: CX + dx, cy: 22 + u + droop, rx: 2.5, ry: 5, col: darken(fur, 0.3) })
  }
  if (kind === 'duck') parts.push({ t: 'e', cx: CX + 8, cy: 23 + u, rx: 4, ry: 2, col: BEAK })

  // flat details on top (no outline)
  const flat = (p: Part): Part => ({ ...p, noOutline: true })
  parts.push(flat({ t: 'e', cx: CX + 0.5, cy: 36 + u, rx: 4, ry: 4.5, col: belly }))
  if (kind === 'dog' || kind === 'bear' || kind === 'fox' || kind === 'cat') {
    parts.push(flat({ t: 'e', cx: CX + 2, cy: 25 + u, rx: kind === 'bear' ? 4 : 3.5, ry: 2.5, col: kind === 'fox' ? WHITE : belly }))
  }
  if (kind === 'cat' || kind === 'fox') {
    parts.push(flat({ t: 'r', x: CX - 6, y: 14 + u + droop, w: 2, h: 2, col: PINK }))
    parts.push(flat({ t: 'r', x: CX + 4, y: 14 + u + droop, w: 2, h: 2, col: PINK }))
  }
  if (kind === 'bunny') {
    for (const side of [-1, 1]) {
      parts.push(flat({ t: 'e', cx: CX + side * (sad ? 5 : 3.5), cy: 10.5 + u + (sad ? 3 : 0), rx: 0.8, ry: sad ? 2.5 : 4, col: PINK }))
    }
  }
  if (frog) {
    parts.push(flat({ t: 'r', x: CX - 6, y: 14 + u, w: 3, h: 3, col: WHITE }))
    parts.push(flat({ t: 'r', x: CX + 4, y: 14 + u, w: 3, h: 3, col: WHITE }))
  }
  if (kind === 'dog' || kind === 'bear' || kind === 'fox') parts.push(flat({ t: 'r', x: CX + 4, y: 24 + u, w: 2, h: 1, col: NOSE }))
  if (kind === 'cat') {
    parts.push(flat({ t: 'r', x: CX + 3, y: 24 + u, w: 2, h: 1, col: '#e0607e' }))
    parts.push(flat({ t: 'r', x: CX + 7, y: 24 + u, w: 3, h: 1, col: lighten(fur, 0.8) }))
    parts.push(flat({ t: 'r', x: CX + 7, y: 26 + u, w: 3, h: 1, col: lighten(fur, 0.8) }))
  }
  if (kind === 'duck') {
    parts.push(flat({ t: 'r', x: CX + 6, y: 23 + u, w: 6, h: 1, col: darken(BEAK, 0.35) }))
    parts.push(flat({ t: 'r', x: CX - 1, y: 12 + u, w: 1, h: 2, col: fur }))
    parts.push(flat({ t: 'r', x: CX + 1, y: 11 + u, w: 1, h: 3, col: fur }))
  }

  // the face: frogs look out of their eye bumps; ducks talk with the beak
  const eyeY = frog ? 15 + u : 20 + u
  const face = faceParts(pose.face, {
    eyeL: frog ? CX - 5 : CX - 1,
    eyeR: frog ? CX + 5 : CX + 4,
    eyeY,
    mouthX: CX + 2,
    mouthY: frog ? 25 + u : 26 + u,
    blush: false,
    mouth: kind !== 'duck',
  })
  // a frog's tear would sit on its white eye; nudge it below the bump instead
  return parts.concat(frog ? face.map((p) => (p.col === TEAR && p.t === 'r' ? { ...p, y: p.y + 2 } : p)) : face)
}

/** One collar for every animal: all share the neck row. Tinted with the chat color. */
export function collarParts(pose: Pose): Part[] {
  return [{ t: 'r', x: CX - 6, y: COLLAR_Y + pose.squash, w: 13, h: 2, col: TINT_MAIN, shade: TINT_SHADE }]
}
