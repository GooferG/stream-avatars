import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryStorage, ThrowingStorage } from '../test/fakes'
import { SafeStorage } from '../utils/storage'
import { CHOICES_KEY, ChoiceStore, MAX_REMEMBERED } from './choiceStore'

describe('ChoiceStore', () => {
  afterEach(() => vi.restoreAllMocks())

  it('remembers picks across restarts', () => {
    const storage = new MemoryStorage()
    new ChoiceStore(storage).update('gooferg', { kind: 'fox' })
    expect(new ChoiceStore(storage).get('gooferg')).toEqual({ kind: 'fox' })
    expect(new ChoiceStore(storage).get('someone_else')).toBeNull()
  })

  it('merges a new pick into the saved one', () => {
    const store = new ChoiceStore(new MemoryStorage())
    store.update('gooferg', { kind: 'human', build: 'chubby' })
    expect(store.update('gooferg', { kind: 'cat' })).toEqual({ kind: 'cat', build: 'chubby' })
    expect(store.get('gooferg')).toEqual({ kind: 'cat', build: 'chubby' })
  })

  it('saves everything under one key as { login: { kind, build, at } }', () => {
    const storage = new MemoryStorage()
    new ChoiceStore(storage, () => 1234).update('gooferg', { kind: 'human', build: 'skinny' })
    expect(JSON.parse(storage.getItem(CHOICES_KEY) ?? '')).toEqual({
      gooferg: { kind: 'human', build: 'skinny', at: 1234 },
    })
  })

  it('starts empty from corrupted JSON and repairs it on the next pick', () => {
    const storage = new MemoryStorage()
    storage.setItem(CHOICES_KEY, '{not json')
    const store = new ChoiceStore(storage)
    expect(store.get('gooferg')).toBeNull()
    store.update('gooferg', { kind: 'duck' })
    expect(new ChoiceStore(storage).get('gooferg')).toEqual({ kind: 'duck' })
    storage.setItem(CHOICES_KEY, '[1, 2]')
    expect(new ChoiceStore(storage).get('gooferg')).toBeNull()
  })

  it('skips saved entries it cannot use and keeps the rest', () => {
    const storage = new MemoryStorage()
    storage.setItem(
      CHOICES_KEY,
      JSON.stringify({
        good: { kind: 'bear', at: 1 },
        dragon: { kind: 'dragon', at: 2 },
        notime: { kind: 'cat' },
        odd: 'cat',
        halfgood: { kind: 'dragon', build: 'chubby', at: 3 },
      }),
    )
    const store = new ChoiceStore(storage)
    expect(store.get('good')).toEqual({ kind: 'bear' })
    expect(store.get('dragon')).toBeNull()
    expect(store.get('notime')).toBeNull()
    expect(store.get('odd')).toBeNull()
    expect(store.get('halfgood')).toEqual({ build: 'chubby' })
  })

  it('remembers skin tones and hairstyles, skipping values that no longer exist', () => {
    const storage = new MemoryStorage()
    new ChoiceStore(storage).update('pete', { kind: 'human', skin: 0, hairStyle: 'bun' })
    expect(new ChoiceStore(storage).get('pete')).toEqual({ kind: 'human', skin: 0, hairStyle: 'bun' })
    storage.setItem(
      CHOICES_KEY,
      JSON.stringify({
        badskin: { kind: 'human', skin: 9, at: 1 },
        halfskin: { skin: 1.5, hairStyle: 'mohawk', build: 'skinny', at: 2 },
        textskin: { skin: '3', at: 3 },
      }),
    )
    const store = new ChoiceStore(storage)
    expect(store.get('badskin')).toEqual({ kind: 'human' })
    expect(store.get('halfskin')).toEqual({ build: 'skinny' })
    expect(store.get('textskin')).toBeNull()
  })

  it('remembers colors and penguins, skipping color words that do not exist', () => {
    const storage = new MemoryStorage()
    new ChoiceStore(storage).update('pip', { kind: 'penguin', color: 'pink' })
    expect(new ChoiceStore(storage).get('pip')).toEqual({ kind: 'penguin', color: 'pink' })
    storage.setItem(
      CHOICES_KEY,
      JSON.stringify({
        teal: { kind: 'dog', color: 'teal', at: 1 },
        proto: { color: 'constructor', at: 2 },
        number: { color: 3, at: 3 },
      }),
    )
    const store = new ChoiceStore(storage)
    expect(store.get('teal')).toEqual({ kind: 'dog' })
    expect(store.get('proto')).toBeNull()
    expect(store.get('number')).toBeNull()
  })

  it(`forgets the least recently changed viewers past ${MAX_REMEMBERED}`, () => {
    const storage = new MemoryStorage()
    // saved newest first, to prove eviction goes by `at` and not by JSON order
    const saved = Array.from({ length: MAX_REMEMBERED }, (_, i) => [`viewer_${i}`, { kind: 'cat', at: i + 1 }])
    storage.setItem(CHOICES_KEY, JSON.stringify(Object.fromEntries(saved.reverse())))
    const store = new ChoiceStore(storage, () => 10_000)
    store.update('newcomer', { kind: 'fox' })
    const written = JSON.parse(storage.getItem(CHOICES_KEY) ?? '{}') as Record<string, unknown>
    expect(Object.keys(written)).toHaveLength(MAX_REMEMBERED)
    expect(store.get('viewer_0')).toBeNull()
    expect(store.get('viewer_1')).toEqual({ kind: 'cat' })
    expect(store.get('newcomer')).toEqual({ kind: 'fox' })
  })

  it('keeps picks for the session when browser storage throws', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const store = new ChoiceStore(new SafeStorage(new ThrowingStorage()))
    store.update('gooferg', { kind: 'frog' })
    expect(store.get('gooferg')).toEqual({ kind: 'frog' })
    expect(warn).toHaveBeenCalledTimes(1)
  })
})
