import { describe, expect, it } from 'vitest'
import { BUILDS, KINDS } from '../render/sprites/roster'
import { isPrintableAscii } from '../utils/text'
import { AVATAR_HELP, choiceFromCommand, parseAvatarCommand } from './avatarCommand'

describe('parseAvatarCommand', () => {
  it('accepts every kind and build by name', () => {
    for (const kind of KINDS) expect(parseAvatarCommand([kind])).toEqual({ type: 'kind', kind })
    for (const build of BUILDS) expect(parseAvatarCommand([build])).toEqual({ type: 'build', build })
  })

  it('ignores case, punctuation and extra words', () => {
    expect(parseAvatarCommand(['Fox'])).toEqual({ type: 'kind', kind: 'fox' })
    expect(parseAvatarCommand(['CAT!'])).toEqual({ type: 'kind', kind: 'cat' })
    expect(parseAvatarCommand(['bear', 'please'])).toEqual({ type: 'kind', kind: 'bear' })
  })

  it('understands the aliases', () => {
    expect(parseAvatarCommand(['person'])).toEqual({ type: 'kind', kind: 'human' })
    expect(parseAvatarCommand(['kitty'])).toEqual({ type: 'kind', kind: 'cat' })
    expect(parseAvatarCommand(['puppy'])).toEqual({ type: 'kind', kind: 'dog' })
    expect(parseAvatarCommand(['rabbit'])).toEqual({ type: 'kind', kind: 'bunny' })
  })

  it('asks for help on no word, an unknown word, emoji or object property names', () => {
    const cases = [[], [''], ['dragon'], ['🦊'], ['constructor'], ['__proto__'], ['toString'], ['hasOwnProperty']]
    for (const args of cases) expect(parseAvatarCommand(args)).toEqual({ type: 'help' })
  })
})

describe('AVATAR_HELP', () => {
  it('lists every option in plain ASCII the pixel font can draw', () => {
    expect(AVATAR_HELP).toBe('!avatar human cat dog duck frog bunny bear fox | skinny average chubby')
    expect(isPrintableAscii(AVATAR_HELP)).toBe(true)
  })
})

describe('choiceFromCommand', () => {
  it('saves a kind as-is and a build as a human pick', () => {
    expect(choiceFromCommand({ type: 'kind', kind: 'duck' })).toEqual({ kind: 'duck' })
    expect(choiceFromCommand({ type: 'build', build: 'skinny' })).toEqual({ kind: 'human', build: 'skinny' })
  })
})
