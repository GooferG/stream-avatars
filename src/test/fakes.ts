import type { KeyValueStorage } from '../utils/storage'

/** In-memory Web Storage stand-in for tests. */
export class MemoryStorage implements KeyValueStorage {
  readonly data = new Map<string, string>()

  getItem(key: string): string | null {
    return this.data.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value)
  }
}

/** Throws like a browser store that is blocked (reads) or full (writes). */
export class ThrowingStorage implements KeyValueStorage {
  getItem(): string | null {
    throw new Error('storage blocked')
  }

  setItem(): void {
    throw new Error('quota exceeded')
  }
}
