import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryStorage, ThrowingStorage } from '../test/fakes'
import { browserStorage, SafeStorage } from './storage'

describe('SafeStorage', () => {
  afterEach(() => vi.restoreAllMocks())

  it('reads what another page wrote and writes through', () => {
    const shared = new MemoryStorage()
    shared.setItem('theirs', 'x')
    const safe = new SafeStorage(shared)
    expect(safe.getItem('theirs')).toBe('x')
    safe.setItem('mine', 'y')
    expect(shared.getItem('mine')).toBe('y')
    expect(safe.getItem('missing')).toBeNull()
  })

  it('keeps working from memory with one warning when storage throws', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const safe = new SafeStorage(new ThrowingStorage())
    expect(safe.getItem('k')).toBeNull()
    safe.setItem('k', 'v')
    safe.setItem('k2', 'v2')
    expect(safe.getItem('k')).toBe('v')
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('works from memory with one warning when there is no storage', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const safe = new SafeStorage(null)
    safe.setItem('k', 'v')
    expect(safe.getItem('k')).toBe('v')
    expect(warn).toHaveBeenCalledTimes(1)
  })
})

describe('browserStorage', () => {
  it('is null where there is no window to ask (like node, here)', () => {
    expect(browserStorage()).toBeNull()
  })
})
