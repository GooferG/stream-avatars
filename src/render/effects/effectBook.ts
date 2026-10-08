import { EFFECTS } from './effectArt'
import { effectAt, effectDone, type EffectCue, type EffectPose } from './effectMotion'

/** An effect on screen: its cue, when (book clock, ms) and where it was cued, and what draws it. */
export interface Showing<T> {
  cue: EffectCue
  at: number
  /** The ground line its rise counts up from, stage px. */
  groundY: number
  item: T
}

interface Waiting {
  cue: EffectCue
  at: number
  groundY: number
}

/**
 * The bookkeeping behind the effect layer, free of Pixi. Effects age by the
 * time the book is advanced (the same clamped frame time the interactions
 * run on), so a long frame never ends a fight cloud before its poof. A
 * delayed cue holds nothing while it waits; at most `cap` effects show at
 * once, and when one more is due, the showing effect closest to its end
 * makes room, so a fading puff goes before a fresh cloud.
 */
export class EffectBook<T> {
  private cap: number
  private clock = 0
  private waiting: Waiting[] = []
  private showing: Showing<T>[] = []

  constructor(cap: number) {
    this.cap = cap
  }

  get showingCount(): number {
    return this.showing.length
  }

  get waitingCount(): number {
    return this.waiting.length
  }

  /** Cues an effect now; it shows once its delay is over. */
  add(cue: EffectCue, groundY: number): void {
    this.waiting.push({ cue, at: this.clock, groundY })
  }

  /**
   * Advances by dtMs: starts the cues whose delay is over (acquire gives each
   * one its drawable), ends the finished ones (release takes it back), and
   * calls show for every effect on screen with where it is now.
   */
  advance(
    dtMs: number,
    acquire: () => T,
    release: (item: T) => void,
    show: (effect: Showing<T>, pose: EffectPose) => void,
  ): void {
    this.clock += dtMs
    for (let i = 0; i < this.waiting.length; ) {
      const w = this.waiting[i]
      if (!w || this.clock - w.at < (w.cue.delayMs ?? 0)) {
        i++
        continue
      }
      this.waiting.splice(i, 1)
      if (this.showing.length >= this.cap) this.endClosestToItsEnd(release)
      this.showing.push({ ...w, item: acquire() })
    }
    for (let i = this.showing.length - 1; i >= 0; i--) {
      const fx = this.showing[i]
      if (!fx) continue
      const age = this.clock - fx.at
      if (effectDone(fx.cue, age)) {
        release(fx.item)
        this.showing.splice(i, 1)
        continue
      }
      const pose = effectAt(fx.cue, age)
      if (pose) show(fx, pose)
    }
  }

  /** Drops every effect, giving back what each one holds. */
  clear(release: (item: T) => void): void {
    for (const fx of this.showing) release(fx.item)
    this.showing = []
    this.waiting = []
  }

  private endClosestToItsEnd(release: (item: T) => void): void {
    let pick = -1
    let least = Number.POSITIVE_INFINITY
    this.showing.forEach((fx, i) => {
      const left = (fx.cue.delayMs ?? 0) + (fx.cue.lifeMs ?? EFFECTS[fx.cue.name].lifeMs) - (this.clock - fx.at)
      if (left < least) {
        least = left
        pick = i
      }
    })
    const [gone] = this.showing.splice(pick, 1)
    if (gone) release(gone.item)
  }
}
