import { describe, expect, it } from 'vitest'
import { effectAt, effectDone, type EffectCue } from './effectMotion'

const cue = (over: Partial<EffectCue> & Pick<EffectCue, 'name'>): EffectCue => ({ x: 0, rise: 0, ...over })

describe('effectAt', () => {
  it('waits out its delay, then shows until its life is over', () => {
    const spark = cue({ name: 'spark', delayMs: 100 })
    expect(effectAt(spark, 99)).toBeNull()
    expect(effectAt(spark, 100)).not.toBeNull()
    expect(effectAt(spark, 499)).not.toBeNull()
    expect(effectAt(spark, 500)).toBeNull()
    expect(effectDone(spark, 499)).toBe(false)
    expect(effectDone(spark, 500)).toBe(true)
    expect(effectDone(spark, 50)).toBe(false)
  })

  it('steps through the spark frames once over its life', () => {
    expect([0, 100, 200, 300, 399].map((ms) => effectAt(cue({ name: 'spark' }), ms)?.frame)).toEqual([0, 1, 2, 3, 3])
  })

  it('floats a heart up and fades it out over the last 40% of its life', () => {
    const heart = cue({ name: 'heart' })
    expect(effectAt(heart, 1000)?.dy).toBeCloseTo(-16)
    expect(effectAt(heart, 600)?.alpha).toBe(1)
    expect(effectAt(heart, 1080)?.alpha).toBeCloseTo(0.25)
  })

  it('grows and fades smoke as it rises and drifts', () => {
    const late = effectAt(cue({ name: 'smoke', vx: 6 }), 1400)
    expect(late?.scale).toBeGreaterThan(1.5)
    expect(late?.alpha).toBeLessThan(0.2)
    expect(late?.dx).toBeCloseTo(8.4)
    expect(late?.dy).toBeCloseTo(-19.6)
  })

  it('circles an orbiting star round its spot once a second, flattened like a halo', () => {
    const star = cue({ name: 'tinyStar', orbit: { radius: 8, phase: 0 } })
    expect(effectAt(star, 0)).toMatchObject({ dx: 8, dy: 0 })
    expect(effectAt(star, 250)?.dx).toBeCloseTo(0)
    expect(effectAt(star, 250)?.dy).toBeCloseTo(3.2)
    expect(effectAt(star, 1000)?.dx).toBeCloseTo(8)
  })

  it('lets a cue set its own life and speed: the cloud lasts the brawl, puffs fly out', () => {
    expect(effectAt(cue({ name: 'cloud', lifeMs: 3000 }), 2_999)).not.toBeNull()
    expect(effectAt(cue({ name: 'puff', vx: 40, vy: -40 }), 250)).toMatchObject({ dx: 10, dy: -10 })
  })

  it('bobs the cloud by at most a pixel', () => {
    for (let ms = 0; ms < 3000; ms += 50) {
      expect(Math.abs(effectAt(cue({ name: 'cloud' }), ms)?.dy ?? 0)).toBeLessThanOrEqual(1)
    }
  })
})
