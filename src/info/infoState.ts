import type { KeyValueStorage } from '../utils/storage'

/**
 * How the overlay and the !avatarinfo strip (two OBS sources, one origin)
 * coordinate through localStorage. The strip writes when it opens and a
 * heartbeat; the overlay only reads. Times are Date.now(), since
 * performance.now() differs per page.
 */
export const LAST_OPEN_KEY = 'chat-avatars:info:lastOpenAt'
export const ALIVE_KEY = 'chat-avatars:info:alive'
/** The strip writes its heartbeat this often... */
export const HEARTBEAT_MS = 10_000
/** ...and counts as not running (never added, or shut down) after this long without one. */
export const ALIVE_WINDOW_MS = 30_000
/** Chat commands that open the strip. */
export const INFO_COMMANDS: readonly string[] = ['avatarinfo', 'avatars']

export type InfoDecision = 'open' | 'cooldown'

/** Whether an !avatarinfo opens the strip. The broadcaster and mods skip the cooldown. */
export function infoDecision(
  now: number,
  lastOpenAt: number | null,
  privileged: boolean,
  cooldownMs: number,
): InfoDecision {
  // a last opening "in the future" means the clock moved back: don't stay stuck
  if (privileged || lastOpenAt === null || lastOpenAt > now) return 'open'
  return now - lastOpenAt >= cooldownMs ? 'open' : 'cooldown'
}

/** The broadcaster or a moderator, from tmi.js tags (badges map, mod flag). */
export function isPrivileged(tags: Record<string, unknown>): boolean {
  const badges = tags.badges
  if (typeof badges === 'object' && badges !== null) {
    const b = badges as Record<string, unknown>
    if (b.broadcaster || b.moderator) return true
  }
  return tags.mod === true || tags.mod === '1'
}

export interface LastOpen {
  at: number
  /** The chat message that opened it; null for Stream Deck or debug openings. */
  messageId: string | null
}

export class InfoState {
  private storage: KeyValueStorage

  constructor(storage: KeyValueStorage) {
    this.storage = storage
  }

  lastOpen(): LastOpen | null {
    try {
      const value: unknown = JSON.parse(this.storage.getItem(LAST_OPEN_KEY) ?? 'null')
      if (typeof value !== 'object' || value === null) return null
      const { at, messageId } = value as Record<string, unknown>
      if (typeof at !== 'number' || !Number.isFinite(at)) return null
      return { at, messageId: typeof messageId === 'string' ? messageId : null }
    } catch {
      return null
    }
  }

  recordOpen(open: LastOpen): void {
    this.storage.setItem(LAST_OPEN_KEY, JSON.stringify(open))
  }

  beat(now: number): void {
    this.storage.setItem(ALIVE_KEY, String(now))
  }

  /** The strip can't be seen or can't hear chat: the overlay stops counting on it right away. */
  markUnavailable(): void {
    this.storage.setItem(ALIVE_KEY, '0')
  }

  aliveAt(): number | null {
    const raw = this.storage.getItem(ALIVE_KEY)
    if (raw === null) return null
    const at = Number(raw)
    return Number.isFinite(at) ? at : null
  }
}

export interface HelpCheck {
  now: number
  lastOpen: LastOpen | null
  aliveAt: number | null
  messageId: string | null
  privileged: boolean
  cooldownMs: number
}

/**
 * The overlay's side of !avatarinfo: show the help bubble when the strip
 * won't open for this message, i.e. it isn't running or it's cooling down.
 * Both pages get the same message in either order; a strip that already
 * opened for this very message (same id) is not a cooldown.
 */
export function showHelpInstead(check: HelpCheck): boolean {
  const { now, lastOpen, aliveAt, messageId, privileged, cooldownMs } = check
  if (aliveAt === null || now - aliveAt > ALIVE_WINDOW_MS) return true
  if (lastOpen && messageId !== null && lastOpen.messageId === messageId) return false
  return infoDecision(now, lastOpen?.at ?? null, privileged, cooldownMs) === 'cooldown'
}
