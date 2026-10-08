import type { EmoteSpan } from '../chat/types'

/**
 * Which emote image to fetch, how to tell a GIF from a still, and how wide
 * to draw it. Kept free of Pixi so it can be checked in tests.
 */

/** Emotes are drawn one bubble line tall. */
export const EMOTE_HEIGHT = 22
/** A message of only a few emotes draws them twice as tall (see isJumbo). */
export const JUMBO_EMOTE_HEIGHT = EMOTE_HEIGHT * 2
/** Wider emotes are squeezed to this many line heights. */
const MAX_ASPECT = 3

/** Which of the CDNs' files to fetch: 1x for normal emotes, 2x for jumbo ones. */
export type EmoteSize = 1 | 2

/**
 * The 1x files (28px on Twitch, 32px on 7TV) are the closest to the 22px
 * they're drawn at, and the lightest GIFs; the 2x files (56px, 64px) do the
 * same for the 44px jumbo size. Twitch's `default` file is the GIF when the
 * emote is animated and a PNG otherwise; 7TV says which of its emotes move,
 * and only those get a GIF.
 */
export function emoteUrl(emote: Pick<EmoteSpan, 'provider' | 'id' | 'animated'>, size: EmoteSize = 1): string {
  if (emote.provider === '7tv') {
    return `https://cdn.7tv.app/emote/${emote.id}/${size}x.${emote.animated ? 'gif' : 'webp'}`
  }
  return `https://static-cdn.jtvnw.net/emoticons/v2/${emote.id}/default/dark/${size}.0`
}

/** GIF87a or GIF89a: Twitch's URLs carry no file extension, so the bytes decide. */
export function isGif(bytes: Uint8Array): boolean {
  if (bytes.length < 6) return false
  const signature = String.fromCharCode(...bytes.subarray(0, 6))
  return signature === 'GIF87a' || signature === 'GIF89a'
}

/** Width at `drawHeight` that keeps the image's shape, capped for very wide emotes. */
export function emoteDisplayWidth(width: number, height: number, drawHeight = EMOTE_HEIGHT): number {
  if (!(width > 0 && height > 0)) return drawHeight
  return Math.round(drawHeight * Math.min(width / height, MAX_ASPECT))
}
