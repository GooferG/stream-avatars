import { describe, expect, it } from 'vitest'
import { findTarget, parseTarget } from './target'

describe('parseTarget', () => {
  it('takes the first word, without its leading @s, lowercased', () => {
    expect(parseTarget(['@Bob', 'hi'])).toBe('bob')
    expect(parseTarget(['@@Bob'])).toBe('bob')
    expect(parseTarget(['BOB'])).toBe('bob')
  })

  it('is null when no name was given', () => {
    expect(parseTarget([])).toBeNull()
    expect(parseTarget(['@'])).toBeNull()
    expect(parseTarget(['@@'])).toBeNull()
  })
})

describe('findTarget', () => {
  const onScreen = [
    { login: 'xx_ann', displayName: 'Ann' },
    { login: 'ann', displayName: 'NotAnn' },
    { login: 'bob_1', displayName: 'Bobby' },
  ]

  it('matches a login before a display name', () => {
    expect(findTarget('ann', onScreen)?.login).toBe('ann')
  })

  it('falls back to the display name, ignoring its case', () => {
    expect(findTarget('bobby', onScreen)?.login).toBe('bob_1')
    expect(findTarget('notann', onScreen)?.login).toBe('ann')
  })

  it('is null when nobody on screen matches', () => {
    expect(findTarget('carol', onScreen)).toBeNull()
    expect(findTarget('carol', [])).toBeNull()
  })
})
