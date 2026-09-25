import { describe, expect, it } from 'vitest'
import { ANIM_NAMES, ANIMATIONS, EYE_LINE, FRAME_SIZE } from './contract'
import { BODIES, POSES, armRects } from './placeholder'

describe('placeholder poses', () => {
  it('has exactly one pose per frame for every animation', () => {
    for (const name of ANIM_NAMES) {
      expect(POSES[name]).toHaveLength(ANIMATIONS[name].frames)
    }
  })

  it('keeps both arms inside the 32px frame for every body and pose', () => {
    for (const body of BODIES) {
      for (const name of ANIM_NAMES) {
        for (const pose of POSES[name]) {
          for (const r of armRects(pose.arms, body.geometry(pose))) {
            expect(r.x).toBeGreaterThanOrEqual(0)
            expect(r.x + r.w).toBeLessThanOrEqual(FRAME_SIZE)
            expect(r.y + pose.dy).toBeGreaterThanOrEqual(0)
            expect(r.y + r.h + pose.dy).toBeLessThanOrEqual(FRAME_SIZE)
          }
        }
      }
    }
  })

  it('mirrors the right arm onto the other side of the body', () => {
    const geo = { left: 9, right: 23, shoulderY: 20, eyeY: 16 }
    const [leftOutline, rightOutline] = armRects('down', geo)
    expect(leftOutline).toEqual({ x: 7, y: 19, w: 3, h: 7, ink: 'outline' })
    expect(rightOutline).toEqual({ x: 23, y: 19, w: 3, h: 7, ink: 'outline' })
  })

  it('puts every body\'s eyes on the shared eye line, so face accessories fit any body', () => {
    for (const body of BODIES) {
      for (const pose of POSES.idle) {
        expect(body.geometry(pose).eyeY).toBe(EYE_LINE + pose.squash)
      }
    }
  })

  it('gives the reaction rows their faces and arms', () => {
    expect(POSES.cheer.every((p) => p.face === 'happy' || p.face === 'grin')).toBe(true)
    expect(POSES.cheer.some((p) => p.arms === 'up')).toBe(true)
    expect(POSES.sad.every((p) => p.face === 'sad' && p.arms === 'limp')).toBe(true)
  })
})
