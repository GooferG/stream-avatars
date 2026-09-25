import { BitmapFont, BitmapText } from 'pixi.js'
import '@fontsource/press-start-2p/index.css'

export const PIXEL_FONT = 'pixel'
/**
 * Press Start 2P sits on an 8px grid, so 16px is a crisp 2x. The atlas is
 * baked at the size text is drawn at: any other size would resample glyphs.
 */
export const PIXEL_FONT_SIZE = 16
/** Monospaced: glyph advance equals the font size. */
export const PIXEL_CHAR_WIDTH = PIXEL_FONT_SIZE

/**
 * Waits for the bundled Press Start 2P webfont, then bakes it into a bitmap
 * font atlas. Labels and bubbles use BitmapText exclusively; nothing
 * rasterizes text at render time.
 */
let installed = false

export async function loadPixelFont(): Promise<void> {
  await document.fonts.load(`${PIXEL_FONT_SIZE}px "Press Start 2P"`)
  if (installed) return // StrictMode double-boot would install twice
  installed = true
  BitmapFont.install({
    name: PIXEL_FONT,
    style: {
      fontFamily: '"Press Start 2P"',
      fontSize: PIXEL_FONT_SIZE,
      fill: 0xffffff,
    },
    // installed before the stage sets nearest as the global default
    textureStyle: { scaleMode: 'nearest' },
    // Monospaced, so kerning is never needed. Measuring it is harmful: the
    // canvas reports "fi"/"fl" ligatures as one glyph, which became -16px
    // kerning that hid the i in "first".
    skipKerning: true,
  })
}

/** The one way to make on-stage text: pixel font, native size, tinted. */
export function pixelText(text: string, tint: number): BitmapText {
  const t = new BitmapText({
    text,
    style: { fontFamily: PIXEL_FONT, fontSize: PIXEL_FONT_SIZE },
  })
  t.tint = tint
  return t
}
