/** A lurker's name plate shows this long after they sit, so chat sees who's lurking. */
export const LURK_NAME_SHOW_MS = 4_000
/** Then it fades out over this long. */
export const LURK_NAME_FADE_MS = 500

/**
 * Who is lurking (`!lurk`) and since when. Pure, so the lurk rules are
 * testable: the cap sends the longest lurker off, the timeout counts from
 * the first `!lurk`, and repeating `!lurk` never restarts the clock.
 */
export class LurkRoster {
  private since = new Map<string, number>()

  isLurking(login: string): boolean {
    return this.since.has(login)
  }

  /**
   * Starts a lurk. Returns the lurkers who must stand up and leave so the
   * cap holds, longest lurker first; [] when `login` already lurks (their
   * clock keeps running).
   */
  start(login: string, now: number, maxLurkers: number): string[] {
    if (this.since.has(login)) return []
    this.since.set(login, now)
    const evicted: string[] = []
    // a Map iterates in insertion order, so the first entries lurked longest
    for (const other of this.since.keys()) {
      if (this.since.size <= maxLurkers) break
      if (other === login) continue
      this.since.delete(other)
      evicted.push(other)
    }
    return evicted
  }

  /** Ends a lurk (they chatted, jumped, unlurked or left). True if they were lurking. */
  stop(login: string): boolean {
    return this.since.delete(login)
  }

  /** Lurks older than `timeoutMs`: removed and returned. */
  expire(now: number, timeoutMs: number): string[] {
    const expired: string[] = []
    for (const [login, at] of this.since) {
      if (now - at > timeoutMs) {
        this.since.delete(login)
        expired.push(login)
      }
    }
    return expired
  }
}

/** A seated lurker's name plate opacity, `msSeated` after they sat down. */
export function lurkerNameAlpha(msSeated: number): number {
  if (msSeated <= LURK_NAME_SHOW_MS) return 1
  return Math.max(0, 1 - (msSeated - LURK_NAME_SHOW_MS) / LURK_NAME_FADE_MS)
}
