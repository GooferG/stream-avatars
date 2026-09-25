import type { ChatCommandEvent, ChatMessageEvent } from '../chat/types'
import { BUILDS, KINDS } from '../render/sprites/roster'

/**
 * ?debug=grid: synthesizes traffic from 25 fake chatters so spawn density,
 * eviction, frame rate and chat reactions can be checked without a live
 * channel, including `!avatar` picks. About every 30 seconds a hype or sad
 * wave rolls through.
 */
const FAKE_LOGINS = [
  'pixelpete', 'gooberfan42', 'slime_time', 'retro_rita', 'bitcrusher',
  'lurkmaster', 'pogchamp99', 'ghostie_g', 'chatterbox', 'noodle_arms',
  'crt_enjoyer', 'dpad_dan', 'save_state', 'framedrop', 'vsync_vera',
  'coyote_time', 'iframe_izzy', 'hitbox_hank', 'speedrun_sam', 'rng_carry',
  'clutch_or_kick', 'sixty_fps', 'alt_f4_andy', 'respawn_rose', 'gg_no_re',
]

const FAKE_LINES = [
  'hello everyone',
  'this run is looking clean',
  'LETS GOOO',
  'first time here, love the vibe',
  'that jump was cursed',
  'chat is this real',
  'no shot he clutches this',
  'brb getting snacks',
  'the pixel avatars are so cute',
  'W streamer',
  'somebody clip that',
  'day 47 of asking for mario kart',
]

const COLORS = ['#FF4500', '#1E90FF', '#00FF7F', '#FF69B4', '#FFD700', '#9ACD32', null]

const HYPE_WAVE = ['W', 'WWWW', 'LETS GOOO', 'POGGERS', 'W W W']
const SAD_WAVE = ['L', 'LLLL', 'F', 'RIP', 'o7']
/** Fake !avatar picks, plus one unknown word so the help bubble shows up too. */
const AVATAR_WORDS = [...KINDS, ...BUILDS, 'dragon']
/** One fake message every 400ms, so a wave every 75 ticks is about every 30s. */
const WAVE_EVERY_TICKS = 75
const WAVE_SIZE = 4

function pick<T>(items: readonly T[], fallback: T): T {
  return items[Math.floor(Math.random() * items.length)] ?? fallback
}

export function startFakeChat(
  onMessage: (e: ChatMessageEvent) => void,
  onCommand: (e: ChatCommandEvent) => void,
): () => void {
  let counter = 0
  let wave: string[] = []
  const interval = window.setInterval(() => {
    counter++
    if (counter % WAVE_EVERY_TICKS === 0) {
      const lines = Math.random() < 0.5 ? HYPE_WAVE : SAD_WAVE
      wave = Array.from({ length: WAVE_SIZE }, () => pick(lines, 'W'))
    }
    const waveLine = wave.shift()
    const login = pick(FAKE_LOGINS, 'fallback')
    const message: ChatMessageEvent = {
      login,
      displayName: login,
      color: pick(COLORS, null),
      text: waveLine ?? pick(FAKE_LINES, 'hi'),
      emotes: [],
      messageId: `fake-${counter}`,
      timestamp: Date.now(),
      tags: {},
    }
    if (waveLine === undefined && Math.random() < 0.15) {
      onCommand(
        Math.random() < 0.3
          ? { name: 'avatar', args: [pick(AVATAR_WORDS, 'cat')], message }
          : { name: 'jump', args: [], message },
      )
    } else {
      onMessage(message)
    }
  }, 400)
  return () => window.clearInterval(interval)
}
