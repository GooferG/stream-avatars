import type { EffectCue } from '../render/effects/effectMotion'
import type { AnimName } from '../render/sprites/contract'

export type EmoteName = 'clap' | 'wave' | 'dance' | 'smoke' | 'bong'

export interface EmoteSpec {
  anim: AnimName
  /** How long it plays. Infinity plays until stopped: the dance runs until `!dance` again, `!jump`, `!lurk` or another emote. */
  seconds: number
  /** Turns around this often while it plays (the dance). */
  turnEverySec?: number
}

/** The solo emotes; smoke and bong last exactly one pass of their play-once row. */
export const EMOTES: Record<EmoteName, EmoteSpec> = {
  clap: { anim: 'clap', seconds: 2 },
  wave: { anim: 'wave', seconds: 2 },
  dance: { anim: 'dance', seconds: Number.POSITIVE_INFINITY, turnEverySec: 0.5 },
  smoke: { anim: 'smoke', seconds: 4 },
  bong: { anim: 'bong', seconds: 4 },
}

/** `!sesh` starts everyone's smoke within this many seconds of each other. */
export const SESH_RIPPLE_SEC = 1.2
/** The mouth is this far in front of a character's center, in frame px. */
export const MOUTH_X = 3

/** `!smoke bong` smokes the bong; any other words after `!smoke` are ignored. */
export function smokeEmote(args: readonly string[]): 'smoke' | 'bong' {
  return args[0]?.toLowerCase() === 'bong' ? 'bong' : 'smoke'
}

export function isSmoke(name: EmoteName): name is 'smoke' | 'bong' {
  return name === 'smoke' || name === 'bong'
}

/** Smoke puffs for the exhale (the last two frames, from 2.7 s in), drifting the way the character faces. */
export function exhaleCues(emote: 'smoke' | 'bong', mouthX: number, facing: 1 | -1): EffectCue[] {
  const delays = emote === 'bong' ? [2_700, 2_850, 3_000, 3_150] : [2_700, 2_950, 3_200]
  return delays.map((delayMs) => ({ name: 'smoke', x: mouthX, rise: 25, delayMs, vx: facing * 6 }))
}
