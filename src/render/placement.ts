import { clamp } from '../utils/math'

/** Minimum gap between on-stage UI (bubbles, name plates) and the stage edge. */
export const EDGE_MARGIN = 8
/** Closest the tail may get to a box corner (clears the border + tail width). */
export const TAIL_INSET = 10
/** Visual footprint of a scaled character plus its name plate, for strip depth math. */
export const AVATAR_ROOM = 130
/** Gap between the top of the head and the name plate above it. */
const LABEL_GAP = 4
/** Gap between the name plate and the speech bubble's tail tip. */
const BUBBLE_GAP = 2

/**
 * A character's ground line (where its feet stand). The nearest characters
 * stand on the bottom edge; deeper ones stand higher up the strip.
 */
export function groundLine(stageHeight: number, stripHeight: number, depth: number): number {
  return stageHeight - depth * Math.max(0, stripHeight - AVATAR_ROOM)
}

/** Stacked above the head: the name plate's top edge, then the bubble's tail tip. */
export function overheadLayout(headTopY: number, labelHeight: number): { labelY: number; bubbleY: number } {
  const labelY = headTopY - LABEL_GAP - labelHeight
  return { labelY, bubbleY: labelY - BUBBLE_GAP }
}

/** Shift that moves something of halfWidth centred on x fully inside the stage. */
function keepInside(x: number, halfWidth: number, stageWidth: number): number {
  return clamp(x, EDGE_MARGIN + halfWidth, stageWidth - EDGE_MARGIN - halfWidth) - x
}

/**
 * Horizontal offsets, relative to the speaker's head, for the bubble box
 * centre and the tail tip. The box slides inward near the stage edges; the
 * tail keeps pointing at the head until it would leave the box.
 */
export function bubbleOffsets(
  headX: number,
  halfWidth: number,
  stageWidth: number,
): { boxX: number; tailX: number } {
  const boxX = keepInside(headX, halfWidth, stageWidth)
  const tailX = clamp(0, boxX - halfWidth + TAIL_INSET, boxX + halfWidth - TAIL_INSET)
  return { boxX, tailX }
}

/**
 * Name plate offset relative to its avatar. Inside the stage the plate is
 * kept fully readable; once the avatar walks offscreen the offset freezes,
 * so the name leaves (and arrives) together with its avatar.
 */
export function labelOffset(x: number, halfWidth: number, stageWidth: number): number {
  return keepInside(clamp(x, 0, stageWidth), halfWidth, stageWidth)
}
