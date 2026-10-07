import { describe, expect, it } from 'vitest'
import { findSevenTvSpans, parseEmoteSet, SevenTvEmotes, type SevenTvEmote } from './sevenTv'
import type { EmoteSpan } from './types'

const KEKW: SevenTvEmote = { name: 'KEKW', id: '01KEKW', animated: false, zeroWidth: false }
const RAIN: SevenTvEmote = { name: 'RainTime', id: '01RAIN', animated: true, zeroWidth: true }
const KAPPA_7TV: SevenTvEmote = { name: 'Kappa', id: '01KAPPA', animated: false, zeroWidth: false }
const byName = (...emotes: SevenTvEmote[]) => new Map(emotes.map((e) => [e.name, e]))

describe('findSevenTvSpans', () => {
  it('matches whole words exactly, capitals included, like 7TV itself', () => {
    const spans = findSevenTvSpans('KEKW that was kekw KEKW! KEKW', [], byName(KEKW))
    expect(spans).toEqual([
      { provider: '7tv', id: '01KEKW', start: 0, end: 3, animated: false, zeroWidth: false },
      { provider: '7tv', id: '01KEKW', start: 25, end: 28, animated: false, zeroWidth: false },
    ])
  })

  it('indexes code points, the way Twitch emote ranges do', () => {
    // the party popper is two UTF-16 units but one code point
    const spans = findSevenTvSpans('\u{1F389}  RainTime', [], byName(RAIN))
    expect(spans).toEqual([
      { provider: '7tv', id: '01RAIN', start: 3, end: 10, animated: true, zeroWidth: true },
    ])
  })

  it('leaves words Twitch already marked as emotes to Twitch', () => {
    const twitch: EmoteSpan[] = [{ provider: 'twitch', id: '25', start: 0, end: 4 }]
    const spans = findSevenTvSpans('Kappa Kappa', twitch, byName(KAPPA_7TV))
    expect(spans).toEqual([
      { provider: '7tv', id: '01KAPPA', start: 6, end: 10, animated: false, zeroWidth: false },
    ])
  })

  it('finds nothing without emotes', () => {
    expect(findSevenTvSpans('KEKW', [], new Map())).toEqual([])
  })
})

/** Trimmed from real 7TV v3 responses: set-level name and flags, emote data with its host files. */
function setEmote(
  name: string,
  id: string,
  { flags = 0, animated = false, dataName = name }: { flags?: number; animated?: boolean; dataName?: string } = {},
) {
  return {
    id,
    name,
    flags,
    data: {
      id,
      name: dataName,
      animated,
      host: {
        url: `//cdn.7tv.app/emote/${id}`,
        files: [{ name: '1x.webp', static_name: '1x_static.webp', width: 32, height: 32, format: 'WEBP' }],
      },
    },
  }
}

describe('parseEmoteSet', () => {
  it('reads each emote by the name chat uses, with its id, animation and zero-width flag', () => {
    const set = {
      id: 'global',
      emotes: [
        setEmote('reckH', '01FGH8NE3800064MEQW00DNBNG'),
        setEmote('PepePls', '01GCMQJGB0000D8ZK13J8KVCDX', { animated: true }),
        setEmote('RainTime', '01FGH9W5BG00047CPSV86K549H', { flags: 1, animated: true }),
        // a channel alias: chat types the set's name, not the original
        setEmote('reeferSad', '01ALIAS0000000000000000000', { dataName: 'TriSad' }),
      ],
    }
    expect(parseEmoteSet(set)).toEqual([
      { name: 'reckH', id: '01FGH8NE3800064MEQW00DNBNG', animated: false, zeroWidth: false },
      { name: 'PepePls', id: '01GCMQJGB0000D8ZK13J8KVCDX', animated: true, zeroWidth: false },
      { name: 'RainTime', id: '01FGH9W5BG00047CPSV86K549H', animated: true, zeroWidth: true },
      { name: 'reeferSad', id: '01ALIAS0000000000000000000', animated: false, zeroWidth: false },
    ])
  })

  it('skips malformed entries and survives an empty or missing list', () => {
    const set = {
      emotes: [
        setEmote('ok', '01OK'),
        { name: 'noId' },
        { id: '01NONAME' },
        null,
        'junk',
        { id: '01SPACE', name: 'two words' },
      ],
    }
    expect(parseEmoteSet(set).map((e) => e.name)).toEqual(['ok'])
    expect(parseEmoteSet({ emotes: null })).toEqual([])
    expect(parseEmoteSet(null)).toEqual([])
    expect(parseEmoteSet('nope')).toEqual([])
  })
})

const GLOBAL_URL = 'https://7tv.io/v3/emote-sets/global'
const CHANNEL_URL = 'https://7tv.io/v3/users/twitch/12345'

type Route = () => Response
/** Answers only the two real 7TV URLs; anything else is a server error. */
function fakeFetch(routes: Record<string, Route>): (url: string) => Promise<Response> {
  return async (url) => {
    const route = routes[url]
    return route ? route() : new Response('', { status: 500 })
  }
}
const json = (body: unknown) => () => new Response(JSON.stringify(body), { status: 200 })
const user = (...emotes: unknown[]) => json({ id: 'u', emote_set: { id: 's', emotes } })
const ids = (spans: EmoteSpan[]) => spans.map((s) => s.id)

describe('SevenTvEmotes', () => {
  it('matches both the global and the channel set, the channel winning a shared name', async () => {
    const emotes = new SevenTvEmotes(
      fakeFetch({
        [GLOBAL_URL]: json({ emotes: [setEmote('reckH', 'G1'), setEmote('Clap', 'G2')] }),
        [CHANNEL_URL]: user(setEmote('Clap', 'C1'), setEmote('catJAM', 'C2')),
      }),
    )
    await emotes.load('12345')
    expect(ids(emotes.spansFor('reckH Clap catJAM', []))).toEqual(['G1', 'C1', 'C2'])
  })

  it('gives a channel without a 7TV account the global set', async () => {
    const emotes = new SevenTvEmotes(
      fakeFetch({
        [GLOBAL_URL]: json({ emotes: [setEmote('reckH', 'G1')] }),
        [CHANNEL_URL]: () => new Response('{"error":"user not found"}', { status: 404 }),
      }),
    )
    await emotes.load('12345')
    expect(ids(emotes.spansFor('reckH', []))).toEqual(['G1'])
  })

  it('drops emotes the channel removed when it refreshes', async () => {
    let channel = user(setEmote('catJAM', 'C2'))
    const emotes = new SevenTvEmotes(
      fakeFetch({ [GLOBAL_URL]: json({ emotes: [] }), [CHANNEL_URL]: () => channel() }),
    )
    await emotes.load('12345')
    channel = user()
    await emotes.load('12345')
    expect(emotes.spansFor('catJAM', [])).toEqual([])
  })

  it('keeps the last good emotes when 7TV cannot be reached', async () => {
    let down = false
    const route =
      (body: Route): Route =>
      () => {
        if (down) throw new TypeError('Failed to fetch')
        return body()
      }
    const emotes = new SevenTvEmotes(
      fakeFetch({
        [GLOBAL_URL]: route(json({ emotes: [setEmote('reckH', 'G1')] })),
        [CHANNEL_URL]: route(user(setEmote('catJAM', 'C2'))),
      }),
    )
    await emotes.load('12345')
    down = true
    await emotes.load('12345')
    expect(ids(emotes.spansFor('reckH catJAM', []))).toEqual(['G1', 'C2'])
  })

  it('matches nothing before the first load', () => {
    expect(new SevenTvEmotes(fakeFetch({})).spansFor('reckH', [])).toEqual([])
  })
})
