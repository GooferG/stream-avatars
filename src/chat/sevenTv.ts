import { toCodePoints } from '../utils/text'
import type { EmoteSpan } from './types'

/**
 * 7TV emotes, which Twitch knows nothing about: they arrive as plain words,
 * and 7TV's API (v3, no auth) says which words are emotes in this channel.
 */
export interface SevenTvEmote {
  /** The word chat types: the set's name for it, which may be a channel alias. */
  name: string
  id: string
  /** More than one frame: the GIF is fetched so it plays. */
  animated: boolean
  /** Drawn over the emote before it (like RainTime) instead of beside it. */
  zeroWidth: boolean
}

/** Active-emote flag in a set: the emote is zero-width there. */
const ZERO_WIDTH_FLAG = 1

/** A 7TV emote set (global, or a user's `emote_set`); malformed entries are skipped. */
export function parseEmoteSet(json: unknown): SevenTvEmote[] {
  if (!isRecord(json) || !Array.isArray(json.emotes)) return []
  const emotes: SevenTvEmote[] = []
  for (const entry of json.emotes) {
    if (!isRecord(entry)) continue
    const { id, name, flags, data } = entry
    if (typeof id !== 'string' || !id) continue
    // chat splits on whitespace, so a name with any can never match
    if (typeof name !== 'string' || !name || /\s/.test(name)) continue
    emotes.push({
      name,
      id,
      animated: isRecord(data) && data.animated === true,
      zeroWidth: typeof flags === 'number' && (flags & ZERO_WIDTH_FLAG) !== 0,
    })
  }
  return emotes
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * 7TV emotes in a message: whitespace-separated words that exactly match a
 * name in `emotes` (capitals included, punctuation not stripped, as 7TV's
 * own clients do). Words inside a `taken` span stay Twitch's.
 */
export function findSevenTvSpans(
  text: string,
  taken: readonly EmoteSpan[],
  emotes: ReadonlyMap<string, SevenTvEmote>,
): EmoteSpan[] {
  if (emotes.size === 0) return []
  const cps = toCodePoints(text)
  const spans: EmoteSpan[] = []
  let start = 0
  for (let i = 0; i <= cps.length; i++) {
    if (i < cps.length && !/\s/.test(cps[i] ?? '')) continue
    const end = i - 1
    const emote = end >= start ? emotes.get(cps.slice(start, i).join('')) : undefined
    if (emote && !taken.some((t) => t.start <= end && start <= t.end)) {
      spans.push({
        provider: '7tv',
        id: emote.id,
        start,
        end,
        animated: emote.animated,
        zeroWidth: emote.zeroWidth,
      })
    }
    start = i + 1
  }
  return spans
}

const API = 'https://7tv.io/v3'

/**
 * The global set plus the channel's, looked up by Twitch user id. Each
 * load() replaces a set only once 7TV answers for it, so a refresh during
 * an outage keeps the last good emotes; a channel with no 7TV account
 * (404) just has no channel set.
 */
export class SevenTvEmotes {
  private global: SevenTvEmote[] = []
  private channel: SevenTvEmote[] = []
  private byName = new Map<string, SevenTvEmote>()
  private fetchFn: (url: string) => Promise<Response>

  constructor(fetchFn: (url: string) => Promise<Response> = (url) => fetch(url)) {
    this.fetchFn = fetchFn
  }

  async load(twitchUserId: string): Promise<void> {
    const [global, channel] = await Promise.all([
      this.fetchSet(`${API}/emote-sets/global`, (json) => json),
      this.fetchSet(`${API}/users/twitch/${encodeURIComponent(twitchUserId)}`, (json) =>
        isRecord(json) ? json.emote_set : null,
      ),
    ])
    if (global) this.global = global
    if (channel) this.channel = channel
    // channel last, so its emotes win a shared name
    this.byName = new Map([...this.global, ...this.channel].map((e) => [e.name, e]))
  }

  spansFor(text: string, taken: readonly EmoteSpan[]): EmoteSpan[] {
    return findSevenTvSpans(text, taken, this.byName)
  }

  /** The set's emotes; [] for a 404, null when 7TV couldn't be asked. */
  private async fetchSet(url: string, pick: (json: unknown) => unknown): Promise<SevenTvEmote[] | null> {
    try {
      const res = await this.fetchFn(url)
      if (res.status === 404) return []
      if (!res.ok) return null
      return parseEmoteSet(pick(await res.json()))
    } catch {
      return null
    }
  }
}
