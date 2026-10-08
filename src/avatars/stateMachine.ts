import type { Mood } from '../chat/mood'
import type { AnimName } from '../render/sprites/contract'
import { clamp } from '../utils/math'
import type { Rng } from '../utils/rng'
import { range } from '../utils/rng'

export type AvatarStateName =
  | 'entering'
  | 'idle'
  | 'wander'
  | 'talk'
  | 'jump'
  | 'react'
  | 'sit'
  | 'emote'
  | 'scripted'
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
  /** The anim of an emote that began on this update, else null: when to cue its effects. */
  emoteStarted: AnimName | null
  /** A fight's dust cloud hides the character, its shadow and its name plate. */
  hidden: boolean
  /** Multiplies the row's fps: running to meet someone plays the walk at double speed. */
  animSpeed: number
}

const OFFSCREEN_MARGIN = 60
/** Characters keep this far from the stage edges (the choreographer uses it too). */
export const WALL_MARGIN = 40
const IDLE_SECS: [number, number] = [2, 6]
const WANDER_SECS: [number, number] = [1, 4]
const JUMP_DURATION = 0.7
/** Peak of the jump parabola in stage px (magnitude of the lowest jumpOffsetY). */
export const JUMP_HEIGHT = 56

interface ResumeState {
  state: 'entering' | 'idle' | 'wander' | 'talk' | 'react'
  timer: number
  dir: 1 | -1
}

export interface EmoteOptions {
  /** Waits this long before starting (the !sesh ripple). */
  delaySec?: number
  /** Turns around this often while it plays. */
  turnEverySec?: number
}

interface EmotePlan {
  anim: AnimName
  duration: number
  turnEverySec: number
  /** Seconds still to wait before it starts. */
  delay: number
}

/** What a choreographer told a scripted character to do. */
type ScriptStep = { kind: 'run'; x: number; speed: number } | { kind: 'hold'; anim: AnimName }

/**
 * Pure per-avatar behavior. No Pixi, no DOM; the renderer applies the
 * Snapshot each frame. External inputs: onMessage, onJump, onReact, onLurk,
 * onUnlurk, beginLeave.
 *
 *   entering -> idle <-> wander
 *   idle/wander --message--> talk --timer--> idle
 *   idle/wander/talk --reaction (after optional delay)--> react --timer--> idle
 *   any non-leaving --!jump--> jump (parabola) --> previous state
 *   idle/wander/talk --!lurk--> sit (entering/jump/react: sit once they end)
 *   sit --message--> talk, --!jump--> jump --> idle, --!unlurk--> idle
 *   idle/wander/talk/react/sit --emote--> emote --timer--> idle (or sit when !lurk waits)
 *   entering --emote--> emote once it arrives
 *   any but leaving --beginScript--> scripted (a choreographer runs it) --endScript--> idle (or sit)
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
  private reactMood: Mood = 'cheer'
  /** A crowd reaction waiting out its ripple delay. */
  private pending: { mood: Mood; duration: number; delay: number } | null = null
  /** `!lurk` came mid walk-in, jump or reaction: sit once that ends. */
  private sitPending = false
  /** The emote playing now (state 'emote'). */
  private emote: EmotePlan | null = null
  /** An emote waiting for the walk-in to end, or for its delay. */
  private pendingEmote: EmotePlan | null = null
  private turnTimer = 0
  private emoteStarted: AnimName | null = null
  private scriptStep: ScriptStep = { kind: 'hold', anim: 'idle' }
  private hidden = false

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
    this.sitPending = false // chatting is coming back
    if (this.stateName === 'idle' || this.stateName === 'wander' || this.stateName === 'sit') {
      this.stateName = 'talk'
      this.timer = this.opts.bubbleDurationMs / 1000
    } else if (this.stateName === 'talk') {
      this.timer = this.opts.bubbleDurationMs / 1000
    }
    // entering/jump/leaving: the bubble still shows, movement is not interrupted
  }

  onJump(): void {
    if (this.stateName === 'leaving' || this.stateName === 'gone' || this.stateName === 'scripted') return
    this.sitPending = false // jumping is coming back, even mid-jump
    if (this.stateName === 'jump') return
    // a seated lurker stands up for the jump and lands on its feet; a jump ends an emote
    this.resume =
      this.stateName === 'sit' || this.stateName === 'emote'
        ? { state: 'idle', timer: range(this.rng, IDLE_SECS[0], IDLE_SECS[1]), dir: this.dir }
        : { state: this.stateName as ResumeState['state'], timer: this.timer, dir: this.dir }
    this.emote = null
    this.stateName = 'jump'
    this.jumpT = 0
  }

  /** `!lurk`: sit down where it stands, or once a walk-in, jump or reaction ends. */
  onLurk(): void {
    switch (this.stateName) {
      case 'idle':
      case 'wander':
      case 'talk':
        this.enterSit()
        break
      case 'entering':
      case 'jump':
      case 'react':
      case 'emote':
      case 'scripted':
        this.sitPending = true
        this.pending = null // lurkers don't join crowd reactions
        break
      default:
        break // already seated, or on the way out
    }
  }

  /** `!unlurk`: stand back up (or don't sit after all). */
  onUnlurk(): void {
    this.sitPending = false
    if (this.stateName === 'sit') this.enterIdle()
  }

  /**
   * A solo emote for durationSec. Plays from idle, wander, talk, react and
   * sit (standing up); waits for a walk-in to finish, or for opts.delaySec.
   * False, and nothing changes, while jumping, leaving or already emoting.
   */
  onEmote(anim: AnimName, durationSec: number, opts: EmoteOptions = {}): boolean {
    const plan: EmotePlan = {
      anim,
      duration: durationSec,
      turnEverySec: opts.turnEverySec ?? 0,
      delay: opts.delaySec ?? 0,
    }
    if (this.stateName === 'entering') {
      this.pendingEmote = plan
      return true
    }
    if (!this.canEmote()) return false
    if (plan.delay > 0) this.pendingEmote = plan
    else this.startEmote(plan)
    return true
  }

  private canEmote(): boolean {
    return (
      this.stateName === 'idle' ||
      this.stateName === 'wander' ||
      this.stateName === 'talk' ||
      this.stateName === 'react' ||
      this.stateName === 'sit'
    )
  }

  private startEmote(plan: EmotePlan): void {
    this.stateName = 'emote'
    this.emote = plan
    this.timer = plan.duration
    this.turnTimer = plan.turnEverySec
    this.pending = null // a rippling crowd reaction never cuts it short
    this.emoteStarted = plan.anim
  }

  /** Counts down a delayed emote once the walk-in is over; it starts if the character still can. */
  private tickPendingEmote(dtSec: number): void {
    const plan = this.pendingEmote
    if (!plan || this.stateName === 'entering') return
    plan.delay -= dtSec
    if (plan.delay > 0) return
    this.pendingEmote = null
    if (this.canEmote()) this.startEmote(plan)
  }

  /** Where the character stands and which way it faces. */
  where(): { x: number; facing: 1 | -1 } {
    return { x: this.x, facing: this.facing }
  }

  /**
   * Hands the character to a choreographer: it stands still until told to
   * run, face, play or hide. A pending emote or reaction is dropped; a
   * `!lurk` that comes in still sits it once released. False while walking off.
   */
  beginScript(): boolean {
    if (this.stateName === 'leaving' || this.stateName === 'gone') return false
    this.stateName = 'scripted'
    this.scriptStep = { kind: 'hold', anim: 'idle' }
    this.hidden = false
    this.resume = null
    this.pending = null
    this.emote = null
    this.pendingEmote = null
    return true
  }

  /** Scripted: run to x at `speed` px/s, facing the way it runs; it stands there once it arrives. */
  runTo(x: number, speed: number): void {
    if (this.stateName === 'scripted') this.scriptStep = { kind: 'run', x, speed }
  }

  face(dir: 1 | -1): void {
    if (this.stateName === 'scripted') this.facing = dir
  }

  /** Scripted: stand still showing `anim` until told otherwise. */
  play(anim: AnimName): void {
    if (this.stateName === 'scripted') this.scriptStep = { kind: 'hold', anim }
  }

  setHidden(hidden: boolean): void {
    if (this.stateName === 'scripted') this.hidden = hidden
  }

  /** Hands the character back: idle, or seated if `!lurk` came in meanwhile. */
  endScript(): void {
    if (this.stateName !== 'scripted') return
    this.hidden = false
    this.settle()
  }

  /** Cheer/sad for durationSec, optionally after delaySec (the crowd ripple). */
  onReact(mood: Mood, durationSec: number, delaySec = 0): void {
    if (!this.canReact() || this.sitPending) return
    if (delaySec > 0) {
      this.pending = { mood, duration: durationSec, delay: delaySec }
      return
    }
    this.startReact(mood, durationSec)
  }

  /** Walking in or out, and mid-jump, carry on; everything else can react. */
  private canReact(): boolean {
    return (
      this.stateName === 'idle' ||
      this.stateName === 'wander' ||
      this.stateName === 'talk' ||
      this.stateName === 'react'
    )
  }

  private startReact(mood: Mood, durationSec: number): void {
    this.stateName = 'react'
    this.reactMood = mood
    this.timer = durationSec
  }

  private tickPending(dtSec: number): void {
    if (!this.pending) return
    this.pending.delay -= dtSec
    if (this.pending.delay > 0) return
    const { mood, duration } = this.pending
    this.pending = null
    if (this.canReact() && !this.sitPending) this.startReact(mood, duration)
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
    this.pending = null
    this.emote = null
    this.pendingEmote = null
    this.sitPending = false
    this.hidden = false
  }

  update(dtSec: number): Snapshot {
    const { minX, maxX } = this.opts.bounds
    const speed = this.opts.walkSpeed
    let jumpOffsetY = 0

    this.tickPending(dtSec)
    this.tickPendingEmote(dtSec)
    switch (this.stateName) {
      case 'entering': {
        this.moveToward(this.targetX, speed * 1.2, dtSec)
        if (this.x === this.targetX) this.settle()
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
      case 'talk':
      case 'react': {
        this.timer -= dtSec
        if (this.timer <= 0) this.settle()
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
          if (this.sitPending) {
            this.resume = null
            this.enterSit()
            break
          }
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
      case 'emote': {
        this.timer -= dtSec
        const turn = this.emote?.turnEverySec ?? 0
        if (turn > 0) {
          this.turnTimer -= dtSec
          if (this.turnTimer <= 0) {
            this.facing = this.facing === 1 ? -1 : 1
            this.turnTimer += turn
          }
        }
        if (this.timer <= 0) {
          this.emote = null
          this.settle()
        }
        break
      }
      case 'scripted': {
        const step = this.scriptStep
        if (step.kind === 'run') {
          this.moveToward(step.x, step.speed, dtSec)
          if (this.x === step.x) this.scriptStep = { kind: 'hold', anim: 'idle' }
        }
        break
      }
      case 'sit':
        break // seated: the manager decides when the lurk ends
      case 'gone':
        break
    }

    const emoteStarted = this.emoteStarted
    this.emoteStarted = null
    return {
      x: this.x,
      jumpOffsetY,
      anim: this.animFor(),
      facing: this.facing,
      state: this.stateName,
      emoteStarted,
      hidden: this.stateName === 'scripted' && this.hidden,
      animSpeed: this.stateName === 'scripted' && this.scriptStep.kind === 'run' ? 2 : 1,
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

  /** Where a walk-in, talk, reaction, emote or jump ends up: a waiting emote, the seat if `!lurk` waits, or idle. */
  private settle(): void {
    const plan = this.pendingEmote
    if (plan && plan.delay <= 0) {
      this.pendingEmote = null
      this.startEmote(plan)
    } else if (this.sitPending) {
      this.enterSit()
    } else {
      this.enterIdle()
    }
  }

  private enterSit(): void {
    this.stateName = 'sit'
    this.sitPending = false
    this.pending = null // a crowd ripple waiting to fire never reaches a lurker
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
      case 'react':
        return this.reactMood
      case 'sit':
        return 'sit'
      case 'emote':
        return this.emote?.anim ?? 'idle'
      case 'scripted':
        return this.scriptStep.kind === 'run' ? 'walk' : this.scriptStep.anim
      default:
        return 'idle'
    }
  }
}
