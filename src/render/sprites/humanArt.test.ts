import { describe, expect, it } from 'vitest'
import { ANIM_NAMES, FRAME_SIZE } from './contract'
import { HEAD, accessoryParts, hairParts, humanBodyParts, humanFaceParts } from './humanArt'
import { partBounds, type Part } from './pixelKit'
import { POSES, pose, type Arms } from './poses'
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

  /** The skin layer is [head, left hand, right hand]; side -1 is the back hand, 1 the front one. */
  const handAt = (build: (typeof BUILDS)[number], arms: Arms, side: -1 | 1) => {
    const hand = humanBodyParts('skin', build, pose(0, 0, { arms }))[side < 0 ? 1 : 2]
    if (!hand || hand.t !== 'e') throw new Error(`no round hand for ${arms}`)
    return { x: hand.cx, y: hand.cy }
  }

  it('raises the front hand up and forward for the high-five, in front of the face', () => {
    for (const build of BUILDS) {
      const hand = handAt(build, 'reachUp', 1)
      expect(hand.x).toBeGreaterThan(24 + HEAD.rx)
      expect(hand.y).toBeLessThan(22)
    }
  })

  it('brings both hands together in front of the chest to clap, and a little apart between claps', () => {
    for (const build of BUILDS) {
      expect(Math.abs(handAt(build, 'clap', -1).x - 24)).toBeLessThanOrEqual(2)
      expect(Math.abs(handAt(build, 'clap', 1).x - 24)).toBeLessThanOrEqual(2)
      expect(handAt(build, 'clapOpen', 1).x - handAt(build, 'clapOpen', -1).x).toBeGreaterThan(6)
    }
  })

  it('brings the front hand next to the mouth to smoke', () => {
    for (const build of BUILDS) {
      const hand = handAt(build, 'toMouth', 1)
      expect(Math.abs(hand.x - 26)).toBeLessThanOrEqual(5)
      expect(Math.abs(hand.y - (HEAD.y + 5))).toBeLessThanOrEqual(1)
    }
  })

  it('draws arms held across the body on top of the torso, with their own outline', () => {
    for (const build of BUILDS) {
      const shirt = humanBodyParts('shirt', build, pose(0, 0, { arms: 'clap' }))
      expect(shirt[0]).toMatchObject({ t: 'e', cx: 24 }) // both sleeves cross the body: the torso comes first
      expect(shirt.slice(1).every((p) => p.onTop === true)).toBe(true)
      expect(humanBodyParts('shirt', build, pose()).some((p) => p.onTop)).toBe(false)
    }
  })

  it('gives the dizzy and chill faces no eye shine, and the dizzy face no blush', () => {
    const shine = (parts: Part[]) => parts.some((p) => p.col === '#ffffff')
    const blush = (parts: Part[]) => parts.some((p) => p.col.startsWith('rgba(255, 90, 120'))
    expect(shine(humanFaceParts(pose()))).toBe(true)
    expect(shine(humanFaceParts(pose(0, 0, { face: 'dizzy' })))).toBe(false)
    expect(shine(humanFaceParts(pose(0, 0, { face: 'chill' })))).toBe(false)
    expect(blush(humanFaceParts(pose(0, 0, { face: 'dizzy' })))).toBe(false)
  })

  it('changes the face with the pose (a tear only when sad)', () => {
    const tear = (parts: Part[]) => parts.some((p) => p.col === '#8fd3ff')
    expect(tear(humanFaceParts(pose(0, 2, { face: 'sad' })))).toBe(true)
    expect(tear(humanFaceParts(pose()))).toBe(false)
  })
})
