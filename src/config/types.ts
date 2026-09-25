/** Debug modes: '' = off, '1' = overlay only, 'grid' = overlay + 25 fake chatters. */
export type DebugMode = '' | '1' | 'grid'

export interface AppConfig {
  /** Twitch channel to join. Required; the app shows an error screen without it. */
  channel: string
  /** Max avatars on screen. When full, the longest-idle avatar is evicted. */
  maxAvatars: number
  /** No messages for this long -> avatar walks off and despawns. */
  idleTimeoutMs: number
  /** Height in px of the bottom strip the avatars live in. */
  stripHeight: number
  /** Integer scale applied to 32px base sprites (3 -> 96px tall). */
  spriteScale: number
  /** [min, max] walk speed in px/sec, chosen per avatar from their DNA. */
  walkSpeedRange: [number, number]
  /** How long a speech bubble stays up. */
  bubbleDurationMs: number
  /** Messages longer than this (in code points) are truncated with an ellipsis. */
  bubbleMaxChars: number
  /** Logins that never spawn avatars. */
  ignoredBots: string[]
  debug: DebugMode
}
