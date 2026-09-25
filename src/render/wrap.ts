/**
 * Speech bubble line breaking, kept free of Pixi so the texts the overlay
 * writes itself (like the !avatar help) can be checked in tests.
 */

/** Characters per bubble line: the pixel font is monospace. */
export const BUBBLE_LINE_CHARS = 21
/** Lines a chat message's bubble shows; the rest is cut. */
export const CHAT_BUBBLE_LINES = 4
/** Lines for text the overlay writes itself, which must show in full. */
export const OVERLAY_BUBBLE_LINES = 6

/**
 * Greedy line breaking: each line takes items while they fit in `maxWidth`
 * with `gap` between them; an item wider than a line gets one to itself.
 * Stops after `maxLines` lines.
 */
export function breakLines<T extends { width: number }>(
  items: readonly T[],
  maxWidth: number,
  gap: number,
  maxLines: number,
): T[][] {
  const lines: T[][] = []
  let current: T[] = []
  let width = 0
  for (const item of items) {
    if (current.length > 0 && width + gap + item.width > maxWidth) {
      lines.push(current)
      if (lines.length === maxLines) return lines
      current = []
      width = 0
    }
    width += current.length > 0 ? gap + item.width : item.width
    current.push(item)
  }
  if (current.length > 0) lines.push(current)
  return lines
}
