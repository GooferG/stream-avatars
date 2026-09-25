import type { AppConfig } from './types'

export const DEFAULT_CONFIG: AppConfig = {
  channel: '',
  maxAvatars: 25,
  idleTimeoutMs: 10 * 60_000,
  stripHeight: 200,
  spriteScale: 3,
  walkSpeedRange: [30, 70],
  bubbleDurationMs: 5_000,
  bubbleMaxChars: 120,
  ignoredBots: ['nightbot', 'streamelements', 'streamlabs', 'moobot', 'fossabot'],
  debug: '',
}
