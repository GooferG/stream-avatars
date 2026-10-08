import { clamp } from '../utils/math'
import type { AvatarStateName } from './stateMachine'

/** Once a character stops being active, its name plate fades out over this long. */
export const NAME_FADE_MS = 300

/**
 * Whether a character is doing something viewers should see a name for:
 * speaking (a bubble is up), jumping, emoting or in an interaction. Idle
 * names stay hidden so a busy chat doesn't fill the screen with names; crowd
 * reactions don't count, or every name would light up at once.
 */
export function showsName(state: AvatarStateName, talking: boolean): boolean {
  return talking || state === 'jump' || state === 'emote' || state === 'scripted'
}

/** Name plate opacity `msSinceActive` after the character was last active (0 while active); null if never active. */
export function namePlateAlpha(msSinceActive: number | null): number {
  if (msSinceActive === null) return 0
  return clamp(1 - msSinceActive / NAME_FADE_MS, 0, 1)
}
