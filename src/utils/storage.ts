/** The slice of Web Storage the pages use; tests pass an in-memory fake. */
export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/** localStorage, or null where the browser blocks it (even reading the property can throw). */
export function browserStorage(): KeyValueStorage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/**
 * Web Storage that never throws. Every value this page writes is also kept
 * in memory and read back from there, so a missing, blocked or full store
 * only means values last until OBS restarts. Each key has one writer page
 * (the overlay writes picks, the strip writes its open time and heartbeat),
 * so a page's own copy is always the newest. Warns once, on the first failure.
 */
export class SafeStorage implements KeyValueStorage {
  private storage: KeyValueStorage | null
  private memory = new Map<string, string>()
  private warned = false

  constructor(storage: KeyValueStorage | null) {
    this.storage = storage
    if (!storage) this.warnOnce('not available')
  }

  getItem(key: string): string | null {
    const own = this.memory.get(key)
    if (own !== undefined) return own
    try {
      return this.storage?.getItem(key) ?? null
    } catch (err) {
      this.warnOnce(err)
      return null
    }
  }

  setItem(key: string, value: string): void {
    this.memory.set(key, value)
    try {
      this.storage?.setItem(key, value)
    } catch (err) {
      this.warnOnce(err)
    }
  }

  private warnOnce(reason: unknown): void {
    if (this.warned) return
    this.warned = true
    console.warn(
      '[chat-avatars] browser storage failed; !avatar picks and the info strip cooldown last only until OBS restarts',
      reason,
    )
  }
}
