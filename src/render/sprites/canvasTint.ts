import type { SheetImage } from './sheetSource'

/**
 * Multiplies RGBA pixels by `tint` in place, the way Pixi's sprite tint
 * does: white takes the tint, black stays black, alpha is untouched. Per
 * pixel, so half-transparent edges get shaded instead of filled with tint.
 */
export function multiplyTint(pixels: Uint8ClampedArray, tint: number): void {
  const tr = (tint >> 16) & 0xff
  const tg = (tint >> 8) & 0xff
  const tb = tint & 0xff
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = ((pixels[i] ?? 0) * tr) / 255
    pixels[i + 1] = ((pixels[i + 1] ?? 0) * tg) / 255
    pixels[i + 2] = ((pixels[i + 2] ?? 0) * tb) / 255
  }
}

/**
 * A copy of a sheet multiplied by `tint`, like Pixi's sprite tint. Used by
 * the canvas pages (preview, avatar-info strip); 0xffffff returns the sheet.
 */
export function tintedSheet(sheet: SheetImage, tint: number): SheetImage {
  if (tint === 0xffffff) return sheet
  const out = document.createElement('canvas')
  out.width = sheet.width
  out.height = sheet.height
  const ctx = out.getContext('2d')
  if (!ctx) throw new Error('2d canvas context unavailable')
  ctx.drawImage(sheet, 0, 0)
  const image = ctx.getImageData(0, 0, out.width, out.height)
  multiplyTint(image.data, tint)
  ctx.putImageData(image, 0, 0)
  return out
}
