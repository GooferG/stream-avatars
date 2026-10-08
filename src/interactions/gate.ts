export type PairKind = 'highfive' | 'hug' | 'fight'
export const PAIR_KINDS: readonly PairKind[] = ['highfive', 'hug', 'fight']

/** Why a pair command can't happen, in the order the rules are checked. */
export type Refusal =
  | 'senderOptedOut'
  | 'senderBusy'
  | 'noName'
  | 'cooldown'
  | 'missing'
  | 'self'
  | 'lurking'
  | 'optedOut'
  | 'busy'
  | 'targetCooldown'

export interface TargetFacts {
  login: string
  lurking: boolean
  optedOut: boolean
  busy: boolean
}

export interface GateFacts {
  sender: string
  senderOptedOut: boolean
  /** The sender is in an interaction already. */
  senderBusy: boolean
  /** The typed name, or null when none was given. */
  name: string | null
  /** The on-screen character the name matched, or null. */
  target: TargetFacts | null
}

/** Cooldown maps are swept of expired entries once they grow past this. */
const SWEEP_AT = 256

/**
 * The rules for `!highfive`, `!hug` and `!fight`, and both cooldowns: one
 * per sender (started when a high-five or hug starts, or a challenge is
 * sent) and one per target (started for both people when an interaction
 * starts). Checking never starts a cooldown, so a typo locks nobody out.
 */
export class InteractionGate {
  private senderCooldownMs: number
  private targetCooldownMs: number
  private senderAt = new Map<string, number>()
  private targetAt = new Map<string, number>()

  constructor(senderCooldownMs: number, targetCooldownMs: number) {
    this.senderCooldownMs = senderCooldownMs
    this.targetCooldownMs = targetCooldownMs
  }

  /** The first rule the command breaks, or null when it can go ahead. */
  check(f: GateFacts, now: number): Refusal | null {
    if (f.senderOptedOut) return 'senderOptedOut'
    if (f.senderBusy) return 'senderBusy'
    if (f.name === null) return 'noName'
    if (cooling(this.senderAt, f.sender, this.senderCooldownMs, now)) return 'cooldown'
    const t = f.target
    if (!t) return 'missing'
    if (t.login === f.sender) return 'self'
    if (t.lurking) return 'lurking'
    if (t.optedOut) return 'optedOut'
    if (t.busy) return 'busy'
    if (cooling(this.targetAt, t.login, this.targetCooldownMs, now)) return 'targetCooldown'
    return null
  }

  /** A high-five or hug started, or a challenge was sent: the sender's cooldown starts. */
  senderActed(sender: string, now: number): void {
    record(this.senderAt, sender, this.senderCooldownMs, now)
  }

  /** An interaction started: nobody can target any of them for a while. */
  targeted(logins: readonly string[], now: number): void {
    for (const login of logins) record(this.targetAt, login, this.targetCooldownMs, now)
  }
}

function cooling(map: Map<string, number>, login: string, cooldownMs: number, now: number): boolean {
  const at = map.get(login)
  return at !== undefined && now - at < cooldownMs
}

function record(map: Map<string, number>, login: string, cooldownMs: number, now: number): void {
  map.set(login, now)
  if (map.size <= SWEEP_AT) return
  for (const [key, at] of map) if (now - at >= cooldownMs) map.delete(key)
}

/** The bubble over the sender for a refusal (null stays silent); `name` is what to call the target. */
export function refusalText(reason: Refusal, command: string, name: string): string | null {
  switch (reason) {
    case 'senderOptedOut':
      return 'you opted out (!interact)'
    case 'noName':
      return `who? try !${command} @name`
    case 'missing':
      return `${name} isn't here`
    case 'lurking':
      return `${name} is lurking`
    case 'optedOut':
      return `${name} opted out`
    case 'busy':
      return `${name} is busy`
    default:
      return null
  }
}
