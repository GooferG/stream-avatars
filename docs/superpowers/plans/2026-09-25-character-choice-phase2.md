# Character Choice (Roster Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Viewers pick their character in chat with `!avatar <kind|build>` (remembered across streams), and `!avatarinfo` slides up a character-select strip on its own OBS source.

**Architecture:**
- Pure logic, unit-tested in node with no Pixi and no DOM:
  - `!avatar` parsing and the change cooldown
  - the choice store, over a never-throwing storage wrapper
  - the strip protocol: cooldown decision, privileges, heartbeat and the help fallback
  - the strip's open timer and the Stream Deck blink detector
- Thin wiring on top:
  - the overlay manager swaps a character's layers in place
  - `bootstrap.ts` registers the commands
  - a second Vite page (`avatar-info.html`) draws the lineup with the same canvas helpers as the preview page
- The two pages share state only through `localStorage`, which is one origin for both OBS local files and the dev server.

**Tech Stack:** Vite 8 (rolldown), TypeScript strict, PixiJS 8 (overlay only), tmi.js, vitest (node env).

**Spec:** `docs/superpowers/specs/2026-09-25-character-roster-design.md` (sections "`!avatar` command and remembering choices", "`!avatarinfo` character-select strip", "Settings (additions)", "Error handling", "Testing"). Phase 1 is merged (PR #3).

## Global Constraints

- Commit messages never include `Co-Authored-By` or any Claude/AI trailer. The repo-local git identity is already set, so leave it alone.
- OBS loads `dist/index.html` and `dist/avatar-info.html` as **local files**:
  - `base: './'`
  - no runtime requests for files that may not exist
  - the font comes from `@fontsource/press-start-2p` (bundled), never Google Fonts
  - no CSS newer than Chrome 103 (OBS's browser): no `color-mix()`
- TypeScript is `strict` with `noUncheckedIndexedAccess` and `erasableSyntaxOnly`: no constructor parameter properties, no enums.
- Unit tests run in vitest's **node** environment: no Pixi, no DOM, no `window`. Browser behavior is checked visually on the production build.
- Every string the pixel font draws is printable ASCII (`isPrintableAscii`).
- Storage keys, verbatim from the spec:
  - `chat-avatars:choices:v1`
  - `chat-avatars:info:lastOpenAt`
  - `chat-avatars:info:alive`
- Settings defaults, verbatim from the spec: `brandColor '#9b5cff'`, `infoDurationMs 12_000`, `infoCooldownMs 60_000`, `avatarChangeCooldownMs 10_000`. Invalid override values fall back to the default.
- Help text lists `human cat dog duck frog bunny bear fox` and `skinny average chubby`. Aliases: person → human, kitty → cat, puppy → dog, rabbit → bunny.
- Timestamps shared between the two pages use `Date.now()`. `performance.now()` differs per page and is only for in-page timing.
- The overlay reads chat anonymously and never posts to chat.

## Decisions this plan makes on top of the spec (flagged to the streamer at plan review)

1. **Stream Deck silent button.** The spec's multi-action (show → wait 12 s → hide) needs the strip source hidden by default. But a hidden source also hides strips opened from chat, so the spec's two triggers conflict.
   - The strip source now stays **visible** (the strip is invisible while down).
   - The silent button is a **quick hide → show** of the source.
   - The page opens on a show that follows a hide within 3 s. A show for any other reason (page load, switching to a scene that contains it) does not open it.
2. **Help text:** `!avatar human cat dog duck frog bunny bear fox | skinny average chubby`.
   - The spec's `·` is not ASCII, and the pixel font would drop it.
   - The leading `!avatar` is needed because the same bubble is the fallback for `!avatarinfo`, where the viewer doesn't know the syntax yet.
3. **`chat-avatars:info:lastOpenAt` holds `{"at": <ms>, "messageId": <id|null>}`**, not a bare number. Both pages receive the same `!avatarinfo` message in either order. The message id lets the overlay tell "the strip opened for this very message" from "the strip is cooling down", so a viewer never gets both the strip and a bubble.

## Review Focus

1. `!avatar` words with punctuation, emoji or object-property names (`Fox!`, `🦊`, `constructor`, `__proto__`) pick the right character or show help, and never crash or pick garbage. Pinned in Task 3.
2. Saved picks a person hand-edited or an older build wrote (unknown kinds, a missing `at`, a JSON array) are skipped one by one, and the rest are kept. Pinned in Task 2.
3. The PC clock moving backwards (a `lastOpenAt` later than now) must not leave the strip stuck in cooldown. Pinned in Task 5.
4. The strip and the overlay handle the same `!avatarinfo` in either order, and the viewer gets exactly one of: the strip, or the help bubble. Pinned in Task 5.
5. OBS reporting the strip source visible on page load or on a scene switch must not open the strip. Pinned in Task 7.

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `src/config/types.ts`, `defaults.ts`, `resolveConfig.ts` | modify | 4 new settings plus validation |
| `src/utils/storage.ts` | create | `KeyValueStorage`, `browserStorage()`, `SafeStorage` (never throws, memory fallback) |
| `src/test/fakes.ts` | create | `MemoryStorage`, `ThrowingStorage` test doubles |
| `src/avatars/choiceStore.ts` | create | Remembered picks: merge, cap at 2000, tolerant load |
| `src/avatars/avatarCommand.ts` | create | `parseAvatarCommand`, `AVATAR_HELP`, `choiceFromCommand` |
| `src/avatars/chooser.ts` | create | `AvatarChooser` (per-viewer cooldown plus save), `choiceAction` |
| `src/avatars/avatar.ts` | modify | `setLayers()` in-place swap |
| `src/avatars/manager.ts` | modify | Choice-aware spawn, `applyChoice`, `say` |
| `src/app/bootstrap.ts` | modify | Register `!avatar`, `!avatarinfo`/`!avatars`; use `fitToWindow` |
| `src/app/fakeChat.ts` | modify | Fake chatters also send `!avatar` |
| `src/info/infoState.ts` | create | Strip protocol: keys, `infoDecision`, `isPrivileged`, `InfoState`, `showHelpInstead` |
| `src/render/sprites/contract.ts` | modify | `frameAt()` |
| `src/render/sprites/canvasCharacter.ts` | create | `characterSheets`, `drawCharacterFrame` (shared by preview and strip) |
| `src/app/sheetPreview.ts` | modify | Uses `canvasCharacter` |
| `src/info/lineup.ts` | create | The 10 lineup entries |
| `src/info/stripController.ts` | create | Open, countdown, close |
| `src/info/visibilityTrigger.ts` | create | `BlinkDetector` for the Stream Deck hide → show |
| `src/app/fitToWindow.ts` | create | Shared dev-window scaling (from `bootstrap.ts`) |
| `avatar-info.html`, `src/info/strip.css`, `src/info/stripPage.ts` | create | The strip page |
| `vite.config.ts` | modify | Two build entries |
| `README.md` | modify | Settings, commands, strip OBS source, Stream Deck |

---

### Task 1: Settings

**Files:**
- Modify: `src/config/types.ts`
- Modify: `src/config/defaults.ts`
- Modify: `src/config/resolveConfig.ts:23-28` (crowd fallback) and the end of `resolveConfig`
- Modify: `README.md` (after the URL parameters example line)
- Test: `src/config/resolveConfig.test.ts`

**Interfaces:**
- Produces: `AppConfig.brandColor: string`, `infoDurationMs: number`, `infoCooldownMs: number`, `avatarChangeCooldownMs: number`, always valid after `resolveConfig`.

- [ ] **Step 1: Write the failing test.** Append inside `describe('resolveConfig', ...)`:

```ts
  it('keeps valid choice and info strip settings from overrides', () => {
    const cfg = resolveConfig(params(''), {
      brandColor: '#12AbEf',
      infoDurationMs: 8_000,
      infoCooldownMs: 0,
      avatarChangeCooldownMs: 30_000,
    })
    expect([cfg.brandColor, cfg.infoDurationMs, cfg.infoCooldownMs, cfg.avatarChangeCooldownMs])
      .toEqual(['#12AbEf', 8_000, 0, 30_000])
  })

  it('falls back to the defaults for invalid choice and info strip settings', () => {
    const cfg = resolveConfig(params(''), {
      brandColor: 'purple',
      infoDurationMs: 500,
      infoCooldownMs: -1,
      avatarChangeCooldownMs: Number.NaN,
    })
    expect([cfg.brandColor, cfg.infoDurationMs, cfg.infoCooldownMs, cfg.avatarChangeCooldownMs])
      .toEqual(['#9b5cff', 12_000, 60_000, 10_000])
    expect(resolveConfig(params(''), { brandColor: '#9b5cf' }).brandColor).toBe('#9b5cff')
    expect(resolveConfig(params(''), { infoDurationMs: 999_999_999 }).infoDurationMs).toBe(12_000)
  })
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/config/resolveConfig.test.ts`
Expected: the "falls back" test FAILs (`expected [ 'purple', 500, -1, NaN ]`). The "keeps valid" test may already pass, since overrides are spread in unvalidated.

- [ ] **Step 3: Add the settings.** In `src/config/types.ts`, replace the stale `spriteScale` doc line, and add the four fields just before `debug: DebugMode`:

```ts
  /** Integer scale applied to the 48px sprite frames (2 -> 96px tall). */
  spriteScale: number
```

```ts
  /** Banner and trim color of the !avatarinfo strip, '#RRGGBB'. */
  brandColor: string
  /** How long the !avatarinfo strip stays up. */
  infoDurationMs: number
  /** How long regular viewers wait between strip openings; the broadcaster and mods skip it. */
  infoCooldownMs: number
  /** How often one viewer can change their character with !avatar. */
  avatarChangeCooldownMs: number
```

In `src/config/defaults.ts`, before `debug: ''`:

```ts
  brandColor: '#9b5cff',
  infoDurationMs: 12_000,
  infoCooldownMs: 60_000,
  avatarChangeCooldownMs: 10_000,
```

In `src/config/resolveConfig.ts`, add below the imports:

```ts
const HEX_COLOR = /^#[0-9a-f]{6}$/i
```

Replace the `crowdOverride` expression with the new helper:

```ts
  const crowdOverride = validOr(cfg.crowdChatters, 2, 50, DEFAULT_CONFIG.crowdChatters)
```

Add, just before `const debug = params.get('debug')`:

```ts
  // Overrides-only settings (no URL params): a bad value falls back to the default.
  if (typeof cfg.brandColor !== 'string' || !HEX_COLOR.test(cfg.brandColor)) {
    cfg.brandColor = DEFAULT_CONFIG.brandColor
  }
  cfg.infoDurationMs = validOr(cfg.infoDurationMs, 2_000, 120_000, DEFAULT_CONFIG.infoDurationMs)
  cfg.infoCooldownMs = validOr(cfg.infoCooldownMs, 0, 3_600_000, DEFAULT_CONFIG.infoCooldownMs)
  cfg.avatarChangeCooldownMs = validOr(
    cfg.avatarChangeCooldownMs,
    0,
    600_000,
    DEFAULT_CONFIG.avatarChangeCooldownMs,
  )
```

And below `inRange` at the bottom:

```ts
function validOr(value: number, min: number, max: number, fallback: number): number {
  return inRange(value, min, max) ? value : fallback
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npx vitest run src/config/resolveConfig.test.ts`
Expected: PASS (all tests, including "returns defaults with empty params and overrides").

- [ ] **Step 5: Document the settings.** In `README.md`, after the line `Example: \`http://localhost:5173/?channel=gooferg&maxAvatars=15&idleMinutes=5\``, add:

```markdown
A few settings live only in `src/config/overrides.ts` (rebuild after changing them). Invalid values fall back to the defaults.

| Setting | Default | Meaning |
| --- | --- | --- |
| `brandColor` | `'#9b5cff'` | Banner and trim color of the `!avatarinfo` strip (`#RRGGBB`) |
| `infoDurationMs` | `12000` | How long the strip stays up |
| `infoCooldownMs` | `60000` | How long viewers wait between strip openings (the broadcaster and mods skip it) |
| `avatarChangeCooldownMs` | `10000` | How often one viewer can change their character |
```

- [ ] **Step 6: Typecheck and commit**

Run: `npx tsc -b`
Expected: no output (clean).

```bash
git add src/config/types.ts src/config/defaults.ts src/config/resolveConfig.ts src/config/resolveConfig.test.ts README.md
git commit -m "feat: settings for character choice and the info strip"
```

---

### Task 2: Safe storage and the choice store

**Files:**
- Create: `src/utils/storage.ts`
- Create: `src/test/fakes.ts`
- Create: `src/avatars/choiceStore.ts`
- Test: `src/utils/storage.test.ts`, `src/avatars/choiceStore.test.ts`

**Interfaces:**
- Consumes: `Choice` from `src/avatars/look.ts` (`{ kind?: Kind; build?: Build }`); `KINDS`, `BUILDS`, `Kind`, `Build` from `src/render/sprites/roster.ts`.
- Produces:
  - `interface KeyValueStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }`
  - `browserStorage(): KeyValueStorage | null`
  - `class SafeStorage implements KeyValueStorage { constructor(storage: KeyValueStorage | null) }`
  - `CHOICES_KEY = 'chat-avatars:choices:v1'`, `MAX_REMEMBERED = 2000`
  - `class ChoiceStore { constructor(storage: KeyValueStorage, now?: () => number); get(login: string): Choice | null; update(login: string, pick: Choice): Choice }`
  - Test doubles `MemoryStorage` (with a public `data: Map<string, string>`) and `ThrowingStorage`

- [ ] **Step 1: Write the test doubles.** Create `src/test/fakes.ts`:

```ts
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
```

- [ ] **Step 2: Write the failing storage tests.** Create `src/utils/storage.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryStorage, ThrowingStorage } from '../test/fakes'
import { browserStorage, SafeStorage } from './storage'

describe('SafeStorage', () => {
  afterEach(() => vi.restoreAllMocks())

  it('reads what another page wrote and writes through', () => {
    const shared = new MemoryStorage()
    shared.setItem('theirs', 'x')
    const safe = new SafeStorage(shared)
    expect(safe.getItem('theirs')).toBe('x')
    safe.setItem('mine', 'y')
    expect(shared.getItem('mine')).toBe('y')
    expect(safe.getItem('missing')).toBeNull()
  })

  it('keeps working from memory with one warning when storage throws', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const safe = new SafeStorage(new ThrowingStorage())
    expect(safe.getItem('k')).toBeNull()
    safe.setItem('k', 'v')
    safe.setItem('k2', 'v2')
    expect(safe.getItem('k')).toBe('v')
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('works from memory with one warning when there is no storage', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const safe = new SafeStorage(null)
    safe.setItem('k', 'v')
    expect(safe.getItem('k')).toBe('v')
    expect(warn).toHaveBeenCalledTimes(1)
  })
})

describe('browserStorage', () => {
  it('is null where there is no window to ask (like node, here)', () => {
    expect(browserStorage()).toBeNull()
  })
})
```

- [ ] **Step 3: Run it and watch it fail**

Run: `npx vitest run src/utils/storage.test.ts`
Expected: FAIL: `Failed to resolve import "./storage"`.

- [ ] **Step 4: Implement the storage wrapper.** Create `src/utils/storage.ts`:

```ts
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
```

- [ ] **Step 5: Run the storage tests and watch them pass**

Run: `npx vitest run src/utils/storage.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Write the failing choice store tests.** Create `src/avatars/choiceStore.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryStorage, ThrowingStorage } from '../test/fakes'
import { SafeStorage } from '../utils/storage'
import { CHOICES_KEY, ChoiceStore, MAX_REMEMBERED } from './choiceStore'

describe('ChoiceStore', () => {
  afterEach(() => vi.restoreAllMocks())

  it('remembers picks across restarts', () => {
    const storage = new MemoryStorage()
    new ChoiceStore(storage).update('gooferg', { kind: 'fox' })
    expect(new ChoiceStore(storage).get('gooferg')).toEqual({ kind: 'fox' })
    expect(new ChoiceStore(storage).get('someone_else')).toBeNull()
  })

  it('merges a new pick into the saved one', () => {
    const store = new ChoiceStore(new MemoryStorage())
    store.update('gooferg', { kind: 'human', build: 'chubby' })
    expect(store.update('gooferg', { kind: 'cat' })).toEqual({ kind: 'cat', build: 'chubby' })
    expect(store.get('gooferg')).toEqual({ kind: 'cat', build: 'chubby' })
  })

  it('saves everything under one key as { login: { kind, build, at } }', () => {
    const storage = new MemoryStorage()
    new ChoiceStore(storage, () => 1234).update('gooferg', { kind: 'human', build: 'skinny' })
    expect(JSON.parse(storage.getItem(CHOICES_KEY) ?? '')).toEqual({
      gooferg: { kind: 'human', build: 'skinny', at: 1234 },
    })
  })

  it('starts empty from corrupted JSON and repairs it on the next pick', () => {
    const storage = new MemoryStorage()
    storage.setItem(CHOICES_KEY, '{not json')
    const store = new ChoiceStore(storage)
    expect(store.get('gooferg')).toBeNull()
    store.update('gooferg', { kind: 'duck' })
    expect(new ChoiceStore(storage).get('gooferg')).toEqual({ kind: 'duck' })
    storage.setItem(CHOICES_KEY, '[1, 2]')
    expect(new ChoiceStore(storage).get('gooferg')).toBeNull()
  })

  it('skips saved entries it cannot use and keeps the rest', () => {
    const storage = new MemoryStorage()
    storage.setItem(
      CHOICES_KEY,
      JSON.stringify({
        good: { kind: 'bear', at: 1 },
        dragon: { kind: 'dragon', at: 2 },
        notime: { kind: 'cat' },
        odd: 'cat',
        halfgood: { kind: 'dragon', build: 'chubby', at: 3 },
      }),
    )
    const store = new ChoiceStore(storage)
    expect(store.get('good')).toEqual({ kind: 'bear' })
    expect(store.get('dragon')).toBeNull()
    expect(store.get('notime')).toBeNull()
    expect(store.get('odd')).toBeNull()
    expect(store.get('halfgood')).toEqual({ build: 'chubby' })
  })

  it(`forgets the least recently changed viewers past ${MAX_REMEMBERED}`, () => {
    const storage = new MemoryStorage()
    // saved newest first, to prove eviction goes by `at` and not by JSON order
    const saved = Array.from({ length: MAX_REMEMBERED }, (_, i) => [`viewer_${i}`, { kind: 'cat', at: i + 1 }])
    storage.setItem(CHOICES_KEY, JSON.stringify(Object.fromEntries(saved.reverse())))
    const store = new ChoiceStore(storage, () => 10_000)
    store.update('newcomer', { kind: 'fox' })
    const written = JSON.parse(storage.getItem(CHOICES_KEY) ?? '{}') as Record<string, unknown>
    expect(Object.keys(written)).toHaveLength(MAX_REMEMBERED)
    expect(store.get('viewer_0')).toBeNull()
    expect(store.get('viewer_1')).toEqual({ kind: 'cat' })
    expect(store.get('newcomer')).toEqual({ kind: 'fox' })
  })

  it('keeps picks for the session when browser storage throws', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const store = new ChoiceStore(new SafeStorage(new ThrowingStorage()))
    store.update('gooferg', { kind: 'frog' })
    expect(store.get('gooferg')).toEqual({ kind: 'frog' })
    expect(warn).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 7: Run it and watch it fail**

Run: `npx vitest run src/avatars/choiceStore.test.ts`
Expected: FAIL: `Failed to resolve import "./choiceStore"`.

- [ ] **Step 8: Implement the store.** Create `src/avatars/choiceStore.ts`:

```ts
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
```

- [ ] **Step 9: Run the tests and watch them pass**

Run: `npx vitest run src/avatars/choiceStore.test.ts src/utils/storage.test.ts`
Expected: PASS (7 + 4 tests).

- [ ] **Step 10: Typecheck, lint and commit**

Run: `npx tsc -b && npx oxlint`
Expected: no errors (exit 0).

```bash
git add src/utils/storage.ts src/utils/storage.test.ts src/test/fakes.ts src/avatars/choiceStore.ts src/avatars/choiceStore.test.ts
git commit -m "feat: remember viewers' character picks in browser storage"
```

---

### Task 3: `!avatar` parsing and the change cooldown

**Files:**
- Create: `src/avatars/avatarCommand.ts`
- Create: `src/avatars/chooser.ts`
- Test: `src/avatars/avatarCommand.test.ts`, `src/avatars/chooser.test.ts`

**Interfaces:**
- Consumes: `ChoiceStore` (Task 2); `KINDS`, `BUILDS`, `Kind`, `Build` (roster); `Choice` (look); `isPrintableAscii` from `src/utils/text.ts`.
- Produces:
  - `type AvatarCommand = { type: 'kind'; kind: Kind } | { type: 'build'; build: Build } | { type: 'help' }`
  - `type AvatarPick = Exclude<AvatarCommand, { type: 'help' }>`
  - `parseAvatarCommand(args: readonly string[]): AvatarCommand`
  - `AVATAR_HELP: string`
  - `choiceFromCommand(command: AvatarPick): Choice`
  - `type ChooseOutcome = 'help' | 'cooldown' | 'changed'`
  - `class AvatarChooser { constructor(store: ChoiceStore, cooldownMs: number); choose(login: string, args: readonly string[], now: number): ChooseOutcome }`

- [ ] **Step 1: Write the failing parser tests.** Create `src/avatars/avatarCommand.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { BUILDS, KINDS } from '../render/sprites/roster'
import { isPrintableAscii } from '../utils/text'
import { AVATAR_HELP, choiceFromCommand, parseAvatarCommand } from './avatarCommand'

describe('parseAvatarCommand', () => {
  it('accepts every kind and build by name', () => {
    for (const kind of KINDS) expect(parseAvatarCommand([kind])).toEqual({ type: 'kind', kind })
    for (const build of BUILDS) expect(parseAvatarCommand([build])).toEqual({ type: 'build', build })
  })

  it('ignores case, punctuation and extra words', () => {
    expect(parseAvatarCommand(['Fox'])).toEqual({ type: 'kind', kind: 'fox' })
    expect(parseAvatarCommand(['CAT!'])).toEqual({ type: 'kind', kind: 'cat' })
    expect(parseAvatarCommand(['bear', 'please'])).toEqual({ type: 'kind', kind: 'bear' })
  })

  it('understands the aliases', () => {
    expect(parseAvatarCommand(['person'])).toEqual({ type: 'kind', kind: 'human' })
    expect(parseAvatarCommand(['kitty'])).toEqual({ type: 'kind', kind: 'cat' })
    expect(parseAvatarCommand(['puppy'])).toEqual({ type: 'kind', kind: 'dog' })
    expect(parseAvatarCommand(['rabbit'])).toEqual({ type: 'kind', kind: 'bunny' })
  })

  it('asks for help on no word, an unknown word, emoji or object property names', () => {
    const cases = [[], [''], ['dragon'], ['🦊'], ['constructor'], ['__proto__'], ['toString'], ['hasOwnProperty']]
    for (const args of cases) expect(parseAvatarCommand(args)).toEqual({ type: 'help' })
  })
})

describe('AVATAR_HELP', () => {
  it('lists every option in plain ASCII the pixel font can draw', () => {
    expect(AVATAR_HELP).toBe('!avatar human cat dog duck frog bunny bear fox | skinny average chubby')
    expect(isPrintableAscii(AVATAR_HELP)).toBe(true)
  })
})

describe('choiceFromCommand', () => {
  it('saves a kind as-is and a build as a human pick', () => {
    expect(choiceFromCommand({ type: 'kind', kind: 'duck' })).toEqual({ kind: 'duck' })
    expect(choiceFromCommand({ type: 'build', build: 'skinny' })).toEqual({ kind: 'human', build: 'skinny' })
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/avatars/avatarCommand.test.ts`
Expected: FAIL: `Failed to resolve import "./avatarCommand"`.

- [ ] **Step 3: Implement the parser.** Create `src/avatars/avatarCommand.ts`:

```ts
import { BUILDS, KINDS, type Build, type Kind } from '../render/sprites/roster'
import type { Choice } from './look'

export type AvatarCommand =
  | { type: 'kind'; kind: Kind }
  | { type: 'build'; build: Build }
  | { type: 'help' }
export type AvatarPick = Exclude<AvatarCommand, { type: 'help' }>

/** A Map, not an object literal, so words like "constructor" never match. */
const ALIASES = new Map<string, Kind>([
  ['person', 'human'],
  ['kitty', 'cat'],
  ['puppy', 'dog'],
  ['rabbit', 'bunny'],
])

/** The options, shown in a speech bubble; plain ASCII like everything the pixel font draws. */
export const AVATAR_HELP = `!avatar ${KINDS.join(' ')} | ${BUILDS.join(' ')}`

/** `!avatar <word>`: the first word picks a kind or a build (case and punctuation ignored). */
export function parseAvatarCommand(args: readonly string[]): AvatarCommand {
  const word = (args[0] ?? '').toLowerCase().replace(/[^a-z]/g, '')
  const kind = ALIASES.get(word) ?? KINDS.find((k) => k === word)
  if (kind) return { type: 'kind', kind }
  const build = BUILDS.find((b) => b === word)
  if (build) return { type: 'build', build }
  return { type: 'help' }
}

/** What a pick saves. A build also makes the viewer human, since only humans have builds. */
export function choiceFromCommand(command: AvatarPick): Choice {
  return command.type === 'kind' ? { kind: command.kind } : { kind: 'human', build: command.build }
}
```

- [ ] **Step 4: Run the parser tests and watch them pass**

Run: `npx vitest run src/avatars/avatarCommand.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Write the failing chooser tests.** Create `src/avatars/chooser.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { MemoryStorage } from '../test/fakes'
import { ChoiceStore } from './choiceStore'
import { AvatarChooser } from './chooser'

function setup() {
  const store = new ChoiceStore(new MemoryStorage())
  return { store, chooser: new AvatarChooser(store, 10_000) }
}

describe('AvatarChooser', () => {
  it('saves a pick and reports the change', () => {
    const { store, chooser } = setup()
    expect(chooser.choose('gooferg', ['fox'], 0)).toBe('changed')
    expect(store.get('gooferg')).toEqual({ kind: 'fox' })
    expect(chooser.choose('pete', ['chubby'], 0)).toBe('changed')
    expect(store.get('pete')).toEqual({ kind: 'human', build: 'chubby' })
  })

  it('asks for help without saving anything or starting the cooldown', () => {
    const { store, chooser } = setup()
    expect(chooser.choose('gooferg', ['dragon'], 0)).toBe('help')
    expect(store.get('gooferg')).toBeNull()
    expect(chooser.choose('gooferg', ['fox'], 1)).toBe('changed')
  })

  it('ignores changes inside the cooldown, per viewer', () => {
    const { store, chooser } = setup()
    chooser.choose('gooferg', ['fox'], 0)
    expect(chooser.choose('gooferg', ['cat'], 9_999)).toBe('cooldown')
    expect(store.get('gooferg')).toEqual({ kind: 'fox' })
    expect(chooser.choose('pete', ['cat'], 5_000)).toBe('changed')
    expect(chooser.choose('gooferg', ['cat'], 10_000)).toBe('changed')
    expect(store.get('gooferg')).toEqual({ kind: 'cat' })
  })

  it('still shows help during the cooldown', () => {
    const { chooser } = setup()
    chooser.choose('gooferg', ['fox'], 0)
    expect(chooser.choose('gooferg', [], 1)).toBe('help')
  })
})
```

- [ ] **Step 6: Run it and watch it fail**

Run: `npx vitest run src/avatars/chooser.test.ts`
Expected: FAIL: `Failed to resolve import "./chooser"`.

- [ ] **Step 7: Implement the chooser.** Create `src/avatars/chooser.ts`:

```ts
import { choiceFromCommand, parseAvatarCommand } from './avatarCommand'
import type { ChoiceStore } from './choiceStore'

export type ChooseOutcome = 'help' | 'cooldown' | 'changed'

/**
 * `!avatar` rules: an unknown word asks for help; a real pick is saved
 * unless that viewer changed less than `cooldownMs` ago (then it's ignored).
 */
export class AvatarChooser {
  private store: ChoiceStore
  private cooldownMs: number
  private lastChangeAt = new Map<string, number>()

  constructor(store: ChoiceStore, cooldownMs: number) {
    this.store = store
    this.cooldownMs = cooldownMs
  }

  choose(login: string, args: readonly string[], now: number): ChooseOutcome {
    const command = parseAvatarCommand(args)
    if (command.type === 'help') return 'help'
    const last = this.lastChangeAt.get(login)
    if (last !== undefined && now - last < this.cooldownMs) return 'cooldown'
    this.lastChangeAt.set(login, now)
    this.store.update(login, choiceFromCommand(command))
    return 'changed'
  }
}
```

- [ ] **Step 8: Run the tests and watch them pass**

Run: `npx vitest run src/avatars/avatarCommand.test.ts src/avatars/chooser.test.ts`
Expected: PASS (6 + 4 tests).

- [ ] **Step 9: Typecheck, lint and commit**

Run: `npx tsc -b && npx oxlint`
Expected: no errors.

```bash
git add src/avatars/avatarCommand.ts src/avatars/avatarCommand.test.ts src/avatars/chooser.ts src/avatars/chooser.test.ts
git commit -m "feat: parse !avatar picks with aliases, help and a per-viewer cooldown"
```

---

### Task 4: Overlay: in-place swap, choice-aware spawn, `!avatar` wiring

**Files:**
- Modify: `src/avatars/chooser.ts` (add `choiceAction`)
- Modify: `src/avatars/avatar.ts:103-131` (group building) plus the new `setLayers`
- Modify: `src/avatars/manager.ts` (options, `spawn`, new `characterFor`, `applyChoice`, `say`, `attachBubble`)
- Modify: `src/app/bootstrap.ts` (storage, store, chooser, `!avatar`)
- Modify: `src/app/fakeChat.ts` (fake `!avatar` picks)
- Modify: `README.md` (Commands section)
- Test: `src/avatars/chooser.test.ts`

**Interfaces:**
- Consumes: `AvatarChooser`, `AVATAR_HELP` (Task 3); `ChoiceStore`, `SafeStorage`, `browserStorage` (Task 2); `AvatarStateName` from `stateMachine.ts`.
- Produces:
  - `type ChoiceAction = 'spawn' | 'swap' | 'swap-only' | 'wait'`
  - `choiceAction(state: AvatarStateName | null): ChoiceAction`
  - `Avatar.setLayers(layers: readonly AvatarLayer[]): void`
  - `ManagerOptions.choiceFor: (login: string) => Choice | null`
  - `AvatarManager.applyChoice(event: ChatMessageEvent, now: number): void`
  - `AvatarManager.say(event: ChatMessageEvent, text: string, now: number): void`
  - a `storage` const in `bootstrap.ts` (a `SafeStorage`) that Task 5 reuses

- [ ] **Step 1: Write the failing test.** Append to `src/avatars/chooser.test.ts` (add `choiceAction` to the `./chooser` import):

```ts
describe('choiceAction', () => {
  it('walks in wearing the pick when there is no character', () => {
    expect(choiceAction(null)).toBe('spawn')
  })

  it('swaps in place with a hop when the character is standing, wandering or talking', () => {
    for (const state of ['idle', 'wander', 'talk'] as const) expect(choiceAction(state)).toBe('swap')
  })

  it('swaps without a hop while walking in, reacting or mid-jump, so that motion carries on', () => {
    for (const state of ['entering', 'react', 'jump'] as const) expect(choiceAction(state)).toBe('swap-only')
  })

  it('waits while the character walks off (the pick shows on the next visit)', () => {
    expect(choiceAction('leaving')).toBe('wait')
    expect(choiceAction('gone')).toBe('wait')
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/avatars/chooser.test.ts`
Expected: FAIL: `choiceAction is not a function`.

- [ ] **Step 3: Implement `choiceAction`.** Append to `src/avatars/chooser.ts` (with `import type { AvatarStateName } from './stateMachine'` at the top):

```ts
export type ChoiceAction = 'spawn' | 'swap' | 'swap-only' | 'wait'

/**
 * What a saved pick does to the chatter's character:
 * - `spawn`: walk in wearing it
 * - `swap`: swap in place with a hop
 * - `swap-only`: swap without disturbing a walk-in, reaction or jump in progress
 *   (a hop would cut the walk-in short and interrupt the reaction)
 * - `wait`: it's walking off; the pick shows on the next visit
 */
export function choiceAction(state: AvatarStateName | null): ChoiceAction {
  if (state === null) return 'spawn'
  if (state === 'leaving' || state === 'gone') return 'wait'
  return state === 'entering' || state === 'react' || state === 'jump' ? 'swap-only' : 'swap'
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run src/avatars/chooser.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Add `Avatar.setLayers`.** In `src/avatars/avatar.ts`:

1. In the constructor, replace

```ts
    // one pre-built group per sheet row; new animations need no edit here
    this.groups = Object.fromEntries(
      ANIM_NAMES.map((name) => [name, this.buildGroup(name, options)]),
    ) as Record<AnimName, AnimGroup>
```

   with

```ts
    this.groups = this.buildGroups(options.layers)
```

2. Replace the whole `buildGroup` method with:

```ts
  /** One pre-built group per sheet row; new animations need no edit here. */
  private buildGroups(layers: readonly AvatarLayer[]): Record<AnimName, AnimGroup> {
    return Object.fromEntries(
      ANIM_NAMES.map((name) => [name, this.buildGroup(name, layers)]),
    ) as Record<AnimName, AnimGroup>
  }

  private buildGroup(anim: AnimName, layers: readonly AvatarLayer[]): AnimGroup {
    const group = new Container()
    group.visible = false
    const sprites = layers.map((layer) => {
      const sprite = new AnimatedSprite(layer.set[anim])
      sprite.anchor.set(0.5, 1)
      sprite.tint = layer.tint
      sprite.animationSpeed = ANIMATIONS[anim].fps / 60
      group.addChild(sprite)
      return sprite
    })
    this.spriteFlip.addChild(group)
    return { group, sprites }
  }

  /**
   * Swaps the character's layers in place: same spot, state, name tag and
   * bubble. Textures are shared per sheet, so only the sprites are destroyed.
   */
  setLayers(layers: readonly AvatarLayer[]): void {
    for (const { group } of Object.values(this.groups)) group.destroy({ children: true })
    this.groups = this.buildGroups(layers)
    this.currentAnim = null // the next update shows the current row, restarted
  }
```

- [ ] **Step 6: Make the manager choice-aware.** In `src/avatars/manager.ts`:

1. Imports: change the chat types import to `import type { ChatMessageEvent, EmoteSpan } from '../chat/types'`. Change `import { Avatar, LABEL_ROOM } from './avatar'` to `import { Avatar, LABEL_ROOM, type AvatarLayer } from './avatar'`. Change `import { lookDna, resolveLook } from './look'` to `import { lookDna, resolveLook, type Choice, type LookDna } from './look'`. Add `import { choiceAction } from './chooser'`.
2. Add to `ManagerOptions`:

```ts
  /** The viewer's saved `!avatar` pick, if any. */
  choiceFor: (login: string) => Choice | null
```

3. In `handleMessage`, change the last line to `this.attachBubble(avatar, event.text, event.emotes, now)`.
4. After `jumpFor`, add:

```ts
  /** A viewer's pick was saved: swap it in place (see choiceAction), or walk in wearing it. */
  applyChoice(event: ChatMessageEvent, now: number): void {
    const existing = this.avatars.get(event.login)
    const action = choiceAction(existing?.machine.state ?? null)
    if (action === 'wait') return
    let avatar = existing
    if (action !== 'spawn' && avatar) {
      const dna = lookDna(event.login, this.options.cfg.walkSpeedRange)
      avatar.setLayers(this.characterFor(event, dna).layers)
    } else {
      avatar = this.spawn(event, now)
    }
    avatar.touch(now)
    if (action === 'swap') avatar.machine.onJump()
  }

  /** Overlay text (like the `!avatar` help) in a speech bubble over the chatter's character. */
  say(event: ChatMessageEvent, text: string, now: number): void {
    const avatar = this.getOrSpawn(event, now)
    if (!avatar) return
    avatar.touch(now)
    this.attachBubble(avatar, text, [], now)
  }
```

5. In `spawn`, replace everything from `// viewers' own picks arrive in phase 2` down to the end of the `layers` computation (the `.map(...)` closing `})`) with:

```ts
    const { layers, labelTint } = this.characterFor(event, dna)
```

   Then in the `new Avatar({...})` options, replace `labelTint: colors.body,` with `labelTint,`.
6. Add the helper after `spawn`:

```ts
  /** A chatter's layer stack and name tag color: username look plus saved pick, in their chat color. */
  private characterFor(
    event: ChatMessageEvent,
    dna: LookDna,
  ): { layers: AvatarLayer[]; labelTint: number } {
    const { catalog, choiceFor } = this.options
    const look = resolveLook(dna.look, choiceFor(event.login))
    const fallbackBody = PALETTES[dna.paletteIndex]?.body ?? 0xffffff
    const colors = characterColors(event.color, fallbackBody)
    const tints = roleTints(look, colors)
    const layers = layersFor(look).map((ref) => {
      const set = catalog.get(ref.sheet)
      if (!set) throw new Error(`missing sprite sheet ${ref.sheet}`)
      return { set, tint: tints[ref.role] }
    })
    return { layers, labelTint: colors.body }
  }
```

7. Replace `attachBubble` with:

```ts
  private attachBubble(avatar: Avatar, text: string, emotes: EmoteSpan[], now: number): void {
    const { cfg, emoteCache } = this.options
    void buildBubble(text, emotes, {
      maxChars: cfg.bubbleMaxChars,
      emoteCache,
    }).then((bubble) => {
      if (!bubble) return
      if (avatar.destroyed) {
        bubble.destroy()
        return
      }
      avatar.showBubble(bubble, now, cfg.bubbleDurationMs)
    })
  }
```

- [ ] **Step 7: Wire `!avatar` in `src/app/bootstrap.ts`.**

1. Add these imports:

```ts
import { AVATAR_HELP } from '../avatars/avatarCommand'
import { AvatarChooser } from '../avatars/chooser'
import { ChoiceStore } from '../avatars/choiceStore'
import { browserStorage, SafeStorage } from '../utils/storage'
```

2. Just before `const manager = new AvatarManager({`, add:

```ts
  // one never-throwing store shared by picks (and the info strip protocol)
  const storage = new SafeStorage(browserStorage())
  const choices = new ChoiceStore(storage)
  const chooser = new AvatarChooser(choices, cfg.avatarChangeCooldownMs)
```

3. Add `choiceFor: (login) => choices.get(login),` to the manager options.
4. After the `jump` registration, add:

```ts
  commands.register('avatar', (e) => {
    const now = performance.now()
    const outcome = chooser.choose(e.message.login, e.args, now)
    if (outcome === 'help') manager.say(e.message, AVATAR_HELP, now)
    else if (outcome === 'changed') manager.applyChoice(e.message, now)
  })
```

5. Add `choices,` to the `__chatAvatars` debug handle object.

- [ ] **Step 8: Fake chatters pick characters too.** In `src/app/fakeChat.ts`:

1. Add `import { BUILDS, KINDS } from '../render/sprites/roster'`.
2. Add a constant after `SAD_WAVE`:

```ts
/** Fake !avatar picks, plus one unknown word so the help bubble shows up too. */
const AVATAR_WORDS = [...KINDS, ...BUILDS, 'dragon']
```

3. Replace the command branch:

```ts
    if (waveLine === undefined && Math.random() < 0.15) {
      onCommand(
        Math.random() < 0.3
          ? { name: 'avatar', args: [pick(AVATAR_WORDS, 'cat')], message }
          : { name: 'jump', args: [], message },
      )
    } else {
```

4. Extend the file's doc comment's first sentence to end: "...without a live channel, including `!avatar` picks."

- [ ] **Step 9: Document the command.** In `README.md`, under `## Commands`, replace `- \`!jump\` makes your avatar jump.` with:

```markdown
- `!jump` makes your avatar jump.
- `!avatar <name>` picks your character: `human`, `cat`, `dog`, `duck`, `frog`, `bunny`, `bear` or `fox`, or a human build: `skinny`, `average` or `chubby` (a build also makes you human). Also understood: `person`, `kitty`, `puppy`, `rabbit`.
  - Your character swaps on the spot with a hop.
  - Your pick is remembered on this PC and survives restarts.
  - Skin and hair still come from your username.
  - One change per 10 seconds per viewer.
  - `!avatar` alone, or a word it doesn't know, shows the options in a speech bubble.
```

- [ ] **Step 10: Run the whole suite, typecheck, lint, build**

Run: `npx vitest run && npx tsc -b && npx oxlint && npm run build`
Expected: all tests pass, no type or lint errors, `✓ built`.

- [ ] **Step 11: Check it on the production build.**

Run in the background: `npx vite preview --port 4180 --strictPort`. Open `http://localhost:4180/?debug=1` in the browser pane. If the pane is hidden, requestAnimationFrame pauses: step by hand with `__chatAvatars.manager.update(1/60, performance.now()); __chatAvatars.app.render()`.

Dispatch a pick in the console:

```js
const msg = (text, id) => ({ login: 'tester', displayName: 'tester', color: '#1E90FF', text, emotes: [], messageId: id, timestamp: Date.now(), tags: {} })
__chatAvatars.commands.dispatch({ name: 'avatar', args: ['fox'], message: msg('!avatar fox', 'a1') })
```

Expected: a fox named `tester` walks in. `localStorage.getItem('chat-avatars:choices:v1')` contains `"tester":{"kind":"fox","at":…}`.

After 10 s, dispatch `args: ['chubby']` (id `a2`). Expected: the fox becomes a chubby human in place (same x, same name tag) and hops. Dispatched again within 10 s: nothing changes.

Dispatch `args: ['dragon']` (id `a3`). Expected: a bubble over `tester` reading `!avatar human cat dog duck frog bunny bear fox | skinny average chubby`.

Reload the page and send a normal message: `__chatAvatars.manager.handleMessage(msg('hi', 'a4'), performance.now())`. Expected: `tester` walks in as the chubby human (remembered).

Open `http://localhost:4180/?debug=grid`. Expected: over about a minute, some fake chatters swap looks with a hop, and "dragon" picks show the help bubble.

Stop the preview server.

- [ ] **Step 12: Commit**

```bash
git add src/avatars/chooser.ts src/avatars/chooser.test.ts src/avatars/avatar.ts src/avatars/manager.ts src/app/bootstrap.ts src/app/fakeChat.ts README.md
git commit -m "feat: !avatar swaps a viewer's character in place and remembers it"
```

---

### Task 5: The info strip protocol and the overlay's help fallback

**Files:**
- Create: `src/info/infoState.ts`
- Modify: `src/app/bootstrap.ts` (register `!avatarinfo` / `!avatars`)
- Modify: `README.md` (Commands section)
- Test: `src/info/infoState.test.ts`

**Interfaces:**
- Consumes: `KeyValueStorage` (Task 2); `storage`, `manager.say` and `AVATAR_HELP` in `bootstrap.ts` (Task 4).
- Produces:
  - `LAST_OPEN_KEY = 'chat-avatars:info:lastOpenAt'`, `ALIVE_KEY = 'chat-avatars:info:alive'`
  - `HEARTBEAT_MS = 10_000`, `ALIVE_WINDOW_MS = 30_000`
  - `INFO_COMMANDS: readonly string[]` (`['avatarinfo', 'avatars']`)
  - `type InfoDecision = 'open' | 'cooldown'`
  - `infoDecision(now: number, lastOpenAt: number | null, privileged: boolean, cooldownMs: number): InfoDecision`
  - `isPrivileged(tags: Record<string, unknown>): boolean`
  - `interface LastOpen { at: number; messageId: string | null }`
  - `class InfoState { constructor(storage: KeyValueStorage); lastOpen(): LastOpen | null; recordOpen(open: LastOpen): void; beat(now: number): void; aliveAt(): number | null }`
  - `showHelpInstead(input: HelpCheck): boolean`, where `HelpCheck = { now; lastOpen; aliveAt; messageId; privileged; cooldownMs }`

- [ ] **Step 1: Write the failing tests.** Create `src/info/infoState.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { MemoryStorage } from '../test/fakes'
import {
  ALIVE_WINDOW_MS,
  InfoState,
  infoDecision,
  isPrivileged,
  showHelpInstead,
  type HelpCheck,
} from './infoState'

describe('infoDecision', () => {
  it('opens when never opened, and again once the cooldown is over', () => {
    expect(infoDecision(1_000, null, false, 60_000)).toBe('open')
    expect(infoDecision(60_999, 1_000, false, 60_000)).toBe('cooldown')
    expect(infoDecision(61_000, 1_000, false, 60_000)).toBe('open')
  })

  it('lets the broadcaster and mods skip the cooldown', () => {
    expect(infoDecision(2_000, 1_000, true, 60_000)).toBe('open')
  })

  it('opens when the clock moved backwards past the last opening', () => {
    expect(infoDecision(1_000, 50_000, false, 60_000)).toBe('open')
  })
})

describe('isPrivileged', () => {
  it('is true for the broadcaster and moderators', () => {
    expect(isPrivileged({ badges: { broadcaster: '1' } })).toBe(true)
    expect(isPrivileged({ badges: { moderator: '1' } })).toBe(true)
    expect(isPrivileged({ badges: null, mod: true })).toBe(true)
    expect(isPrivileged({ mod: '1' })).toBe(true)
  })

  it('is false for everyone else, including missing or null badges', () => {
    expect(isPrivileged({ badges: { subscriber: '12', vip: '1' }, mod: false })).toBe(false)
    expect(isPrivileged({ badges: null })).toBe(false)
    expect(isPrivileged({})).toBe(false)
  })
})

describe('InfoState', () => {
  it('shares the last opening and the heartbeat between pages', () => {
    const shared = new MemoryStorage()
    const strip = new InfoState(shared)
    const overlay = new InfoState(shared)
    expect(overlay.lastOpen()).toBeNull()
    expect(overlay.aliveAt()).toBeNull()
    strip.recordOpen({ at: 5_000, messageId: 'm1' })
    strip.beat(6_000)
    expect(overlay.lastOpen()).toEqual({ at: 5_000, messageId: 'm1' })
    expect(overlay.aliveAt()).toBe(6_000)
  })

  it('treats garbage in storage as never opened and not alive', () => {
    const shared = new MemoryStorage()
    shared.setItem('chat-avatars:info:lastOpenAt', '{"at":"soon"}')
    shared.setItem('chat-avatars:info:alive', 'yesterday')
    const state = new InfoState(shared)
    expect(state.lastOpen()).toBeNull()
    expect(state.aliveAt()).toBeNull()
  })
})

describe('showHelpInstead', () => {
  const base: HelpCheck = {
    now: 100_000,
    lastOpen: null,
    aliveAt: 95_000,
    messageId: 'm2',
    privileged: false,
    cooldownMs: 60_000,
  }

  it('shows help when the strip is not running (no heartbeat, or a stale one)', () => {
    expect(showHelpInstead({ ...base, aliveAt: null })).toBe(true)
    expect(showHelpInstead({ ...base, aliveAt: base.now - ALIVE_WINDOW_MS - 1 })).toBe(true)
  })

  it('stays quiet when the strip will open for this message', () => {
    expect(showHelpInstead(base)).toBe(false)
    expect(showHelpInstead({ ...base, lastOpen: { at: 30_000, messageId: 'm1' } })).toBe(false)
  })

  it('shows help while the strip is cooling down from another message', () => {
    expect(showHelpInstead({ ...base, lastOpen: { at: 90_000, messageId: 'm1' } })).toBe(true)
  })

  it('stays quiet when the strip already opened for this very message (either order)', () => {
    expect(showHelpInstead({ ...base, lastOpen: { at: 99_900, messageId: 'm2' } })).toBe(false)
  })

  it('stays quiet for mods, who skip the cooldown', () => {
    expect(
      showHelpInstead({ ...base, privileged: true, lastOpen: { at: 90_000, messageId: 'm1' } }),
    ).toBe(false)
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/info/infoState.test.ts`
Expected: FAIL: `Failed to resolve import "./infoState"`.

- [ ] **Step 3: Implement the protocol.** Create `src/info/infoState.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npx vitest run src/info/infoState.test.ts`
Expected: PASS (12 tests).

- [ ] **Step 5: Wire the fallback in `src/app/bootstrap.ts`.**

1. Add `ChatCommandEvent` to the `../chat/types` type import, and add `import { INFO_COMMANDS, InfoState, isPrivileged, showHelpInstead } from '../info/infoState'`.
2. After the `avatar` registration, add:

```ts
  // !avatarinfo opens the strip (its own OBS source); the overlay only
  // steps in with the help bubble when the strip won't open for it
  const info = new InfoState(storage)
  const onInfo = (e: ChatCommandEvent) => {
    const showHelp = showHelpInstead({
      now: Date.now(),
      lastOpen: info.lastOpen(),
      aliveAt: info.aliveAt(),
      messageId: e.message.messageId,
      privileged: isPrivileged(e.message.tags),
      cooldownMs: cfg.infoCooldownMs,
    })
    if (showHelp) manager.say(e.message, AVATAR_HELP, performance.now())
  }
  for (const name of INFO_COMMANDS) commands.register(name, onInfo)
```

- [ ] **Step 6: Document it.** In `README.md` under `## Commands`, after the `!avatar` item, add:

```markdown
- `!avatarinfo` (or `!avatars`) slides up the character-select strip (see "Character select strip" below). If the strip isn't set up, or viewers opened it less than a minute ago, the options show in a speech bubble instead.
```

- [ ] **Step 7: Run the whole suite, typecheck, lint, build**

Run: `npx vitest run && npx tsc -b && npx oxlint && npm run build`
Expected: all pass, `✓ built`.

- [ ] **Step 8: Check the fallback on the production build.** Run `npx vite preview --port 4180 --strictPort` in the background, open `http://localhost:4180/?debug=1`, and define `msg` as in Task 4.

1. Run `localStorage.removeItem('chat-avatars:info:alive')`, then dispatch `{ name: 'avatarinfo', args: [], message: msg('!avatarinfo', 'i1') }`. Expected: a help bubble over `tester` (the strip isn't running).
2. Run `localStorage.setItem('chat-avatars:info:alive', String(Date.now()))` and dispatch again (id `i2`). Expected: no bubble (the strip would open).
3. Run `localStorage.setItem('chat-avatars:info:lastOpenAt', JSON.stringify({ at: Date.now(), messageId: 'other' }))` and dispatch (id `i3`). Expected: a help bubble (cooling down).

Stop the server.

- [ ] **Step 9: Commit**

```bash
git add src/info/infoState.ts src/info/infoState.test.ts src/app/bootstrap.ts README.md
git commit -m "feat: !avatarinfo protocol, with a help bubble when the strip won't open"
```

---

### Task 6: Shared canvas character drawing and the lineup

**Files:**
- Modify: `src/render/sprites/contract.ts` (add `frameAt`)
- Create: `src/render/sprites/canvasCharacter.ts`
- Modify: `src/app/sheetPreview.ts` (use the shared helpers)
- Create: `src/info/lineup.ts`
- Test: `src/render/sprites/contract.test.ts`, `src/info/lineup.test.ts`

**Interfaces:**
- Consumes:
  - `ANIMATIONS` (`{ row, frames, fps }` per `AnimName`) and `FRAME_SIZE` from `contract.ts`
  - `tintedSheet` from `canvasTint.ts`
  - `sheetSource`, `SheetImage` from `sheetSource.ts`
  - `characterColors`, `roleTints` from `render/color.ts`
  - `layersFor`, `ANIMALS`, `Look` from `roster.ts`
  - `parseAvatarCommand`, `choiceFromCommand` (Task 3)
- Produces:
  - `frameAt(anim: AnimName, ms: number): number`
  - `characterSheets(look: Look, chatColor: string | null, fallbackBody?: number): Promise<SheetImage[]>`
  - `drawCharacterFrame(ctx: CanvasRenderingContext2D, layers: readonly SheetImage[], anim: AnimName, ms: number): void`
  - `interface LineupEntry { name: string; look: Look }` and `LINEUP: readonly LineupEntry[]`

- [ ] **Step 1: Write the failing tests.** Append to `src/render/sprites/contract.test.ts` (add `frameAt` to its `./contract` import):

```ts
describe('frameAt', () => {
  it('steps through a row at its fps and loops', () => {
    expect([0, 249, 250, 999, 1_000].map((ms) => frameAt('idle', ms))).toEqual([0, 0, 1, 3, 0])
    expect(frameAt('walk', 650)).toBe(0) // 6.5 frames in at 10 fps: frame 6 wraps to 0
    expect(frameAt('idle', -100)).toBe(0)
  })
})
```

Create `src/info/lineup.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { choiceFromCommand, parseAvatarCommand } from '../avatars/avatarCommand'
import { ANIMALS, BUILDS } from '../render/sprites/roster'
import { LINEUP } from './lineup'

describe('LINEUP', () => {
  it('signs each human build, then every animal', () => {
    expect(LINEUP.map((e) => e.name)).toEqual([...BUILDS, ...ANIMALS])
  })

  it('shows exactly what typing each sign after !avatar picks', () => {
    for (const entry of LINEUP) {
      const command = parseAvatarCommand([entry.name])
      if (command.type === 'help') throw new Error(`"${entry.name}" is not an !avatar word`)
      const choice = choiceFromCommand(command)
      expect(entry.look.kind).toBe(choice.kind)
      if (choice.build) expect(entry.look.build).toBe(choice.build)
    }
  })

  it('shows the humans in different skin tones', () => {
    const humans = LINEUP.filter((e) => e.look.kind === 'human')
    expect(new Set(humans.map((e) => e.look.skin)).size).toBe(humans.length)
  })
})
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run src/render/sprites/contract.test.ts src/info/lineup.test.ts`
Expected: FAIL: `frameAt is not a function` and `Failed to resolve import "./lineup"`.

- [ ] **Step 3: Implement `frameAt` and the lineup.** Append to `src/render/sprites/contract.ts`, below `ANIMATIONS`:

```ts
/** The frame column an animation row shows `ms` after it started, looping. */
export function frameAt(anim: AnimName, ms: number): number {
  const spec = ANIMATIONS[anim]
  return Math.floor((Math.max(0, ms) / 1000) * spec.fps) % spec.frames
}
```

Create `src/info/lineup.ts`:

```ts
import { ANIMALS, type Look } from '../render/sprites/roster'

export interface LineupEntry {
  /** The sign under the character: exactly the word to type after !avatar. */
  name: string
  look: Look
}

/** Animals ignore the human-only fields; these are just valid placeholders. */
const ANIMAL_BASE: Omit<Look, 'kind'> = {
  build: 'average',
  skin: 0,
  hairStyle: 'short',
  hairColor: 0,
  accessory: null,
}

/**
 * The character-select lineup (mockup B): one human per build in varied
 * skin and hair, then every animal. The strip dresses them in the brand
 * color: shirts for humans, collars for animals.
 */
export const LINEUP: readonly LineupEntry[] = [
  { name: 'skinny', look: { kind: 'human', build: 'skinny', skin: 0, hairStyle: 'short', hairColor: 1, accessory: null } },
  { name: 'average', look: { kind: 'human', build: 'average', skin: 2, hairStyle: 'bun', hairColor: 0, accessory: null } },
  { name: 'chubby', look: { kind: 'human', build: 'chubby', skin: 3, hairStyle: 'short', hairColor: 0, accessory: null } },
  ...ANIMALS.map((kind): LineupEntry => ({ name: kind, look: { ...ANIMAL_BASE, kind } })),
]
```

- [ ] **Step 4: Run them and watch them pass**

Run: `npx vitest run src/render/sprites/contract.test.ts src/info/lineup.test.ts`
Expected: PASS.

- [ ] **Step 5: Extract the canvas helpers.** Create `src/render/sprites/canvasCharacter.ts`:

```ts
import { characterColors, roleTints } from '../color'
import { tintedSheet } from './canvasTint'
import { ANIMATIONS, FRAME_SIZE, frameAt, type AnimName } from './contract'
import { layersFor, type Look } from './roster'
import { sheetSource, type SheetImage } from './sheetSource'

/**
 * A whole character on a plain canvas, for the pages that don't run Pixi
 * (the sheet preview and the !avatarinfo strip). Same layer stack and role
 * tints as the overlay, so the three views never drift apart.
 */
export async function characterSheets(
  look: Look,
  chatColor: string | null,
  fallbackBody = 0xffffff,
): Promise<SheetImage[]> {
  const tints = roleTints(look, characterColors(chatColor, fallbackBody))
  return Promise.all(
    layersFor(look).map(async (ref) => tintedSheet(await sheetSource(ref.sheet), tints[ref.role])),
  )
}

/** Draws the frame of `anim` that shows `ms` into the animation, every layer back to front. */
export function drawCharacterFrame(
  ctx: CanvasRenderingContext2D,
  layers: readonly SheetImage[],
  anim: AnimName,
  ms: number,
): void {
  const col = frameAt(anim, ms)
  const row = ANIMATIONS[anim].row
  ctx.clearRect(0, 0, FRAME_SIZE, FRAME_SIZE)
  for (const layer of layers) {
    ctx.drawImage(layer, col * FRAME_SIZE, row * FRAME_SIZE, FRAME_SIZE, FRAME_SIZE, 0, 0, FRAME_SIZE, FRAME_SIZE)
  }
}
```

In `src/app/sheetPreview.ts`:

1. Replace the imports of `characterColors, roleTints`, `tintedSheet`, `sheetSource` and the `ANIMATIONS` part of the contract import with:

```ts
import { characterSheets, drawCharacterFrame } from '../render/sprites/canvasCharacter'
import { ANIM_NAMES, FRAME_SIZE, type AnimName } from '../render/sprites/contract'
import type { SheetImage } from '../render/sprites/sheetSource'
```

   Keep the roster import, minus `layersFor`.
2. In `lookRow`, replace the `tints` and `layers` lines with:

```ts
  const layers = await characterSheets(look, chatColor)
```

3. Replace the body of the `frame` callback's loop with:

```ts
    for (const cell of cells) drawCharacterFrame(cell.ctx, cell.layers, cell.anim, now)
```

- [ ] **Step 6: Run the whole suite, typecheck, lint, build**

Run: `npx vitest run && npx tsc -b && npx oxlint && npm run build`
Expected: all pass, `✓ built`.

- [ ] **Step 7: Check the preview still draws.** Run `npm run dev` in the background and open `http://localhost:5173/sheet-preview.html`.

Expected: the same sections as before, with every row animating. If the pane is hidden, rAF is paused. Instead check in the console that a frame draws:

```js
const C = await import('/src/render/sprites/canvasCharacter.ts'); const L = await import('/src/info/lineup.ts')
const c = document.createElement('canvas'); c.width = c.height = 48; const g = c.getContext('2d')
C.drawCharacterFrame(g, await C.characterSheets(L.LINEUP[0].look, '#9b5cff'), 'idle', 0)
g.getImageData(0, 0, 48, 48).data.some((v) => v > 0)
```

Expected: `true`. Stop the dev server.

- [ ] **Step 8: Commit**

```bash
git add src/render/sprites/contract.ts src/render/sprites/contract.test.ts src/render/sprites/canvasCharacter.ts src/app/sheetPreview.ts src/info/lineup.ts src/info/lineup.test.ts
git commit -m "refactor: shared canvas character drawing, plus the strip lineup"
```

---

### Task 7: Strip timing and the Stream Deck blink

**Files:**
- Create: `src/info/stripController.ts`
- Create: `src/info/visibilityTrigger.ts`
- Test: `src/info/stripController.test.ts`, `src/info/visibilityTrigger.test.ts`

**Interfaces:**
- Produces:
  - `interface StripView { show(): void; hide(): void }`
  - `class StripController { constructor(view: StripView, durationMs: number); readonly isOpen: boolean; open(): void }`
  - `BLINK_MS = 3_000`
  - `class BlinkDetector { onVisibleChanged(visible: boolean, now: number): boolean }`

- [ ] **Step 1: Write the failing tests.** Create `src/info/stripController.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StripController } from './stripController'

describe('StripController', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  function setup() {
    const view = { show: vi.fn(), hide: vi.fn() }
    return { view, strip: new StripController(view, 12_000) }
  }

  it('slides up, stays for the duration, then slides down', () => {
    const { view, strip } = setup()
    strip.open()
    expect(view.show).toHaveBeenCalledTimes(1)
    expect(strip.isOpen).toBe(true)
    vi.advanceTimersByTime(11_999)
    expect(view.hide).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(view.hide).toHaveBeenCalledTimes(1)
    expect(strip.isOpen).toBe(false)
  })

  it('restarts the countdown when opened again while up, without replaying the slide', () => {
    const { view, strip } = setup()
    strip.open()
    vi.advanceTimersByTime(6_000)
    strip.open()
    expect(view.show).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(11_999)
    expect(view.hide).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(view.hide).toHaveBeenCalledTimes(1)
  })

  it('slides up again after it closed', () => {
    const { view, strip } = setup()
    strip.open()
    vi.advanceTimersByTime(12_000)
    strip.open()
    expect(view.show).toHaveBeenCalledTimes(2)
  })
})
```

Create `src/info/visibilityTrigger.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { BLINK_MS, BlinkDetector } from './visibilityTrigger'

describe('BlinkDetector', () => {
  it('opens on a quick hide then show (the Stream Deck button)', () => {
    const blink = new BlinkDetector()
    expect(blink.onVisibleChanged(false, 1_000)).toBe(false)
    expect(blink.onVisibleChanged(true, 1_300)).toBe(true)
  })

  it('does not open when the source loads visible', () => {
    expect(new BlinkDetector().onVisibleChanged(true, 0)).toBe(false)
  })

  it('does not open when the source comes back after a long time hidden (switching scenes)', () => {
    const blink = new BlinkDetector()
    blink.onVisibleChanged(false, 0)
    expect(blink.onVisibleChanged(true, 60_000)).toBe(false)
  })

  it(`counts a show up to ${BLINK_MS} ms after the hide`, () => {
    const a = new BlinkDetector()
    a.onVisibleChanged(false, 0)
    expect(a.onVisibleChanged(true, BLINK_MS)).toBe(true)
    const b = new BlinkDetector()
    b.onVisibleChanged(false, 0)
    expect(b.onVisibleChanged(true, BLINK_MS + 1)).toBe(false)
  })

  it('needs a new hide before it opens again', () => {
    const blink = new BlinkDetector()
    blink.onVisibleChanged(false, 0)
    expect(blink.onVisibleChanged(true, 100)).toBe(true)
    expect(blink.onVisibleChanged(true, 200)).toBe(false)
  })
})
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run src/info/stripController.test.ts src/info/visibilityTrigger.test.ts`
Expected: FAIL: `Failed to resolve import "./stripController"` and `"./visibilityTrigger"`.

- [ ] **Step 3: Implement both.** Create `src/info/stripController.ts`:

```ts
export interface StripView {
  show(): void
  hide(): void
}

/**
 * When the strip is up: `durationMs` after the last opening. Opening while
 * it's already up restarts the countdown instead of replaying the slide.
 */
export class StripController {
  private view: StripView
  private durationMs: number
  private closeTimer: ReturnType<typeof setTimeout> | null = null

  constructor(view: StripView, durationMs: number) {
    this.view = view
    this.durationMs = durationMs
  }

  get isOpen(): boolean {
    return this.closeTimer !== null
  }

  open(): void {
    if (this.closeTimer === null) this.view.show()
    else clearTimeout(this.closeTimer)
    this.closeTimer = setTimeout(() => {
      this.closeTimer = null
      this.view.hide()
    }, this.durationMs)
  }
}
```

Create `src/info/visibilityTrigger.ts`:

```ts
/** How soon a show must follow a hide to count as the Stream Deck button. */
export const BLINK_MS = 3_000

/**
 * OBS tells the page when its source is shown or hidden. The strip source
 * stays visible (the strip is invisible while down), so the Stream Deck's
 * silent button is a quick hide then show. A source becoming visible for
 * any other reason (the page loading, switching to a scene that contains
 * it) does not open the strip.
 */
export class BlinkDetector {
  private hiddenAt: number | null = null

  /** True when this change completes a blink. */
  onVisibleChanged(visible: boolean, now: number): boolean {
    if (!visible) {
      this.hiddenAt = now
      return false
    }
    const blink = this.hiddenAt !== null && now - this.hiddenAt <= BLINK_MS
    this.hiddenAt = null
    return blink
  }
}
```

- [ ] **Step 4: Run them and watch them pass**

Run: `npx vitest run src/info/stripController.test.ts src/info/visibilityTrigger.test.ts`
Expected: PASS (3 + 5 tests).

- [ ] **Step 5: Typecheck, lint and commit**

Run: `npx tsc -b && npx oxlint`
Expected: no errors.

```bash
git add src/info/stripController.ts src/info/stripController.test.ts src/info/visibilityTrigger.ts src/info/visibilityTrigger.test.ts
git commit -m "feat: strip open timer and the Stream Deck hide-show trigger"
```

---

### Task 8: The strip page, second build entry, OBS and Stream Deck docs

**Files:**
- Create: `src/app/fitToWindow.ts` (moved out of `bootstrap.ts`)
- Modify: `src/app/bootstrap.ts` (use it; delete `fitStageToWindow`)
- Create: `avatar-info.html`
- Create: `src/info/strip.css`
- Create: `src/info/stripPage.ts`
- Modify: `vite.config.ts`
- Modify: `README.md` (new section, architecture tree)

**Interfaces:**
- Consumes:
  - `resolveConfig` (Task 1 settings)
  - `SafeStorage`, `browserStorage` (Task 2)
  - `InfoState`, `infoDecision`, `isPrivileged`, `INFO_COMMANDS`, `HEARTBEAT_MS` (Task 5)
  - `characterSheets`, `drawCharacterFrame`, `LINEUP` (Task 6)
  - `StripController`, `BlinkDetector` (Task 7)
  - `TmiChatSource` (existing)
- Produces: `fitToWindow(host: HTMLElement, width: number, height: number): () => void`, and `dist/avatar-info.html` in the build.

- [ ] **Step 1: Move the window fitting.** Create `src/app/fitToWindow.ts`:

```ts
/**
 * OBS loads a source at exactly its set size; a dev browser window usually
 * isn't. Scales the page's root element down to fit (never up) so it can
 * be checked while developing.
 */
export function fitToWindow(host: HTMLElement, width: number, height: number): () => void {
  const apply = () => {
    const scale = Math.min(1, window.innerWidth / width, window.innerHeight / height)
    host.style.transformOrigin = 'top left'
    host.style.transform = scale < 1 ? `scale(${scale})` : ''
  }
  apply()
  window.addEventListener('resize', apply)
  return () => window.removeEventListener('resize', apply)
}
```

In `src/app/bootstrap.ts`:
- add `import { fitToWindow } from './fitToWindow'`
- replace `const unfit = fitStageToWindow(host)` with `const unfit = fitToWindow(host, STAGE_WIDTH, STAGE_HEIGHT)`
- delete the `fitStageToWindow` function and its doc comment

- [ ] **Step 2: Add the page.** Create `avatar-info.html` at the repo root:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Chat Avatars: character select</title>
  </head>
  <body>
    <div id="page" class="page">
      <div id="strip" class="strip">
        <div class="plate"></div>
        <div class="banner">CHOOSE YOUR AVATAR</div>
        <div class="hint">type <b>!avatar name</b> in chat<br />e.g. <b>!avatar fox</b><br />your pick is remembered!</div>
        <div id="lineup" class="lineup"></div>
      </div>
    </div>
    <script type="module" src="/src/info/stripPage.ts"></script>
  </body>
</html>
```

Create `src/info/strip.css`:

```css
/* The !avatarinfo strip: a transparent 1920x300 OBS browser source (mockup B). */
html,
body {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  background: transparent;
  overflow: hidden;
}

:root {
  --brand: #9b5cff;
  --brand-glow: rgba(155, 92, 255, 0.35);
}

.page {
  position: relative;
  width: 1920px;
  height: 300px;
  overflow: hidden;
}

/* Down = fully below the page (the extra 80px clears the tilted banner and its shadow) and invisible. */
.strip {
  position: absolute;
  left: 0;
  bottom: 0;
  width: 1920px;
  height: 300px;
  font-family: 'Press Start 2P', ui-monospace, monospace;
  transform: translateY(calc(100% + 80px));
  visibility: hidden;
  transition: transform 0.6s ease-in, visibility 0s linear 0.6s;
}

.strip.up {
  transform: translateY(0);
  visibility: visible;
  transition: transform 0.6s ease-out, visibility 0s;
}

.plate {
  position: absolute;
  inset: 40px 0 0 0;
  background: linear-gradient(180deg, rgba(22, 12, 40, 0.94), rgba(10, 6, 20, 0.97));
  border-top: 6px solid #000;
  box-shadow: 0 -6px 0 var(--brand);
}

.banner {
  position: absolute;
  left: 60px;
  top: 0;
  z-index: 2;
  padding: 20px 30px;
  background: var(--brand);
  color: #fff;
  font-size: 30px;
  border: 6px solid #000;
  box-shadow: 8px 8px 0 rgba(0, 0, 0, 0.5);
  transform: rotate(-2deg);
}

.hint {
  position: absolute;
  left: 70px;
  top: 130px;
  width: 520px;
  color: #e6dcff;
  font-size: 18px;
  line-height: 1.7;
}

.hint b {
  color: #ffd84a;
  font-weight: normal;
}

.lineup {
  position: absolute;
  left: 640px;
  right: 40px;
  bottom: 26px;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  padding: 0 10px;
  border-bottom: 8px solid #000;
  background: linear-gradient(0deg, var(--brand-glow), transparent 75%);
}

.slot {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.slot canvas {
  image-rendering: pixelated;
  animation: bob 1.4s ease-in-out infinite;
}

.strip:not(.up) .slot canvas {
  animation-play-state: paused;
}

.sign {
  margin-top: -4px;
  padding: 6px 7px;
  background: #000;
  color: #fff;
  font-size: 12px;
  border: 3px solid var(--brand);
}

@keyframes bob {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-6px);
  }
}

/* Checkerboard while debugging so the transparent page is visible. */
body.debug-bg {
  background: repeating-conic-gradient(#2a2a2a 0% 25%, #3a3a3a 0% 50%) 0 0 / 40px 40px;
}
```

Create `src/info/stripPage.ts`:

```ts
import '@fontsource/press-start-2p/index.css'
import './strip.css'
import { fitToWindow } from '../app/fitToWindow'
import { TmiChatSource } from '../chat/tmiSource'
import type { ChatCommandEvent } from '../chat/types'
import { resolveConfig } from '../config/resolveConfig'
import { characterSheets, drawCharacterFrame } from '../render/sprites/canvasCharacter'
import { FRAME_SIZE } from '../render/sprites/contract'
import type { SheetImage } from '../render/sprites/sheetSource'
import { browserStorage, SafeStorage } from '../utils/storage'
import { HEARTBEAT_MS, INFO_COMMANDS, InfoState, infoDecision, isPrivileged } from './infoState'
import { LINEUP } from './lineup'
import { StripController } from './stripController'
import { BlinkDetector } from './visibilityTrigger'

/**
 * The !avatarinfo character-select strip: its own OBS browser source
 * (dist/avatar-info.html, 1920x300). Opens from chat, from a Stream Deck
 * hide then show of the source, or (with ?debug=1) a click or key press.
 */
const STRIP_WIDTH = 1920
const STRIP_HEIGHT = 300
/** Lineup characters at 2x (96px), crisp like on stream. */
const LINEUP_SCALE = 2
/** Each character bobs a little after its left neighbour. */
const BOB_STAGGER_S = 0.13

interface LineupCell {
  ctx: CanvasRenderingContext2D
  layers: SheetImage[]
}

function withAlpha(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 0xff}, ${(n >> 8) & 0xff}, ${n & 0xff}, ${alpha})`
}

/** One slot per lineup entry: an idle character over its name sign, in lineup order. */
async function buildLineup(root: HTMLElement, brandColor: string): Promise<LineupCell[]> {
  return Promise.all(
    LINEUP.map(async (entry, i) => {
      const canvas = document.createElement('canvas')
      canvas.width = FRAME_SIZE
      canvas.height = FRAME_SIZE
      canvas.style.width = `${FRAME_SIZE * LINEUP_SCALE}px`
      canvas.style.height = `${FRAME_SIZE * LINEUP_SCALE}px`
      canvas.style.animationDelay = `${i * BOB_STAGGER_S}s`
      const sign = document.createElement('div')
      sign.className = 'sign'
      sign.textContent = entry.name
      const slot = document.createElement('div')
      slot.className = 'slot'
      slot.append(canvas, sign)
      root.append(slot) // appended before the await, so slots keep lineup order
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('2d canvas context unavailable')
      return { ctx, layers: await characterSheets(entry.look, brandColor) }
    }),
  )
}

/** Plays the lineup's idle animation only while the strip is up, sparing OBS the work. */
function lineupAnimator(cells: readonly LineupCell[]): { start(): void; stop(): void } {
  let handle = 0
  const draw = (now: number) => {
    for (const cell of cells) drawCharacterFrame(cell.ctx, cell.layers, 'idle', now)
    handle = requestAnimationFrame(draw)
  }
  return {
    start() {
      if (!handle) draw(performance.now())
    },
    stop() {
      cancelAnimationFrame(handle)
      handle = 0
    },
  }
}

async function main(): Promise<void> {
  const cfg = resolveConfig(new URLSearchParams(window.location.search))
  const page = document.getElementById('page')
  const strip = document.getElementById('strip')
  const lineupRoot = document.getElementById('lineup')
  if (!page || !strip || !lineupRoot) throw new Error('avatar-info.html is missing #page, #strip or #lineup')

  document.documentElement.style.setProperty('--brand', cfg.brandColor)
  document.documentElement.style.setProperty('--brand-glow', withAlpha(cfg.brandColor, 0.35))
  fitToWindow(page, STRIP_WIDTH, STRIP_HEIGHT)

  const animator = lineupAnimator(await buildLineup(lineupRoot, cfg.brandColor))
  strip.addEventListener('transitionend', () => {
    if (!strip.classList.contains('up')) animator.stop()
  })
  const controller = new StripController(
    {
      show: () => {
        animator.start()
        strip.classList.add('up')
      },
      hide: () => strip.classList.remove('up'),
    },
    cfg.infoDurationMs,
  )
  const state = new InfoState(new SafeStorage(browserStorage()))
  const open = (messageId: string | null): void => {
    controller.open()
    state.recordOpen({ at: Date.now(), messageId })
  }

  // 1. chat: !avatarinfo / !avatars, cooldown for regular viewers
  const onCommand = (e: ChatCommandEvent): void => {
    if (!INFO_COMMANDS.includes(e.name)) return
    const lastOpenAt = state.lastOpen()?.at ?? null
    const decision = infoDecision(Date.now(), lastOpenAt, isPrivileged(e.message.tags), cfg.infoCooldownMs)
    if (decision === 'open') open(e.message.messageId)
  }
  if (cfg.channel) {
    const source = new TmiChatSource(cfg.channel, { ignoredBots: cfg.ignoredBots })
    source.on('command', onCommand)
    source.connect().catch((err) => {
      console.warn('[chat-avatars] info strip: initial chat connect failed, retrying', err)
    })
  }

  // 2. Stream Deck, silent: a quick hide then show of this source in OBS
  const blink = new BlinkDetector()
  window.addEventListener('obsSourceVisibleChanged', (event) => {
    const visible = (event as CustomEvent<{ visible?: boolean }>).detail?.visible === true
    if (blink.onVisibleChanged(visible, Date.now())) open(null)
  })

  // 3. debug: click or press a key
  if (cfg.debug) {
    document.body.classList.add('debug-bg')
    window.addEventListener('click', () => open(null))
    window.addEventListener('keydown', () => open(null))
    ;(window as unknown as Record<string, unknown>).__avatarInfo = { open, onCommand, state, cfg }
  }

  // the overlay reads this to know the strip is running
  state.beat(Date.now())
  window.setInterval(() => state.beat(Date.now()), HEARTBEAT_MS)
}

main().catch((err) => console.error('[chat-avatars] info strip failed to start', err))
```

- [ ] **Step 3: Add the second build entry.** Replace `vite.config.ts` with:

```ts
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const page = (file: string) => fileURLToPath(new URL(file, import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  // Relative asset paths: OBS can load the built pages as local files.
  base: './',
  plugins: [react()],
  build: {
    rolldownOptions: {
      // two OBS sources: the avatars overlay and the !avatarinfo strip
      input: {
        main: page('./index.html'),
        avatarInfo: page('./avatar-info.html'),
      },
    },
  },
})
```

If `npx tsc -b` rejects `input` under `rolldownOptions`, use the key `rollupOptions` (its deprecated alias in Vite 8) with the same contents, and ledger the ruling.

- [ ] **Step 4: Build and check both pages ship**

Run: `npx vitest run && npx tsc -b && npx oxlint && npm run build && ls dist`
Expected: all green; `dist` lists `index.html`, `avatar-info.html` and `assets`.

- [ ] **Step 5: Check the strip on the production build.** Run `npx vite preview --port 4180 --strictPort` in the background and open `http://localhost:4180/avatar-info.html?debug=1`. If the pane is hidden, CSS transitions and rAF may not run; check classes and computed styles instead of motion.

1. On load, expect:
   - a checkerboard, and no strip in view
   - `getComputedStyle(document.getElementById('strip')).visibility` is `'hidden'`
   - the strip's `getBoundingClientRect().top` is at least 300
2. Click the page. Expected, within 12 s:
   - `#strip` has class `up`
   - the purple "CHOOSE YOUR AVATAR" banner and the hint are shown
   - ten characters with signs appear, in this order: skinny, average, chubby, cat, dog, duck, frog, bunny, bear, fox
   - humans wear purple shirts; animals wear purple collars
3. After 12 s, expect: `up` is removed and the strip is fully hidden again.
4. Run `dispatchEvent(new CustomEvent('obsSourceVisibleChanged', { detail: { visible: true } }))` on its own. Expected: no opening.
5. Dispatch `visible: false`, then `visible: true` within 3 s. Expected: it opens.
6. Check the chat route: `__avatarInfo.onCommand({ name: 'avatarinfo', args: [], message: { login: 'v', displayName: 'v', color: null, text: '!avatarinfo', emotes: [], messageId: 'c1', timestamp: Date.now(), tags: {} } })`. Expected: it opens if 60 s have passed since the last opening, and stays shut otherwise. With `tags: { badges: { moderator: '1' } }`, it always opens.
7. `localStorage.getItem('chat-avatars:info:alive')` is a timestamp within the last 10 s.
8. Open `http://localhost:4180/?debug=1` in a second tab (same origin). Dispatch `!avatarinfo` there with the `messageId` the strip last opened for. Expected: no bubble. Dispatch with a new id within the cooldown. Expected: a help bubble.

Stop the server.

- [ ] **Step 6: Document the strip.** In `README.md`, after the `## Commands` section, add:

```markdown
## Character select strip (`!avatarinfo`)

A second overlay slides a "CHOOSE YOUR AVATAR" strip up from the bottom, showing every character and how to pick one. It stays up for 12 seconds.

**OBS setup**

1. Run `npm run build`. It builds both pages.
2. Add another **Browser** source, tick **Local file**, and pick `dist/avatar-info.html`. Width `1920`, height `300`. Place it along the bottom of the canvas.
3. Leave "Shutdown source when not visible" **unchecked**, and leave the source **visible**. The strip is invisible while down.

**Opening it**

- **Chat:** `!avatarinfo` or `!avatars`. Viewers can open it once a minute (`infoCooldownMs`); the broadcaster and mods any time.
- **Stream Deck, chat button:** a Twitch "Chat Message" action that sends `!avatarinfo`. It's posted as the broadcaster, so it skips the cooldown.
- **Stream Deck, silent button:** a Multi Action:
  1. OBS **Source Visibility** → hide the strip source
  2. **Delay** 0.3 s
  3. OBS **Source Visibility** → show it

  The page opens when it's shown within 3 seconds of being hidden. Showing it any other way (loading, switching to a scene that contains it) does not open it.

If the strip source isn't set up, `!avatarinfo` shows the options in a speech bubble over the viewer's character instead.

To test it without chat: `npm run dev`, then open `http://localhost:5173/avatar-info.html?debug=1` and click or press a key.
```

In the `## Architecture` tree, add a line after `avatars/`:

```
  info/       the !avatarinfo strip page: lineup, open timer, Stream Deck trigger, shared state with the overlay
```

- [ ] **Step 7: Run the whole suite once more and commit**

Run: `npx vitest run && npx tsc -b && npx oxlint && npm run build`
Expected: all green.

```bash
git add src/app/fitToWindow.ts src/app/bootstrap.ts avatar-info.html src/info/strip.css src/info/stripPage.ts vite.config.ts README.md
git commit -m "feat: !avatarinfo character-select strip as its own OBS source"
```

---

## After the last task

- Final whole-branch review (the executing skill dispatches it). Point the reviewer at the **Review Focus** list and the three **Decisions this plan makes on top of the spec**.
- The streamer checks it in OBS:
  - add the strip source
  - make both Stream Deck buttons
  - `!avatar fox` from chat
  - `!avatarinfo` from chat
