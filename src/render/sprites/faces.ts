import type { Part } from './pixelKit'
import type { Face } from './poses'

const EYE = '#1a1020'
const SHINE = '#ffffff'
const MOUTH = '#6b2e2e'
const BLUSH = 'rgba(255, 90, 120, 0.45)'
export const TEAR = '#8fd3ff'

/** Where a character's face sits in the frame (already offset by the pose's squash). */
export interface FaceSpot {
  /** Left pixel of each 2px-wide eye. */
  eyeL: number
  eyeR: number
  eyeY: number
  mouthX: number
  mouthY: number
  blush: boolean
  mouth: boolean
}

const px = (x: number, y: number, col: string, w = 1, h = 1): Part => ({
  t: 'r', x, y, w, h, col, noOutline: true,
})

/** Eyes, brows, mouth, blush and tear for an expression; painted in final colors (fixed layer). */
export function faceParts(face: Face, s: FaceSpot): Part[] {
  const parts: Part[] = []
  const { eyeL, eyeR, eyeY } = s
  if (face === 'happy' || face === 'grin') {
    for (const x of [eyeL, eyeR]) {
      parts.push(px(x - 1, eyeY + 1, EYE), px(x, eyeY, EYE, 2, 1), px(x + 2, eyeY + 1, EYE))
    }
  } else if (face === 'sad') {
    parts.push(px(eyeL, eyeY + 1, EYE, 2, 1), px(eyeR, eyeY + 1, EYE, 2, 1))
    // worried brows: the inner ends raised
    parts.push(px(eyeL, eyeY - 1, EYE), px(eyeL + 1, eyeY - 2, EYE))
    parts.push(px(eyeR + 1, eyeY - 1, EYE), px(eyeR, eyeY - 2, EYE))
    parts.push(px(eyeL - 1, eyeY + 2, TEAR, 1, 2))
  } else {
    parts.push(px(eyeL, eyeY, EYE, 2, 2), px(eyeR, eyeY, EYE, 2, 2))
    parts.push(px(eyeL, eyeY, SHINE), px(eyeR, eyeY, SHINE))
  }
  if (s.mouth) {
    const { mouthX: mx, mouthY: my } = s
    if (face === 'talk') parts.push(px(mx, my, MOUTH, 2, 2))
    else if (face === 'happy') parts.push(px(mx - 1, my, MOUTH), px(mx, my + 1, MOUTH, 2, 1), px(mx + 2, my, MOUTH))
    else if (face === 'grin') parts.push(px(mx - 1, my, MOUTH, 4, 1), px(mx, my + 1, MOUTH, 2, 1))
    else if (face === 'sad') parts.push(px(mx, my, MOUTH, 2, 1), px(mx - 1, my + 1, MOUTH), px(mx + 2, my + 1, MOUTH))
    else parts.push(px(mx, my, MOUTH, 2, 1))
  }
  if (s.blush && face !== 'sad') {
    parts.push(px(eyeL - 3, eyeY + 3, BLUSH, 2, 1), px(eyeR + 2, eyeY + 3, BLUSH, 2, 1))
  }
  return parts
}
