import { describe, expect, it } from 'vitest'
import { ANIM_NAMES, FRAME_SIZE } from './contract'
import { HEAD } from './humanArt'
import { partsFor } from './paint'
import { partBounds } from './pixelKit'
import { POSES, type Pose } from './poses'
import { ALL_SHEETS, ANIMALS, BUILDS, type SheetId } from './roster'

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

  it('sits every character on the ground line: legs and haunch reach row 46, nothing goes below', () => {
    const lastRow = (id: SheetId, p: Pose) => Math.max(...partsFor(id, p).map((part) => partBounds(part).y1)) - 1
    for (const p of POSES.sit) {
      for (const id of [...BUILDS.map((b): SheetId => `human-${b}-pants`), ...ANIMALS]) {
        expect(lastRow(id, p), id).toBe(46)
      }
      for (const id of ALL_SHEETS) expect(lastRow(id, p), id).toBeLessThanOrEqual(46)
    }
  })

  it('keeps the anchor rows the README documents for replacement art', () => {
    const idle = POSES.idle[0]
    if (!idle) throw new Error('missing idle pose')
    const rows = (id: SheetId) => {
      const bounds = partsFor(id, idle).map(partBounds)
      return { top: Math.min(...bounds.map((b) => b.y0)), last: Math.max(...bounds.map((b) => b.y1)) - 1 }
    }
    for (const id of [...BUILDS.map((b): SheetId => `human-${b}-pants`), ...ANIMALS]) {
      expect(rows(id).last, id).toBe(46)
    }
    expect(HEAD.y).toBe(16)
    for (const b of BUILDS) expect(rows(`human-${b}-skin`).top).toBe(7)
    expect(rows('human-face').top).toBe(17)
    expect(rows('collar').top + 1).toBe(28) // +1: the outline sits above the band
  })
})
