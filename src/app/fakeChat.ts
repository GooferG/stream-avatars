import type { ChatCommandEvent, ChatMessageEvent, EmoteSpan } from '../chat/types'

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
  // 7TV global emotes (with ?channel=, once its sets load): animated, zero-width, wide
  'PepePls RainTime this song slaps',
  'EZ Clap',
  'WAYTOODANK',
  'peepoHappy hi chat AlienDance',
  // Twitch emotes, marked the way Twitch tags mark them
  'Kappa nice try',
  'LUL LUL LUL',
]

/** Twitch emotes the fake lines use: real global ids, so the images load. */
const FAKE_TWITCH_EMOTES: Record<string, string> = { Kappa: '25', LUL: '425618' }

/** The spans Twitch's emotes tag would carry for a fake line (ASCII, so string index = code point). */
function fakeTwitchEmotes(text: string): EmoteSpan[] {
  const spans: EmoteSpan[] = []
  let start = 0
  for (const word of text.split(' ')) {
    const id = FAKE_TWITCH_EMOTES[word]
    if (id) spans.push({ provider: 'twitch', id, start, end: start + word.length - 1 })
    start += word.length + 1
  }
  return spans
}

const COLORS = ['#FF4500', '#1E90FF', '#00FF7F', '#FF69B4', '#FFD700', '#9ACD32', null]

const HYPE_WAVE = ['W', 'WWWW', 'LETS GOOO', 'POGGERS', 'W W W']
const SAD_WAVE = ['L', 'LLLL', 'F', 'RIP', 'o7']
/** Fake picks: single words, combos, the !skin shortcut, and a typo so the help bubble shows too. */
const FAKE_PICKS: [name: string, args: string[]][] = [
  ['avatar', ['fox']],
  ['avatar', ['duck']],
  ['avatar', ['skinny', '3', 'long']],
  ['avatar', ['chubby', 'bun', '5']],
  ['avatar', ['spiky', '1']],
  ['avatar', ['blue', 'dog']],
  ['avatar', ['penguin', 'pink']],
  ['avatar', ['long', 'red']],
  ['avatar', ['grey']],
  ['skin', ['2']],
  ['skin', ['6']],
  ['avatar', ['dragon']],
]
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
    const text = waveLine ?? pick(FAKE_LINES, 'hi')
    const message: ChatMessageEvent = {
      login,
      displayName: login,
      color: pick(COLORS, null),
      text,
      emotes: fakeTwitchEmotes(text),
      messageId: `fake-${counter}`,
      timestamp: Date.now(),
      tags: {},
    }
    if (waveLine === undefined && Math.random() < 0.15) {
      const [name, args] = Math.random() < 0.3 ? pick(FAKE_PICKS, ['avatar', ['cat']]) : ['jump', []]
      onCommand({ name, args, message })
    } else {
      onMessage(message)
    }
  }, 400)
  return () => window.clearInterval(interval)
}
