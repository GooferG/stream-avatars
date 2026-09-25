/**
 * The character roster: which kinds exist, what a look is made of, and
 * which layer sheets (with which color role) assemble each look. Pure data
 * and one function; every sheet name here is also a PNG drop-in name.
 */
export const ANIMALS = ['cat', 'dog', 'duck', 'frog', 'bunny', 'bear', 'fox'] as const
export type Animal = (typeof ANIMALS)[number]
export type Kind = 'human' | Animal
export const KINDS: readonly Kind[] = ['human', ...ANIMALS]

export const BUILDS = ['skinny', 'average', 'chubby'] as const
export type Build = (typeof BUILDS)[number]

export const HAIR_STYLES = ['short', 'long', 'bun', 'spiky'] as const
export type HairStyle = (typeof HAIR_STYLES)[number]
/** Hairstyles that also have a layer behind the head. */
export const BACK_HAIR: readonly HairStyle[] = ['long']
/** Hairstyles that stick up above the head, tucked in as short hair under a cap. */
const TALL_HAIR: readonly HairStyle[] = ['bun', 'spiky']

export const ACCESSORIES = ['cap', 'bow', 'glasses'] as const
export type AccessoryName = (typeof ACCESSORIES)[number]

/** Human skin tones, light to deep. */
export const SKIN_TONES: readonly number[] = [0xf6d2b4, 0xe2a882, 0xb9784f, 0x7d4a2c]
/** Hair colors: black, brown, blond, red. */
export const HAIR_COLORS: readonly number[] = [0x2a1a12, 0x7a4520, 0xe0b04a, 0xa8322c]

/** What colors a layer: see roleTints. `fixed` layers are painted in final colors. */
export type ColorRole = 'chat' | 'skin' | 'hair' | 'accent' | 'fixed'

export type HumanLayer = 'pants' | 'shirt' | 'skin'

export type SheetId =
  | `human-${Build}-${HumanLayer}`
  | 'human-face'
  | `hair-${HairStyle}`
  | `hair-${HairStyle}-back`
  | `accessory-${AccessoryName}`
  | Animal
  | 'collar'

const HUMAN_LAYERS: readonly HumanLayer[] = ['pants', 'shirt', 'skin']

export const ALL_SHEETS: readonly SheetId[] = [
  ...BUILDS.flatMap((b) => HUMAN_LAYERS.map((l): SheetId => `human-${b}-${l}`)),
  'human-face',
  ...HAIR_STYLES.map((s): SheetId => `hair-${s}`),
  ...BACK_HAIR.map((s): SheetId => `hair-${s}-back`),
  ...ACCESSORIES.map((a): SheetId => `accessory-${a}`),
  ...ANIMALS,
  'collar',
]

export interface Look {
  kind: Kind
  /** The fields below only apply to humans. */
  build: Build
  /** Index into SKIN_TONES. */
  skin: number
  hairStyle: HairStyle
  /** Index into HAIR_COLORS. */
  hairColor: number
  accessory: AccessoryName | null
}

export interface LayerRef {
  sheet: SheetId
  role: ColorRole
}

/** The layer stack for a look, back to front. The single place characters are assembled. */
export function layersFor(look: Look): LayerRef[] {
  if (look.kind !== 'human') {
    return [
      { sheet: look.kind, role: 'fixed' },
      { sheet: 'collar', role: 'chat' },
    ]
  }
  const { build, accessory } = look
  const hairStyle = accessory === 'cap' && TALL_HAIR.includes(look.hairStyle) ? 'short' : look.hairStyle
  const layers: LayerRef[] = []
  if (BACK_HAIR.includes(hairStyle)) layers.push({ sheet: `hair-${hairStyle}-back`, role: 'hair' })
  layers.push(
    { sheet: `human-${build}-pants`, role: 'fixed' },
    { sheet: `human-${build}-shirt`, role: 'chat' },
    { sheet: `human-${build}-skin`, role: 'skin' },
    { sheet: 'human-face', role: 'fixed' },
    { sheet: `hair-${hairStyle}`, role: 'hair' },
  )
  if (accessory) layers.push({ sheet: `accessory-${accessory}`, role: 'accent' })
  return layers
}
