import { describe, expect, it } from 'vitest'
import { ANIM_NAMES, FRAME_SIZE } from './contract'
import { accessoryParts, hairParts, humanBodyParts, humanFaceParts } from './humanArt'
import { partBounds, type Part } from './pixelKit'
import { POSES, pose } from './poses'
import { ACCESSORIES, BUILDS, HAIR_STYLES } from './roster'

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

describe('human art', () => {
  it('keeps every human layer inside the 48px frame in every pose', () => {
    for (const p of ALL_POSES) {
      for (const build of BUILDS) {
        for (const layer of ['pants', 'shirt', 'skin'] as const) expectInFrame(humanBodyParts(layer, build, p), p.dy)
      }
      expectInFrame(humanFaceParts(p), p.dy)
      for (const style of HAIR_STYLES) {
        expectInFrame(hairParts(style, false, p), p.dy)
        expectInFrame(hairParts(style, true, p), p.dy)
      }
      for (const name of ACCESSORIES) expectInFrame(accessoryParts(name, p), p.dy)
    }
  })

  it('puts the head in the same place for every build, so hair and accessories fit all of them', () => {
    for (const p of ALL_POSES) {
      const [skinny, average, chubby] = BUILDS.map((b) => humanBodyParts('skin', b, p)[0])
      expect(average).toEqual(skinny)
      expect(chubby).toEqual(skinny)
    }
  })

  it('makes chubby wider than average, and average wider than skinny', () => {
    const width = (build: (typeof BUILDS)[number]) => {
      const bounds = humanBodyParts('shirt', build, pose()).map(partBounds)
      return Math.max(...bounds.map((b) => b.x1)) - Math.min(...bounds.map((b) => b.x0))
    }
    expect(width('average')).toBeGreaterThan(width('skinny'))
    expect(width('chubby')).toBeGreaterThan(width('average'))
  })

  it('only long hair has a layer behind the head', () => {
    for (const style of HAIR_STYLES) {
      expect(hairParts(style, true, pose()).length > 0).toBe(style === 'long')
      expect(hairParts(style, false, pose()).length).toBeGreaterThan(0)
    }
  })

  it('changes the face with the pose (a tear only when sad)', () => {
    const tear = (parts: Part[]) => parts.some((p) => p.col === '#8fd3ff')
    expect(tear(humanFaceParts(pose(0, 2, { face: 'sad' })))).toBe(true)
    expect(tear(humanFaceParts(pose()))).toBe(false)
  })
})
