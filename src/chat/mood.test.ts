import { describe, expect, it } from 'vitest'
import { classify, compileWords, normalizeMessage } from './mood'

describe('normalizeMessage', () => {
  it.each([
    ['WWWW', ['w']],
    ['W W W', ['w']],
    ['LETS GOOOO LETS GO', ['lets', 'go']],
    ['PogChamp PogChamp', ['pogchamp']],
    ['o7', ['o7']],
    ["that's insane!!!", ['that', 's', 'insane']],
  ])('%s', (text, expected) => {
    expect(normalizeMessage(text)).toEqual(expected)
  })

  it('reduces emoji-only, non-Latin and punctuation-only messages to nothing', () => {
    expect(normalizeMessage('😂😂😂')).toEqual([])
    expect(normalizeMessage('こんにちは')).toEqual([])
    expect(normalizeMessage('?!...')).toEqual([])
    expect(normalizeMessage('')).toEqual([])
  })
})

describe('classify', () => {
  const hype = compileWords(['w', 'lets go', 'pogchamp'])
  const sad = compileWords(['l', 'f'])
  const moodOf = (text: string) => classify(normalizeMessage(text), hype, sad)

  it('finds a hype word anywhere in a message', () => {
    expect(moodOf('W streamer')).toBe('cheer')
    expect(moodOf('PogChamp')).toBe('cheer')
  })

  it('matches phrases only when their words are consecutive', () => {
    expect(moodOf('LETS GOOOOO')).toBe('cheer')
    expect(moodOf('go lets')).toBeNull()
  })

  it('never matches inside longer words', () => {
    expect(moodOf('wow')).toBeNull()
    expect(moodOf('lol')).toBeNull()
  })

  it('returns sad for sad words', () => {
    expect(moodOf('LLLL')).toBe('sad')
    expect(moodOf('f in chat')).toBe('sad')
  })

  it('ignores messages that are both hype and sad', () => {
    expect(moodOf('W or L?')).toBeNull()
  })

  it('matches list entries written with caps or punctuation', () => {
    const custom = compileWords(['LETS GO!', 'PogChamp', '  ', '!!'])
    expect(custom).toEqual([['lets', 'go'], ['pogchamp']])
    expect(classify(normalizeMessage('lets goooo'), custom, [])).toBe('cheer')
  })
})
