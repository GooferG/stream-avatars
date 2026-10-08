/**
 * Chrome on Windows antialiases canvas text along x only, so even a pixel
 * font at its native size gets a soft 1px fringe on every vertical stroke,
 * and Pixi bakes the bitmap font atlas with that same fillText. This rounds
 * every pixel of the baked glyphs (RGBA bytes) to fully on or off, and paints
 * them pure white so a tint colors them exactly.
 */
export function hardenGlyphs(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255
    data[i + 1] = 255
    data[i + 2] = 255
    data[i + 3] = (data[i + 3] ?? 0) >= 128 ? 255 : 0
  }
}
