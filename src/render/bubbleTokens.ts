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
