import { describe, expect, it } from 'vitest'
import { MAX_REMEMBERED } from '../avatars/choiceStore'
import { MemoryStorage } from '../test/fakes'
import { FIGHTS_KEY, InteractionStore, OPT_OUTS_KEY } from './interactionStore'

describe('InteractionStore', () => {
  it('remembers an opt-out across restarts, and forgets it on !interact', () => {
    const storage = new MemoryStorage()
    new InteractionStore(storage).setOptedOut('bob', true)
    const reopened = new InteractionStore(storage)
    expect(reopened.isOptedOut('bob')).toBe(true)
    expect(reopened.isOptedOut('alice')).toBe(false)
    reopened.setOptedOut('bob', false)
    expect(new InteractionStore(storage).isOptedOut('bob')).toBe(false)
  })

  it('counts wins and losses, returns the winner record, and keeps them across restarts', () => {
    const storage = new MemoryStorage()
    const store = new InteractionStore(storage)
    expect(store.record('alice')).toEqual({ wins: 0, losses: 0 })
    expect(store.addResult('alice', 'bob')).toEqual({ wins: 1, losses: 0 })
    expect(store.addResult('bob', 'alice')).toEqual({ wins: 1, losses: 1 })
    const reopened = new InteractionStore(storage)
    expect(reopened.record('alice')).toEqual({ wins: 1, losses: 1 })
    expect(reopened.record('bob')).toEqual({ wins: 1, losses: 1 })
  })

  it('starts empty from corrupted or foreign data, skipping unusable entries', () => {
    const storage = new MemoryStorage()
    storage.setItem(OPT_OUTS_KEY, '{nope')
    storage.setItem(
      FIGHTS_KEY,
      JSON.stringify({ alice: { w: 2, l: 1, at: 5 }, bob: { w: -1, l: 0, at: 5 }, carol: { w: 1.5, l: 0, at: 5 }, dave: 'x' }),
    )
    const store = new InteractionStore(storage)
    expect(store.isOptedOut('anyone')).toBe(false)
    expect(store.record('alice')).toEqual({ wins: 2, losses: 1 })
    expect(store.record('bob')).toEqual({ wins: 0, losses: 0 })
    expect(store.record('carol')).toEqual({ wins: 0, losses: 0 })
    expect(new InteractionStore(new MemoryStorage()).record('x')).toEqual({ wins: 0, losses: 0 })
  })

  it(`remembers at most ${MAX_REMEMBERED} viewers each, forgetting the least recently changed`, () => {
    let t = 0
    const store = new InteractionStore(new MemoryStorage(), () => t++)
    for (let i = 0; i <= MAX_REMEMBERED; i++) store.setOptedOut(`viewer${i}`, true)
    expect(store.isOptedOut('viewer0')).toBe(false)
    expect(store.isOptedOut(`viewer${MAX_REMEMBERED}`)).toBe(true)
    for (let i = 0; i <= MAX_REMEMBERED; i++) store.addResult(`w${i}`, 'loser')
    expect(store.record('w0')).toEqual({ wins: 0, losses: 0 })
    expect(store.record('loser').losses).toBe(MAX_REMEMBERED + 1)
  })
})
