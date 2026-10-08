import type { AnimName } from './contract'

/**
 * Arm pose for the whole character; each art module maps it to a shape per
 * side. "Front" is the facing side (the right of the frame).
 */
export type Arms =
  | 'down'
  | 'swingA'
  | 'swingB'
  | 'mid'
  | 'up'
  | 'limp'
  /** Front arm raised up and forward (the high-five); the other down. */
  | 'reachUp'
  /** Front arm out in front, the other across the chest. */
  | 'hug'
  /** Both hands together in front of the chest, or a little apart. */
  | 'clap'
  | 'clapOpen'
  /** Front arm up, tilted out or in; the other down. */
  | 'waveA'
  | 'waveB'
  /** Front hand at the mouth; the other down. */
  | 'toMouth'
  /** Both hands in front of the belly, holding something. */
  | 'holdFront'
export type Face = 'normal' | 'talk' | 'happy' | 'grin' | 'sad' | 'dizzy' | 'chill'
/** What the prop layer draws: a joint (its ember glowing on the inhale) or a bong (bubbling while in use). */
export type Prop = 'joint' | 'jointLit' | 'bong' | 'bongBubbles'

export interface Pose {
  /** Whole-character vertical offset in frame px (negative = up). Never below 0: feet stay on the ground. */
  dy: number
  /** Upper body (head, torso, arms) sinks by this many px: crouch or slump. Legs stay put. */
  squash: number
  /** 0 = feet together, 1 = left foot lifted, 2 = right foot lifted. */
  leg: number
  arms: Arms
  face: Face
  /**
   * Sitting on the ground, legs out in front. Each art module lowers the
   * upper body by its own seat drop on top of `squash` (a human's hips sit
   * higher than an animal's round body).
   */
  seated: boolean
  /** Whole-character sideways offset in frame px: the dizzy sway. */
  dx: number
  /** What the front hand holds, drawn by the prop layer; null for nothing. */
  prop: Prop | null
}

export function pose(
  dy = 0,
  squash = 0,
  extra: Partial<Pick<Pose, 'leg' | 'arms' | 'face' | 'seated' | 'dx' | 'prop'>> = {},
): Pose {
  return { dy, squash, leg: 0, arms: 'down', face: 'normal', seated: false, dx: 0, prop: null, ...extra }
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
  // lurking: seated, the upper body rising and falling a pixel as they breathe
  sit: [
    pose(0, 1, { seated: true }),
    pose(0, 1, { seated: true }),
    pose(0, 0, { seated: true }),
    pose(0, 0, { seated: true }),
  ],
  // wind up, then the front hand goes up and forward; the slap is frame 3
  highfive: [
    pose(0, 1, { face: 'happy' }),
    pose(-1, 0, { arms: 'reachUp', face: 'happy' }),
    pose(-2, 0, { arms: 'reachUp', face: 'grin' }),
    pose(-1, 0, { arms: 'reachUp', face: 'grin' }),
  ],
  hug: [
    pose(0, 0, { arms: 'hug', face: 'happy' }),
    pose(0, 1, { arms: 'hug', face: 'happy' }),
    pose(0, 1, { arms: 'hug', face: 'happy' }),
    pose(0, 0, { arms: 'hug', face: 'happy' }),
  ],
  clap: [
    pose(0, 0, { arms: 'clapOpen', face: 'happy' }),
    pose(-1, 0, { arms: 'clap', face: 'grin' }),
    pose(0, 0, { arms: 'clapOpen', face: 'happy' }),
    pose(-1, 0, { arms: 'clap', face: 'grin' }),
  ],
  wave: [
    pose(0, 0, { arms: 'waveA', face: 'happy' }),
    pose(0, 0, { arms: 'waveB', face: 'happy' }),
    pose(0, 0, { arms: 'waveA', face: 'happy' }),
    pose(0, 0, { arms: 'waveB', face: 'happy' }),
  ],
  dance: [
    pose(0, 0, { arms: 'up', leg: 1, face: 'grin' }),
    pose(-2, 0, { arms: 'mid', face: 'happy' }),
    pose(0, 1, { arms: 'swingA', leg: 2, face: 'grin' }),
    pose(0, 0, { arms: 'up', leg: 2, face: 'grin' }),
    pose(-2, 0, { arms: 'mid', face: 'happy' }),
    pose(0, 1, { arms: 'swingB', leg: 1, face: 'grin' }),
  ],
  // the fight's loser: slumped and swaying, stars circle overhead (an effect)
  dizzy: [
    pose(0, 2, { arms: 'limp', face: 'dizzy', dx: -1 }),
    pose(0, 2, { arms: 'limp', face: 'dizzy' }),
    pose(0, 2, { arms: 'limp', face: 'dizzy', dx: 1 }),
    pose(0, 2, { arms: 'limp', face: 'dizzy' }),
  ],
  // in hand, at the mouth, the ember glowing, then lowered and relaxed (the smoke puffs are an effect)
  smoke: [
    pose(0, 0, { prop: 'joint' }),
    pose(0, 0, { arms: 'toMouth', prop: 'joint' }),
    pose(0, 1, { arms: 'toMouth', prop: 'jointLit' }),
    pose(0, 0, { prop: 'joint', face: 'chill' }),
    pose(0, 0, { prop: 'joint', face: 'chill' }),
    pose(-1, 0, { prop: 'joint', face: 'chill' }),
  ],
  bong: [
    pose(0, 0, { arms: 'holdFront', prop: 'bong' }),
    pose(0, 1, { arms: 'holdFront', prop: 'bongBubbles' }),
    pose(0, 1, { arms: 'holdFront', prop: 'bongBubbles' }),
    pose(0, 0, { arms: 'holdFront', prop: 'bong', face: 'chill' }),
    pose(0, 0, { arms: 'holdFront', prop: 'bong', face: 'chill' }),
    pose(-1, 0, { arms: 'holdFront', prop: 'bong', face: 'chill' }),
  ],
}
