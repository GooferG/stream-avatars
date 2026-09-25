import { Emitter } from './emitter'
import type {
  ChatEventSource,
  ChatMessageEvent,
  ChatSourceEvents,
  ConnectionState,
} from './types'

const DEDUP_CAPACITY = 100
const COMMAND_RE = /^!([a-zA-Z0-9_]+)(?:\s+(.*))?$/

export interface BaseSourceOptions {
  ignoredBots: string[]
}

/**
 * Shared plumbing for every chat backend: bot filtering, message-id dedup
 * (double delivery can happen around reconnects), and !command parsing.
 * Adapters map their raw events into ChatMessageEvent and call
 * handleRawMessage; everything else is inherited.
 */
export abstract class BaseChatSource implements ChatEventSource {
  protected emitter = new Emitter<ChatSourceEvents>()
  private ignoredBots: Set<string>
  private seenIds = new Set<string>()
  private seenOrder: string[] = []

  constructor(options: BaseSourceOptions) {
    this.ignoredBots = new Set(options.ignoredBots.map((b) => b.toLowerCase()))
  }

  abstract connect(): Promise<void>
  abstract disconnect(): Promise<void>

  on<K extends keyof ChatSourceEvents>(
    event: K,
    listener: (...args: ChatSourceEvents[K]) => void,
  ): () => void {
    return this.emitter.on(event, listener)
  }

  protected emitState(state: ConnectionState): void {
    this.emitter.emit('state', state)
  }

  protected handleRawMessage(event: ChatMessageEvent): void {
    if (this.ignoredBots.has(event.login)) return
    if (event.messageId !== null && this.isDuplicate(event.messageId)) return

    const command = COMMAND_RE.exec(event.text)
    if (command && command[1]) {
      const args = (command[2] ?? '').split(/\s+/).filter((a) => a.length > 0)
      this.emitter.emit('command', {
        name: command[1].toLowerCase(),
        args,
        message: event,
      })
      return
    }
    this.emitter.emit('message', event)
  }

  private isDuplicate(messageId: string): boolean {
    if (this.seenIds.has(messageId)) return true
    this.seenIds.add(messageId)
    this.seenOrder.push(messageId)
    if (this.seenOrder.length > DEDUP_CAPACITY) {
      const oldest = this.seenOrder.shift()
      if (oldest !== undefined) this.seenIds.delete(oldest)
    }
    return false
  }
}
