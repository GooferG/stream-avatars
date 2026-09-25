import type { SheetImage } from './sheetSource'

/**
 * A copy of a sheet multiplied by `tint`, like Pixi's sprite tint: white
 * takes the tint, black stays black, transparency is kept. Used by the
 * canvas pages (preview, avatar-info strip); 0xffffff returns the sheet.
 */
export function tintedSheet(sheet: SheetImage, tint: number): SheetImage {
  if (tint === 0xffffff) return sheet
  const out = document.createElement('canvas')
  out.width = sheet.width
  out.height = sheet.height
  const ctx = out.getContext('2d')
  if (!ctx) throw new Error('2d canvas context unavailable')
  ctx.drawImage(sheet, 0, 0)
  ctx.globalCompositeOperation = 'multiply'
  ctx.fillStyle = `#${tint.toString(16).padStart(6, '0')}`
  ctx.fillRect(0, 0, out.width, out.height)
  ctx.globalCompositeOperation = 'destination-in'
  ctx.drawImage(sheet, 0, 0)
  return out
}
