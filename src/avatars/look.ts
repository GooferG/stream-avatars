import { PALETTES } from '../render/sprites/contract'
import {
  ACCESSORIES,
  ANIMALS,
  BUILDS,
  HAIR_COLORS,
  HAIR_STYLES,
  SKIN_TONES,
  type Build,
  type Kind,
  type Look,
} from '../render/sprites/roster'
import { mulberry32, pickIndex, range } from '../utils/rng'
import { fnv1a32 } from './dna'

/** Share of viewers who default to a human; the rest split evenly across the animals. */
export const HUMAN_SHARE = 0.5

export interface LookDna {
  look: Look
  /** Index into PALETTES: the fallback chat color for chatters who never set one. */
  paletteIndex: number
  walkSpeed: number
  /** 0..1, how deep into the strip the avatar stands (drives y + z-order). */
  depth: number
}

/**
 * DNA v2: the default look for a login. Same login, same look, every stream.
 *
 * CONTRACT: the hash and the order of PRNG draws below are frozen; every
 * draw happens on every path so later fields never shift. Order: kind roll,
 * animal, build, skin, hairStyle, hairColor, palette, accessory presence,
 * accessory, walkSpeed, depth. The golden test in look.test.ts locks it.
 */
export function lookDna(login: string, walkSpeedRange: [number, number]): LookDna {
  const rng = mulberry32(fnv1a32(login.toLowerCase()))
  const kindRoll = rng()
  const animal = ANIMALS[pickIndex(rng, ANIMALS.length)] ?? 'cat'
  const build = BUILDS[pickIndex(rng, BUILDS.length)] ?? 'average'
  const skin = pickIndex(rng, SKIN_TONES.length)
  const hairStyle = HAIR_STYLES[pickIndex(rng, HAIR_STYLES.length)] ?? 'short'
  const hairColor = pickIndex(rng, HAIR_COLORS.length)
  const paletteIndex = pickIndex(rng, PALETTES.length)
  const hasAccessory = rng() >= 0.25
  const accessory = ACCESSORIES[pickIndex(rng, ACCESSORIES.length)] ?? 'cap'
  const walkSpeed = range(rng, walkSpeedRange[0], walkSpeedRange[1])
  const depth = rng()
  return {
    look: {
      kind: kindRoll < HUMAN_SHARE ? 'human' : animal,
      build,
      skin,
      hairStyle,
      hairColor,
      accessory: hasAccessory ? accessory : null,
    },
    paletteIndex,
    walkSpeed,
    depth,
  }
}

/** What a viewer picked in chat (phase 2 stores these). */
export interface Choice {
  kind?: Kind
  build?: Build
}

/** The username look with the viewer's choices applied on top. */
export function resolveLook(base: Look, choice?: Choice | null): Look {
  if (!choice) return base
  return {
    ...base,
    ...(choice.kind ? { kind: choice.kind } : {}),
    ...(choice.build ? { build: choice.build } : {}),
  }
}
