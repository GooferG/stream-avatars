import { clamp } from '../utils/math'

/** Minimum gap between on-stage UI (bubbles, name plates) and the stage edge. */
export const EDGE_MARGIN = 8
/** Closest the tail may get to a box corner (clears the border + tail width). */
export const TAIL_INSET = 10

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
