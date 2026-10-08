import { MAX_REMEMBERED } from '../avatars/choiceStore'
import type { KeyValueStorage } from '../utils/storage'

export const OPT_OUTS_KEY = 'chat-avatars:nointeract:v1'
export const FIGHTS_KEY = 'chat-avatars:fights:v1'

export interface FightRecord {
  wins: number
  losses: number
}

interface Remembered {
  record: FightRecord
  at: number
}

/**
 * Viewers who turned interactions off (`!nointeract`) and everyone's fight
 * record, remembered across streams in the OBS browser source's storage
 * like `!avatar` picks: `{ login: at }` and `{ login: { w, l, at } }`, at
 * most MAX_REMEMBERED viewers each, the least recently changed forgotten first.
 */
export class InteractionStore {
  private storage: KeyValueStorage
  private now: () => number
  /** Oldest first. */
  private optOuts: Map<string, number>
  private fights: Map<string, Remembered>

  constructor(storage: KeyValueStorage, now: () => number = Date.now) {
    this.storage = storage
    this.now = now
    this.optOuts = loadOptOuts(storage.getItem(OPT_OUTS_KEY))
    this.fights = loadFights(storage.getItem(FIGHTS_KEY))
  }

  isOptedOut(login: string): boolean {
    return this.optOuts.has(login)
  }

  setOptedOut(login: string, optedOut: boolean): void {
    this.optOuts.delete(login)
    if (optedOut) {
      this.optOuts.set(login, this.now())
      trim(this.optOuts)
    }
    this.storage.setItem(OPT_OUTS_KEY, JSON.stringify(Object.fromEntries(this.optOuts)))
  }

  record(login: string): FightRecord {
    const saved = this.fights.get(login)?.record
    return saved ? { ...saved } : { wins: 0, losses: 0 }
  }

  /** Counts a fight; returns the winner's record after it. */
  addResult(winner: string, loser: string): FightRecord {
    const lost = this.record(loser)
    lost.losses++
    this.put(loser, lost)
    const won = this.record(winner)
    won.wins++
    this.put(winner, won)
    const data = Object.fromEntries(
      [...this.fights].map(([login, { record, at }]) => [login, { w: record.wins, l: record.losses, at }]),
    )
    this.storage.setItem(FIGHTS_KEY, JSON.stringify(data))
    return { ...won }
  }

  /** Re-inserts at the back: the most recently changed. */
  private put(login: string, record: FightRecord): void {
    this.fights.delete(login)
    this.fights.set(login, { record, at: this.now() })
    trim(this.fights)
  }
}

function trim(map: Map<string, unknown>): void {
  for (const oldest of map.keys()) {
    if (map.size <= MAX_REMEMBERED) break
    map.delete(oldest)
  }
}

/** The saved JSON object, or null when it is missing, corrupted or not an object. */
function parseObject(raw: string | null): Record<string, unknown> | null {
  try {
    const data: unknown = JSON.parse(raw ?? '{}')
    return typeof data === 'object' && data !== null && !Array.isArray(data) ? (data as Record<string, unknown>) : null
  } catch {
    return null
  }
}

const isTime = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const isCount = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0

function loadOptOuts(raw: string | null): Map<string, number> {
  const data = parseObject(raw)
  if (!data) return new Map()
  const entries = Object.entries(data).filter((e): e is [string, number] => isTime(e[1]))
  entries.sort((a, b) => a[1] - b[1])
  return new Map(entries)
}

function loadFights(raw: string | null): Map<string, Remembered> {
  const data = parseObject(raw)
  if (!data) return new Map()
  const entries: [string, Remembered][] = []
  for (const [login, value] of Object.entries(data)) {
    if (typeof value !== 'object' || value === null) continue
    const { w, l, at } = value as Record<string, unknown>
    if (isCount(w) && isCount(l) && isTime(at)) entries.push([login, { record: { wins: w, losses: l }, at }])
  }
  entries.sort((a, b) => a[1].at - b[1].at)
  return new Map(entries)
}
