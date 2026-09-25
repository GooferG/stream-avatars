import { describe, expect, it } from 'vitest'
import { ANIM_NAMES, FRAME_SIZE } from './contract'
import { partsFor } from './paint'
import { partBounds } from './pixelKit'
import { POSES } from './poses'
import { ALL_SHEETS } from './roster'

describe('partsFor', () => {
  it('has art for every sheet in every frame, all inside the frame', () => {
    for (const id of ALL_SHEETS) {
      for (const name of ANIM_NAMES) {
        for (const pose of POSES[name]) {
          const parts = partsFor(id, pose)
          expect(parts.length).toBeGreaterThan(0)
          for (const p of parts) {
            const b = partBounds(p)
            expect(b.x0).toBeGreaterThanOrEqual(0)
            expect(b.x1).toBeLessThanOrEqual(FRAME_SIZE)
            expect(b.y0 + pose.dy).toBeGreaterThanOrEqual(0)
            expect(b.y1 + pose.dy).toBeLessThanOrEqual(FRAME_SIZE)
          }
        }
      }
    }
  })
})
