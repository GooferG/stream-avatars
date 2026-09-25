import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StripController } from './stripController'

describe('StripController', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  function setup() {
    const view = { show: vi.fn(), hide: vi.fn() }
    return { view, strip: new StripController(view, 12_000) }
  }

  it('slides up, stays for the duration, then slides down', () => {
    const { view, strip } = setup()
    strip.open()
    expect(view.show).toHaveBeenCalledTimes(1)
    expect(strip.isOpen).toBe(true)
    vi.advanceTimersByTime(11_999)
    expect(view.hide).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(view.hide).toHaveBeenCalledTimes(1)
    expect(strip.isOpen).toBe(false)
  })

  it('restarts the countdown when opened again while up, without replaying the slide', () => {
    const { view, strip } = setup()
    strip.open()
    vi.advanceTimersByTime(6_000)
    strip.open()
    expect(view.show).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(11_999)
    expect(view.hide).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(view.hide).toHaveBeenCalledTimes(1)
  })

  it('slides up again after it closed', () => {
    const { view, strip } = setup()
    strip.open()
    vi.advanceTimersByTime(12_000)
    strip.open()
    expect(view.show).toHaveBeenCalledTimes(2)
  })
})
