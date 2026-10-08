import type { EmoteSpan } from '../chat/types'
import { sanitizeSegment, toCodePoints, toRenderable, truncateCodePoints } from '../utils/text'

/**
 * A chat message split into the words and emotes a speech bubble lays out.
 * Kept free of Pixi so it can be checked in tests.
 */
export type Token =
  | { kind: 'word'; text: string }
  | {
      kind: 'emote'
      emote: EmoteSpan
      /** The emote's text, shown when its image can't be loaded. */
      fallback: string
      /** Zero-width emotes drawn on top of this one. */
      overlays: EmoteSpan[]
    }

/** Most emotes a message can have and still be drawn jumbo. */
const JUMBO_MAX_EMOTES = 3

/**
 * A message of nothing but a few emotes gets them drawn big, like jumbo
 * emoji; zero-width emotes ride along without counting. Longer emote spam
 * stays normal size so it can't fill the stage.
 */
export function isJumbo(tokens: readonly Token[]): boolean {
  return tokens.length > 0 && tokens.length <= JUMBO_MAX_EMOTES && tokens.every((t) => t.kind === 'emote')
}

export function tokenize(text: string, emotes: readonly EmoteSpan[], maxChars: number): Token[] {
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
    const previous = tokens[tokens.length - 1]
    if (span.zeroWidth && previous?.kind === 'emote') {
      previous.overlays.push(span)
      cursor = span.end + 1
      continue
    }
    tokens.push({
      kind: 'emote',
      emote: span,
      fallback: cps.slice(span.start, span.end + 1).join(''),
      overlays: [],
    })
    cursor = span.end + 1
  }
  if (cursor < cps.length) pushWords(cps.slice(cursor).join(''))
  return tokens
}
