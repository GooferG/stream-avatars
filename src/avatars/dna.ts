/**
 * FNV-1a 32-bit over the raw UTF-16 units of the lowercase login: the seed
 * behind every viewer's look (see look.ts). Frozen: changing it rerolls
 * every viewer, and the golden test in dna.test.ts locks it.
 */
export function fnv1a32(text: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash >>> 0
}
