import { describe, expect, it } from 'vitest'
import { BLINK_MS, BlinkDetector } from './visibilityTrigger'

describe('BlinkDetector', () => {
  it('opens on a quick hide then show (the Stream Deck button)', () => {
    const blink = new BlinkDetector()
    expect(blink.onVisibleChanged(false, 1_000)).toBe(false)
    expect(blink.onVisibleChanged(true, 1_300)).toBe(true)
  })

  it('does not open when the source loads visible', () => {
    expect(new BlinkDetector().onVisibleChanged(true, 0)).toBe(false)
  })

  it('does not open when the source comes back after a long time hidden (switching scenes)', () => {
    const blink = new BlinkDetector()
    blink.onVisibleChanged(false, 0)
    expect(blink.onVisibleChanged(true, 60_000)).toBe(false)
  })

  it(`counts a show up to ${BLINK_MS} ms after the hide`, () => {
    const a = new BlinkDetector()
    a.onVisibleChanged(false, 0)
    expect(a.onVisibleChanged(true, BLINK_MS)).toBe(true)
    const b = new BlinkDetector()
    b.onVisibleChanged(false, 0)
    expect(b.onVisibleChanged(true, BLINK_MS + 1)).toBe(false)
  })

  it('needs a new hide before it opens again', () => {
    const blink = new BlinkDetector()
    blink.onVisibleChanged(false, 0)
    expect(blink.onVisibleChanged(true, 100)).toBe(true)
    expect(blink.onVisibleChanged(true, 200)).toBe(false)
  })
})
