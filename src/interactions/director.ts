import type { AvatarStateMachine, StripBounds } from '../avatars/stateMachine'
import type { ChatCommandEvent, ChatMessageEvent } from '../chat/types'
import type { EffectCue } from '../render/effects/effectMotion'
import { ChallengeBook } from './challenges'
import { InteractionGate, refusalText, type PairKind } from './gate'
import type { InteractionStore } from './interactionStore'
import { findTarget, parseTarget } from './target'
import { Interaction, RUN_SPEED, type ActorStep } from './timeline'

/** A character on stage, as the director sees it. */
export interface StageCharacter {
  login: string
  displayName: string
  /** Name plate text: what bubbles call them. */
  labelText: string
  machine: AvatarStateMachine
  /** Ground line (feet), stage px. */
  groundY: number
}

/** What the director needs from the stage; the manager provides it. */
export interface DirectorView {
  /** Characters on stage and not walking off. */
  onScreen(): Iterable<StageCharacter>
  /** An on-screen character, or null. */
  find(login: string): StageCharacter | null
  /** The sender's character: walks it in if needed and stands up a lurker, like `!jump`. Null while it walks off. */
  sender(event: ChatMessageEvent, now: number): StageCharacter | null
  isLurking(login: string): boolean
  touch(login: string, now: number): void
  /** A speech bubble over an on-screen character. */
  say(login: string, text: string, now: number): void
  cue(cue: EffectCue, groundY: number): void
}

export interface DirectorOptions {
  view: DirectorView
  store: InteractionStore
  bounds: StripBounds
  spriteScale: number
  interactionCooldownMs: number
  targetCooldownMs: number
  challengeTimeoutMs: number
  /** Picks fight winners and brawl pokes. */
  rng?: () => number
}

/**
 * Runs `!highfive`, `!hug`, `!fight`, `!accept` and `!nointeract`: checks
 * the rules, keeps the cooldowns and the pending challenges, and drives both
 * characters' scripted mode from each interaction's timeline. Works only for
 * interactions in progress; an empty stage costs nothing per frame.
 */
export class InteractionDirector {
  private view: DirectorView
  private store: InteractionStore
  private bounds: StripBounds
  private scale: number
  private rng: () => number
  private gate: InteractionGate
  private challenges: ChallengeBook
  private active: Interaction[] = []

  constructor(o: DirectorOptions) {
    this.view = o.view
    this.store = o.store
    this.bounds = o.bounds
    this.scale = o.spriteScale
    this.rng = o.rng ?? Math.random
    this.gate = new InteractionGate(o.interactionCooldownMs, o.targetCooldownMs)
    this.challenges = new ChallengeBook(o.challengeTimeoutMs)
  }

  isBusy(login: string): boolean {
    return this.active.some((ia) => ia.a === login || ia.b === login)
  }

  /** `!highfive <name>`, `!hug <name>`, `!fight <name>`. */
  pair(kind: PairKind, command: ChatCommandEvent, now: number): void {
    const sender = this.view.sender(command.message, now)
    if (!sender) return
    const name = parseTarget(command.args)
    const target = name === null ? null : findTarget(name, this.view.onScreen())
    // fighting back accepts their challenge instead of sending a new one
    if (kind === 'fight' && target && this.challenges.take(target.login, sender.login, now)) {
      this.acceptFight(target, sender, now)
      return
    }
    const refusal = this.gate.check(
      {
        sender: sender.login,
        senderOptedOut: this.store.isOptedOut(sender.login),
        senderBusy: this.isBusy(sender.login),
        name,
        target: target && {
          login: target.login,
          lurking: this.view.isLurking(target.login),
          optedOut: this.store.isOptedOut(target.login),
          busy: this.isBusy(target.login),
        },
      },
      now,
    )
    if (refusal) {
      const text = refusalText(refusal, command.name, target?.labelText ?? name ?? '')
      if (text) this.view.say(sender.login, text, now)
      return
    }
    if (!target) return // the gate already refused a missing target
    this.gate.senderActed(sender.login, now)
    if (kind === 'fight') {
      this.challenges.challenge(sender.login, target.login, now)
      this.view.say(target.login, `${sender.labelText} wants to fight! !accept`, now)
      return
    }
    this.start(kind, sender, target, now)
  }

  /** `!accept`: the newest live challenge to the sender, if both are still free to fight. */
  accept(event: ChatMessageEvent, now: number): void {
    const accepter = this.view.find(event.login)
    if (!accepter) return
    const challenge = this.challenges.acceptNewest(accepter.login, now)
    if (!challenge) return
    const challenger = this.view.find(challenge.from)
    if (challenger) this.acceptFight(challenger, accepter, now)
  }

  /** `!nointeract` (true) and `!interact` (false). Opting out stops their interaction and drops their challenges. */
  setOptedOut(event: ChatMessageEvent, optedOut: boolean, now: number): void {
    this.store.setOptedOut(event.login, optedOut)
    if (optedOut) {
      this.challenges.dropFor(event.login)
      for (const ia of this.active.filter((x) => x.a === event.login || x.b === event.login)) this.finish(ia)
    }
    if (this.view.find(event.login)) this.view.say(event.login, optedOut ? 'interactions off' : 'interactions on', now)
  }

  update(dtSec: number, now: number): void {
    this.challenges.prune(now, (login) => this.view.find(login) !== null)
    for (let i = this.active.length - 1; i >= 0; i--) {
      const ia = this.active[i]
      if (!ia) continue
      const a = this.view.find(ia.a)
      const b = this.view.find(ia.b)
      // someone walked off (evicted, timed out, sent away): the other goes back to normal
      if (!a || !b || a.machine.state !== 'scripted' || b.machine.state !== 'scripted') {
        this.finish(ia)
        continue
      }
      const out = ia.tick(dtSec, (login) => (login === a.login ? a : b).machine.where().x)
      for (const { login, step } of out.steps) apply(login === a.login ? a : b, step)
      for (const cue of out.cues) this.view.cue(cue, a.groundY)
      if (out.result) {
        const winner = out.result.winner === a.login ? a : b
        const record = this.store.addResult(out.result.winner, out.result.loser)
        this.view.say(winner.login, `${winner.labelText} wins! (${record.wins}-${record.losses})`, now)
      }
      if (ia.done) this.finish(ia)
    }
  }

  /** Accepting skips the cooldowns but re-checks that both are still free to fight. */
  private acceptFight(challenger: StageCharacter, accepter: StageCharacter, now: number): void {
    for (const c of [challenger, accepter]) {
      if (this.view.isLurking(c.login) || this.store.isOptedOut(c.login) || this.isBusy(c.login)) return
    }
    this.start('fight', challenger, accepter, now)
  }

  private start(kind: PairKind, a: StageCharacter, b: StageCharacter, now: number): void {
    if (!a.machine.beginScript()) return
    if (!b.machine.beginScript()) {
      a.machine.endScript()
      return
    }
    this.gate.targeted([a.login, b.login], now)
    this.view.touch(a.login, now) // counts as activity: neither times out or is evicted first
    this.view.touch(b.login, now)
    this.active.push(
      new Interaction({
        kind,
        a: a.login,
        b: b.login,
        xa: a.machine.where().x,
        xb: b.machine.where().x,
        scale: this.scale,
        bounds: this.bounds,
        rng: this.rng,
      }),
    )
  }

  /** Hands both characters back to their normal behavior. */
  private finish(ia: Interaction): void {
    this.active = this.active.filter((x) => x !== ia)
    for (const login of ia.logins) this.view.find(login)?.machine.endScript()
  }
}

function apply(c: StageCharacter, step: ActorStep): void {
  switch (step.type) {
    case 'run':
      c.machine.runTo(step.x, RUN_SPEED)
      break
    case 'face':
      c.machine.face(step.dir)
      break
    case 'play':
      c.machine.play(step.anim)
      break
    case 'hide':
      c.machine.setHidden(step.hidden)
      break
  }
}
