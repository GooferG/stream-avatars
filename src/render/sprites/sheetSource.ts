import { findSheet, isSheetSize, SHEET_HEIGHT, SHEET_WIDTH } from './contract'
import { paintSheet } from './paint'
import type { SheetId } from './roster'

export type SheetImage = HTMLCanvasElement | HTMLImageElement

/** Sheets dropped into src/assets/sprites/, resolved at build time (path -> built URL). */
const BUILT_SHEETS = import.meta.glob<string>('../../assets/sprites/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
})

/**
 * The image for a layer sheet: a dropped-in PNG when one exists and has
 * the right size, otherwise the code-painted sheet. Shared by the overlay,
 * the preview page and the avatar-info strip, so they never drift apart.
 */
export async function sheetSource(id: SheetId): Promise<SheetImage> {
  const url = findSheet(BUILT_SHEETS, id)
  if (url) {
    const image = await loadImage(url)
    if (image && isSheetSize(image.naturalWidth, image.naturalHeight)) return image
    const problem = image
      ? `is ${image.naturalWidth}x${image.naturalHeight}, expected ${SHEET_WIDTH}x${SHEET_HEIGHT}`
      : 'failed to load'
    console.warn(`[chat-avatars] sprite sheet ${id}.png ${problem}; using the built-in art`)
  }
  return paintSheet(id)
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = url
  })
}
