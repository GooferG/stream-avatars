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
  /** Integer scale applied to the 48px sprite frames (2 -> 96px tall). */
  spriteScale: number
  /** [min, max] walk speed in px/sec, chosen per avatar from their DNA. */
  walkSpeedRange: [number, number]
  /** How long a speech bubble stays up. */
  bubbleDurationMs: number
  /** Messages longer than this (in code points) are truncated with an ellipsis. */
  bubbleMaxChars: number
  /** Logins that never spawn avatars. */
  ignoredBots: string[]
  /** Words/phrases that make an avatar cheer. Matched like chat: case, punctuation and stretched letters ignored. */
  hypeWords: string[]
  /** Words/phrases that make an avatar sad. */
  sadWords: string[]
  /** Distinct chatters within crowdWindowMs needed for a whole-crowd reaction. */
  crowdChatters: number
  crowdWindowMs: number
  /** Per mood, counted from when that mood's crowd reaction fired. */
  crowdCooldownMs: number
  /** How long a chatter's own avatar reacts to their message. */
  selfReactionMs: number
  /** How long the whole crowd reacts. */
  crowdReactionMs: number
  /** Banner and trim color of the !avatarinfo strip, '#RRGGBB'. */
  brandColor: string
  /** How long the !avatarinfo strip stays up. */
  infoDurationMs: number
  /** How long regular viewers wait between strip openings; the broadcaster and mods skip it. */
  infoCooldownMs: number
  /** How often one viewer can change their character with !avatar. */
  avatarChangeCooldownMs: number
  debug: DebugMode
}
