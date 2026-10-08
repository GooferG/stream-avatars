import { describe, expect, it } from 'vitest'
import { placePlates, type Plate } from './plateSpread'

const STAGE = 1920
const GAP = 4
/** A 100px-wide plate wanting to sit at x; higher priority = more recently active. */
const plate = (x: number, priority: number, y = 900, halfWidth = 50): Plate => ({ x, halfWidth, y, height: 28, priority })

describe('placePlates', () => {
  it('leaves plates that do not overlap where they are', () => {
    expect(placePlates([plate(100, 1), plate(300, 2), plate(500, 3)], GAP, STAGE)).toEqual([100, 300, 500])
  })

  it('keeps the most recently active name over its character, and puts the other right beside it', () => {
    expect(placePlates([plate(400, 2), plate(410, 1)], GAP, STAGE)).toEqual([400, 504])
    expect(placePlates([plate(400, 1), plate(410, 2)], GAP, STAGE)).toEqual([306, 410])
  })

  it('puts a third name in the same spot on the other side, and hides a fourth rather than drift it away', () => {
    expect(placePlates([plate(400, 4), plate(402, 3), plate(398, 2), plate(401, 1)], GAP, STAGE)).toEqual([
      400,
      504,
      296,
      null,
    ])
  })

  it('never shows a name further from its character than right beside the name it bumped into', () => {
    // a line of six talking at once: no long chain, the older ones in the middle of it hide
    const xs = placePlates([0, 1, 2, 3, 4, 5].map((i) => plate(400 + i * 30, 6 - i)), GAP, STAGE)
    xs.forEach((x, i) => {
      if (x !== null) expect(Math.abs(x - (400 + i * 30))).toBeLessThanOrEqual(104)
    })
    expect(xs.filter((x) => x === null).length).toBeGreaterThan(0)
  })

  it('leaves plates at different heights alone (one is mid-jump above the other)', () => {
    expect(placePlates([plate(100, 2, 900), plate(110, 1, 860)], GAP, STAGE)).toEqual([100, 110])
  })

  it('keeps a nudged name inside the stage, taking the other side when one is off the edge', () => {
    expect(placePlates([plate(60, 2), plate(70, 1)], GAP, STAGE)).toEqual([60, 164])
    expect(placePlates([plate(1860, 2), plate(1850, 1)], GAP, STAGE)).toEqual([1860, 1756])
  })

  it('handles no plates and one plate', () => {
    expect(placePlates([], GAP, STAGE)).toEqual([])
    expect(placePlates([plate(700, 1)], GAP, STAGE)).toEqual([700])
  })
})
