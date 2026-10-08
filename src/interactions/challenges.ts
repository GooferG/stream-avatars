export interface Challenge {
  from: string
  to: string
  expiresAt: number
}

/**
 * Pending `!fight` challenges: one per challenger (a new one replaces it),
 * each waiting timeoutMs for its target to `!accept` or fight back.
 */
export class ChallengeBook {
  private timeoutMs: number
  /** By challenger, oldest first: a replaced challenge moves to the back. */
  private byChallenger = new Map<string, Challenge>()

  constructor(timeoutMs: number) {
    this.timeoutMs = timeoutMs
  }

  get size(): number {
    return this.byChallenger.size
  }

  challenge(from: string, to: string, now: number): void {
    this.byChallenger.delete(from)
    this.byChallenger.set(from, { from, to, expiresAt: now + this.timeoutMs })
  }

  /** `!accept`: takes the newest live challenge to `to`. */
  acceptNewest(to: string, now: number): Challenge | null {
    let newest: Challenge | null = null
    for (const c of this.byChallenger.values()) if (c.to === to && c.expiresAt > now) newest = c
    if (newest) this.byChallenger.delete(newest.from)
    return newest
  }

  /** Fighting back: takes `from`'s live challenge to `to`, if there is one. */
  take(from: string, to: string, now: number): Challenge | null {
    const c = this.byChallenger.get(from)
    if (!c || c.to !== to || c.expiresAt <= now) return null
    this.byChallenger.delete(from)
    return c
  }

  /** Forgets expired challenges and those whose challenger or target has left. */
  prune(now: number, present: (login: string) => boolean): void {
    for (const [from, c] of this.byChallenger) {
      if (c.expiresAt <= now || !present(c.from) || !present(c.to)) this.byChallenger.delete(from)
    }
  }

  /** Drops every challenge from or to `login` (they opted out). */
  dropFor(login: string): void {
    for (const [from, c] of this.byChallenger) if (c.from === login || c.to === login) this.byChallenger.delete(from)
  }
}
