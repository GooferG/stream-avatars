import { describe, expect, it } from 'vitest'
import { NAME_FADE_MS, namePlateAlpha, showsName } from './namePlate'

describe('showsName', () => {
  it('shows the name while a bubble is up, whatever the character is doing', () => {
    expect(showsName('idle', true)).toBe(true)
    expect(showsName('wander', true)).toBe(true)
  })

  it('shows it while jumping, emoting or in an interaction, which have no bubble', () => {
    for (const state of ['jump', 'emote', 'scripted'] as const) expect(showsName(state, false), state).toBe(true)
  })

  it('hides it while idle, wandering, walking, reacting with the crowd or seated', () => {
    for (const state of ['entering', 'idle', 'wander', 'talk', 'react', 'sit', 'leaving'] as const) {
      expect(showsName(state, false), state).toBe(false)
    }
  })
})

describe('namePlateAlpha', () => {
  it('is fully shown while active, then fades out', () => {
    expect(namePlateAlpha(0)).toBe(1)
    expect(namePlateAlpha(NAME_FADE_MS / 2)).toBeCloseTo(0.5)
    expect(namePlateAlpha(NAME_FADE_MS)).toBe(0)
    expect(namePlateAlpha(NAME_FADE_MS * 10)).toBe(0)
  })

  it('stays hidden for a character that was never active', () => {
    expect(namePlateAlpha(null)).toBe(0)
  })
})
