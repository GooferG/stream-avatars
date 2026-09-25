type EventMap = Record<string, unknown[]>

/** Minimal typed event emitter; on() returns an unsubscribe function. */
export class Emitter<E extends EventMap> {
  private listeners = new Map<keyof E, Set<unknown>>()

  on<K extends keyof E>(event: K, listener: (...args: E[K]) => void): () => void {
    let set = this.listeners.get(event)
    if (!set) {
      set = new Set()
      this.listeners.set(event, set)
    }
    set.add(listener)
    return () => set.delete(listener)
  }

  emit<K extends keyof E>(event: K, ...args: E[K]): void {
    const set = this.listeners.get(event)
    if (!set) return
    for (const listener of set) (listener as (...args: E[K]) => void)(...args)
  }
}
