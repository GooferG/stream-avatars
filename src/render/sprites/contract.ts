import type { SheetId } from './roster'

/**
 * Sprite sheet contract (v6). Every character is a stack of layer sheets
 * (see roster.ts); real art dropped into src/assets/sprites/<id>.png must
 * follow this exact layout, and the loader treats code-painted sheets and
 * PNG files identically. Documented for artists in the README.
 *
 * - 48x48 frames on a grid of 6 columns and 15 rows (288x720 px), one animation per row.
 * - Tinted layers are grayscale + black outline: white and grays take the
 *   layer's tint, black stays black. Fixed layers are painted in final colors.
 * - Characters face RIGHT; walking left is a horizontal flip.
 * - Every layer of a character is drawn from the same pose table, so the
 *   layers line up frame by frame.
 * - v6: eight more rows (7 to 14) for interactions and emotes. A v5 PNG
 *   (288x336) is rejected like any wrong-size sheet.
 * - v5: a seventh row, `sit`.
 * - v4: each animal is two sheets, `<animal>` (fur, tinted) and
 *   `<animal>-details` (fixed). A v3 animal PNG was one full-color sheet.
 */
export const FRAME_SIZE = 48
export const SHEET_COLS = 6
export const SHEET_ROWS = 15
export const SHEET_WIDTH = FRAME_SIZE * SHEET_COLS
export const SHEET_HEIGHT = FRAME_SIZE * SHEET_ROWS

/** A dropped-in PNG must match the grid exactly; anything else falls back to the built-in art. */
export function isSheetSize(width: number, height: number): boolean {
  return width === SHEET_WIDTH && height === SHEET_HEIGHT
}

export interface AnimationSpec {
  row: number
  frames: number
  fps: number
  /** Plays through once and holds its last frame (in the overlay; the preview pages loop every row). */
  once?: boolean
}

export const ANIMATIONS = {
  idle: { row: 0, frames: 4, fps: 4 },
  walk: { row: 1, frames: 6, fps: 10 },
  jump: { row: 2, frames: 6, fps: 10 },
  talk: { row: 3, frames: 4, fps: 6 },
  cheer: { row: 4, frames: 4, fps: 6 },
  sad: { row: 5, frames: 4, fps: 2 },
  sit: { row: 6, frames: 4, fps: 2 },
  highfive: { row: 7, frames: 4, fps: 6, once: true },
  hug: { row: 8, frames: 4, fps: 4 },
  clap: { row: 9, frames: 4, fps: 8 },
  wave: { row: 10, frames: 4, fps: 6 },
  dance: { row: 11, frames: 6, fps: 6 },
  dizzy: { row: 12, frames: 4, fps: 4 },
  smoke: { row: 13, frames: 6, fps: 1.5, once: true },
  bong: { row: 14, frames: 6, fps: 1.5, once: true },
} as const satisfies Record<string, AnimationSpec>

/** Every animation a sheet provides, one row each. The single source of animation names. */
export type AnimName = keyof typeof ANIMATIONS
export const ANIM_NAMES = Object.keys(ANIMATIONS) as AnimName[]

/** Whether a row plays once and holds its last frame instead of looping. */
export function playsOnce(anim: AnimName): boolean {
  const spec: AnimationSpec = ANIMATIONS[anim]
  return spec.once === true
}

/** The frame column an animation row shows `ms` after it started, looping. */
export function frameAt(anim: AnimName, ms: number): number {
  const spec = ANIMATIONS[anim]
  return Math.floor((Math.max(0, ms) / 1000) * spec.fps) % spec.frames
}

/** File name of a sheet in src/assets/sprites/. */
export function sheetFile(id: SheetId): string {
  return `${id}.png`
}

/**
 * Looks a sheet up in the build-time list of dropped-in PNGs (source path
 * -> built URL, as import.meta.glob returns it). Missing sheets resolve to
 * null without any request: OBS local files take seconds to report a
 * missing file, which used to delay the chat connection at startup.
 */
export function findSheet(built: Record<string, string>, id: SheetId): string | null {
  const suffix = `/${sheetFile(id)}`
  for (const [path, url] of Object.entries(built)) {
    if (path.endsWith(suffix)) return url
  }
  return null
}

/** Palette pairs: the fallback chat color (body) and the accent colors accessories pick from. */
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
