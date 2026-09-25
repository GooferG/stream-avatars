import type { AnimName } from './contract'

/** Arm pose for the whole character; each art module maps it to a shape per side. */
export type Arms = 'down' | 'swingA' | 'swingB' | 'mid' | 'up' | 'limp'
export type Face = 'normal' | 'talk' | 'happy' | 'grin' | 'sad'

export interface Pose {
  /** Whole-character vertical offset in frame px (negative = up). Never below 0: feet stay on the ground. */
  dy: number
  /** Upper body (head, torso, arms) sinks by this many px: crouch or slump. Legs stay put. */
  squash: number
  /** 0 = feet together, 1 = left foot lifted, 2 = right foot lifted. */
  leg: number
  arms: Arms
  face: Face
}

export function pose(
  dy = 0,
  squash = 0,
  extra: Partial<Pick<Pose, 'leg' | 'arms' | 'face'>> = {},
): Pose {
  return { dy, squash, leg: 0, arms: 'down', face: 'normal', ...extra }
}

/** One table for every character: humans and animals are both chibi bipeds. */
export const POSES: Record<AnimName, Pose[]> = {
  idle: [pose(0), pose(-1), pose(-1), pose(0)],
  walk: [
    pose(0, 0, { leg: 1, arms: 'swingA' }),
    pose(-1),
    pose(0, 0, { leg: 2, arms: 'swingB' }),
    pose(0, 0, { leg: 1, arms: 'swingA' }),
    pose(-1),
    pose(0, 0, { leg: 2, arms: 'swingB' }),
  ],
  jump: [
    pose(0, 3),
    pose(-2, 0, { arms: 'mid' }),
    pose(-4, 0, { arms: 'up' }),
    pose(-4, 0, { arms: 'up' }),
    pose(-2, 0, { arms: 'mid' }),
    pose(0, 3),
  ],
  // arms stay down: a hand pumping at waist height reads badly on stream
  talk: [pose(0), pose(0, 0, { face: 'talk' }), pose(0), pose(0, 0, { face: 'talk' })],
  cheer: [
    pose(0, 0, { arms: 'mid', face: 'happy' }),
    pose(-2, 0, { arms: 'up', face: 'grin' }),
    pose(-3, 0, { arms: 'up', face: 'grin' }),
    pose(-1, 0, { arms: 'mid', face: 'happy' }),
  ],
  sad: [
    pose(0, 2, { arms: 'limp', face: 'sad' }),
    pose(0, 2, { arms: 'limp', face: 'sad' }),
    pose(0, 3, { arms: 'limp', face: 'sad' }),
    pose(0, 3, { arms: 'limp', face: 'sad' }),
  ],
}
