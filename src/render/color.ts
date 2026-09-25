import { PALETTES } from './sprites/contract'
import { COLORS, furColor, HAIR_COLORS, NATURAL_FUR, SKIN_TONES, type ColorRole, type Look } from './sprites/roster'

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

/** The palette's accent colors, each once: the pool accessories pick from. */
export const ACCENT_COLORS: number[] = [...new Set(PALETTES.map((p) => p.accent))]

/** Perceptual-ish RGB distance ("redmean"): cheap, and weights green the way eyes do. */
export function colorDistance(a: number, b: number): number {
  const [r1, g1, b1] = channels(a)
  const [r2, g2, b2] = channels(b)
  const redMean = (r1 + r2) / 2
  const dr = r1 - r2
  const dg = g1 - g2
  const db = b1 - b2
  return Math.sqrt(
    (2 + redMean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - redMean) / 256) * db * db,
  )
}

/** The accent that stands out most against the body, so accessories always pop. */
export function contrastingAccent(body: number): number {
  let best = ACCENT_COLORS[0] ?? 0xffffff
  for (const accent of ACCENT_COLORS) {
    if (colorDistance(body, accent) > colorDistance(body, best)) best = accent
  }
  return best
}

/**
 * A character's tints: the body wears the chatter's Twitch color (the
 * username's palette color when they never set one), lifted exactly like
 * their name tag so the two always match; the accessory takes the
 * contrasting accent.
 */
export function characterColors(
  chatColor: string | null,
  fallbackBody: number,
): { body: number; accent: number } {
  const body = readableOnDark(parseNameColor(chatColor, fallbackBody))
  return { body, accent: contrastingAccent(body) }
}

function channels(color: number): [number, number, number] {
  return [(color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff]
}

/** The tint for each layer role of a look; fixed layers are painted in final colors. */
export function roleTints(
  look: Look,
  colors: { body: number; accent: number },
): Record<ColorRole, number> {
  const { color } = look
  return {
    chat: colors.body,
    accent: colors.accent,
    skin: SKIN_TONES[look.skin] ?? SKIN_TONES[0] ?? 0xffffff,
    hair: color ? COLORS[color] : (HAIR_COLORS[look.hairColor] ?? HAIR_COLORS[0] ?? 0xffffff),
    fur: color ? furColor(color) : look.kind === 'human' ? 0xffffff : NATURAL_FUR[look.kind],
    fixed: 0xffffff,
  }
}
