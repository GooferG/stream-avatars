# Chat Reactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Avatars cheer (arms up) or droop (sad face) when chat hypes or mourns: the sender's avatar reacts to their own message, and the whole crowd reacts when 3+ different chatters do it within 10 seconds.

**Architecture:**
- A new pure module, `src/chat/mood.ts` (`ChatMood`), turns chat messages into `Reaction`s.
- `AvatarManager.react` hands each reaction to the avatars' state machines, which gain a `react` state.
- The sprite contract grows from 4 to 6 rows (cheer, sad). The built-in placeholder art gets always-visible arms and new faces, drawn through shared helpers.

**Tech Stack:** Vite 8, TypeScript ~6 (strict), PixiJS 8, React 19 (shell only), vitest 4 (node environment), oxlint.

**Spec:** `docs/superpowers/specs/2026-09-25-chat-reactions-design.md`

All paths below are relative to the project root. Run every command from that folder.

## Global Constraints

- `npx tsc -b`, `npx oxlint` and `npm test` must all pass at the end of every task. The tsconfig is strict, with `noUncheckedIndexedAccess`, `noUnusedLocals` and `noUnusedParameters`.
- Pure modules must not import `pixi.js` or touch the DOM at module load, because vitest runs them in a node environment. The pure modules are `chat/mood.ts`, `avatars/stateMachine.ts`, `render/sprites/contract.ts` and the pose tables and arm geometry in `render/sprites/placeholder.ts`.
- The overlay must keep working as an OBS local file:
  - no runtime fetches of local files
  - `npm run build` produces `dist/index.html`
  - `src/config/overrides.ts` keeps `channel: 'gooferg'`
- Sprite sheet: **192x192 px**, a 6x6 grid of 32x32 frames. Rows: idle 0 (4f, 4fps), walk 1 (6f, 10fps), jump 2 (6f, 10fps), talk 3 (4f, 6fps), cheer 4 (4f, 6fps), sad 5 (4f, 2fps). Art is grayscale with a black outline; white and gray take the tint.
- Defaults, verbatim from the spec:
  - `crowdChatters` 3, `crowdWindowMs` 10 000, `crowdCooldownMs` 15 000, `selfReactionMs` 2000, `crowdReactionMs` 4000
  - `MAX_REPEAT_WORDS` 3, `MAX_REMEMBERED` 500, `CROWD_RIPPLE_MS` 400
- Default hype words: `w`, `lets go`, `letsgo`, `lfg`, `pog`, `poggers`, `pogchamp`, `pogu`, `hype`, `clutch`, `gg`, `ez`, `sheesh`, `goated`
- Default sad words: `l`, `f`, `o7`, `rip`, `ripbozo`, `sadge`, `biblethump`, `notlikethis`, `unlucky`, `pain`
- URL params: `crowdChatters` (2-50), `crowdWindowSec` (2-120), `crowdCooldownSec` (0-600).
- Git commit messages must **not** include `Co-Authored-By` or any Claude/AI attribution trailer (user's global rule).

## Review Focus

1. **Emoji-only, non-Latin or punctuation-only messages** must produce no reaction and never throw. Tests: Task 4 (`normalizeMessage` returns `[]`) and Task 5 (`observe` returns `[]` and remembers nothing).
2. **Word-list entries typed with caps or punctuation in overrides** (`'LETS GO!'`, `'PogChamp'`) must still match chat. Test: Task 4 (`compileWords`).
3. **`crowdChatters` set to 0 or 1 in overrides.ts** must fall back to 3, not fire a crowd reaction on every message. Test: Task 3.
4. **Raid-sized spam** (thousands of messages inside the window) must keep memory capped at 500 entries. Test: Task 5.
5. **A brand-new chatter's first message being hype** means their avatar is still walking in. That must not crash or play a reaction, and they must still count toward the crowd. Tests: Task 6 (reaction ignored while `entering`); Task 5 counts every login regardless of avatars.

---

### Task 0: Put the project under git

The project folder is not a git repository yet. Reviews and "commit" steps need one.

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Initialize and make a baseline commit**

```bash
git init
printf '\n# brainstorming companion scratch files\n.superpowers/\n' >> .gitignore
git add -A
git commit -m "chore: baseline before chat reactions"
```

Expected: one commit containing `src/`, `docs/`, config files, `README.md`. `node_modules/` and `dist/` are excluded by the existing `.gitignore`.

---

### Task 1: Six-row sprite contract (single source of animation names)

**Files:**
- Modify: `src/render/sprites/contract.ts`
- Modify: `src/render/sprites/contract.test.ts`
- Modify: `src/render/sprites/loader.ts`
- Modify: `src/render/sprites/placeholder.ts` (temporary cheer/sad poses; the real art comes in Task 2)
- Modify: `src/avatars/stateMachine.ts:1-5`
- Modify: `src/avatars/avatar.ts`
- Modify: `README.md` (Sprite sheet contract section)

**Interfaces:**
- Consumes: nothing new.
- Produces (later tasks rely on these exact names):
  - `export type AnimName = keyof typeof ANIMATIONS` (`'idle' | 'walk' | 'jump' | 'talk' | 'cheer' | 'sad'`) from `render/sprites/contract.ts`
  - `export const ANIM_NAMES: AnimName[]` from `contract.ts`
  - `export function isSheetSize(width: number, height: number): boolean` from `contract.ts`
  - `export type AnimationSet = Record<AnimName, Texture[]>` from `render/sprites/loader.ts`

- [ ] **Step 1: Write the failing tests**

In `src/render/sprites/contract.test.ts`, replace the import line with:

```ts
import { describe, expect, it } from 'vitest'
import {
  ANIM_NAMES,
  ANIMATIONS,
  SHEET_COLS,
  SHEET_ROWS,
  findSheet,
  isSheetSize,
  sheetFile,
} from './contract'
```

and append at the end of the file:

```ts
describe('animation rows', () => {
  it('gives every animation its own row inside the sheet', () => {
    const rows = ANIM_NAMES.map((name) => ANIMATIONS[name].row)
    expect(new Set(rows).size).toBe(rows.length)
    for (const name of ANIM_NAMES) {
      expect(ANIMATIONS[name].row).toBeLessThan(SHEET_ROWS)
      expect(ANIMATIONS[name].frames).toBeLessThanOrEqual(SHEET_COLS)
    }
  })

  it('puts the reactions in rows 4 and 5', () => {
    expect(ANIMATIONS.cheer).toEqual({ row: 4, frames: 4, fps: 6 })
    expect(ANIMATIONS.sad).toEqual({ row: 5, frames: 4, fps: 2 })
  })
})

describe('isSheetSize', () => {
  it('accepts only the 6x6 grid of 32px frames', () => {
    expect(isSheetSize(192, 192)).toBe(true)
    expect(isSheetSize(192, 128)).toBe(false) // old 4-row sheets
    expect(isSheetSize(96, 96)).toBe(false)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/render/sprites/contract.test.ts`
Expected: FAIL. `ANIM_NAMES`/`isSheetSize` are not exported, and `ANIMATIONS.cheer` is undefined.

- [ ] **Step 3: Implement the contract**

In `src/render/sprites/contract.ts`:

Replace the header comment's grid lines:

```ts
 * - 32x32 frames on a 6x4 grid (192x128 px), one animation per row.
```

with:

```ts
 * - 32x32 frames on a 6x6 grid (192x192 px), one animation per row.
 * - Arms are part of each body sheet (always visible, every row).
```

Replace `export const SHEET_ROWS = 4` with `export const SHEET_ROWS = 6`.

After `export const SHEET_HEIGHT = FRAME_SIZE * SHEET_ROWS` add:

```ts

/** A dropped-in PNG must match the grid exactly; anything else falls back to the placeholder. */
export function isSheetSize(width: number, height: number): boolean {
  return width === SHEET_WIDTH && height === SHEET_HEIGHT
}
```

Replace the `ANIMATIONS` block with:

```ts
export const ANIMATIONS = {
  idle: { row: 0, frames: 4, fps: 4 },
  walk: { row: 1, frames: 6, fps: 10 },
  jump: { row: 2, frames: 6, fps: 10 },
  talk: { row: 3, frames: 4, fps: 6 },
  cheer: { row: 4, frames: 4, fps: 6 },
  sad: { row: 5, frames: 4, fps: 2 },
} as const satisfies Record<string, AnimationSpec>

/** Every animation a sheet provides, one row each. The single source of animation names. */
export type AnimName = keyof typeof ANIMATIONS
export const ANIM_NAMES = Object.keys(ANIMATIONS) as AnimName[]
```

- [ ] **Step 4: Switch the consumers to the contract's names**

`src/avatars/stateMachine.ts`: replace lines 1-5:

```ts
import { clamp } from '../utils/math'
import type { Rng } from '../utils/rng'
import { range } from '../utils/rng'

export type AnimName = 'idle' | 'walk' | 'jump' | 'talk'
```

with:

```ts
import type { AnimName } from '../render/sprites/contract'
import { clamp } from '../utils/math'
import type { Rng } from '../utils/rng'
import { range } from '../utils/rng'
```

`src/render/sprites/loader.ts`:
- In the contract import list, replace `ANIMATIONS,` with `ANIM_NAMES,\n  ANIMATIONS,` and add `SHEET_HEIGHT,`, `SHEET_WIDTH,`, `isSheetSize,` and `type AnimName,`.
- Replace the `AnimationSet` interface:

```ts
export type AnimationSet = Record<AnimName, Texture[]>
```

- Replace `loadPng` with:

```ts
/** A sheet that exists but fails to decode, or has the wrong size, falls back instead of breaking. */
async function loadPng(url: string): Promise<Texture | null> {
  try {
    const texture = await Assets.load<Texture>(url)
    if (isSheetSize(texture.width, texture.height)) return texture
    console.warn(
      `[chat-avatars] sprite sheet is ${texture.width}x${texture.height}, expected ${SHEET_WIDTH}x${SHEET_HEIGHT}; using placeholder`,
      url,
    )
    return null
  } catch (err) {
    console.warn('[chat-avatars] sprite sheet failed to load, using placeholder', url, err)
    return null
  }
}
```

- Replace the `return { idle: ..., talk: ... }` at the end of `sliceSheet` with:

```ts
  return Object.fromEntries(
    ANIM_NAMES.map((name) => [name, slice(ANIMATIONS[name])]),
  ) as AnimationSet
```

`src/avatars/avatar.ts`:
- Replace `import { ANIMATIONS } from '../render/sprites/contract'` with `import { ANIM_NAMES, ANIMATIONS, type AnimName } from '../render/sprites/contract'`.
- Replace `import { JUMP_HEIGHT, type AnimName, type AvatarStateMachine } from './stateMachine'` with `import { JUMP_HEIGHT, type AvatarStateMachine } from './stateMachine'`.
- Above `export interface AvatarDisplayOptions` add:

```ts
interface AnimGroup {
  group: Container
  sprites: AnimatedSprite[]
}
```

- Replace `private groups: Record<AnimName, { group: Container; sprites: AnimatedSprite[] }>` with `private groups: Record<AnimName, AnimGroup>`.
- Replace the hard-coded groups block:

```ts
    this.groups = {
      idle: this.buildGroup('idle', options),
      walk: this.buildGroup('walk', options),
      jump: this.buildGroup('jump', options),
      talk: this.buildGroup('talk', options),
    }
```

with:

```ts
    // one pre-built group per sheet row; new animations need no edit here
    this.groups = Object.fromEntries(
      ANIM_NAMES.map((name) => [name, this.buildGroup(name, options)]),
    ) as Record<AnimName, AnimGroup>
```

- Change `buildGroup`'s return type annotation `{ group: Container; sprites: AnimatedSprite[] }` to `AnimGroup`.
- Update the class doc comment's "Four pre-built animation groups" to "One pre-built animation group per sheet row".

`src/render/sprites/placeholder.ts` (temporary rows; Task 2 replaces this file):
- Add `type AnimName,` to the contract import list and delete the line `type AnimKey = keyof typeof ANIMATIONS`.
- Replace both remaining `AnimKey` occurrences with `AnimName`.
- In `POSES`, after the `talk:` line add:

```ts
  cheer: [pose(0), pose(-3, 0, 0, true), pose(-4, 0, 0, true), pose(-2)],
  sad: [pose(1, 2), pose(1, 2), pose(2, 3), pose(2, 3)],
```

- [ ] **Step 5: Run everything**

Run: `npm test && npx tsc -b && npx oxlint`
Expected: all tests PASS (the new contract tests included), with no type or lint errors.

- [ ] **Step 6: Update the README sprite section**

In `README.md`, replace `- **192 x 128 px** PNG: a 6 x 4 grid of **32 x 32** frames.` with `- **192 x 192 px** PNG: a 6 x 6 grid of **32 x 32** frames. A sheet of any other size is ignored (with a console warning) and the built-in art is used.`

Add two rows to the row table after the `talk` row:

```md
| 4 | cheer | 4 | 6 |
| 5 | sad | 4 | 2 |
```

Replace `- Unused cells in short rows (idle and talk) are ignored.` with:

```md
- Unused cells in short rows (idle, talk, cheer, sad) are ignored.
- Arms are part of each body sheet and visible in every row (hanging at the sides when idle, swinging when walking, up when cheering, limp when sad).
```

- [ ] **Step 7: Commit**

```bash
git add src/render/sprites src/avatars/stateMachine.ts src/avatars/avatar.ts README.md
git commit -m "feat: six-row sprite contract with cheer and sad rows"
```

---

### Task 2: Placeholder art with arms and reaction faces, plus a sheet preview page

**Files:**
- Rewrite: `src/render/sprites/placeholder.ts`
- Create: `src/render/sprites/placeholder.test.ts`
- Create: `sheet-preview.html` (project root; dev server only, not part of the build)
- Create: `src/app/sheetPreview.ts`

**Interfaces:**
- Consumes: `AnimName`, `ANIM_NAMES`, `ANIMATIONS`, `FRAME_SIZE`, `SHEET_WIDTH`, `SHEET_HEIGHT`, `PALETTES`, `BODY_COUNT`, `ACCESSORY_COUNT` from `contract.ts`.
- Produces:
  - `paintBodySheet(bodyIndex: number): HTMLCanvasElement` (unchanged signature)
  - `paintAccessorySheet(accessoryIndex: number): HTMLCanvasElement` (unchanged signature)
  - For tests: `POSES: Record<AnimName, Pose[]>`, `BODIES: Body[]`, `armRects(arms: Arms, geo: BodyGeometry): PixelRect[]` and their types

- [ ] **Step 1: Write the failing tests**

Create `src/render/sprites/placeholder.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { ANIM_NAMES, ANIMATIONS, FRAME_SIZE } from './contract'
import { BODIES, POSES, armRects } from './placeholder'

describe('placeholder poses', () => {
  it('has exactly one pose per frame for every animation', () => {
    for (const name of ANIM_NAMES) {
      expect(POSES[name]).toHaveLength(ANIMATIONS[name].frames)
    }
  })

  it('keeps both arms inside the 32px frame for every body and pose', () => {
    for (const body of BODIES) {
      for (const name of ANIM_NAMES) {
        for (const pose of POSES[name]) {
          for (const r of armRects(pose.arms, body.geometry(pose))) {
            expect(r.x).toBeGreaterThanOrEqual(0)
            expect(r.x + r.w).toBeLessThanOrEqual(FRAME_SIZE)
            expect(r.y + pose.dy).toBeGreaterThanOrEqual(0)
            expect(r.y + r.h + pose.dy).toBeLessThanOrEqual(FRAME_SIZE)
          }
        }
      }
    }
  })

  it('mirrors the right arm onto the other side of the body', () => {
    const geo = { left: 9, right: 23, shoulderY: 20, eyeY: 16 }
    const [leftOutline, rightOutline] = armRects('down', geo)
    expect(leftOutline).toEqual({ x: 7, y: 19, w: 3, h: 7, ink: 'outline' })
    expect(rightOutline).toEqual({ x: 23, y: 19, w: 3, h: 7, ink: 'outline' })
  })

  it('gives the reaction rows their faces and arms', () => {
    expect(POSES.cheer.every((p) => p.face === 'happy' || p.face === 'grin')).toBe(true)
    expect(POSES.cheer.some((p) => p.arms === 'up')).toBe(true)
    expect(POSES.sad.every((p) => p.face === 'sad' && p.arms === 'limp')).toBe(true)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/render/sprites/placeholder.test.ts`
Expected: FAIL. `BODIES`, `POSES` and `armRects` are not exported.

- [ ] **Step 3: Rewrite `src/render/sprites/placeholder.ts`**

Replace the whole file with:

```ts
import {
  ANIM_NAMES,
  ANIMATIONS,
  FRAME_SIZE,
  SHEET_HEIGHT,
  SHEET_WIDTH,
  type AnimName,
} from './contract'

/**
 * Runtime-generated grayscale sprite sheets that follow the exact same
 * contract as hand-drawn PNGs. Three body types (slime, bot, ghost) with
 * always-visible arms, and four accessories (cap, bow, glasses, scarf).
 * White/gray areas take the per-avatar tint; black stays black.
 */

const OUTLINE = '#000000'
const MAIN = '#ffffff'
const SHADE = '#9c9c9c'

/** Arm pose for the whole character; ARM_POSES maps it to a shape per side. */
export type Arms = 'down' | 'swingA' | 'swingB' | 'mid' | 'up' | 'gesture' | 'limp'
export type Face = 'normal' | 'talk' | 'happy' | 'grin' | 'sad'

export interface Pose {
  /** Vertical offset for the whole character (negative = up / airborne). */
  dy: number
  /** Pixels removed from the top of the body (landing/crouch squash, slump). */
  squash: number
  /** 0 = feet together, 1 = left forward, 2 = right forward. */
  leg: number
  arms: Arms
  face: Face
}

function pose(
  dy = 0,
  squash = 0,
  extra: Partial<Pick<Pose, 'leg' | 'arms' | 'face'>> = {},
): Pose {
  return { dy, squash, leg: 0, arms: 'down', face: 'normal', ...extra }
}

export const POSES: Record<AnimName, Pose[]> = {
  idle: [pose(0), pose(-1), pose(-1), pose(0)],
  walk: [
    pose(0, 0, { leg: 1, arms: 'swingA' }),
    pose(-1),
    pose(0, 0, { leg: 2, arms: 'swingB' }),
    pose(0, 0, { leg: 1, arms: 'swingA' }),
    pose(-1),
    pose(0, 0, { leg: 2, arms: 'swingB' }),
  ],
  jump: [
    pose(2, 3),
    pose(-3, 0, { arms: 'mid' }),
    pose(-6, 0, { arms: 'up' }),
    pose(-6, 0, { arms: 'up' }),
    pose(-3, 0, { arms: 'mid' }),
    pose(2, 3),
  ],
  talk: [
    pose(0),
    pose(0, 0, { arms: 'gesture', face: 'talk' }),
    pose(0),
    pose(0, 0, { arms: 'gesture', face: 'talk' }),
  ],
  cheer: [
    pose(0, 0, { arms: 'mid', face: 'happy' }),
    pose(-3, 0, { arms: 'up', face: 'grin' }),
    pose(-4, 0, { arms: 'up', face: 'grin' }),
    pose(-2, 0, { arms: 'mid', face: 'happy' }),
  ],
  sad: [
    pose(1, 2, { arms: 'limp', face: 'sad' }),
    pose(1, 2, { arms: 'limp', face: 'sad' }),
    pose(2, 3, { arms: 'limp', face: 'sad' }),
    pose(2, 3, { arms: 'limp', face: 'sad' }),
  ],
}

// ---- arms -------------------------------------------------------------

type ArmShape = 'down' | 'raised' | 'mid' | 'up' | 'limp'
type Cell = [dx: number, dy: number, w: number, h: number]

/** Left arm, relative to the body's left edge and shoulder line; the right arm mirrors it. */
const ARM_SHAPES: Record<ArmShape, { outline: Cell[]; fill: Cell[] }> = {
  down: { outline: [[-2, -1, 3, 7]], fill: [[-1, 0, 1, 5]] },
  raised: {
    outline: [[-2, -1, 3, 3], [-3, 1, 3, 4]],
    fill: [[-1, 0, 1, 1], [-2, 2, 1, 2]],
  },
  mid: {
    outline: [[-2, -1, 3, 3], [-4, -2, 3, 3], [-7, -4, 4, 4]],
    fill: [[-1, 0, 1, 1], [-3, -1, 1, 1], [-6, -3, 2, 2]],
  },
  up: {
    outline: [[-2, -1, 3, 3], [-3, -3, 3, 3], [-4, -5, 3, 3], [-6, -9, 4, 5]],
    fill: [[-1, 0, 1, 1], [-2, -2, 1, 1], [-3, -4, 1, 1], [-5, -8, 2, 3]],
  },
  limp: { outline: [[-2, 0, 3, 6]], fill: [[-1, 1, 1, 4]] },
}

const ARM_POSES: Record<Arms, [left: ArmShape, right: ArmShape]> = {
  down: ['down', 'down'],
  swingA: ['raised', 'down'],
  swingB: ['down', 'raised'],
  mid: ['mid', 'mid'],
  up: ['up', 'up'],
  gesture: ['down', 'mid'],
  limp: ['limp', 'limp'],
}

export interface PixelRect {
  x: number
  y: number
  w: number
  h: number
  ink: 'outline' | 'main'
}

/** Both arms as frame-pixel rects (before the pose's dy), outlines first so fills sit on top. */
export function armRects(arms: Arms, geo: BodyGeometry): PixelRect[] {
  const rects: PixelRect[] = []
  const [leftShape, rightShape] = ARM_POSES[arms]
  for (const ink of ['outline', 'main'] as const) {
    for (const [shape, side] of [[leftShape, 'left'], [rightShape, 'right']] as const) {
      const cells = ink === 'outline' ? ARM_SHAPES[shape].outline : ARM_SHAPES[shape].fill
      for (const [dx, dy, w, h] of cells) {
        const x = side === 'left' ? geo.left + dx : geo.right - dx - w + 1
        rects.push({ x, y: geo.shoulderY + dy, w, h, ink })
      }
    }
  }
  return rects
}

// ---- faces ------------------------------------------------------------

/** Eyes at x 14 and 19 on every body; the mouth sits 5px below the eye line. */
function drawFace(ctx: CanvasRenderingContext2D, eyeY: number, face: Face): void {
  const px = (x: number, y: number, w = 1, h = 1) => ctx.fillRect(x, y, w, h)
  ctx.fillStyle = OUTLINE
  switch (face) {
    case 'happy':
    case 'grin':
      // ^ ^ eyes
      px(14, eyeY + 1); px(15, eyeY); px(16, eyeY + 1)
      px(19, eyeY + 1); px(20, eyeY); px(21, eyeY + 1)
      if (face === 'grin') {
        px(15, eyeY + 4, 5, 1); px(16, eyeY + 5, 3, 1)
      } else {
        px(15, eyeY + 4); px(16, eyeY + 5, 3, 1); px(19, eyeY + 4)
      }
      return
    case 'sad':
      // droopy eyes, worried brows (inner ends raised), frown, tear
      px(14, eyeY + 1, 2, 1); px(19, eyeY + 1, 2, 1)
      px(14, eyeY - 1); px(15, eyeY - 2); px(20, eyeY - 1); px(19, eyeY - 2)
      px(16, eyeY + 5, 3, 1); px(15, eyeY + 6); px(19, eyeY + 6)
      px(11, eyeY + 2, 3, 4)
      ctx.fillStyle = MAIN
      px(12, eyeY + 3, 1, 2)
      return
    default:
      px(14, eyeY, 2, 2); px(19, eyeY, 2, 2)
      if (face === 'talk') px(16, eyeY + 5, 3, 3)
      else px(16, eyeY + 5, 3, 1)
  }
}

// ---- bodies -----------------------------------------------------------

export interface BodyGeometry {
  /** Outline columns of the body at shoulder height; arms attach outside them. */
  left: number
  right: number
  shoulderY: number
  eyeY: number
}

export interface Body {
  geometry(p: Pose): BodyGeometry
  paint(ctx: CanvasRenderingContext2D, p: Pose): void
}

/** Rect with 1px cut corners; reads as a rounded pixel blob. */
function blob(
  ctx: CanvasRenderingContext2D,
  color: string,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): void {
  ctx.fillStyle = color
  ctx.fillRect(x0 + 1, y0, x1 - x0 - 1, 1)
  ctx.fillRect(x0, y0 + 1, x1 - x0 + 1, y1 - y0 - 1)
  ctx.fillRect(x0 + 1, y1, x1 - x0 - 1, 1)
}

const slime: Body = {
  geometry: (p) => ({ left: 9, right: 24, shoulderY: 21 + p.squash, eyeY: 19 + p.squash }),
  paint(ctx, p) {
    const t = 13 + p.squash
    // stepped dome silhouette: narrow crown widening to the base
    ctx.fillStyle = OUTLINE
    ctx.fillRect(12, t, 10, 29 - t)
    ctx.fillRect(10, t + 2, 14, 27 - t)
    ctx.fillRect(9, t + 4, 16, 25 - t)
    ctx.fillStyle = MAIN
    ctx.fillRect(13, t + 1, 8, 27 - t)
    ctx.fillRect(11, t + 3, 12, 25 - t)
    ctx.fillRect(10, t + 5, 14, 23 - t)
    ctx.fillStyle = SHADE
    ctx.fillRect(11, 24, 4, 3)
  },
}

const bot: Body = {
  geometry: (p) => ({ left: 9, right: 23, shoulderY: 19 + p.squash, eyeY: 16 + p.squash }),
  paint(ctx, p) {
    const top = 12 + p.squash
    // antenna
    ctx.fillStyle = OUTLINE
    ctx.fillRect(15, top - 5, 2, 5)
    ctx.fillRect(14, top - 7, 4, 3)
    ctx.fillStyle = SHADE
    ctx.fillRect(15, top - 6, 2, 1)
    // body
    blob(ctx, OUTLINE, 9, top, 23, 26)
    blob(ctx, MAIN, 10, top + 1, 22, 25)
    ctx.fillStyle = SHADE
    ctx.fillRect(11, 21, 4, 3)
    // feet, alternating with the walk cycle
    const leftX = p.leg === 1 ? 13 : 11
    const rightX = p.leg === 2 ? 20 : 18
    ctx.fillStyle = OUTLINE
    ctx.fillRect(leftX, 27, 3, 2)
    ctx.fillRect(rightX, 27, 3, 2)
  },
}

const ghost: Body = {
  geometry: (p) => ({ left: 9, right: 23, shoulderY: 16 + p.squash, eyeY: 13 + p.squash }),
  paint(ctx, p) {
    const top = 7 + p.squash
    blob(ctx, OUTLINE, 9, top, 23, 25)
    blob(ctx, MAIN, 10, top + 1, 22, 25)
    // scalloped hem
    ctx.fillStyle = OUTLINE
    ctx.fillRect(10, 26, 3, 2)
    ctx.fillRect(15, 26, 3, 2)
    ctx.fillRect(20, 26, 3, 2)
    ctx.fillStyle = MAIN
    ctx.fillRect(11, 26, 1, 1)
    ctx.fillRect(16, 26, 1, 1)
    ctx.fillRect(21, 26, 1, 1)
    ctx.fillStyle = SHADE
    ctx.fillRect(11, 21, 4, 4)
  },
}

export const BODIES: Body[] = [slime, bot, ghost]

type Painter = (ctx: CanvasRenderingContext2D, p: Pose) => void

/** Arms first so the body outline covers each shoulder joint, then body, then face. */
function bodyPainter(body: Body): Painter {
  return (ctx, p) => {
    const geo = body.geometry(p)
    for (const r of armRects(p.arms, geo)) {
      ctx.fillStyle = r.ink === 'outline' ? OUTLINE : MAIN
      ctx.fillRect(r.x, r.y, r.w, r.h)
    }
    body.paint(ctx, p)
    drawFace(ctx, geo.eyeY, p.face)
  }
}

const BODY_PAINTERS: Painter[] = BODIES.map(bodyPainter)

// ---- accessories ------------------------------------------------------

// Accessories align to a nominal head area around y 12-20 (body origin,
// not body shape, per the contract) and ride the same pose offsets.
const cap: Painter = (ctx, p) => {
  const y = 9 + p.squash
  blob(ctx, OUTLINE, 9, y, 23, y + 4)
  blob(ctx, MAIN, 10, y + 1, 22, y + 3)
  ctx.fillStyle = OUTLINE
  ctx.fillRect(22, y + 3, 5, 2)
  ctx.fillStyle = SHADE
  ctx.fillRect(23, y + 3, 3, 1)
}

const bow: Painter = (ctx, p) => {
  const y = 8 + p.squash
  ctx.fillStyle = OUTLINE
  ctx.fillRect(10, y, 8, 5)
  ctx.fillStyle = MAIN
  ctx.fillRect(11, y + 1, 2, 3)
  ctx.fillRect(15, y + 1, 2, 3)
  ctx.fillStyle = SHADE
  ctx.fillRect(13, y + 1, 2, 3)
}

const glasses: Painter = (ctx, p) => {
  const y = 16 + p.squash
  ctx.fillStyle = OUTLINE
  ctx.fillRect(12, y, 10, 4)
  ctx.fillStyle = MAIN
  ctx.fillRect(13, y + 1, 3, 2)
  ctx.fillRect(18, y + 1, 3, 2)
}

const scarf: Painter = (ctx, p) => {
  const y = 23 + p.squash
  blob(ctx, OUTLINE, 9, y, 23, y + 3)
  ctx.fillStyle = MAIN
  ctx.fillRect(10, y + 1, 12, 1)
  ctx.fillStyle = OUTLINE
  ctx.fillRect(8, y + 1, 3, 5)
  ctx.fillStyle = SHADE
  ctx.fillRect(9, y + 2, 1, 3)
}

const ACCESSORY_PAINTERS: Painter[] = [cap, bow, glasses, scarf]

// ---- sheets -----------------------------------------------------------

function paintSheet(painter: Painter): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = SHEET_WIDTH
  canvas.height = SHEET_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2d canvas context unavailable')

  for (const anim of ANIM_NAMES) {
    const { row } = ANIMATIONS[anim]
    POSES[anim].forEach((framePose, frame) => {
      ctx.save()
      ctx.translate(frame * FRAME_SIZE, row * FRAME_SIZE)
      // never paint into a neighbouring frame, whatever the pose offset
      ctx.beginPath()
      ctx.rect(0, 0, FRAME_SIZE, FRAME_SIZE)
      ctx.clip()
      ctx.translate(0, framePose.dy)
      painter(ctx, framePose)
      ctx.restore()
    })
  }
  return canvas
}

export function paintBodySheet(bodyIndex: number): HTMLCanvasElement {
  const painter = BODY_PAINTERS[bodyIndex % BODY_PAINTERS.length]
  if (!painter) throw new Error(`no body painter for index ${bodyIndex}`)
  return paintSheet(painter)
}

export function paintAccessorySheet(accessoryIndex: number): HTMLCanvasElement {
  const painter = ACCESSORY_PAINTERS[accessoryIndex % ACCESSORY_PAINTERS.length]
  if (!painter) throw new Error(`no accessory painter for index ${accessoryIndex}`)
  return paintSheet(painter)
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/render/sprites/placeholder.test.ts && npx tsc -b && npx oxlint`
Expected: 4 tests PASS, with no type or lint errors. If oxlint objects to several statements per line in `drawFace`, split them one per line; don't disable the rule.

- [ ] **Step 5: Add the sheet preview page (dev tool for art review)**

Create `sheet-preview.html` in the project root:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Sprite sheet preview</title>
    <style>
      body {
        margin: 0;
        padding: 16px;
        min-height: 100vh;
        background: linear-gradient(180deg, #2a1d4a, #4b2c6e 60%, #1b1330);
        color: #e7dcf7;
        font: 12px ui-monospace, Consolas, monospace;
      }
      .row { display: flex; gap: 12px; margin-bottom: 12px; }
      figure { margin: 0; text-align: center; }
      canvas { image-rendering: pixelated; }
    </style>
  </head>
  <body>
    <h1>Built-in character sheets</h1>
    <div id="sheets"></div>
    <script type="module" src="/src/app/sheetPreview.ts"></script>
  </body>
</html>
```

Create `src/app/sheetPreview.ts`:

```ts
import {
  ACCESSORY_COUNT,
  ANIM_NAMES,
  ANIMATIONS,
  BODY_COUNT,
  FRAME_SIZE,
  PALETTES,
  type AnimName,
} from '../render/sprites/contract'
import { paintAccessorySheet, paintBodySheet } from '../render/sprites/placeholder'

/**
 * Dev-only art review page: `npm run dev`, then open /sheet-preview.html.
 * Every built-in body plays every row, tinted like on stream, with and
 * without an accessory. Not part of the OBS build.
 */
const SCALE = 4

function hex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`
}

/** Same multiplicative tint the stage applies: gray * color, black stays black. */
function tint(sheet: HTMLCanvasElement, color: number): HTMLCanvasElement {
  const out = document.createElement('canvas')
  out.width = sheet.width
  out.height = sheet.height
  const ctx = out.getContext('2d')
  if (!ctx) throw new Error('2d canvas context unavailable')
  ctx.drawImage(sheet, 0, 0)
  ctx.globalCompositeOperation = 'multiply'
  ctx.fillStyle = hex(color)
  ctx.fillRect(0, 0, out.width, out.height)
  ctx.globalCompositeOperation = 'destination-in'
  ctx.drawImage(sheet, 0, 0)
  return out
}

interface Cell {
  ctx: CanvasRenderingContext2D
  layers: HTMLCanvasElement[]
  anim: AnimName
}

const cells: Cell[] = []
const root = document.getElementById('sheets')
if (!root) throw new Error('missing #sheets')

for (let body = 0; body < BODY_COUNT; body++) {
  const palette = PALETTES[body] ?? { body: 0xffffff, accent: 0xffffff }
  const bodySheet = tint(paintBodySheet(body), palette.body)
  const accessorySheet = tint(paintAccessorySheet(body % ACCESSORY_COUNT), palette.accent)
  for (const layers of [[bodySheet], [bodySheet, accessorySheet]]) {
    const row = document.createElement('div')
    row.className = 'row'
    for (const anim of ANIM_NAMES) {
      const figure = document.createElement('figure')
      const canvas = document.createElement('canvas')
      canvas.width = FRAME_SIZE
      canvas.height = FRAME_SIZE
      canvas.style.width = `${FRAME_SIZE * SCALE}px`
      canvas.style.height = `${FRAME_SIZE * SCALE}px`
      const caption = document.createElement('figcaption')
      caption.textContent = anim
      figure.append(canvas, caption)
      row.append(figure)
      const ctx = canvas.getContext('2d')
      if (ctx) cells.push({ ctx, layers, anim })
    }
    root.append(row)
  }
}

function frame(now: number): void {
  for (const cell of cells) {
    const spec = ANIMATIONS[cell.anim]
    const col = Math.floor((now / 1000) * spec.fps) % spec.frames
    cell.ctx.clearRect(0, 0, FRAME_SIZE, FRAME_SIZE)
    for (const layer of cell.layers) {
      cell.ctx.drawImage(
        layer,
        col * FRAME_SIZE,
        spec.row * FRAME_SIZE,
        FRAME_SIZE,
        FRAME_SIZE,
        0,
        0,
        FRAME_SIZE,
        FRAME_SIZE,
      )
    }
  }
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
```

- [ ] **Step 6: Visual sign-off with the streamer (blocking)**

Run `npm run dev`, then open `http://localhost:5173/sheet-preview.html`. Check all six rows for the three bodies, with and without accessories:
- arms visible in every row
- nothing clipped at the frame edges
- cheer and sad match the approved mockup (`.superpowers/brainstorm/1164-1790342722/content/cheer-sad-look.html`, option A)

Take a screenshot, show it to the streamer and **wait for their approval** before starting Task 3. Adjust `ARM_SHAPES`, `POSES` or `drawFace` for any feedback, and re-run Step 4 after each change.

- [ ] **Step 7: Confirm the build still ignores the preview, then commit**

Run: `npm run build && ls dist`
Expected: `dist/` contains `index.html`, `assets/`, `favicon.svg`, and **no** `sheet-preview.html`.

```bash
git add src/render/sprites/placeholder.ts src/render/sprites/placeholder.test.ts sheet-preview.html src/app/sheetPreview.ts
git commit -m "feat: arms in every animation, cheer and sad art, sheet preview page"
```

---

### Task 3: Reaction settings

**Files:**
- Modify: `src/config/types.ts`
- Modify: `src/config/defaults.ts`
- Modify: `src/config/resolveConfig.ts`
- Modify: `src/config/resolveConfig.test.ts`
- Modify: `README.md` (URL parameters table)

**Interfaces:**
- Produces on `AppConfig`, which Task 5 consumes structurally as `MoodOptions` and Task 7 reads:
  - `hypeWords: string[]`
  - `sadWords: string[]`
  - `crowdChatters: number`
  - `crowdWindowMs: number`
  - `crowdCooldownMs: number`
  - `selfReactionMs: number`
  - `crowdReactionMs: number`

- [ ] **Step 1: Write the failing tests**

Append inside the `describe('resolveConfig', ...)` block of `src/config/resolveConfig.test.ts`:

```ts
  it('resolves reaction settings, turning seconds params into ms', () => {
    const cfg = resolveConfig(
      params('crowdChatters=4&crowdWindowSec=8&crowdCooldownSec=20'),
      {},
    )
    expect(cfg.crowdChatters).toBe(4)
    expect(cfg.crowdWindowMs).toBe(8_000)
    expect(cfg.crowdCooldownMs).toBe(20_000)
  })

  it('rejects out-of-range reaction params', () => {
    expect(resolveConfig(params('crowdChatters=1'), {}).crowdChatters).toBe(3)
    expect(resolveConfig(params('crowdWindowSec=999'), {}).crowdWindowMs).toBe(10_000)
    expect(resolveConfig(params('crowdCooldownSec=-5'), {}).crowdCooldownMs).toBe(15_000)
  })

  it('falls back when overrides set a crowd size that would fire on every message', () => {
    expect(resolveConfig(params(''), { crowdChatters: 0 }).crowdChatters).toBe(3)
    expect(resolveConfig(params(''), { crowdChatters: 1 }).crowdChatters).toBe(3)
    expect(resolveConfig(params(''), { crowdChatters: 5 }).crowdChatters).toBe(5)
  })

  it('lets overrides replace the word lists', () => {
    const cfg = resolveConfig(params(''), { hypeWords: ['goofergHype'], sadWords: [] })
    expect(cfg.hypeWords).toEqual(['goofergHype'])
    expect(cfg.sadWords).toEqual([])
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/config/resolveConfig.test.ts`
Expected: FAIL. `crowdChatters` etc. are undefined, and TypeScript errors surface as test failures for the override objects.

- [ ] **Step 3: Implement the settings**

In `src/config/types.ts`, add before `debug: DebugMode`:

```ts
  /** Words/phrases that make an avatar cheer. Matched like chat: case, punctuation and stretched letters ignored. */
  hypeWords: string[]
  /** Words/phrases that make an avatar sad. */
  sadWords: string[]
  /** Distinct chatters within crowdWindowMs needed for a whole-crowd reaction. */
  crowdChatters: number
  crowdWindowMs: number
  /** Per mood, counted from when that mood's crowd reaction fired. */
  crowdCooldownMs: number
  /** How long a chatter's own avatar reacts to their message. */
  selfReactionMs: number
  /** How long the whole crowd reacts. */
  crowdReactionMs: number
```

In `src/config/defaults.ts`, add before `debug: '',`:

```ts
  hypeWords: [
    'w', 'lets go', 'letsgo', 'lfg', 'pog', 'poggers', 'pogchamp', 'pogu',
    'hype', 'clutch', 'gg', 'ez', 'sheesh', 'goated',
  ],
  sadWords: [
    'l', 'f', 'o7', 'rip', 'ripbozo', 'sadge', 'biblethump', 'notlikethis',
    'unlucky', 'pain',
  ],
  crowdChatters: 3,
  crowdWindowMs: 10_000,
  crowdCooldownMs: 15_000,
  selfReactionMs: 2_000,
  crowdReactionMs: 4_000,
```

In `src/config/resolveConfig.ts`, after the `cfg.bubbleDurationMs = ...` line add:

```ts
  // A crowd of 0 or 1 would react to every message, so a bad override is
  // treated like a bad param: fall back to the default.
  const crowdOverride = inRange(cfg.crowdChatters, 2, 50)
    ? cfg.crowdChatters
    : DEFAULT_CONFIG.crowdChatters
  cfg.crowdChatters = intParam(params, 'crowdChatters', crowdOverride, 2, 50)
  cfg.crowdWindowMs = intParam(params, 'crowdWindowSec', cfg.crowdWindowMs / 1000, 2, 120) * 1000
  cfg.crowdCooldownMs =
    intParam(params, 'crowdCooldownSec', cfg.crowdCooldownMs / 1000, 0, 600) * 1000
```

and at the end of the file add:

```ts
function inRange(value: number, min: number, max: number): boolean {
  return Number.isFinite(value) && value >= min && value <= max
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test && npx tsc -b && npx oxlint`
Expected: all PASS, including the untouched `returns defaults with empty params and overrides`.

- [ ] **Step 5: Document the params**

In `README.md`, add these rows to the URL parameters table, after the `bots` row:

```md
| `crowdChatters` | `3` | Different chatters needed (within the window) for the whole crowd to react |
| `crowdWindowSec` | `10` | How far back chat is remembered for crowd reactions |
| `crowdCooldownSec` | `15` | Per mood: wait this long before the crowd can react that way again |
```

- [ ] **Step 6: Commit**

```bash
git add src/config README.md
git commit -m "feat: reaction settings with validated crowd params"
```

---

### Task 4: Message normalization and word matching

**Files:**
- Create: `src/chat/mood.ts`
- Create: `src/chat/mood.test.ts`

**Interfaces:**
- Produces:
  - `export type Mood = 'cheer' | 'sad'`
  - `export function normalizeMessage(text: string): string[]`
  - `export function compileWords(list: string[]): string[][]`
  - `export function classify(words: string[], hype: string[][], sad: string[][]): Mood | null`

- [ ] **Step 1: Write the failing tests**

Create `src/chat/mood.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { classify, compileWords, normalizeMessage } from './mood'

describe('normalizeMessage', () => {
  it.each([
    ['WWWW', ['w']],
    ['W W W', ['w']],
    ['LETS GOOOO LETS GO', ['lets', 'go']],
    ['PogChamp PogChamp', ['pogchamp']],
    ['o7', ['o7']],
    ["that's insane!!!", ['that', 's', 'insane']],
  ])('%s', (text, expected) => {
    expect(normalizeMessage(text)).toEqual(expected)
  })

  it('reduces emoji-only, non-Latin and punctuation-only messages to nothing', () => {
    expect(normalizeMessage('😂😂😂')).toEqual([])
    expect(normalizeMessage('こんにちは')).toEqual([])
    expect(normalizeMessage('?!...')).toEqual([])
    expect(normalizeMessage('')).toEqual([])
  })
})

describe('classify', () => {
  const hype = compileWords(['w', 'lets go', 'pogchamp'])
  const sad = compileWords(['l', 'f'])
  const moodOf = (text: string) => classify(normalizeMessage(text), hype, sad)

  it('finds a hype word anywhere in a message', () => {
    expect(moodOf('W streamer')).toBe('cheer')
    expect(moodOf('PogChamp')).toBe('cheer')
  })

  it('matches phrases only when their words are consecutive', () => {
    expect(moodOf('LETS GOOOOO')).toBe('cheer')
    expect(moodOf('go lets')).toBeNull()
  })

  it('never matches inside longer words', () => {
    expect(moodOf('wow')).toBeNull()
    expect(moodOf('lol')).toBeNull()
  })

  it('returns sad for sad words', () => {
    expect(moodOf('LLLL')).toBe('sad')
    expect(moodOf('f in chat')).toBe('sad')
  })

  it('ignores messages that are both hype and sad', () => {
    expect(moodOf('W or L?')).toBeNull()
  })

  it('matches list entries written with caps or punctuation', () => {
    const custom = compileWords(['LETS GO!', 'PogChamp', '  ', '!!'])
    expect(custom).toEqual([['lets', 'go'], ['pogchamp']])
    expect(classify(normalizeMessage('lets goooo'), custom, [])).toBe('cheer')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/chat/mood.test.ts`
Expected: FAIL, because vitest cannot resolve the `./mood` import (the file doesn't exist yet).

- [ ] **Step 3: Implement**

Create `src/chat/mood.ts`:

```ts
export type Mood = 'cheer' | 'sad'

/**
 * A message as matchable words: lowercased, punctuation/emoji/non-Latin
 * dropped, stretched letters collapsed (WWWW -> w, GOOOO -> go), repeated
 * words kept once in first-seen order (LETS GO LETS GO -> [lets, go]).
 */
export function normalizeMessage(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/(.)\1+/g, '$1')
    .split(/\s+/)
    .filter((w) => w.length > 0)
  return [...new Set(words)]
}

/** Word-list entries cleaned exactly like chat, so matching is like for like. Empty entries are dropped. */
export function compileWords(list: string[]): string[][] {
  return list.map(normalizeMessage).filter((phrase) => phrase.length > 0)
}

/** 'cheer' or 'sad' when the message contains a listed word or phrase; null for neither or both. */
export function classify(words: string[], hype: string[][], sad: string[][]): Mood | null {
  const isHype = hype.some((phrase) => containsPhrase(words, phrase))
  const isSad = sad.some((phrase) => containsPhrase(words, phrase))
  if (isHype === isSad) return null
  return isHype ? 'cheer' : 'sad'
}

function containsPhrase(words: string[], phrase: string[]): boolean {
  for (let i = 0; i + phrase.length <= words.length; i++) {
    if (phrase.every((word, j) => words[i + j] === word)) return true
  }
  return false
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/chat/mood.test.ts && npx tsc -b && npx oxlint`
Expected: all PASS, with no type or lint errors.

- [ ] **Step 5: Commit**

```bash
git add src/chat/mood.ts src/chat/mood.test.ts
git commit -m "feat: chat message normalization and hype/sad word matching"
```

---

### Task 5: ChatMood (personal and crowd reactions)

**Files:**
- Modify: `src/chat/mood.ts` (append)
- Modify: `src/chat/mood.test.ts` (append)

**Interfaces:**
- Consumes: `normalizeMessage`, `compileWords`, `classify`, `Mood` (Task 4); `AppConfig` fields from Task 3 (structurally).
- Produces:
  - `export type Reaction = { scope: 'self'; mood: Mood; login: string } | { scope: 'crowd'; mood: Mood }`
  - `export interface MoodOptions { hypeWords: string[]; sadWords: string[]; crowdChatters: number; crowdWindowMs: number; crowdCooldownMs: number }`
  - `export const MAX_REPEAT_WORDS = 3`
  - `export const MAX_REMEMBERED = 500`
  - `export class ChatMood { constructor(options: MoodOptions); get remembered(): number; observe(message: { login: string; text: string }, now: number): Reaction[] }`

- [ ] **Step 1: Write the failing tests**

In `src/chat/mood.test.ts`, change the import to:

```ts
import {
  ChatMood,
  MAX_REMEMBERED,
  classify,
  compileWords,
  normalizeMessage,
  type MoodOptions,
} from './mood'
```

and append:

```ts
describe('ChatMood', () => {
  const options: MoodOptions = {
    hypeWords: ['w', 'lets go'],
    sadWords: ['l', 'f'],
    crowdChatters: 3,
    crowdWindowMs: 10_000,
    crowdCooldownMs: 15_000,
  }
  const say = (mood: ChatMood, login: string, text: string, at: number) =>
    mood.observe({ login, text }, at)

  it('gives the sender a personal cheer for a hype word', () => {
    expect(say(new ChatMood(options), 'pete', 'W', 0)).toEqual([
      { scope: 'self', mood: 'cheer', login: 'pete' },
    ])
  })

  it('gives the sender a personal sad reaction for a sad word', () => {
    expect(say(new ChatMood(options), 'pete', 'LLLL', 0)).toEqual([
      { scope: 'self', mood: 'sad', login: 'pete' },
    ])
  })

  it('ignores plain chat, and does not remember empty messages', () => {
    const mood = new ChatMood(options)
    expect(say(mood, 'pete', 'hello there friend', 0)).toEqual([])
    expect(say(mood, 'rita', '😂😂😂', 1)).toEqual([])
    expect(mood.remembered).toBe(1)
  })

  it('fires a crowd cheer when a third different chatter hypes', () => {
    const mood = new ChatMood(options)
    say(mood, 'a', 'W', 0)
    say(mood, 'b', 'lets gooo', 1_000)
    expect(say(mood, 'c', 'WWW', 2_000)).toEqual([{ scope: 'crowd', mood: 'cheer' }])
  })

  it('counts one chatter spamming only once', () => {
    const mood = new ChatMood(options)
    for (let t = 0; t < 3_000; t += 1_000) say(mood, 'a', 'W', t)
    expect(say(mood, 'a', 'W', 3_000)).toEqual([{ scope: 'self', mood: 'cheer', login: 'a' }])
  })

  it('forgets messages once they are a full window old', () => {
    const mood = new ChatMood(options)
    say(mood, 'a', 'W', 0)
    say(mood, 'b', 'W', 5_000)
    expect(say(mood, 'c', 'W', 10_000)).toEqual([{ scope: 'self', mood: 'cheer', login: 'c' }])
  })

  it('cools each mood down separately', () => {
    const mood = new ChatMood(options)
    say(mood, 'a', 'W', 0)
    say(mood, 'b', 'W', 1_000)
    expect(say(mood, 'c', 'W', 2_000)).toEqual([{ scope: 'crowd', mood: 'cheer' }])
    // cheer is cooling down: a fourth hyper only reacts personally
    expect(say(mood, 'd', 'W', 3_000)).toEqual([{ scope: 'self', mood: 'cheer', login: 'd' }])
    // sad is not blocked by the cheer cooldown
    say(mood, 'e', 'L', 4_000)
    say(mood, 'f', 'L', 5_000)
    expect(say(mood, 'g', 'L', 6_000)).toEqual([{ scope: 'crowd', mood: 'sad' }])
    // cheer can fire again exactly one cooldown after it last fired
    say(mood, 'h', 'W', 15_000)
    say(mood, 'i', 'W', 16_000)
    expect(say(mood, 'j', 'W', 17_000)).toEqual([{ scope: 'crowd', mood: 'cheer' }])
  })

  it('turns a message three chatters repeat into a crowd cheer', () => {
    const mood = new ChatMood(options)
    expect(say(mood, 'a', 'CAUGHT', 0)).toEqual([])
    expect(say(mood, 'b', 'caught', 1_000)).toEqual([])
    expect(say(mood, 'c', 'Caught!!', 2_000)).toEqual([{ scope: 'crowd', mood: 'cheer' }])
  })

  it('never treats messages longer than three words as repeats', () => {
    const mood = new ChatMood(options)
    for (const login of ['a', 'b', 'c', 'd']) {
      expect(say(mood, login, 'this is a long message', 0)).toEqual([])
    }
  })

  it('makes a repeated sad word a crowd sad, not a cheer', () => {
    const mood = new ChatMood(options)
    say(mood, 'a', 'F', 0)
    say(mood, 'b', 'F', 1_000)
    expect(say(mood, 'c', 'FFFF', 2_000)).toEqual([{ scope: 'crowd', mood: 'sad' }])
  })

  it('keeps memory bounded during raid-sized spam', () => {
    const mood = new ChatMood({ ...options, crowdChatters: 100_000 })
    for (let i = 0; i < 2_000; i++) say(mood, `user${i}`, 'W', i)
    expect(mood.remembered).toBe(MAX_REMEMBERED)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/chat/mood.test.ts`
Expected: FAIL. `ChatMood` and `MAX_REMEMBERED` are not exported.

- [ ] **Step 3: Implement**

Append to `src/chat/mood.ts`:

```ts

export type Reaction =
  | { scope: 'self'; mood: Mood; login: string }
  | { scope: 'crowd'; mood: Mood }

export interface MoodOptions {
  hypeWords: string[]
  sadWords: string[]
  crowdChatters: number
  crowdWindowMs: number
  crowdCooldownMs: number
}

/** Longest message, in distinct words, that can count as a chat-wide repeat. */
export const MAX_REPEAT_WORDS = 3
/** Hard cap on remembered messages, so raid-sized spam can't grow memory. */
export const MAX_REMEMBERED = 500

interface Entry {
  login: string
  at: number
  mood: Mood | null
  /** Cleaned text of a short message, for spotting repeats; null when too long. */
  key: string | null
}

/**
 * Turns chat into reactions. Pure: no Pixi, no DOM, no timers; `now` comes
 * from the caller, so tests control the clock.
 *
 * - A message with a hype/sad word: that chatter's avatar reacts.
 * - crowdChatters different chatters sending that mood within crowdWindowMs:
 *   the whole crowd reacts, then that mood cools down for crowdCooldownMs.
 * - The same short unlisted message from crowdChatters chatters: crowd cheer.
 */
export class ChatMood {
  private options: MoodOptions
  private hype: string[][]
  private sad: string[][]
  private entries: Entry[] = []
  private lastCrowdAt: Record<Mood, number> = { cheer: -Infinity, sad: -Infinity }

  constructor(options: MoodOptions) {
    this.options = options
    this.hype = compileWords(options.hypeWords)
    this.sad = compileWords(options.sadWords)
  }

  /** Messages currently remembered (for tests and debugging). */
  get remembered(): number {
    return this.entries.length
  }

  observe(message: { login: string; text: string }, now: number): Reaction[] {
    const words = normalizeMessage(message.text)
    if (words.length === 0) return []
    const mood = classify(words, this.hype, this.sad)
    const key = words.length <= MAX_REPEAT_WORDS ? words.join(' ') : null
    this.remember({ login: message.login, at: now, mood, key }, now)

    const crowd = this.crowdMood(mood, key, now)
    if (crowd) {
      this.lastCrowdAt[crowd] = now
      // the crowd reaction already includes the sender's avatar
      return [{ scope: 'crowd', mood: crowd }]
    }
    return mood ? [{ scope: 'self', mood, login: message.login }] : []
  }

  private remember(entry: Entry, now: number): void {
    const cutoff = now - this.options.crowdWindowMs
    this.entries = this.entries.filter((e) => e.at > cutoff)
    this.entries.push(entry)
    if (this.entries.length > MAX_REMEMBERED) {
      this.entries.splice(0, this.entries.length - MAX_REMEMBERED)
    }
  }

  private crowdMood(mood: Mood | null, key: string | null, now: number): Mood | null {
    // listed words count by mood; an unlisted message can only be a repeat (hype)
    const candidate: Mood | null = mood ?? (key !== null ? 'cheer' : null)
    if (!candidate) return null
    if (now - this.lastCrowdAt[candidate] < this.options.crowdCooldownMs) return null
    const chatters = mood
      ? this.distinctChatters((e) => e.mood === mood)
      : this.distinctChatters((e) => e.mood === null && e.key === key)
    return chatters >= this.options.crowdChatters ? candidate : null
  }

  private distinctChatters(match: (e: Entry) => boolean): number {
    return new Set(this.entries.filter(match).map((e) => e.login)).size
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/chat/mood.test.ts && npx tsc -b && npx oxlint`
Expected: all PASS, with no type or lint errors.

- [ ] **Step 5: Commit**

```bash
git add src/chat/mood.ts src/chat/mood.test.ts
git commit -m "feat: ChatMood turns chat into personal and crowd reactions"
```

---

### Task 6: `react` state in the avatar state machine

**Files:**
- Modify: `src/avatars/stateMachine.ts`
- Modify: `src/avatars/stateMachine.test.ts`

**Interfaces:**
- Consumes: `Mood` (Task 4); `AnimName` (Task 1).
- Produces: `AvatarStateMachine.onReact(mood: Mood, durationSec: number, delaySec?: number): void`. The state `'react'` is added to `AvatarStateName`, and `Snapshot.anim` is `'cheer' | 'sad'` while reacting.

- [ ] **Step 1: Write the failing tests**

Append inside the `describe('AvatarStateMachine', ...)` block of `src/avatars/stateMachine.test.ts`:

```ts
  it('reacts from idle, standing still, then returns to idle', () => {
    const m = machine()
    run(m, 30)
    const x = m.update(0).x
    m.onReact('cheer', 2)
    let snap = m.update(1 / 60)
    expect(snap.state).toBe('react')
    expect(snap.anim).toBe('cheer')
    snap = run(m, 1.5)
    expect(snap.state).toBe('react')
    expect(snap.x).toBe(x)
    snap = run(m, 0.6)
    expect(snap.state).not.toBe('react')
  })

  it('plays the sad animation for a sad reaction', () => {
    const m = machine()
    run(m, 30)
    m.onReact('sad', 2)
    expect(m.update(1 / 60).anim).toBe('sad')
  })

  it('interrupts talking, and a new message does not cut the reaction short', () => {
    const m = machine()
    run(m, 30)
    m.onMessage()
    m.onReact('cheer', 2)
    m.onMessage()
    expect(m.update(1 / 60).state).toBe('react')
  })

  it('ignores reactions while walking in (a new chatter hyping)', () => {
    const m = machine()
    m.update(0)
    m.onReact('cheer', 2)
    expect(m.update(1 / 60).state).toBe('entering')
  })

  it('ignores reactions while leaving', () => {
    const m = machine()
    run(m, 30)
    m.beginLeave()
    m.onReact('cheer', 2)
    expect(m.update(1 / 60).state).toBe('leaving')
  })

  it('ignores reactions mid-jump', () => {
    const m = machine()
    run(m, 30)
    m.onJump()
    m.onReact('cheer', 2)
    expect(m.update(1 / 60).state).toBe('jump')
    expect(run(m, 0.8).state).not.toBe('react')
  })

  it('waits out the ripple delay before reacting', () => {
    const m = machine()
    run(m, 30)
    m.onReact('cheer', 2, 0.3)
    expect(m.update(0.1).state).not.toBe('react')
    expect(run(m, 0.25).state).toBe('react')
  })

  it('drops a delayed reaction if the avatar started leaving', () => {
    const m = machine()
    run(m, 30)
    m.onReact('cheer', 2, 0.3)
    m.beginLeave()
    expect(run(m, 0.5).state).toBe('leaving')
  })

  it('resumes the reaction after a jump', () => {
    const m = machine()
    run(m, 30)
    m.onReact('cheer', 3)
    run(m, 0.5)
    m.onJump()
    const landed = run(m, 0.8)
    expect(landed.state).toBe('react')
    expect(landed.anim).toBe('cheer')
    expect(run(m, 2.6).state).not.toBe('react')
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/avatars/stateMachine.test.ts`
Expected: FAIL with "m.onReact is not a function".

- [ ] **Step 3: Implement**

In `src/avatars/stateMachine.ts`:

1. Add as the first import: `import type { Mood } from '../chat/mood'`
2. Add `| 'react'` to `AvatarStateName`, after `| 'jump'`.
3. In `interface ResumeState`, change `state: 'entering' | 'idle' | 'wander' | 'talk'` to `state: 'entering' | 'idle' | 'wander' | 'talk' | 'react'`.
4. Update the class doc comment. Replace `Snapshot each frame. External inputs: onMessage, onJump, beginLeave.` with `Snapshot each frame. External inputs: onMessage, onJump, onReact, beginLeave.` Add after the `idle/wander --message--> talk --timer--> idle` line:

```ts
 *   idle/wander/talk --reaction (after optional delay)--> react --timer--> idle
```

5. Add fields after `private resume: ResumeState | null = null`:

```ts
  private reactMood: Mood = 'cheer'
  /** A crowd reaction waiting out its ripple delay. */
  private pending: { mood: Mood; duration: number; delay: number } | null = null
```

6. Add after the `onJump()` method:

```ts
  /** Cheer/sad for durationSec, optionally after delaySec (the crowd ripple). */
  onReact(mood: Mood, durationSec: number, delaySec = 0): void {
    if (!this.canReact()) return
    if (delaySec > 0) {
      this.pending = { mood, duration: durationSec, delay: delaySec }
      return
    }
    this.startReact(mood, durationSec)
  }

  /** Walking in or out, and mid-jump, carry on; everything else can react. */
  private canReact(): boolean {
    return (
      this.stateName === 'idle' ||
      this.stateName === 'wander' ||
      this.stateName === 'talk' ||
      this.stateName === 'react'
    )
  }

  private startReact(mood: Mood, durationSec: number): void {
    this.stateName = 'react'
    this.reactMood = mood
    this.timer = durationSec
  }

  private tickPending(dtSec: number): void {
    if (!this.pending) return
    this.pending.delay -= dtSec
    if (this.pending.delay > 0) return
    const { mood, duration } = this.pending
    this.pending = null
    if (this.canReact()) this.startReact(mood, duration)
  }
```

7. In `beginLeave()`, after `this.resume = null` add `this.pending = null`.
8. In `update()`, insert `this.tickPending(dtSec)` directly before `switch (this.stateName) {`.
9. In the `update()` switch, replace:

```ts
      case 'talk': {
```

with:

```ts
      case 'talk':
      case 'react': {
```

(the body, which counts the timer down and then calls `enterIdle()`, is shared).

10. In `animFor()`, add before `default:`:

```ts
      case 'react':
        return this.reactMood
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test && npx tsc -b && npx oxlint`
Expected: all PASS (the old state machine tests included), with no type or lint errors.

- [ ] **Step 5: Commit**

```bash
git add src/avatars/stateMachine.ts src/avatars/stateMachine.test.ts
git commit -m "feat: react state for cheer and sad with crowd ripple delay"
```

---

### Task 7: Wire reactions into the overlay, fake-chat waves, docs, final check

**Files:**
- Modify: `src/avatars/manager.ts`
- Modify: `src/app/bootstrap.ts`
- Rewrite: `src/app/fakeChat.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: `ChatMood`, `Reaction` (Task 5); `AvatarStateMachine.onReact` (Task 6); `cfg.selfReactionMs` and `cfg.crowdReactionMs` (Task 3).
- Produces: `AvatarManager.react(reaction: Reaction): void`.

- [ ] **Step 1: Add `react` to the manager**

In `src/avatars/manager.ts`:
- add `import type { Reaction } from '../chat/mood'` after the `ChatMessageEvent` import
- add after `const AVATAR_ROOM = 130`:

```ts
/** Crowd reactions start staggered by up to this much, so the crowd erupts in a ripple. */
const CROWD_RIPPLE_MS = 400
```

- add after the `jumpFor` method:

```ts
  /** Plays a ChatMood reaction. Missing or ineligible avatars are skipped by their state machine. */
  react(reaction: Reaction): void {
    const { selfReactionMs, crowdReactionMs } = this.options.cfg
    if (reaction.scope === 'self') {
      this.avatars.get(reaction.login)?.machine.onReact(reaction.mood, selfReactionMs / 1000)
      return
    }
    for (const avatar of this.avatars.values()) {
      const delaySec = (Math.random() * CROWD_RIPPLE_MS) / 1000
      avatar.machine.onReact(reaction.mood, crowdReactionMs / 1000, delaySec)
    }
  }
```

- [ ] **Step 2: Wire ChatMood in bootstrap (one path for live and fake chat)**

In `src/app/bootstrap.ts`:
- Add `import { ChatMood } from '../chat/mood'` after the `CommandRegistry` import.
- Change `import type { ChatEventSource, ConnectionState } from '../chat/types'` to `import type { ChatEventSource, ChatMessageEvent, ConnectionState } from '../chat/types'`.
- After the `// Phase 2 commands are one register() call each: !dance, !hug, ...` line, add:

```ts

  const mood = new ChatMood(cfg)
  // one path for live and fake chat: bubble/talk first, then any reactions
  const onChat = (e: ChatMessageEvent) => {
    const now = performance.now()
    manager.handleMessage(e, now)
    for (const reaction of mood.observe(e, now)) manager.react(reaction)
  }
```

- Replace `source.on('message', (e) => manager.handleMessage(e, performance.now()))` with `source.on('message', onChat)`.
- Replace:

```ts
    ? startFakeChat((e) => manager.handleMessage(e, performance.now()), (e) =>
        commands.dispatch(e),
      )
```

with:

```ts
    ? startFakeChat(onChat, (e) => commands.dispatch(e))
```

- Add `mood,` to the debug console handle object (`window.__chatAvatars = { manager, commands, cfg, app: stage.app, mood }`).

- [ ] **Step 3: Fake-chat waves**

Replace `src/app/fakeChat.ts` with (the `FAKE_LOGINS`, `FAKE_LINES` and `COLORS` arrays are unchanged):

```ts
import type { ChatCommandEvent, ChatMessageEvent } from '../chat/types'

/**
 * ?debug=grid: synthesizes traffic from 25 fake chatters so spawn density,
 * eviction, frame rate and chat reactions can be checked without a live
 * channel. About every 30 seconds a hype or sad wave rolls through.
 */
const FAKE_LOGINS = [
  'pixelpete', 'gooberfan42', 'slime_time', 'retro_rita', 'bitcrusher',
  'lurkmaster', 'pogchamp99', 'ghostie_g', 'chatterbox', 'noodle_arms',
  'crt_enjoyer', 'dpad_dan', 'save_state', 'framedrop', 'vsync_vera',
  'coyote_time', 'iframe_izzy', 'hitbox_hank', 'speedrun_sam', 'rng_carry',
  'clutch_or_kick', 'sixty_fps', 'alt_f4_andy', 'respawn_rose', 'gg_no_re',
]

const FAKE_LINES = [
  'hello everyone',
  'this run is looking clean',
  'LETS GOOO',
  'first time here, love the vibe',
  'that jump was cursed',
  'chat is this real',
  'no shot he clutches this',
  'brb getting snacks',
  'the pixel avatars are so cute',
  'W streamer',
  'somebody clip that',
  'day 47 of asking for mario kart',
]

const COLORS = ['#FF4500', '#1E90FF', '#00FF7F', '#FF69B4', '#FFD700', '#9ACD32', null]

const HYPE_WAVE = ['W', 'WWWW', 'LETS GOOO', 'POGGERS', 'W W W']
const SAD_WAVE = ['L', 'LLLL', 'F', 'RIP', 'o7']
/** One fake message every 400ms, so a wave every 75 ticks is about every 30s. */
const WAVE_EVERY_TICKS = 75
const WAVE_SIZE = 4

function pick<T>(items: readonly T[], fallback: T): T {
  return items[Math.floor(Math.random() * items.length)] ?? fallback
}

export function startFakeChat(
  onMessage: (e: ChatMessageEvent) => void,
  onCommand: (e: ChatCommandEvent) => void,
): () => void {
  let counter = 0
  let wave: string[] = []
  const interval = window.setInterval(() => {
    counter++
    if (counter % WAVE_EVERY_TICKS === 0) {
      const lines = Math.random() < 0.5 ? HYPE_WAVE : SAD_WAVE
      wave = Array.from({ length: WAVE_SIZE }, () => pick(lines, 'W'))
    }
    const waveLine = wave.shift()
    const login = pick(FAKE_LOGINS, 'fallback')
    const message: ChatMessageEvent = {
      login,
      displayName: login,
      color: pick(COLORS, null),
      text: waveLine ?? pick(FAKE_LINES, 'hi'),
      emotes: [],
      messageId: `fake-${counter}`,
      timestamp: Date.now(),
      tags: {},
    }
    if (waveLine === undefined && Math.random() < 0.15) {
      onCommand({ name: 'jump', args: [], message })
    } else {
      onMessage(message)
    }
  }, 400)
  return () => window.clearInterval(interval)
}
```

- [ ] **Step 4: Typecheck, lint, test, build**

Run: `npm test && npx tsc -b && npx oxlint && npm run build`
Expected: all PASS, and the build succeeds.

- [ ] **Step 5: Verify on screen**

Run `npm run dev` and open `http://localhost:5173/?debug=1` at a 1920x1080 viewport. Browser panes throttle animation frames, so step the simulation by hand in the console:

```js
const { manager } = window.__chatAvatars
const mk = (login, text) => ({ login, displayName: login, color: '#FFD700', text, emotes: [], messageId: null, timestamp: Date.now(), tags: {} })
let now = performance.now()
for (const l of ['pixelpete', 'gooberfan42', 'slime_time', 'retro_rita', 'bitcrusher']) manager.handleMessage(mk(l, 'hi'), now)
for (let i = 0; i < 1500; i++) { now += 1000 / 30; manager.update(1 / 30, now) }   // everyone walks in
manager.react({ scope: 'crowd', mood: 'cheer' })
for (let i = 0; i < 20; i++) { now += 1000 / 30; manager.update(1 / 30, now) }     // past the ripple delay
```

Screenshot the bottom strip: every avatar has its arms up. Then run `manager.react({ scope: 'crowd', mood: 'sad' })`, step 20 frames past the end of the cheer (about 4s, or 120 frames, first), and screenshot: droopy faces, limp arms.

Also check the whole chat path with `?debug=grid` over about a minute, stepping the same way. Waves should make the crowd react, and single hype lines should make just the sender cheer.

- [ ] **Step 6: Document the feature**

In `README.md`, insert after the `## Commands` section (before `## Architecture`):

````md
## Chat reactions

Characters react to the mood of chat:

- **Cheer** (arms up, grin): a message containing a hype word makes the sender's character cheer for 2 seconds.
- **Sad** (droopy face, tear, slump): the same for sad words.
- **Crowd**: when 3 different chatters send hype (or sad) words within 10 seconds, every character on screen reacts for 4 seconds, in a quick ripple. Anything 3 chatters repeat word for word (up to 3 words, like a new meme) also counts as hype. Each mood then cools down for 15 seconds.

Matching ignores case, punctuation and stretched letters (`WWWW` = `W`, `LETS GOOOO` = `LETS GO`). Twitch emotes are words, so emote names work in the lists. Commands like `!jump` never count.

The default lists live in `src/config/defaults.ts`. To change them, set them in `src/config/overrides.ts` (they replace the defaults), then rebuild:

```ts
export const OVERRIDES: Partial<AppConfig> = {
  channel: 'gooferg',
  hypeWords: ['w', 'lets go', 'pog', 'goofergHype'],
  sadWords: ['l', 'f', 'rip'],
  crowdChatters: 4,
}
```
````

In the Architecture tree, change the `chat/` line to `  chat/       ChatEventSource interface, tmi.js adapter, command registry, chat mood (reactions)`.

To see the built-in art, add this line to the Testing block: `npm run dev       # then open /sheet-preview.html to review the built-in character art`.

- [ ] **Step 7: Commit, rebuild for OBS, hand over**

```bash
npm run build
git add src README.md
git commit -m "feat: chat reactions: personal and crowd cheer and sad"
```

Tell the streamer to click **Refresh cache of current page** on the `chat-avatars` OBS source. If anything misbehaves in OBS, browser-source `console.error` output lands in `%APPDATA%\obs-studio\logs\` (the newest file).
