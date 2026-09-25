import { describe, expect, it } from 'vitest'
import { parseAvatarCommand } from '../avatars/avatarCommand'
import { ANIMALS, BUILDS } from '../render/sprites/roster'
import { LINEUP } from './lineup'

describe('LINEUP', () => {
  it('signs each human build, then every animal', () => {
    expect(LINEUP.map((e) => e.name)).toEqual([...BUILDS, ...ANIMALS])
  })

  it('shows exactly what typing each sign after !avatar picks', () => {
    for (const entry of LINEUP) {
      const command = parseAvatarCommand([entry.name])
      if (command.type === 'help') throw new Error(`"${entry.name}" is not an !avatar word`)
      const { choice } = command
      expect(entry.look.kind).toBe(choice.kind)
      if (choice.build) expect(entry.look.build).toBe(choice.build)
    }
  })

  it('shows the humans in different skin tones', () => {
    const humans = LINEUP.filter((e) => e.look.kind === 'human')
    expect(new Set(humans.map((e) => e.look.skin)).size).toBe(humans.length)
  })
})
