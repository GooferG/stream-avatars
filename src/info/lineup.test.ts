import { describe, expect, it } from 'vitest'
import { parseAvatarCommand } from '../avatars/avatarCommand'
import { ANIMALS, BUILDS, HAIR_STYLES, layersFor } from '../render/sprites/roster'
import { HAIRSTYLE_PREVIEWS, LINEUP } from './lineup'

describe('HAIRSTYLE_PREVIEWS', () => {
  it('shows every hairstyle word !avatar accepts, on a human who picked it', () => {
    expect(HAIRSTYLE_PREVIEWS.map((e) => e.name)).toEqual([...HAIR_STYLES])
    for (const entry of HAIRSTYLE_PREVIEWS) {
      const command = parseAvatarCommand([entry.name])
      if (command.type === 'help') throw new Error(`"${entry.name}" is not an !avatar word`)
      expect(entry.look.kind).toBe('human')
      expect(entry.look.hairStyle).toBe(command.choice.hairStyle)
    }
  })

  it('draws each hairstyle as itself, never tucked under a cap', () => {
    for (const entry of HAIRSTYLE_PREVIEWS) {
      const sheets = layersFor(entry.look).map((l) => l.sheet)
      expect(sheets).toContain(`hair-${entry.name}`)
      expect(entry.look.accessory).toBeNull()
    }
  })
})

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
