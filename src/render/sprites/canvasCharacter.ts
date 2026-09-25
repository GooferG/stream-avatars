import { characterColors, roleTints } from '../color'
import { tintedSheet } from './canvasTint'
import { ANIMATIONS, FRAME_SIZE, frameAt, type AnimName } from './contract'
import { layersFor, type Look } from './roster'
import { sheetSource, type SheetImage } from './sheetSource'

/**
 * A whole character on a plain canvas, for the pages that don't run Pixi
 * (the sheet preview and the !avatarinfo strip). Same layer stack and role
 * tints as the overlay, so the three views never drift apart.
 */
export async function characterSheets(
  look: Look,
  chatColor: string | null,
  fallbackBody = 0xffffff,
): Promise<SheetImage[]> {
  const tints = roleTints(look, characterColors(chatColor, fallbackBody))
  return Promise.all(
    layersFor(look).map(async (ref) => tintedSheet(await sheetSource(ref.sheet), tints[ref.role])),
  )
}

/** Draws the frame of `anim` that shows `ms` into the animation, every layer back to front. */
export function drawCharacterFrame(
  ctx: CanvasRenderingContext2D,
  layers: readonly SheetImage[],
  anim: AnimName,
  ms: number,
): void {
  const col = frameAt(anim, ms)
  const row = ANIMATIONS[anim].row
  ctx.clearRect(0, 0, FRAME_SIZE, FRAME_SIZE)
  for (const layer of layers) {
    ctx.drawImage(layer, col * FRAME_SIZE, row * FRAME_SIZE, FRAME_SIZE, FRAME_SIZE, 0, 0, FRAME_SIZE, FRAME_SIZE)
  }
}
