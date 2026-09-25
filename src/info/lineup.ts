import { ANIMALS, HAIR_STYLES, type Look } from '../render/sprites/roster'

export interface LineupEntry {
  /** The sign under the character: exactly the word to type after !avatar. */
  name: string
  look: Look
}

/** Animals ignore the human-only fields; these are just valid placeholders. */
const ANIMAL_BASE: Omit<Look, 'kind'> = {
  build: 'average',
  skin: 0,
  hairStyle: 'short',
  hairColor: 0,
  accessory: null,
}

/**
 * The character-select lineup (mockup B): one human per build in varied
 * skin and hair, then every animal. The strip dresses them in the brand
 * color: shirts for humans, collars for animals.
 */
export const LINEUP: readonly LineupEntry[] = [
  { name: 'skinny', look: { kind: 'human', build: 'skinny', skin: 0, hairStyle: 'short', hairColor: 1, accessory: null } },
  { name: 'average', look: { kind: 'human', build: 'average', skin: 3, hairStyle: 'bun', hairColor: 0, accessory: null } },
  { name: 'chubby', look: { kind: 'human', build: 'chubby', skin: 5, hairStyle: 'short', hairColor: 0, accessory: null } },
  ...ANIMALS.map((kind): LineupEntry => ({ name: kind, look: { ...ANIMAL_BASE, kind } })),
]

/**
 * One head per hairstyle word, shown above the lineup. Same skin and brown
 * hair on each, and no accessory (a cap would tuck spiky or bun hair away),
 * so only the hairstyle changes from head to head.
 */
export const HAIRSTYLE_PREVIEWS: readonly LineupEntry[] = HAIR_STYLES.map((hairStyle) => ({
  name: hairStyle,
  look: { kind: 'human', build: 'average', skin: 2, hairStyle, hairColor: 1, accessory: null },
}))
