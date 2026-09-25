import { Container, Graphics } from 'pixi.js'
import { readableOnDark } from './color'
import { PIXEL_FONT_SIZE, pixelText } from './font'

const PAD_X = 6
const PAD_Y = 3
/** Stepped corner cut, for a rounded pixel look. */
const CORNER = 2
const PLATE_COLOR = 0x0b0812
const PLATE_ALPHA = 0.72

export const NAME_LABEL_HEIGHT = PIXEL_FONT_SIZE + PAD_Y * 2

/**
 * Username on a dark pixel plate, tinted with the chatter's Twitch color
 * (lifted when too dark), so it reads on any scene behind the overlay.
 * Origin is the top centre.
 */
export function createNameLabel(name: string, tint: number): Container {
  const text = pixelText(name, readableOnDark(tint))
  text.position.set(PAD_X, PAD_Y)

  const w = text.width + PAD_X * 2
  const h = NAME_LABEL_HEIGHT
  // three non-overlapping rects, so the translucent fill never doubles up
  const plate = new Graphics()
    .rect(CORNER, 0, w - CORNER * 2, CORNER)
    .rect(0, CORNER, w, h - CORNER * 2)
    .rect(CORNER, h - CORNER, w - CORNER * 2, CORNER)
    .fill({ color: PLATE_COLOR, alpha: PLATE_ALPHA })

  const label = new Container()
  label.addChild(plate, text)
  label.pivot.x = Math.round(w / 2)
  return label
}
