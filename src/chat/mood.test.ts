import { describe, expect, it } from 'vitest'
import {
  ChatMood,
  MAX_REMEMBERED,
  classify,
  compileWords,
  normalizeMessage,
  type MoodOptions,
} from './mood'

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

describe('ChatMood', () => {
  const options: MoodOptions = {
    hypeWords: ['w', 'lets go'],
    sadWords: ['l', 'f'],
    crowdChatters: 3,
    crowdWindowMs: 10_000,
    crowdCooldownMs: 15_000,
  }
  const say = (mood: ChatMood, login: string, text: string, at: number) =>
    mood.observe({ login, text }, at)

  it('gives the sender a personal cheer for a hype word', () => {
    expect(say(new ChatMood(options), 'pete', 'W', 0)).toEqual([
      { scope: 'self', mood: 'cheer', login: 'pete' },
    ])
  })

  it('gives the sender a personal sad reaction for a sad word', () => {
    expect(say(new ChatMood(options), 'pete', 'LLLL', 0)).toEqual([
      { scope: 'self', mood: 'sad', login: 'pete' },
    ])
  })

  it('ignores plain chat, and does not remember empty messages', () => {
    const mood = new ChatMood(options)
    expect(say(mood, 'pete', 'hello there friend', 0)).toEqual([])
    expect(say(mood, 'rita', '😂😂😂', 1)).toEqual([])
    expect(mood.remembered).toBe(1)
  })

  it('fires a crowd cheer when a third different chatter hypes', () => {
    const mood = new ChatMood(options)
    say(mood, 'a', 'W', 0)
    say(mood, 'b', 'lets gooo', 1_000)
    expect(say(mood, 'c', 'WWW', 2_000)).toEqual([{ scope: 'crowd', mood: 'cheer' }])
  })

  it('counts one chatter spamming only once', () => {
    const mood = new ChatMood(options)
    for (let t = 0; t < 3_000; t += 1_000) say(mood, 'a', 'W', t)
    expect(say(mood, 'a', 'W', 3_000)).toEqual([{ scope: 'self', mood: 'cheer', login: 'a' }])
  })

  it('forgets messages once they are a full window old', () => {
    const mood = new ChatMood(options)
    say(mood, 'a', 'W', 0)
    say(mood, 'b', 'W', 5_000)
    expect(say(mood, 'c', 'W', 10_000)).toEqual([{ scope: 'self', mood: 'cheer', login: 'c' }])
  })

  it('cools each mood down separately', () => {
    const mood = new ChatMood(options)
    say(mood, 'a', 'W', 0)
    say(mood, 'b', 'W', 1_000)
    expect(say(mood, 'c', 'W', 2_000)).toEqual([{ scope: 'crowd', mood: 'cheer' }])
    // cheer is cooling down: a fourth hyper only reacts personally
    expect(say(mood, 'd', 'W', 3_000)).toEqual([{ scope: 'self', mood: 'cheer', login: 'd' }])
    // sad is not blocked by the cheer cooldown
    say(mood, 'e', 'L', 4_000)
    say(mood, 'f', 'L', 5_000)
    expect(say(mood, 'g', 'L', 6_000)).toEqual([{ scope: 'crowd', mood: 'sad' }])
    // cheer can fire again exactly one cooldown after it last fired
    say(mood, 'h', 'W', 15_000)
    say(mood, 'i', 'W', 16_000)
    expect(say(mood, 'j', 'W', 17_000)).toEqual([{ scope: 'crowd', mood: 'cheer' }])
  })

  it('turns a message three chatters repeat into a crowd cheer', () => {
    const mood = new ChatMood(options)
    expect(say(mood, 'a', 'CAUGHT', 0)).toEqual([])
    expect(say(mood, 'b', 'caught', 1_000)).toEqual([])
    expect(say(mood, 'c', 'Caught!!', 2_000)).toEqual([{ scope: 'crowd', mood: 'cheer' }])
  })

  it('never treats messages longer than three words as repeats', () => {
    const mood = new ChatMood(options)
    for (const login of ['a', 'b', 'c', 'd']) {
      expect(say(mood, login, 'this is a long message', 0)).toEqual([])
    }
  })

  it('makes a repeated sad word a crowd sad, not a cheer', () => {
    const mood = new ChatMood(options)
    say(mood, 'a', 'F', 0)
    say(mood, 'b', 'F', 1_000)
    expect(say(mood, 'c', 'FFFF', 2_000)).toEqual([{ scope: 'crowd', mood: 'sad' }])
  })

  it('keeps memory bounded during raid-sized spam', () => {
    const mood = new ChatMood({ ...options, crowdChatters: 100_000 })
    for (let i = 0; i < 2_000; i++) say(mood, `user${i}`, 'W', i)
    expect(mood.remembered).toBe(MAX_REMEMBERED)
  })
})
