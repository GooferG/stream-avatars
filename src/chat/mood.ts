export type Mood = 'cheer' | 'sad'

/**
 * A message as matchable words: accents stripped (tá -> ta, full-width Ｗ -> w),
 * lowercased, apostrophes removed so contractions stay whole (LET'S -> lets,
 * I'll -> il, never a stray "l"), other punctuation/emoji/non-Latin dropped,
 * stretched letters collapsed (WWWW -> w, GOOOO -> go).
 */
export function normalizeMessage(text: string): string[] {
  return text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/(.)\1+/g, '$1')
    .split(/\s+/)
    .filter((w) => w.length > 0)
}

/** Word-list entries cleaned exactly like chat, so matching is like for like. Empty entries are dropped. */
export function compileWords(list: string[]): string[][] {
  return list.map(normalizeMessage).filter((phrase) => phrase.length > 0)
}

/** 'cheer' or 'sad' when the message contains a listed word or phrase; null for neither or both. */
export function classify(words: string[], hype: string[][], sad: string[][]): Mood | null {
  const isHype = hype.some((phrase) => containsPhrase(words, phrase))
  const isSad = sad.some((phrase) => containsPhrase(words, phrase))
  if (isHype === isSad) return null
  return isHype ? 'cheer' : 'sad'
}

function containsPhrase(words: string[], phrase: string[]): boolean {
  for (let i = 0; i + phrase.length <= words.length; i++) {
    if (phrase.every((word, j) => words[i + j] === word)) return true
  }
  return false
}

export type Reaction =
  | { scope: 'self'; mood: Mood; login: string }
  | { scope: 'crowd'; mood: Mood }

export interface MoodOptions {
  hypeWords: string[]
  sadWords: string[]
  crowdChatters: number
  crowdWindowMs: number
  crowdCooldownMs: number
}

/** Longest message, in distinct words, that can count as a chat-wide repeat. */
export const MAX_REPEAT_WORDS = 3
/** Hard cap on remembered messages, so raid-sized spam can't grow memory. */
export const MAX_REMEMBERED = 500

interface Entry {
  login: string
  at: number
  mood: Mood | null
  /** Cleaned text of a short message, for spotting repeats; null when too long. */
  key: string | null
}

/**
 * Turns chat into reactions. Pure: no Pixi, no DOM, no timers; `now` comes
 * from the caller, so tests control the clock.
 *
 * - A message with a hype/sad word: that chatter's avatar reacts.
 * - crowdChatters different chatters sending that mood within crowdWindowMs:
 *   the whole crowd reacts, then that mood cools down for crowdCooldownMs.
 * - The same short unlisted message from crowdChatters chatters: crowd cheer.
 */
export class ChatMood {
  private options: MoodOptions
  private hype: string[][]
  private sad: string[][]
  private entries: Entry[] = []
  private lastCrowdAt: Record<Mood, number> = { cheer: -Infinity, sad: -Infinity }

  constructor(options: MoodOptions) {
    this.options = options
    this.hype = compileWords(options.hypeWords)
    this.sad = compileWords(options.sadWords)
  }

  /** Messages currently remembered (for tests and debugging). */
  get remembered(): number {
    return this.entries.length
  }

  observe(message: { login: string; text: string }, now: number): Reaction[] {
    const words = normalizeMessage(message.text)
    if (words.length === 0) return []
    const mood = classify(words, this.hype, this.sad)
    // repeated words don't make a different message: "caught caught" = "caught"
    const distinct = [...new Set(words)]
    const key = distinct.length <= MAX_REPEAT_WORDS ? distinct.join(' ') : null
    this.remember({ login: message.login, at: now, mood, key }, now)

    const crowd = this.crowdMood(mood, key, now)
    if (crowd) {
      this.lastCrowdAt[crowd] = now
      // the crowd reaction already includes the sender's avatar
      return [{ scope: 'crowd', mood: crowd }]
    }
    return mood ? [{ scope: 'self', mood, login: message.login }] : []
  }

  private remember(entry: Entry, now: number): void {
    const cutoff = now - this.options.crowdWindowMs
    this.entries = this.entries.filter((e) => e.at > cutoff)
    this.entries.push(entry)
    if (this.entries.length > MAX_REMEMBERED) {
      this.entries.splice(0, this.entries.length - MAX_REMEMBERED)
    }
  }

  private crowdMood(mood: Mood | null, key: string | null, now: number): Mood | null {
    // listed words count by mood; an unlisted message can only be a repeat,
    // which counts as hype unless cheers are turned off (empty hype list)
    const repeatCheers = key !== null && this.hype.length > 0
    const candidate: Mood | null = mood ?? (repeatCheers ? 'cheer' : null)
    if (!candidate) return null
    if (now - this.lastCrowdAt[candidate] < this.options.crowdCooldownMs) return null
    const chatters = mood
      ? this.distinctChatters((e) => e.mood === mood)
      : this.distinctChatters((e) => e.mood === null && e.key === key)
    return chatters >= this.options.crowdChatters ? candidate : null
  }

  private distinctChatters(match: (e: Entry) => boolean): number {
    return new Set(this.entries.filter(match).map((e) => e.login)).size
  }
}
