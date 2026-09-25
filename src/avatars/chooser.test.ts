import { describe, expect, it } from 'vitest'
import { MemoryStorage } from '../test/fakes'
import { ChoiceStore } from './choiceStore'
import { AvatarChooser, choiceAction } from './chooser'

function setup() {
  const store = new ChoiceStore(new MemoryStorage())
  return { store, chooser: new AvatarChooser(store, 10_000) }
}

describe('AvatarChooser', () => {
  it('saves a pick and reports the change', () => {
    const { store, chooser } = setup()
    expect(chooser.choose('gooferg', ['fox'], 0)).toBe('changed')
    expect(store.get('gooferg')).toEqual({ kind: 'fox' })
    expect(chooser.choose('pete', ['chubby'], 0)).toBe('changed')
    expect(store.get('pete')).toEqual({ kind: 'human', build: 'chubby' })
  })

  it('asks for help without saving anything or starting the cooldown', () => {
    const { store, chooser } = setup()
    expect(chooser.choose('gooferg', ['dragon'], 0)).toBe('help')
    expect(store.get('gooferg')).toBeNull()
    expect(chooser.choose('gooferg', ['fox'], 1)).toBe('changed')
  })

  it('ignores changes inside the cooldown, per viewer', () => {
    const { store, chooser } = setup()
    chooser.choose('gooferg', ['fox'], 0)
    expect(chooser.choose('gooferg', ['cat'], 9_999)).toBe('cooldown')
    expect(store.get('gooferg')).toEqual({ kind: 'fox' })
    expect(chooser.choose('pete', ['cat'], 5_000)).toBe('changed')
    expect(chooser.choose('gooferg', ['cat'], 10_000)).toBe('changed')
    expect(store.get('gooferg')).toEqual({ kind: 'cat' })
  })

  it('still shows help during the cooldown', () => {
    const { chooser } = setup()
    chooser.choose('gooferg', ['fox'], 0)
    expect(chooser.choose('gooferg', [], 1)).toBe('help')
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
