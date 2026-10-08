import { WALL_MARGIN, type StripBounds } from '../avatars/stateMachine'
import type { EffectName } from '../render/effects/effectArt'
import type { EffectCue } from '../render/effects/effectMotion'
import { ANIMATIONS, type AnimName } from '../render/sprites/contract'
import type { PairKind } from './gate'

/** How far apart the two stand, between their centers, in frame px (times spriteScale on stage). */
export const GAPS: Record<PairKind, number> = { highfive: 28, hug: 16, fight: 12 }
/** Both run to the meeting point this fast, stage px per second. */
export const RUN_SPEED = 180
/** If they haven't both arrived by then, the interaction starts wherever they are. */
export const ARRIVE_TIMEOUT_SEC = 8

/** The slap is frame 3 of the high-five row. */
const SLAP_SEC = 2 / ANIMATIONS.highfive.fps
const HIGHFIVE_SEC = 1.2
const CHEER_SEC = 0.8
const HUG_SEC = 2.5
const HEART_SECS = [0.3, 0.9, 1.5]
const BRAWL_SEC = 3
const POKE_EVERY_SEC = 0.25
const RESULT_SEC = 3
const POKES: readonly EffectName[] = ['fist', 'shoe', 'star']
const PUFFS = 6
const PUFF_SPEED = 40
/** Effect heights above the ground, frame px. */
const HAND_RISE = 30
const HEART_RISE = 34
const CLOUD_RISE = 24
const HEAD_TOP_RISE = 46
/** Pokes pop out on this ellipse round the cloud's middle, frame px. */
const CLOUD_RX = 34
const CLOUD_RY = 18
const STAR_ORBIT = 8

export type ActorStep =
  | { type: 'run'; x: number }
  | { type: 'face'; dir: 1 | -1 }
  | { type: 'play'; anim: AnimName }
  | { type: 'hide'; hidden: boolean }

export interface TickOutput {
  steps: { login: string; step: ActorStep }[]
  cues: EffectCue[]
  /** A fight's result, on the tick it is decided. */
  result: { winner: string; loser: string } | null
}

export interface InteractionOptions {
  kind: PairKind
  /** Who started it (the challenger, in a fight). */
  a: string
  b: string
  xa: number
  xb: number
  scale: number
  bounds: StripBounds
  /** Picks the fight's winner and where the brawl's pokes appear. */
  rng: () => number
}

/** Where the two stand: halfway between them, kept off the walls, whoever is further left on the left. */
export function meetingSpots(
  xa: number,
  xb: number,
  kind: PairKind,
  scale: number,
  bounds: StripBounds,
): { a: number; b: number } {
  const half = (GAPS[kind] * scale) / 2
  const lo = bounds.minX + WALL_MARGIN + half
  const hi = bounds.maxX - WALL_MARGIN - half
  const mid = Math.min(hi, Math.max(lo, (xa + xb) / 2))
  return xa <= xb ? { a: mid - half, b: mid + half } : { a: mid + half, b: mid - half }
}

/**
 * One high-five, hug or fight between two characters, as a pure timeline:
 * both run to their spots (the first to arrive waits, facing the other),
 * then the interaction plays out beat by beat. Each tick returns the steps
 * for both characters, the effects to show, and a fight's result.
 */
export class Interaction {
  readonly kind: PairKind
  readonly a: string
  readonly b: string
  private spots: { a: number; b: number }
  private scale: number
  private rng: () => number
  private phase: 'approach' | 'perform' | 'done' = 'approach'
  private started = false
  /** Seconds in the current phase. */
  private t = 0
  private arrived = new Set<string>()
  /** One-shot beats already played, by name. */
  private fired = new Set<string>()
  private nextPoke = 0

  constructor(o: InteractionOptions) {
    this.kind = o.kind
    this.a = o.a
    this.b = o.b
    this.scale = o.scale
    this.rng = o.rng
    this.spots = meetingSpots(o.xa, o.xb, o.kind, o.scale, o.bounds)
  }

  get done(): boolean {
    return this.phase === 'done'
  }

  get logins(): readonly [string, string] {
    return [this.a, this.b]
  }

  /** Advances by dtSec; `xOf` reads where a participant stands now. */
  tick(dtSec: number, xOf: (login: string) => number): TickOutput {
    const out: TickOutput = { steps: [], cues: [], result: null }
    if (this.phase === 'approach') this.approach(dtSec, xOf, out)
    else if (this.phase === 'perform') this.perform(dtSec, out)
    return out
  }

  private approach(dtSec: number, xOf: (login: string) => number, out: TickOutput): void {
    if (!this.started) {
      this.started = true
      out.steps.push(
        { login: this.a, step: { type: 'run', x: this.spots.a } },
        { login: this.b, step: { type: 'run', x: this.spots.b } },
      )
      return
    }
    this.t += dtSec
    for (const login of this.logins) {
      if (this.arrived.has(login) || Math.abs(xOf(login) - this.spotOf(login)) >= 0.5) continue
      this.arrived.add(login)
      out.steps.push({ login, step: { type: 'face', dir: this.facing(login) } }) // waits facing the other
    }
    if (this.arrived.size === 2 || this.t >= ARRIVE_TIMEOUT_SEC) {
      this.phase = 'perform'
      this.t = 0
      this.perform(0, out) // the first beat plays on this tick
    }
  }

  private perform(dtSec: number, out: TickOutput): void {
    this.t += dtSec
    const mid = (this.spots.a + this.spots.b) / 2
    const both = (step: ActorStep) => out.steps.push({ login: this.a, step }, { login: this.b, step })
    if (this.due('face', 0)) {
      for (const login of this.logins) out.steps.push({ login, step: { type: 'face', dir: this.facing(login) } })
    }
    switch (this.kind) {
      case 'highfive':
        if (this.due('raise', 0)) both({ type: 'play', anim: 'highfive' })
        if (this.due('slap', SLAP_SEC)) out.cues.push({ name: 'spark', x: mid, rise: HAND_RISE })
        if (this.due('cheer', HIGHFIVE_SEC)) both({ type: 'play', anim: 'cheer' })
        if (this.t >= HIGHFIVE_SEC + CHEER_SEC) this.phase = 'done'
        break
      case 'hug':
        if (this.due('hug', 0)) both({ type: 'play', anim: 'hug' })
        HEART_SECS.forEach((sec, i) => {
          if (this.due(`heart${i}`, sec)) out.cues.push({ name: 'heart', x: mid, rise: HEART_RISE })
        })
        if (this.t >= HUG_SEC) this.phase = 'done'
        break
      case 'fight':
        this.fight(mid, out, both)
        break
    }
  }

  private fight(mid: number, out: TickOutput, both: (step: ActorStep) => void): void {
    if (this.due('brawl', 0)) {
      both({ type: 'hide', hidden: true })
      out.cues.push({ name: 'cloud', x: mid, rise: CLOUD_RISE, lifeMs: BRAWL_SEC * 1000 })
    }
    while (this.t < BRAWL_SEC && this.nextPoke <= this.t) {
      const angle = this.rng() * Math.PI * 2
      const name = POKES[Math.floor(this.rng() * POKES.length)] ?? 'star'
      out.cues.push({
        name,
        x: mid + Math.cos(angle) * CLOUD_RX * this.scale,
        rise: CLOUD_RISE - Math.sin(angle) * CLOUD_RY,
      })
      this.nextPoke += POKE_EVERY_SEC
    }
    if (this.due('poof', BRAWL_SEC)) {
      both({ type: 'hide', hidden: false })
      for (let i = 0; i < PUFFS; i++) {
        const angle = (i / PUFFS) * Math.PI * 2
        out.cues.push({
          name: 'puff',
          x: mid,
          rise: CLOUD_RISE,
          vx: Math.cos(angle) * PUFF_SPEED,
          vy: Math.sin(angle) * PUFF_SPEED,
        })
      }
      const aWins = this.rng() < 0.5
      const winner = aWins ? this.a : this.b
      const loser = aWins ? this.b : this.a
      out.steps.push(
        { login: winner, step: { type: 'play', anim: 'cheer' } },
        { login: loser, step: { type: 'play', anim: 'dizzy' } },
      )
      for (let i = 0; i < 3; i++) {
        out.cues.push({
          name: 'tinyStar',
          x: this.spotOf(loser),
          rise: HEAD_TOP_RISE,
          lifeMs: RESULT_SEC * 1000,
          orbit: { radius: STAR_ORBIT, phase: (i / 3) * Math.PI * 2 },
        })
      }
      out.result = { winner, loser }
    }
    if (this.t >= BRAWL_SEC + RESULT_SEC) this.phase = 'done'
  }

  /** True once, the first tick at or after `sec` into the performance. */
  private due(beat: string, sec: number): boolean {
    if (this.t < sec || this.fired.has(beat)) return false
    this.fired.add(beat)
    return true
  }

  private spotOf(login: string): number {
    return login === this.a ? this.spots.a : this.spots.b
  }

  /** Toward the other one's spot. */
  private facing(login: string): 1 | -1 {
    const other = login === this.a ? this.b : this.a
    return this.spotOf(login) <= this.spotOf(other) ? 1 : -1
  }
}
