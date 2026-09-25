/**
 * Sprite sheet contract. Real art dropped into src/assets/sprites/ must follow
 * this exact layout; the loader treats runtime placeholders and PNG files
 * identically. Documented for artists in the README.
 *
 * - One PNG per body type (body-0.png ...) and per accessory (accessory-0.png ...)
 * - Grayscale + black outline: white and grays take the per-avatar tint,
 *   black stays black. This is how one sheet serves every palette.
 * - 32x32 frames on a 6x4 grid (192x128 px), one animation per row.
 * - Characters face RIGHT; walking left is a horizontal flip.
 * - Accessory sheets share the same grid and align to the body origin.
 */
export const FRAME_SIZE = 32
export const SHEET_COLS = 6
export const SHEET_ROWS = 4
export const SHEET_WIDTH = FRAME_SIZE * SHEET_COLS
export const SHEET_HEIGHT = FRAME_SIZE * SHEET_ROWS

export interface AnimationSpec {
  row: number
  frames: number
  fps: number
}

export const ANIMATIONS = {
  idle: { row: 0, frames: 4, fps: 4 },
  walk: { row: 1, frames: 6, fps: 10 },
  jump: { row: 2, frames: 6, fps: 10 },
  talk: { row: 3, frames: 4, fps: 6 },
} as const satisfies Record<string, AnimationSpec>

export const BODY_COUNT = 3
export const ACCESSORY_COUNT = 4

export type SheetKind = 'body' | 'accessory'

/** File name an artist gives a sheet in src/assets/sprites/. */
export function sheetFile(kind: SheetKind, index: number): string {
  return `${kind}-${index}.png`
}

/**
 * Looks a sheet up in the build-time list of dropped-in PNGs (source path
 * -> built URL, as import.meta.glob returns it). Missing sheets resolve to
 * null without any request: OBS local files take seconds to report a
 * missing file, which used to delay the chat connection at startup.
 */
export function findSheet(
  built: Record<string, string>,
  kind: SheetKind,
  index: number,
): string | null {
  const suffix = `/${sheetFile(kind, index)}`
  for (const [path, url] of Object.entries(built)) {
    if (path.endsWith(suffix)) return url
  }
  return null
}

/** Palette pairs applied as tints: body color + accessory/accent color. */
export const PALETTES: { body: number; accent: number }[] = [
  { body: 0x7bd47b, accent: 0xe8554d }, // green / red
  { body: 0x6fa8dc, accent: 0xf5c542 }, // blue / gold
  { body: 0xe8a2c8, accent: 0x7bd4c8 }, // pink / teal
  { body: 0xf5c542, accent: 0x8e6fdc }, // gold / purple
  { body: 0xe8554d, accent: 0xf0e6d2 }, // red / cream
  { body: 0x8e6fdc, accent: 0x7bd47b }, // purple / green
  { body: 0x7bd4c8, accent: 0xe8a2c8 }, // teal / pink
  { body: 0xf0925a, accent: 0x6fa8dc }, // orange / blue
  { body: 0xc8d47b, accent: 0xe8554d }, // lime / red
  { body: 0x9aa7b8, accent: 0xf5c542 }, // steel / gold
  { body: 0xd4b48c, accent: 0x5a8a5a }, // sand / forest
  { body: 0x6fd4f0, accent: 0xf0925a }, // sky / orange
]
