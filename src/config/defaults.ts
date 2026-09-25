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
  hypeWords: [
    'w', 'lets go', 'letsgo', 'lfg', 'pog', 'poggers', 'pogchamp', 'pogu',
    'hype', 'clutch', 'gg', 'ez', 'sheesh', 'goated',
  ],
  sadWords: [
    'l', 'f', 'o7', 'rip', 'ripbozo', 'sadge', 'biblethump', 'notlikethis',
    'unlucky', 'pain',
  ],
  crowdChatters: 3,
  crowdWindowMs: 10_000,
  crowdCooldownMs: 15_000,
  selfReactionMs: 2_000,
  crowdReactionMs: 4_000,
  debug: '',
}
