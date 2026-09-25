import { clamp } from '../utils/math'
import type { Rng } from '../utils/rng'
import { range } from '../utils/rng'

export type AnimName = 'idle' | 'walk' | 'jump' | 'talk'
export type AvatarStateName =
  | 'entering'
  | 'idle'
  | 'wander'
  | 'talk'
  | 'jump'
  | 'leaving'
  | 'gone'

export interface StripBounds {
  minX: number
  maxX: number
}

export interface MachineOptions {
  bounds: StripBounds
  walkSpeed: number
  bubbleDurationMs: number
  rng: Rng
}

export interface Snapshot {
  x: number
  /** Negative while airborne; applied to the sprite group, not the label. */
  jumpOffsetY: number
  anim: AnimName
  facing: 1 | -1
  state: AvatarStateName
}

const OFFSCREEN_MARGIN = 60
const WALL_MARGIN = 40
const IDLE_SECS: [number, number] = [2, 6]
const WANDER_SECS: [number, number] = [1, 4]
const JUMP_DURATION = 0.7
/** Peak of the jump parabola in stage px (magnitude of the lowest jumpOffsetY). */
export const JUMP_HEIGHT = 56

interface ResumeState {
  state: 'entering' | 'idle' | 'wander' | 'talk'
  timer: number
  dir: 1 | -1
}

/**
 * Pure per-avatar behavior. No Pixi, no DOM; the renderer applies the
 * Snapshot each frame. External inputs: onMessage, onJump, beginLeave.
 *
 *   entering -> idle <-> wander
 *   idle/wander --message--> talk --timer--> idle
 *   any non-leaving --!jump--> jump (parabola) --> previous state
 *   idle timeout / eviction --> leaving --> gone (manager destroys)
 */
export class AvatarStateMachine {
  private opts: MachineOptions
  private rng: Rng

  private stateName: AvatarStateName = 'entering'
  private x: number
  private facing: 1 | -1
  private timer = 0
  private dir: 1 | -1 = 1
  private targetX: number
  private jumpT = 0
  private resume: ResumeState | null = null

  constructor(opts: MachineOptions) {
    this.opts = opts
    this.rng = opts.rng
    const { minX, maxX } = opts.bounds
    const fromLeft = this.rng() < 0.5
    this.x = fromLeft ? minX - OFFSCREEN_MARGIN : maxX + OFFSCREEN_MARGIN
    this.targetX = range(this.rng, minX + WALL_MARGIN, maxX - WALL_MARGIN)
    this.facing = fromLeft ? 1 : -1
  }

  get state(): AvatarStateName {
    return this.stateName
  }

  onMessage(): void {
    if (this.stateName === 'idle' || this.stateName === 'wander') {
      this.stateName = 'talk'
      this.timer = this.opts.bubbleDurationMs / 1000
    } else if (this.stateName === 'talk') {
      this.timer = this.opts.bubbleDurationMs / 1000
    }
    // entering/jump/leaving: the bubble still shows, movement is not interrupted
  }

  onJump(): void {
    if (
      this.stateName === 'jump' ||
      this.stateName === 'leaving' ||
      this.stateName === 'gone'
    ) {
      return
    }
    this.resume = {
      state: this.stateName as ResumeState['state'],
      timer: this.timer,
      dir: this.dir,
    }
    this.stateName = 'jump'
    this.jumpT = 0
  }

  beginLeave(): void {
    if (this.stateName === 'leaving' || this.stateName === 'gone') return
    const { minX, maxX } = this.opts.bounds
    const mid = (minX + maxX) / 2
    this.targetX = this.x < mid ? minX - OFFSCREEN_MARGIN : maxX + OFFSCREEN_MARGIN
    this.dir = this.x < mid ? -1 : 1
    this.facing = this.dir
    this.stateName = 'leaving'
    this.resume = null
  }

  update(dtSec: number): Snapshot {
    const { minX, maxX } = this.opts.bounds
    const speed = this.opts.walkSpeed
    let jumpOffsetY = 0

    switch (this.stateName) {
      case 'entering': {
        this.moveToward(this.targetX, speed * 1.2, dtSec)
        if (this.x === this.targetX) this.enterIdle()
        break
      }
      case 'idle': {
        this.timer -= dtSec
        if (this.timer <= 0) this.enterWander()
        break
      }
      case 'wander': {
        this.timer -= dtSec
        this.x += this.dir * speed * dtSec
        this.facing = this.dir
        if (this.x <= minX + WALL_MARGIN || this.x >= maxX - WALL_MARGIN) {
          this.x = clamp(this.x, minX + WALL_MARGIN, maxX - WALL_MARGIN)
          this.enterIdle()
        } else if (this.timer <= 0) {
          this.enterIdle()
        }
        break
      }
      case 'talk': {
        this.timer -= dtSec
        if (this.timer <= 0) this.enterIdle()
        break
      }
      case 'jump': {
        this.jumpT += dtSec
        const t = Math.min(1, this.jumpT / JUMP_DURATION)
        jumpOffsetY = -JUMP_HEIGHT * 4 * t * (1 - t)
        // keep horizontal momentum when the jump interrupted a walk
        if (this.resume?.state === 'wander' || this.resume?.state === 'entering') {
          this.x += this.dir * speed * dtSec
          this.x = clamp(this.x, minX + WALL_MARGIN, maxX - WALL_MARGIN)
        }
        if (t >= 1) {
          const resume = this.resume
          this.resume = null
          if (resume && resume.state !== 'entering') {
            this.stateName = resume.state
            this.timer = resume.timer
            this.dir = resume.dir
          } else {
            this.enterIdle()
          }
        }
        break
      }
      case 'leaving': {
        this.x += this.dir * speed * 1.2 * dtSec
        this.facing = this.dir
        if (this.x <= minX - OFFSCREEN_MARGIN || this.x >= maxX + OFFSCREEN_MARGIN) {
          this.stateName = 'gone'
        }
        break
      }
      case 'gone':
        break
    }

    return {
      x: this.x,
      jumpOffsetY,
      anim: this.animFor(),
      facing: this.facing,
      state: this.stateName,
    }
  }

  private moveToward(target: number, speed: number, dtSec: number): void {
    const delta = target - this.x
    const step = speed * dtSec
    if (Math.abs(delta) <= step) {
      this.x = target
    } else {
      this.x += Math.sign(delta) * step
      this.facing = delta > 0 ? 1 : -1
    }
  }

  private enterIdle(): void {
    this.stateName = 'idle'
    this.timer = range(this.rng, IDLE_SECS[0], IDLE_SECS[1])
  }

  private enterWander(): void {
    this.stateName = 'wander'
    this.dir = this.rng() < 0.5 ? -1 : 1
    this.timer = range(this.rng, WANDER_SECS[0], WANDER_SECS[1])
  }

  private animFor(): AnimName {
    switch (this.stateName) {
      case 'entering':
      case 'wander':
      case 'leaving':
        return 'walk'
      case 'talk':
        return 'talk'
      case 'jump':
        return 'jump'
      default:
        return 'idle'
    }
  }
}
