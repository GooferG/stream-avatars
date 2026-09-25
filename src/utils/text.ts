/**
 * Twitch emote ranges index Unicode code points, not UTF-16 units. All
 * slicing and truncation in this app must go through these helpers so a
 * message like "🎉 Kappa" keeps its emote spans aligned.
 */
export function toCodePoints(text: string): string[] {
  return Array.from(text)
}

/** Truncate in code-point space, appending an ellipsis when cut. */
export function truncateCodePoints(cps: string[], max: number): string[] {
  if (cps.length <= max) return cps
  return [...cps.slice(0, max), '…']
}

/**
 * Strip control characters and collapse whitespace runs. Run this on text
 * segments AFTER emote spans are sliced out; removing characters earlier
 * would shift the span indices.
 */
export function sanitizeSegment(text: string): string {
  let out = ''
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0
    if (code < 0x20 || code === 0x7f) continue
    out += ch
  }
  return out.replace(/\s+/g, ' ')
}

/** True when every character is printable ASCII (renderable by the pixel font). */
export function isPrintableAscii(text: string): boolean {
  return /^[\x20-\x7e]+$/.test(text)
}

/** Drop characters the bitmap pixel font cannot render (it is Latin-only). */
export function toRenderable(text: string): string {
  return text.replace(/[^\x20-\x7e]/g, '')
}
