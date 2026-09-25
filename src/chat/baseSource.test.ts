import { describe, expect, it } from 'vitest'
import { BaseChatSource } from './baseSource'
import type { ChatCommandEvent, ChatMessageEvent } from './types'

class TestSource extends BaseChatSource {
  connect(): Promise<void> {
    return Promise.resolve()
  }
  disconnect(): Promise<void> {
    return Promise.resolve()
  }
  feed(event: ChatMessageEvent): void {
    this.handleRawMessage(event)
  }
}

function msg(overrides: Partial<ChatMessageEvent> = {}): ChatMessageEvent {
  return {
    login: 'someuser',
    displayName: 'SomeUser',
    color: null,
    text: 'hello world',
    emotes: [],
    messageId: null,
    timestamp: 0,
    tags: {},
    ...overrides,
  }
}

function collect(source: TestSource) {
  const messages: ChatMessageEvent[] = []
  const commands: ChatCommandEvent[] = []
  source.on('message', (e) => messages.push(e))
  source.on('command', (e) => commands.push(e))
  return { messages, commands }
}

describe('BaseChatSource', () => {
  it('emits plain messages', () => {
    const source = new TestSource({ ignoredBots: [] })
    const { messages, commands } = collect(source)
    source.feed(msg())
    expect(messages).toHaveLength(1)
    expect(commands).toHaveLength(0)
  })

  it('parses !commands with args, lowercased', () => {
    const source = new TestSource({ ignoredBots: [] })
    const { messages, commands } = collect(source)
    source.feed(msg({ text: '!JUMP  high  now ' }))
    expect(messages).toHaveLength(0)
    expect(commands).toHaveLength(1)
    expect(commands[0]?.name).toBe('jump')
    expect(commands[0]?.args).toEqual(['high', 'now'])
  })

  it('does not treat a lone ! or !!text as a command', () => {
    const source = new TestSource({ ignoredBots: [] })
    const { messages, commands } = collect(source)
    source.feed(msg({ text: '!' }))
    source.feed(msg({ text: '!!wow' }))
    expect(commands).toHaveLength(0)
    expect(messages).toHaveLength(2)
  })

  it('filters ignored bots case-insensitively', () => {
    const source = new TestSource({ ignoredBots: ['NightBot'] })
    const { messages } = collect(source)
    source.feed(msg({ login: 'nightbot' }))
    expect(messages).toHaveLength(0)
  })

  it('dedups repeated message ids but allows null ids', () => {
    const source = new TestSource({ ignoredBots: [] })
    const { messages } = collect(source)
    source.feed(msg({ messageId: 'abc' }))
    source.feed(msg({ messageId: 'abc' }))
    source.feed(msg({ messageId: null }))
    source.feed(msg({ messageId: null }))
    expect(messages).toHaveLength(3)
  })

  it('dedup window is bounded, old ids age out', () => {
    const source = new TestSource({ ignoredBots: [] })
    const { messages } = collect(source)
    source.feed(msg({ messageId: 'first' }))
    for (let i = 0; i < 150; i++) source.feed(msg({ messageId: `filler-${i}` }))
    source.feed(msg({ messageId: 'first' })) // aged out of the 100-entry window
    expect(messages).toHaveLength(152)
  })

  it('unsubscribe stops delivery', () => {
    const source = new TestSource({ ignoredBots: [] })
    const seen: ChatMessageEvent[] = []
    const off = source.on('message', (e) => seen.push(e))
    source.feed(msg())
    off()
    source.feed(msg())
    expect(seen).toHaveLength(1)
  })
})
