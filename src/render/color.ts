/**
 * Name labels sit on a dark plate, so very dark Twitch colors (pure blue,
 * dark red) need lifting to stay legible on stream. Luma uses Rec. 709
 * weights on 0-255 channels; this is the floor labels are lifted to.
 */
export const MIN_LABEL_LUMA = 140

/** Twitch tag color '#RRGGBB' -> tint, with a DNA-derived fallback. */
export function parseNameColor(color: string | null, fallback: number): number {
  if (color && /^#[0-9a-fA-F]{6}$/.test(color)) {
    return Number.parseInt(color.slice(1), 16)
  }
  return fallback
}

export function luma(color: number): number {
  const [r, g, b] = channels(color)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Mixes a too-dark color toward white just enough to reach MIN_LABEL_LUMA, keeping its hue. */
export function readableOnDark(color: number): number {
  const y = luma(color)
  if (y >= MIN_LABEL_LUMA) return color
  // luma is linear in the mix amount, so the exact amount is solvable
  const t = (MIN_LABEL_LUMA - y) / (255 - y)
  const lift = (c: number) => Math.round(c + (255 - c) * t)
  const [r, g, b] = channels(color)
  return (lift(r) << 16) | (lift(g) << 8) | lift(b)
}

function channels(color: number): [number, number, number] {
  return [(color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff]
}
