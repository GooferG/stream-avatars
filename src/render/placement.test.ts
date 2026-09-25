import { describe, expect, it } from 'vitest'
import {
  AVATAR_ROOM,
  EDGE_MARGIN,
  TAIL_INSET,
  bubbleOffsets,
  groundLine,
  labelOffset,
  overheadLayout,
} from './placement'

describe('groundLine', () => {
  it('stands the nearest characters right on the bottom edge', () => {
    expect(groundLine(1080, 200, 0)).toBe(1080)
  })

  it('stands deeper characters higher up, inside the strip', () => {
    expect(groundLine(1080, 200, 1)).toBe(1080 - (200 - AVATAR_ROOM))
    expect(groundLine(1080, 200, 0.5)).toBe(1080 - (200 - AVATAR_ROOM) / 2)
  })

  it('keeps everyone on the bottom edge when the strip is too short for depth', () => {
    expect(groundLine(1080, 60, 1)).toBe(1080)
  })
})

describe('overheadLayout', () => {
  it('stacks the name plate just above the head and the bubble tail just above the plate', () => {
    expect(overheadLayout(900, 22)).toEqual({ labelY: 874, bubbleY: 872 })
  })
})

describe('labelOffset', () => {
  const half = 80
  const leftEdge = (x: number) => x + labelOffset(x, half, 1920) - half
  const rightEdge = (x: number) => x + labelOffset(x, half, 1920) + half

  it('stays centred under the avatar away from the edges', () => {
    expect(labelOffset(960, half, 1920)).toBe(0)
  })

  it('slides inward so a name near an edge is fully readable', () => {
    expect(leftEdge(10)).toBe(EDGE_MARGIN)
    expect(rightEdge(1910)).toBe(1920 - EDGE_MARGIN)
  })

  it('travels with the avatar once it walks offscreen, without a jump at the edge', () => {
    expect(labelOffset(-1, half, 1920)).toBe(labelOffset(0, half, 1920))
    expect(leftEdge(-60)).toBe(EDGE_MARGIN - 60)
    expect(rightEdge(1980)).toBe(1920 - EDGE_MARGIN + 60)
  })
})

const STAGE = 1920
const HALF = 100

/** Absolute box edges and tail position for a head at headX. */
function place(headX: number) {
  const { boxX, tailX } = bubbleOffsets(headX, HALF, STAGE)
  return { left: headX + boxX - HALF, right: headX + boxX + HALF, tail: headX + tailX }
}

describe('bubbleOffsets', () => {
  it('centres box and tail on the head away from the edges', () => {
    expect(bubbleOffsets(960, HALF, STAGE)).toEqual({ boxX: 0, tailX: 0 })
  })

  it('pushes the box inside the left edge while the tail still points at the head', () => {
    const p = place(50)
    expect(p.left).toBe(EDGE_MARGIN)
    expect(p.tail).toBe(50)
  })

  it('pushes the box inside the right edge', () => {
    const p = place(1900)
    expect(p.right).toBe(STAGE - EDGE_MARGIN)
    expect(p.tail).toBe(1900)
  })

  it('pins the tail inside the box when the head is offscreen', () => {
    const left = place(-60)
    expect(left.left).toBe(EDGE_MARGIN)
    expect(left.tail).toBe(left.left + TAIL_INSET)

    const right = place(STAGE + 60)
    expect(right.right).toBe(STAGE - EDGE_MARGIN)
    expect(right.tail).toBe(right.right - TAIL_INSET)
  })
})
