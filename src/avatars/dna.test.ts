import { describe, expect, it } from 'vitest'
import { fnv1a32 } from './dna'

describe('fnv1a32', () => {
  // Golden values: these lock the hash function. If this test breaks,
  // every viewer's avatar rerolls. Do not update casually.
  it('matches golden values', () => {
    expect(fnv1a32('gooferg')).toBe(1414851626)
    expect(fnv1a32('pixelpete')).toBe(4063665787)
  })
})
