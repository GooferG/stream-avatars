import { BitmapFontManager, BitmapText } from 'pixi.js'
import './font.css'
import { hardenGlyphs } from './glyphEdges'

export const PIXEL_FONT = 'pixel'
/**
 * Departure Mono sits on an 11px grid, so 22px is a crisp 2x. The atlas is
 * baked at the size text is drawn at: any other size would resample glyphs.
 */
export const PIXEL_FONT_SIZE = 22
/** Monospaced: every glyph advances 14px at 22px (measured; 7px on its 11px grid). */
export const PIXEL_CHAR_WIDTH = 14
/** Printable ASCII: bubble text is Latin-only (see toRenderable), so the atlas never grows at runtime. */
const CHARS: [string, string][] = [[' ', '~']]

/**
 * Waits for the bundled Departure Mono webfont, then bakes it into a bitmap
 * font atlas with hard pixel edges. Labels and bubbles use BitmapText
 * exclusively; nothing rasterizes text at render time.
 */
let installed = false

export async function loadPixelFont(): Promise<void> {
  await document.fonts.load(`${PIXEL_FONT_SIZE}px "Departure Mono"`)
  if (installed) return // StrictMode double-boot would install twice
  installed = true
  const font = BitmapFontManager.install({
    name: PIXEL_FONT,
    style: {
      fontFamily: '"Departure Mono"',
      fontSize: PIXEL_FONT_SIZE,
      fill: 0xffffff,
    },
    chars: CHARS,
    // installed before the stage sets nearest as the global default
    textureStyle: { scaleMode: 'nearest' },
    // Monospaced, so kerning is never needed. Measuring it is harmful: the
    // canvas reports "fi"/"fl" ligatures as one glyph, which became negative
    // kerning that hid the i in "first".
    skipKerning: true,
  })
  for (const page of font.pages) hardenPage(page.texture.source.resource)
  for (const page of font.pages) page.texture.source.update()
}

/** Rounds a baked atlas page's glyph pixels to fully on or off (see hardenGlyphs). */
function hardenPage(resource: unknown): void {
  if (!(resource instanceof HTMLCanvasElement)) return
  const ctx = resource.getContext('2d')
  if (!ctx) return
  const img = ctx.getImageData(0, 0, resource.width, resource.height)
  hardenGlyphs(img.data)
  ctx.putImageData(img, 0, 0)
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
