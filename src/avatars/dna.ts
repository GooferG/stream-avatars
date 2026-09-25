import { mulberry32, pickIndex, range } from '../utils/rng'

/**
 * Deterministic avatar identity. Same login always produces the same DNA,
 * so regulars keep their look across streams.
 *
 * CONTRACT: the hash function AND the order of PRNG draws below are frozen.
 * Changing either rerolls every viewer's avatar. Draw order:
 *   1. bodyIndex  2. paletteIndex  3. accessory presence (25% none)
 *   4. accessoryIndex  5. walkSpeed  6. depth (position within the strip)
 * Golden-value tests in dna.test.ts lock this down.
 */
export interface AvatarDna {
  bodyIndex: number
  paletteIndex: number
  /** -1 means no accessory. */
  accessoryIndex: number
  /** px/sec, drawn from the configured walk speed range. */
  walkSpeed: number
  /** 0..1, how deep into the strip the avatar stands (drives y + z-order). */
  depth: number
  bodyTint: number
  accentTint: number
}

export interface Catalog {
  bodyCount: number
  accessoryCount: number
  palettes: { body: number; accent: number }[]
}

/** FNV-1a 32-bit over the raw UTF-16 units of the lowercase login. */
export function fnv1a32(text: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash >>> 0
}

export function generateDna(
  login: string,
  catalog: Catalog,
  walkSpeedRange: [number, number],
): AvatarDna {
  const rng = mulberry32(fnv1a32(login.toLowerCase()))

  const bodyIndex = pickIndex(rng, catalog.bodyCount)
  const paletteIndex = pickIndex(rng, catalog.palettes.length)
  const hasAccessory = rng() >= 0.25
  const accessoryDraw = pickIndex(rng, Math.max(1, catalog.accessoryCount))
  const accessoryIndex = hasAccessory && catalog.accessoryCount > 0 ? accessoryDraw : -1
  const walkSpeed = range(rng, walkSpeedRange[0], walkSpeedRange[1])
  const depth = rng()

  const palette = catalog.palettes[paletteIndex] ?? { body: 0xffffff, accent: 0xffffff }
  return {
    bodyIndex,
    paletteIndex,
    accessoryIndex,
    walkSpeed,
    depth,
    bodyTint: palette.body,
    accentTint: palette.accent,
  }
}
