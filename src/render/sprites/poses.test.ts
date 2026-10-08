import { describe, expect, it } from 'vitest'
import { ANIM_NAMES, ANIMATIONS } from './contract'
import { POSES } from './poses'

describe('POSES', () => {
  it('has exactly one pose per frame for every animation', () => {
    for (const name of ANIM_NAMES) expect(POSES[name]).toHaveLength(ANIMATIONS[name].frames)
  })

  it('gives the reaction rows their faces and arms', () => {
    expect(POSES.cheer.every((p) => p.face === 'happy' || p.face === 'grin')).toBe(true)
    expect(POSES.cheer.some((p) => p.arms === 'up')).toBe(true)
    expect(POSES.sad.every((p) => p.face === 'sad' && p.arms === 'limp' && p.squash > 0)).toBe(true)
  })

  it('keeps the arms still while talking, so the mouth does the talking', () => {
    // a single arm pumping out at waist height reads as something crude on stream
    expect(new Set(POSES.talk.map((p) => p.arms))).toEqual(new Set(['down']))
    expect(POSES.talk.some((p) => p.face === 'talk')).toBe(true)
  })

  it('sits on every sit frame, breathing by one pixel, and nowhere else', () => {
    expect(POSES.sit.every((p) => p.seated && p.dy === 0)).toBe(true)
    expect(POSES.sit.map((p) => p.squash)).toEqual([1, 1, 0, 0])
    for (const name of ANIM_NAMES) {
      if (name !== 'sit') expect(POSES[name].some((p) => p.seated), name).toBe(false)
    }
  })

  it('never moves the feet below the ground line', () => {
    for (const name of ANIM_NAMES) for (const p of POSES[name]) expect(p.dy).toBeLessThanOrEqual(0)
  })
})
