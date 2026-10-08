# Avatar Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `builder.html` page, published to GitHub Pages, where viewers design their character, see it exactly as the stream draws it, and copy one `!avatar` line, plus `!avatar natural` and an optional builder link on the `!avatarinfo` strip.

**Architecture:** All builder logic is pure and tested (`src/builder/builderState.ts`, `previewCycle.ts`, `builderText.ts`, `copy.ts`, `latest.ts`). It reuses the overlay's own `lookDna`, `resolveLook`, `parseAvatarCommand`, `ChoiceStore` and `characterSheets`, so the page can't drift from the stream; a round-trip test pastes every line the builder can make into the real parser and store. `builderPage.ts` is DOM wiring only. A second Vite config builds only `builder.html` to `dist-site/`, and a GitHub Actions workflow tests, builds and deploys it.

**Tech Stack:** TypeScript (strict), Vite 8 (rolldown), Vitest 4 (node environment), oxlint, plain DOM + canvas 2D, GitHub Actions + GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-10-07-avatar-builder-design.md`

## Global Constraints

- Work in the worktree `C:\Users\luizm\Desktop\Software_Engineer\claudeProjects\chat-avatars-builder`, branch `feat/avatar-builder`. Run every command from that folder.
- TypeScript is strict with `noUncheckedIndexedAccess`, `erasableSyntaxOnly` (no enums, namespaces or constructor parameter properties), `verbatimModuleSyntax` (type-only imports use `import type` or inline `type`), `noUnusedLocals` and `noUnusedParameters`. Test files are type-checked too (`tsconfig.app.json` includes all of `src`).
- Vitest runs in the node environment (`src/**/*.test.ts`): no DOM in tests. Logic goes in pure modules; `builderPage.ts` and `stripPage.ts` only wire the DOM.
- Commit messages use conventional prefixes (`feat:`, `ci:`, `docs:`). Never add `Co-Authored-By` or any Claude attribution to commits or PRs.
- "Nothing is sent anywhere: the page makes no network requests, and the name never leaves the browser."
- "What's published: Only the builder page. The overlay and the strip stay local OBS files."
- The copied line: human `!avatar human <build> <hairstyle> <skin 1-6> <color or natural>`, e.g. `!avatar human chubby bun 5 red`; animal `!avatar <animal> <color or natural>`, e.g. `!avatar fox natural`.
- `builderUrl`: "string, default empty = not shown; overrides only".
- The page is "single column, readable on a phone (360 px wide and up)".
- The published URL is `https://gooferg.github.io/stream-avatars/builder.html`.
- Text the overlay draws with its pixel font stays plain printable ASCII.

## Review Focus

1. **Typing a name quickly.** Each keystroke starts an async sheet load; the preview must end on the last name typed, never an older load that finished late. Pinned by the `latestOnly` tests (Task 4), used by the page (Task 5).
2. **Clipboard blocked or missing** (permission denied, an in-app browser, plain http). The line ends up selected and the button says "Selected: press Ctrl+C"; the click never silently does nothing. Pinned by the `copyText` tests (Task 4).
3. **`natural` edge cases in chat.** `!avatar natural` from a viewer with no saved pick changes nothing and stores no `color: null`; `natural natural` or `natural red` asks for help. Pinned in Task 1.
4. **A phone 360 px wide.** No sideways scroll; chip rows wrap; the line and the Copy button stay usable. Checked in Chrome in Task 7 (`scrollWidth <= innerWidth`); there is no DOM test environment.
5. **An odd `builderUrl` on the strip.** A non-web value shows no link; a long one is cut with an ellipsis instead of running off the strip; it's set as text, never HTML. Pinned by the `resolveConfig` and `builderLinkText` tests (Task 2); the ellipsis is checked in Chrome (Task 7).

## Where this plan refines the spec

- **The help bubble grows to 7 lines.** The spec says the `!avatar` help "mentions it ('any color or natural') and still fits its 6 lines". It can't do both: all 6 current lines are full (18 to 21 of 21 characters), so `or natural` wraps onto a 7th line. This plan keeps the mention and raises `OVERLAY_BUBBLE_LINES` from 6 to 7. That limit only covers text the overlay writes itself, and every other such text is shorter, so only the help bubble gets taller. If this is wrong, it costs a one-line revert plus a shorter help text.
- **Where the builder link goes on the strip.** It goes on a full-width line along the strip's bottom edge, under the lineup, in 12 px text. The 540 px hint box can't fit the 58-character address in Press Start 2P.
- **Builder fonts.** Press Start 2P is used for the title and section headings, as on the strip. Departure Mono is used for everything else, because the streamer found it easier to read, and paragraphs in Press Start 2P are hard to read on a phone.
- **Retyping the same name keeps the picks.** Only a different login (after removing `@`, spaces and case) restarts from that username's look, so an accidental trailing space doesn't wipe the picks.
- **The builder's natural swatch shows the real color for the current kind.** That is the username's hair color for a human, or the animal's own fur. The strip has no kind to show, so its natural chip is a stripe of the light natural furs.
- **Name color input.** It is a color picker plus a **default** button that goes back to the username's palette color.
- **CI checks a little more.** It also runs `npm run lint`, and `build:site` runs `tsc -b` first, so a type error fails the PR.

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `src/avatars/look.ts` | modify | `Choice.color` may be `null` in a pick (clears the color) |
| `src/avatars/avatarCommand.ts` | modify | parse `natural`; help text mentions it |
| `src/render/wrap.ts` | modify | `OVERLAY_BUBBLE_LINES` 6 → 7 |
| `src/avatars/choiceStore.ts` | modify | a `null` color pick deletes the saved color |
| `src/config/types.ts`, `defaults.ts`, `resolveConfig.ts` | modify | `builderUrl` setting |
| `src/info/builderLink.ts` | create | the strip's "build yours: …" text |
| `src/info/naturalChip.ts` | create | the strip's natural chip background |
| `src/info/stripPage.ts`, `avatar-info.html`, `src/info/strip.css` | modify | natural chip, builder link line |
| `src/builder/builderState.ts` | create | builder state → look, line, swatch and body colors |
| `src/builder/previewCycle.ts` | create | which animation the preview shows when |
| `src/builder/builderText.ts` | create | title, cooldown note, commands list |
| `src/builder/copy.ts` | create | clipboard copy with a manual fallback result |
| `src/builder/latest.ts` | create | keep only the newest async load |
| `builder.html`, `src/builder/builderPage.ts`, `src/builder/builder.css` | create | the page |
| `vite.site.config.ts`, `package.json`, `tsconfig.node.json`, `.gitignore` | create/modify | `npm run build:site` → `dist-site/` |
| `.github/workflows/pages.yml` | create | test, build, deploy to Pages |
| `README.md` | modify | `natural`, `builderUrl`, builder section |

---

### Task 1: `!avatar natural`

**Files:**
- Modify: `src/avatars/look.ts` (the `Choice` interface)
- Modify: `src/avatars/avatarCommand.ts`
- Modify: `src/render/wrap.ts:10-11`
- Modify: `src/avatars/choiceStore.ts` (`update`)
- Modify: `README.md` (the `!avatar` color bullet)
- Test: `src/avatars/avatarCommand.test.ts`, `src/avatars/choiceStore.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `Choice.color?: ColorName | null`, where `null` in a pick means "clear the saved color". `parseAvatarCommand(['natural'])` returns `{ type: 'pick', choice: { color: null } }`. `ChoiceStore.update(login, { color: null })` returns and saves the choice without a `color` key. `OVERLAY_BUBBLE_LINES === 7`. Task 3's round-trip test relies on all of this.

- [ ] **Step 1: Write the failing tests**

In `src/avatars/avatarCommand.test.ts`, add this block inside `describe('parseAvatarCommand', ...)`, after the test `'combines a color with a kind, or with human-only words'`:

```ts
  it('takes natural as the color word that clears a picked color', () => {
    expect(parseAvatarCommand(['natural'])).toEqual(pick({ color: null }))
    expect(parseAvatarCommand(['fox', 'Natural!'])).toEqual(pick({ kind: 'fox', color: null }))
    expect(parseAvatarCommand(['human', 'chubby', 'bun', '5', 'natural'])).toEqual(
      pick({ kind: 'human', build: 'chubby', hairStyle: 'bun', skin: 4, color: null }),
    )
  })

  it('asks for help when natural comes with a color word or twice', () => {
    expect(parseAvatarCommand(['natural', 'red'])).toEqual(help)
    expect(parseAvatarCommand(['red', 'natural'])).toEqual(help)
    expect(parseAvatarCommand(['natural', 'natural'])).toEqual(help)
  })
```

In the same file, replace the expected help lines in `it('show every option, one group per bubble line', ...)`:

```ts
    expect(bubbleLines(AVATAR_HELP)).toEqual([
      '!avatar penguin blue',
      'human cat dog duck',
      'frog bunny bear fox',
      'skinny average chubby',
      'short long bun spiky',
      'skin 1-6 + any color',
      'or natural',
    ])
```

In `src/avatars/choiceStore.test.ts`, add inside `describe('ChoiceStore', ...)`, after `'merges a new pick into the saved one'`:

```ts
  it('forgets the saved color when a pick clears it, in memory and in storage', () => {
    const storage = new MemoryStorage()
    const store = new ChoiceStore(storage, () => 1234)
    store.update('gooferg', { kind: 'fox', color: 'red' })
    expect(store.update('gooferg', { color: null })).toStrictEqual({ kind: 'fox' })
    expect(store.get('gooferg')).toStrictEqual({ kind: 'fox' })
    expect(JSON.parse(storage.getItem(CHOICES_KEY) ?? '')).toStrictEqual({ gooferg: { kind: 'fox', at: 1234 } })
    expect(new ChoiceStore(storage).get('gooferg')).toStrictEqual({ kind: 'fox' })
  })

  it('keeps nothing for a new viewer whose only pick is natural', () => {
    const storage = new MemoryStorage()
    expect(new ChoiceStore(storage).update('newbie', { color: null })).toStrictEqual({})
    expect(new ChoiceStore(storage).get('newbie')).toBeNull()
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/avatars/avatarCommand.test.ts src/avatars/choiceStore.test.ts`
Expected: FAIL. The two natural tests get `{ type: 'help' }` and `{ kind: 'fox', ... }` where a pick was expected. The help lines lack `'or natural'`. `forgets the saved color` gets `color: null` in the choice and the JSON. `keeps nothing` gets `{ color: null }`.

- [ ] **Step 3: Implement**

In `src/avatars/look.ts`, replace the `color` field of `Choice`:

```ts
  /** Hair when human, fur when animal. Null in a pick (`!avatar natural`) clears it; saved choices never hold null. */
  color?: ColorName | null
```

In `src/avatars/avatarCommand.ts`, change the help's last group:

```ts
  `skin 1-${SKIN_TONES.length} + any color or natural`,
```

Then change the parser's doc comment and loop. The full new function:

```ts
/**
 * `!avatar <words>`: any mix of one kind, one build, one hairstyle, one
 * skin number (1-6) and one color, in any order, case and punctuation
 * ignored. `natural` counts as the color: it clears a picked color, back
 * to the username's hair or the animal's own fur. A build, hairstyle or
 * skin number also makes the viewer human, since only humans have them; a
 * color fits any kind (hair or fur). Unknown words, two words of the same
 * sort, or an animal with a human-only word ask for help instead.
 */
export function parseAvatarCommand(args: readonly string[]): AvatarCommand {
  const choice: Choice = {}
  for (const arg of args) {
    const word = arg.toLowerCase().replace(/[^a-z0-9]/g, '')
    if (word === 'skin') continue // "skin 3", the way the help text reads
    const kind = ALIASES.get(word) ?? KINDS.find((k) => k === word)
    const build = BUILDS.find((b) => b === word)
    const hairStyle = HAIR_STYLES.find((h) => h === word)
    const skin = skinIndex(word)
    const color = COLOR_ALIASES.get(word) ?? COLOR_NAMES.find((c) => c === word)
    const natural = word === 'natural'
    if (kind && !choice.kind) choice.kind = kind
    else if (build && !choice.build) choice.build = build
    else if (hairStyle && !choice.hairStyle) choice.hairStyle = hairStyle
    else if (skin !== undefined && choice.skin === undefined) choice.skin = skin
    else if ((color || natural) && choice.color === undefined) choice.color = color ?? null
    else return HELP
  }
  if (Object.keys(choice).length === 0) return HELP
  const humanOnly = choice.build !== undefined || choice.hairStyle !== undefined || choice.skin !== undefined
  if (humanOnly) {
    if (choice.kind && choice.kind !== 'human') return HELP
    choice.kind = 'human'
  }
  return { type: 'pick', choice }
}
```

In `src/render/wrap.ts`, replace the `OVERLAY_BUBBLE_LINES` lines:

```ts
/** Lines for text the overlay writes itself, which must show in full (the !avatar help is the longest). */
export const OVERLAY_BUBBLE_LINES = 7
```

In `src/avatars/choiceStore.ts`, replace the first line of `update`:

```ts
  /** Merges a pick into the viewer's saved choice, saves it and returns the result. */
  update(login: string, pick: Choice): Choice {
    const choice: Choice = { ...this.get(login), ...pick }
    if (choice.color === null) delete choice.color // `natural`: back to the rolled hair or natural fur
    this.remembered.delete(login) // re-insert at the back: most recent
```

(The rest of `update` is unchanged.)

In `README.md`, replace the color bullet under `!avatar <words>`:

```md
  - a color: `black`, `brown`, `white`, `gray`, `gold`, `orange`, `red`, `pink`, `purple`, `blue` or `green` (also `grey`, `golden`, `blond`, `blonde`, `yellow`). It colors your fur when you're an animal and your hair when you're human, and it comes along when you switch. `natural` instead of a color clears it: back to your username's hair color, or the animal's own fur.
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/avatars/avatarCommand.test.ts src/avatars/choiceStore.test.ts`
Expected: PASS. This includes the existing `'fit an overlay bubble in plain ASCII'`, which now allows 7 lines.

- [ ] **Step 5: Type-check, lint and run the full suite**

Run: `npx tsc -b; npm run lint; npm test`
Expected: no type errors, lint clean, every test passes.

- [ ] **Step 6: Commit**

```bash
git add src/avatars/look.ts src/avatars/avatarCommand.ts src/avatars/avatarCommand.test.ts src/render/wrap.ts src/avatars/choiceStore.ts src/avatars/choiceStore.test.ts README.md
git commit -m "feat: !avatar natural clears a picked color"
```

---

### Task 2: Natural chip and builder link on the `!avatarinfo` strip

**Files:**
- Modify: `src/config/types.ts`, `src/config/defaults.ts`, `src/config/resolveConfig.ts`
- Create: `src/info/builderLink.ts`, `src/info/naturalChip.ts`
- Modify: `src/info/stripPage.ts`, `avatar-info.html`, `src/info/strip.css`, `README.md` (settings table)
- Test: `src/config/resolveConfig.test.ts`, `src/info/builderLink.test.ts`, `src/info/naturalChip.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `AppConfig.builderUrl: string`, which is `''` or an `http(s)://` address. `builderLinkText(url: string): string | null`. `naturalChipBackground(): string`, `NATURAL_CHIP_FURS: readonly number[]`. Only the strip uses these; the builder page never reads `builderUrl`.

- [ ] **Step 1: Write the failing tests**

In `src/config/resolveConfig.test.ts`, add inside `describe('resolveConfig', ...)`, after `'falls back to the defaults for invalid choice and info strip settings'`:

```ts
  it('keeps a web address for builderUrl from overrides, and nothing else', () => {
    const url = 'https://gooferg.github.io/stream-avatars/builder.html'
    expect(resolveConfig(params(''), {}).builderUrl).toBe('')
    expect(resolveConfig(params(''), { builderUrl: url }).builderUrl).toBe(url)
    for (const bad of ['gooferg.github.io/builder', 'javascript:alert(1)', 'https://a b', 42]) {
      expect(resolveConfig(params(''), { builderUrl: bad as string }).builderUrl).toBe('')
    }
    expect(resolveConfig(params(`builderUrl=${encodeURIComponent(url)}`), {}).builderUrl).toBe('') // overrides only
  })
```

Create `src/info/builderLink.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { builderLinkText } from './builderLink'

describe('builderLinkText', () => {
  it('shows the address without its scheme', () => {
    expect(builderLinkText('https://gooferg.github.io/stream-avatars/builder.html')).toBe(
      'build yours: gooferg.github.io/stream-avatars/builder.html',
    )
    expect(builderLinkText('http://example.test/b')).toBe('build yours: example.test/b')
  })

  it('shows nothing without an address', () => {
    expect(builderLinkText('')).toBeNull()
  })
})
```

Create `src/info/naturalChip.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { luma, MIN_LABEL_LUMA } from '../render/color'
import { NATURAL_CHIP_FURS, naturalChipBackground } from './naturalChip'

describe('the natural chip', () => {
  it('stripes only natural furs light enough for its dark label', () => {
    expect(NATURAL_CHIP_FURS.length).toBeGreaterThanOrEqual(3)
    for (const fur of NATURAL_CHIP_FURS) expect(luma(fur)).toBeGreaterThanOrEqual(MIN_LABEL_LUMA)
  })

  it('is a stripe of the cat, duck, frog and bunny furs', () => {
    expect(naturalChipBackground()).toBe('linear-gradient(90deg, #f0a04b, #f5d547, #6bbf59, #e8e2dc)')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/config/resolveConfig.test.ts src/info/builderLink.test.ts src/info/naturalChip.test.ts`
Expected: FAIL. In `resolveConfig`, `builderUrl` is `undefined` (or the bad value passes through). The two new files fail with "Failed to resolve import './builderLink'" and "Failed to resolve import './naturalChip'".

- [ ] **Step 3: Implement the setting**

In `src/config/types.ts`, add after `avatarChangeCooldownMs: number`:

```ts
  /** The avatar builder page's address, shown along the bottom of the !avatarinfo strip; empty shows no link. */
  builderUrl: string
```

In `src/config/defaults.ts`, add after `avatarChangeCooldownMs: 10_000,`:

```ts
  builderUrl: '',
```

In `src/config/resolveConfig.ts`, add after `const HEX_COLOR = /^#[0-9a-f]{6}$/i`:

```ts
const WEB_URL = /^https?:\/\/\S+$/i
```

Then add right after the `cfg.avatarChangeCooldownMs = validOr(...)` statement:

```ts
  if (typeof cfg.builderUrl !== 'string' || !WEB_URL.test(cfg.builderUrl)) cfg.builderUrl = ''
```

- [ ] **Step 4: Implement the strip helpers**

Create `src/info/builderLink.ts`:

```ts
/** The strip's bottom line pointing at the builder page: the address without its scheme, or null without one. */
export function builderLinkText(url: string): string | null {
  if (!url) return null
  return `build yours: ${url.replace(/^https?:\/\//i, '')}`
}
```

Create `src/info/naturalChip.ts`:

```ts
import { luma, MIN_LABEL_LUMA } from '../render/color'
import { NATURAL_FUR } from '../render/sprites/roster'

/** The animals' own furs that are light enough for the chip's dark label. */
export const NATURAL_CHIP_FURS: readonly number[] = Object.values(NATURAL_FUR).filter(
  (fur) => luma(fur) >= MIN_LABEL_LUMA,
)

/** The strip's `natural` chip background: a stripe of natural furs, since it stands for every kind. */
export function naturalChipBackground(): string {
  const stops = NATURAL_CHIP_FURS.map((fur) => `#${fur.toString(16).padStart(6, '0')}`)
  return `linear-gradient(90deg, ${stops.join(', ')})`
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/config/resolveConfig.test.ts src/info/builderLink.test.ts src/info/naturalChip.test.ts`
Expected: PASS, including the existing `'returns defaults with empty params and overrides'`.

- [ ] **Step 6: Wire the strip**

In `avatar-info.html`, add the link line between the hairstyles div and the lineup div:

```html
        <div id="hairstyles" class="hairstyles"><span class="caption">hair:</span></div>
        <div id="builder-link" class="builder-link" hidden></div>
        <div id="lineup" class="lineup"></div>
```

In `src/info/strip.css`, add after the `.colors .caption` rule:

```css
/* `natural`: no color word; each animal's own fur, the username's hair for humans. */
.colors .natural {
  color: #1a1020;
}

/* "build yours: <builderUrl>" along the bottom edge, under the lineup, when builderUrl is set. */
.builder-link {
  position: absolute;
  left: 70px;
  right: 40px;
  bottom: 6px;
  color: #e6dcff;
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

In `src/info/stripPage.ts`:

1. Add the imports after `import { HAIRSTYLE_PREVIEWS, LINEUP } from './lineup'`:

```ts
import { builderLinkText } from './builderLink'
import { naturalChipBackground } from './naturalChip'
```

2. Add this function after `buildSwatches`:

```ts
/** The `natural` chip after the color words: it clears a picked color. */
function naturalChip(): HTMLElement {
  const chip = document.createElement('span')
  chip.className = 'swatch natural'
  chip.style.background = naturalChipBackground()
  chip.textContent = 'natural'
  return chip
}
```

3. In `main()`, replace the element lookup and its check:

```ts
  const colors = document.getElementById('colors')
  const builderLink = document.getElementById('builder-link')
  if (!page || !strip || !lineupRoot || !skins || !hairstyles || !colors || !builderLink) {
    throw new Error('avatar-info.html is missing #page, #strip, #lineup, #skins, #hairstyles, #colors or #builder-link')
  }
```

4. After `buildSwatches(colors, COLOR_NAMES.map(...))`, add:

```ts
  colors.append(naturalChip())
  const link = builderLinkText(cfg.builderUrl)
  if (link) {
    builderLink.textContent = link
    builderLink.hidden = false
  }
```

In `README.md`, add a row at the end of the overrides-only settings table (after `avatarChangeCooldownMs`):

```md
| `builderUrl` | `''` | The avatar builder page's address (see "Avatar builder page"), shown along the bottom of the `!avatarinfo` strip; empty shows no link |
```

- [ ] **Step 7: Type-check, lint and run the full suite**

Run: `npx tsc -b; npm run lint; npm test`
Expected: no type errors, lint clean, every test passes. The strip is checked by eye in Task 7.

- [ ] **Step 8: Commit**

```bash
git add src/config/types.ts src/config/defaults.ts src/config/resolveConfig.ts src/config/resolveConfig.test.ts src/info/builderLink.ts src/info/builderLink.test.ts src/info/naturalChip.ts src/info/naturalChip.test.ts src/info/stripPage.ts avatar-info.html src/info/strip.css README.md
git commit -m "feat: natural chip and optional builder link on the !avatarinfo strip"
```

---

### Task 3: Builder state

**Files:**
- Create: `src/builder/builderState.ts`
- Test: `src/builder/builderState.test.ts`

**Interfaces:**
- Consumes: `parseAvatarCommand` with `natural`, and `ChoiceStore.update` dropping a `null` color (Task 1). These are only needed by the round-trip test.
- Produces (all in `src/builder/builderState.ts`):
  - `type ColorPick = ColorName | 'natural'`
  - `interface BuilderState { kind: Kind; build: Build; hairStyle: HairStyle; skin: number; color: ColorPick; login: string | null; nameColor: string | null }`
  - `NEUTRAL_LOOK: Look`, `NEUTRAL_BODY: number` (`0x9aa7b8`)
  - `normalizeLogin(raw: string): string | null`
  - `initialState(rawLogin?: string): BuilderState`
  - `withLogin(state: BuilderState, rawLogin: string): BuilderState`
  - `lookFor(state: BuilderState): Look`
  - `commandFor(state: BuilderState): string`
  - `fallbackBodyFor(state: BuilderState): number`
  - `naturalColorFor(state: BuilderState): number`
  - `swatchColorFor(state: BuilderState, color: ColorName): number`

- [ ] **Step 1: Write the failing tests**

Create `src/builder/builderState.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { parseAvatarCommand } from '../avatars/avatarCommand'
import { ChoiceStore } from '../avatars/choiceStore'
import { lookDna, resolveLook, type Choice } from '../avatars/look'
import { PALETTES } from '../render/sprites/contract'
import {
  ANIMALS,
  BUILDS,
  COLOR_NAMES,
  COLORS,
  furColor,
  HAIR_COLORS,
  HAIR_STYLES,
  NATURAL_FUR,
  SKIN_TONES,
  type Look,
} from '../render/sprites/roster'
import { MemoryStorage } from '../test/fakes'
import {
  commandFor,
  fallbackBodyFor,
  initialState,
  lookFor,
  naturalColorFor,
  NEUTRAL_BODY,
  NEUTRAL_LOOK,
  normalizeLogin,
  swatchColorFor,
  withLogin,
  type BuilderState,
  type ColorPick,
} from './builderState'

const SPEEDS: [number, number] = [30, 70]

/** The first test login whose username look matches, so the grid covers that case. */
function loginWhere(test: (look: Look) => boolean): string {
  for (let i = 0; i < 1000; i++) {
    if (test(lookDna(`viewer_${i}`, SPEEDS).look)) return `viewer_${i}`
  }
  throw new Error('no test login matches')
}

/**
 * What the overlay shows once `login` pastes `line` with `earlier` already
 * saved: the real parser, store and resolver, reloaded from storage the
 * way the next stream starts.
 */
function streamLook(login: string, earlier: Choice | null, line: string): Look {
  const [bang, ...args] = line.split(' ')
  if (bang !== '!avatar') throw new Error(`not an !avatar line: ${line}`)
  const command = parseAvatarCommand(args)
  if (command.type !== 'pick') throw new Error(`the overlay asks for help on: ${line}`)
  const storage = new MemoryStorage()
  const store = new ChoiceStore(storage)
  if (earlier) store.update(login, earlier)
  store.update(login, command.choice)
  return resolveLook(lookDna(login, SPEEDS).look, new ChoiceStore(storage).get(login))
}

/** What shows on screen: an animal draws only its kind and fur (no build, hair, skin or accessory). */
const visible = (look: Look): Partial<Look> => (look.kind === 'human' ? look : { kind: look.kind, color: look.color })

/** Every state the builder can reach for a login: each kind, build, hairstyle, skin and color. */
function* allStates(login: string): Generator<BuilderState> {
  const start = initialState(login)
  const colors: ColorPick[] = ['natural', ...COLOR_NAMES]
  for (const color of colors) {
    for (const kind of ANIMALS) yield { ...start, kind, color }
    for (const build of BUILDS) {
      for (const hairStyle of HAIR_STYLES) {
        for (const skin of SKIN_TONES.keys()) yield { ...start, kind: 'human', build, hairStyle, skin, color }
      }
    }
  }
}

describe('normalizeLogin', () => {
  it('drops @ and spaces and lowercases, like chat logins', () => {
    expect(normalizeLogin(' @GooferG ')).toBe('gooferg')
    expect(normalizeLogin('@@goo ferg')).toBe('gooferg')
  })

  it('is null when nothing is left', () => {
    expect(normalizeLogin('')).toBeNull()
    expect(normalizeLogin(' @ ')).toBeNull()
  })
})

describe('initialState', () => {
  it('starts from the neutral look without a name', () => {
    expect(initialState()).toEqual({
      kind: 'human',
      build: 'average',
      hairStyle: 'short',
      skin: 0,
      color: 'natural',
      login: null,
      nameColor: null,
    })
    expect(lookFor(initialState())).toEqual(NEUTRAL_LOOK)
  })

  it("starts from the viewer's username look with a name", () => {
    const rolled = lookDna('gooferg', SPEEDS).look
    expect(initialState('@GooferG ')).toEqual({
      kind: rolled.kind,
      build: rolled.build,
      hairStyle: rolled.hairStyle,
      skin: rolled.skin,
      color: 'natural',
      login: 'gooferg',
      nameColor: null,
    })
  })
})

describe('withLogin', () => {
  it("restarts the picks from a new name's look and keeps the name color", () => {
    const before: BuilderState = { ...initialState(), kind: 'fox', color: 'red', nameColor: '#ff0000' }
    expect(withLogin(before, 'GooferG')).toEqual({ ...initialState('gooferg'), nameColor: '#ff0000' })
  })

  it('keeps the picks when the name typed is the same login', () => {
    const picked: BuilderState = { ...initialState('gooferg'), kind: 'fox', color: 'blue' }
    expect(withLogin(picked, ' @GooferG')).toBe(picked)
  })
})

describe('commandFor', () => {
  it('names every field for a human', () => {
    const state: BuilderState = { ...initialState(), build: 'chubby', hairStyle: 'bun', skin: 4, color: 'red' }
    expect(commandFor(state)).toBe('!avatar human chubby bun 5 red')
    expect(commandFor({ ...state, color: 'natural' })).toBe('!avatar human chubby bun 5 natural')
  })

  it('names the kind and color for every animal', () => {
    for (const kind of ANIMALS) {
      expect(commandFor({ ...initialState(), kind, color: 'natural' })).toBe(`!avatar ${kind} natural`)
      expect(commandFor({ ...initialState(), kind, color: 'blue' })).toBe(`!avatar ${kind} blue`)
    }
  })

  it('pastes into exactly the look it shows, whatever the viewer picked before', () => {
    const logins = [
      'gooferg',
      loginWhere((look) => look.kind !== 'human'),
      loginWhere((look) => look.accessory === 'cap'),
    ]
    const earlierPicks: (Choice | null)[] = [
      null,
      { color: 'green' },
      { kind: 'fox', color: 'red' },
      { kind: 'human', build: 'chubby', hairStyle: 'bun', skin: 5, color: 'blue' },
    ]
    let checked = 0
    for (const login of logins) {
      for (const state of allStates(login)) {
        const line = commandFor(state)
        for (const earlier of earlierPicks) {
          expect(visible(streamLook(login, earlier, line)), `${login} after ${JSON.stringify(earlier)}: ${line}`).toEqual(
            visible(lookFor(state)),
          )
          checked++
        }
      }
    }
    expect(checked).toBe(3 * 12 * (ANIMALS.length + 72) * 4)
  })
})

describe('colors', () => {
  it('dresses a nameless viewer in neutral gray, and a named one in their palette color', () => {
    expect(fallbackBodyFor(initialState())).toBe(NEUTRAL_BODY)
    const paletteIndex = lookDna('gooferg', SPEEDS).paletteIndex
    expect(fallbackBodyFor(initialState('gooferg'))).toBe(PALETTES[paletteIndex]?.body)
  })

  it("shows natural as the username's hair for a human and the animal's own fur", () => {
    const rolled = lookDna('gooferg', SPEEDS).look
    expect(naturalColorFor({ ...initialState('gooferg'), kind: 'human' })).toBe(HAIR_COLORS[rolled.hairColor])
    expect(naturalColorFor(initialState())).toBe(COLORS.brown)
    for (const kind of ANIMALS) expect(naturalColorFor({ ...initialState(), kind })).toBe(NATURAL_FUR[kind])
  })

  it('shows a color word as hair for a human and as fur for an animal', () => {
    expect(swatchColorFor(initialState(), 'black')).toBe(COLORS.black)
    expect(swatchColorFor({ ...initialState(), kind: 'cat' }, 'black')).toBe(furColor('black'))
    expect(swatchColorFor({ ...initialState(), kind: 'cat' }, 'blue')).toBe(COLORS.blue)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/builder/builderState.test.ts`
Expected: FAIL with "Failed to resolve import './builderState'".

- [ ] **Step 3: Implement**

Create `src/builder/builderState.ts`:

```ts
import { lookDna, resolveLook, type Choice } from '../avatars/look'
import { PALETTES } from '../render/sprites/contract'
import {
  COLORS,
  furColor,
  HAIR_COLORS,
  NATURAL_FUR,
  type Build,
  type ColorName,
  type HairStyle,
  type Kind,
  type Look,
} from '../render/sprites/roster'

/** A color word, or `natural`: the username's hair color for humans, the animal's own fur. */
export type ColorPick = ColorName | 'natural'

/** Everything the builder page shows; the page keeps one and replaces it on every change. */
export interface BuilderState {
  kind: Kind
  build: Build
  hairStyle: HairStyle
  /** Index into SKIN_TONES (the line says `1` for 0). */
  skin: number
  color: ColorPick
  /** The viewer's chat login, normalized; null before they type one. */
  login: string | null
  /** Their Twitch name color, '#rrggbb'; null for the username's palette color. */
  nameColor: string | null
}

/** The look before a viewer types their name: human, average build, short brown hair, skin 1, no accessory. */
export const NEUTRAL_LOOK: Look = {
  kind: 'human',
  build: 'average',
  skin: 0,
  hairStyle: 'short',
  hairColor: 1,
  accessory: null,
  color: null,
}
/** The shirt and collar color before a viewer types their name: a neutral gray. */
export const NEUTRAL_BODY = 0x9aa7b8

/** lookDna wants a walk speed range; the look doesn't depend on it. */
const ANY_SPEEDS: [number, number] = [1, 1]

/** Chat logins are lowercase, without `@` or spaces; a typed name is cleaned up the same way. */
export function normalizeLogin(raw: string): string | null {
  const login = raw.replace(/\s+/g, '').replace(/^@+/, '').toLowerCase()
  return login || null
}

/** The look the overlay rolls for this login, or the neutral look without one. */
function baseLook(login: string | null): Look {
  return login ? lookDna(login, ANY_SPEEDS).look : NEUTRAL_LOOK
}

/** The builder for a name (or none): that viewer's username look, with the natural color. */
export function initialState(rawLogin = ''): BuilderState {
  const login = normalizeLogin(rawLogin)
  const { kind, build, hairStyle, skin } = baseLook(login)
  return { kind, build, hairStyle, skin, color: 'natural', login, nameColor: null }
}

/** A different name restarts the picks from that viewer's username look; the name color stays. */
export function withLogin(state: BuilderState, rawLogin: string): BuilderState {
  if (normalizeLogin(rawLogin) === state.login) return state
  return { ...initialState(rawLogin), nameColor: state.nameColor }
}

/** The choice the copied line makes: every field the builder shows for that kind. */
function choiceFor(state: BuilderState): Choice {
  const color = state.color === 'natural' ? null : state.color
  if (state.kind !== 'human') return { kind: state.kind, color }
  return { kind: 'human', build: state.build, hairStyle: state.hairStyle, skin: state.skin, color }
}

/** What the stream shows for these picks: the username look with the line's choice on top, like the overlay. */
export function lookFor(state: BuilderState): Look {
  return resolveLook(baseLook(state.login), choiceFor(state))
}

/** The `!avatar` line naming every field the builder shows, so earlier picks can't leak through. */
export function commandFor(state: BuilderState): string {
  if (state.kind !== 'human') return `!avatar ${state.kind} ${state.color}`
  return `!avatar human ${state.build} ${state.hairStyle} ${state.skin + 1} ${state.color}`
}

/** The shirt and collar color without a name color: the username's palette color, like the overlay. */
export function fallbackBodyFor(state: BuilderState): number {
  if (!state.login) return NEUTRAL_BODY
  return PALETTES[lookDna(state.login, ANY_SPEEDS).paletteIndex]?.body ?? NEUTRAL_BODY
}

/** The `natural` swatch: the username's hair color for a human, the animal's own fur. */
export function naturalColorFor(state: BuilderState): number {
  if (state.kind !== 'human') return NATURAL_FUR[state.kind]
  return HAIR_COLORS[baseLook(state.login).hairColor] ?? COLORS.brown
}

/** A color word's swatch: hair for a human, fur for an animal (black fur is a charcoal). */
export function swatchColorFor(state: BuilderState, color: ColorName): number {
  return state.kind === 'human' ? COLORS[color] : furColor(color)
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/builder/builderState.test.ts`
Expected: PASS. The round-trip test checks 3 × 12 × 80 × 4 = 11,520 cases. A failure names the login, the earlier pick and the line.

- [ ] **Step 5: Type-check, lint and run the full suite**

Run: `npx tsc -b; npm run lint; npm test`
Expected: clean, every test passes.

- [ ] **Step 6: Commit**

```bash
git add src/builder/builderState.ts src/builder/builderState.test.ts
git commit -m "feat: builder state: the look, line and colors for a viewer's picks"
```

---

### Task 4: Builder page helpers

**Files:**
- Create: `src/builder/previewCycle.ts`, `src/builder/builderText.ts`, `src/builder/copy.ts`, `src/builder/latest.ts`
- Test: `src/builder/previewCycle.test.ts`, `src/builder/builderText.test.ts`, `src/builder/copy.test.ts`, `src/builder/latest.test.ts`

**Interfaces:**
- Consumes: `parseAvatarCommand` and `parseSkinCommand` (from the overlay; tests only), and `ANIMATIONS`, `ANIM_NAMES`, `AnimName` from `src/render/sprites/contract.ts`.
- Produces:
  - `PREVIEW_ANIMS: readonly AnimName[]`, `MIN_SHOW_MS = 2400`, `showMs(anim: AnimName): number`, `previewFrame(elapsedMs: number, pinned: AnimName | null): { anim: AnimName; ms: number }`
  - `titleFor(channel: string): string`, `cooldownNote(cooldownMs: number): string`, `VIEWER_COMMANDS: readonly { usage: string; does: string }[]`
  - `interface ClipboardLike { writeText(text: string): Promise<void> }`, `copyText(text: string, clipboard: ClipboardLike | undefined): Promise<'copied' | 'manual'>`
  - `latestOnly<A, R>(load: (arg: A) => Promise<R>, deliver: (result: R) => void, fail: (err: unknown) => void): (arg: A) => void`

- [ ] **Step 1: Write the failing tests**

Create `src/builder/previewCycle.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { ANIM_NAMES } from '../render/sprites/contract'
import { MIN_SHOW_MS, PREVIEW_ANIMS, previewFrame, showMs } from './previewCycle'

describe('PREVIEW_ANIMS', () => {
  it('is every animation a lone character plays, in sheet order', () => {
    const needsAPartner: string[] = ['highfive', 'hug', 'dizzy']
    expect(PREVIEW_ANIMS).toEqual(ANIM_NAMES.filter((anim) => !needsAPartner.includes(anim)))
  })
})

describe('previewFrame', () => {
  it('starts with idle and moves on after its turn', () => {
    expect(previewFrame(0, null)).toEqual({ anim: 'idle', ms: 0 })
    expect(previewFrame(showMs('idle') + 5, null)).toEqual({ anim: 'walk', ms: 5 })
  })

  it('shows quick animations for a while and lets slow ones play through once', () => {
    expect(showMs('idle')).toBe(MIN_SHOW_MS)
    expect(showMs('smoke')).toBe(4000) // 6 frames at 1.5 fps
  })

  it('loops back to idle after the last animation', () => {
    const cycle = PREVIEW_ANIMS.reduce((sum, anim) => sum + showMs(anim), 0)
    expect(previewFrame(cycle - 1, null).anim).toBe('bong')
    expect(previewFrame(cycle + 10, null)).toEqual({ anim: 'idle', ms: 10 })
  })

  it('plays only the pinned animation', () => {
    expect(previewFrame(123_456, 'dance')).toEqual({ anim: 'dance', ms: 123_456 })
  })
})
```

Create `src/builder/builderText.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { parseAvatarCommand, parseSkinCommand } from '../avatars/avatarCommand'
import { cooldownNote, titleFor, VIEWER_COMMANDS } from './builderText'

describe('titleFor', () => {
  it("names the channel when there's one", () => {
    expect(titleFor('gooferg')).toBe("Build your avatar for gooferg's stream")
    expect(titleFor('')).toBe('Build your avatar')
  })
})

describe('cooldownNote', () => {
  it('says how long to wait between changes, in whole seconds', () => {
    expect(cooldownNote(10_000)).toBe('Paste it in chat. Changes need about 10 seconds between them.')
    expect(cooldownNote(1_000)).toBe('Paste it in chat. Changes need about 1 second between them.')
    expect(cooldownNote(1_500)).toBe('Paste it in chat. Changes need about 2 seconds between them.')
  })

  it('leaves the wait out without a cooldown', () => {
    expect(cooldownNote(0)).toBe('Paste it in chat.')
  })
})

describe('VIEWER_COMMANDS', () => {
  it('lists every viewer command once, and not the mods-only !sesh', () => {
    expect(VIEWER_COMMANDS.map((c) => c.usage.split(' ')[0])).toEqual([
      '!avatar',
      '!skin',
      '!jump',
      '!lurk',
      '!unlurk',
      '!avatarinfo',
      '!highfive',
      '!hug',
      '!fight',
      '!accept',
      '!clap',
      '!wave',
      '!dance',
      '!smoke',
      '!nointeract',
      '!interact',
    ])
  })

  it('gives examples the overlay understands', () => {
    const args = (usage: string | undefined) => (usage ?? '').split(' ').slice(1)
    expect(parseAvatarCommand(args(VIEWER_COMMANDS[0]?.usage)).type).toBe('pick')
    expect(parseSkinCommand(args(VIEWER_COMMANDS[1]?.usage)).type).toBe('pick')
  })
})
```

Create `src/builder/copy.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { copyText } from './copy'

describe('copyText', () => {
  it('copies with the clipboard when the browser allows it', async () => {
    const written: string[] = []
    const clipboard = {
      writeText: (text: string) => {
        written.push(text)
        return Promise.resolve()
      },
    }
    expect(await copyText('!avatar fox natural', clipboard)).toBe('copied')
    expect(written).toEqual(['!avatar fox natural'])
  })

  it('asks for a manual copy when the clipboard refuses', async () => {
    const clipboard = { writeText: () => Promise.reject(new Error('denied')) }
    expect(await copyText('!avatar fox natural', clipboard)).toBe('manual')
  })

  it('asks for a manual copy without a clipboard (plain http)', async () => {
    expect(await copyText('!avatar fox natural', undefined)).toBe('manual')
  })
})
```

Create `src/builder/latest.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { latestOnly } from './latest'

function deferred<T>(): { promise: Promise<T>; resolve(value: T): void; reject(err: unknown): void } {
  let resolve: (value: T) => void = () => {}
  let reject: (err: unknown) => void = () => {}
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('latestOnly', () => {
  it('delivers only the newest call, even when an older one finishes last', async () => {
    const calls = [deferred<string>(), deferred<string>()]
    const delivered: string[] = []
    const load = latestOnly(
      (i: number) => calls[i]?.promise ?? Promise.reject(new Error('no such call')),
      (result) => delivered.push(result),
      () => {},
    )
    load(0)
    load(1)
    calls[1]?.resolve('newest')
    calls[0]?.resolve('older')
    await settle()
    expect(delivered).toEqual(['newest'])
  })

  it('reports a failure of the newest call and ignores stale ones', async () => {
    const calls = [deferred<string>(), deferred<string>()]
    const failures: unknown[] = []
    const load = latestOnly(
      (i: number) => calls[i]?.promise ?? Promise.reject(new Error('no such call')),
      () => {},
      (err) => failures.push(err),
    )
    load(0)
    load(1)
    calls[0]?.reject(new Error('stale'))
    calls[1]?.reject(new Error('newest'))
    await settle()
    expect(failures.map((err) => (err as Error).message)).toEqual(['newest'])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/builder/previewCycle.test.ts src/builder/builderText.test.ts src/builder/copy.test.ts src/builder/latest.test.ts`
Expected: FAIL, with "Failed to resolve import" for each of the four modules.

- [ ] **Step 3: Implement**

Create `src/builder/previewCycle.ts`:

```ts
import { ANIMATIONS, type AnimName } from '../render/sprites/contract'

/** What a viewer's own character can do on stream; the high-five, hug and dizzy rows need a second character. */
export const PREVIEW_ANIMS: readonly AnimName[] = [
  'idle',
  'walk',
  'jump',
  'talk',
  'cheer',
  'sad',
  'sit',
  'clap',
  'wave',
  'dance',
  'smoke',
  'bong',
]
/** While cycling, each animation shows at least this long; slower ones play through once. */
export const MIN_SHOW_MS = 2400

/** How long an animation shows while the preview cycles. */
export function showMs(anim: AnimName): number {
  const { frames, fps } = ANIMATIONS[anim]
  return Math.max(MIN_SHOW_MS, Math.ceil((frames / fps) * 1000))
}

/** The animation and how far into it, `elapsedMs` into the cycle; a pinned animation plays on its own. */
export function previewFrame(elapsedMs: number, pinned: AnimName | null): { anim: AnimName; ms: number } {
  if (pinned) return { anim: pinned, ms: elapsedMs }
  const cycle = PREVIEW_ANIMS.reduce((sum, anim) => sum + showMs(anim), 0)
  let t = ((elapsedMs % cycle) + cycle) % cycle
  for (const anim of PREVIEW_ANIMS) {
    const span = showMs(anim)
    if (t < span) return { anim, ms: t }
    t -= span
  }
  return { anim: 'idle', ms: 0 }
}
```

Create `src/builder/builderText.ts`:

```ts
/** The page title, naming the channel the overlay is set up for. */
export function titleFor(channel: string): string {
  return channel ? `Build your avatar for ${channel}'s stream` : 'Build your avatar'
}

/** Under the line: what to do with it, and the overlay's per-viewer change cooldown. */
export function cooldownNote(cooldownMs: number): string {
  const seconds = Math.ceil(cooldownMs / 1000)
  if (seconds <= 0) return 'Paste it in chat.'
  return `Paste it in chat. Changes need about ${seconds} second${seconds === 1 ? '' : 's'} between them.`
}

/** Every command a viewer can use, with an example. `!sesh` is for the streamer and mods, so it's left out. */
export const VIEWER_COMMANDS: readonly { usage: string; does: string }[] = [
  { usage: '!avatar fox blue', does: 'pick your character: a kind, build, hairstyle, skin 1-6 and color, in any order' },
  { usage: '!skin 3', does: 'change only your skin tone, 1 (light) to 6 (deep)' },
  { usage: '!jump', does: 'jump' },
  { usage: '!lurk', does: 'sit down and watch; chatting or !jump stands you back up' },
  { usage: '!unlurk', does: 'stand back up' },
  { usage: '!avatarinfo', does: 'show every character and color on stream for a few seconds' },
  { usage: '!highfive @name', does: 'run over and high-five someone on screen' },
  { usage: '!hug @name', does: 'run over and hug someone on screen' },
  { usage: '!fight @name', does: 'challenge someone; they answer with !accept or by fighting back' },
  { usage: '!accept', does: 'take on a fight challenge' },
  { usage: '!clap', does: 'clap' },
  { usage: '!wave', does: 'wave' },
  { usage: '!dance', does: 'dance' },
  { usage: '!smoke', does: 'smoke a joint, or a bong with !smoke bong' },
  { usage: '!nointeract', does: 'nobody can high-five, hug or fight you' },
  { usage: '!interact', does: 'turn high-fives, hugs and fights back on' },
]
```

Create `src/builder/copy.ts`:

```ts
/** The one clipboard method the builder uses; `navigator.clipboard` is undefined on plain http. */
export interface ClipboardLike {
  writeText(text: string): Promise<void>
}

/** Copies with the clipboard when the browser allows it; 'manual' means select the text for Ctrl+C instead. */
export async function copyText(text: string, clipboard: ClipboardLike | undefined): Promise<'copied' | 'manual'> {
  if (!clipboard) return 'manual'
  try {
    await clipboard.writeText(text)
    return 'copied'
  } catch {
    return 'manual'
  }
}
```

Create `src/builder/latest.ts`:

```ts
/**
 * Wraps an async loader so only the newest call's result is delivered:
 * when a viewer types fast, an older load that finishes late is dropped
 * instead of replacing the newer one.
 */
export function latestOnly<A, R>(
  load: (arg: A) => Promise<R>,
  deliver: (result: R) => void,
  fail: (err: unknown) => void,
): (arg: A) => void {
  let newest = 0
  return (arg) => {
    const call = ++newest
    load(arg).then(
      (result) => {
        if (call === newest) deliver(result)
      },
      (err: unknown) => {
        if (call === newest) fail(err)
      },
    )
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/builder/previewCycle.test.ts src/builder/builderText.test.ts src/builder/copy.test.ts src/builder/latest.test.ts`
Expected: PASS.

- [ ] **Step 5: Type-check, lint and run the full suite**

Run: `npx tsc -b; npm run lint; npm test`
Expected: clean, every test passes.

- [ ] **Step 6: Commit**

```bash
git add src/builder/previewCycle.ts src/builder/previewCycle.test.ts src/builder/builderText.ts src/builder/builderText.test.ts src/builder/copy.ts src/builder/copy.test.ts src/builder/latest.ts src/builder/latest.test.ts
git commit -m "feat: builder page helpers: preview cycle, page text, copy and newest-only loading"
```

---

### Task 5: The builder page

**Files:**
- Create: `builder.html`, `src/builder/builderPage.ts`, `src/builder/builder.css`

**Interfaces:**
- Consumes: everything Task 3 and Task 4 produce; `resolveConfig` (`channel`, `brandColor`, `avatarChangeCooldownMs`); `characterSheets(look, chatColor, fallbackBody)` and `drawCharacterFrame(ctx, layers, anim, ms)` from `src/render/sprites/canvasCharacter.ts`; `luma` and `MIN_LABEL_LUMA` from `src/render/color.ts`; `KINDS`, `BUILDS`, `HAIR_STYLES`, `SKIN_TONES`, `COLOR_NAMES` from the roster.
- Produces: the page at `builder.html`. Task 6 builds it, and Task 7 checks it.

This task is DOM wiring with no unit tests; the logic it calls is tested in Tasks 3 and 4. It is checked by type-checking, linting and a smoke run in the browser.

- [ ] **Step 1: Create `builder.html`** (repo root, next to `avatar-info.html`)

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="Design your stream avatar and copy the !avatar line to paste in chat." />
    <title>Build your avatar</title>
  </head>
  <body>
    <main class="builder">
      <h1 id="title">Build your avatar</h1>

      <section>
        <label for="login">Your Twitch name <span class="optional">(optional)</span></label>
        <input id="login" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="40" />
        <p id="login-note" class="note">Your accessory comes from your name. Type it above to see your exact character.</p>
      </section>

      <section>
        <label for="name-color">Your name color <span class="optional">(optional)</span></label>
        <div class="row">
          <input id="name-color" type="color" />
          <button id="name-color-reset" class="action" type="button">default</button>
        </div>
        <p class="note">The color of your name in Twitch chat. It colors the shirt and the animal collar.</p>
      </section>

      <section class="preview">
        <div class="stage"><canvas id="preview" role="img" aria-label="Your character"></canvas></div>
        <div id="anims" class="chips" role="group" aria-label="Pin an animation"></div>
      </section>

      <section>
        <h2 id="kind-title">Kind</h2>
        <div id="kinds" class="chips" role="group" aria-labelledby="kind-title"></div>
        <div id="human-only">
          <h2 id="build-title">Build</h2>
          <div id="builds" class="chips" role="group" aria-labelledby="build-title"></div>
          <h2 id="hair-title">Hair</h2>
          <div id="hairstyles" class="chips" role="group" aria-labelledby="hair-title"></div>
          <h2 id="skin-title">Skin</h2>
          <div id="skins" class="chips" role="group" aria-labelledby="skin-title"></div>
        </div>
        <h2 id="color-title">Hair color</h2>
        <div id="colors" class="chips" role="group" aria-labelledby="color-title"></div>
      </section>

      <section>
        <h2><label for="line">Your line</label></h2>
        <div class="row">
          <input id="line" type="text" readonly />
          <button id="copy" class="action" type="button">Copy</button>
        </div>
        <p id="cooldown-note" class="note"></p>
      </section>

      <section>
        <h2>Commands</h2>
        <dl id="commands"></dl>
      </section>
    </main>
    <script type="module" src="/src/builder/builderPage.ts"></script>
  </body>
</html>
```

- [ ] **Step 2: Create `src/builder/builder.css`**

```css
/* The avatar builder page: one column, in the !avatarinfo strip's pixel style. */
:root {
  --brand: #9b5cff;
  --ink: #e6dcff;
  --muted: #a99cc8;
  --gold: #ffd84a;
  --bg-top: #160c28;
  --bg-bottom: #0a0614;
  color-scheme: dark;
}

* {
  box-sizing: border-box;
}

[hidden] {
  display: none !important;
}

html {
  background: var(--bg-bottom);
}

body {
  margin: 0;
  min-height: 100vh;
  background: linear-gradient(180deg, var(--bg-top), var(--bg-bottom));
  color: var(--ink);
  font-family: 'Departure Mono', ui-monospace, monospace;
  font-size: 16px;
  line-height: 1.5;
}

.builder {
  max-width: 560px;
  margin: 0 auto;
  padding: 24px 16px 48px;
}

h1,
h2 {
  font-family: 'Press Start 2P', ui-monospace, monospace;
  font-weight: normal;
}

h1 {
  margin: 0 0 24px;
  padding: 14px 16px;
  background: var(--brand);
  color: #fff;
  font-size: 16px;
  line-height: 1.6;
  border: 4px solid #000;
  box-shadow: 6px 6px 0 rgba(0, 0, 0, 0.5);
}

h2 {
  margin: 20px 0 8px;
  color: var(--gold);
  font-size: 11px;
}

section {
  margin-bottom: 24px;
}

label {
  display: block;
  margin-bottom: 6px;
}

.optional,
.note {
  color: var(--muted);
}

.note {
  margin: 6px 0 0;
  font-size: 14px;
}

input[type='text'] {
  width: 100%;
  padding: 10px;
  font: inherit;
  color: #fff;
  background: #000;
  border: 3px solid var(--brand);
}

input[type='color'] {
  width: 56px;
  height: 40px;
  padding: 0;
  background: #000;
  border: 3px solid #000;
}

.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.row input[type='text'] {
  flex: 1 1 240px;
  min-width: 0;
}

button {
  font: inherit;
  cursor: pointer;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.chip,
.action {
  padding: 6px 10px;
  color: #fff;
  background: #000;
  border: 3px solid #000;
  box-shadow: 0 0 0 1px #3a2a5a;
}

.chip[aria-pressed='true'] {
  outline: 3px solid var(--gold);
  outline-offset: 1px;
}

.chip:not(.swatch)[aria-pressed='true'] {
  background: var(--brand);
}

/* The animation playing while the preview cycles. */
.chip.playing {
  border-color: var(--brand);
}

.action {
  background: var(--brand);
}

.action:disabled {
  opacity: 0.5;
  cursor: default;
}

button:focus-visible,
input:focus-visible {
  outline: 3px solid var(--gold);
  outline-offset: 2px;
}

.preview {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.stage {
  display: flex;
  justify-content: center;
  border-bottom: 6px solid #000;
  background: linear-gradient(0deg, color-mix(in srgb, var(--brand) 35%, transparent), transparent 75%);
}

.stage canvas {
  image-rendering: pixelated;
}

#line {
  font-size: 15px;
}

dl {
  margin: 0;
}

dt {
  margin-top: 10px;
}

dt code {
  color: var(--gold);
  font-family: inherit;
}

dd {
  margin: 2px 0 0 16px;
}
```

- [ ] **Step 3: Create `src/builder/builderPage.ts`**

```ts
import '@fontsource/press-start-2p/index.css'
import '../render/font.css'
import './builder.css'
import { resolveConfig } from '../config/resolveConfig'
import { luma, MIN_LABEL_LUMA } from '../render/color'
import { characterSheets, drawCharacterFrame } from '../render/sprites/canvasCharacter'
import { FRAME_SIZE, type AnimName } from '../render/sprites/contract'
import { BUILDS, COLOR_NAMES, HAIR_STYLES, KINDS, SKIN_TONES } from '../render/sprites/roster'
import type { SheetImage } from '../render/sprites/sheetSource'
import {
  commandFor,
  fallbackBodyFor,
  initialState,
  lookFor,
  naturalColorFor,
  swatchColorFor,
  withLogin,
  type BuilderState,
  type ColorPick,
} from './builderState'
import { cooldownNote, titleFor, VIEWER_COMMANDS } from './builderText'
import { copyText } from './copy'
import { latestOnly } from './latest'
import { PREVIEW_ANIMS, previewFrame } from './previewCycle'

/**
 * The avatar builder (builder.html, published to GitHub Pages): viewers
 * pick a look, see it drawn exactly like the stream draws it, and copy the
 * `!avatar` line. The logic lives in builderState; this file only wires the
 * page. Nothing leaves the browser.
 */

/** The preview character at 4x (192px), crisp. */
const PREVIEW_SCALE = 4
const COPY_LABEL = 'Copy'

const hex = (color: number): string => `#${color.toString(16).padStart(6, '0')}`

function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const found = document.getElementById(id)
  if (!found) throw new Error(`builder.html is missing #${id}`)
  return found as T
}

/** A swatch's color, with a label that stays readable on it (same rule as the strip). */
function paint(button: HTMLElement, color: number): void {
  button.style.background = hex(color)
  button.style.color = luma(color) >= MIN_LABEL_LUMA ? '#1a1020' : '#ffffff'
}

/** One toggle button per value; `mark` presses the current one (or none). */
function chipRow<T>(
  root: HTMLElement,
  values: readonly T[],
  label: (value: T) => string,
  onPick: (value: T) => void,
): { buttons: Map<T, HTMLButtonElement>; mark(current: T | null): void } {
  const buttons = new Map<T, HTMLButtonElement>()
  for (const value of values) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'chip'
    button.textContent = label(value)
    button.setAttribute('aria-pressed', 'false')
    button.addEventListener('click', () => onPick(value))
    root.append(button)
    buttons.set(value, button)
  }
  return {
    buttons,
    mark(current) {
      for (const [value, button] of buttons) button.setAttribute('aria-pressed', String(value === current))
    },
  }
}

function main(): void {
  const cfg = resolveConfig(new URLSearchParams())
  document.documentElement.style.setProperty('--brand', cfg.brandColor)
  const title = titleFor(cfg.channel)
  document.title = title
  byId('title').textContent = title
  byId('cooldown-note').textContent = cooldownNote(cfg.avatarChangeCooldownMs)

  const loginInput = byId<HTMLInputElement>('login')
  const loginNote = byId('login-note')
  const nameColorInput = byId<HTMLInputElement>('name-color')
  const nameColorReset = byId<HTMLButtonElement>('name-color-reset')
  const humanOnly = byId('human-only')
  const colorTitle = byId('color-title')
  const lineInput = byId<HTMLInputElement>('line')
  const copyButton = byId<HTMLButtonElement>('copy')
  const canvas = byId<HTMLCanvasElement>('preview')
  canvas.width = FRAME_SIZE
  canvas.height = FRAME_SIZE
  canvas.style.width = `${FRAME_SIZE * PREVIEW_SCALE}px`
  canvas.style.height = `${FRAME_SIZE * PREVIEW_SCALE}px`
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2d canvas context unavailable')

  let state: BuilderState = initialState()
  const update = (next: BuilderState): void => {
    state = next
    render()
  }

  const kinds = chipRow(byId('kinds'), KINDS, (kind) => kind, (kind) => update({ ...state, kind }))
  const builds = chipRow(byId('builds'), BUILDS, (build) => build, (build) => update({ ...state, build }))
  const hairs = chipRow(byId('hairstyles'), HAIR_STYLES, (style) => style, (hairStyle) => update({ ...state, hairStyle }))
  const skins = chipRow(
    byId('skins'),
    SKIN_TONES.map((_, i) => i),
    (skin) => String(skin + 1),
    (skin) => update({ ...state, skin }),
  )
  for (const [skin, button] of skins.buttons) {
    button.classList.add('swatch')
    paint(button, SKIN_TONES[skin] ?? 0xffffff)
  }
  const colorPicks: readonly ColorPick[] = [...COLOR_NAMES, 'natural']
  const colors = chipRow(byId('colors'), colorPicks, (color) => color, (color) => update({ ...state, color }))
  for (const button of colors.buttons.values()) button.classList.add('swatch')

  // The preview: sheets load async, and only the newest picks' sheets are kept.
  let layers: SheetImage[] | null = null
  const load = latestOnly(
    (s: BuilderState) => characterSheets(lookFor(s), s.nameColor, fallbackBodyFor(s)),
    (loaded) => {
      layers = loaded
    },
    (err) => console.error('[chat-avatars] builder: the preview failed to load', err),
  )
  let pinned: AnimName | null = null
  let cycleStart = performance.now()
  const anims = chipRow(byId('anims'), PREVIEW_ANIMS, (anim) => anim, (anim) => pin(anim))
  /** Pins an animation (restarting it), or unpins it to resume the cycle from idle. */
  function pin(anim: AnimName): void {
    pinned = pinned === anim ? null : anim
    cycleStart = performance.now()
    anims.mark(pinned)
  }
  let playing: AnimName | null = null
  const frame = (now: number): void => {
    const { anim, ms } = previewFrame(now - cycleStart, pinned)
    if (layers) drawCharacterFrame(ctx, layers, anim, ms)
    if (anim !== playing) {
      if (playing) anims.buttons.get(playing)?.classList.remove('playing')
      anims.buttons.get(anim)?.classList.add('playing')
      playing = anim
    }
    requestAnimationFrame(frame)
  }

  function render(): void {
    kinds.mark(state.kind)
    builds.mark(state.build)
    hairs.mark(state.hairStyle)
    skins.mark(state.skin)
    colors.mark(state.color)
    for (const [pick, button] of colors.buttons) {
      paint(button, pick === 'natural' ? naturalColorFor(state) : swatchColorFor(state, pick))
    }
    humanOnly.hidden = state.kind !== 'human'
    colorTitle.textContent = state.kind === 'human' ? 'Hair color' : 'Fur color'
    loginNote.hidden = state.login !== null
    nameColorInput.value = state.nameColor ?? hex(fallbackBodyFor(state))
    nameColorReset.disabled = state.nameColor === null
    const line = commandFor(state)
    if (lineInput.value !== line) {
      lineInput.value = line
      copyButton.textContent = COPY_LABEL
    }
    load(state)
  }

  loginInput.addEventListener('input', () => update(withLogin(state, loginInput.value)))
  nameColorInput.addEventListener('input', () => update({ ...state, nameColor: nameColorInput.value }))
  nameColorReset.addEventListener('click', () => update({ ...state, nameColor: null }))
  copyButton.addEventListener('click', () => {
    void copyText(lineInput.value, navigator.clipboard).then((result) => {
      if (result === 'copied') {
        copyButton.textContent = 'Copied!'
        return
      }
      lineInput.focus()
      lineInput.select()
      copyButton.textContent = 'Selected: press Ctrl+C'
    })
  })

  const commandList = byId('commands')
  for (const { usage, does } of VIEWER_COMMANDS) {
    const term = document.createElement('dt')
    const code = document.createElement('code')
    code.textContent = usage
    term.append(code)
    const detail = document.createElement('dd')
    detail.textContent = does
    commandList.append(term, detail)
  }

  render()
  requestAnimationFrame(frame)
}

main()
```

- [ ] **Step 4: Type-check and lint**

Run: `npx tsc -b; npm run lint`
Expected: no type errors, lint clean.

- [ ] **Step 5: Smoke run in the browser**

Start the dev server in the background: `npx vite --port 5180 --strictPort`. Open `http://localhost:5180/builder.html` in Chrome.
Expected:
- The title reads "Build your avatar for gooferg's stream".
- A human with short brown hair cycles idle → walk → … in the preview.
- The line reads `!avatar human average short 1 natural`.
- Clicking **fox** hides Build/Hair/Skin, renames the color heading "Fur color", turns the natural chip orange, and changes the line to `!avatar fox natural`.
- The console has no errors.

Stop the server afterwards. TaskStop doesn't kill vite's node child, so stop it with PowerShell: `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object CommandLine -match '5180' | ForEach-Object { Stop-Process -Id $_.ProcessId }`.

- [ ] **Step 6: Commit**

```bash
git add builder.html src/builder/builderPage.ts src/builder/builder.css
git commit -m "feat: avatar builder page"
```

---

### Task 6: Site build and GitHub Pages workflow

**Files:**
- Create: `vite.site.config.ts`, `.github/workflows/pages.yml`
- Modify: `package.json` (scripts), `tsconfig.node.json` (include), `.gitignore`, `README.md` (builder section)

**Interfaces:**
- Consumes: `builder.html` (Task 5).
- Produces: `npm run build:site`, which writes `dist-site/builder.html` plus its `assets/`. Also the workflow `Builder page`: on pull requests it runs `npm ci`, lint, test and build; on push to `main` or a manual run it also deploys.

- [ ] **Step 1: Write the site config**

Create `vite.site.config.ts`:

```ts
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// The viewer-facing avatar builder, the only page published (GitHub Pages,
// see .github/workflows/pages.yml). The overlay and the strip stay local.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist-site',
    rolldownOptions: {
      input: { builder: fileURLToPath(new URL('./builder.html', import.meta.url)) },
    },
  },
})
```

In `package.json`, add a script after `"build"`:

```json
    "build:site": "tsc -b && vite build --config vite.site.config.ts",
```

In `tsconfig.node.json`, change the include:

```json
  "include": ["vite.config.ts", "vite.site.config.ts"]
```

In `.gitignore`, add `dist-site` on the line after `dist`.

- [ ] **Step 2: Build it and check the output**

Run: `npm run build:site; ls dist-site dist-site/assets; grep -o 'src="[^"]*"' dist-site/builder.html`
Expected:
- `dist-site/` holds only `builder.html` and `assets/`: no `index.html` and no `avatar-info.html`.
- The script `src` is relative (`./assets/builder-….js`).
- `git status` doesn't list `dist-site`.

- [ ] **Step 3: Write the workflow**

First confirm each action's newest major version, and use it if it's newer than the one below. For example: `gh api repos/actions/checkout/releases/latest --jq .tag_name`, and the same for `actions/setup-node`, `actions/upload-pages-artifact` and `actions/deploy-pages`.

Create `.github/workflows/pages.yml`:

```yaml
# The avatar builder page: tested and built on every pull request,
# deployed to GitHub Pages on every merge to main.
# One-time setup: Settings -> Pages -> Source: GitHub Actions.
name: Builder page

on:
  pull_request:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: pages-${{ github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run build:site
      - if: github.event_name != 'pull_request'
        uses: actions/upload-pages-artifact@v4
        with:
          path: dist-site

  deploy:
    if: github.event_name != 'pull_request'
    needs: build
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}builder.html
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 4: Document it**

In `README.md`, add this section right before `## Chat reactions`:

```md
## Avatar builder page

`builder.html` is a page viewers open in their own browser to design their character. They pick a look, see it exactly as the stream draws it, and copy one `!avatar` line to paste in chat. The line always names every field, so earlier picks can't leak through. It's published to GitHub Pages at <https://gooferg.github.io/stream-avatars/builder.html>; the overlay and the strip stay local OBS files. The page makes no network requests, so a typed name never leaves the viewer's browser.

- **Publishing:** `.github/workflows/pages.yml` lints, tests and builds the page on every pull request, and deploys it on every merge to `main`. One-time setup: the repo's **Settings → Pages → Source: GitHub Actions**. Until that's set, the deploy job fails.
- **Building it yourself:** `npm run build:site` writes `dist-site/builder.html`. While developing, `npm run dev` serves it at `http://localhost:5173/builder.html`.
- **What it reads:** `channel` (the title), `brandColor` and `avatarChangeCooldownMs` from `src/config/overrides.ts`, when it's built.
- **On the strip:** set `builderUrl` in `src/config/overrides.ts` to the page's address, and the `!avatarinfo` strip shows "build yours: <address>" along its bottom.
- **In chat:** the overlay never posts in chat, so add a bot command for the link, e.g. Nightbot: `!commands add !build Build your avatar: https://gooferg.github.io/stream-avatars/builder.html`, or a StreamElements custom command `!build` with the same text.
```

- [ ] **Step 5: Verify the whole build still passes**

Run: `npx tsc -b; npm run lint; npm test; npm run build`
Expected: all clean. `npm run build` still builds only the overlay and the strip into `dist/`.

- [ ] **Step 6: Commit**

```bash
git add vite.site.config.ts package.json tsconfig.node.json .gitignore .github/workflows/pages.yml README.md
git commit -m "ci: build the builder page on PRs and deploy it to GitHub Pages"
```

---

### Task 7: End-to-end check in Chrome

**Files:**
- Temporarily modify (never commit): `src/config/overrides.ts`

**Interfaces:**
- Consumes: everything above.
- Produces: verification evidence (screenshots and checks noted in the ledger); no code unless a check fails. Any fix gets a failing test first, in the task that owns the code.

For console checks, use the production builds served by `vite preview`: dev mode's StrictMode leaves `window.__chatAvatars` stale. Stop every server at the end with PowerShell `Stop-Process` (see Task 5, Step 5).

- [ ] **Step 1: The strip, with a builder link**

1. Temporarily add `builderUrl: 'https://gooferg.github.io/stream-avatars/builder.html',` to `OVERRIDES` in `src/config/overrides.ts`.
2. Run `npm run build`, then start `npx vite preview --port 4173 --strictPort` in the background.
3. Open `http://localhost:4173/avatar-info.html?debug=1` and click to raise the strip. Take a screenshot.

Expected:
- A **natural** chip with a striped background ends the color row, which still fits in two rows above the lineup.
- "build yours: gooferg.github.io/stream-avatars/builder.html" sits along the bottom edge under the lineup, without overlapping it.

Then set `builderUrl: 'https://example.test/' + 'a'.repeat(180),` (a 200-character address), rebuild, reload and raise the strip again. Expected: the line ends in an ellipsis before the right edge.

4. Run `git checkout src/config/overrides.ts`, then rebuild with `npm run build`.

- [ ] **Step 2: The builder at desktop width**

1. Run `npm run build:site`, then start `npx vite preview --config vite.site.config.ts --port 4174 --strictPort` in the background.
2. Open `http://localhost:4174/builder.html`.

Expected:
- **Preview:** it cycles through all 12 animations, with the playing chip outlined. Pinning **dance** holds it, and clicking it again resumes the cycle.
- **Name:** typing `GooferG` switches to gooferg's username look and hides the accessory note. Adding a trailing space keeps the current picks.
- **Name color:** changing it recolors the shirt (or the collar on an animal). **default** goes back to the palette color.
- **Copy:** it shows "Copied!", or, when Chrome refuses the clipboard, it selects the line and shows "Selected: press Ctrl+C".
- **Network:** `read_network_requests` lists only `localhost:4174` requests.
- **Console:** no errors.

- [ ] **Step 3: The builder at phone width**

Resize the window to 360 px wide (`resize_window`). Then run in the page: `document.documentElement.scrollWidth <= window.innerWidth`.
Expected: `true`. The chips wrap, the 192 px preview fits, and the line and Copy button stay usable (the button may wrap under the line). Take a screenshot.

- [ ] **Step 4: The builder matches the overlay**

1. Start `npx vite preview --port 4173 --strictPort` (the overlay build from Step 1).
2. Open `http://localhost:4173/?debug=1`.
3. In the builder, type `builder_check`, pick a human with a color word, and copy the line it shows. Also note the line for **fox** + **natural**.
4. In the overlay console, paste each line as that viewer:

```js
const msg = (text) => ({ login: 'builder_check', displayName: 'builder_check', color: null, text, emotes: [], messageId: String(Math.random()), timestamp: Date.now(), tags: {} })
const say = (line) => { const [bang, ...args] = line.split(' '); __chatAvatars.commands.dispatch({ name: bang.slice(1), args, message: msg(line) }) }
say('<the human line from the builder>')
```

Expected: the overlay's `builder_check` matches the builder's preview: kind, build, skin, hairstyle, hair color, accessory and shirt color. Wait out the 10 s change cooldown, then `say('<the fox natural line>')`. Expected: a fox in its natural orange fur, with a collar in the same color as the builder's.

- [ ] **Step 5: Final suite run**

Run: `npx tsc -b; npm run lint; npm test; npm run build; npm run build:site`
Expected: all clean. `git status` shows a clean tree (`overrides.ts` restored, `dist/` and `dist-site/` ignored).

After this task: run the whole-branch final review, then superpowers:finishing-a-development-branch. The streamer's usual path is to push, open a PR, and merge with a merge commit when they say so. Once the PR is open, `gh pr checks <number> --watch` must show the `Builder page` workflow passing before asking to merge. Its PR run doesn't deploy. After the merge, remind the streamer to set **Settings → Pages → Source: GitHub Actions**, or ask permission to set it with `gh api`. Then rerun the workflow and load the deployed URL.
