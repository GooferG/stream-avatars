export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected'

/** Emote occurrence; start/end are inclusive CODE POINT indices into the message text. */
export interface EmoteSpan {
  id: string
  start: number
  end: number
}

export interface ChatMessageEvent {
  /** Lowercase login name; the identity key for avatars. */
  login: string
  displayName: string
  /** '#RRGGBB' from Twitch tags, or null when the user never set one. */
  color: string | null
  text: string
  emotes: EmoteSpan[]
  /** Twitch message id, used to dedup double delivery around reconnects. */
  messageId: string | null
  timestamp: number
  /** Raw source tags, kept for phase 2 (badges, sub/mod/vip flair). */
  tags: Record<string, unknown>
}

export interface ChatCommandEvent {
  /** Command name without the '!', lowercase. */
  name: string
  args: string[]
  message: ChatMessageEvent
}

// A type alias (not interface) so it satisfies the emitter's Record constraint.
export type ChatSourceEvents = {
  message: [e: ChatMessageEvent]
  command: [e: ChatCommandEvent]
  state: [s: ConnectionState]
}

/**
 * The seam that keeps chat backends swappable: tmi.js today, Streamer.bot
 * WebSocket in phase 2. Everything downstream only sees this interface.
 */
export interface ChatEventSource {
  connect(): Promise<void>
  disconnect(): Promise<void>
  on<K extends keyof ChatSourceEvents>(
    event: K,
    listener: (...args: ChatSourceEvents[K]) => void,
  ): () => void
}
