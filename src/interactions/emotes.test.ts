import { describe, expect, it } from 'vitest'
import { ANIMATIONS } from '../render/sprites/contract'
import { EMOTES, exhaleCues, isSmoke, smokeEmote } from './emotes'

describe('emotes', () => {
  it('plays each emote for its spec length; smoke and bong play their row exactly once', () => {
    expect(EMOTES.clap).toEqual({ anim: 'clap', seconds: 2 })
    expect(EMOTES.wave).toEqual({ anim: 'wave', seconds: 2 })
    expect(EMOTES.dance).toEqual({ anim: 'dance', seconds: 3, turnEverySec: 0.5 })
    for (const name of ['smoke', 'bong'] as const) {
      expect(EMOTES[name].seconds).toBe(ANIMATIONS[name].frames / ANIMATIONS[name].fps)
    }
  })

  it('smokes a joint, or the bong when the first word is bong', () => {
    expect(smokeEmote([])).toBe('smoke')
    expect(smokeEmote(['BONG', 'please'])).toBe('bong')
    expect(smokeEmote(['weed'])).toBe('smoke')
    expect(isSmoke('bong') && isSmoke('smoke') && !isSmoke('dance')).toBe(true)
  })

  it('puffs smoke from the mouth on the exhale, drifting the way the character faces', () => {
    const joint = exhaleCues('smoke', 500, -1)
    expect(joint.map((c) => c.delayMs)).toEqual([2_700, 2_950, 3_200])
    expect(joint.every((c) => c.name === 'smoke' && c.x === 500 && c.vx === -6 && c.rise === 25)).toBe(true)
    expect(exhaleCues('bong', 500, 1)).toHaveLength(4)
  })
})
