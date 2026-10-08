import { lookDna, resolveLook, type Choice } from '../avatars/look'
import { PALETTES } from '../render/sprites/contract'
import {
  COLORS,
  furColor,
  HAIR_COLORS,
  hiddenUnderCap,
  NATURAL_FUR,
  type Build,
  type ColorName,
  type HairStyle,
  type Kind,
  type Look,
} from '../render/sprites/roster'

/** A color word, or `natural`: the username's hair color for humans, the animal's own fur. */
export type ColorPick = ColorName | 'natural'

/** Everything the builder page shows; the page keeps one and replaces it on every change. */
export interface BuilderState {
  kind: Kind
  build: Build
  hairStyle: HairStyle
  /** Index into SKIN_TONES (the line says `1` for 0). */
  skin: number
  color: ColorPick
  /** The viewer's chat login, normalized; null before they type one. */
  login: string | null
  /** Their Twitch name color, '#rrggbb'; null for the username's palette color. */
  nameColor: string | null
}

/** The look before a viewer types their name: human, average build, short brown hair, skin 1, no accessory. */
export const NEUTRAL_LOOK: Look = {
  kind: 'human',
  build: 'average',
  skin: 0,
  hairStyle: 'short',
  hairColor: 1,
  accessory: null,
  color: null,
}
/** The shirt and collar color before a viewer types their name: a neutral gray. */
export const NEUTRAL_BODY = 0x9aa7b8

/** lookDna wants a walk speed range; the look doesn't depend on it. */
const ANY_SPEEDS: [number, number] = [1, 1]

/** Chat logins are lowercase, without `@` or spaces; a typed name is cleaned up the same way. */
export function normalizeLogin(raw: string): string | null {
  const login = raw.replace(/\s+/g, '').replace(/^@+/, '').toLowerCase()
  return login || null
}

/** The look the overlay rolls for this login, or the neutral look without one. */
function baseLook(login: string | null): Look {
  return login ? lookDna(login, ANY_SPEEDS).look : NEUTRAL_LOOK
}

/**
 * The builder for a name (or none): that viewer's username look, with the
 * natural color. Under a rolled cap the stream draws tall hair as short
 * (see layersFor), so the builder starts from short hair: naming the tall
 * style in the line would take the cap off.
 */
export function initialState(rawLogin = ''): BuilderState {
  const login = normalizeLogin(rawLogin)
  const { kind, build, hairStyle, skin, accessory } = baseLook(login)
  const shownHair = accessory === 'cap' && hiddenUnderCap(hairStyle) ? 'short' : hairStyle
  return { kind, build, hairStyle: shownHair, skin, color: 'natural', login, nameColor: null }
}

/** A different name restarts the picks from that viewer's username look; the name color stays. */
export function withLogin(state: BuilderState, rawLogin: string): BuilderState {
  if (normalizeLogin(rawLogin) === state.login) return state
  return { ...initialState(rawLogin), nameColor: state.nameColor }
}

/** The choice the copied line makes: every field the builder shows for that kind. */
function choiceFor(state: BuilderState): Choice {
  const color = state.color === 'natural' ? null : state.color
  if (state.kind !== 'human') return { kind: state.kind, color }
  return { kind: 'human', build: state.build, hairStyle: state.hairStyle, skin: state.skin, color }
}

/** What the stream shows for these picks: the username look with the line's choice on top, like the overlay. */
export function lookFor(state: BuilderState): Look {
  return resolveLook(baseLook(state.login), choiceFor(state))
}

/** The `!avatar` line naming every field the builder shows, so earlier picks can't leak through. */
export function commandFor(state: BuilderState): string {
  if (state.kind !== 'human') return `!avatar ${state.kind} ${state.color}`
  return `!avatar human ${state.build} ${state.hairStyle} ${state.skin + 1} ${state.color}`
}

/** The shirt and collar color without a name color: the username's palette color, like the overlay. */
export function fallbackBodyFor(state: BuilderState): number {
  if (!state.login) return NEUTRAL_BODY
  return PALETTES[lookDna(state.login, ANY_SPEEDS).paletteIndex]?.body ?? NEUTRAL_BODY
}

/** The `natural` swatch: the username's hair color for a human, the animal's own fur. */
export function naturalColorFor(state: BuilderState): number {
  if (state.kind !== 'human') return NATURAL_FUR[state.kind]
  return HAIR_COLORS[baseLook(state.login).hairColor] ?? COLORS.brown
}

/** A color word's swatch: hair for a human, fur for an animal (black fur is a charcoal). */
export function swatchColorFor(state: BuilderState, color: ColorName): number {
  return state.kind === 'human' ? COLORS[color] : furColor(color)
}
