import type { ChatCommandEvent, ChatMessageEvent } from '../chat/types'

/**
 * ?debug=grid: synthesizes traffic from 25 fake chatters so spawn density,
 * eviction, and frame rate can be checked without a live channel.
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

export function startFakeChat(
  onMessage: (e: ChatMessageEvent) => void,
  onCommand: (e: ChatCommandEvent) => void,
): () => void {
  let counter = 0
  const interval = window.setInterval(() => {
    counter++
    const login = FAKE_LOGINS[Math.floor(Math.random() * FAKE_LOGINS.length)] ?? 'fallback'
    const message: ChatMessageEvent = {
      login,
      displayName: login,
      color: COLORS[Math.floor(Math.random() * COLORS.length)] ?? null,
      text: FAKE_LINES[Math.floor(Math.random() * FAKE_LINES.length)] ?? 'hi',
      emotes: [],
      messageId: `fake-${counter}`,
      timestamp: Date.now(),
      tags: {},
    }
    if (Math.random() < 0.15) {
      onCommand({ name: 'jump', args: [], message })
    } else {
      onMessage(message)
    }
  }, 400)
  return () => window.clearInterval(interval)
}
