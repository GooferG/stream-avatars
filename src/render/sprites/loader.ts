import { Rectangle, Texture } from 'pixi.js'
import { ANIM_NAMES, ANIMATIONS, FRAME_SIZE, type AnimationSpec, type AnimName } from './contract'
import { ALL_SHEETS, type SheetId } from './roster'
import { sheetSource } from './sheetSource'

export type AnimationSet = Record<AnimName, Texture[]>
export type SpriteCatalog = ReadonlyMap<SheetId, AnimationSet>

/**
 * Loads every layer sheet up front (a few dozen small sheets) so avatar
 * creation is synchronous afterwards. Textures are shared by every
 * avatar that uses a sheet.
 */
export async function loadSpriteCatalog(): Promise<SpriteCatalog> {
  const entries = await Promise.all(
    ALL_SHEETS.map(async (id) => [id, sliceSheet(Texture.from(await sheetSource(id)))] as const),
  )
  return new Map(entries)
}

function sliceSheet(base: Texture): AnimationSet {
  const slice = (spec: AnimationSpec): Texture[] =>
    Array.from(
      { length: spec.frames },
      (_, col) =>
        new Texture({
          source: base.source,
          frame: new Rectangle(col * FRAME_SIZE, spec.row * FRAME_SIZE, FRAME_SIZE, FRAME_SIZE),
        }),
    )
  return Object.fromEntries(
    ANIM_NAMES.map((name) => [name, slice(ANIMATIONS[name])]),
  ) as AnimationSet
}
