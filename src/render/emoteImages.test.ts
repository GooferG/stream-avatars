import { describe, expect, it } from 'vitest'
import { JUMBO_EMOTE_HEIGHT, emoteDisplayWidth, emoteUrl, isGif } from './emoteImages'

describe('emoteUrl', () => {
  it("asks Twitch for its default file, which is the GIF when the emote moves", () => {
    expect(emoteUrl({ provider: 'twitch', id: 'emotesv2_abc' })).toBe(
      'https://static-cdn.jtvnw.net/emoticons/v2/emotesv2_abc/default/dark/1.0',
    )
  })

  it('asks 7TV for the GIF of an animated emote and the WebP of a still one', () => {
    expect(emoteUrl({ provider: '7tv', id: '01RAIN', animated: true })).toBe(
      'https://cdn.7tv.app/emote/01RAIN/1x.gif',
    )
    expect(emoteUrl({ provider: '7tv', id: '01KEKW', animated: false })).toBe(
      'https://cdn.7tv.app/emote/01KEKW/1x.webp',
    )
  })

  it('asks for the 2x files when the emote is drawn jumbo', () => {
    expect(emoteUrl({ provider: 'twitch', id: 'emotesv2_abc' }, 2)).toBe(
      'https://static-cdn.jtvnw.net/emoticons/v2/emotesv2_abc/default/dark/2.0',
    )
    expect(emoteUrl({ provider: '7tv', id: '01RAIN', animated: true }, 2)).toBe(
      'https://cdn.7tv.app/emote/01RAIN/2x.gif',
    )
    expect(emoteUrl({ provider: '7tv', id: '01KEKW', animated: false }, 2)).toBe(
      'https://cdn.7tv.app/emote/01KEKW/2x.webp',
    )
  })
})

describe('isGif', () => {
  const bytes = (text: string) => new Uint8Array([...text].map((c) => c.charCodeAt(0)))

  it('recognizes both GIF signatures', () => {
    expect(isGif(bytes('GIF89a\x01\x00'))).toBe(true)
    expect(isGif(bytes('GIF87a\x01\x00'))).toBe(true)
  })

  it('rejects PNG, WebP and files too short to tell', () => {
    expect(isGif(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(false)
    expect(isGif(bytes('RIFF\x00\x00\x00\x00WEBP'))).toBe(false)
    expect(isGif(bytes('GIF8'))).toBe(false)
  })
})

describe('emoteDisplayWidth', () => {
  it('keeps the emote’s shape at the 22px line height', () => {
    expect(emoteDisplayWidth(64, 64)).toBe(22)
    expect(emoteDisplayWidth(64, 32)).toBe(44)
    // PepePls is 22x32: narrower than a square
    expect(emoteDisplayWidth(22, 32)).toBe(15)
  })

  it('caps very wide emotes at three line heights', () => {
    expect(emoteDisplayWidth(256, 32)).toBe(66)
  })

  it('falls back to a square for an image without a size', () => {
    expect(emoteDisplayWidth(0, 0)).toBe(22)
  })

  it('keeps the same shape at the jumbo height', () => {
    expect(emoteDisplayWidth(64, 64, JUMBO_EMOTE_HEIGHT)).toBe(44)
    expect(emoteDisplayWidth(22, 32, JUMBO_EMOTE_HEIGHT)).toBe(30)
    expect(emoteDisplayWidth(256, 32, JUMBO_EMOTE_HEIGHT)).toBe(132)
    expect(emoteDisplayWidth(0, 0, JUMBO_EMOTE_HEIGHT)).toBe(44)
  })
})
