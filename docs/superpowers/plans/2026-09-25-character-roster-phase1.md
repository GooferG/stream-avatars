# Character Roster, Phase 1 (the new characters) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace slime, robot and ghost with code-drawn chibi humans (skinny, average and chubby; four skin tones; four hairstyles; cap, bow, glasses) and seven animals (cat, dog, duck, frog, bunny, bear, fox). Each character is assembled from layered 48 px sheets with color roles, and its look comes from the username.

**Architecture:**
- Pure modules describe everything:
  - `roster.ts`: the kinds, the sheet ids, and `layersFor(look)`
  - `pixelKit.ts`: shapes, outlines and shading
  - `poses.ts`: the pose tables
  - `humanArt.ts` / `animalArt.ts`: part geometry per layer and pose
  - `look.ts`: DNA v2 and `resolveLook`
- Thin DOM/Pixi edges turn those into sheets:
  - `paint.ts` paints a sheet
  - `sheetSource.ts` picks a PNG or painted canvas
  - `loader.ts` builds Pixi textures
  - `canvasTint.ts` tints for canvas pages
- The avatar renders one tinted sprite per layer.

**Tech Stack:** Vite 8, TypeScript ~6 (strict), PixiJS 8, vitest 4 (node environment), oxlint.

**Spec:** `docs/superpowers/specs/2026-09-25-character-roster-design.md`, sections "Art format", "Looks and colors", "Drawing", "Testing" and "Build phases" (phase 1 only).

All paths are relative to the project root. Run every command from there. Work on branch `feat/character-roster`.

## Global Constraints

- `npm test`, `npx tsc -b` and `npx oxlint` must pass at the end of every task. The tsconfig is strict, with `noUncheckedIndexedAccess`, `noUnusedLocals` and `noUnusedParameters`.
- Pure modules must not import `pixi.js` or touch the DOM at module load, because vitest runs in node. The pure modules are `roster.ts`, `pixelKit.ts`, `poses.ts`, `humanArt.ts`, `animalArt.ts`, `look.ts`, `color.ts`, `contract.ts`, and `paint.ts`'s `partsFor`.
- Frames are 48x48 px in a 6x6 grid, so sheets are **288x288 px**. Row order: idle 0 (4 frames, 4 fps), walk 1 (6, 10), jump 2 (6, 10), talk 3 (4, 6), cheer 4 (4, 6), sad 5 (4, 2). `spriteScale` defaults to **2**.
- Color roles: `chat`, `skin`, `hair`, `accent`, `fixed`.
  - Tinted layers are painted in grays: white takes the tint, black stays black.
  - `fixed` layers are painted in final colors and get tint `0xffffff`, which means no tint.
- Palettes, verbatim:
  - `SKIN_TONES = [0xf6d2b4, 0xe2a882, 0xb9784f, 0x7d4a2c]`
  - `HAIR_COLORS = [0x2a1a12, 0x7a4520, 0xe0b04a, 0xa8322c]`
  - pants `#3b4a6b`, shoes `#3a2a2a`
  - animals: cat `#f0a04b`, dog `#a0703c`, duck `#f5d547`, frog `#6bbf59`, bunny `#e8e2dc`, bear `#8a5a3c`, fox `#e8762c`
- DNA v2 draw order is frozen: kind roll → animal → build → skin → hairStyle → hairColor → palette → accessory presence (25% none) → accessory → walkSpeed → depth. `HUMAN_SHARE = 0.5`.
- Sheet names (these are also PNG drop-in names, `<id>.png`):
  - `human-{skinny,average,chubby}-{pants,shirt,skin}`
  - `human-face`
  - `hair-{short,long,bun,spiky}`, plus `hair-long-back`
  - `accessory-{cap,bow,glasses}`
  - the seven animals
  - `collar`
- The overlay must keep working as an OBS local file: no runtime fetches of missing files, `dist/index.html`, and `overrides.ts` keeps `channel: 'gooferg'`.
- Commit messages carry **no** `Co-Authored-By` or AI attribution. This repo commits as the GitHub noreply address already set in its local git config.

## Review Focus

1. **A PNG dropped in with a sheet's name but the wrong size** must fall back to the painted sheet for that layer only, with a warning. Test: Task 7 (`isSheetSize(288, 288)` and the old 192 size rejected).
2. **Sheet names that are prefixes of each other** (`hair-long` vs `hair-long-back`) must never resolve to the wrong PNG. Test: Task 7 (`findSheet` whole-name match).
3. **Hair and accessories on every build:** the head must sit in exactly the same place for skinny, average and chubby, or hats float and glasses miss the eyes. Test: Task 4.
4. **Every sheet the roster can ask for must exist and have art in every frame**, or an avatar spawns with a missing layer or crashes the catalog. Test: Task 7 (`partsFor` over `ALL_SHEETS` × all poses) and Task 1 (`layersFor` only returns ids in `ALL_SHEETS`).
5. **Art spilling into the neighbouring frame** (hands up in a jump, bunny ears, a bun) would show as flickering fragments. Test: Tasks 4, 5 and 7 check every part's bounds, outline included, against the 48 px frame in every pose.

---

### Task 1: Roster model and `layersFor`

**Files:**
- Create: `src/render/sprites/roster.ts`
- Test: `src/render/sprites/roster.test.ts`

**Interfaces:**
- Produces:
  - Types: `Kind`, `Animal`, `Build`, `HairStyle`, `AccessoryName`, `ColorRole`, `SheetId`, `HumanLayer`, `Look`, `LayerRef`
  - Constants: `ANIMALS`, `KINDS`, `BUILDS`, `HAIR_STYLES`, `ACCESSORIES`, `BACK_HAIR`, `SKIN_TONES`, `HAIR_COLORS`, `ALL_SHEETS`
  - `layersFor(look: Look): LayerRef[]`

- [ ] **Step 1: Write the failing test**

Create `src/render/sprites/roster.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  ACCESSORIES,
  ALL_SHEETS,
  ANIMALS,
  BUILDS,
  HAIR_STYLES,
  layersFor,
  type Look,
} from './roster'

const human: Look = {
  kind: 'human',
  build: 'chubby',
  skin: 2,
  hairStyle: 'long',
  hairColor: 1,
  accessory: 'cap',
}

describe('layersFor', () => {
  it('stacks a human back to front with each layer colored by its role', () => {
    expect(layersFor(human)).toEqual([
      { sheet: 'hair-long-back', role: 'hair' },
      { sheet: 'human-chubby-pants', role: 'fixed' },
      { sheet: 'human-chubby-shirt', role: 'chat' },
      { sheet: 'human-chubby-skin', role: 'skin' },
      { sheet: 'human-face', role: 'fixed' },
      { sheet: 'hair-long', role: 'hair' },
      { sheet: 'accessory-cap', role: 'accent' },
    ])
  })

  it('leaves out the back hair and accessory when a human has none', () => {
    const plain = layersFor({ ...human, hairStyle: 'short', accessory: null })
    expect(plain.map((l) => l.sheet)).toEqual([
      'human-chubby-pants',
      'human-chubby-shirt',
      'human-chubby-skin',
      'human-face',
      'hair-short',
    ])
  })

  it('builds an animal from its own sheet plus the chat-colored collar', () => {
    expect(layersFor({ ...human, kind: 'fox' })).toEqual([
      { sheet: 'fox', role: 'fixed' },
      { sheet: 'collar', role: 'chat' },
    ])
  })

  it('only ever asks for sheets that exist', () => {
    const known = new Set<string>(ALL_SHEETS)
    for (const kind of ['human', ...ANIMALS] as const) {
      for (const build of BUILDS) {
        for (const hairStyle of HAIR_STYLES) {
          for (const accessory of [...ACCESSORIES, null]) {
            for (const layer of layersFor({ ...human, kind, build, hairStyle, accessory })) {
              expect(known.has(layer.sheet)).toBe(true)
            }
          }
        }
      }
    }
  })

  it('lists every sheet exactly once', () => {
    expect(new Set(ALL_SHEETS).size).toBe(ALL_SHEETS.length)
    expect(ALL_SHEETS).toHaveLength(9 + 1 + 4 + 1 + 3 + 7 + 1)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/render/sprites/roster.test.ts`
Expected: FAIL, because `./roster` cannot be resolved.

- [ ] **Step 3: Implement**

Create `src/render/sprites/roster.ts`:

```ts
/**
 * The character roster: which kinds exist, what a look is made of, and
 * which layer sheets (with which color role) assemble each look. Pure data
 * and one function; every sheet name here is also a PNG drop-in name.
 */
export const ANIMALS = ['cat', 'dog', 'duck', 'frog', 'bunny', 'bear', 'fox'] as const
export type Animal = (typeof ANIMALS)[number]
export type Kind = 'human' | Animal
export const KINDS: readonly Kind[] = ['human', ...ANIMALS]

export const BUILDS = ['skinny', 'average', 'chubby'] as const
export type Build = (typeof BUILDS)[number]

export const HAIR_STYLES = ['short', 'long', 'bun', 'spiky'] as const
export type HairStyle = (typeof HAIR_STYLES)[number]
/** Hairstyles that also have a layer behind the head. */
export const BACK_HAIR: readonly HairStyle[] = ['long']

export const ACCESSORIES = ['cap', 'bow', 'glasses'] as const
export type AccessoryName = (typeof ACCESSORIES)[number]

/** Human skin tones, light to deep. */
export const SKIN_TONES: readonly number[] = [0xf6d2b4, 0xe2a882, 0xb9784f, 0x7d4a2c]
/** Hair colors: black, brown, blond, red. */
export const HAIR_COLORS: readonly number[] = [0x2a1a12, 0x7a4520, 0xe0b04a, 0xa8322c]

/** What colors a layer: see roleTints. `fixed` layers are painted in final colors. */
export type ColorRole = 'chat' | 'skin' | 'hair' | 'accent' | 'fixed'

export type HumanLayer = 'pants' | 'shirt' | 'skin'

export type SheetId =
  | `human-${Build}-${HumanLayer}`
  | 'human-face'
  | `hair-${HairStyle}`
  | `hair-${HairStyle}-back`
  | `accessory-${AccessoryName}`
  | Animal
  | 'collar'

const HUMAN_LAYERS: readonly HumanLayer[] = ['pants', 'shirt', 'skin']

export const ALL_SHEETS: readonly SheetId[] = [
  ...BUILDS.flatMap((b) => HUMAN_LAYERS.map((l): SheetId => `human-${b}-${l}`)),
  'human-face',
  ...HAIR_STYLES.map((s): SheetId => `hair-${s}`),
  ...BACK_HAIR.map((s): SheetId => `hair-${s}-back`),
  ...ACCESSORIES.map((a): SheetId => `accessory-${a}`),
  ...ANIMALS,
  'collar',
]

export interface Look {
  kind: Kind
  /** The fields below only apply to humans. */
  build: Build
  /** Index into SKIN_TONES. */
  skin: number
  hairStyle: HairStyle
  /** Index into HAIR_COLORS. */
  hairColor: number
  accessory: AccessoryName | null
}

export interface LayerRef {
  sheet: SheetId
  role: ColorRole
}

/** The layer stack for a look, back to front. The single place characters are assembled. */
export function layersFor(look: Look): LayerRef[] {
  if (look.kind !== 'human') {
    return [
      { sheet: look.kind, role: 'fixed' },
      { sheet: 'collar', role: 'chat' },
    ]
  }
  const { build, hairStyle, accessory } = look
  const layers: LayerRef[] = []
  if (BACK_HAIR.includes(hairStyle)) layers.push({ sheet: `hair-${hairStyle}-back`, role: 'hair' })
  layers.push(
    { sheet: `human-${build}-pants`, role: 'fixed' },
    { sheet: `human-${build}-shirt`, role: 'chat' },
    { sheet: `human-${build}-skin`, role: 'skin' },
    { sheet: 'human-face', role: 'fixed' },
    { sheet: `hair-${hairStyle}`, role: 'hair' },
  )
  if (accessory) layers.push({ sheet: `accessory-${accessory}`, role: 'accent' })
  return layers
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/render/sprites/roster.test.ts && npx tsc -b && npx oxlint`
Expected: 5 tests PASS, with no type or lint errors.

- [ ] **Step 5: Commit**

```bash
git add src/render/sprites/roster.ts src/render/sprites/roster.test.ts
git commit -m "feat: character roster model and layer stacks"
```

---

### Task 2: Pixel toolkit

**Files:**
- Create: `src/render/sprites/pixelKit.ts`
- Test: `src/render/sprites/pixelKit.test.ts`

**Interfaces:**
- Produces:
  - Types: `PixelCtx` (anything with `fillStyle` and `fillRect`), `Part` (ellipse `e`, rect `r` or triangle `t`, each with `col`, optional `shade`, optional `noOutline`), `Span`
  - Constants: `OUTLINE`
  - Functions:
    - `spans(p, grow?)`
    - `partBounds(p): { x0, y0, x1, y1 }`, where `x1` and `y1` are exclusive and the 1 px outline is included unless `noOutline`
    - `drawParts(ctx, parts)`
    - `mix(a, b, t)`, `darken(c, t)`, `lighten(c, t)`, all on `#rrggbb` strings

- [ ] **Step 1: Write the failing test**

Create `src/render/sprites/pixelKit.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { OUTLINE, darken, drawParts, lighten, mix, partBounds, spans, type Part } from './pixelKit'

function recorder() {
  const ops: { style: string; x: number; y: number; w: number; h: number }[] = []
  const ctx = {
    fillStyle: '' as string | CanvasGradient | CanvasPattern,
    fillRect(x: number, y: number, w: number, h: number) {
      ops.push({ style: String(this.fillStyle), x, y, w, h })
    },
  }
  return { ctx, ops }
}

describe('spans', () => {
  it('fills a rect row by row', () => {
    expect(spans({ t: 'r', x: 2, y: 3, w: 4, h: 2, col: '#fff' })).toEqual([
      { x: 2, y: 3, w: 4 },
      { x: 2, y: 4, w: 4 },
    ])
  })

  it('fills an ellipse symmetrically around its centre', () => {
    const rows = spans({ t: 'e', cx: 10, cy: 10, rx: 3, ry: 2, col: '#fff' })
    expect(rows.map((r) => r.y)).toEqual([8, 9, 10, 11, 12])
    for (const r of rows) expect(r.x + r.w - 1 - 10).toBe(10 - r.x)
  })

  it('widens a triangle from its tip to its base', () => {
    const rows = spans({ t: 't', cx: 10, top: 0, h: 4, w: 7, col: '#fff' })
    expect(rows[0]?.w).toBe(1)
    expect(rows[3]?.w).toBe(7)
  })
})

describe('partBounds', () => {
  it('includes the 1px outline unless the part has none', () => {
    const rect: Part = { t: 'r', x: 5, y: 5, w: 2, h: 2, col: '#fff' }
    expect(partBounds(rect)).toEqual({ x0: 4, y0: 4, x1: 8, y1: 8 })
    expect(partBounds({ ...rect, noOutline: true })).toEqual({ x0: 5, y0: 5, x1: 7, y1: 7 })
  })
})

describe('drawParts', () => {
  it('draws every outline before any fill, so parts merge into one silhouette', () => {
    const { ctx, ops } = recorder()
    drawParts(ctx, [
      { t: 'r', x: 0, y: 0, w: 2, h: 2, col: '#ff0000' },
      { t: 'r', x: 3, y: 0, w: 2, h: 2, col: '#00ff00' },
    ])
    const lastOutline = ops.map((o) => o.style).lastIndexOf(OUTLINE)
    const firstFill = ops.findIndex((o) => o.style !== OUTLINE)
    expect(lastOutline).toBeLessThan(firstFill)
  })

  it('shades a part by laying its colour over a shade-coloured copy', () => {
    const { ctx, ops } = recorder()
    drawParts(ctx, [{ t: 'r', x: 0, y: 0, w: 3, h: 3, col: '#ffffff', shade: '#999999', noOutline: true }])
    expect(ops.map((o) => o.style)).toEqual(['#999999', '#999999', '#999999', '#ffffff', '#ffffff'])
  })
})

describe('colour helpers', () => {
  it('mixes, darkens and lightens #rrggbb colours', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080')
    expect(darken('#ff0000', 0.5)).toBe('#800000')
    expect(lighten('#000080', 1)).toBe('#ffffff')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/render/sprites/pixelKit.test.ts`
Expected: FAIL, because `./pixelKit` cannot be resolved.

- [ ] **Step 3: Implement**

Create `src/render/sprites/pixelKit.ts`:

```ts
/**
 * Tiny pixel-art toolkit shared by every code-drawn sheet. Shapes are
 * described as data (Parts), rasterised into horizontal spans, and drawn
 * in two passes: a 1px black outline for every part first, then the fills,
 * so overlapping parts merge into one clean silhouette. Pure except for
 * drawParts, which only needs fillStyle + fillRect (a fake in tests).
 */
export const OUTLINE = '#000000'

interface PartStyle {
  col: string
  /** When set, the part is filled with `shade` and then `col` nudged up-left, leaving a shaded rim. */
  shade?: string
  noOutline?: boolean
}

export type Part =
  | ({ t: 'e'; cx: number; cy: number; rx: number; ry: number } & PartStyle)
  | ({ t: 'r'; x: number; y: number; w: number; h: number } & PartStyle)
  | ({ t: 't'; cx: number; top: number; h: number; w: number } & PartStyle)

export interface Span {
  x: number
  y: number
  w: number
}

export interface PixelCtx {
  fillStyle: string | CanvasGradient | CanvasPattern
  fillRect(x: number, y: number, w: number, h: number): void
}

/** The filled pixel rows of a part; `grow` expands it (1 = its outline ring). */
export function spans(p: Part, grow = 0): Span[] {
  const out: Span[] = []
  if (p.t === 'r') {
    for (let y = p.y - grow; y < p.y + p.h + grow; y++) out.push({ x: p.x - grow, y, w: p.w + 2 * grow })
  } else if (p.t === 'e') {
    const rx = p.rx + grow
    const ry = p.ry + grow
    for (let y = Math.ceil(p.cy - ry); y <= Math.floor(p.cy + ry); y++) {
      const t = (y - p.cy) / ry
      const hw = rx * Math.sqrt(Math.max(0, 1 - t * t))
      const x0 = Math.round(p.cx - hw)
      const x1 = Math.round(p.cx + hw)
      out.push({ x: x0, y, w: x1 - x0 + 1 })
    }
  } else {
    const h = p.h + grow
    const w = p.w + 2 * grow
    for (let i = 0; i < h; i++) {
      const wi = Math.max(1, Math.round(1 + (i * (w - 1)) / Math.max(1, h - 1)))
      out.push({ x: Math.round(p.cx - wi / 2), y: p.top - grow + i, w: wi })
    }
  }
  return out
}

/** Pixel bounds of a part, outline included unless it has none; x1/y1 are exclusive. */
export function partBounds(p: Part): { x0: number; y0: number; x1: number; y1: number } {
  const rows = spans(p, p.noOutline ? 0 : 1)
  return {
    x0: Math.min(...rows.map((r) => r.x)),
    y0: Math.min(...rows.map((r) => r.y)),
    x1: Math.max(...rows.map((r) => r.x + r.w)),
    y1: Math.max(...rows.map((r) => r.y)) + 1,
  }
}

export function drawParts(ctx: PixelCtx, parts: readonly Part[]): void {
  ctx.fillStyle = OUTLINE
  for (const p of parts) if (!p.noOutline) fill(ctx, spans(p, 1))
  for (const p of parts) {
    ctx.fillStyle = p.shade ?? p.col
    fill(ctx, spans(p))
    if (p.shade) {
      ctx.fillStyle = p.col
      fill(ctx, spans(highlightOf(p)))
    }
  }
}

function highlightOf(p: Part): Part {
  if (p.t === 'e') return { ...p, cx: p.cx - 0.6, cy: p.cy - 0.8, rx: p.rx - 0.9, ry: p.ry - 0.9 }
  if (p.t === 'r') return { ...p, w: p.w - 1, h: p.h - 1 }
  return p
}

function fill(ctx: PixelCtx, rows: Span[]): void {
  for (const r of rows) ctx.fillRect(r.x, r.y, r.w, 1)
}

export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = rgb(a)
  const [r2, g2, b2] = rgb(b)
  const c = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0')
  return `#${c(r1, r2)}${c(g1, g2)}${c(b1, b2)}`
}

export const darken = (c: string, t: number): string => mix(c, '#000000', t)
export const lighten = (c: string, t: number): string => mix(c, '#ffffff', t)

function rgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/render/sprites/pixelKit.test.ts && npx tsc -b && npx oxlint`
Expected: 7 tests PASS, with no type or lint errors.

- [ ] **Step 5: Commit**

```bash
git add src/render/sprites/pixelKit.ts src/render/sprites/pixelKit.test.ts
git commit -m "feat: pixel toolkit for code-drawn sheets"
```

---

### Task 3: Pose tables

**Files:**
- Create: `src/render/sprites/poses.ts`
- Test: `src/render/sprites/poses.test.ts`

**Interfaces:**
- Consumes: `AnimName`, `ANIM_NAMES`, `ANIMATIONS` from `contract.ts`.
- Produces:
  - Types: `Arms`, `Face`, `Pose`
  - `pose(dy?, squash?, extra?)`
  - `POSES: Record<AnimName, Pose[]>`, shared by humans and animals

- [ ] **Step 1: Write the failing test**

Create `src/render/sprites/poses.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { ANIM_NAMES, ANIMATIONS } from './contract'
import { POSES } from './poses'

describe('POSES', () => {
  it('has exactly one pose per frame for every animation', () => {
    for (const name of ANIM_NAMES) expect(POSES[name]).toHaveLength(ANIMATIONS[name].frames)
  })

  it('gives the reaction rows their faces and arms', () => {
    expect(POSES.cheer.every((p) => p.face === 'happy' || p.face === 'grin')).toBe(true)
    expect(POSES.cheer.some((p) => p.arms === 'up')).toBe(true)
    expect(POSES.sad.every((p) => p.face === 'sad' && p.arms === 'limp' && p.squash > 0)).toBe(true)
  })

  it('never moves the feet below the ground line', () => {
    for (const name of ANIM_NAMES) for (const p of POSES[name]) expect(p.dy).toBeLessThanOrEqual(0)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/render/sprites/poses.test.ts`
Expected: FAIL, because `./poses` cannot be resolved.

- [ ] **Step 3: Implement**

Create `src/render/sprites/poses.ts`:

```ts
import type { AnimName } from './contract'

/** Arm pose for the whole character; each art module maps it to a shape per side. */
export type Arms = 'down' | 'swingA' | 'swingB' | 'mid' | 'up' | 'gesture' | 'limp'
export type Face = 'normal' | 'talk' | 'happy' | 'grin' | 'sad'

export interface Pose {
  /** Whole-character vertical offset in frame px (negative = up). Never below 0: feet stay on the ground. */
  dy: number
  /** Upper body (head, torso, arms) sinks by this many px: crouch or slump. Legs stay put. */
  squash: number
  /** 0 = feet together, 1 = left foot lifted, 2 = right foot lifted. */
  leg: number
  arms: Arms
  face: Face
}

export function pose(
  dy = 0,
  squash = 0,
  extra: Partial<Pick<Pose, 'leg' | 'arms' | 'face'>> = {},
): Pose {
  return { dy, squash, leg: 0, arms: 'down', face: 'normal', ...extra }
}

/** One table for every character: humans and animals are both chibi bipeds. */
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
    pose(0, 3),
    pose(-2, 0, { arms: 'mid' }),
    pose(-4, 0, { arms: 'up' }),
    pose(-4, 0, { arms: 'up' }),
    pose(-2, 0, { arms: 'mid' }),
    pose(0, 3),
  ],
  talk: [
    pose(0),
    pose(0, 0, { arms: 'gesture', face: 'talk' }),
    pose(0),
    pose(0, 0, { arms: 'gesture', face: 'talk' }),
  ],
  cheer: [
    pose(0, 0, { arms: 'mid', face: 'happy' }),
    pose(-2, 0, { arms: 'up', face: 'grin' }),
    pose(-3, 0, { arms: 'up', face: 'grin' }),
    pose(-1, 0, { arms: 'mid', face: 'happy' }),
  ],
  sad: [
    pose(0, 2, { arms: 'limp', face: 'sad' }),
    pose(0, 2, { arms: 'limp', face: 'sad' }),
    pose(0, 3, { arms: 'limp', face: 'sad' }),
    pose(0, 3, { arms: 'limp', face: 'sad' }),
  ],
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/render/sprites/poses.test.ts && npx tsc -b && npx oxlint`
Expected: 3 tests PASS, with no type or lint errors.

- [ ] **Step 5: Commit**

```bash
git add src/render/sprites/poses.ts src/render/sprites/poses.test.ts
git commit -m "feat: shared pose tables for the new characters"
```

---

### Task 4: Human art (faces shared with animals)

**Files:**
- Create: `src/render/sprites/faces.ts` (face details used by humans and animals)
- Create: `src/render/sprites/humanArt.ts`
- Test: `src/render/sprites/humanArt.test.ts`

**Interfaces:**
- Consumes: `Part`, `darken` (Task 2); `Pose`, `Face`, `Arms` (Task 3); `Build`, `HairStyle`, `AccessoryName`, `HumanLayer` (Task 1).
- Produces:
  - `faceParts(face: Face, spot: FaceSpot): Part[]`
  - constants `TINT_MAIN`, `TINT_SHADE`
  - `HEAD`
  - `humanBodyParts(layer: HumanLayer, build: Build, pose: Pose): Part[]`
  - `humanFaceParts(pose: Pose): Part[]`
  - `hairParts(style: HairStyle, back: boolean, pose: Pose): Part[]`
  - `accessoryParts(name: AccessoryName, pose: Pose): Part[]`

- [ ] **Step 1: Write the failing test**

Create `src/render/sprites/humanArt.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { ANIM_NAMES, FRAME_SIZE } from './contract'
import { accessoryParts, hairParts, humanBodyParts, humanFaceParts } from './humanArt'
import { partBounds, type Part } from './pixelKit'
import { POSES, pose } from './poses'
import { ACCESSORIES, BUILDS, HAIR_STYLES } from './roster'

const ALL_POSES = ANIM_NAMES.flatMap((name) => POSES[name])

function expectInFrame(parts: Part[], dy: number): void {
  for (const p of parts) {
    const b = partBounds(p)
    expect(b.x0).toBeGreaterThanOrEqual(0)
    expect(b.x1).toBeLessThanOrEqual(FRAME_SIZE)
    expect(b.y0 + dy).toBeGreaterThanOrEqual(0)
    expect(b.y1 + dy).toBeLessThanOrEqual(FRAME_SIZE)
  }
}

describe('human art', () => {
  it('keeps every human layer inside the 48px frame in every pose', () => {
    for (const p of ALL_POSES) {
      for (const build of BUILDS) {
        for (const layer of ['pants', 'shirt', 'skin'] as const) expectInFrame(humanBodyParts(layer, build, p), p.dy)
      }
      expectInFrame(humanFaceParts(p), p.dy)
      for (const style of HAIR_STYLES) {
        expectInFrame(hairParts(style, false, p), p.dy)
        expectInFrame(hairParts(style, true, p), p.dy)
      }
      for (const name of ACCESSORIES) expectInFrame(accessoryParts(name, p), p.dy)
    }
  })

  it('puts the head in the same place for every build, so hair and accessories fit all of them', () => {
    for (const p of ALL_POSES) {
      const [skinny, average, chubby] = BUILDS.map((b) => humanBodyParts('skin', b, p)[0])
      expect(average).toEqual(skinny)
      expect(chubby).toEqual(skinny)
    }
  })

  it('makes chubby wider than average, and average wider than skinny', () => {
    const width = (build: (typeof BUILDS)[number]) => {
      const bounds = humanBodyParts('shirt', build, pose()).map(partBounds)
      return Math.max(...bounds.map((b) => b.x1)) - Math.min(...bounds.map((b) => b.x0))
    }
    expect(width('average')).toBeGreaterThan(width('skinny'))
    expect(width('chubby')).toBeGreaterThan(width('average'))
  })

  it('only long hair has a layer behind the head', () => {
    for (const style of HAIR_STYLES) {
      expect(hairParts(style, true, pose()).length > 0).toBe(style === 'long')
      expect(hairParts(style, false, pose()).length).toBeGreaterThan(0)
    }
  })

  it('changes the face with the pose (a tear only when sad)', () => {
    const tear = (parts: Part[]) => parts.some((p) => p.col === '#8fd3ff')
    expect(tear(humanFaceParts(pose(0, 2, { face: 'sad' })))).toBe(true)
    expect(tear(humanFaceParts(pose()))).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/render/sprites/humanArt.test.ts`
Expected: FAIL, because `./humanArt` cannot be resolved.

- [ ] **Step 3: Implement shared faces**

Create `src/render/sprites/faces.ts`:

```ts
import type { Part } from './pixelKit'
import type { Face } from './poses'

const EYE = '#1a1020'
const SHINE = '#ffffff'
const MOUTH = '#6b2e2e'
const BLUSH = 'rgba(255, 90, 120, 0.45)'
export const TEAR = '#8fd3ff'

/** Where a character's face sits in the frame (already offset by the pose's squash). */
export interface FaceSpot {
  /** Left pixel of each 2px-wide eye. */
  eyeL: number
  eyeR: number
  eyeY: number
  mouthX: number
  mouthY: number
  blush: boolean
  mouth: boolean
}

const px = (x: number, y: number, col: string, w = 1, h = 1): Part => ({
  t: 'r', x, y, w, h, col, noOutline: true,
})

/** Eyes, brows, mouth, blush and tear for an expression; painted in final colors (fixed layer). */
export function faceParts(face: Face, s: FaceSpot): Part[] {
  const parts: Part[] = []
  const { eyeL, eyeR, eyeY } = s
  if (face === 'happy' || face === 'grin') {
    for (const x of [eyeL, eyeR]) {
      parts.push(px(x - 1, eyeY + 1, EYE), px(x, eyeY, EYE, 2, 1), px(x + 2, eyeY + 1, EYE))
    }
  } else if (face === 'sad') {
    parts.push(px(eyeL, eyeY + 1, EYE, 2, 1), px(eyeR, eyeY + 1, EYE, 2, 1))
    // worried brows: the inner ends raised
    parts.push(px(eyeL, eyeY - 1, EYE), px(eyeL + 1, eyeY - 2, EYE))
    parts.push(px(eyeR + 1, eyeY - 1, EYE), px(eyeR, eyeY - 2, EYE))
    parts.push(px(eyeL - 1, eyeY + 2, TEAR, 1, 2))
  } else {
    parts.push(px(eyeL, eyeY, EYE, 2, 2), px(eyeR, eyeY, EYE, 2, 2))
    parts.push(px(eyeL, eyeY, SHINE), px(eyeR, eyeY, SHINE))
  }
  if (s.mouth) {
    const { mouthX: mx, mouthY: my } = s
    if (face === 'talk') parts.push(px(mx, my, MOUTH, 2, 2))
    else if (face === 'happy') parts.push(px(mx - 1, my, MOUTH), px(mx, my + 1, MOUTH, 2, 1), px(mx + 2, my, MOUTH))
    else if (face === 'grin') parts.push(px(mx - 1, my, MOUTH, 4, 1), px(mx, my + 1, MOUTH, 2, 1))
    else if (face === 'sad') parts.push(px(mx, my, MOUTH, 2, 1), px(mx - 1, my + 1, MOUTH), px(mx + 2, my + 1, MOUTH))
    else parts.push(px(mx, my, MOUTH, 2, 1))
  }
  if (s.blush && face !== 'sad') {
    parts.push(px(eyeL - 3, eyeY + 3, BLUSH, 2, 1), px(eyeR + 2, eyeY + 3, BLUSH, 2, 1))
  }
  return parts
}
```

- [ ] **Step 4: Implement the human art**

Create `src/render/sprites/humanArt.ts`:

```ts
import { faceParts } from './faces'
import { darken, type Part } from './pixelKit'
import type { Arms, Pose } from './poses'
import type { AccessoryName, Build, HairStyle, HumanLayer } from './roster'

/**
 * Chibi humans as part geometry, one function per layer sheet. Tinted
 * layers (shirt, skin, hair, accessory) are painted in grays: white takes
 * the tint, gray shades it, black outlines stay black. Pants and the face
 * are fixed layers painted in final colors.
 */
export const TINT_MAIN = '#ffffff'
export const TINT_SHADE = '#c4c4c4'
const SKIN_SHADE = '#dcdcdc'
const HAIR_SHADE = '#c8c8c8'
const PANTS = '#3b4a6b'
const SHOES = '#3a2a2a'
const LENS = '#707070'

const CX = 24
/** Shared by every build so hair, face and accessories fit all of them. */
export const HEAD = { y: 16, rx: 8.5, ry: 8 } as const
const TORSO_Y = 33
const LEG_TOP = 36
const LEG_BOT = 44

interface BuildShape {
  rx: number
  ry: number
  arm: number
  leg: number
}

const BUILD_SHAPES: Record<Build, BuildShape> = {
  skinny: { rx: 4.5, ry: 6, arm: 2, leg: 2 },
  average: { rx: 6.5, ry: 6, arm: 3, leg: 3 },
  chubby: { rx: 9, ry: 7, arm: 3, leg: 4 },
}

type ArmShape = 'down' | 'swing' | 'mid' | 'up' | 'limp'
const ARM_SHAPES: Record<Arms, [left: ArmShape, right: ArmShape]> = {
  down: ['down', 'down'],
  swingA: ['swing', 'down'],
  swingB: ['down', 'swing'],
  mid: ['mid', 'mid'],
  up: ['up', 'up'],
  gesture: ['down', 'mid'],
  limp: ['limp', 'limp'],
}

/** Sleeve (shirt layer) and hand (skin layer) for one arm. */
function arm(shape: ArmShape, side: -1 | 1, b: BuildShape, u: number): { sleeve: Part; hand: Part } {
  const top = TORSO_Y - b.ry + 1 + u
  const len = Math.round(b.ry * 1.5)
  const shoulder = CX + side * b.rx
  const x = side < 0 ? Math.round(CX - b.rx - b.arm) : Math.round(CX + b.rx)
  const cloth = { col: TINT_MAIN, shade: TINT_SHADE }
  switch (shape) {
    case 'mid':
      return {
        sleeve: { t: 'e', cx: shoulder + side * 3.5, cy: top + 2, rx: 3.5, ry: b.arm / 2 + 0.5, ...cloth },
        hand: { t: 'e', cx: shoulder + side * 7, cy: top + 1.5, rx: 1.5, ry: 1.5, col: TINT_MAIN },
      }
    case 'up':
      return {
        sleeve: { t: 'e', cx: shoulder + side * 3, cy: top - 5, rx: b.arm / 2 + 0.5, ry: 5.5, ...cloth },
        hand: { t: 'e', cx: shoulder + side * 4, cy: top - 11, rx: 1.5, ry: 1.5, col: TINT_MAIN },
      }
    default: {
      // hanging arms: swing steps out and shortens, limp hangs lower and closer
      const dx = shape === 'swing' ? side : shape === 'limp' ? -side : 0
      const dy = shape === 'limp' ? 1 : 0
      const h = shape === 'swing' ? len - 1 : len
      return {
        sleeve: { t: 'r', x: x + dx, y: top + dy, w: b.arm, h, ...cloth },
        hand: { t: 'r', x: x + dx, y: top + dy + h - 2, w: b.arm, h: 2, col: TINT_MAIN },
      }
    }
  }
}

/** Pants/shoes, shirt (torso + sleeves) or skin (head + hands) for one build. */
export function humanBodyParts(layer: HumanLayer, build: Build, pose: Pose): Part[] {
  const b = BUILD_SHAPES[build]
  const u = pose.squash
  if (layer === 'pants') {
    const legs: Part[] = []
    for (const side of [-1, 1] as const) {
      const lifted = (pose.leg === 1 && side < 0) || (pose.leg === 2 && side > 0) ? 1 : 0
      const x = side < 0 ? CX - 1 - b.leg : CX + 1
      legs.push({ t: 'r', x, y: LEG_TOP, w: b.leg, h: LEG_BOT - LEG_TOP - lifted, col: PANTS, shade: darken(PANTS, 0.2) })
      legs.push({ t: 'r', x, y: LEG_BOT - lifted, w: b.leg + 1, h: 2, col: SHOES })
    }
    return legs
  }
  const [leftShape, rightShape] = ARM_SHAPES[pose.arms]
  const arms = [arm(leftShape, -1, b, u), arm(rightShape, 1, b, u)]
  if (layer === 'shirt') {
    return [
      ...arms.map((a) => a.sleeve),
      { t: 'e', cx: CX, cy: TORSO_Y + u, rx: b.rx, ry: b.ry, col: TINT_MAIN, shade: TINT_SHADE },
    ]
  }
  // skin: head first (tests rely on it), hands after so raised hands show over the head's edge
  return [
    { t: 'e', cx: CX, cy: HEAD.y + u, rx: HEAD.rx, ry: HEAD.ry, col: TINT_MAIN, shade: SKIN_SHADE },
    ...arms.map((a) => a.hand),
  ]
}

/** The human face, looking a little to the right (the walking direction). */
export function humanFaceParts(pose: Pose): Part[] {
  const eyeY = HEAD.y + 1 + pose.squash
  return faceParts(pose.face, {
    eyeL: CX, eyeR: CX + 4, eyeY, mouthX: CX + 2, mouthY: eyeY + 4, blush: true, mouth: true,
  })
}

/** Front hair, or (back = true) the part behind the head; only long hair has one. */
export function hairParts(style: HairStyle, back: boolean, pose: Pose): Part[] {
  const u = pose.squash
  const hair = { col: TINT_MAIN, shade: HAIR_SHADE }
  if (back) {
    if (style !== 'long') return []
    const strandH = Math.round(HEAD.ry + 4)
    return [
      { t: 'e', cx: CX, cy: HEAD.y + u - 0.5, rx: HEAD.rx + 1.5, ry: HEAD.ry + 1, ...hair },
      { t: 'r', x: Math.round(CX - HEAD.rx - 1.5), y: HEAD.y + u, w: 3, h: strandH, ...hair },
      { t: 'r', x: Math.round(CX + HEAD.rx - 1.5), y: HEAD.y + u, w: 3, h: strandH, ...hair },
    ]
  }
  const top: Part = { t: 'e', cx: CX - 0.5, cy: HEAD.y + u - HEAD.ry * 0.55, rx: HEAD.rx + 0.5, ry: HEAD.ry * 0.5, ...hair }
  switch (style) {
    case 'short':
      return [
        top,
        { t: 'r', x: Math.round(CX - HEAD.rx - 0.5), y: HEAD.y + u - 3, w: 2, h: 3, ...hair },
        { t: 'r', x: Math.round(CX + HEAD.rx - 1.5), y: HEAD.y + u - 3, w: 2, h: 3, ...hair },
      ]
    case 'long':
      return [top]
    case 'bun':
      return [top, { t: 'e', cx: CX - 2, cy: HEAD.y + u - HEAD.ry - 0.5, rx: 2.5, ry: 2, ...hair }]
    case 'spiky': {
      const spikeTop = Math.round(HEAD.y + u - HEAD.ry * 0.55 - HEAD.ry * 0.5 - 2)
      return [
        ...[-1, 0, 1].map((i): Part => ({ t: 't', cx: CX + i * 3.5, top: spikeTop, h: 3, w: 3, col: TINT_MAIN })),
        top,
      ]
    }
  }
}

/** Accessories sit on the shared head, so they fit every build. */
export function accessoryParts(name: AccessoryName, pose: Pose): Part[] {
  const u = pose.squash
  const accent = { col: TINT_MAIN, shade: TINT_SHADE }
  switch (name) {
    case 'cap':
      return [
        { t: 'e', cx: CX - 0.5, cy: HEAD.y + u - HEAD.ry * 0.6, rx: HEAD.rx + 1, ry: HEAD.ry * 0.45, ...accent },
        { t: 'r', x: CX + 2, y: HEAD.y + u - 4, w: 9, h: 2, ...accent },
      ]
    case 'bow':
      return [
        { t: 'e', cx: CX - 6, cy: HEAD.y + u - 7, rx: 2, ry: 1.5, ...accent },
        { t: 'e', cx: CX - 2, cy: HEAD.y + u - 7, rx: 2, ry: 1.5, ...accent },
        { t: 'r', x: CX - 5, y: HEAD.y + u - 8, w: 2, h: 2, col: TINT_SHADE },
      ]
    case 'glasses': {
      const eyeY = HEAD.y + 1 + u
      return [
        { t: 'r', x: CX - 1, y: eyeY - 1, w: 4, h: 4, col: LENS },
        { t: 'r', x: CX + 3, y: eyeY - 1, w: 4, h: 4, col: LENS },
        { t: 'r', x: CX, y: eyeY, w: 1, h: 1, col: TINT_MAIN, noOutline: true },
        { t: 'r', x: CX + 4, y: eyeY, w: 1, h: 1, col: TINT_MAIN, noOutline: true },
      ]
    }
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/render/sprites/humanArt.test.ts && npx tsc -b && npx oxlint`
Expected: 5 tests PASS, with no type or lint errors. If a bounds assertion fails, the message names the coordinate. Nudge that part's geometry inward rather than loosening the test, and record the change as a ruling.

- [ ] **Step 6: Commit**

```bash
git add src/render/sprites/faces.ts src/render/sprites/humanArt.ts src/render/sprites/humanArt.test.ts
git commit -m "feat: code-drawn chibi humans with builds, hair and accessories"
```

---

### Task 5: Animal art and the collar

**Files:**
- Create: `src/render/sprites/animalArt.ts`
- Test: `src/render/sprites/animalArt.test.ts`

**Interfaces:**
- Consumes: `Part`, `darken`, `lighten` (Task 2); `Pose`, `Arms` (Task 3); `Animal`, `ANIMALS` (Task 1); `faceParts`, `TEAR` (Task 4); `TINT_MAIN`, `TINT_SHADE` (Task 4).
- Produces: `animalParts(kind: Animal, pose: Pose): Part[]`, `collarParts(pose: Pose): Part[]`, `ANIMAL_COLORS`.

- [ ] **Step 1: Write the failing test**

Create `src/render/sprites/animalArt.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { animalParts, collarParts } from './animalArt'
import { ANIM_NAMES, FRAME_SIZE } from './contract'
import { partBounds, type Part } from './pixelKit'
import { POSES, pose } from './poses'
import { ANIMALS } from './roster'

const ALL_POSES = ANIM_NAMES.flatMap((name) => POSES[name])

function expectInFrame(parts: Part[], dy: number): void {
  for (const p of parts) {
    const b = partBounds(p)
    expect(b.x0).toBeGreaterThanOrEqual(0)
    expect(b.x1).toBeLessThanOrEqual(FRAME_SIZE)
    expect(b.y0 + dy).toBeGreaterThanOrEqual(0)
    expect(b.y1 + dy).toBeLessThanOrEqual(FRAME_SIZE)
  }
}

const topOf = (parts: Part[]) => Math.min(...parts.map((p) => partBounds(p).y0))

describe('animal art', () => {
  it('keeps every animal and the collar inside the 48px frame in every pose', () => {
    for (const p of ALL_POSES) {
      for (const kind of ANIMALS) expectInFrame(animalParts(kind, p), p.dy)
      expectInFrame(collarParts(p), p.dy)
    }
  })

  it('draws each animal differently', () => {
    const drawings = ANIMALS.map((k) => JSON.stringify(animalParts(k, pose())))
    expect(new Set(drawings).size).toBe(ANIMALS.length)
  })

  it('droops the ears when sad', () => {
    for (const kind of ['cat', 'bunny', 'fox'] as const) {
      const sad = animalParts(kind, pose(0, 2, { face: 'sad' }))
      const calm = animalParts(kind, pose(0, 2))
      expect(topOf(sad)).toBeGreaterThan(topOf(calm))
    }
  })

  it('sits the collar on the neck, where the head meets the body', () => {
    const [collar] = collarParts(pose())
    expect(collar).toMatchObject({ t: 'r', y: 28 })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/render/sprites/animalArt.test.ts`
Expected: FAIL, because `./animalArt` cannot be resolved.

- [ ] **Step 3: Implement**

Create `src/render/sprites/animalArt.ts`:

```ts
import { faceParts, TEAR } from './faces'
import { TINT_MAIN, TINT_SHADE } from './humanArt'
import { darken, lighten, type Part } from './pixelKit'
import type { Arms, Pose } from './poses'
import type { Animal } from './roster'

/**
 * Upright chibi animals sharing one body template (so one collar fits all),
 * painted in natural colors as fixed layers, face included. The collar is
 * a separate gray layer tinted with the chatter's color.
 */
export const ANIMAL_COLORS: Record<Animal, string> = {
  cat: '#f0a04b',
  dog: '#a0703c',
  duck: '#f5d547',
  frog: '#6bbf59',
  bunny: '#e8e2dc',
  bear: '#8a5a3c',
  fox: '#e8762c',
}
const BEAK = '#f39c34'
const PINK = '#f5a0b8'
const NOSE = '#1a1020'
const WHITE = '#ffffff'

const CX = 24
const HEAD_Y = 21.5
const BODY_Y = 35
const COLLAR_Y = 28

type PawShape = 'down' | 'swing' | 'mid' | 'up' | 'limp'
const PAW_SHAPES: Record<Arms, [left: PawShape, right: PawShape]> = {
  down: ['down', 'down'],
  swingA: ['swing', 'down'],
  swingB: ['down', 'swing'],
  mid: ['mid', 'mid'],
  up: ['up', 'up'],
  gesture: ['down', 'mid'],
  limp: ['limp', 'limp'],
}

function paw(shape: PawShape, side: -1 | 1, u: number, col: string, shade: string): Part {
  const at = (dx: number, cy: number, rx: number, ry: number): Part => ({
    t: 'e', cx: CX + side * dx, cy: cy + u, rx, ry, col, shade,
  })
  switch (shape) {
    case 'swing': return at(8, 32, 2, 3)
    case 'mid': return at(9.5, 31, 2.5, 2)
    case 'up': return at(7, 25, 2, 3.5)
    case 'limp': return at(7, 35, 2, 3)
    default: return at(7.5, 33, 2, 3)
  }
}

export function animalParts(kind: Animal, pose: Pose): Part[] {
  const u = pose.squash
  const sad = pose.face === 'sad'
  const fur = ANIMAL_COLORS[kind]
  const shade = darken(fur, 0.25)
  const belly = lighten(fur, 0.55)
  const furPart = { col: fur, shade }
  const parts: Part[] = []

  // tails, behind everything
  if (kind === 'cat') {
    parts.push({ t: 'r', x: CX - 11, y: 29 + u, w: 2, h: 10, col: fur })
    parts.push({ t: 'r', x: CX - 13, y: 26 + u, w: 3, h: 4, col: fur })
  }
  if (kind === 'fox') parts.push({ t: 'e', cx: CX - 10, cy: 34 + u, rx: 4, ry: 6, ...furPart })
  if (kind === 'dog') parts.push({ t: 'e', cx: CX - 9, cy: 32 + u, rx: 2, ry: 3.5, col: fur })
  if (kind === 'bunny') parts.push({ t: 'e', cx: CX - 8, cy: 38 + u, rx: 2.5, ry: 2.5, col: WHITE })

  // ears behind the head; sad ones droop
  const droop = sad ? 2 : 0
  if (kind === 'cat') {
    for (const dx of [-5, 5]) parts.push({ t: 't', cx: CX + dx, top: 11 + u + droop, h: 6, w: 6, col: fur })
  }
  if (kind === 'fox') {
    for (const dx of [-5, 5]) parts.push({ t: 't', cx: CX + dx, top: 9 + u + droop, h: 8, w: 6, col: fur })
  }
  if (kind === 'bunny') {
    for (const side of [-1, 1]) {
      parts.push({
        t: 'e', cx: CX + side * (sad ? 5 : 3.5), cy: 10.5 + u + (sad ? 3 : 0), rx: 2, ry: sad ? 4 : 5.5, col: fur,
      })
    }
  }
  if (kind === 'bear') for (const dx of [-6.5, 6.5]) parts.push({ t: 'e', cx: CX + dx, cy: 15 + u, rx: 2.5, ry: 2.5, col: fur })

  // feet, paws/wings, body, head
  const footCol = kind === 'duck' ? BEAK : fur
  parts.push({ t: 'e', cx: CX - 3.5, cy: 43.5 - (pose.leg === 1 ? 1 : 0), rx: 2.5, ry: 1.5, col: footCol })
  parts.push({ t: 'e', cx: CX + 3.5, cy: 43.5 - (pose.leg === 2 ? 1 : 0), rx: 2.5, ry: 1.5, col: footCol })
  const [left, right] = PAW_SHAPES[pose.arms]
  parts.push(paw(left, -1, u, fur, shade), paw(right, 1, u, fur, shade))
  parts.push({ t: 'e', cx: CX, cy: BODY_Y + u, rx: 7, ry: 7.5, ...furPart })
  const frog = kind === 'frog'
  parts.push({ t: 'e', cx: CX, cy: HEAD_Y + u, rx: frog ? 10 : 8.5, ry: frog ? 6.5 : 7.5, ...furPart })
  if (frog) for (const dx of [-5, 5]) parts.push({ t: 'e', cx: CX + dx, cy: 15 + u, rx: 3, ry: 3, col: fur })
  if (kind === 'dog') {
    for (const dx of [-8.5, 8.5]) parts.push({ t: 'e', cx: CX + dx, cy: 22 + u + droop, rx: 2.5, ry: 5, col: darken(fur, 0.3) })
  }
  if (kind === 'duck') parts.push({ t: 'e', cx: CX + 8, cy: 23 + u, rx: 4, ry: 2, col: BEAK })

  // flat details on top (no outline)
  const flat = (p: Part): Part => ({ ...p, noOutline: true })
  parts.push(flat({ t: 'e', cx: CX + 0.5, cy: 36 + u, rx: 4, ry: 4.5, col: belly }))
  if (kind === 'dog' || kind === 'bear' || kind === 'fox' || kind === 'cat') {
    parts.push(flat({ t: 'e', cx: CX + 2, cy: 25 + u, rx: kind === 'bear' ? 4 : 3.5, ry: 2.5, col: kind === 'fox' ? WHITE : belly }))
  }
  if (kind === 'cat' || kind === 'fox') {
    parts.push(flat({ t: 'r', x: CX - 6, y: 14 + u + droop, w: 2, h: 2, col: PINK }))
    parts.push(flat({ t: 'r', x: CX + 4, y: 14 + u + droop, w: 2, h: 2, col: PINK }))
  }
  if (kind === 'bunny') {
    for (const side of [-1, 1]) {
      parts.push(flat({ t: 'e', cx: CX + side * (sad ? 5 : 3.5), cy: 10.5 + u + (sad ? 3 : 0), rx: 0.8, ry: sad ? 2.5 : 4, col: PINK }))
    }
  }
  if (frog) {
    parts.push(flat({ t: 'r', x: CX - 6, y: 14 + u, w: 3, h: 3, col: WHITE }))
    parts.push(flat({ t: 'r', x: CX + 4, y: 14 + u, w: 3, h: 3, col: WHITE }))
  }
  if (kind === 'dog' || kind === 'bear' || kind === 'fox') parts.push(flat({ t: 'r', x: CX + 4, y: 24 + u, w: 2, h: 1, col: NOSE }))
  if (kind === 'cat') {
    parts.push(flat({ t: 'r', x: CX + 3, y: 24 + u, w: 2, h: 1, col: '#e0607e' }))
    parts.push(flat({ t: 'r', x: CX + 7, y: 24 + u, w: 3, h: 1, col: lighten(fur, 0.8) }))
    parts.push(flat({ t: 'r', x: CX + 7, y: 26 + u, w: 3, h: 1, col: lighten(fur, 0.8) }))
  }
  if (kind === 'duck') {
    parts.push(flat({ t: 'r', x: CX + 6, y: 23 + u, w: 6, h: 1, col: darken(BEAK, 0.35) }))
    parts.push(flat({ t: 'r', x: CX - 1, y: 12 + u, w: 1, h: 2, col: fur }))
    parts.push(flat({ t: 'r', x: CX + 1, y: 11 + u, w: 1, h: 3, col: fur }))
  }

  // the face: frogs look out of their eye bumps; ducks talk with the beak
  const eyeY = frog ? 15 + u : 20 + u
  const face = faceParts(pose.face, {
    eyeL: frog ? CX - 5 : CX - 1,
    eyeR: frog ? CX + 5 : CX + 4,
    eyeY,
    mouthX: CX + 2,
    mouthY: frog ? 25 + u : 26 + u,
    blush: false,
    mouth: kind !== 'duck',
  })
  // a frog's tear would sit on its white eye; nudge it below the bump instead
  return parts.concat(frog ? face.map((p) => (p.col === TEAR && p.t === 'r' ? { ...p, y: p.y + 2 } : p)) : face)
}

/** One collar for every animal: all share the neck row. Tinted with the chat color. */
export function collarParts(pose: Pose): Part[] {
  return [{ t: 'r', x: CX - 6, y: COLLAR_Y + pose.squash, w: 13, h: 2, col: TINT_MAIN, shade: TINT_SHADE }]
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/render/sprites/animalArt.test.ts && npx tsc -b && npx oxlint`
Expected: 4 tests PASS, with no type or lint errors. As in Task 4, fix bounds failures by nudging geometry inward, and record each fix as a ruling.

- [ ] **Step 5: Commit**

```bash
git add src/render/sprites/animalArt.ts src/render/sprites/animalArt.test.ts
git commit -m "feat: code-drawn animals and the chat-colored collar"
```

---

### Task 6: Looks from the username (DNA v2), `resolveLook` and role tints

**Files:**
- Create: `src/avatars/look.ts`
- Test: `src/avatars/look.test.ts`
- Modify: `src/render/color.ts` (add `roleTints`)
- Modify: `src/render/color.test.ts`

**Interfaces:**
- Consumes: `fnv1a32` from `src/avatars/dna.ts` (unchanged), `mulberry32`, `pickIndex`, `range` from `src/utils/rng.ts`, the roster constants (Task 1), `PALETTES` from `contract.ts`.
- Produces:
  - `HUMAN_SHARE`
  - `LookDna = { look: Look; paletteIndex: number; walkSpeed: number; depth: number }`
  - `lookDna(login: string, walkSpeedRange: [number, number]): LookDna`
  - `Choice = { kind?: Kind; build?: Build }`
  - `resolveLook(base: Look, choice?: Choice | null): Look`
  - `roleTints(look: Look, colors: { body: number; accent: number }): Record<ColorRole, number>`

- [ ] **Step 1: Write the failing tests**

Create `src/avatars/look.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { PALETTES } from '../render/sprites/contract'
import { ACCESSORIES, BUILDS, HAIR_COLORS, HAIR_STYLES, KINDS, SKIN_TONES } from '../render/sprites/roster'
import { lookDna, resolveLook } from './look'

const SPEEDS: [number, number] = [30, 70]
const logins = Array.from({ length: 2000 }, (_, i) => `viewer_${i}`)

describe('lookDna', () => {
  it('is deterministic and ignores login case', () => {
    expect(lookDna('GooferG', SPEEDS)).toEqual(lookDna('gooferg', SPEEDS))
  })

  it('keeps every field in range', () => {
    for (const login of logins) {
      const { look, paletteIndex, walkSpeed, depth } = lookDna(login, SPEEDS)
      expect(KINDS).toContain(look.kind)
      expect(BUILDS).toContain(look.build)
      expect(HAIR_STYLES).toContain(look.hairStyle)
      expect(look.skin).toBeGreaterThanOrEqual(0)
      expect(look.skin).toBeLessThan(SKIN_TONES.length)
      expect(look.hairColor).toBeGreaterThanOrEqual(0)
      expect(look.hairColor).toBeLessThan(HAIR_COLORS.length)
      expect([...ACCESSORIES, null]).toContain(look.accessory)
      expect(paletteIndex).toBeLessThan(PALETTES.length)
      expect(walkSpeed).toBeGreaterThanOrEqual(SPEEDS[0])
      expect(walkSpeed).toBeLessThanOrEqual(SPEEDS[1])
      expect(depth).toBeGreaterThanOrEqual(0)
      expect(depth).toBeLessThan(1)
    }
  })

  it('makes about half the crowd human', () => {
    const humans = logins.filter((l) => lookDna(l, SPEEDS).look.kind === 'human').length
    expect(humans).toBeGreaterThan(900)
    expect(humans).toBeLessThan(1100)
  })

  it('gives about three in four an accessory', () => {
    const withAccessory = logins.filter((l) => lookDna(l, SPEEDS).look.accessory !== null).length
    expect(withAccessory).toBeGreaterThan(1350)
    expect(withAccessory).toBeLessThan(1650)
  })

  // Golden values: they lock the draw order. Changing it rerolls every viewer.
  it('matches golden looks for known logins', () => {
    expect(lookDna('gooferg', SPEEDS)).toMatchInlineSnapshot()
    expect(lookDna('pixelpete', SPEEDS)).toMatchInlineSnapshot()
  })
})

describe('resolveLook', () => {
  const base = lookDna('gooferg', SPEEDS).look

  it('keeps the username look when there is no choice', () => {
    expect(resolveLook(base)).toEqual(base)
    expect(resolveLook(base, null)).toEqual(base)
  })

  it('applies a chosen kind and build, keeping skin and hair', () => {
    const cat = resolveLook(base, { kind: 'cat' })
    expect(cat).toEqual({ ...base, kind: 'cat' })
    const chubby = resolveLook(base, { kind: 'human', build: 'chubby' })
    expect(chubby).toEqual({ ...base, kind: 'human', build: 'chubby' })
  })
})
```

Append to `src/render/color.test.ts` (and add `roleTints` to its import from `./color`, plus `import { HAIR_COLORS, SKIN_TONES } from './sprites/roster'`):

```ts
describe('roleTints', () => {
  it('colors each layer role for a look', () => {
    const look = {
      kind: 'human' as const, build: 'average' as const, skin: 2, hairStyle: 'bun' as const, hairColor: 3, accessory: null,
    }
    expect(roleTints(look, { body: 0x1e90ff, accent: 0xf5c542 })).toEqual({
      chat: 0x1e90ff,
      accent: 0xf5c542,
      skin: SKIN_TONES[2],
      hair: HAIR_COLORS[3],
      fixed: 0xffffff,
    })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/avatars/look.test.ts src/render/color.test.ts`
Expected: FAIL. `./look` cannot be resolved and `roleTints` is not a function.

- [ ] **Step 3: Implement**

Create `src/avatars/look.ts`:

```ts
import { PALETTES } from '../render/sprites/contract'
import {
  ACCESSORIES,
  ANIMALS,
  BUILDS,
  HAIR_COLORS,
  HAIR_STYLES,
  SKIN_TONES,
  type Build,
  type Kind,
  type Look,
} from '../render/sprites/roster'
import { mulberry32, pickIndex, range } from '../utils/rng'
import { fnv1a32 } from './dna'

/** Share of viewers who default to a human; the rest split evenly across the animals. */
export const HUMAN_SHARE = 0.5

export interface LookDna {
  look: Look
  /** Index into PALETTES: the fallback chat color for chatters who never set one. */
  paletteIndex: number
  walkSpeed: number
  /** 0..1, how deep into the strip the avatar stands (drives y + z-order). */
  depth: number
}

/**
 * DNA v2: the default look for a login. Same login, same look, every stream.
 *
 * CONTRACT: the hash and the order of PRNG draws below are frozen; every
 * draw happens on every path so later fields never shift. Order: kind roll,
 * animal, build, skin, hairStyle, hairColor, palette, accessory presence,
 * accessory, walkSpeed, depth. The golden test in look.test.ts locks it.
 */
export function lookDna(login: string, walkSpeedRange: [number, number]): LookDna {
  const rng = mulberry32(fnv1a32(login.toLowerCase()))
  const kindRoll = rng()
  const animal = ANIMALS[pickIndex(rng, ANIMALS.length)] ?? 'cat'
  const build = BUILDS[pickIndex(rng, BUILDS.length)] ?? 'average'
  const skin = pickIndex(rng, SKIN_TONES.length)
  const hairStyle = HAIR_STYLES[pickIndex(rng, HAIR_STYLES.length)] ?? 'short'
  const hairColor = pickIndex(rng, HAIR_COLORS.length)
  const paletteIndex = pickIndex(rng, PALETTES.length)
  const hasAccessory = rng() >= 0.25
  const accessory = ACCESSORIES[pickIndex(rng, ACCESSORIES.length)] ?? 'cap'
  const walkSpeed = range(rng, walkSpeedRange[0], walkSpeedRange[1])
  const depth = rng()
  return {
    look: {
      kind: kindRoll < HUMAN_SHARE ? 'human' : animal,
      build,
      skin,
      hairStyle,
      hairColor,
      accessory: hasAccessory ? accessory : null,
    },
    paletteIndex,
    walkSpeed,
    depth,
  }
}

/** What a viewer picked in chat (phase 2 stores these). */
export interface Choice {
  kind?: Kind
  build?: Build
}

/** The username look with the viewer's choices applied on top. */
export function resolveLook(base: Look, choice?: Choice | null): Look {
  if (!choice) return base
  return {
    ...base,
    ...(choice.kind ? { kind: choice.kind } : {}),
    ...(choice.build ? { build: choice.build } : {}),
  }
}
```

In `src/render/color.ts`, add the import `import { HAIR_COLORS, SKIN_TONES, type ColorRole, type Look } from './sprites/roster'` next to the existing `PALETTES` import, and append:

```ts
/** The tint for each layer role of a look; fixed layers are painted in final colors. */
export function roleTints(
  look: Look,
  colors: { body: number; accent: number },
): Record<ColorRole, number> {
  return {
    chat: colors.body,
    accent: colors.accent,
    skin: SKIN_TONES[look.skin] ?? SKIN_TONES[0] ?? 0xffffff,
    hair: HAIR_COLORS[look.hairColor] ?? HAIR_COLORS[0] ?? 0xffffff,
    fixed: 0xffffff,
  }
}
```

- [ ] **Step 4: Record the golden looks, then verify**

Run: `npx vitest run src/avatars/look.test.ts`
Expected: PASS. Vitest writes the two inline snapshots into `look.test.ts` on this first run. If it reports them as missing instead of writing them (CI mode), re-run with `-u`. Open the file and check that the recorded looks are plausible (valid kinds, builds and so on). Then run it again:

Run: `npx vitest run src/avatars/look.test.ts src/render/color.test.ts && npx tsc -b && npx oxlint`
Expected: all PASS with the snapshots unchanged, and no type or lint errors.

- [ ] **Step 5: Commit**

```bash
git add src/avatars/look.ts src/avatars/look.test.ts src/render/color.ts src/render/color.test.ts
git commit -m "feat: DNA v2 looks from the username, look resolution and role tints"
```

---

### Task 7: Switch the overlay to the new roster

**Files:**
- Modify: `src/render/sprites/contract.ts` (48 px, id-based sheet names, remove old body/accessory constants)
- Modify: `src/render/sprites/contract.test.ts`
- Create: `src/render/sprites/paint.ts` (`partsFor`, `paintSheet`)
- Create: `src/render/sprites/paint.test.ts`
- Create: `src/render/sprites/sheetSource.ts`
- Create: `src/render/sprites/canvasTint.ts`
- Modify: `src/render/sprites/loader.ts`
- Modify: `src/avatars/avatar.ts`
- Modify: `src/avatars/manager.ts`
- Modify: `src/avatars/dna.ts` (keep only `fnv1a32`)
- Modify: `src/avatars/dna.test.ts` (keep only the `fnv1a32` test)
- Delete: `src/render/sprites/placeholder.ts`, `src/render/sprites/placeholder.test.ts`
- Rewrite: `src/app/sheetPreview.ts`
- Modify: `src/config/defaults.ts`, `src/config/resolveConfig.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1-6.
- Produces:
  - `sheetFile(id: SheetId): string`, `findSheet(built, id): string | null`
  - `partsFor(id: SheetId, pose: Pose): Part[]`, `paintSheet(id: SheetId): HTMLCanvasElement`
  - `sheetSource(id: SheetId): Promise<SheetImage>`
  - `tintedSheet(sheet: SheetImage, tint: number): SheetImage`
  - `SpriteCatalog = ReadonlyMap<SheetId, AnimationSet>`
  - `AvatarLayer = { set: AnimationSet; tint: number }`

- [ ] **Step 1: Write the failing tests**

Replace `src/render/sprites/contract.test.ts` with:

```ts
import { describe, expect, it } from 'vitest'
import {
  ANIM_NAMES,
  ANIMATIONS,
  FRAME_SIZE,
  SHEET_COLS,
  SHEET_ROWS,
  findSheet,
  isSheetSize,
  sheetFile,
} from './contract'

describe('sheetFile', () => {
  it('names a sheet after its id', () => {
    expect(sheetFile('human-chubby-shirt')).toBe('human-chubby-shirt.png')
    expect(sheetFile('cat')).toBe('cat.png')
  })
})

describe('findSheet', () => {
  const built = {
    '../../assets/sprites/cat.png': './assets/cat-a1b2.png',
    '../../assets/sprites/hair-long-back.png': './assets/hair-long-back-c3d4.png',
  }

  it('returns the built URL of a sheet that was dropped in', () => {
    expect(findSheet(built, 'cat')).toBe('./assets/cat-a1b2.png')
    expect(findSheet(built, 'hair-long-back')).toBe('./assets/hair-long-back-c3d4.png')
  })

  it('matches whole names only, so hair-long never picks up hair-long-back', () => {
    expect(findSheet(built, 'hair-long')).toBeNull()
    expect(findSheet({}, 'cat')).toBeNull()
  })
})

describe('animation rows', () => {
  it('gives every animation its own row inside the 6x6 grid', () => {
    const rows = ANIM_NAMES.map((name) => ANIMATIONS[name].row)
    expect(new Set(rows).size).toBe(rows.length)
    for (const name of ANIM_NAMES) {
      expect(ANIMATIONS[name].row).toBeLessThan(SHEET_ROWS)
      expect(ANIMATIONS[name].frames).toBeLessThanOrEqual(SHEET_COLS)
    }
  })
})

describe('isSheetSize', () => {
  it('accepts only the 6x6 grid of 48px frames', () => {
    expect(FRAME_SIZE).toBe(48)
    expect(isSheetSize(288, 288)).toBe(true)
    expect(isSheetSize(192, 192)).toBe(false) // old 32px sheets
    expect(isSheetSize(288, 192)).toBe(false)
  })
})
```

Create `src/render/sprites/paint.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { ANIM_NAMES, FRAME_SIZE } from './contract'
import { partsFor } from './paint'
import { partBounds } from './pixelKit'
import { POSES } from './poses'
import { ALL_SHEETS } from './roster'

describe('partsFor', () => {
  it('has art for every sheet in every frame, all inside the frame', () => {
    for (const id of ALL_SHEETS) {
      for (const name of ANIM_NAMES) {
        for (const pose of POSES[name]) {
          const parts = partsFor(id, pose)
          expect(parts.length).toBeGreaterThan(0)
          for (const p of parts) {
            const b = partBounds(p)
            expect(b.x0).toBeGreaterThanOrEqual(0)
            expect(b.x1).toBeLessThanOrEqual(FRAME_SIZE)
            expect(b.y0 + pose.dy).toBeGreaterThanOrEqual(0)
            expect(b.y1 + pose.dy).toBeLessThanOrEqual(FRAME_SIZE)
          }
        }
      }
    }
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/render/sprites/contract.test.ts src/render/sprites/paint.test.ts`
Expected: FAIL. `FRAME_SIZE` is still 32, `sheetFile` takes (kind, index), and `./paint` cannot be resolved.

- [ ] **Step 3: Update the contract**

In `src/render/sprites/contract.ts`:
- Replace the header comment with:

```ts
/**
 * Sprite sheet contract (v3). Every character is a stack of layer sheets
 * (see roster.ts); real art dropped into src/assets/sprites/<id>.png must
 * follow this exact layout, and the loader treats code-painted sheets and
 * PNG files identically. Documented for artists in the README.
 *
 * - 48x48 frames on a 6x6 grid (288x288 px), one animation per row.
 * - Tinted layers are grayscale + black outline: white and grays take the
 *   layer's tint, black stays black. Fixed layers are painted in final colors.
 * - Characters face RIGHT; walking left is a horizontal flip.
 * - Every layer of a character is drawn from the same pose table, so the
 *   layers line up frame by frame.
 */
```

- Set `export const FRAME_SIZE = 48`.
- Delete the `EYE_LINE` block, `BODY_COUNT`, `ACCESSORY_COUNT`, the `SheetKind` type and the old `sheetFile`/`findSheet`, and replace them with:

```ts
/** File name of a sheet in src/assets/sprites/. */
export function sheetFile(id: SheetId): string {
  return `${id}.png`
}

/**
 * Looks a sheet up in the build-time list of dropped-in PNGs (source path
 * -> built URL, as import.meta.glob returns it). Missing sheets resolve to
 * null without any request: OBS local files take seconds to report a
 * missing file, which used to delay the chat connection at startup.
 */
export function findSheet(built: Record<string, string>, id: SheetId): string | null {
  const suffix = `/${sheetFile(id)}`
  for (const [path, url] of Object.entries(built)) {
    if (path.endsWith(suffix)) return url
  }
  return null
}
```

- Add `import type { SheetId } from './roster'` at the top.

- [ ] **Step 4: Painting, sources and tinting**

Create `src/render/sprites/paint.ts`:

```ts
import { accessoryParts, hairParts, humanBodyParts, humanFaceParts } from './humanArt'
import { animalParts, collarParts } from './animalArt'
import { ANIM_NAMES, ANIMATIONS, FRAME_SIZE, SHEET_HEIGHT, SHEET_WIDTH } from './contract'
import { drawParts, type Part } from './pixelKit'
import { POSES, type Pose } from './poses'
import {
  ACCESSORIES,
  ANIMALS,
  BUILDS,
  HAIR_STYLES,
  type SheetId,
} from './roster'

const HUMAN_LAYERS = ['pants', 'shirt', 'skin'] as const

/** The parts of one frame of a sheet. Pure, so every sheet's bounds are testable. */
export function partsFor(id: SheetId, pose: Pose): Part[] {
  if (id === 'human-face') return humanFaceParts(pose)
  if (id === 'collar') return collarParts(pose)
  for (const build of BUILDS) {
    for (const layer of HUMAN_LAYERS) if (id === `human-${build}-${layer}`) return humanBodyParts(layer, build, pose)
  }
  for (const style of HAIR_STYLES) {
    if (id === `hair-${style}`) return hairParts(style, false, pose)
    if (id === `hair-${style}-back`) return hairParts(style, true, pose)
  }
  for (const name of ACCESSORIES) if (id === `accessory-${name}`) return accessoryParts(name, pose)
  for (const kind of ANIMALS) if (id === kind) return animalParts(kind, pose)
  throw new Error(`no art for sheet ${id}`)
}

/** Paints a whole sheet: every animation row, one frame per pose, each clipped to its cell. */
export function paintSheet(id: SheetId): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = SHEET_WIDTH
  canvas.height = SHEET_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2d canvas context unavailable')
  for (const anim of ANIM_NAMES) {
    const { row } = ANIMATIONS[anim]
    POSES[anim].forEach((pose, frame) => {
      ctx.save()
      ctx.translate(frame * FRAME_SIZE, row * FRAME_SIZE)
      ctx.beginPath()
      ctx.rect(0, 0, FRAME_SIZE, FRAME_SIZE)
      ctx.clip()
      ctx.translate(0, pose.dy)
      drawParts(ctx, partsFor(id, pose))
      ctx.restore()
    })
  }
  return canvas
}
```

Create `src/render/sprites/sheetSource.ts`:

```ts
import { findSheet, isSheetSize, SHEET_HEIGHT, SHEET_WIDTH } from './contract'
import { paintSheet } from './paint'
import type { SheetId } from './roster'

export type SheetImage = HTMLCanvasElement | HTMLImageElement

/** Sheets dropped into src/assets/sprites/, resolved at build time (path -> built URL). */
const BUILT_SHEETS = import.meta.glob<string>('../../assets/sprites/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
})

/**
 * The image for a layer sheet: a dropped-in PNG when one exists and has
 * the right size, otherwise the code-painted sheet. Shared by the overlay,
 * the preview page and the avatar-info strip, so they never drift apart.
 */
export async function sheetSource(id: SheetId): Promise<SheetImage> {
  const url = findSheet(BUILT_SHEETS, id)
  if (url) {
    const image = await loadImage(url)
    if (image && isSheetSize(image.naturalWidth, image.naturalHeight)) return image
    const problem = image
      ? `is ${image.naturalWidth}x${image.naturalHeight}, expected ${SHEET_WIDTH}x${SHEET_HEIGHT}`
      : 'failed to load'
    console.warn(`[chat-avatars] sprite sheet ${id}.png ${problem}; using the built-in art`)
  }
  return paintSheet(id)
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = url
  })
}
```

Create `src/render/sprites/canvasTint.ts`:

```ts
import type { SheetImage } from './sheetSource'

/**
 * A copy of a sheet multiplied by `tint`, like Pixi's sprite tint: white
 * takes the tint, black stays black, transparency is kept. Used by the
 * canvas pages (preview, avatar-info strip); 0xffffff returns the sheet.
 */
export function tintedSheet(sheet: SheetImage, tint: number): SheetImage {
  if (tint === 0xffffff) return sheet
  const out = document.createElement('canvas')
  out.width = sheet.width
  out.height = sheet.height
  const ctx = out.getContext('2d')
  if (!ctx) throw new Error('2d canvas context unavailable')
  ctx.drawImage(sheet, 0, 0)
  ctx.globalCompositeOperation = 'multiply'
  ctx.fillStyle = `#${tint.toString(16).padStart(6, '0')}`
  ctx.fillRect(0, 0, out.width, out.height)
  ctx.globalCompositeOperation = 'destination-in'
  ctx.drawImage(sheet, 0, 0)
  return out
}
```

- [ ] **Step 5: The loader builds one animation set per sheet**

Replace `src/render/sprites/loader.ts` with:

```ts
import { Rectangle, Texture } from 'pixi.js'
import { ANIM_NAMES, ANIMATIONS, FRAME_SIZE, type AnimationSpec, type AnimName } from './contract'
import { ALL_SHEETS, type SheetId } from './roster'
import { sheetSource } from './sheetSource'

export type AnimationSet = Record<AnimName, Texture[]>
export type SpriteCatalog = ReadonlyMap<SheetId, AnimationSet>

/**
 * Loads every layer sheet up front (a few dozen small sheets) so avatar
 * creation is synchronous afterwards. Textures are shared by every
 * avatar that uses a sheet.
 */
export async function loadSpriteCatalog(): Promise<SpriteCatalog> {
  const entries = await Promise.all(
    ALL_SHEETS.map(async (id) => [id, sliceSheet(Texture.from(await sheetSource(id)))] as const),
  )
  return new Map(entries)
}

function sliceSheet(base: Texture): AnimationSet {
  const slice = (spec: AnimationSpec): Texture[] =>
    Array.from(
      { length: spec.frames },
      (_, col) =>
        new Texture({
          source: base.source,
          frame: new Rectangle(col * FRAME_SIZE, spec.row * FRAME_SIZE, FRAME_SIZE, FRAME_SIZE),
        }),
    )
  return Object.fromEntries(
    ANIM_NAMES.map((name) => [name, slice(ANIMATIONS[name])]),
  ) as AnimationSet
}
```

- [ ] **Step 6: Avatars render a stack of tinted layers**

In `src/avatars/avatar.ts`:
- Replace the `HEAD_CLEARANCE` constant and its comment with:

```ts
/** 48px frames put heads around y=6 (ears and buns up to y=3); the bubble tail sits just above. */
const HEAD_CLEARANCE = 44
```

- In `createGroundShadow`, replace the three `.rect(...)` lines with:

```ts
    .rect(-7, -3, 14, 1)
    .rect(-10, -2, 20, 1)
    .rect(-7, -1, 14, 1)
```

- Above `interface AnimGroup` add:

```ts
/** One layer sheet of a character with the tint for its color role. */
export interface AvatarLayer {
  set: AnimationSet
  tint: number
}
```

- In `AvatarDisplayOptions`, replace the `bodyTint`, `accentTint`, `body` and `accessory` fields (with their comments) with:

```ts
  /** Name tag color: the chatter's color, see characterColors. */
  labelTint: number
  /** The character's layer stack, back to front (see layersFor). */
  layers: readonly AvatarLayer[]
```

- Replace `this.label = createNameLabel(options.labelText, options.bodyTint)` with `this.label = createNameLabel(options.labelText, options.labelTint)`.
- In `buildGroup`, replace:

```ts
    makeLayer(options.body, options.bodyTint)
    if (options.accessory) makeLayer(options.accessory, options.accentTint)
```

with:

```ts
    for (const layer of options.layers) makeLayer(layer.set, layer.tint)
```

In `src/avatars/manager.ts`:
- Replace the imports of `generateDna` and `PALETTES` so the imports include:

```ts
import { characterColors, roleTints } from '../render/color'
import { PALETTES } from '../render/sprites/contract'
import { layersFor } from '../render/sprites/roster'
import { lookDna, resolveLook } from './look'
```

  Remove the old `import { characterColors } from '../render/color'` and `import { generateDna } from './dna'` lines.
- In `spawn`, replace the `generateDna(...)` call (4 lines) with:

```ts
    const dna = lookDna(event.login, cfg.walkSpeedRange)
```

- Replace everything from `const body = catalog.bodies[dna.bodyIndex]` through the `const colors = characterColors(event.color, dna.bodyTint)` line with:

```ts
    // viewers' own picks arrive in phase 2 (resolveLook's choice argument)
    const look = resolveLook(dna.look)
    const fallbackBody = PALETTES[dna.paletteIndex]?.body ?? 0xffffff
    const colors = characterColors(event.color, fallbackBody)
    const tints = roleTints(look, colors)
    const layers = layersFor(look).map((ref) => {
      const set = catalog.get(ref.sheet)
      if (!set) throw new Error(`missing sprite sheet ${ref.sheet}`)
      return { set, tint: tints[ref.role] }
    })
```

- In the `new Avatar({...})` options, replace the lines `bodyTint: colors.body,`, `accentTint: colors.accent,`, `body,` and `accessory,` with:

```ts
        labelTint: colors.body,
        layers,
```

In `src/avatars/dna.ts`, delete everything except the `fnv1a32` function, and keep its doc comment. In `src/avatars/dna.test.ts`, delete everything except the `fnv1a32` golden test, and change the import to `import { fnv1a32 } from './dna'`.

Delete the old painter:

```bash
git rm src/render/sprites/placeholder.ts src/render/sprites/placeholder.test.ts
```

- [ ] **Step 7: Default scale and the preview page**

In `src/config/defaults.ts`, change `spriteScale: 3,` to `spriteScale: 2,`. In `src/config/resolveConfig.test.ts`, change `expect(resolveConfig(params('scale=-2'), {}).spriteScale).toBe(3)` to `.toBe(2)`.

Replace `src/app/sheetPreview.ts` with:

```ts
import { characterColors, roleTints } from '../render/color'
import { tintedSheet } from '../render/sprites/canvasTint'
import { ANIM_NAMES, ANIMATIONS, FRAME_SIZE, type AnimName } from '../render/sprites/contract'
import { ANIMALS, layersFor, type Look } from '../render/sprites/roster'
import { sheetSource, type SheetImage } from '../render/sprites/sheetSource'

/**
 * Dev-only art review page: `npm run dev`, then open /sheet-preview.html.
 * Every kind plays every row, assembled and tinted exactly like on stream.
 * Not part of the OBS build.
 */
const SCALE = 3
const SAMPLE_CHAT = ['#1E90FF', '#FF4500', '#9ACD32', '#FF69B4', '#FFD700', '#8A2BE2', '#00CED1']

const HUMANS: Look[] = [
  { kind: 'human', build: 'skinny', skin: 0, hairStyle: 'short', hairColor: 1, accessory: 'cap' },
  { kind: 'human', build: 'average', skin: 2, hairStyle: 'long', hairColor: 0, accessory: 'glasses' },
  { kind: 'human', build: 'chubby', skin: 3, hairStyle: 'bun', hairColor: 0, accessory: 'bow' },
  { kind: 'human', build: 'average', skin: 1, hairStyle: 'spiky', hairColor: 3, accessory: null },
]
const BASE: Look = { kind: 'human', build: 'average', skin: 0, hairStyle: 'short', hairColor: 0, accessory: null }
const LOOKS: Look[] = [...HUMANS, ...ANIMALS.map((kind): Look => ({ ...BASE, kind }))]

interface Cell {
  ctx: CanvasRenderingContext2D
  layers: SheetImage[]
  anim: AnimName
}

function describe(look: Look): string {
  if (look.kind !== 'human') return look.kind
  return `${look.build} · ${look.hairStyle} hair · ${look.accessory ?? 'no accessory'}`
}

async function main(): Promise<void> {
  const root = document.getElementById('sheets')
  if (!root) throw new Error('missing #sheets')
  const cells: Cell[] = []
  for (const [i, look] of LOOKS.entries()) {
    const tints = roleTints(look, characterColors(SAMPLE_CHAT[i % SAMPLE_CHAT.length] ?? null, 0xffffff))
    const layers = await Promise.all(
      layersFor(look).map(async (ref) => tintedSheet(await sheetSource(ref.sheet), tints[ref.role])),
    )
    const title = document.createElement('h2')
    title.textContent = describe(look)
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
    root.append(title, row)
  }

  const frame = (now: number): void => {
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
}

void main()
```

In `sheet-preview.html`, add `h2 { font-size: 13px; margin: 14px 0 4px; }` to the `<style>` block.

- [ ] **Step 8: Run everything**

Run: `npm test && npx tsc -b && npx oxlint && npm run build`
Expected: all tests PASS: the new contract, paint, roster, pixelKit, poses, humanArt, animalArt and look tests, plus every existing suite. The typecheck and lint are clean and the build succeeds. `grep -rn "placeholder\|EYE_LINE\|BODY_COUNT\|generateDna" src` should find nothing.

- [ ] **Step 9: Check the overlay on screen**

Serve the production build over HTTP from the parent folder, as the earlier checks did (`python -m http.server 4180 --directory ..`), and open `/chat-avatars/dist/index.html?debug=1` at 1920x1080. In the console, spawn a mix of looks and step the simulation. The hidden browser pane pauses animation frames, so call `app.render()` after stepping:

```js
const { manager, app } = window.__chatAvatars
let now = performance.now()
for (const l of ['gooferg', 'pixelpete', 'slime_time', 'retro_rita', 'bitcrusher', 'lurkmaster', 'noodle_arms', 'save_state'])
  manager.handleMessage({ login: l, displayName: l, color: '#FFD700', text: 'hi', emotes: [], messageId: null, timestamp: Date.now(), tags: {} }, now)
for (let i = 0; i < 1500; i++) { now += 1000 / 30; manager.update(1 / 30, now) }
app.render()
```

Screenshot the bottom strip. Check that there's a mix of humans and animals, that characters are the same height as before (about 96 px), that layers line up (hair on heads, collars on necks), and that name tags and bubbles sit correctly.

- [ ] **Step 10: Commit**

```bash
git add -A src sheet-preview.html
git commit -m "feat: overlay renders the new layered human and animal roster"
```

---

### Task 8: Art format docs and the art sign-off

**Files:**
- Modify: `README.md` (sprite sheet contract and "How avatars are generated")

- [ ] **Step 1: Rewrite the README art sections**

Replace the whole `## Sprite sheet contract` section with:

````md
## Sprite sheet contract

Characters are drawn in code, but real art (hand-drawn or AI-assisted) can be dropped in **without code changes**. Every character is a stack of **layer sheets**, and each sheet can be replaced by a PNG in `src/assets/sprites/` named `<sheet id>.png`, followed by a rebuild. The build records which PNGs exist, so the overlay never requests missing files at runtime. A PNG of the wrong size is ignored with a warning, and the built-in art is used for that layer.

Each sheet is a **288 x 288 px** PNG: a 6 x 6 grid of **48 x 48** frames, one animation per row, left to right:

| Row | Animation | Frames | FPS |
| --- | --- | --- | --- |
| 0 | idle | 4 | 4 |
| 1 | walk | 6 | 10 |
| 2 | jump | 6 | 10 |
| 3 | talk | 4 | 6 |
| 4 | cheer | 4 | 6 |
| 5 | sad | 4 | 2 |

Each layer has a **color role**:

| Role | Colored with | Sheets |
| --- | --- | --- |
| chat | the chatter's Twitch color | `human-<build>-shirt`, `collar` |
| skin | one of 4 skin tones | `human-<build>-skin` |
| hair | one of 4 hair colors | `hair-short`, `hair-long`, `hair-long-back`, `hair-bun`, `hair-spiky` |
| accent | a color that contrasts with the chat color | `accessory-cap`, `accessory-bow`, `accessory-glasses` |
| fixed | nothing (drawn in final colors) | `human-<build>-pants`, `human-face`, `cat`, `dog`, `duck`, `frog`, `bunny`, `bear`, `fox` |

Builds are `skinny`, `average` and `chubby`.

- **Tinted layers** (chat, skin, hair, accent) are drawn in **grayscale with black outlines**: white takes the color, grays shade it, black stays black.
- **Fixed layers** are drawn in their final colors, and transparency is allowed (the face's blush is translucent pink).
- **Stacks**, back to front:
  - human: `hair-<style>-back` (long hair only), pants, shirt, skin, face, hair, accessory
  - animal: the animal, then the collar
- **Human heads** sit in the same place for every build, so hair, face and accessory sheets fit all three. **Animals** share one body template, so a single collar fits every animal.
- Characters face **right**. Walking left is a horizontal flip.
- The art format lives in `src/render/sprites/contract.ts`, the roster (kinds, palettes, layer stacks) in `src/render/sprites/roster.ts`, and the code-drawn art in `humanArt.ts` and `animalArt.ts`.
- Preview everything with `npm run dev`, then open `/sheet-preview.html`.
````

Replace the `## How avatars are generated` section's paragraph with:

```md
The lowercase login is hashed (FNV-1a 32) into a small seeded PRNG that picks, in a fixed order:

- kind: about half humans, the rest split evenly across cat, dog, duck, frog, bunny, bear and fox
- build, skin tone, hairstyle and hair color
- a fallback color, accessory, walk speed and standing depth

Same login, same look, every stream. The hash and draw order are locked by golden values in `src/avatars/dna.test.ts` and `src/avatars/look.test.ts`; changing either rerolls every viewer's look.

Colors come from chat: human shirts and animal collars (and the name tag) wear the chatter's Twitch name color, lightened if it's too dark to see on stream. Accessories take whichever palette accent contrasts most with it. Viewers who never set a Twitch color get the fallback color their login hashes to.
```

In the URL parameters table, change the `scale` row to `| \`scale\` | \`2\` | Integer sprite scale (48px frames, so 2 = 96px tall) |`.

- [ ] **Step 2: Art sign-off with the streamer (blocking)**

Run `npm run dev` and open `http://localhost:5173/sheet-preview.html`. Take screenshots showing every row (the four human variants, then the seven animals) and show them to the streamer. **Wait for their sign-off.** Apply any requested art changes in `humanArt.ts`, `animalArt.ts`, `faces.ts` or `poses.ts`, and re-run `npm test && npx tsc -b && npx oxlint` after each change.

- [ ] **Step 3: Rebuild and commit**

```bash
npm test && npx tsc -b && npx oxlint && npm run build
git add README.md src
git commit -m "docs: layered sprite contract for the new roster"
```
````

