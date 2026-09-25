export type Mood = 'cheer' | 'sad'

/**
 * A message as matchable words: lowercased, punctuation/emoji/non-Latin
 * dropped, stretched letters collapsed (WWWW -> w, GOOOO -> go), repeated
 * words kept once in first-seen order (LETS GO LETS GO -> [lets, go]).
 */
export function normalizeMessage(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/(.)\1+/g, '$1')
    .split(/\s+/)
    .filter((w) => w.length > 0)
  return [...new Set(words)]
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
