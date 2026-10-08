import { describe, expect, it } from 'vitest'
import { parseAvatarCommand } from '../avatars/avatarCommand'
import { ChoiceStore } from '../avatars/choiceStore'
import { lookDna, resolveLook, type Choice } from '../avatars/look'
import { PALETTES } from '../render/sprites/contract'
import {
  ANIMALS,
  BUILDS,
  COLOR_NAMES,
  COLORS,
  furColor,
  HAIR_COLORS,
  HAIR_STYLES,
  NATURAL_FUR,
  SKIN_TONES,
  type Look,
} from '../render/sprites/roster'
import { MemoryStorage } from '../test/fakes'
import {
  commandFor,
  fallbackBodyFor,
  initialState,
  lookFor,
  naturalColorFor,
  NEUTRAL_BODY,
  NEUTRAL_LOOK,
  normalizeLogin,
  swatchColorFor,
  withLogin,
  type BuilderState,
  type ColorPick,
} from './builderState'

const SPEEDS: [number, number] = [30, 70]

/** The first test login whose username look matches, so the grid covers that case. */
function loginWhere(test: (look: Look) => boolean): string {
  for (let i = 0; i < 1000; i++) {
    if (test(lookDna(`viewer_${i}`, SPEEDS).look)) return `viewer_${i}`
  }
  throw new Error('no test login matches')
}

/**
 * What the overlay shows once `login` pastes `line` with `earlier` already
 * saved: the real parser, store and resolver, reloaded from storage the
 * way the next stream starts.
 */
function streamLook(login: string, earlier: Choice | null, line: string): Look {
  const [bang, ...args] = line.split(' ')
  if (bang !== '!avatar') throw new Error(`not an !avatar line: ${line}`)
  const command = parseAvatarCommand(args)
  if (command.type !== 'pick') throw new Error(`the overlay asks for help on: ${line}`)
  const storage = new MemoryStorage()
  const store = new ChoiceStore(storage)
  if (earlier) store.update(login, earlier)
  store.update(login, command.choice)
  return resolveLook(lookDna(login, SPEEDS).look, new ChoiceStore(storage).get(login))
}

/** What shows on screen: an animal draws only its kind and fur (no build, hair, skin or accessory). */
const visible = (look: Look): Partial<Look> => (look.kind === 'human' ? look : { kind: look.kind, color: look.color })

/** Every state the builder can reach for a login: each kind, build, hairstyle, skin and color. */
function* allStates(login: string): Generator<BuilderState> {
  const start = initialState(login)
  const colors: ColorPick[] = ['natural', ...COLOR_NAMES]
  for (const color of colors) {
    for (const kind of ANIMALS) yield { ...start, kind, color }
    for (const build of BUILDS) {
      for (const hairStyle of HAIR_STYLES) {
        for (const skin of SKIN_TONES.keys()) yield { ...start, kind: 'human', build, hairStyle, skin, color }
      }
    }
  }
}

describe('normalizeLogin', () => {
  it('drops @ and spaces and lowercases, like chat logins', () => {
    expect(normalizeLogin(' @GooferG ')).toBe('gooferg')
    expect(normalizeLogin('@@goo ferg')).toBe('gooferg')
  })

  it('is null when nothing is left', () => {
    expect(normalizeLogin('')).toBeNull()
    expect(normalizeLogin(' @ ')).toBeNull()
  })
})

describe('initialState', () => {
  it('starts from the neutral look without a name', () => {
    expect(initialState()).toEqual({
      kind: 'human',
      build: 'average',
      hairStyle: 'short',
      skin: 0,
      color: 'natural',
      login: null,
      nameColor: null,
    })
    expect(lookFor(initialState())).toEqual(NEUTRAL_LOOK)
  })

  it("starts from the viewer's username look with a name", () => {
    const rolled = lookDna('gooferg', SPEEDS).look
    expect(initialState('@GooferG ')).toEqual({
      kind: rolled.kind,
      build: rolled.build,
      hairStyle: rolled.hairStyle,
      skin: rolled.skin,
      color: 'natural',
      login: 'gooferg',
      nameColor: null,
    })
  })
})

describe('withLogin', () => {
  it("restarts the picks from a new name's look and keeps the name color", () => {
    const before: BuilderState = { ...initialState(), kind: 'fox', color: 'red', nameColor: '#ff0000' }
    expect(withLogin(before, 'GooferG')).toEqual({ ...initialState('gooferg'), nameColor: '#ff0000' })
  })

  it('keeps the picks when the name typed is the same login', () => {
    const picked: BuilderState = { ...initialState('gooferg'), kind: 'fox', color: 'blue' }
    expect(withLogin(picked, ' @GooferG')).toBe(picked)
  })
})

describe('commandFor', () => {
  it('names every field for a human', () => {
    const state: BuilderState = { ...initialState(), build: 'chubby', hairStyle: 'bun', skin: 4, color: 'red' }
    expect(commandFor(state)).toBe('!avatar human chubby bun 5 red')
    expect(commandFor({ ...state, color: 'natural' })).toBe('!avatar human chubby bun 5 natural')
  })

  it('names the kind and color for every animal', () => {
    for (const kind of ANIMALS) {
      expect(commandFor({ ...initialState(), kind, color: 'natural' })).toBe(`!avatar ${kind} natural`)
      expect(commandFor({ ...initialState(), kind, color: 'blue' })).toBe(`!avatar ${kind} blue`)
    }
  })

  it('pastes into exactly the look it shows, whatever the viewer picked before', () => {
    const logins = [
      'gooferg',
      loginWhere((look) => look.kind !== 'human'),
      loginWhere((look) => look.accessory === 'cap'),
    ]
    const earlierPicks: (Choice | null)[] = [
      null,
      { color: 'green' },
      { kind: 'fox', color: 'red' },
      { kind: 'human', build: 'chubby', hairStyle: 'bun', skin: 5, color: 'blue' },
    ]
    let checked = 0
    for (const login of logins) {
      for (const state of allStates(login)) {
        const line = commandFor(state)
        for (const earlier of earlierPicks) {
          expect(visible(streamLook(login, earlier, line)), `${login} after ${JSON.stringify(earlier)}: ${line}`).toEqual(
            visible(lookFor(state)),
          )
          checked++
        }
      }
    }
    expect(checked).toBe(3 * 12 * (ANIMALS.length + 72) * 4)
  })
})

describe('colors', () => {
  it('dresses a nameless viewer in neutral gray, and a named one in their palette color', () => {
    expect(fallbackBodyFor(initialState())).toBe(NEUTRAL_BODY)
    const paletteIndex = lookDna('gooferg', SPEEDS).paletteIndex
    expect(fallbackBodyFor(initialState('gooferg'))).toBe(PALETTES[paletteIndex]?.body)
  })

  it("shows natural as the username's hair for a human and the animal's own fur", () => {
    const rolled = lookDna('gooferg', SPEEDS).look
    expect(naturalColorFor({ ...initialState('gooferg'), kind: 'human' })).toBe(HAIR_COLORS[rolled.hairColor])
    expect(naturalColorFor(initialState())).toBe(COLORS.brown)
    for (const kind of ANIMALS) expect(naturalColorFor({ ...initialState(), kind })).toBe(NATURAL_FUR[kind])
  })

  it('shows a color word as hair for a human and as fur for an animal', () => {
    expect(swatchColorFor(initialState(), 'black')).toBe(COLORS.black)
    expect(swatchColorFor({ ...initialState(), kind: 'cat' }, 'black')).toBe(furColor('black'))
    expect(swatchColorFor({ ...initialState(), kind: 'cat' }, 'blue')).toBe(COLORS.blue)
  })
})
