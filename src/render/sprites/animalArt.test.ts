import { describe, expect, it } from 'vitest'
import { animalParts, collarParts } from './animalArt'
import { ANIM_NAMES, FRAME_SIZE } from './contract'
import { partBounds, type Part } from './pixelKit'
import { POSES, pose } from './poses'
import { ANIMALS } from './roster'

const ALL_POSES = ANIM_NAMES.flatMap((name) => POSES[name])

function expectInFrame(parts: Part[], dy: number): void {
  for (const p of parts) {
    const b = partBounds(p)
    expect(b.x0).toBeGreaterThanOrEqual(0)
    expect(b.x1).toBeLessThanOrEqual(FRAME_SIZE)
    expect(b.y0 + dy).toBeGreaterThanOrEqual(0)
    expect(b.y1 + dy).toBeLessThanOrEqual(FRAME_SIZE)
  }
}

const topOf = (parts: Part[]) => Math.min(...parts.map((p) => partBounds(p).y0))

describe('animal art', () => {
  it('keeps every animal and the collar inside the 48px frame in every pose', () => {
    for (const p of ALL_POSES) {
      for (const kind of ANIMALS) expectInFrame(animalParts(kind, p), p.dy)
      expectInFrame(collarParts(p), p.dy)
    }
  })

  it('draws each animal differently', () => {
    const drawings = ANIMALS.map((k) => JSON.stringify(animalParts(k, pose())))
    expect(new Set(drawings).size).toBe(ANIMALS.length)
  })

  it('droops the ears when sad', () => {
    for (const kind of ['cat', 'bunny', 'fox'] as const) {
      const sad = animalParts(kind, pose(0, 2, { face: 'sad' }))
      const calm = animalParts(kind, pose(0, 2))
      expect(topOf(sad)).toBeGreaterThan(topOf(calm))
    }
  })

  it('sits the collar on the neck, where the head meets the body', () => {
    const [collar] = collarParts(pose())
    expect(collar).toMatchObject({ t: 'r', y: 28 })
  })
})
