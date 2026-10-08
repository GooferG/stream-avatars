import { describe, expect, it } from 'vitest'
import { partBounds } from '../sprites/pixelKit'
import { EFFECT_NAMES, EFFECTS, effectFrameParts } from './effectArt'

describe('effect art', () => {
  it('draws every frame of every effect inside its box', () => {
    for (const name of EFFECT_NAMES) {
      const { w, h, frames } = EFFECTS[name]
      for (let f = 0; f < frames; f++) {
        const parts = effectFrameParts(name, f)
        expect(parts.length, `${name} ${f}`).toBeGreaterThan(0)
        for (const p of parts) {
          const b = partBounds(p)
          expect(b.x0, `${name} ${f}`).toBeGreaterThanOrEqual(0)
          expect(b.y0, `${name} ${f}`).toBeGreaterThanOrEqual(0)
          expect(b.x1, `${name} ${f}`).toBeLessThanOrEqual(w)
          expect(b.y1, `${name} ${f}`).toBeLessThanOrEqual(h)
        }
      }
    }
  })

  it('grows the spark frame by frame', () => {
    const width = (f: number) => {
      const bounds = effectFrameParts('spark', f).map(partBounds)
      return Math.max(...bounds.map((b) => b.x1)) - Math.min(...bounds.map((b) => b.x0))
    }
    for (let f = 1; f < EFFECTS.spark.frames; f++) expect(width(f)).toBeGreaterThan(width(f - 1))
  })

  it('churns the cloud: no two frames in a row alike', () => {
    for (let f = 0; f < EFFECTS.cloud.frames; f++) {
      const next = (f + 1) % EFFECTS.cloud.frames
      expect(JSON.stringify(effectFrameParts('cloud', f))).not.toBe(JSON.stringify(effectFrameParts('cloud', next)))
    }
  })
})
