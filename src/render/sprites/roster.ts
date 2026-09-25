/**
 * The character roster: which kinds exist, what a look is made of, and
 * which layer sheets (with which color role) assemble each look. Pure data
 * and one function; every sheet name here is also a PNG drop-in name.
 */
export const ANIMALS = ['cat', 'dog', 'duck', 'frog', 'bunny', 'bear', 'fox', 'penguin'] as const
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
/** Whether a cap would hide this hairstyle (it's drawn as short hair under one). */
export function hiddenUnderCap(style: HairStyle): boolean {
  return TALL_HAIR.includes(style)
}

export const ACCESSORIES = ['cap', 'bow', 'glasses'] as const
export type AccessoryName = (typeof ACCESSORIES)[number]

/** Human skin tones, light to deep; viewers pick one with `!skin 1-6`. */
export const SKIN_TONES: readonly number[] = [0xf6d2b4, 0xe2a882, 0xcd9068, 0xb9784f, 0x9b613d, 0x7d4a2c]

/**
 * The color words viewers type after !avatar, in the order the strip
 * shows them: hair when human, fur when animal.
 */
export const COLORS = {
  black: 0x2a1a12,
  brown: 0x7a4520,
  white: 0xf4f1ea,
  gray: 0x8a8f98,
  gold: 0xe0b04a,
  orange: 0xe8762c,
  red: 0xa8322c,
  pink: 0xf08cb4,
  purple: 0x8e5cc8,
  blue: 0x3d7fd6,
  green: 0x4fa84a,
} as const satisfies Record<string, number>
export type ColorName = keyof typeof COLORS
export const COLOR_NAMES = Object.keys(COLORS) as ColorName[]
/** Hair colors the username roll picks from: black, brown, blond, red. */
export const HAIR_COLORS: readonly number[] = [COLORS.black, COLORS.brown, COLORS.gold, COLORS.red]
/** Each animal's fur until its viewer picks a color. */
export const NATURAL_FUR: Record<Animal, number> = {
  cat: 0xf0a04b,
  dog: 0xa0703c,
  duck: 0xf5d547,
  frog: 0x6bbf59,
  bunny: 0xe8e2dc,
  bear: 0x8a5a3c,
  fox: 0xe8762c,
  penguin: 0x3a4150,
}

/** What colors a layer: see roleTints. `fixed` layers are painted in final colors. */
export type ColorRole = 'chat' | 'skin' | 'hair' | 'fur' | 'accent' | 'fixed'

export type HumanLayer = 'pants' | 'shirt' | 'skin'

export type SheetId =
  | `human-${Build}-${HumanLayer}`
  | 'human-face'
  | `hair-${HairStyle}`
  | `hair-${HairStyle}-back`
  | `accessory-${AccessoryName}`
  | Animal
  | `${Animal}-details`
  | 'collar'

const HUMAN_LAYERS: readonly HumanLayer[] = ['pants', 'shirt', 'skin']

export const ALL_SHEETS: readonly SheetId[] = [
  ...BUILDS.flatMap((b) => HUMAN_LAYERS.map((l): SheetId => `human-${b}-${l}`)),
  'human-face',
  ...HAIR_STYLES.map((s): SheetId => `hair-${s}`),
  ...BACK_HAIR.map((s): SheetId => `hair-${s}-back`),
  ...ACCESSORIES.map((a): SheetId => `accessory-${a}`),
  ...ANIMALS,
  ...ANIMALS.map((a): SheetId => `${a}-details`),
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
  /** A picked color word: hair when human, fur when animal. Null keeps the rolled hair and natural fur. */
  color: ColorName | null
}

export interface LayerRef {
  sheet: SheetId
  role: ColorRole
}

/** The layer stack for a look, back to front. The single place characters are assembled. */
export function layersFor(look: Look): LayerRef[] {
  if (look.kind !== 'human') {
    return [
      { sheet: look.kind, role: 'fur' },
      { sheet: `${look.kind}-details`, role: 'fixed' },
      { sheet: 'collar', role: 'chat' },
    ]
  }
  const { build, accessory } = look
  const hairStyle = accessory === 'cap' && hiddenUnderCap(look.hairStyle) ? 'short' : look.hairStyle
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
