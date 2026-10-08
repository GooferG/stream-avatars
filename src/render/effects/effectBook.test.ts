import { describe, expect, it } from 'vitest'
import { EffectBook } from './effectBook'
import type { EffectCue } from './effectMotion'

const cue = (over: Partial<EffectCue> & Pick<EffectCue, 'name'>): EffectCue => ({ x: 0, rise: 0, ...over })

/** A book over plain numbered items, recording what it takes, gives back and shows. */
function book(cap = 64) {
  const b = new EffectBook<number>(cap)
  let next = 0
  const taken: number[] = []
  const released: number[] = []
  const shown = new Set<string>()
  const step = (ms: number, frames = 1) => {
    for (let i = 0; i < frames; i++) {
      b.advance(
        ms,
        () => {
          taken.push(next)
          return next++
        },
        (n) => released.push(n),
        (fx) => shown.add(`${fx.cue.name}@${fx.cue.x}`),
      )
    }
  }
  return { b, taken, released, shown, step }
}

describe('EffectBook', () => {
  it('gives a delayed cue nothing to draw with until its delay is over', () => {
    const t = book()
    t.b.add(cue({ name: 'smoke', delayMs: 2_700 }), 1080)
    t.step(100, 26)
    expect(t.taken).toHaveLength(0)
    expect(t.b.waitingCount).toBe(1)
    t.step(100, 1)
    expect(t.taken).toHaveLength(1)
    expect(t.b.showingCount).toBe(1)
  })

  it('shows every puff of a full !sesh at 25 avatars: 75 cues, none dropped before it shows', () => {
    const t = book(64)
    for (let s = 0; s < 25; s++) {
      const ripple = (s / 25) * 1_200
      ;[2_700, 2_950, 3_200].forEach((delay, i) => t.b.add(cue({ name: 'smoke', x: s * 10 + i, delayMs: ripple + delay }), 1080))
    }
    t.step(1000 / 60, 60 * 6)
    expect(t.shown.size).toBe(75)
    expect(t.b.showingCount).toBe(0)
  })

  it('makes room by ending the effect closest to its end: a fresh fight cloud outlives fading puffs', () => {
    const t = book(3)
    t.b.add(cue({ name: 'smoke', x: 1 }), 1080)
    t.b.add(cue({ name: 'smoke', x: 2 }), 1080)
    t.step(1000)
    t.b.add(cue({ name: 'cloud', x: 3, lifeMs: 3000 }), 1080)
    t.step(16)
    t.b.add(cue({ name: 'heart', x: 4 }), 1080)
    t.step(16)
    expect(t.released).toEqual([0]) // the oldest puff, not the cloud (item 2)
    expect(t.b.showingCount).toBe(3)
  })

  it('ages effects by the time it is advanced, so a stalled frame never ends a cloud before its poof', () => {
    const t = book()
    t.b.add(cue({ name: 'cloud', lifeMs: 3000 }), 1080)
    t.step(100, 29) // 2.9 s of clamped frame time, however long those frames really took
    expect(t.b.showingCount).toBe(1)
    t.step(100, 1)
    expect(t.b.showingCount).toBe(0)
    expect(t.released).toEqual([0])
  })

  it('gives back everything it holds when cleared', () => {
    const t = book()
    t.b.add(cue({ name: 'heart' }), 1080)
    t.b.add(cue({ name: 'smoke', delayMs: 5_000 }), 1080)
    t.step(16)
    t.b.clear((n) => t.released.push(n))
    expect(t.released).toEqual([0])
    expect(t.b.showingCount).toBe(0)
    expect(t.b.waitingCount).toBe(0)
  })
})
