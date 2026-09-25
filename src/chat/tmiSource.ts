import tmi from 'tmi.js'
import { BaseChatSource, type BaseSourceOptions } from './baseSource'
import type { ChatMessageEvent, EmoteSpan } from './types'

/**
 * tmi.js adapter. No identity block means an anonymous justinfan login:
 * read-only chat access with no OAuth. tmi.js handles reconnection itself;
 * listeners are registered exactly once here, so reconnects never duplicate
 * events, and the avatar manager (keyed by login) never duplicates avatars.
 */
export class TmiChatSource extends BaseChatSource {
  private client: tmi.Client

  constructor(channel: string, options: BaseSourceOptions) {
    super(options)
    this.client = new tmi.Client({
      channels: [channel],
      connection: { reconnect: true, secure: true },
    })

    this.client.on('connecting', () => this.emitState('connecting'))
    this.client.on('connected', () => this.emitState('connected'))
    this.client.on('reconnect', () => this.emitState('reconnecting'))
    this.client.on('disconnected', () => this.emitState('disconnected'))

    this.client.on('message', (_channel, tags, text, self) => {
      if (self) return
      const login = (tags.username ?? '').toLowerCase()
      if (!login) return
      const event: ChatMessageEvent = {
        login,
        displayName: tags['display-name'] ?? login,
        color: tags.color ?? null,
        text,
        emotes: flattenEmotes(tags.emotes),
        messageId: tags.id ?? null,
        timestamp: Date.now(),
        tags: tags as Record<string, unknown>,
      }
      this.handleRawMessage(event)
    })
  }

  async connect(): Promise<void> {
    await this.client.connect()
  }

  async disconnect(): Promise<void> {
    await this.client.disconnect()
  }
}

/** tmi.js emotes tag shape: { [emoteId]: ['start-end', ...] }, code point indices. */
function flattenEmotes(emotes: { [id: string]: string[] } | undefined): EmoteSpan[] {
  if (!emotes) return []
  const spans: EmoteSpan[] = []
  for (const [id, ranges] of Object.entries(emotes)) {
    for (const range of ranges) {
      const [startRaw, endRaw] = range.split('-')
      const start = Number(startRaw)
      const end = Number(endRaw)
      if (Number.isInteger(start) && Number.isInteger(end) && end >= start) {
        spans.push({ id, start, end })
      }
    }
  }
  spans.sort((a, b) => a.start - b.start)
  return spans
}
