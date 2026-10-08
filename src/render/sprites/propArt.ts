import { animalMouthSpot, animalPawSpot } from './animalArt'
import { humanHandSpot, humanMouthSpot } from './humanArt'
import type { Part } from './pixelKit'
import type { Pose } from './poses'
import type { PropBody } from './roster'

const PAPER = '#efe9da'
const EMBER = '#e2552b'
const EMBER_LIT = '#ffcf4a'
const GLOW = 'rgba(255, 170, 60, 0.55)'
const GLASS = '#7fd0c8'
const GLASS_SHADE = '#5aa8a2'
const WATER = 'rgba(70, 140, 190, 0.8)'
const BUBBLE = '#ffffff'
const BOWL = '#8a8f98'

interface Spot {
  x: number
  y: number
}

/**
 * The prop layer, in final colors on top of the whole character: a joint
 * in the front hand (at the mouth while smoking), or a bong held in both
 * hands with its mouthpiece at the mouth. Empty unless the pose holds one.
 */
export function propParts(body: PropBody, pose: Pose): Part[] {
  if (!pose.prop) return []
  const hand = body === 'animal' ? animalPawSpot(pose, 1) : humanHandSpot(body, pose, 1)
  const mouth = body === 'animal' ? animalMouthSpot(pose) : humanMouthSpot(pose)
  if (pose.prop === 'joint' || pose.prop === 'jointLit') {
    return joint(pose.arms === 'toMouth' ? mouth : hand, pose.prop === 'jointLit')
  }
  return bong(mouth, hand, pose.prop === 'bongBubbles')
}

/** A 5 px joint pointing forward from `from`, its ember at the tip. */
function joint(from: Spot, lit: boolean): Part[] {
  const x = Math.round(from.x)
  const y = Math.round(from.y)
  const parts: Part[] = [
    { t: 'r', x, y, w: 5, h: 1, col: PAPER },
    { t: 'r', x: x + 5, y, w: 1, h: 1, col: lit ? EMBER_LIT : EMBER, noOutline: true },
  ]
  if (lit) {
    parts.push(
      { t: 'r', x: x + 5, y: y - 1, w: 1, h: 1, col: GLOW, noOutline: true },
      { t: 'r', x: x + 6, y, w: 1, h: 1, col: GLOW, noOutline: true },
    )
  }
  return parts
}

/** A glass tube from the mouth down to a round base held at the hands, with water and a bowl. */
function bong(mouth: Spot, hand: Spot, bubbles: boolean): Part[] {
  const x = Math.round(mouth.x) - 1
  const top = Math.round(mouth.y) + 1
  const baseY = Math.round(hand.y) + 1
  const parts: Part[] = [
    { t: 'r', x, y: top, w: 2, h: Math.max(2, baseY - top), col: GLASS, shade: GLASS_SHADE },
    { t: 'e', cx: x + 1, cy: baseY + 1, rx: 3, ry: 2.5, col: GLASS, shade: GLASS_SHADE },
    { t: 'r', x: x + 3, y: baseY - 2, w: 2, h: 1, col: BOWL },
    { t: 'r', x: x - 1, y: baseY + 1, w: 5, h: 2, col: WATER, noOutline: true },
  ]
  if (bubbles) {
    parts.push(
      { t: 'r', x, y: baseY, w: 1, h: 1, col: BUBBLE, noOutline: true },
      { t: 'r', x: x + 1, y: baseY - 3, w: 1, h: 1, col: BUBBLE, noOutline: true },
    )
  }
  return parts
}
