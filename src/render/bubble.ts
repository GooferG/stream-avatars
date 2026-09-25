import { Container, Graphics, Sprite, type Texture } from 'pixi.js'
import type { EmoteSpan } from '../chat/types'
import { sanitizeSegment, toCodePoints, toRenderable, truncateCodePoints } from '../utils/text'
import { bubbleOffsets } from './placement'
import type { EmoteCache } from './emotes'
import { PIXEL_CHAR_WIDTH, PIXEL_FONT_SIZE, pixelText } from './font'
import { BUBBLE_LINE_CHARS, breakLines } from './wrap'

const LINE_HEIGHT = 22
const EMOTE_SIZE = 22
// Gap between items equals one monospace space, so merging two text items
// with a literal ' ' keeps pixel widths exactly consistent with wrapping.
const GAP = PIXEL_CHAR_WIDTH
const MAX_LINE_WIDTH = BUBBLE_LINE_CHARS * PIXEL_CHAR_WIDTH
const PADDING = 8
const TEXT_TINT = 0x111111
const INK = 0x000000
const PAPER = 0xf5f0e6
const TAIL_HEIGHT = 6

type Token = { kind: 'word'; text: string } | { kind: 'emote'; id: string; fallback: string }

interface LineItem {
  kind: 'text' | 'emote'
  text: string
  texture: Texture | null
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

  constructor(content: Container, contentWidth: number, contentHeight: number) {
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

  /** Emote textures belong to the shared cache: never pass texture flags. */
  destroy(): void {
    this.view.destroy({ children: true })
  }
}

/** Lays out a message (text + Twitch emotes) into a SpeechBubble; null when nothing is renderable. */
export async function buildBubble(
  text: string,
  emotes: EmoteSpan[],
  options: BubbleOptions,
): Promise<SpeechBubble | null> {
  const tokens = tokenize(text, emotes, options.maxChars)
  if (tokens.length === 0) return null

  const textures = new Map<string, Texture | null>()
  await Promise.all(
    tokens
      .filter((t): t is Extract<Token, { kind: 'emote' }> => t.kind === 'emote')
      .map(async (t) => {
        textures.set(t.id, await options.emoteCache.get(t.id))
      }),
  )

  const lines = layout(tokens, textures, options.maxLines)
  if (lines.length === 0) return null

  const contentWidth = Math.max(...lines.map((l) => l.width))
  const contentHeight = lines.length * LINE_HEIGHT
  const content = new Container()

  lines.forEach((line, row) => {
    let x = (contentWidth - line.width) / 2 // center each line
    const y = row * LINE_HEIGHT
    line.items.forEach((item, i) => {
      if (i > 0) x += GAP
      if (item.kind === 'text') {
        const t = pixelText(item.text, TEXT_TINT)
        t.position.set(x, y + (LINE_HEIGHT - PIXEL_FONT_SIZE) / 2)
        content.addChild(t)
      } else if (item.texture) {
        const s = new Sprite(item.texture)
        s.width = EMOTE_SIZE
        s.height = EMOTE_SIZE
        s.position.set(x, y)
        content.addChild(s)
      }
      x += item.width
    })
  })

  return new SpeechBubble(content, contentWidth, contentHeight)
}

function tokenize(text: string, emotes: EmoteSpan[], maxChars: number): Token[] {
  const cps = truncateCodePoints(toCodePoints(text), maxChars)
  const spans = emotes
    .filter((e) => e.start < cps.length && e.end < cps.length && e.start <= e.end)
    .sort((a, b) => a.start - b.start)

  const tokens: Token[] = []
  let cursor = 0
  const pushWords = (segment: string) => {
    for (const word of sanitizeSegment(segment).split(' ')) {
      const renderable = toRenderable(word)
      if (renderable.length > 0) tokens.push({ kind: 'word', text: renderable })
    }
  }
  for (const span of spans) {
    if (span.start > cursor) pushWords(cps.slice(cursor, span.start).join(''))
    tokens.push({
      kind: 'emote',
      id: span.id,
      fallback: cps.slice(span.start, span.end + 1).join(''),
    })
    cursor = span.end + 1
  }
  if (cursor < cps.length) pushWords(cps.slice(cursor).join(''))
  return tokens
}

function layout(tokens: Token[], textures: Map<string, Texture | null>, maxLines: number): Line[] {
  const maxWordChars = BUBBLE_LINE_CHARS
  const items: LineItem[] = []

  const pushText = (text: string) => {
    items.push({ kind: 'text', text, texture: null, width: text.length * PIXEL_CHAR_WIDTH })
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
      const texture = textures.get(token.id) ?? null
      if (texture) {
        items.push({ kind: 'emote', text: '', texture, width: EMOTE_SIZE })
      } else {
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
