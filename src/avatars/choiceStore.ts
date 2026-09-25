import { BUILDS, KINDS, type Build, type Kind } from '../render/sprites/roster'
import type { KeyValueStorage } from '../utils/storage'
import type { Choice } from './look'

export const CHOICES_KEY = 'chat-avatars:choices:v1'
/** Viewers remembered on this PC; the least recently changed are forgotten first. */
export const MAX_REMEMBERED = 2000

interface Remembered {
  choice: Choice
  at: number
}

const isKind = (value: unknown): value is Kind => (KINDS as readonly unknown[]).includes(value)
const isBuild = (value: unknown): value is Build => (BUILDS as readonly unknown[]).includes(value)

/**
 * Viewers' `!avatar` picks, remembered across streams in the OBS browser
 * source's storage as `{ login: { kind?, build?, at } }` under one key.
 */
export class ChoiceStore {
  private storage: KeyValueStorage
  private now: () => number
  /** Least recently changed first, so eviction takes from the front. */
  private remembered: Map<string, Remembered>

  constructor(storage: KeyValueStorage, now: () => number = Date.now) {
    this.storage = storage
    this.now = now
    this.remembered = load(storage.getItem(CHOICES_KEY))
  }

  get(login: string): Choice | null {
    return this.remembered.get(login)?.choice ?? null
  }

  /** Merges a pick into the viewer's saved choice, saves it and returns the result. */
  update(login: string, pick: Choice): Choice {
    const choice: Choice = { ...this.get(login), ...pick }
    this.remembered.delete(login) // re-insert at the back: most recent
    this.remembered.set(login, { choice, at: this.now() })
    for (const oldest of this.remembered.keys()) {
      if (this.remembered.size <= MAX_REMEMBERED) break
      this.remembered.delete(oldest)
    }
    this.save()
    return choice
  }

  private save(): void {
    const data = Object.fromEntries(
      [...this.remembered].map(([login, { choice, at }]) => [login, { ...choice, at }]),
    )
    this.storage.setItem(CHOICES_KEY, JSON.stringify(data))
  }
}

/** Saved picks, oldest first. Corrupted JSON starts empty; unusable entries are skipped. */
function load(raw: string | null): Map<string, Remembered> {
  let data: unknown
  try {
    data = JSON.parse(raw ?? '{}')
  } catch {
    return new Map()
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return new Map()
  const entries: [string, Remembered][] = []
  for (const [login, value] of Object.entries(data)) {
    const entry = parseEntry(value)
    if (entry) entries.push([login, entry])
  }
  entries.sort((a, b) => a[1].at - b[1].at)
  return new Map(entries)
}

function parseEntry(value: unknown): Remembered | null {
  if (typeof value !== 'object' || value === null) return null
  const { kind, build, at } = value as Record<string, unknown>
  if (typeof at !== 'number' || !Number.isFinite(at)) return null
  const choice: Choice = {}
  if (isKind(kind)) choice.kind = kind
  if (isBuild(build)) choice.build = build
  return choice.kind || choice.build ? { choice, at } : null
}
