import { Assets, Rectangle, Texture } from 'pixi.js'
import {
  ACCESSORY_COUNT,
  ANIM_NAMES,
  ANIMATIONS,
  BODY_COUNT,
  FRAME_SIZE,
  SHEET_HEIGHT,
  SHEET_WIDTH,
  findSheet,
  isSheetSize,
  type AnimationSpec,
  type AnimName,
  type SheetKind,
} from './contract'
import { paintAccessorySheet, paintBodySheet } from './placeholder'

/** Sheets dropped into src/assets/sprites/, resolved at build time (path -> built URL). */
const BUILT_SHEETS = import.meta.glob<string>('../../assets/sprites/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
})

export type AnimationSet = Record<AnimName, Texture[]>

export interface SpriteCatalog {
  bodies: AnimationSet[]
  accessories: AnimationSet[]
}

/**
 * Loads every body and accessory sheet up front (7 small sheets) so avatar
 * creation is synchronous afterwards. Real PNGs in src/assets/sprites/ take
 * priority; missing files fall back to runtime-painted placeholders that
 * follow the identical grid contract.
 */
export async function loadSpriteCatalog(): Promise<SpriteCatalog> {
  const [bodies, accessories] = await Promise.all([
    loadSheets('body', BODY_COUNT, paintBodySheet),
    loadSheets('accessory', ACCESSORY_COUNT, paintAccessorySheet),
  ])
  return { bodies, accessories }
}

function loadSheets(
  kind: SheetKind,
  count: number,
  paintFallback: (index: number) => HTMLCanvasElement,
): Promise<AnimationSet[]> {
  return Promise.all(
    Array.from({ length: count }, async (_, i) => {
      const url = findSheet(BUILT_SHEETS, kind, i)
      const sheet = (url && (await loadPng(url))) || Texture.from(paintFallback(i))
      return sliceSheet(sheet)
    }),
  )
}

/** A sheet that exists but fails to decode, or has the wrong size, falls back instead of breaking. */
async function loadPng(url: string): Promise<Texture | null> {
  try {
    const texture = await Assets.load<Texture>(url)
    if (isSheetSize(texture.width, texture.height)) return texture
    console.warn(
      `[chat-avatars] sprite sheet is ${texture.width}x${texture.height}, expected ${SHEET_WIDTH}x${SHEET_HEIGHT}; using placeholder`,
      url,
    )
    return null
  } catch (err) {
    console.warn('[chat-avatars] sprite sheet failed to load, using placeholder', url, err)
    return null
  }
}

function sliceSheet(base: Texture): AnimationSet {
  const slice = (spec: AnimationSpec): Texture[] =>
    Array.from(
      { length: spec.frames },
      (_, col) =>
        new Texture({
          source: base.source,
          frame: new Rectangle(
            col * FRAME_SIZE,
            spec.row * FRAME_SIZE,
            FRAME_SIZE,
            FRAME_SIZE,
          ),
        }),
    )
  return Object.fromEntries(
    ANIM_NAMES.map((name) => [name, slice(ANIMATIONS[name])]),
  ) as AnimationSet
}
