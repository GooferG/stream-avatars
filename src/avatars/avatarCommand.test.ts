import { describe, expect, it } from 'vitest'
import { BUILDS, COLOR_NAMES, HAIR_STYLES, KINDS, SKIN_TONES } from '../render/sprites/roster'
import { BUBBLE_LINE_CHARS, OVERLAY_BUBBLE_LINES, breakLines } from '../render/wrap'
import { isPrintableAscii } from '../utils/text'
import { AVATAR_HELP, parseAvatarCommand, parseSkinCommand, SKIN_HELP } from './avatarCommand'

const pick = (choice: object) => ({ type: 'pick', choice })
const help = { type: 'help' }

describe('parseAvatarCommand', () => {
  it('picks any kind on its own', () => {
    for (const kind of KINDS) expect(parseAvatarCommand([kind])).toEqual(pick({ kind }))
  })

  it('makes a build, hairstyle or skin number a human pick', () => {
    for (const build of BUILDS) expect(parseAvatarCommand([build])).toEqual(pick({ kind: 'human', build }))
    for (const hairStyle of HAIR_STYLES) {
      expect(parseAvatarCommand([hairStyle])).toEqual(pick({ kind: 'human', hairStyle }))
    }
    SKIN_TONES.forEach((_, skin) => {
      expect(parseAvatarCommand([String(skin + 1)])).toEqual(pick({ kind: 'human', skin }))
    })
  })

  it('combines words in any order, ignoring case and punctuation', () => {
    const skinnyLong3 = pick({ kind: 'human', build: 'skinny', skin: 2, hairStyle: 'long' })
    expect(parseAvatarCommand(['skinny', '3', 'long'])).toEqual(skinnyLong3)
    expect(parseAvatarCommand(['LONG', '3', 'Skinny!'])).toEqual(skinnyLong3)
    expect(parseAvatarCommand(['human', 'chubby', '5'])).toEqual(pick({ kind: 'human', build: 'chubby', skin: 4 }))
    expect(parseAvatarCommand(['Fox!'])).toEqual(pick({ kind: 'fox' }))
  })

  it('picks a color on its own, for whatever kind the viewer is', () => {
    for (const color of COLOR_NAMES) expect(parseAvatarCommand([color])).toEqual(pick({ color }))
  })

  it('combines a color with a kind, or with human-only words', () => {
    expect(parseAvatarCommand(['blue', 'dog'])).toEqual(pick({ kind: 'dog', color: 'blue' }))
    expect(parseAvatarCommand(['Penguin', 'PINK!'])).toEqual(pick({ kind: 'penguin', color: 'pink' }))
    expect(parseAvatarCommand(['long', 'red'])).toEqual(pick({ kind: 'human', hairStyle: 'long', color: 'red' }))
    expect(parseAvatarCommand(['chubby', '2', 'bun', 'green'])).toEqual(
      pick({ kind: 'human', build: 'chubby', skin: 1, hairStyle: 'bun', color: 'green' }),
    )
  })

  it('understands other spellings of the colors', () => {
    expect(parseAvatarCommand(['grey', 'cat'])).toEqual(pick({ kind: 'cat', color: 'gray' }))
    for (const word of ['golden', 'blond', 'blonde', 'yellow']) {
      expect(parseAvatarCommand([word])).toEqual(pick({ color: 'gold' }))
    }
  })

  it('accepts the word "skin" before a number, the way the help text reads', () => {
    expect(parseAvatarCommand(['skin', '3'])).toEqual(pick({ kind: 'human', skin: 2 }))
    expect(parseAvatarCommand(['skinny', 'skin', '1'])).toEqual(pick({ kind: 'human', build: 'skinny', skin: 0 }))
    expect(parseAvatarCommand(['skin'])).toEqual(help)
  })

  it('understands the aliases', () => {
    expect(parseAvatarCommand(['person', 'bun'])).toEqual(pick({ kind: 'human', hairStyle: 'bun' }))
    expect(parseAvatarCommand(['kitty'])).toEqual(pick({ kind: 'cat' }))
    expect(parseAvatarCommand(['puppy'])).toEqual(pick({ kind: 'dog' }))
    expect(parseAvatarCommand(['rabbit'])).toEqual(pick({ kind: 'bunny' }))
  })

  it('asks for help on nothing, unknown words, emoji or object property names', () => {
    const cases = [[], [''], ['dragon'], ['🦊'], ['constructor'], ['__proto__'], ['toString'], ['bear', 'please']]
    for (const args of cases) expect(parseAvatarCommand(args)).toEqual(help)
  })

  it('asks for help on skin numbers outside 1-6', () => {
    for (const word of ['0', '7', '3.5', '10']) expect(parseAvatarCommand([word])).toEqual(help)
  })

  it('asks for help on two words of the same kind, or an animal with a human-only word', () => {
    const cases = [
      ['skinny', 'chubby'], ['cat', 'dog'], ['3', '5'], ['long', 'bun'], ['fox', 'long'], ['cat', 'chubby'], ['duck', '2'],
      ['red', 'blue'], ['grey', 'gray'], ['penguin', 'teal'],
    ]
    for (const args of cases) expect(parseAvatarCommand(args)).toEqual(help)
  })
})

describe('parseSkinCommand', () => {
  it('is a shortcut for one skin number', () => {
    expect(parseSkinCommand(['3'])).toEqual(pick({ kind: 'human', skin: 2 }))
    expect(parseSkinCommand(['6'])).toEqual(pick({ kind: 'human', skin: 5 }))
  })

  it('asks for help on anything but one number from 1 to 6', () => {
    for (const args of [[], ['0'], ['7'], ['dark'], ['3', 'long'], ['fox']]) expect(parseSkinCommand(args)).toEqual(help)
  })
})

/** The lines a speech bubble shows for plain text: the pixel font is monospace. */
const bubbleLines = (text: string) =>
  breakLines(text.split(' ').map((w) => ({ w, width: w.length })), BUBBLE_LINE_CHARS, 1, Number.POSITIVE_INFINITY)
    .map((line) => line.map((item) => item.w).join(' '))

describe('help texts', () => {
  it('show every option, one group per bubble line', () => {
    expect(bubbleLines(AVATAR_HELP)).toEqual([
      '!avatar penguin blue',
      'human cat dog duck',
      'frog bunny bear fox',
      'skinny average chubby',
      'short long bun spiky',
      'skin 1-6 + any color',
    ])
    expect(bubbleLines(SKIN_HELP)).toEqual(['!skin 1-6 (light to', 'deep)'])
  })

  it('fit an overlay bubble in plain ASCII', () => {
    for (const text of [AVATAR_HELP, SKIN_HELP]) {
      expect(isPrintableAscii(text)).toBe(true)
      expect(bubbleLines(text).length).toBeLessThanOrEqual(OVERLAY_BUBBLE_LINES)
    }
  })
})
