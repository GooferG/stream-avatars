import { Container, Graphics, Sprite } from 'pixi.js'
import { GifSprite } from 'pixi.js/gif'
import type { EmoteSpan } from '../chat/types'
import { toRenderable } from '../utils/text'
import { bubbleOffsets } from './placement'
import { isJumbo, tokenize, type Token } from './bubbleTokens'
import { EMOTE_HEIGHT, JUMBO_EMOTE_HEIGHT, emoteDisplayWidth } from './emoteImages'
import type { EmoteCache, EmoteImage } from './emotes'
import { PIXEL_CHAR_WIDTH, PIXEL_FONT_SIZE, pixelText } from './font'
import { BUBBLE_LINE_CHARS, breakLines } from './wrap'

const LINE_HEIGHT = EMOTE_HEIGHT
// Gap between items equals one monospace space, so merging two text items
// with a literal ' ' keeps pixel widths exactly consistent with wrapping.
const GAP = PIXEL_CHAR_WIDTH
const MAX_LINE_WIDTH = BUBBLE_LINE_CHARS * PIXEL_CHAR_WIDTH
const PADDING = 8
const TEXT_TINT = 0x111111
const INK = 0x000000
const PAPER = 0xf5f0e6
const TAIL_HEIGHT = 6

interface LineItem {
  kind: 'text' | 'emote'
  text: string
  image: EmoteImage | null
  /** Zero-width emotes drawn on top of this one. */
  overlays: EmoteImage[]
  width: number
}

interface Line {
  items: LineItem[]
  width: number
}

export interface BubbleOptions {
  maxChars: number
  /** Lines shown; any more are cut (see wrap.ts). */
  maxLines: number
  emoteCache: EmoteCache
}

/**
 * A pixel speech bubble, built once per message. Its origin is the tail tip:
 * placeAt() puts the tip at the speaker's head and slides the box inward
 * near the stage edges, with the tail still pointing at the head.
 */
export class SpeechBubble {
  readonly view = new Container()
  private box = new Container()
  private tail: Graphics
  private halfWidth: number
  private animations: GifSprite[]

  constructor(content: Container, contentWidth: number, contentHeight: number, animations: GifSprite[] = []) {
    this.animations = animations
    const w = contentWidth + PADDING * 2
    const h = contentHeight + PADDING * 2
    // drop shadow, border, fill: all hard-edged rects for the pixel look
    const bg = new Graphics()
      .rect(3, 3, w, h)
      .fill({ color: INK, alpha: 0.35 })
      .rect(0, 0, w, h)
      .fill(INK)
      .rect(2, 2, w - 4, h - 4)
      .fill(PAPER)
    content.position.set(PADDING, PADDING)
    this.box.addChild(bg, content)
    this.box.pivot.set(w / 2, h + TAIL_HEIGHT)

    // stepped tail with its tip at the origin; the paper patch opens the
    // box's bottom border wherever the tail currently joins it
    this.tail = new Graphics()
      .rect(-6, -TAIL_HEIGHT, 12, 3)
      .fill(INK)
      .rect(-3, -3, 6, 3)
      .fill(INK)
      .rect(-4, -TAIL_HEIGHT - 2, 8, 3)
      .fill(PAPER)

    this.view.addChild(this.box, this.tail)
    this.halfWidth = w / 2
  }

  placeAt(headX: number, headY: number, stageWidth: number): void {
    const { boxX, tailX } = bubbleOffsets(headX, this.halfWidth, stageWidth)
    this.view.position.set(headX, headY)
    this.box.x = boxX
    this.tail.x = tailX
  }

  /**
   * Emote images belong to the shared cache: never pass texture flags. GIF
   * sprites go first, keeping their frames; destroyed through the view's
   * options they would take the frames every other bubble shares with them.
   */
  destroy(): void {
    for (const gif of this.animations) gif.destroy(false)
    this.view.destroy({ children: true })
  }
}

/**
 * Lays out a message (text, Twitch and 7TV emotes) into a SpeechBubble; null
 * when nothing is renderable. A message of only a few emotes is drawn with
 * jumbo emotes on taller lines.
 */
export async function buildBubble(
  text: string,
  emotes: EmoteSpan[],
  options: BubbleOptions,
): Promise<SpeechBubble | null> {
  const tokens = tokenize(text, emotes, options.maxChars)
  if (tokens.length === 0) return null

  const jumbo = isJumbo(tokens)
  const lineHeight = jumbo ? JUMBO_EMOTE_HEIGHT : LINE_HEIGHT
  const images = new Map<string, EmoteImage | null>()
  const spans = tokens.flatMap((t) => (t.kind === 'emote' ? [t.emote, ...t.overlays] : []))
  await Promise.all(
    spans.map(async (span) => {
      images.set(emoteKey(span), await options.emoteCache.get(span, jumbo ? 2 : 1))
    }),
  )

  const lines = layout(tokens, images, options.maxLines, lineHeight)
  if (lines.length === 0) return null

  const contentWidth = Math.max(...lines.map((l) => l.width))
  const contentHeight = lines.length * lineHeight
  const content = new Container()
  const animations: GifSprite[] = []

  lines.forEach((line, row) => {
    let x = (contentWidth - line.width) / 2 // center each line
    const y = row * lineHeight
    line.items.forEach((item, i) => {
      if (i > 0) x += GAP
      if (item.kind === 'text') {
        const t = pixelText(item.text, TEXT_TINT)
        t.position.set(x, y + (lineHeight - PIXEL_FONT_SIZE) / 2)
        content.addChild(t)
      } else if (item.image) {
        content.addChild(emoteSprite(item.image, x, y, lineHeight, animations))
        // zero-width emotes are centred over the one they ride on
        for (const overlay of item.overlays) {
          const width = emoteDisplayWidth(overlay.width, overlay.height, lineHeight)
          content.addChild(emoteSprite(overlay, x + (item.width - width) / 2, y, lineHeight, animations))
        }
      }
      x += item.width
    })
  })

  return new SpeechBubble(content, contentWidth, contentHeight, animations)
}

const emoteKey = (span: EmoteSpan) => `${span.provider}:${span.id}`

/** An emote `height` tall at its own shape; GIFs play and loop. */
function emoteSprite(image: EmoteImage, x: number, y: number, height: number, animations: GifSprite[]): Sprite {
  let sprite: Sprite
  if (image.kind === 'animated') {
    const gif = new GifSprite({ source: image.source, autoPlay: true, loop: true })
    animations.push(gif)
    sprite = gif
  } else {
    sprite = new Sprite(image.texture)
  }
  sprite.width = emoteDisplayWidth(image.width, image.height, height)
  sprite.height = height
  sprite.position.set(x, y)
  return sprite
}

function layout(
  tokens: Token[],
  images: Map<string, EmoteImage | null>,
  maxLines: number,
  emoteHeight: number,
): Line[] {
  const maxWordChars = BUBBLE_LINE_CHARS
  const items: LineItem[] = []

  const pushText = (text: string) => {
    items.push({ kind: 'text', text, image: null, overlays: [], width: text.length * PIXEL_CHAR_WIDTH })
  }
  for (const token of tokens) {
    if (token.kind === 'word') {
      // hard-break words longer than a full line
      let word = token.text
      while (word.length > maxWordChars) {
        pushText(word.slice(0, maxWordChars))
        word = word.slice(maxWordChars)
      }
      if (word.length > 0) pushText(word)
    } else {
      const image = images.get(emoteKey(token.emote)) ?? null
      if (image) {
        const overlays = token.overlays
          .map((o) => images.get(emoteKey(o)) ?? null)
          .filter((o): o is EmoteImage => o !== null)
        items.push({
          kind: 'emote',
          text: '',
          image,
          overlays,
          width: emoteDisplayWidth(image.width, image.height, emoteHeight),
        })
      } else {
        // overlays need an emote to ride on, so they go with it
        const fallback = toRenderable(token.fallback)
        if (fallback.length > 0) pushText(fallback)
      }
    }
  }

  const lines: Line[] = breakLines(items, MAX_LINE_WIDTH, GAP, maxLines).map((lineItems) => ({
    items: lineItems,
    width: lineItems.reduce((sum, item, i) => sum + (i > 0 ? GAP : 0) + item.width, 0),
  }))

  // merge adjacent text items so each line uses as few BitmapTexts as possible
  for (const line of lines) {
    const merged: LineItem[] = []
    for (const item of line.items) {
      const last = merged[merged.length - 1]
      if (item.kind === 'text' && last?.kind === 'text') {
        last.text = `${last.text} ${item.text}`
        last.width += GAP + item.width
      } else {
        merged.push(item)
      }
    }
    line.items = merged
  }
  return lines
}
