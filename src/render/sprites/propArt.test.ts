import { describe, expect, it } from 'vitest'
import { animalMouthSpot } from './animalArt'
import { FRAME_SIZE } from './contract'
import { humanHandSpot, humanMouthSpot } from './humanArt'
import { partBounds, type Part } from './pixelKit'
import { POSES, pose, type Pose } from './poses'
import { propParts } from './propArt'
import { BUILDS, PROP_BODIES } from './roster'

function expectInFrame(parts: Part[], p: Pose): void {
  for (const part of parts) {
    const b = partBounds(part)
    expect(b.x0 + p.dx).toBeGreaterThanOrEqual(0)
    expect(b.x1 + p.dx).toBeLessThanOrEqual(FRAME_SIZE)
    expect(b.y0 + p.dy).toBeGreaterThanOrEqual(0)
    expect(b.y1 + p.dy).toBeLessThanOrEqual(FRAME_SIZE)
  }
}

describe('prop art', () => {
  it('draws nothing unless the pose holds a prop', () => {
    for (const body of PROP_BODIES) {
      expect(propParts(body, pose())).toEqual([])
      for (const p of POSES.cheer) expect(propParts(body, p)).toEqual([])
    }
  })

  it('draws a prop inside the frame on every smoke and bong frame', () => {
    for (const body of PROP_BODIES) {
      for (const p of [...POSES.smoke, ...POSES.bong]) {
        const parts = propParts(body, p)
        expect(parts.length).toBeGreaterThan(0)
        expectInFrame(parts, p)
      }
    }
  })

  it('puts the joint in the front hand, and at the mouth while smoking', () => {
    for (const build of BUILDS) {
      const held = pose(0, 0, { prop: 'joint' })
      const hand = humanHandSpot(build, held, 1)
      expect(propParts(build, held)[0]).toMatchObject({ x: Math.round(hand.x), y: Math.round(hand.y) })
      const smoking = pose(0, 0, { arms: 'toMouth', prop: 'joint' })
      const mouth = humanMouthSpot(smoking)
      expect(propParts(build, smoking)[0]).toMatchObject({ x: Math.round(mouth.x), y: Math.round(mouth.y) })
    }
  })

  it('makes the ember glow only on the inhale', () => {
    const at = (prop: 'joint' | 'jointLit') => propParts('average', pose(0, 0, { arms: 'toMouth', prop }))
    expect(at('jointLit')[1]?.col).not.toBe(at('joint')[1]?.col)
    expect(at('jointLit').length).toBeGreaterThan(at('joint').length)
  })

  it('reaches the bong from the hands up to the mouth, bubbling while in use', () => {
    for (const body of PROP_BODIES) {
      const p = pose(0, 0, { arms: 'holdFront', prop: 'bong' })
      const mouth = body === 'animal' ? animalMouthSpot(p) : humanMouthSpot(p)
      const top = Math.min(...propParts(body, p).map((q) => partBounds(q).y0))
      expect(top).toBeLessThanOrEqual(Math.round(mouth.y) + 1)
      const bubbling = propParts(body, pose(0, 0, { arms: 'holdFront', prop: 'bongBubbles' }))
      expect(bubbling.length).toBeGreaterThan(propParts(body, p).length)
    }
  })
})
