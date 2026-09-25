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

  it('never moves the feet below the ground line', () => {
    for (const name of ANIM_NAMES) for (const p of POSES[name]) expect(p.dy).toBeLessThanOrEqual(0)
  })
})
