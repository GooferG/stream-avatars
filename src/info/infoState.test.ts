import { describe, expect, it } from 'vitest'
import { MemoryStorage } from '../test/fakes'
import {
  ALIVE_WINDOW_MS,
  InfoState,
  infoDecision,
  isPrivileged,
  showHelpInstead,
  type HelpCheck,
} from './infoState'

describe('infoDecision', () => {
  it('opens when never opened, and again once the cooldown is over', () => {
    expect(infoDecision(1_000, null, false, 60_000)).toBe('open')
    expect(infoDecision(60_999, 1_000, false, 60_000)).toBe('cooldown')
    expect(infoDecision(61_000, 1_000, false, 60_000)).toBe('open')
  })

  it('lets the broadcaster and mods skip the cooldown', () => {
    expect(infoDecision(2_000, 1_000, true, 60_000)).toBe('open')
  })

  it('opens when the clock moved backwards past the last opening', () => {
    expect(infoDecision(1_000, 50_000, false, 60_000)).toBe('open')
  })
})

describe('isPrivileged', () => {
  it('is true for the broadcaster and moderators', () => {
    expect(isPrivileged({ badges: { broadcaster: '1' } })).toBe(true)
    expect(isPrivileged({ badges: { moderator: '1' } })).toBe(true)
    expect(isPrivileged({ badges: null, mod: true })).toBe(true)
    expect(isPrivileged({ mod: '1' })).toBe(true)
  })

  it('is false for everyone else, including missing or null badges', () => {
    expect(isPrivileged({ badges: { subscriber: '12', vip: '1' }, mod: false })).toBe(false)
    expect(isPrivileged({ badges: null })).toBe(false)
    expect(isPrivileged({})).toBe(false)
  })
})

describe('InfoState', () => {
  it('shares the last opening and the heartbeat between pages', () => {
    const shared = new MemoryStorage()
    const strip = new InfoState(shared)
    const overlay = new InfoState(shared)
    expect(overlay.lastOpen()).toBeNull()
    expect(overlay.aliveAt()).toBeNull()
    strip.recordOpen({ at: 5_000, messageId: 'm1' })
    strip.beat(6_000)
    expect(overlay.lastOpen()).toEqual({ at: 5_000, messageId: 'm1' })
    expect(overlay.aliveAt()).toBe(6_000)
  })

  it('treats garbage in storage as never opened and not alive', () => {
    const shared = new MemoryStorage()
    shared.setItem('chat-avatars:info:lastOpenAt', '{"at":"soon"}')
    shared.setItem('chat-avatars:info:alive', 'yesterday')
    const state = new InfoState(shared)
    expect(state.lastOpen()).toBeNull()
    expect(state.aliveAt()).toBeNull()
  })

  it('tells the overlay at once when the strip stops being available', () => {
    const shared = new MemoryStorage()
    const strip = new InfoState(shared)
    const overlay = new InfoState(shared)
    strip.beat(100_000)
    strip.markUnavailable()
    const check: HelpCheck = {
      now: 100_500,
      lastOpen: null,
      aliveAt: overlay.aliveAt(),
      messageId: 'm1',
      privileged: false,
      cooldownMs: 60_000,
    }
    expect(showHelpInstead(check)).toBe(true)
  })
})

describe('showHelpInstead', () => {
  const base: HelpCheck = {
    now: 100_000,
    lastOpen: null,
    aliveAt: 95_000,
    messageId: 'm2',
    privileged: false,
    cooldownMs: 60_000,
  }

  it('shows help when the strip is not running (no heartbeat, or a stale one)', () => {
    expect(showHelpInstead({ ...base, aliveAt: null })).toBe(true)
    expect(showHelpInstead({ ...base, aliveAt: base.now - ALIVE_WINDOW_MS - 1 })).toBe(true)
  })

  it('stays quiet when the strip will open for this message', () => {
    expect(showHelpInstead(base)).toBe(false)
    expect(showHelpInstead({ ...base, lastOpen: { at: 30_000, messageId: 'm1' } })).toBe(false)
  })

  it('shows help while the strip is cooling down from another message', () => {
    expect(showHelpInstead({ ...base, lastOpen: { at: 90_000, messageId: 'm1' } })).toBe(true)
  })

  it('stays quiet when the strip already opened for this very message (either order)', () => {
    expect(showHelpInstead({ ...base, lastOpen: { at: 99_900, messageId: 'm2' } })).toBe(false)
  })

  it('stays quiet for mods, who skip the cooldown', () => {
    expect(
      showHelpInstead({ ...base, privileged: true, lastOpen: { at: 90_000, messageId: 'm1' } }),
    ).toBe(false)
  })
})
