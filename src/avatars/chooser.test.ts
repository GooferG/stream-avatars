import { describe, expect, it } from 'vitest'
import { MemoryStorage } from '../test/fakes'
import { parseAvatarCommand, parseSkinCommand } from './avatarCommand'
import { ChoiceStore } from './choiceStore'
import { AvatarChooser, choiceAction } from './chooser'

function setup() {
  const store = new ChoiceStore(new MemoryStorage())
  return { store, chooser: new AvatarChooser(store, 10_000) }
}
const avatar = (...words: string[]) => parseAvatarCommand(words)

describe('AvatarChooser', () => {
  it('saves a pick and reports the change', () => {
    const { store, chooser } = setup()
    expect(chooser.choose('gooferg', avatar('fox'), 0)).toBe('changed')
    expect(store.get('gooferg')).toEqual({ kind: 'fox' })
    expect(chooser.choose('pete', avatar('chubby'), 0)).toBe('changed')
    expect(store.get('pete')).toEqual({ kind: 'human', build: 'chubby' })
  })

  it('saves a whole combo in one change, on top of earlier picks', () => {
    const { store, chooser } = setup()
    chooser.choose('gooferg', avatar('chubby'), 0)
    expect(chooser.choose('gooferg', avatar('long', '3'), 10_000)).toBe('changed')
    expect(store.get('gooferg')).toEqual({ kind: 'human', build: 'chubby', hairStyle: 'long', skin: 2 })
  })

  it('asks for help without saving anything or starting the cooldown', () => {
    const { store, chooser } = setup()
    expect(chooser.choose('gooferg', avatar('dragon'), 0)).toBe('help')
    expect(store.get('gooferg')).toBeNull()
    expect(chooser.choose('gooferg', avatar('fox'), 1)).toBe('changed')
  })

  it('ignores changes inside the cooldown, per viewer, shared by !avatar and !skin', () => {
    const { store, chooser } = setup()
    chooser.choose('gooferg', avatar('fox'), 0)
    expect(chooser.choose('gooferg', avatar('cat'), 9_999)).toBe('cooldown')
    expect(chooser.choose('gooferg', parseSkinCommand(['2']), 9_999)).toBe('cooldown')
    expect(store.get('gooferg')).toEqual({ kind: 'fox' })
    expect(chooser.choose('pete', avatar('cat'), 5_000)).toBe('changed')
    expect(chooser.choose('gooferg', avatar('cat'), 10_000)).toBe('changed')
    expect(store.get('gooferg')).toEqual({ kind: 'cat' })
  })

  it('still shows help during the cooldown', () => {
    const { chooser } = setup()
    chooser.choose('gooferg', avatar('fox'), 0)
    expect(chooser.choose('gooferg', avatar(), 1)).toBe('help')
  })
})

describe('choiceAction', () => {
  it('walks in wearing the pick when there is no character', () => {
    expect(choiceAction(null)).toBe('spawn')
  })

  it('swaps in place with a hop when the character is standing, wandering or talking', () => {
    for (const state of ['idle', 'wander', 'talk'] as const) expect(choiceAction(state)).toBe('swap')
  })

  it('swaps without a hop while walking in, reacting or mid-jump, so that motion carries on', () => {
    for (const state of ['entering', 'react', 'jump'] as const) expect(choiceAction(state)).toBe('swap-only')
  })

  it('waits while the character walks off (the pick shows on the next visit)', () => {
    expect(choiceAction('leaving')).toBe('wait')
    expect(choiceAction('gone')).toBe('wait')
  })
})
