# Interactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chatters high-five, hug and fight each other's characters (`!highfive`, `!hug`, `!fight` + `!accept`), play solo emotes (`!clap`, `!wave`, `!dance`, `!smoke`, `!smoke bong`), the streamer lights everyone up with `!sesh`, and viewers can opt out with `!nointeract`.

**Architecture:** Eight new animation rows (sheet format v6) and a prop layer drawn by the existing pose-driven pixel art; two new states in the pure `AvatarStateMachine` (`emote`, and `scripted` for interactions); a new pure `src/interactions/` module (target parsing, rules and cooldowns, fight challenges, per-interaction timelines, opt-out and fight-record storage, and a director that drives two state machines from a timeline); a code-drawn effect layer (sparks, hearts, the dust cloud, smoke); the manager and bootstrap wire them to chat commands.

**Tech Stack:** TypeScript (strict, `noUncheckedIndexedAccess`, `erasableSyntaxOnly`), PixiJS v8, Vitest (node environment), Vite.

**Spec:** `docs/superpowers/specs/2026-10-08-interactions-design.md`

## Global Constraints

- Settings: `interactionCooldownMs` 15000 (URL `interactionCooldownSec`, 0 to 600), `targetCooldownMs` 30000 (URL `targetCooldownSec`, 0 to 600), `challengeTimeoutMs` 30000 (URL `challengeSec`, 5 to 300), `smokeEnabled` true (URL `smoke=0` / `smoke=1`). A bad override falls back to the default.
- Sheet format v6: 288 x 720 px, 6 columns x 15 rows of 48 px frames. Rows 0 to 6 unchanged. Row 7 `highfive` 4 frames 6 fps (plays once), 8 `hug` 4/4, 9 `clap` 4/8, 10 `wave` 4/6, 11 `dance` 6/6, 12 `dizzy` 4/4, 13 `smoke` 6/1.5 (plays once), 14 `bong` 6/1.5 (plays once).
- Meeting: gap between the two centers in frame px times `spriteScale`: high-five 28, hug 16, fight 12. Both run at 180 stage px/s (walk row at double speed). Spots stay at least 40 px (`WALL_MARGIN`) from the stage edges. After 8 s the interaction starts wherever they are.
- Timings: high-five 1.2 s (spark at 1/3 s) then cheer 0.8 s; hug 2.5 s with hearts at 0.3, 0.9, 1.5 s; fight brawl 3 s with a poke every 0.25 s, then result 3 s; clap 2 s, wave 2 s, dance 3 s turning every 0.5 s, smoke and bong 4 s with the exhale from 2.7 s; `!sesh` ripple 0 to 1.2 s.
- Bubble texts, verbatim: `you opted out (!interact)`, `who? try !<command> @name`, `<name> isn't here`, `<name> is lurking`, `<name> opted out`, `<name> is busy`, `<name> wants to fight! !accept`, `<name> wins! (<wins>-<losses>)`, `interactions off`, `interactions on`. Cooldowns, self-targeting and a sender already in an interaction are silent.
- Storage keys `chat-avatars:nointeract:v1` and `chat-avatars:fights:v1`, at most 2000 viewers each (`MAX_REMEMBERED`), least recently changed forgotten first.
- At most 64 live effect sprites.
- Tested modules stay free of Pixi (Vitest runs in node). No constructor parameter properties (`erasableSyntaxOnly`). Index access is `T | undefined` (`noUncheckedIndexedAccess`).
- Commits: Conventional Commits (`feat:`, `test:`, `docs:`, `chore:`). Never add `Co-Authored-By` or any Claude trailer; never add Claude attribution to PRs.

## Review Focus

- Two viewers type `!highfive` at each other at the same moment: one high-five plays, not two overlapping ones; the second command does nothing (its sender is already busy). Test in Task 11.
- The target is pushed off the stage (the avatar cap) while the sender is still running to them: the sender stops and goes back to normal, nobody stays stuck in scripted mode, and no fight is recorded. Test in Task 11.
- `!hug @` and `!hug @@bob`: a lone `@` asks who; any number of leading `@`s is stripped. Test in Task 8.
- A participant types `!avatar fox` mid-hug: the look swaps without the hop (a hop is a jump, and jumps are ignored while scripted), and the hug carries on. Test in Task 6 (`choiceAction('scripted')`).
- `smokeEnabled` off: `!smoke`, `!smoke bong` and `!sesh` do nothing, and don't walk the sender's character in. Test in Task 12.

## Where this plan refines the spec

- The dust cloud is 80 x 48 frame px (the spec said about 100 x 50): it hides both fighters at the fight gap without covering their neighbors.
- The dizzy face has X eyes: a spiral doesn't fit in a 3 px eye.
- "Plays once" is a property of the animation row (`once` in `ANIMATIONS`), not a `play()` option. The scripted `play(anim)` shows a row until the next step; the timeline owns every duration.
- The first `smoke` frame holds the joint at the hand rather than raising it: the prop must be in hand on every frame.
- `isPrivileged` stays in `src/info/infoState.ts`: bootstrap already imports it from there, so moving it is churn.
- The director and timelines run only for interactions in progress (nothing per character per frame); their small per-tick output objects are allocated, not pooled.
- `!sesh` and the emotes live in the manager, so their tests (lurkers skipped, a lurker standing up to emote) are in `manager.test.ts` rather than `director.test.ts`.

## Before you start

Work in the existing worktree `../chat-avatars-interactions` (branch `feat/interactions`, from `main`; the spec is already committed there). Copy this plan into the worktree at the same path if it isn't there, and commit it:

```bash
git add docs/superpowers/plans/2026-10-08-interactions.md
git commit -m "docs: interactions implementation plan"
```

`main`'s `package-lock.json` is missing two entries, so `npm ci` fails. Run `npm install` (it adds `@emnapi/core` and `@emnapi/wasi-threads`), then commit the lock file on its own:

```bash
npm install
git add package-lock.json
git commit -m "chore: sync package-lock with package.json"
```

Baseline: `npm test` must pass (284 tests) before Task 1.

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `src/config/types.ts`, `defaults.ts`, `resolveConfig.ts` (+ test) | modify | The four new settings |
| `src/render/sprites/contract.ts` (+ test) | modify | Sheet format v6 rows, `once`, `playsOnce` |
| `src/render/sprites/poses.ts` (+ test) | modify | New arm poses, faces, `dx`, `prop`, the eight new rows |
| `src/render/sprites/faces.ts` | modify | Dizzy and chill faces |
| `src/render/sprites/pixelKit.ts` (+ test) | modify | `onTop` parts, `partCenter` |
| `src/render/sprites/humanArt.ts` (+ test) | modify | New arm shapes, arms over the torso, hand and mouth spots |
| `src/render/sprites/animalArt.ts` (+ test) | modify | New paw shapes, paws over the body, paw and mouth spots |
| `src/render/sprites/propArt.ts` (+ test) | create | The joint and the bong |
| `src/render/sprites/roster.ts` (+ test) | modify | Prop sheets and the prop layer |
| `src/render/sprites/paint.ts` (+ test) | modify | `dx`, prop sheets |
| `src/render/effects/effectArt.ts` (+ test) | create | Code-drawn effect frames |
| `src/render/effects/effectMotion.ts` (+ test) | create | Where a cued effect is at a given age |
| `src/render/effects/effectLayer.ts` | create | Pixi: pooled effect sprites |
| `src/render/stage.ts` | modify | The effect layer |
| `src/avatars/stateMachine.ts` (+ test) | modify | `emote` and `scripted` states |
| `src/avatars/chooser.ts` (+ test) | modify | No hop while emoting or scripted |
| `src/avatars/avatar.ts` | modify | Play-once rows, hidden, run speed, returns the snapshot, exposes names and ground line |
| `src/interactions/emotes.ts` (+ test) | create | Emote table, `!smoke bong`, exhale cues |
| `src/interactions/interactionStore.ts` (+ test) | create | Opt-outs and fight records |
| `src/interactions/target.ts` (+ test) | create | `@name` parsing and matching |
| `src/interactions/gate.ts` (+ test) | create | Pair-command rules, cooldowns, refusal bubbles |
| `src/interactions/challenges.ts` (+ test) | create | Pending fight challenges |
| `src/interactions/timeline.ts` (+ test) | create | Meeting spots and the high-five, hug and fight timelines |
| `src/interactions/director.ts` (+ test) | create | Runs pair commands, drives the state machines |
| `src/avatars/manager.ts` (+ test) | modify | Emotes, `!sesh`, the director, exhale effects |
| `src/app/bootstrap.ts` | modify | Commands, store, effect layer |
| `src/app/fakeChat.ts` | modify | `debug=grid` sends the new commands |
| `README.md` | modify | Settings, commands, sheet format v6, prop layer |

---

### Task 1: Interaction settings

**Files:**
- Modify: `src/config/types.ts`, `src/config/defaults.ts`, `src/config/resolveConfig.ts`, `README.md`
- Test: `src/config/resolveConfig.test.ts`

**Interfaces:**
- Produces: `AppConfig.interactionCooldownMs: number`, `AppConfig.targetCooldownMs: number`, `AppConfig.challengeTimeoutMs: number` (all ms) and `AppConfig.smokeEnabled: boolean`, used by the manager in Task 12.

- [ ] **Step 1: Write the failing tests**

Add inside the `describe('resolveConfig', ...)` block in `src/config/resolveConfig.test.ts`:

```ts
  it('resolves the interaction settings, turning seconds into ms', () => {
    const cfg = resolveConfig(params('interactionCooldownSec=5&targetCooldownSec=60&challengeSec=45&smoke=0'), {})
    expect(cfg.interactionCooldownMs).toBe(5_000)
    expect(cfg.targetCooldownMs).toBe(60_000)
    expect(cfg.challengeTimeoutMs).toBe(45_000)
    expect(cfg.smokeEnabled).toBe(false)
  })

  it('defaults to 15 s per sender, 30 s per target, 30 s challenges and smoke on', () => {
    const cfg = resolveConfig(params(''), {})
    expect(cfg.interactionCooldownMs).toBe(15_000)
    expect(cfg.targetCooldownMs).toBe(30_000)
    expect(cfg.challengeTimeoutMs).toBe(30_000)
    expect(cfg.smokeEnabled).toBe(true)
  })

  it('accepts 0 cooldowns, which turn them off, and smoke=1 over an override', () => {
    const cfg = resolveConfig(params('interactionCooldownSec=0&targetCooldownSec=0&smoke=1'), { smokeEnabled: false })
    expect(cfg.interactionCooldownMs).toBe(0)
    expect(cfg.targetCooldownMs).toBe(0)
    expect(cfg.smokeEnabled).toBe(true)
  })

  it('rejects out-of-range interaction params and bad overrides', () => {
    expect(resolveConfig(params('challengeSec=2'), {}).challengeTimeoutMs).toBe(30_000)
    expect(resolveConfig(params('interactionCooldownSec=601'), {}).interactionCooldownMs).toBe(15_000)
    expect(resolveConfig(params('smoke=yes'), {}).smokeEnabled).toBe(true)
    expect(resolveConfig(params(''), { targetCooldownMs: -1 }).targetCooldownMs).toBe(30_000)
    expect(resolveConfig(params(''), { smokeEnabled: 'no' as unknown as boolean }).smokeEnabled).toBe(true)
  })
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/config/resolveConfig.test.ts`
Expected: FAIL, the new properties are `undefined`.

- [ ] **Step 3: Add the settings**

In `src/config/types.ts`, add before `debug: DebugMode`:

```ts
  /** How often one viewer can start a high-five or hug, or send a fight challenge. */
  interactionCooldownMs: number
  /** After a high-five, hug or fight, how long nobody can target either participant. */
  targetCooldownMs: number
  /** How long a `!fight` challenge waits for `!accept`. */
  challengeTimeoutMs: number
  /** `!smoke` and `!sesh`; false ignores both. */
  smokeEnabled: boolean
```

In `src/config/defaults.ts`, add before `debug: ''`:

```ts
  interactionCooldownMs: 15_000,
  targetCooldownMs: 30_000,
  challengeTimeoutMs: 30_000,
  smokeEnabled: true,
```

In `src/config/resolveConfig.ts`, add after the `cfg.maxLurkers = ...` line:

```ts
  // a bad override is treated like a bad param: fall back to the default
  const interactionOverride = validOr(cfg.interactionCooldownMs, 0, 600_000, DEFAULT_CONFIG.interactionCooldownMs)
  cfg.interactionCooldownMs = intParam(params, 'interactionCooldownSec', interactionOverride / 1000, 0, 600) * 1000
  const targetOverride = validOr(cfg.targetCooldownMs, 0, 600_000, DEFAULT_CONFIG.targetCooldownMs)
  cfg.targetCooldownMs = intParam(params, 'targetCooldownSec', targetOverride / 1000, 0, 600) * 1000
  const challengeOverride = validOr(cfg.challengeTimeoutMs, 5_000, 300_000, DEFAULT_CONFIG.challengeTimeoutMs)
  cfg.challengeTimeoutMs = intParam(params, 'challengeSec', challengeOverride / 1000, 5, 300) * 1000
  if (typeof cfg.smokeEnabled !== 'boolean') cfg.smokeEnabled = DEFAULT_CONFIG.smokeEnabled
  const smoke = params.get('smoke')
  if (smoke === '0') cfg.smokeEnabled = false
  else if (smoke === '1') cfg.smokeEnabled = true
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/config/resolveConfig.test.ts`
Expected: PASS (including the existing `returns defaults with empty params and overrides`).

- [ ] **Step 5: Document the URL params**

In `README.md`, in the URL parameters table, add after the `crowdCooldownSec` row:

```md
| `interactionCooldownSec` | `15` | How often one viewer can start a high-five or hug, or send a fight challenge. `0` turns it off |
| `targetCooldownSec` | `30` | After a high-five, hug or fight, how long nobody can target either participant. `0` turns it off |
| `challengeSec` | `30` | How long a `!fight` challenge waits for `!accept` (5 to 300) |
| `smoke` | `1` | `smoke=0` turns `!smoke` and `!sesh` off |
```

- [ ] **Step 6: Commit**

```bash
git add src/config README.md
git commit -m "feat: settings for interaction cooldowns, challenges and smoke"
```

---

### Task 2: Sheet format v6: the eight new rows

**Files:**
- Modify: `src/render/sprites/contract.ts`, `src/render/sprites/poses.ts`, `src/render/sprites/pixelKit.ts`, `src/render/sprites/faces.ts`, `src/render/sprites/humanArt.ts`, `src/render/sprites/animalArt.ts`, `src/render/sprites/paint.ts`, `src/avatars/avatar.ts`, `README.md`
- Test: `src/render/sprites/contract.test.ts`, `src/render/sprites/poses.test.ts`, `src/render/sprites/pixelKit.test.ts`, `src/render/sprites/humanArt.test.ts`, `src/render/sprites/animalArt.test.ts`, `src/render/sprites/paint.test.ts`

**Interfaces:**
- Produces:
  - `AnimName` gains `'highfive' | 'hug' | 'clap' | 'wave' | 'dance' | 'dizzy' | 'smoke' | 'bong'`; `AnimationSpec.once?: boolean`; `playsOnce(anim: AnimName): boolean`; `SHEET_ROWS = 15`.
  - `Arms` gains `'reachUp' | 'hug' | 'clap' | 'clapOpen' | 'waveA' | 'waveB' | 'toMouth' | 'holdFront'`; `Face` gains `'dizzy' | 'chill'`; `type Prop = 'joint' | 'jointLit' | 'bong' | 'bongBubbles'`; `Pose.dx: number`; `Pose.prop: Prop | null`. Task 3 draws `prop`.

- [ ] **Step 1: Write the failing contract and pose tests**

In `src/render/sprites/contract.test.ts`, add `playsOnce` to the import list, replace the whole `describe('isSheetSize', ...)` block with:

```ts
describe('isSheetSize', () => {
  it('accepts only the 6 x 15 grid of 48px frames (format v6)', () => {
    expect(FRAME_SIZE).toBe(48)
    expect(isSheetSize(288, 720)).toBe(true)
    expect(isSheetSize(288, 336)).toBe(false) // v5 sheets have no interaction rows
    expect(isSheetSize(288, 288)).toBe(false)
  })
})
```

and add inside `describe('animation rows', ...)`:

```ts
  it('adds the interaction and emote rows 7 to 14 (format v6)', () => {
    expect(ANIMATIONS.highfive).toEqual({ row: 7, frames: 4, fps: 6, once: true })
    expect(ANIMATIONS.hug).toEqual({ row: 8, frames: 4, fps: 4 })
    expect(ANIMATIONS.clap).toEqual({ row: 9, frames: 4, fps: 8 })
    expect(ANIMATIONS.wave).toEqual({ row: 10, frames: 4, fps: 6 })
    expect(ANIMATIONS.dance).toEqual({ row: 11, frames: 6, fps: 6 })
    expect(ANIMATIONS.dizzy).toEqual({ row: 12, frames: 4, fps: 4 })
    expect(ANIMATIONS.smoke).toEqual({ row: 13, frames: 6, fps: 1.5, once: true })
    expect(ANIMATIONS.bong).toEqual({ row: 14, frames: 6, fps: 1.5, once: true })
  })

  it('plays the high-five, smoke and bong rows once; every other row loops', () => {
    expect(ANIM_NAMES.filter(playsOnce)).toEqual(['highfive', 'smoke', 'bong'])
  })
```

In `src/render/sprites/poses.test.ts`, add inside `describe('POSES', ...)`:

```ts
  it('raises the front arm for the high-five, slapping on frame 3', () => {
    expect(POSES.highfive.map((p) => p.arms)).toEqual(['down', 'reachUp', 'reachUp', 'reachUp'])
    expect(POSES.highfive[2]?.dy).toBe(Math.min(...POSES.highfive.map((p) => p.dy)))
  })

  it('sways sideways only while dizzy', () => {
    expect(POSES.dizzy.map((p) => p.dx)).toEqual([-1, 0, 1, 0])
    expect(POSES.dizzy.every((p) => p.face === 'dizzy' && p.arms === 'limp')).toBe(true)
    for (const name of ANIM_NAMES) {
      if (name !== 'dizzy') expect(POSES[name].every((p) => p.dx === 0), name).toBe(true)
    }
  })

  it('holds a prop on every smoke and bong frame, and nowhere else', () => {
    for (const name of ANIM_NAMES) {
      const smoking = name === 'smoke' || name === 'bong'
      expect(POSES[name].every((p) => (p.prop !== null) === smoking), name).toBe(true)
    }
  })

  it('lights the joint at the mouth, and relaxes for the exhale on the last two frames', () => {
    expect(POSES.smoke.map((p) => p.prop)).toEqual(['joint', 'joint', 'jointLit', 'joint', 'joint', 'joint'])
    expect(POSES.smoke.map((p) => p.arms)).toEqual(['down', 'toMouth', 'toMouth', 'down', 'down', 'down'])
    expect(POSES.bong.every((p) => p.arms === 'holdFront')).toBe(true)
    for (const i of [4, 5]) {
      expect(POSES.smoke[i]?.face).toBe('chill')
      expect(POSES.bong[i]?.face).toBe('chill')
    }
  })

  it('claps with the hands together on every other frame', () => {
    expect(POSES.clap.map((p) => p.arms)).toEqual(['clapOpen', 'clap', 'clapOpen', 'clap'])
    expect(POSES.wave.map((p) => p.arms)).toEqual(['waveA', 'waveB', 'waveA', 'waveB'])
  })
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/render/sprites/contract.test.ts src/render/sprites/poses.test.ts`
Expected: FAIL (TypeScript errors on `ANIMATIONS.highfive`, `playsOnce`, `p.dx`, `p.prop`).

- [ ] **Step 3: Add the rows to the contract**

In `src/render/sprites/contract.ts`:

Replace the header comment's first lines and add a v6 bullet so it reads:

```ts
/**
 * Sprite sheet contract (v6). Every character is a stack of layer sheets
 * (see roster.ts); real art dropped into src/assets/sprites/<id>.png must
 * follow this exact layout, and the loader treats code-painted sheets and
 * PNG files identically. Documented for artists in the README.
 *
 * - 48x48 frames on a grid of 6 columns and 15 rows (288x720 px), one animation per row.
 * - Tinted layers are grayscale + black outline: white and grays take the
 *   layer's tint, black stays black. Fixed layers are painted in final colors.
 * - Characters face RIGHT; walking left is a horizontal flip.
 * - Every layer of a character is drawn from the same pose table, so the
 *   layers line up frame by frame.
 * - v6: eight more rows (7 to 14) for interactions and emotes. A v5 PNG
 *   (288x336) is rejected like any wrong-size sheet.
 * - v5: a seventh row, `sit`.
 * - v4: each animal is two sheets, `<animal>` (fur, tinted) and
 *   `<animal>-details` (fixed). A v3 animal PNG was one full-color sheet.
 */
```

Change `export const SHEET_ROWS = 7` to `export const SHEET_ROWS = 15`.

Replace `AnimationSpec` and `ANIMATIONS` with:

```ts
export interface AnimationSpec {
  row: number
  frames: number
  fps: number
  /** Plays through once and holds its last frame (in the overlay; the preview pages loop every row). */
  once?: boolean
}

export const ANIMATIONS = {
  idle: { row: 0, frames: 4, fps: 4 },
  walk: { row: 1, frames: 6, fps: 10 },
  jump: { row: 2, frames: 6, fps: 10 },
  talk: { row: 3, frames: 4, fps: 6 },
  cheer: { row: 4, frames: 4, fps: 6 },
  sad: { row: 5, frames: 4, fps: 2 },
  sit: { row: 6, frames: 4, fps: 2 },
  highfive: { row: 7, frames: 4, fps: 6, once: true },
  hug: { row: 8, frames: 4, fps: 4 },
  clap: { row: 9, frames: 4, fps: 8 },
  wave: { row: 10, frames: 4, fps: 6 },
  dance: { row: 11, frames: 6, fps: 6 },
  dizzy: { row: 12, frames: 4, fps: 4 },
  smoke: { row: 13, frames: 6, fps: 1.5, once: true },
  bong: { row: 14, frames: 6, fps: 1.5, once: true },
} as const satisfies Record<string, AnimationSpec>
```

and add after `ANIM_NAMES`:

```ts
/** Whether a row plays once and holds its last frame instead of looping. */
export function playsOnce(anim: AnimName): boolean {
  const spec: AnimationSpec = ANIMATIONS[anim]
  return spec.once === true
}
```

- [ ] **Step 4: Add the poses**

Replace the top of `src/render/sprites/poses.ts` (the `Arms` and `Face` types, `Pose` and `pose()`) with:

```ts
import type { AnimName } from './contract'

/**
 * Arm pose for the whole character; each art module maps it to a shape per
 * side. "Front" is the facing side (the right of the frame).
 */
export type Arms =
  | 'down'
  | 'swingA'
  | 'swingB'
  | 'mid'
  | 'up'
  | 'limp'
  /** Front arm raised up and forward (the high-five); the other down. */
  | 'reachUp'
  /** Front arm out in front, the other across the chest. */
  | 'hug'
  /** Both hands together in front of the chest, or a little apart. */
  | 'clap'
  | 'clapOpen'
  /** Front arm up, tilted out or in; the other down. */
  | 'waveA'
  | 'waveB'
  /** Front hand at the mouth; the other down. */
  | 'toMouth'
  /** Both hands in front of the belly, holding something. */
  | 'holdFront'
export type Face = 'normal' | 'talk' | 'happy' | 'grin' | 'sad' | 'dizzy' | 'chill'
/** What the prop layer draws: a joint (its ember glowing on the inhale) or a bong (bubbling while in use). */
export type Prop = 'joint' | 'jointLit' | 'bong' | 'bongBubbles'

export interface Pose {
  /** Whole-character vertical offset in frame px (negative = up). Never below 0: feet stay on the ground. */
  dy: number
  /** Upper body (head, torso, arms) sinks by this many px: crouch or slump. Legs stay put. */
  squash: number
  /** 0 = feet together, 1 = left foot lifted, 2 = right foot lifted. */
  leg: number
  arms: Arms
  face: Face
  /**
   * Sitting on the ground, legs out in front. Each art module lowers the
   * upper body by its own seat drop on top of `squash` (a human's hips sit
   * higher than an animal's round body).
   */
  seated: boolean
  /** Whole-character sideways offset in frame px: the dizzy sway. */
  dx: number
  /** What the front hand holds, drawn by the prop layer; null for nothing. */
  prop: Prop | null
}

export function pose(
  dy = 0,
  squash = 0,
  extra: Partial<Pick<Pose, 'leg' | 'arms' | 'face' | 'seated' | 'dx' | 'prop'>> = {},
): Pose {
  return { dy, squash, leg: 0, arms: 'down', face: 'normal', seated: false, dx: 0, prop: null, ...extra }
}
```

Add these entries at the end of the `POSES` object (after `sit`):

```ts
  // wind up, then the front hand goes up and forward; the slap is frame 3
  highfive: [
    pose(0, 1, { face: 'happy' }),
    pose(-1, 0, { arms: 'reachUp', face: 'happy' }),
    pose(-2, 0, { arms: 'reachUp', face: 'grin' }),
    pose(-1, 0, { arms: 'reachUp', face: 'grin' }),
  ],
  hug: [
    pose(0, 0, { arms: 'hug', face: 'happy' }),
    pose(0, 1, { arms: 'hug', face: 'happy' }),
    pose(0, 1, { arms: 'hug', face: 'happy' }),
    pose(0, 0, { arms: 'hug', face: 'happy' }),
  ],
  clap: [
    pose(0, 0, { arms: 'clapOpen', face: 'happy' }),
    pose(-1, 0, { arms: 'clap', face: 'grin' }),
    pose(0, 0, { arms: 'clapOpen', face: 'happy' }),
    pose(-1, 0, { arms: 'clap', face: 'grin' }),
  ],
  wave: [
    pose(0, 0, { arms: 'waveA', face: 'happy' }),
    pose(0, 0, { arms: 'waveB', face: 'happy' }),
    pose(0, 0, { arms: 'waveA', face: 'happy' }),
    pose(0, 0, { arms: 'waveB', face: 'happy' }),
  ],
  dance: [
    pose(0, 0, { arms: 'up', leg: 1, face: 'grin' }),
    pose(-2, 0, { arms: 'mid', face: 'happy' }),
    pose(0, 1, { arms: 'swingA', leg: 2, face: 'grin' }),
    pose(0, 0, { arms: 'up', leg: 2, face: 'grin' }),
    pose(-2, 0, { arms: 'mid', face: 'happy' }),
    pose(0, 1, { arms: 'swingB', leg: 1, face: 'grin' }),
  ],
  // the fight's loser: slumped and swaying, stars circle overhead (an effect)
  dizzy: [
    pose(0, 2, { arms: 'limp', face: 'dizzy', dx: -1 }),
    pose(0, 2, { arms: 'limp', face: 'dizzy' }),
    pose(0, 2, { arms: 'limp', face: 'dizzy', dx: 1 }),
    pose(0, 2, { arms: 'limp', face: 'dizzy' }),
  ],
  // in hand, at the mouth, the ember glowing, then lowered and relaxed (the smoke puffs are an effect)
  smoke: [
    pose(0, 0, { prop: 'joint' }),
    pose(0, 0, { arms: 'toMouth', prop: 'joint' }),
    pose(0, 1, { arms: 'toMouth', prop: 'jointLit' }),
    pose(0, 0, { prop: 'joint', face: 'chill' }),
    pose(0, 0, { prop: 'joint', face: 'chill' }),
    pose(-1, 0, { prop: 'joint', face: 'chill' }),
  ],
  bong: [
    pose(0, 0, { arms: 'holdFront', prop: 'bong' }),
    pose(0, 1, { arms: 'holdFront', prop: 'bongBubbles' }),
    pose(0, 1, { arms: 'holdFront', prop: 'bongBubbles' }),
    pose(0, 0, { arms: 'holdFront', prop: 'bong', face: 'chill' }),
    pose(0, 0, { arms: 'holdFront', prop: 'bong', face: 'chill' }),
    pose(-1, 0, { arms: 'holdFront', prop: 'bong', face: 'chill' }),
  ],
```

(`smoke` frame 4 is `chill` too, so the third and later frames read as "lowered"; the test only pins frames 5 and 6 and the props.)

- [ ] **Step 5: Run the contract and pose tests**

Run: `npx vitest run src/render/sprites/contract.test.ts src/render/sprites/poses.test.ts`
Expected: PASS. (`npx tsc -b` still fails: the art modules don't map the new arms yet. The next steps fix that.)

- [ ] **Step 6: Write the failing art tests**

In `src/render/sprites/humanArt.test.ts`, add `HEAD` to the `./humanArt` import and `type Arms` to the `./poses` import, and add inside `describe('human art', ...)`:

```ts
  /** The skin layer is [head, left hand, right hand]; side -1 is the back hand, 1 the front one. */
  const handAt = (build: (typeof BUILDS)[number], arms: Arms, side: -1 | 1) => {
    const hand = humanBodyParts('skin', build, pose(0, 0, { arms }))[side < 0 ? 1 : 2]
    if (!hand || hand.t !== 'e') throw new Error(`no round hand for ${arms}`)
    return { x: hand.cx, y: hand.cy }
  }

  it('raises the front hand up and forward for the high-five, in front of the face', () => {
    for (const build of BUILDS) {
      const hand = handAt(build, 'reachUp', 1)
      expect(hand.x).toBeGreaterThan(24 + HEAD.rx)
      expect(hand.y).toBeLessThan(22)
    }
  })

  it('brings both hands together in front of the chest to clap, and a little apart between claps', () => {
    for (const build of BUILDS) {
      expect(Math.abs(handAt(build, 'clap', -1).x - 24)).toBeLessThanOrEqual(2)
      expect(Math.abs(handAt(build, 'clap', 1).x - 24)).toBeLessThanOrEqual(2)
      expect(handAt(build, 'clapOpen', 1).x - handAt(build, 'clapOpen', -1).x).toBeGreaterThan(6)
    }
  })

  it('brings the front hand next to the mouth to smoke', () => {
    for (const build of BUILDS) {
      const hand = handAt(build, 'toMouth', 1)
      expect(Math.abs(hand.x - 26)).toBeLessThanOrEqual(5)
      expect(Math.abs(hand.y - (HEAD.y + 5))).toBeLessThanOrEqual(1)
    }
  })

  it('draws arms held across the body on top of the torso, with their own outline', () => {
    for (const build of BUILDS) {
      const shirt = humanBodyParts('shirt', build, pose(0, 0, { arms: 'clap' }))
      expect(shirt[0]).toMatchObject({ t: 'e', cx: 24 }) // both sleeves cross the body: the torso comes first
      expect(shirt.slice(1).every((p) => p.onTop === true)).toBe(true)
      expect(humanBodyParts('shirt', build, pose()).some((p) => p.onTop)).toBe(false)
    }
  })

  it('gives the dizzy and chill faces no eye shine, and the dizzy face no blush', () => {
    const shine = (parts: Part[]) => parts.some((p) => p.col === '#ffffff')
    const blush = (parts: Part[]) => parts.some((p) => p.col.startsWith('rgba(255, 90, 120'))
    expect(shine(humanFaceParts(pose()))).toBe(true)
    expect(shine(humanFaceParts(pose(0, 0, { face: 'dizzy' })))).toBe(false)
    expect(shine(humanFaceParts(pose(0, 0, { face: 'chill' })))).toBe(false)
    expect(blush(humanFaceParts(pose(0, 0, { face: 'dizzy' })))).toBe(false)
  })
```

In `src/render/sprites/animalArt.test.ts`, add inside `describe('animal art', ...)`:

```ts
  it('keeps the see-through belly and muzzle off paws held in front of the body', () => {
    for (const kind of ANIMALS) {
      for (const arms of ['clap', 'clapOpen', 'holdFront', 'toMouth'] as const) {
        const p = pose(0, 0, { arms })
        const fur = animalFurParts(kind, p)
        const held = fur.slice(arms === 'toMouth' ? -1 : -2) // paws in front are drawn last
        const pawPixels = new Set(held.flatMap(pixelsOf))
        const seeThrough = animalDetailParts(kind, p).filter((d) => d.col.startsWith('rgba(255, 255, 255'))
        for (const d of seeThrough) {
          for (const px of pixelsOf(d)) expect(pawPixels.has(px), `${kind} ${arms} ${px}`).toBe(false)
        }
      }
    }
  })

  it('outlines paws held in front of the body on top of it', () => {
    const fur = animalFurParts('dog', pose(0, 0, { arms: 'clap' }))
    expect(fur.slice(-2).every((p) => p.onTop === true)).toBe(true)
    expect(animalFurParts('dog', pose()).some((p) => p.onTop)).toBe(false)
  })

  it('raises a paw above the shoulders for the high-five and the wave', () => {
    for (const arms of ['reachUp', 'waveA', 'waveB'] as const) {
      const fur = animalFurParts('cat', pose(0, 0, { arms }))
      expect(Math.min(...fur.map((q) => partBounds(q).y0))).toBeLessThan(20)
    }
  })
```

In `src/render/sprites/paint.test.ts`, in the first test replace the four bounds expectations with ones that include `dx`:

```ts
            expect(b.x0 + pose.dx).toBeGreaterThanOrEqual(0)
            expect(b.x1 + pose.dx).toBeLessThanOrEqual(FRAME_SIZE)
            expect(b.y0 + pose.dy).toBeGreaterThanOrEqual(0)
            expect(b.y1 + pose.dy).toBeLessThanOrEqual(FRAME_SIZE)
```

In `src/render/sprites/pixelKit.test.ts` (`OUTLINE` is already imported), add this test inside `describe('drawParts', ...)`:

```ts
  it('draws onTop parts in a second pass, their outline over everything else', () => {
    const colors = new Map<string, string>()
    const ctx = {
      fillStyle: '' as string | CanvasGradient | CanvasPattern,
      fillRect(x: number, y: number, w: number) {
        for (let i = 0; i < w; i++) colors.set(`${x + i},${y}`, String(this.fillStyle))
      },
    }
    drawParts(ctx, [
      { t: 'r', x: 4, y: 4, w: 2, h: 2, col: '#ffffff', onTop: true },
      { t: 'r', x: 0, y: 0, w: 10, h: 10, col: '#888888' },
    ])
    expect(colors.get('3,4')).toBe(OUTLINE) // drawn after the big square, though listed first
    expect(colors.get('4,4')).toBe('#ffffff')
    expect(colors.get('1,1')).toBe('#888888')
  })
```

- [ ] **Step 7: Let parts draw on top**

A part held in front of another part of the same layer (a paw in front of the body) loses its outline: every outline is drawn first and the body's fill covers it. In `src/render/sprites/pixelKit.ts`, add to `PartStyle`:

```ts
  /** Drawn in a second pass, outline included, over every other part of its layer: hands held in front of the body. */
  onTop?: boolean
```

and replace `drawParts` with:

```ts
export function drawParts(ctx: PixelCtx, parts: readonly Part[]): void {
  drawPass(ctx, parts.filter((p) => !p.onTop))
  drawPass(ctx, parts.filter((p) => p.onTop))
}

/** Outlines first, then fills, so the parts of one pass merge into one clean silhouette. */
function drawPass(ctx: PixelCtx, parts: readonly Part[]): void {
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
```

- [ ] **Step 8: Draw the new faces**

In `src/render/sprites/faces.ts`, replace `faceParts` with:

```ts
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
  } else if (face === 'dizzy') {
    // dazed X eyes (a spiral needs more than the 3 px an eye has)
    for (const x of [eyeL, eyeR]) {
      parts.push(px(x - 1, eyeY - 1, EYE), px(x + 1, eyeY - 1, EYE), px(x, eyeY, EYE))
      parts.push(px(x - 1, eyeY + 1, EYE), px(x + 1, eyeY + 1, EYE))
    }
  } else if (face === 'chill') {
    // half-closed: a lid line over the lower half of each eye
    for (const x of [eyeL, eyeR]) parts.push(px(x - 1, eyeY, EYE, 3, 1), px(x, eyeY + 1, EYE, 2, 1))
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
    else if (face === 'dizzy') parts.push(px(mx - 1, my + 1, MOUTH), px(mx, my, MOUTH), px(mx + 1, my + 1, MOUTH), px(mx + 2, my, MOUTH))
    else if (face === 'chill') parts.push(px(mx, my + 1, MOUTH, 2, 1), px(mx + 2, my, MOUTH))
    else parts.push(px(mx, my, MOUTH, 2, 1))
  }
  if (s.blush && face !== 'sad' && face !== 'dizzy') {
    parts.push(px(eyeL - 3, eyeY + 3, BLUSH, 2, 1), px(eyeR + 2, eyeY + 3, BLUSH, 2, 1))
  }
  return parts
}
```

- [ ] **Step 9: Draw the new human arms**

In `src/render/sprites/humanArt.ts`, replace everything from `type ArmShape = ...` down to the end of the `arm` function with:

```ts
type ArmShape =
  | 'down'
  | 'swing'
  | 'mid'
  | 'up'
  | 'limp'
  | 'reach'
  | 'forward'
  | 'front'
  | 'frontOpen'
  | 'waveOut'
  | 'waveIn'
  | 'mouth'
  | 'holdLow'
const ARM_SHAPES: Record<Arms, [left: ArmShape, right: ArmShape]> = {
  down: ['down', 'down'],
  swingA: ['swing', 'down'],
  swingB: ['down', 'swing'],
  mid: ['mid', 'mid'],
  up: ['up', 'up'],
  limp: ['limp', 'limp'],
  reachUp: ['down', 'reach'],
  hug: ['front', 'forward'],
  clap: ['front', 'front'],
  clapOpen: ['frontOpen', 'frontOpen'],
  waveA: ['down', 'waveOut'],
  waveB: ['down', 'waveIn'],
  toMouth: ['down', 'mouth'],
  holdFront: ['holdLow', 'holdLow'],
}

/** Sleeve (shirt layer) and hand (skin layer) for one arm; `over` arms cross in front of the torso and draw on top. */
interface ArmParts {
  sleeve: Part
  hand: Part
  over: boolean
}

function arm(shape: ArmShape, side: -1 | 1, b: BuildShape, u: number): ArmParts {
  const top = TORSO_Y - b.ry + 1 + u
  const len = Math.round(b.ry * 1.5)
  const shoulder = CX + side * b.rx
  const x = side < 0 ? Math.round(CX - b.rx - b.arm) : Math.round(CX + b.rx)
  const cloth = { col: TINT_MAIN, shade: TINT_SHADE }
  const hand = (cx: number, cy: number): Part => ({ t: 'e', cx, cy, rx: 1.5, ry: 1.5, col: TINT_MAIN })
  /** An arm across the body to a hand in front of it, outlined over the torso. */
  const across = (handX: number, handY: number): ArmParts => ({
    sleeve: {
      t: 'e',
      cx: (shoulder + handX) / 2,
      cy: (top + 2 + handY) / 2,
      rx: Math.abs(shoulder - handX) / 2 + 1,
      ry: b.arm / 2 + 1,
      ...cloth,
      onTop: true,
    },
    hand: hand(handX, handY),
    over: true,
  })
  switch (shape) {
    case 'mid':
      return {
        sleeve: { t: 'e', cx: shoulder + side * 3.5, cy: top + 2, rx: 3.5, ry: b.arm / 2 + 0.5, ...cloth },
        hand: hand(shoulder + side * 7, top + 1.5),
        over: false,
      }
    case 'up':
      return {
        sleeve: { t: 'e', cx: shoulder + side * 3, cy: top - 5, rx: b.arm / 2 + 0.5, ry: 5.5, ...cloth },
        hand: hand(shoulder + side * 4, top - 11),
        over: false,
      }
    case 'reach':
      return {
        sleeve: { t: 'e', cx: shoulder + side * 3.5, cy: top - 4, rx: b.arm / 2 + 1, ry: 4.5, ...cloth },
        hand: hand(shoulder + side * 6, top - 8.5),
        over: false,
      }
    case 'forward':
      return {
        sleeve: { t: 'e', cx: shoulder + side * 4, cy: top + 2, rx: 4.5, ry: b.arm / 2 + 0.5, ...cloth },
        hand: hand(shoulder + side * 8.5, top + 2),
        over: false,
      }
    case 'waveOut':
      return {
        sleeve: { t: 'e', cx: shoulder + side * 4, cy: top - 5, rx: b.arm / 2 + 0.5, ry: 5.5, ...cloth },
        hand: hand(shoulder + side * 6, top - 11),
        over: false,
      }
    case 'waveIn':
      return {
        sleeve: { t: 'e', cx: shoulder + side * 2, cy: top - 5, rx: b.arm / 2 + 0.5, ry: 5.5, ...cloth },
        hand: hand(shoulder + side * 1.5, top - 11),
        over: false,
      }
    case 'front':
      return across(CX + side * 1.5, top + 4)
    case 'frontOpen':
      return across(CX + side * 4.5, top + 4)
    case 'holdLow':
      return across(CX + side * 3, top + 6)
    case 'mouth': {
      // the forearm up the chest to the mouth; the hand is outlined over the head's edge
      const handY = HEAD.y + 5 + u
      return {
        sleeve: { t: 'e', cx: CX + 7, cy: (top + 3 + handY) / 2, rx: b.arm / 2 + 0.5, ry: (top + 3 - handY) / 2 + 1, ...cloth, onTop: true },
        hand: { ...hand(CX + 6.5, handY), onTop: true },
        over: true,
      }
    }
    default: {
      // hanging arms: swing steps out and shortens, limp hangs lower and closer
      const dx = shape === 'swing' ? side : shape === 'limp' ? -side : 0
      const dy = shape === 'limp' ? 1 : 0
      const h = shape === 'swing' ? len - 1 : len
      return {
        sleeve: { t: 'r', x: x + dx, y: top + dy, w: b.arm, h, ...cloth },
        hand: { t: 'r', x: x + dx, y: top + dy + h - 2, w: b.arm, h: 2, col: TINT_MAIN },
        over: false,
      }
    }
  }
}
```

In `humanBodyParts`, replace the `if (layer === 'shirt') { ... }` block with:

```ts
  if (layer === 'shirt') {
    // arms held across the body draw over the torso; the rest hang behind it
    return [
      ...arms.filter((a) => !a.over).map((a) => a.sleeve),
      { t: 'e', cx: CX, cy: TORSO_Y + u, rx: b.rx, ry: b.ry, col: TINT_MAIN, shade: TINT_SHADE },
      ...arms.filter((a) => a.over).map((a) => a.sleeve),
    ]
  }
```

- [ ] **Step 10: Draw the new animal paws**

In `src/render/sprites/animalArt.ts`, replace from `type PawShape = ...` through the `paws` const with:

```ts
type PawShape =
  | 'down'
  | 'swing'
  | 'mid'
  | 'up'
  | 'limp'
  | 'reach'
  | 'forward'
  | 'front'
  | 'frontOpen'
  | 'waveOut'
  | 'waveIn'
  | 'mouth'
  | 'holdLow'
const PAW_SHAPES: Record<Arms, [left: PawShape, right: PawShape]> = {
  down: ['down', 'down'],
  swingA: ['swing', 'down'],
  swingB: ['down', 'swing'],
  mid: ['mid', 'mid'],
  up: ['up', 'up'],
  limp: ['limp', 'limp'],
  reachUp: ['down', 'reach'],
  hug: ['front', 'forward'],
  clap: ['front', 'front'],
  clapOpen: ['frontOpen', 'frontOpen'],
  waveA: ['down', 'waveOut'],
  waveB: ['down', 'waveIn'],
  toMouth: ['down', 'mouth'],
  holdFront: ['holdLow', 'holdLow'],
}
/** Paws held in front of the body: drawn over it, and kept clear of the see-through belly. */
const OVER_BODY: readonly PawShape[] = ['front', 'frontOpen', 'mouth', 'holdLow']

/** A paw, or for a penguin a flipper: narrower and longer. */
function paw(shape: PawShape, side: -1 | 1, u: number, flipper: boolean): Part {
  const at = (dx: number, cy: number, rx: number, ry: number): Part => ({
    t: 'e',
    cx: CX + side * dx,
    cy: cy + u,
    rx: flipper ? rx - 0.5 : rx,
    ry: flipper ? ry + 1 : ry,
    col: FUR,
    shade: FUR_SHADE,
  })
  switch (shape) {
    case 'swing': return at(8, 32, 2, 3)
    case 'mid': return at(9.5, 31, 2.5, 2)
    case 'up': return at(7, 25, 2, 3.5)
    case 'limp': return at(7, 35, 2, 3)
    case 'reach': return at(9, 22, 2, 3)
    case 'forward': return at(11, 30, 3, 2)
    case 'waveOut': return at(9.5, 22.5, 2, 3.5)
    case 'waveIn': return at(6.5, 21.5, 2, 3.5)
    case 'front': return at(1.5, 32.5, 2, 2)
    case 'frontOpen': return at(4, 32.5, 2, 2)
    case 'holdLow': return at(3, 34, 2, 2)
    case 'mouth': return at(6, 25.5, 2, 2)
    default: return at(7.5, 33, 2, 3)
  }
}

const flat = (p: Part): Part => ({ ...p, noOutline: true })
/** Both paws, split into those behind the body and those held in front of it. */
function pawsOf(kind: Animal, pose: Pose): { behind: Part[]; over: Part[] } {
  const [left, right] = PAW_SHAPES[pose.arms]
  const behind: Part[] = []
  const over: Part[] = []
  for (const [shape, side] of [[left, -1], [right, 1]] as const) {
    const part = paw(shape, side, sink(pose), kind === 'penguin')
    if (OVER_BODY.includes(shape)) over.push({ ...part, onTop: true })
    else behind.push(part)
  }
  return { behind, over }
}
const paws = (kind: Animal, pose: Pose): Part[] => {
  const { behind, over } = pawsOf(kind, pose)
  return [...behind, ...over]
}
```

In `animalFurParts`, replace `parts.push(...paws(kind, pose), body(u))` with:

```ts
  const held = pawsOf(kind, pose)
  parts.push(...held.behind, body(u))
```

and at the end of `animalFurParts`, replace the patch loop and `return parts` with:

```ts
  // flat, unshaded fur under each see-through patch, so the patch lightens the fur evenly
  for (const patch of lightPatches(kind, u)) parts.push({ ...patch, col: FUR })
  // paws held in front go over the body, last
  parts.push(...held.over)
  return parts
```

In `animalDetailParts`, replace `parts.push(...lightPatches(kind, u))` with:

```ts
  // the see-through patches skip paws held in front, outline included, so they never whiten them
  const held = pawsOf(kind, pose).over.map((p) => (p.t === 'e' ? { ...p, rx: p.rx + 1, ry: p.ry + 1 } : p))
  for (const patch of lightPatches(kind, u)) parts.push(...(held.length > 0 ? uncovered(patch, held) : [patch]))
```

- [ ] **Step 11: Offset frames by `dx`**

In `src/render/sprites/paint.ts`, in `paintSheet`, replace `ctx.translate(0, pose.dy)` with `ctx.translate(pose.dx, pose.dy)`.

- [ ] **Step 12: Hold the last frame of play-once rows**

In `src/avatars/avatar.ts`, add `playsOnce` to the `../render/sprites/contract` import, and in `buildGroup` after `sprite.animationSpeed = ANIMATIONS[anim].fps / 60` add:

```ts
      sprite.loop = !playsOnce(anim) // a high-five or a smoke ends on its last frame
```

- [ ] **Step 13: Run every test and the typecheck**

Run: `npm test && npx tsc -b`
Expected: PASS. If `keeps every animal layer and the collar inside the 48px frame` or the human equivalent fails, a new shape pokes out of the frame: shrink that shape's offset, don't loosen the test.

- [ ] **Step 14: Look at the rows**

Run `npm run dev`, open `http://localhost:5173/sheet-preview.html`, and check every new row for a human of each build and three animals (a cat, a duck and a frog). Raised hands sit in front of the face, claps meet in front of the chest, the dizzy sway moves the whole character. Adjust offsets in the art modules if something reads badly; keep the tests passing.

- [ ] **Step 15: Document format v6**

In `README.md`, in "Sprite sheet contract":

- Replace the parenthetical in the first paragraph with: `(Sheet format v6: since v6, sheets have eight more rows (7 to 14) for interactions and emotes, so a v5 PNG needs those rows added. Since v5 sheets have a sit row, and since v3 each animal is two sheets, a grayscale fur sheet and a details sheet.)`
- Replace `Each sheet is a **288 x 336 px** PNG: a grid of 6 columns and 7 rows` with `Each sheet is a **288 x 720 px** PNG: a grid of 6 columns and 15 rows`.
- Add to the rows table:

```md
| 7 | highfive | 4 | 6 (plays once) |
| 8 | hug | 4 | 4 |
| 9 | clap | 4 | 8 |
| 10 | wave | 4 | 6 |
| 11 | dance | 6 | 6 |
| 12 | dizzy | 4 | 4 |
| 13 | smoke | 6 | 1.5 (plays once) |
| 14 | bong | 6 | 1.5 (plays once) |
```

- After the sentence starting `**Per-frame motion.**`, add: `` `dx` shifts the whole character sideways (only the dizzy sway uses it). ``
- Add to the per-frame motion table:

```md
| highfive | (0,1) (-1,0) (-2,0) (-1,0) | the front arm goes up and forward from frame 2; the slap is frame 3 |
| hug | (0,0) (0,1) (0,1) (0,0) | the front arm out in front, the other across the chest |
| clap | (0,0) (-1,0) (0,0) (-1,0) | hands a little apart, then together, in front of the chest |
| wave | (0,0) on every frame | the front arm up, tilting out and in |
| dance | (0,0) (-2,0) (0,1) (0,0) (-2,0) (0,1) | arms up, out and swinging; feet alternate |
| dizzy | (0,2) on every frame | arms limp, X eyes; `dx` -1, 0, 1, 0 |
| smoke | (0,0) (0,0) (0,1) (0,0) (0,0) (-1,0) | the joint in the front hand, at the mouth on frames 2 and 3 (glowing on 3); relaxed face from frame 4 |
| bong | (0,0) (0,1) (0,1) (0,0) (0,0) (-1,0) | both hands hold the bong in front, bubbling on frames 2 and 3; relaxed face from frame 4 |
```

- [ ] **Step 16: Commit**

```bash
git add src/render/sprites src/avatars/avatar.ts README.md
git commit -m "feat: sheet format v6 with high-five, hug, clap, wave, dance, dizzy, smoke and bong rows"
```

---

### Task 3: The prop layer: a joint and a bong

**Files:**
- Create: `src/render/sprites/propArt.ts`, `src/render/sprites/propArt.test.ts`
- Modify: `src/render/sprites/pixelKit.ts`, `src/render/sprites/humanArt.ts`, `src/render/sprites/animalArt.ts`, `src/render/sprites/roster.ts`, `src/render/sprites/paint.ts`, `README.md`
- Test: `src/render/sprites/pixelKit.test.ts`, `src/render/sprites/roster.test.ts`, `src/render/sprites/paint.test.ts`

**Interfaces:**
- Consumes: `Pose.prop`, `Arms` `'toMouth'` and `'holdFront'` (Task 2).
- Produces: `PROP_BODIES = ['skinny', 'average', 'chubby', 'animal']`, `type PropBody`, sheet ids `prop-<body>` (role `fixed`, top of every stack), `propParts(body: PropBody, pose: Pose): Part[]`, `partCenter(p: Part): { x: number; y: number }`, `humanHandSpot(build, pose, side)`, `humanMouthSpot(pose)`, `animalPawSpot(pose, side)`, `animalMouthSpot(pose)`.

- [ ] **Step 1: Write the failing tests**

Create `src/render/sprites/propArt.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { animalMouthSpot } from './animalArt'
import { FRAME_SIZE } from './contract'
import { humanHandSpot, humanMouthSpot } from './humanArt'
import { partBounds, type Part } from './pixelKit'
import { POSES, pose, type Pose } from './poses'
import { propParts } from './propArt'
import { BUILDS, PROP_BODIES } from './roster'

function expectInFrame(parts: Part[], p: Pose): void {
  for (const part of parts) {
    const b = partBounds(part)
    expect(b.x0 + p.dx).toBeGreaterThanOrEqual(0)
    expect(b.x1 + p.dx).toBeLessThanOrEqual(FRAME_SIZE)
    expect(b.y0 + p.dy).toBeGreaterThanOrEqual(0)
    expect(b.y1 + p.dy).toBeLessThanOrEqual(FRAME_SIZE)
  }
}

describe('prop art', () => {
  it('draws nothing unless the pose holds a prop', () => {
    for (const body of PROP_BODIES) {
      expect(propParts(body, pose())).toEqual([])
      for (const p of POSES.cheer) expect(propParts(body, p)).toEqual([])
    }
  })

  it('draws a prop inside the frame on every smoke and bong frame', () => {
    for (const body of PROP_BODIES) {
      for (const p of [...POSES.smoke, ...POSES.bong]) {
        const parts = propParts(body, p)
        expect(parts.length).toBeGreaterThan(0)
        expectInFrame(parts, p)
      }
    }
  })

  it('puts the joint in the front hand, and at the mouth while smoking', () => {
    for (const build of BUILDS) {
      const held = pose(0, 0, { prop: 'joint' })
      const hand = humanHandSpot(build, held, 1)
      expect(propParts(build, held)[0]).toMatchObject({ x: Math.round(hand.x), y: Math.round(hand.y) })
      const smoking = pose(0, 0, { arms: 'toMouth', prop: 'joint' })
      const mouth = humanMouthSpot(smoking)
      expect(propParts(build, smoking)[0]).toMatchObject({ x: Math.round(mouth.x), y: Math.round(mouth.y) })
    }
  })

  it('makes the ember glow only on the inhale', () => {
    const at = (prop: 'joint' | 'jointLit') => propParts('average', pose(0, 0, { arms: 'toMouth', prop }))
    expect(at('jointLit')[1]?.col).not.toBe(at('joint')[1]?.col)
    expect(at('jointLit').length).toBeGreaterThan(at('joint').length)
  })

  it('reaches the bong from the hands up to the mouth, bubbling while in use', () => {
    for (const body of PROP_BODIES) {
      const p = pose(0, 0, { arms: 'holdFront', prop: 'bong' })
      const mouth = body === 'animal' ? animalMouthSpot(p) : humanMouthSpot(p)
      const top = Math.min(...propParts(body, p).map((q) => partBounds(q).y0))
      expect(top).toBeLessThanOrEqual(Math.round(mouth.y) + 1)
      const bubbling = propParts(body, pose(0, 0, { arms: 'holdFront', prop: 'bongBubbles' }))
      expect(bubbling.length).toBeGreaterThan(propParts(body, p).length)
    }
  })
})
```

In `src/render/sprites/pixelKit.test.ts`, add `partCenter` to the `./pixelKit` import and add:

```ts
describe('partCenter', () => {
  it('finds the middle of a rect, an ellipse and a triangle', () => {
    expect(partCenter({ t: 'r', x: 2, y: 4, w: 2, h: 4, col: '#ffffff' })).toEqual({ x: 3, y: 6 })
    expect(partCenter({ t: 'e', cx: 5.5, cy: 7, rx: 2, ry: 2, col: '#ffffff' })).toEqual({ x: 5.5, y: 7 })
    expect(partCenter({ t: 't', cx: 4, top: 2, h: 6, w: 5, col: '#ffffff' })).toEqual({ x: 4, y: 5 })
  })
})
```

In `src/render/sprites/roster.test.ts`:

- In `stacks a human back to front ...`, add `{ sheet: 'prop-chubby', role: 'fixed' },` as the last entry.
- In `leaves out the back hair and accessory ...`, add `'prop-chubby',` as the last entry.
- In `builds an animal from its fur ...`, add `{ sheet: 'prop-animal', role: 'fixed' },` after the collar, and `'prop-animal'` after `'collar'` in the penguin list. Rename the test to `builds an animal from its fur, its fixed details, the chat-colored collar and the prop layer`.
- In `lists every sheet exactly once`, change the length to `9 + 1 + 4 + 1 + 3 + 8 + 8 + 1 + 4`.

In `src/render/sprites/paint.test.ts`, in `has art for every sheet in every frame, all inside the frame`, replace `expect(parts.length).toBeGreaterThan(0)` with:

```ts
          // a prop sheet is empty except while the pose holds a prop
          if (id.startsWith('prop-')) expect(parts.length > 0, `${id} ${name}`).toBe(pose.prop !== null)
          else expect(parts.length).toBeGreaterThan(0)
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/render/sprites`
Expected: FAIL (no `./propArt`, no `PROP_BODIES`, no `partCenter`).

- [ ] **Step 3: Add `partCenter`**

In `src/render/sprites/pixelKit.ts`, add after `partBounds`:

```ts
/** The middle of a part, in frame px: where a prop meets a hand. */
export function partCenter(p: Part): { x: number; y: number } {
  if (p.t === 'e') return { x: p.cx, y: p.cy }
  if (p.t === 'r') return { x: p.x + p.w / 2, y: p.y + p.h / 2 }
  return { x: p.cx, y: p.top + p.h / 2 }
}
```

- [ ] **Step 4: Export where hands and mouths are**

In `src/render/sprites/humanArt.ts`, add `partCenter` to the `./pixelKit` import and add after `humanBodyParts`:

```ts
/** The center of a hand (side 1 is the front one), for the prop layer. */
export function humanHandSpot(build: Build, pose: Pose, side: -1 | 1): { x: number; y: number } {
  const [left, right] = ARM_SHAPES[pose.arms]
  return partCenter(arm(side < 0 ? left : right, side, BUILD_SHAPES[build], sink(pose)).hand)
}

/** The right end of the mouth (see humanFaceParts), where a joint goes. */
export function humanMouthSpot(pose: Pose): { x: number; y: number } {
  return { x: CX + 3, y: HEAD.y + 5 + sink(pose) }
}
```

In `src/render/sprites/animalArt.ts`, add `partCenter` to the `./pixelKit` import and add after `pawsOf`:

```ts
/** The center of a paw (side 1 is the front one), for the prop layer; every animal shares it. */
export function animalPawSpot(pose: Pose, side: -1 | 1): { x: number; y: number } {
  const [left, right] = PAW_SHAPES[pose.arms]
  return partCenter(paw(side < 0 ? left : right, side, sink(pose), false))
}

/** The right end of the mouth, where a joint goes; birds hold it under the beak. */
export function animalMouthSpot(pose: Pose): { x: number; y: number } {
  return { x: CX + 3, y: 26 + sink(pose) }
}
```

- [ ] **Step 5: Draw the props**

Create `src/render/sprites/propArt.ts`:

```ts
import { animalMouthSpot, animalPawSpot } from './animalArt'
import { humanHandSpot, humanMouthSpot } from './humanArt'
import type { Part } from './pixelKit'
import type { Pose } from './poses'
import type { PropBody } from './roster'

const PAPER = '#efe9da'
const EMBER = '#e2552b'
const EMBER_LIT = '#ffcf4a'
const GLOW = 'rgba(255, 170, 60, 0.55)'
const GLASS = '#7fd0c8'
const GLASS_SHADE = '#5aa8a2'
const WATER = 'rgba(70, 140, 190, 0.8)'
const BUBBLE = '#ffffff'
const BOWL = '#8a8f98'

interface Spot {
  x: number
  y: number
}

/**
 * The prop layer, in final colors on top of the whole character: a joint
 * in the front hand (at the mouth while smoking), or a bong held in both
 * hands with its mouthpiece at the mouth. Empty unless the pose holds one.
 */
export function propParts(body: PropBody, pose: Pose): Part[] {
  if (!pose.prop) return []
  const hand = body === 'animal' ? animalPawSpot(pose, 1) : humanHandSpot(body, pose, 1)
  const mouth = body === 'animal' ? animalMouthSpot(pose) : humanMouthSpot(pose)
  if (pose.prop === 'joint' || pose.prop === 'jointLit') {
    return joint(pose.arms === 'toMouth' ? mouth : hand, pose.prop === 'jointLit')
  }
  return bong(mouth, hand, pose.prop === 'bongBubbles')
}

/** A 5 px joint pointing forward from `from`, its ember at the tip. */
function joint(from: Spot, lit: boolean): Part[] {
  const x = Math.round(from.x)
  const y = Math.round(from.y)
  const parts: Part[] = [
    { t: 'r', x, y, w: 5, h: 1, col: PAPER },
    { t: 'r', x: x + 5, y, w: 1, h: 1, col: lit ? EMBER_LIT : EMBER, noOutline: true },
  ]
  if (lit) {
    parts.push(
      { t: 'r', x: x + 5, y: y - 1, w: 1, h: 1, col: GLOW, noOutline: true },
      { t: 'r', x: x + 6, y, w: 1, h: 1, col: GLOW, noOutline: true },
    )
  }
  return parts
}

/** A glass tube from the mouth down to a round base held at the hands, with water and a bowl. */
function bong(mouth: Spot, hand: Spot, bubbles: boolean): Part[] {
  const x = Math.round(mouth.x) - 1
  const top = Math.round(mouth.y) + 1
  const baseY = Math.round(hand.y) + 1
  const parts: Part[] = [
    { t: 'r', x, y: top, w: 2, h: Math.max(2, baseY - top), col: GLASS, shade: GLASS_SHADE },
    { t: 'e', cx: x + 1, cy: baseY + 1, rx: 3, ry: 2.5, col: GLASS, shade: GLASS_SHADE },
    { t: 'r', x: x + 3, y: baseY - 2, w: 2, h: 1, col: BOWL },
    { t: 'r', x: x - 1, y: baseY + 1, w: 5, h: 2, col: WATER, noOutline: true },
  ]
  if (bubbles) {
    parts.push(
      { t: 'r', x, y: baseY, w: 1, h: 1, col: BUBBLE, noOutline: true },
      { t: 'r', x: x + 1, y: baseY - 3, w: 1, h: 1, col: BUBBLE, noOutline: true },
    )
  }
  return parts
}
```

- [ ] **Step 6: Add the prop sheets to the roster and the painter**

In `src/render/sprites/roster.ts`:

Add after `BUILDS` / `Build`:

```ts
/** Prop sheets: one per body a hand can be on, each human build and the shared animal body. */
export const PROP_BODIES = [...BUILDS, 'animal'] as const
export type PropBody = (typeof PROP_BODIES)[number]
```

Add `| \`prop-${PropBody}\`` to `SheetId`, and `...PROP_BODIES.map((b): SheetId => \`prop-${b}\`),` at the end of `ALL_SHEETS`.

In `layersFor`, add `{ sheet: 'prop-animal', role: 'fixed' },` after the collar in the animal stack, and before `return layers` in the human branch add:

```ts
  layers.push({ sheet: `prop-${build}`, role: 'fixed' }) // a joint or a bong, on top of everything
```

In `src/render/sprites/paint.ts`, add `import { propParts } from './propArt'`, add `PROP_BODIES` to the `./roster` import, and in `partsFor` add before the `throw`:

```ts
  for (const body of PROP_BODIES) if (id === `prop-${body}`) return propParts(body, pose)
```

- [ ] **Step 7: Run every test and the typecheck**

Run: `npm test && npx tsc -b`
Expected: PASS. (`src/info/lineup.test.ts` only checks for hair sheets, so the extra layer doesn't affect it.)

- [ ] **Step 8: Look at the props**

Run `npm run dev`, open `/sheet-preview.html`, and check the `smoke` and `bong` rows for each human build and a few animals: the joint sits in the hand, then at the mouth with the ember glowing on frame 3; the bong's mouthpiece reaches the mouth and the hands hold its base. Nudge `propArt.ts` if not; keep the tests passing.

- [ ] **Step 9: Document the prop layer**

In `README.md`, "Sprite sheet contract":

- In the color role table, change the `fixed` row's sheets to: `` `human-<build>-pants`, `human-face`, `<animal>-details` (e.g. `dog-details`), `prop-<build>`, `prop-animal` ``.
- In **Stacks**, change the human line to end `..., face, hair, accessory, prop` and the animal line to `the fur (<animal>), its details (<animal>-details), the collar, then the prop`.
- At the end of **What goes on which layer**, add: `Props go on their own top layer, \`prop-<build>\` for humans and \`prop-animal\` for every animal: the joint in the front hand (at the mouth on smoke frames 2 and 3) and the bong held in front with its mouthpiece at the mouth. Prop sheets are empty except on the smoke and bong rows.`

- [ ] **Step 10: Commit**

```bash
git add src/render/sprites README.md
git commit -m "feat: prop layer with a joint and a bong"
```

---

### Task 4: Effects: art, motion and the effect layer

**Files:**
- Create: `src/render/effects/effectArt.ts`, `src/render/effects/effectArt.test.ts`, `src/render/effects/effectMotion.ts`, `src/render/effects/effectMotion.test.ts`, `src/render/effects/effectLayer.ts`
- Modify: `src/render/stage.ts`

**Interfaces:**
- Produces:
  - `type EffectName = 'spark' | 'heart' | 'cloud' | 'fist' | 'shoe' | 'star' | 'puff' | 'smoke' | 'tinyStar'`, `EFFECTS`, `EFFECT_NAMES`, `effectFrameParts(name, frame): Part[]`.
  - `interface EffectCue { name: EffectName; x: number /* stage px */; rise: number /* frame px above the ground */; delayMs?: number; lifeMs?: number; vx?: number; vy?: number /* frame px/s */; orbit?: { radius: number; phase: number } }`.
  - `effectAt(cue, ageMs): EffectPose | null`, `effectDone(cue, ageMs): boolean`.
  - `class EffectLayer { constructor(layer: Container, scale: number); spawn(cue: EffectCue, groundY: number, now: number): void; update(now: number): void; destroy(): void }`.
  - `Stage.effectLayer: Container` (between the characters and the name plates).

- [ ] **Step 1: Write the failing tests**

Create `src/render/effects/effectArt.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { partBounds } from '../sprites/pixelKit'
import { EFFECT_NAMES, EFFECTS, effectFrameParts } from './effectArt'

describe('effect art', () => {
  it('draws every frame of every effect inside its box', () => {
    for (const name of EFFECT_NAMES) {
      const { w, h, frames } = EFFECTS[name]
      for (let f = 0; f < frames; f++) {
        const parts = effectFrameParts(name, f)
        expect(parts.length, `${name} ${f}`).toBeGreaterThan(0)
        for (const p of parts) {
          const b = partBounds(p)
          expect(b.x0, `${name} ${f}`).toBeGreaterThanOrEqual(0)
          expect(b.y0, `${name} ${f}`).toBeGreaterThanOrEqual(0)
          expect(b.x1, `${name} ${f}`).toBeLessThanOrEqual(w)
          expect(b.y1, `${name} ${f}`).toBeLessThanOrEqual(h)
        }
      }
    }
  })

  it('grows the spark frame by frame', () => {
    const width = (f: number) => {
      const bounds = effectFrameParts('spark', f).map(partBounds)
      return Math.max(...bounds.map((b) => b.x1)) - Math.min(...bounds.map((b) => b.x0))
    }
    for (let f = 1; f < EFFECTS.spark.frames; f++) expect(width(f)).toBeGreaterThan(width(f - 1))
  })

  it('churns the cloud: no two frames in a row alike', () => {
    for (let f = 0; f < EFFECTS.cloud.frames; f++) {
      const next = (f + 1) % EFFECTS.cloud.frames
      expect(JSON.stringify(effectFrameParts('cloud', f))).not.toBe(JSON.stringify(effectFrameParts('cloud', next)))
    }
  })
})
```

Create `src/render/effects/effectMotion.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { effectAt, effectDone, type EffectCue } from './effectMotion'

const cue = (over: Partial<EffectCue> & Pick<EffectCue, 'name'>): EffectCue => ({ x: 0, rise: 0, ...over })

describe('effectAt', () => {
  it('waits out its delay, then shows until its life is over', () => {
    const spark = cue({ name: 'spark', delayMs: 100 })
    expect(effectAt(spark, 99)).toBeNull()
    expect(effectAt(spark, 100)).not.toBeNull()
    expect(effectAt(spark, 499)).not.toBeNull()
    expect(effectAt(spark, 500)).toBeNull()
    expect(effectDone(spark, 499)).toBe(false)
    expect(effectDone(spark, 500)).toBe(true)
    expect(effectDone(spark, 50)).toBe(false)
  })

  it('steps through the spark frames once over its life', () => {
    expect([0, 100, 200, 300, 399].map((ms) => effectAt(cue({ name: 'spark' }), ms)?.frame)).toEqual([0, 1, 2, 3, 3])
  })

  it('floats a heart up and fades it out over the last 40% of its life', () => {
    const heart = cue({ name: 'heart' })
    expect(effectAt(heart, 1000)?.dy).toBeCloseTo(-16)
    expect(effectAt(heart, 600)?.alpha).toBe(1)
    expect(effectAt(heart, 1080)?.alpha).toBeCloseTo(0.25)
  })

  it('grows and fades smoke as it rises and drifts', () => {
    const late = effectAt(cue({ name: 'smoke', vx: 6 }), 1400)
    expect(late?.scale).toBeGreaterThan(1.5)
    expect(late?.alpha).toBeLessThan(0.2)
    expect(late?.dx).toBeCloseTo(8.4)
    expect(late?.dy).toBeCloseTo(-19.6)
  })

  it('circles an orbiting star round its spot once a second, flattened like a halo', () => {
    const star = cue({ name: 'tinyStar', orbit: { radius: 8, phase: 0 } })
    expect(effectAt(star, 0)).toMatchObject({ dx: 8, dy: 0 })
    expect(effectAt(star, 250)?.dx).toBeCloseTo(0)
    expect(effectAt(star, 250)?.dy).toBeCloseTo(3.2)
    expect(effectAt(star, 1000)?.dx).toBeCloseTo(8)
  })

  it('lets a cue set its own life and speed: the cloud lasts the brawl, puffs fly out', () => {
    expect(effectAt(cue({ name: 'cloud', lifeMs: 3000 }), 2_999)).not.toBeNull()
    expect(effectAt(cue({ name: 'puff', vx: 40, vy: -40 }), 250)).toMatchObject({ dx: 10, dy: -10 })
  })

  it('bobs the cloud by at most a pixel', () => {
    for (let ms = 0; ms < 3000; ms += 50) {
      expect(Math.abs(effectAt(cue({ name: 'cloud' }), ms)?.dy ?? 0)).toBeLessThanOrEqual(1)
    }
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/render/effects`
Expected: FAIL (modules missing).

- [ ] **Step 3: Draw the effects**

Create `src/render/effects/effectArt.ts`:

```ts
import type { Part } from '../sprites/pixelKit'

/** Everything the effect layer shows: code-drawn pixel art in fixed colors, like the characters. */
export type EffectName = 'spark' | 'heart' | 'cloud' | 'fist' | 'shoe' | 'star' | 'puff' | 'smoke' | 'tinyStar'

export interface EffectSpec {
  /** Frame size in frame px; an effect is drawn centered on its spot. */
  w: number
  h: number
  frames: number
  fps: number
  lifeMs: number
  /** Rise speed in frame px per second (negative is up), unless the cue sets one. */
  vy: number
  /** The scale it reaches at the end of its life. */
  grow: number
  /** Fades out over this last fraction of its life; 0 never fades. */
  fade: number
}

export const EFFECTS: Record<EffectName, EffectSpec> = {
  spark: { w: 15, h: 15, frames: 4, fps: 10, lifeMs: 400, vy: 0, grow: 1, fade: 0 },
  heart: { w: 9, h: 8, frames: 1, fps: 1, lifeMs: 1200, vy: -16, grow: 1, fade: 0.4 },
  cloud: { w: 80, h: 48, frames: 4, fps: 8, lifeMs: 3000, vy: 0, grow: 1, fade: 0 },
  fist: { w: 10, h: 9, frames: 1, fps: 1, lifeMs: 200, vy: 0, grow: 1, fade: 0 },
  shoe: { w: 12, h: 7, frames: 1, fps: 1, lifeMs: 200, vy: 0, grow: 1, fade: 0 },
  star: { w: 9, h: 9, frames: 1, fps: 1, lifeMs: 200, vy: 0, grow: 1, fade: 0 },
  puff: { w: 8, h: 8, frames: 1, fps: 1, lifeMs: 400, vy: 0, grow: 0.6, fade: 0.5 },
  smoke: { w: 10, h: 10, frames: 1, fps: 1, lifeMs: 1500, vy: -14, grow: 1.6, fade: 0.6 },
  tinyStar: { w: 5, h: 5, frames: 1, fps: 1, lifeMs: 3000, vy: 0, grow: 1, fade: 0 },
}
export const EFFECT_NAMES = Object.keys(EFFECTS) as EffectName[]

const SPARK = '#fff3a0'
const SPARK_CORE = '#ffd23f'
const HEART = '#ff5a7a'
const HEART_SHINE = '#ffd0da'
const CLOUD = '#ece7de'
const CLOUD_SHADE = '#c9c2b6'
const GLOVE = '#ffffff'
const GLOVE_SHADE = '#d6d6d6'
const SHOE = '#a8322c'
const SHOE_SHADE = '#7d2420'
const SOLE = '#f4f1ea'
const STAR = '#ffd23f'
const SMOKE = 'rgba(225, 225, 225, 0.85)'
const SMOKE_LIGHT = 'rgba(255, 255, 255, 0.6)'

/** The cloud's puffs as [cx, cy, radius]; each swells a pixel on its own frame, so the cloud churns. */
const CLOUD_PUFFS: readonly (readonly [number, number, number])[] = [
  [20, 28, 12],
  [34, 20, 13],
  [48, 20, 13],
  [60, 28, 12],
  [40, 30, 14],
  [26, 36, 9],
  [54, 36, 9],
]

const HEART_PARTS: Part[] = [
  { t: 'r', x: 2, y: 1, w: 2, h: 1, col: HEART },
  { t: 'r', x: 5, y: 1, w: 2, h: 1, col: HEART },
  { t: 'r', x: 1, y: 2, w: 7, h: 2, col: HEART },
  { t: 'r', x: 2, y: 4, w: 5, h: 1, col: HEART },
  { t: 'r', x: 3, y: 5, w: 3, h: 1, col: HEART },
  { t: 'r', x: 4, y: 6, w: 1, h: 1, col: HEART },
  { t: 'r', x: 2, y: 2, w: 1, h: 1, col: HEART_SHINE, noOutline: true },
]

/** The parts of one frame of an effect, in its own w x h box. */
export function effectFrameParts(name: EffectName, frame: number): Part[] {
  switch (name) {
    case 'spark':
      return spark(frame)
    case 'heart':
      return HEART_PARTS
    case 'cloud':
      return CLOUD_PUFFS.map(([cx, cy, r], i): Part => {
        const swell = (frame + i) % 4 === 0 ? 1 : 0
        return { t: 'e', cx, cy, rx: r + 2 + swell, ry: r + swell, col: CLOUD, shade: CLOUD_SHADE }
      })
    case 'fist':
      return [
        { t: 'r', x: 1, y: 2, w: 2, h: 5, col: GLOVE, shade: GLOVE_SHADE },
        { t: 'e', cx: 5, cy: 4.5, rx: 3, ry: 3, col: GLOVE, shade: GLOVE_SHADE },
      ]
    case 'shoe':
      return [
        { t: 'e', cx: 5.5, cy: 3, rx: 4, ry: 2, col: SHOE, shade: SHOE_SHADE },
        { t: 'r', x: 2, y: 4, w: 8, h: 1, col: SOLE },
      ]
    case 'star':
      return [
        { t: 'r', x: 4, y: 1, w: 1, h: 7, col: STAR },
        { t: 'r', x: 1, y: 3, w: 7, h: 1, col: STAR },
        { t: 'r', x: 3, y: 2, w: 3, h: 4, col: STAR },
        { t: 'r', x: 2, y: 6, w: 1, h: 1, col: STAR },
        { t: 'r', x: 6, y: 6, w: 1, h: 1, col: STAR },
      ]
    case 'puff':
      return [{ t: 'e', cx: 3.5, cy: 3.5, rx: 2.5, ry: 2.5, col: CLOUD, shade: CLOUD_SHADE }]
    case 'smoke':
      return [
        { t: 'e', cx: 4.5, cy: 4.5, rx: 3.5, ry: 3, col: SMOKE, noOutline: true },
        { t: 'e', cx: 3.5, cy: 3.5, rx: 1.5, ry: 1.2, col: SMOKE_LIGHT, noOutline: true },
      ]
    case 'tinyStar':
      return [
        { t: 'r', x: 2, y: 1, w: 1, h: 3, col: STAR },
        { t: 'r', x: 1, y: 2, w: 3, h: 1, col: STAR },
      ]
  }
}

/** A starburst: four rays that lengthen frame by frame, diagonal sparks from frame 2, a bright core. */
function spark(frame: number): Part[] {
  const c = 7
  const len = 2 + frame
  const parts: Part[] = [
    { t: 'r', x: c - len, y: c, w: len * 2 + 1, h: 1, col: SPARK },
    { t: 'r', x: c, y: c - len, w: 1, h: len * 2 + 1, col: SPARK },
  ]
  if (frame > 0) {
    const d = frame + 1
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      parts.push({ t: 'r', x: c + sx * d, y: c + sy * d, w: 1, h: 1, col: SPARK })
    }
  }
  parts.push({ t: 'r', x: c - 1, y: c - 1, w: 3, h: 3, col: SPARK_CORE })
  return parts
}
```

- [ ] **Step 4: Move them**

Create `src/render/effects/effectMotion.ts`:

```ts
import { EFFECTS, type EffectName } from './effectArt'

/** What a choreographer or an emote asks the effect layer to show. */
export interface EffectCue {
  name: EffectName
  /** Stage px. */
  x: number
  /** Frame px above the ground line of the characters it belongs to. */
  rise: number
  /** Shows this long after it is cued. */
  delayMs?: number
  /** Replaces the effect's own life (the cloud lasts the whole brawl). */
  lifeMs?: number
  /** Frame px per second; `vy` replaces the effect's own rise speed. */
  vx?: number
  vy?: number
  /** Circles its spot at this radius (frame px), starting at this angle (radians), once a second. */
  orbit?: { radius: number; phase: number }
}

export interface EffectPose {
  /** Offset from the cued spot in frame px; positive y is down. */
  dx: number
  dy: number
  frame: number
  alpha: number
  scale: number
}

/** Where a cued effect is `ageMs` after it was cued: null before its delay and after its life. */
export function effectAt(cue: EffectCue, ageMs: number): EffectPose | null {
  const spec = EFFECTS[cue.name]
  const t = ageMs - (cue.delayMs ?? 0)
  const life = cue.lifeMs ?? spec.lifeMs
  if (t < 0 || t >= life) return null
  const sec = t / 1000
  const progress = t / life
  let dx = (cue.vx ?? 0) * sec
  let dy = (cue.vy ?? spec.vy) * sec
  if (cue.orbit) {
    const angle = cue.orbit.phase + sec * Math.PI * 2
    dx += Math.cos(angle) * cue.orbit.radius
    dy += Math.sin(angle) * cue.orbit.radius * 0.4 // flattened, like a halo seen from the side
  }
  if (cue.name === 'cloud') dy += Math.round(Math.sin(sec * 9)) // bobs a pixel
  const fading = spec.fade > 0 && progress > 1 - spec.fade
  return {
    dx,
    dy,
    frame: Math.floor(sec * spec.fps) % spec.frames,
    alpha: fading ? (1 - progress) / spec.fade : 1,
    scale: 1 + (spec.grow - 1) * progress,
  }
}

/** Whether a cued effect is over: past its delay and its life. */
export function effectDone(cue: EffectCue, ageMs: number): boolean {
  return ageMs - (cue.delayMs ?? 0) >= (cue.lifeMs ?? EFFECTS[cue.name].lifeMs)
}
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/render/effects`
Expected: PASS.

- [ ] **Step 6: The effect layer (Pixi)**

Create `src/render/effects/effectLayer.ts`:

```ts
import { Container, Sprite, Texture } from 'pixi.js'
import { drawParts } from '../sprites/pixelKit'
import { EFFECT_NAMES, EFFECTS, effectFrameParts, type EffectName } from './effectArt'
import { effectAt, effectDone, type EffectCue } from './effectMotion'

/** At most this many effects show at once; the oldest goes first. */
export const MAX_LIVE_EFFECTS = 64

interface Live {
  cue: EffectCue
  at: number
  groundY: number
  sprite: Sprite
}

/**
 * Shows cued effects above the characters and below the name plates:
 * code-painted frames (painted once), pooled sprites, crisp pixels at the
 * sprite scale. Does nothing while no effect is live.
 */
export class EffectLayer {
  private layer: Container
  private scale: number
  private frames: Record<EffectName, Texture[]>
  private live: Live[] = []
  private pool: Sprite[] = []

  constructor(layer: Container, scale: number) {
    this.layer = layer
    this.scale = scale
    this.frames = Object.fromEntries(EFFECT_NAMES.map((name) => [name, paintFrames(name)])) as Record<
      EffectName,
      Texture[]
    >
  }

  /** Shows a cue; `groundY` is the stage y its `rise` counts up from. */
  spawn(cue: EffectCue, groundY: number, now: number): void {
    if (this.live.length >= MAX_LIVE_EFFECTS) this.release(0)
    const sprite = this.pool.pop() ?? new Sprite()
    sprite.anchor.set(0.5)
    sprite.visible = false
    this.layer.addChild(sprite)
    this.live.push({ cue, at: now, groundY, sprite })
  }

  update(now: number): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const fx = this.live[i]
      if (!fx) continue
      const age = now - fx.at
      if (effectDone(fx.cue, age)) {
        this.release(i)
        continue
      }
      const pose = effectAt(fx.cue, age)
      if (!pose) {
        fx.sprite.visible = false // still waiting out its delay
        continue
      }
      const textures = this.frames[fx.cue.name]
      fx.sprite.texture = textures[pose.frame] ?? textures[0] ?? Texture.EMPTY
      fx.sprite.visible = true
      fx.sprite.alpha = pose.alpha
      fx.sprite.scale.set(this.scale * pose.scale)
      fx.sprite.position.set(
        Math.round(fx.cue.x + pose.dx * this.scale),
        Math.round(fx.groundY + (pose.dy - fx.cue.rise) * this.scale),
      )
    }
  }

  destroy(): void {
    for (const fx of this.live) fx.sprite.destroy()
    for (const sprite of this.pool) sprite.destroy()
    for (const textures of Object.values(this.frames)) for (const t of textures) t.destroy(true)
    this.live = []
    this.pool = []
  }

  private release(index: number): void {
    const [fx] = this.live.splice(index, 1)
    if (!fx) return
    this.layer.removeChild(fx.sprite)
    this.pool.push(fx.sprite)
  }
}

/** One texture per frame, painted with the same pixel kit as the characters. */
function paintFrames(name: EffectName): Texture[] {
  const { w, h, frames } = EFFECTS[name]
  return Array.from({ length: frames }, (_, f) => {
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2d canvas context unavailable')
    drawParts(ctx, effectFrameParts(name, f))
    return Texture.from(canvas)
  })
}
```

(Nearest-neighbor sampling comes from `TextureSource.defaultOptions.scaleMode = 'nearest'`, set in `createStage` before any texture exists.)

- [ ] **Step 7: Add the layer to the stage**

In `src/render/stage.ts`, add to the `Stage` interface after `avatarLayer`:

```ts
  /** Sparks, hearts, the fight cloud and smoke: above the characters, below the name plates. */
  effectLayer: Container
```

In `createStage`, add `const effectLayer = new Container()` after the avatar layer, change `app.stage.addChild(avatarLayer, labelLayer, bubbleLayer)` to `app.stage.addChild(avatarLayer, effectLayer, labelLayer, bubbleLayer)`, and add `effectLayer,` to the returned object.

- [ ] **Step 8: Typecheck and commit**

Run: `npm test && npx tsc -b`
Expected: PASS.

```bash
git add src/render/effects src/render/stage.ts
git commit -m "feat: effect layer with sparks, hearts, the fight cloud and smoke"
```

---

### Task 5: Solo emotes in the state machine

**Files:**
- Create: `src/interactions/emotes.ts`, `src/interactions/emotes.test.ts`
- Modify: `src/avatars/stateMachine.ts`, `src/avatars/chooser.ts`
- Test: `src/avatars/stateMachine.test.ts`, `src/avatars/chooser.test.ts`

**Interfaces:**
- Consumes: `AnimName` rows `clap`, `wave`, `dance`, `smoke`, `bong` (Task 2); `EffectCue` (Task 4).
- Produces:
  - `AvatarStateName` gains `'emote'`; `Snapshot.emoteStarted: AnimName | null` (the anim, on the one update where an emote begins).
  - `AvatarStateMachine.onEmote(anim: AnimName, durationSec: number, opts?: { delaySec?: number; turnEverySec?: number }): boolean`.
  - `type EmoteName = 'clap' | 'wave' | 'dance' | 'smoke' | 'bong'`, `EMOTES: Record<EmoteName, { anim; seconds; turnEverySec? }>`, `smokeEmote(args): 'smoke' | 'bong'`, `isSmoke(name): boolean`, `SESH_RIPPLE_SEC = 1.2`, `MOUTH_X = 3`, `exhaleCues(emote: 'smoke' | 'bong', mouthX: number, facing: 1 | -1): EffectCue[]`.

- [ ] **Step 1: Write the failing tests**

Create `src/interactions/emotes.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { ANIMATIONS } from '../render/sprites/contract'
import { EMOTES, exhaleCues, isSmoke, smokeEmote } from './emotes'

describe('emotes', () => {
  it('plays each emote for its spec length; smoke and bong play their row exactly once', () => {
    expect(EMOTES.clap).toEqual({ anim: 'clap', seconds: 2 })
    expect(EMOTES.wave).toEqual({ anim: 'wave', seconds: 2 })
    expect(EMOTES.dance).toEqual({ anim: 'dance', seconds: 3, turnEverySec: 0.5 })
    for (const name of ['smoke', 'bong'] as const) {
      expect(EMOTES[name].seconds).toBe(ANIMATIONS[name].frames / ANIMATIONS[name].fps)
    }
  })

  it('smokes a joint, or the bong when the first word is bong', () => {
    expect(smokeEmote([])).toBe('smoke')
    expect(smokeEmote(['BONG', 'please'])).toBe('bong')
    expect(smokeEmote(['weed'])).toBe('smoke')
    expect(isSmoke('bong') && isSmoke('smoke') && !isSmoke('dance')).toBe(true)
  })

  it('puffs smoke from the mouth on the exhale, drifting the way the character faces', () => {
    const joint = exhaleCues('smoke', 500, -1)
    expect(joint.map((c) => c.delayMs)).toEqual([2_700, 2_950, 3_200])
    expect(joint.every((c) => c.name === 'smoke' && c.x === 500 && c.vx === -6 && c.rise === 25)).toBe(true)
    expect(exhaleCues('bong', 500, 1)).toHaveLength(4)
  })
})
```

Add to the end of `src/avatars/stateMachine.test.ts`:

```ts
describe('emotes', () => {
  /** Walked in and standing still. */
  const settled = (seed = 1) => {
    const m = machine(seed)
    runUntil(m, 'idle')
    return m
  }

  it('plays an emote where it stands for its duration, then goes back to idle', () => {
    const m = settled()
    const x = m.update(0).x
    expect(m.onEmote('clap', 2)).toBe(true)
    const first = m.update(1 / 60)
    expect(first).toMatchObject({ state: 'emote', anim: 'clap', emoteStarted: 'clap' })
    expect(m.update(1 / 60).emoteStarted).toBeNull() // reported once
    run(m, 1.8, (s) => {
      expect(s.state).toBe('emote')
      expect(s.x).toBe(x)
    })
    expect(run(m, 0.3).state).toBe('idle')
  })

  it('turns around every half second while dancing', () => {
    const m = settled()
    m.onEmote('dance', 3, { turnEverySec: 0.5 })
    const facings: number[] = []
    run(m, 2.9, (s) => facings.push(s.facing))
    expect(facings.filter((f, i) => i > 0 && f !== facings[i - 1])).toHaveLength(5)
  })

  it('stands a seated lurker up to play it', () => {
    const m = settled()
    m.onLurk()
    expect(m.update(1 / 60).state).toBe('sit')
    expect(m.onEmote('wave', 2)).toBe(true)
    expect(m.update(1 / 60).state).toBe('emote')
  })

  it('waits for the walk-in to finish, then plays', () => {
    const m = machine()
    expect(m.onEmote('dance', 3, { turnEverySec: 0.5 })).toBe(true)
    expect(m.update(1 / 60).state).toBe('entering')
    expect(runUntil(m, 'emote').anim).toBe('dance')
  })

  it('ignores emotes while jumping, walking off or already emoting', () => {
    const jumping = settled()
    jumping.onJump()
    jumping.update(1 / 60)
    expect(jumping.onEmote('clap', 2)).toBe(false)
    const emoting = settled()
    emoting.onEmote('clap', 2)
    expect(emoting.onEmote('wave', 2)).toBe(false)
    expect(emoting.update(1 / 60).anim).toBe('clap')
    const leaving = settled()
    leaving.beginLeave()
    expect(leaving.onEmote('clap', 2)).toBe(false)
  })

  it('waits out a delay first (the !sesh ripple)', () => {
    const m = settled()
    expect(m.onEmote('smoke', 4, { delaySec: 1 })).toBe(true)
    expect(run(m, 0.9).state).not.toBe('emote')
    expect(run(m, 0.2).state).toBe('emote')
  })

  it('skips crowd reactions while emoting, and drops one that was rippling in', () => {
    const m = settled()
    m.onReact('cheer', 2, 0.5)
    m.onEmote('clap', 2)
    m.onReact('sad', 2)
    run(m, 1, (s) => expect(s.anim).toBe('clap'))
  })

  it('keeps emoting through a chat message, and sits afterwards on !lurk', () => {
    const m = settled()
    m.onEmote('wave', 2)
    m.onMessage()
    m.onLurk()
    expect(m.update(1 / 60).state).toBe('emote')
    expect(run(m, 2.1).state).toBe('sit')
  })

  it('ends the emote on !jump and lands back in idle', () => {
    const m = settled()
    m.onEmote('dance', 3)
    m.onJump()
    expect(m.update(1 / 60).state).toBe('jump')
    expect(runUntil(m, 'idle').state).toBe('idle')
  })
})
```

Add to `describe('choiceAction', ...)` in `src/avatars/chooser.test.ts`:

```ts
  it('swaps an emoting character without a hop, so the emote carries on', () => {
    expect(choiceAction('emote')).toBe('swap-only')
  })
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/interactions src/avatars/stateMachine.test.ts src/avatars/chooser.test.ts`
Expected: FAIL (no `./emotes`, no `onEmote`, `'emote'` is not a state).

- [ ] **Step 3: The emote table**

Create `src/interactions/emotes.ts`:

```ts
import type { EffectCue } from '../render/effects/effectMotion'
import type { AnimName } from '../render/sprites/contract'

export type EmoteName = 'clap' | 'wave' | 'dance' | 'smoke' | 'bong'

export interface EmoteSpec {
  anim: AnimName
  seconds: number
  /** Turns around this often while it plays (the dance). */
  turnEverySec?: number
}

/** The solo emotes; smoke and bong last exactly one pass of their play-once row. */
export const EMOTES: Record<EmoteName, EmoteSpec> = {
  clap: { anim: 'clap', seconds: 2 },
  wave: { anim: 'wave', seconds: 2 },
  dance: { anim: 'dance', seconds: 3, turnEverySec: 0.5 },
  smoke: { anim: 'smoke', seconds: 4 },
  bong: { anim: 'bong', seconds: 4 },
}

/** `!sesh` starts everyone's smoke within this many seconds of each other. */
export const SESH_RIPPLE_SEC = 1.2
/** The mouth is this far in front of a character's center, in frame px. */
export const MOUTH_X = 3

/** `!smoke bong` smokes the bong; any other words after `!smoke` are ignored. */
export function smokeEmote(args: readonly string[]): 'smoke' | 'bong' {
  return args[0]?.toLowerCase() === 'bong' ? 'bong' : 'smoke'
}

export function isSmoke(name: EmoteName): name is 'smoke' | 'bong' {
  return name === 'smoke' || name === 'bong'
}

/** Smoke puffs for the exhale (the last two frames, from 2.7 s in), drifting the way the character faces. */
export function exhaleCues(emote: 'smoke' | 'bong', mouthX: number, facing: 1 | -1): EffectCue[] {
  const delays = emote === 'bong' ? [2_700, 2_850, 3_000, 3_150] : [2_700, 2_950, 3_200]
  return delays.map((delayMs) => ({ name: 'smoke', x: mouthX, rise: 25, delayMs, vx: facing * 6 }))
}
```

- [ ] **Step 4: The `emote` state**

In `src/avatars/stateMachine.ts`:

Add `| 'emote'` to `AvatarStateName` (after `'sit'`). (`AnimName` is already imported as a type.)

Add to `Snapshot`:

```ts
  /** The anim of an emote that began on this update, else null: when to cue its effects. */
  emoteStarted: AnimName | null
```

Add after the `ResumeState` interface:

```ts
export interface EmoteOptions {
  /** Waits this long before starting (the !sesh ripple). */
  delaySec?: number
  /** Turns around this often while it plays. */
  turnEverySec?: number
}

interface EmotePlan {
  anim: AnimName
  duration: number
  turnEverySec: number
  /** Seconds still to wait before it starts. */
  delay: number
}
```

Add these fields after `sitPending`:

```ts
  /** The emote playing now (state 'emote'). */
  private emote: EmotePlan | null = null
  /** An emote waiting for the walk-in to end, or for its delay. */
  private pendingEmote: EmotePlan | null = null
  private turnTimer = 0
  private emoteStarted: AnimName | null = null
```

Update the class doc comment's diagram with:

```
 *   idle/wander/talk/react/sit --emote--> emote --timer--> idle (or sit when !lurk waits)
 *   entering --emote--> emote once it arrives
```

In `onJump`, replace the `this.resume = ...` statement with:

```ts
    // a seated lurker stands up for the jump and lands on its feet; a jump ends an emote
    this.resume =
      this.stateName === 'sit' || this.stateName === 'emote'
        ? { state: 'idle', timer: range(this.rng, IDLE_SECS[0], IDLE_SECS[1]), dir: this.dir }
        : { state: this.stateName as ResumeState['state'], timer: this.timer, dir: this.dir }
    this.emote = null
```

In `onLurk`, add `case 'emote':` next to `case 'react':` (it sits once the emote ends).

Add after `onUnlurk`:

```ts
  /**
   * A solo emote for durationSec. Plays from idle, wander, talk, react and
   * sit (standing up); waits for a walk-in to finish, or for opts.delaySec.
   * False, and nothing changes, while jumping, leaving or already emoting.
   */
  onEmote(anim: AnimName, durationSec: number, opts: EmoteOptions = {}): boolean {
    const plan: EmotePlan = {
      anim,
      duration: durationSec,
      turnEverySec: opts.turnEverySec ?? 0,
      delay: opts.delaySec ?? 0,
    }
    if (this.stateName === 'entering') {
      this.pendingEmote = plan
      return true
    }
    if (!this.canEmote()) return false
    if (plan.delay > 0) this.pendingEmote = plan
    else this.startEmote(plan)
    return true
  }

  private canEmote(): boolean {
    return (
      this.stateName === 'idle' ||
      this.stateName === 'wander' ||
      this.stateName === 'talk' ||
      this.stateName === 'react' ||
      this.stateName === 'sit'
    )
  }

  private startEmote(plan: EmotePlan): void {
    this.stateName = 'emote'
    this.emote = plan
    this.timer = plan.duration
    this.turnTimer = plan.turnEverySec
    this.pending = null // a rippling crowd reaction never cuts it short
    this.emoteStarted = plan.anim
  }

  /** Counts down a delayed emote once the walk-in is over; it starts if the character still can. */
  private tickPendingEmote(dtSec: number): void {
    const plan = this.pendingEmote
    if (!plan || this.stateName === 'entering') return
    plan.delay -= dtSec
    if (plan.delay > 0) return
    this.pendingEmote = null
    if (this.canEmote()) this.startEmote(plan)
  }
```

In `beginLeave`, add `this.emote = null` and `this.pendingEmote = null` next to `this.pending = null`.

In `update`, add `this.tickPendingEmote(dtSec)` right after `this.tickPending(dtSec)`, add this case to the switch (before `case 'sit':`):

```ts
      case 'emote': {
        this.timer -= dtSec
        const turn = this.emote?.turnEverySec ?? 0
        if (turn > 0) {
          this.turnTimer -= dtSec
          if (this.turnTimer <= 0) {
            this.facing = this.facing === 1 ? -1 : 1
            this.turnTimer += turn
          }
        }
        if (this.timer <= 0) {
          this.emote = null
          this.settle()
        }
        break
      }
```

and replace the final `return { ... }` with:

```ts
    const emoteStarted = this.emoteStarted
    this.emoteStarted = null
    return {
      x: this.x,
      jumpOffsetY,
      anim: this.animFor(),
      facing: this.facing,
      state: this.stateName,
      emoteStarted,
    }
```

Replace `settle` with:

```ts
  /** Where a walk-in, talk, reaction, emote or jump ends up: a waiting emote, the seat if `!lurk` waits, or idle. */
  private settle(): void {
    const plan = this.pendingEmote
    if (plan && plan.delay <= 0) {
      this.pendingEmote = null
      this.startEmote(plan)
    } else if (this.sitPending) {
      this.enterSit()
    } else {
      this.enterIdle()
    }
  }
```

In `animFor`, add `case 'emote': return this.emote?.anim ?? 'idle'` before `default`.

In `src/avatars/chooser.ts`, add `state === 'emote' ||` to the `swap-only` condition, and `an emote` to its doc comment list.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/interactions src/avatars`
Expected: PASS.

- [ ] **Step 6: Typecheck and commit**

Run: `npm test && npx tsc -b`
Expected: PASS. (`avatar.ts` reads only `x`, `jumpOffsetY`, `anim`, `facing` and `state`, so the new snapshot field needs nothing there yet.)

```bash
git add src/interactions src/avatars
git commit -m "feat: solo emotes in the avatar state machine"
```

---

### Task 6: Scripted mode in the state machine

**Files:**
- Modify: `src/avatars/stateMachine.ts`, `src/avatars/chooser.ts`, `src/avatars/avatar.ts`
- Test: `src/avatars/stateMachine.test.ts`, `src/avatars/chooser.test.ts`

**Interfaces:**
- Consumes: the `emote` state (Task 5).
- Produces:
  - `AvatarStateName` gains `'scripted'`; `export const WALL_MARGIN = 40`.
  - `Snapshot.hidden: boolean`, `Snapshot.animSpeed: number` (2 while running, else 1).
  - `AvatarStateMachine.where(): { x: number; facing: 1 | -1 }`, `beginScript(): boolean`, `runTo(x: number, speed: number): void`, `face(dir: 1 | -1): void`, `play(anim: AnimName): void`, `setHidden(hidden: boolean): void`, `endScript(): void`.
  - `Avatar.update(dtSec, now): Snapshot` (it returns the snapshot it applied).

- [ ] **Step 1: Write the failing tests**

Add to the end of `src/avatars/stateMachine.test.ts`:

```ts
describe('scripted', () => {
  const settled = (seed = 1) => {
    const m = machine(seed)
    runUntil(m, 'idle')
    return m
  }

  it('runs to a spot at the given speed, facing the way it runs, then stands there', () => {
    const m = settled()
    const from = m.where().x
    const to = from > 960 ? from - 300 : from + 300
    expect(m.beginScript()).toBe(true)
    m.runTo(to, 180)
    const running = m.update(1 / 60)
    expect(running).toMatchObject({ state: 'scripted', anim: 'walk', animSpeed: 2, facing: to > from ? 1 : -1 })
    const there = run(m, 300 / 180 + 0.1)
    expect(there).toMatchObject({ x: to, anim: 'idle', animSpeed: 1, facing: to > from ? 1 : -1 })
  })

  it('faces, plays and hides as told, and shows again when released', () => {
    const m = settled()
    m.beginScript()
    m.face(-1)
    m.play('hug')
    m.setHidden(true)
    expect(m.update(1 / 60)).toMatchObject({ state: 'scripted', facing: -1, anim: 'hug', hidden: true })
    m.endScript()
    expect(m.update(1 / 60)).toMatchObject({ state: 'idle', hidden: false })
  })

  it('ignores !jump, reactions and emotes, and keeps going through chat', () => {
    const m = settled()
    m.beginScript()
    m.play('hug')
    m.onJump()
    m.onReact('cheer', 2)
    expect(m.onEmote('clap', 2)).toBe(false)
    m.onMessage()
    run(m, 1, (s) => expect(s).toMatchObject({ state: 'scripted', anim: 'hug', jumpOffsetY: 0 }))
  })

  it('sits once released when !lurk came mid-script', () => {
    const m = settled()
    m.beginScript()
    m.onLurk()
    m.endScript()
    expect(m.update(1 / 60).state).toBe('sit')
  })

  it('can be sent away mid-script, shown again, and never starts while walking off', () => {
    const m = settled()
    m.beginScript()
    m.setHidden(true)
    m.beginLeave()
    expect(m.update(1 / 60)).toMatchObject({ state: 'leaving', hidden: false })
    expect(m.beginScript()).toBe(false)
  })

  it('stands a seated lurker up for its script', () => {
    const m = settled()
    m.onLurk()
    m.update(1 / 60)
    expect(m.beginScript()).toBe(true)
    expect(m.update(1 / 60).state).toBe('scripted')
  })
})
```

Add to `describe('choiceAction', ...)` in `src/avatars/chooser.test.ts`:

```ts
  it('swaps a character mid-interaction without a hop (jumps are ignored while scripted)', () => {
    expect(choiceAction('scripted')).toBe('swap-only')
  })
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/avatars/stateMachine.test.ts src/avatars/chooser.test.ts`
Expected: FAIL (`where`, `beginScript` don't exist; `'scripted'` is not a state).

- [ ] **Step 3: The `scripted` state**

In `src/avatars/stateMachine.ts`:

Add `| 'scripted'` to `AvatarStateName` (after `'emote'`). Change `const WALL_MARGIN = 40` to:

```ts
/** Characters keep this far from the stage edges (the choreographer uses it too). */
export const WALL_MARGIN = 40
```

Add to `Snapshot`:

```ts
  /** A fight's dust cloud hides the character, its shadow and its name plate. */
  hidden: boolean
  /** Multiplies the row's fps: running to meet someone plays the walk at double speed. */
  animSpeed: number
```

Add after `EmotePlan`:

```ts
/** What a choreographer told a scripted character to do. */
type ScriptStep = { kind: 'run'; x: number; speed: number } | { kind: 'hold'; anim: AnimName }
```

Add fields after `emoteStarted`:

```ts
  private scriptStep: ScriptStep = { kind: 'hold', anim: 'idle' }
  private hidden = false
```

Update the class doc comment's diagram with:

```
 *   any but leaving --beginScript--> scripted (a choreographer runs it) --endScript--> idle (or sit)
```

Add after `onEmote` and its helpers:

```ts
  /** Where the character stands and which way it faces. */
  where(): { x: number; facing: 1 | -1 } {
    return { x: this.x, facing: this.facing }
  }

  /**
   * Hands the character to a choreographer: it stands still until told to
   * run, face, play or hide. A pending emote or reaction is dropped; a
   * `!lurk` that comes in still sits it once released. False while walking off.
   */
  beginScript(): boolean {
    if (this.stateName === 'leaving' || this.stateName === 'gone') return false
    this.stateName = 'scripted'
    this.scriptStep = { kind: 'hold', anim: 'idle' }
    this.hidden = false
    this.resume = null
    this.pending = null
    this.emote = null
    this.pendingEmote = null
    return true
  }

  /** Scripted: run to x at `speed` px/s, facing the way it runs; it stands there once it arrives. */
  runTo(x: number, speed: number): void {
    if (this.stateName === 'scripted') this.scriptStep = { kind: 'run', x, speed }
  }

  face(dir: 1 | -1): void {
    if (this.stateName === 'scripted') this.facing = dir
  }

  /** Scripted: stand still showing `anim` until told otherwise. */
  play(anim: AnimName): void {
    if (this.stateName === 'scripted') this.scriptStep = { kind: 'hold', anim }
  }

  setHidden(hidden: boolean): void {
    if (this.stateName === 'scripted') this.hidden = hidden
  }

  /** Hands the character back: idle, or seated if `!lurk` came in meanwhile. */
  endScript(): void {
    if (this.stateName !== 'scripted') return
    this.hidden = false
    this.settle()
  }
```

In `onJump`, change the first line to:

```ts
    if (this.stateName === 'leaving' || this.stateName === 'gone' || this.stateName === 'scripted') return
```

In `onLurk`, add `case 'scripted':` next to `case 'emote':`.

In `beginLeave`, add `this.hidden = false`.

In `update`, add this case (before `case 'sit':`):

```ts
      case 'scripted': {
        const step = this.scriptStep
        if (step.kind === 'run') {
          this.moveToward(step.x, step.speed, dtSec)
          if (this.x === step.x) this.scriptStep = { kind: 'hold', anim: 'idle' }
        }
        break
      }
```

and add these two fields to the returned snapshot (next to `emoteStarted`):

```ts
      hidden: this.stateName === 'scripted' && this.hidden,
      animSpeed: this.stateName === 'scripted' && this.scriptStep.kind === 'run' ? 2 : 1,
```

In `animFor`, add before `default`:

```ts
      case 'scripted':
        return this.scriptStep.kind === 'run' ? 'walk' : this.scriptStep.anim
```

In `src/avatars/chooser.ts`, add `state === 'scripted' ||` to the `swap-only` condition and `an interaction` to its doc comment list.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/avatars`
Expected: PASS.

- [ ] **Step 5: Draw hidden and running characters**

In `src/avatars/avatar.ts`:

Add a field after `satAt`:

```ts
  /** The current row's speed multiplier (2 while running to meet someone). */
  private animSpeed = 1
```

Add `type Snapshot` to the `./stateMachine` import and change `update` to return it: `update(dtSec: number, now: number): Snapshot {` and `return snap` as its last line.

After the `this.label.alpha = ...` line add:

```ts
    // a fight's dust cloud hides both fighters and their names; bubbles still show
    this.container.visible = !snap.hidden
    this.label.visible = !snap.hidden
```

Replace the `if (snap.anim !== this.currentAnim) { ... }` block with:

```ts
    if (snap.anim !== this.currentAnim || snap.animSpeed !== this.animSpeed) {
      if (snap.anim !== this.currentAnim) {
        if (this.currentAnim) {
          const prev = this.groups[this.currentAnim]
          prev.group.visible = false
          for (const s of prev.sprites) s.stop()
        }
        const next = this.groups[snap.anim]
        next.group.visible = true
        for (const s of next.sprites) s.gotoAndPlay(0)
        this.currentAnim = snap.anim
      }
      const speed = (ANIMATIONS[snap.anim].fps / 60) * snap.animSpeed
      for (const s of this.groups[snap.anim].sprites) s.animationSpeed = speed
      this.animSpeed = snap.animSpeed
    }
```

In `setLayers`, after `this.currentAnim = null`, add `this.animSpeed = 1 // rebuilt sprites start at their row's speed`.

- [ ] **Step 6: Typecheck and commit**

Run: `npm test && npx tsc -b`
Expected: PASS.

```bash
git add src/avatars
git commit -m "feat: scripted mode so a choreographer can drive a character"
```

---

### Task 7: Opt-outs and fight records

**Files:**
- Create: `src/interactions/interactionStore.ts`, `src/interactions/interactionStore.test.ts`

**Interfaces:**
- Produces: `OPT_OUTS_KEY = 'chat-avatars:nointeract:v1'`, `FIGHTS_KEY = 'chat-avatars:fights:v1'`, `interface FightRecord { wins: number; losses: number }`, `class InteractionStore { constructor(storage: KeyValueStorage, now?: () => number); isOptedOut(login): boolean; setOptedOut(login, optedOut: boolean): void; record(login): FightRecord; addResult(winner, loser): FightRecord /* the winner's, after */ }`.

- [ ] **Step 1: Write the failing tests**

Create `src/interactions/interactionStore.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { MAX_REMEMBERED } from '../avatars/choiceStore'
import { MemoryStorage } from '../test/fakes'
import { FIGHTS_KEY, InteractionStore, OPT_OUTS_KEY } from './interactionStore'

describe('InteractionStore', () => {
  it('remembers an opt-out across restarts, and forgets it on !interact', () => {
    const storage = new MemoryStorage()
    new InteractionStore(storage).setOptedOut('bob', true)
    const reopened = new InteractionStore(storage)
    expect(reopened.isOptedOut('bob')).toBe(true)
    expect(reopened.isOptedOut('alice')).toBe(false)
    reopened.setOptedOut('bob', false)
    expect(new InteractionStore(storage).isOptedOut('bob')).toBe(false)
  })

  it('counts wins and losses, returns the winner record, and keeps them across restarts', () => {
    const storage = new MemoryStorage()
    const store = new InteractionStore(storage)
    expect(store.record('alice')).toEqual({ wins: 0, losses: 0 })
    expect(store.addResult('alice', 'bob')).toEqual({ wins: 1, losses: 0 })
    expect(store.addResult('bob', 'alice')).toEqual({ wins: 1, losses: 1 })
    const reopened = new InteractionStore(storage)
    expect(reopened.record('alice')).toEqual({ wins: 1, losses: 1 })
    expect(reopened.record('bob')).toEqual({ wins: 1, losses: 1 })
  })

  it('starts empty from corrupted or foreign data, skipping unusable entries', () => {
    const storage = new MemoryStorage()
    storage.setItem(OPT_OUTS_KEY, '{nope')
    storage.setItem(
      FIGHTS_KEY,
      JSON.stringify({ alice: { w: 2, l: 1, at: 5 }, bob: { w: -1, l: 0, at: 5 }, carol: { w: 1.5, l: 0, at: 5 }, dave: 'x' }),
    )
    const store = new InteractionStore(storage)
    expect(store.isOptedOut('anyone')).toBe(false)
    expect(store.record('alice')).toEqual({ wins: 2, losses: 1 })
    expect(store.record('bob')).toEqual({ wins: 0, losses: 0 })
    expect(store.record('carol')).toEqual({ wins: 0, losses: 0 })
    expect(new InteractionStore(new MemoryStorage()).record('x')).toEqual({ wins: 0, losses: 0 })
  })

  it(`remembers at most ${MAX_REMEMBERED} viewers each, forgetting the least recently changed`, () => {
    let t = 0
    const store = new InteractionStore(new MemoryStorage(), () => t++)
    for (let i = 0; i <= MAX_REMEMBERED; i++) store.setOptedOut(`viewer${i}`, true)
    expect(store.isOptedOut('viewer0')).toBe(false)
    expect(store.isOptedOut(`viewer${MAX_REMEMBERED}`)).toBe(true)
    for (let i = 0; i <= MAX_REMEMBERED; i++) store.addResult(`w${i}`, 'loser')
    expect(store.record('w0')).toEqual({ wins: 0, losses: 0 })
    expect(store.record('loser').losses).toBe(MAX_REMEMBERED + 1)
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/interactions/interactionStore.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: The store**

Create `src/interactions/interactionStore.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/interactions/interactionStore.test.ts`
Expected: PASS. (In the cap test the loser is re-inserted on every fight, so it is never the oldest and survives.)

- [ ] **Step 5: Commit**

```bash
git add src/interactions
git commit -m "feat: remember interaction opt-outs and fight records"
```

---

### Task 8: Targets and the rules for pair commands

**Files:**
- Create: `src/interactions/target.ts`, `src/interactions/target.test.ts`, `src/interactions/gate.ts`, `src/interactions/gate.test.ts`

**Interfaces:**
- Produces:
  - `parseTarget(args: readonly string[]): string | null`, `findTarget<T extends { login: string; displayName: string }>(name: string, onScreen: Iterable<T>): T | null`.
  - `type PairKind = 'highfive' | 'hug' | 'fight'`, `PAIR_KINDS`, `type Refusal = 'senderOptedOut' | 'senderBusy' | 'noName' | 'cooldown' | 'missing' | 'self' | 'lurking' | 'optedOut' | 'busy' | 'targetCooldown'`, `interface TargetFacts { login; lurking; optedOut; busy }`, `interface GateFacts { sender; senderOptedOut; senderBusy; name: string | null; target: TargetFacts | null }`.
  - `class InteractionGate { constructor(senderCooldownMs: number, targetCooldownMs: number); check(facts: GateFacts, now: number): Refusal | null; senderActed(sender: string, now: number): void; targeted(logins: readonly string[], now: number): void }`, `refusalText(reason: Refusal, command: string, name: string): string | null`.

- [ ] **Step 1: Write the failing tests**

Create `src/interactions/target.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { findTarget, parseTarget } from './target'

describe('parseTarget', () => {
  it('takes the first word, without its leading @s, lowercased', () => {
    expect(parseTarget(['@Bob', 'hi'])).toBe('bob')
    expect(parseTarget(['@@Bob'])).toBe('bob')
    expect(parseTarget(['BOB'])).toBe('bob')
  })

  it('is null when no name was given', () => {
    expect(parseTarget([])).toBeNull()
    expect(parseTarget(['@'])).toBeNull()
    expect(parseTarget(['@@'])).toBeNull()
  })
})

describe('findTarget', () => {
  const onScreen = [
    { login: 'xx_ann', displayName: 'Ann' },
    { login: 'ann', displayName: 'NotAnn' },
    { login: 'bob_1', displayName: 'Bobby' },
  ]

  it('matches a login before a display name', () => {
    expect(findTarget('ann', onScreen)?.login).toBe('ann')
  })

  it('falls back to the display name, ignoring its case', () => {
    expect(findTarget('bobby', onScreen)?.login).toBe('bob_1')
    expect(findTarget('notann', onScreen)?.login).toBe('ann')
  })

  it('is null when nobody on screen matches', () => {
    expect(findTarget('carol', onScreen)).toBeNull()
    expect(findTarget('carol', [])).toBeNull()
  })
})
```

Create `src/interactions/gate.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { InteractionGate, refusalText, type GateFacts, type TargetFacts } from './gate'

const bob: TargetFacts = { login: 'bob', lurking: false, optedOut: false, busy: false }
const facts = (over: Partial<GateFacts> = {}): GateFacts => ({
  sender: 'alice',
  senderOptedOut: false,
  senderBusy: false,
  name: 'bob',
  target: bob,
  ...over,
})

describe('InteractionGate', () => {
  it('lets a pair command through when every rule holds', () => {
    expect(new InteractionGate(15_000, 30_000).check(facts(), 0)).toBeNull()
  })

  it('checks the rules in order', () => {
    const gate = new InteractionGate(15_000, 30_000)
    const bad: TargetFacts = { login: 'bob', lurking: true, optedOut: true, busy: true }
    expect(gate.check(facts({ senderOptedOut: true, senderBusy: true, name: null }), 0)).toBe('senderOptedOut')
    expect(gate.check(facts({ senderBusy: true, name: null }), 0)).toBe('senderBusy')
    expect(gate.check(facts({ name: null, target: null }), 0)).toBe('noName')
    expect(gate.check(facts({ target: null }), 0)).toBe('missing')
    expect(gate.check(facts({ target: { ...bad, login: 'alice' } }), 0)).toBe('self')
    expect(gate.check(facts({ target: bad }), 0)).toBe('lurking')
    expect(gate.check(facts({ target: { ...bad, lurking: false } }), 0)).toBe('optedOut')
    expect(gate.check(facts({ target: { ...bad, lurking: false, optedOut: false } }), 0)).toBe('busy')
  })

  it('starts the sender cooldown only when told to, and it outranks a missing target', () => {
    const gate = new InteractionGate(15_000, 30_000)
    expect(gate.check(facts(), 0)).toBeNull()
    expect(gate.check(facts(), 1)).toBeNull() // checking never starts it
    gate.senderActed('alice', 1_000)
    expect(gate.check(facts({ target: null }), 15_999)).toBe('cooldown')
    expect(gate.check(facts({ sender: 'carol' }), 15_999)).toBeNull() // per sender
    expect(gate.check(facts(), 16_000)).toBeNull()
  })

  it('keeps everyone in an interaction untargetable for the target cooldown', () => {
    const gate = new InteractionGate(15_000, 30_000)
    gate.targeted(['alice', 'bob'], 0)
    expect(gate.check(facts({ sender: 'carol' }), 29_999)).toBe('targetCooldown')
    const alice: TargetFacts = { ...bob, login: 'alice' }
    expect(gate.check(facts({ sender: 'carol', name: 'alice', target: alice }), 29_999)).toBe('targetCooldown')
    expect(gate.check(facts({ sender: 'carol' }), 30_000)).toBeNull()
  })

  it('turns a cooldown off at 0', () => {
    const gate = new InteractionGate(0, 0)
    gate.senderActed('alice', 0)
    gate.targeted(['bob'], 0)
    expect(gate.check(facts(), 0)).toBeNull()
  })
})

describe('refusalText', () => {
  it('tells the sender why, naming the target', () => {
    expect(refusalText('senderOptedOut', 'hug', 'Bob')).toBe('you opted out (!interact)')
    expect(refusalText('noName', 'highfive', '')).toBe('who? try !highfive @name')
    expect(refusalText('missing', 'hug', 'bob')).toBe("bob isn't here")
    expect(refusalText('lurking', 'hug', 'Bob')).toBe('Bob is lurking')
    expect(refusalText('optedOut', 'hug', 'Bob')).toBe('Bob opted out')
    expect(refusalText('busy', 'hug', 'Bob')).toBe('Bob is busy')
  })

  it('stays silent for cooldowns, yourself and your own interaction', () => {
    for (const reason of ['cooldown', 'targetCooldown', 'self', 'senderBusy'] as const) {
      expect(refusalText(reason, 'hug', 'Bob')).toBeNull()
    }
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/interactions/target.test.ts src/interactions/gate.test.ts`
Expected: FAIL (modules missing).

- [ ] **Step 3: Targets**

Create `src/interactions/target.ts`:

```ts
/** `!hug @Bob` -> 'bob': the first word after the command without its leading @s, lowercased; null if none. */
export function parseTarget(args: readonly string[]): string | null {
  const word = (args[0] ?? '').replace(/^@+/, '').toLowerCase()
  return word.length > 0 ? word : null
}

export interface Named {
  login: string
  displayName: string
}

/** The on-screen character a typed name means: a login match first, then a display name match. */
export function findTarget<T extends Named>(name: string, onScreen: Iterable<T>): T | null {
  let byDisplayName: T | null = null
  for (const character of onScreen) {
    if (character.login === name) return character
    if (byDisplayName === null && character.displayName.toLowerCase() === name) byDisplayName = character
  }
  return byDisplayName
}
```

- [ ] **Step 4: The gate**

Create `src/interactions/gate.ts`:

```ts
export type PairKind = 'highfive' | 'hug' | 'fight'
export const PAIR_KINDS: readonly PairKind[] = ['highfive', 'hug', 'fight']

/** Why a pair command can't happen, in the order the rules are checked. */
export type Refusal =
  | 'senderOptedOut'
  | 'senderBusy'
  | 'noName'
  | 'cooldown'
  | 'missing'
  | 'self'
  | 'lurking'
  | 'optedOut'
  | 'busy'
  | 'targetCooldown'

export interface TargetFacts {
  login: string
  lurking: boolean
  optedOut: boolean
  busy: boolean
}

export interface GateFacts {
  sender: string
  senderOptedOut: boolean
  /** The sender is in an interaction already. */
  senderBusy: boolean
  /** The typed name, or null when none was given. */
  name: string | null
  /** The on-screen character the name matched, or null. */
  target: TargetFacts | null
}

/** Cooldown maps are swept of expired entries once they grow past this. */
const SWEEP_AT = 256

/**
 * The rules for `!highfive`, `!hug` and `!fight`, and both cooldowns: one
 * per sender (started when a high-five or hug starts, or a challenge is
 * sent) and one per target (started for both people when an interaction
 * starts). Checking never starts a cooldown, so a typo locks nobody out.
 */
export class InteractionGate {
  private senderCooldownMs: number
  private targetCooldownMs: number
  private senderAt = new Map<string, number>()
  private targetAt = new Map<string, number>()

  constructor(senderCooldownMs: number, targetCooldownMs: number) {
    this.senderCooldownMs = senderCooldownMs
    this.targetCooldownMs = targetCooldownMs
  }

  /** The first rule the command breaks, or null when it can go ahead. */
  check(f: GateFacts, now: number): Refusal | null {
    if (f.senderOptedOut) return 'senderOptedOut'
    if (f.senderBusy) return 'senderBusy'
    if (f.name === null) return 'noName'
    if (cooling(this.senderAt, f.sender, this.senderCooldownMs, now)) return 'cooldown'
    const t = f.target
    if (!t) return 'missing'
    if (t.login === f.sender) return 'self'
    if (t.lurking) return 'lurking'
    if (t.optedOut) return 'optedOut'
    if (t.busy) return 'busy'
    if (cooling(this.targetAt, t.login, this.targetCooldownMs, now)) return 'targetCooldown'
    return null
  }

  /** A high-five or hug started, or a challenge was sent: the sender's cooldown starts. */
  senderActed(sender: string, now: number): void {
    record(this.senderAt, sender, this.senderCooldownMs, now)
  }

  /** An interaction started: nobody can target any of them for a while. */
  targeted(logins: readonly string[], now: number): void {
    for (const login of logins) record(this.targetAt, login, this.targetCooldownMs, now)
  }
}

function cooling(map: Map<string, number>, login: string, cooldownMs: number, now: number): boolean {
  const at = map.get(login)
  return at !== undefined && now - at < cooldownMs
}

function record(map: Map<string, number>, login: string, cooldownMs: number, now: number): void {
  map.set(login, now)
  if (map.size <= SWEEP_AT) return
  for (const [key, at] of map) if (now - at >= cooldownMs) map.delete(key)
}

/** The bubble over the sender for a refusal (null stays silent); `name` is what to call the target. */
export function refusalText(reason: Refusal, command: string, name: string): string | null {
  switch (reason) {
    case 'senderOptedOut':
      return 'you opted out (!interact)'
    case 'noName':
      return `who? try !${command} @name`
    case 'missing':
      return `${name} isn't here`
    case 'lurking':
      return `${name} is lurking`
    case 'optedOut':
      return `${name} opted out`
    case 'busy':
      return `${name} is busy`
    default:
      return null
  }
}
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/interactions`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/interactions
git commit -m "feat: target matching and the rules for pair commands"
```

---

### Task 9: Fight challenges

**Files:**
- Create: `src/interactions/challenges.ts`, `src/interactions/challenges.test.ts`

**Interfaces:**
- Produces: `interface Challenge { from: string; to: string; expiresAt: number }`, `class ChallengeBook { constructor(timeoutMs: number); challenge(from, to, now): void; acceptNewest(to, now): Challenge | null; take(from, to, now): Challenge | null; prune(now, present: (login: string) => boolean): void; dropFor(login): void; get size(): number }`.

- [ ] **Step 1: Write the failing tests**

Create `src/interactions/challenges.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { ChallengeBook } from './challenges'

describe('ChallengeBook', () => {
  it('lets the target accept within the timeout, once', () => {
    const book = new ChallengeBook(30_000)
    book.challenge('alice', 'bob', 0)
    expect(book.acceptNewest('bob', 29_999)).toEqual({ from: 'alice', to: 'bob', expiresAt: 30_000 })
    expect(book.acceptNewest('bob', 29_999)).toBeNull()
  })

  it('lets a challenge expire', () => {
    const book = new ChallengeBook(30_000)
    book.challenge('alice', 'bob', 0)
    expect(book.acceptNewest('bob', 30_000)).toBeNull()
  })

  it('accepts the newest of several challenges first', () => {
    const book = new ChallengeBook(30_000)
    book.challenge('alice', 'bob', 0)
    book.challenge('carol', 'bob', 1_000)
    expect(book.acceptNewest('bob', 2_000)?.from).toBe('carol')
    expect(book.acceptNewest('bob', 2_000)?.from).toBe('alice')
  })

  it('keeps one challenge per challenger: a new one replaces it and becomes the newest', () => {
    const book = new ChallengeBook(30_000)
    book.challenge('alice', 'bob', 0)
    book.challenge('alice', 'carol', 1_000)
    expect(book.acceptNewest('bob', 2_000)).toBeNull()
    book.challenge('dave', 'carol', 2_000)
    book.challenge('alice', 'carol', 3_000)
    expect(book.acceptNewest('carol', 4_000)?.from).toBe('alice')
  })

  it('takes the challenge when its target fights back', () => {
    const book = new ChallengeBook(30_000)
    book.challenge('alice', 'bob', 0)
    expect(book.take('bob', 'alice', 1)).toBeNull() // bob never challenged alice
    expect(book.take('alice', 'bob', 1)?.from).toBe('alice')
    expect(book.size).toBe(0)
  })

  it('drops challenges from and to someone who opted out, and prunes the expired and the absent', () => {
    const book = new ChallengeBook(30_000)
    book.challenge('alice', 'bob', 0)
    book.challenge('erin', 'alice', 0)
    book.challenge('carol', 'dave', 0)
    book.challenge('frank', 'gina', 10_000)
    book.dropFor('alice')
    expect(book.size).toBe(2)
    book.prune(1, (login) => login !== 'dave')
    expect(book.size).toBe(1)
    book.prune(40_000, () => true)
    expect(book.size).toBe(0)
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/interactions/challenges.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: The book**

Create `src/interactions/challenges.ts`:

```ts
export interface Challenge {
  from: string
  to: string
  expiresAt: number
}

/**
 * Pending `!fight` challenges: one per challenger (a new one replaces it),
 * each waiting timeoutMs for its target to `!accept` or fight back.
 */
export class ChallengeBook {
  private timeoutMs: number
  /** By challenger, oldest first: a replaced challenge moves to the back. */
  private byChallenger = new Map<string, Challenge>()

  constructor(timeoutMs: number) {
    this.timeoutMs = timeoutMs
  }

  get size(): number {
    return this.byChallenger.size
  }

  challenge(from: string, to: string, now: number): void {
    this.byChallenger.delete(from)
    this.byChallenger.set(from, { from, to, expiresAt: now + this.timeoutMs })
  }

  /** `!accept`: takes the newest live challenge to `to`. */
  acceptNewest(to: string, now: number): Challenge | null {
    let newest: Challenge | null = null
    for (const c of this.byChallenger.values()) if (c.to === to && c.expiresAt > now) newest = c
    if (newest) this.byChallenger.delete(newest.from)
    return newest
  }

  /** Fighting back: takes `from`'s live challenge to `to`, if there is one. */
  take(from: string, to: string, now: number): Challenge | null {
    const c = this.byChallenger.get(from)
    if (!c || c.to !== to || c.expiresAt <= now) return null
    this.byChallenger.delete(from)
    return c
  }

  /** Forgets expired challenges and those whose challenger or target has left. */
  prune(now: number, present: (login: string) => boolean): void {
    for (const [from, c] of this.byChallenger) {
      if (c.expiresAt <= now || !present(c.from) || !present(c.to)) this.byChallenger.delete(from)
    }
  }

  /** Drops every challenge from or to `login` (they opted out). */
  dropFor(login: string): void {
    for (const [from, c] of this.byChallenger) if (c.from === login || c.to === login) this.byChallenger.delete(from)
  }
}
```

- [ ] **Step 4: Run the tests and commit**

Run: `npx vitest run src/interactions/challenges.test.ts`
Expected: PASS.

```bash
git add src/interactions
git commit -m "feat: pending fight challenges"
```

---

### Task 10: Interaction timelines

**Files:**
- Create: `src/interactions/timeline.ts`, `src/interactions/timeline.test.ts`

**Interfaces:**
- Consumes: `WALL_MARGIN`, `StripBounds` (Task 6); `EffectCue`, `EffectName` (Task 4); `PairKind` (Task 8); `ANIMATIONS` (Task 2).
- Produces:
  - `GAPS: Record<PairKind, number>` (frame px), `RUN_SPEED = 180`, `ARRIVE_TIMEOUT_SEC = 8`.
  - `meetingSpots(xa, xb, kind, scale, bounds): { a: number; b: number }`.
  - `type ActorStep = { type: 'run'; x } | { type: 'face'; dir: 1 | -1 } | { type: 'play'; anim: AnimName } | { type: 'hide'; hidden: boolean }`.
  - `interface TickOutput { steps: { login: string; step: ActorStep }[]; cues: EffectCue[]; result: { winner: string; loser: string } | null }`.
  - `class Interaction { readonly kind; readonly a; readonly b; constructor(opts: InteractionOptions); get done(): boolean; get logins(): readonly [string, string]; tick(dtSec: number, xOf: (login: string) => number): TickOutput }` with `InteractionOptions { kind; a; b; xa; xb; scale; bounds; rng: () => number }`.

- [ ] **Step 1: Write the failing tests**

Create `src/interactions/timeline.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { PairKind } from './gate'
import { Interaction, meetingSpots, type ActorStep, type TickOutput } from './timeline'

const BOUNDS = { minX: 0, maxX: 1920 }

const make = (kind: PairKind, rng: () => number = () => 0.25) =>
  new Interaction({ kind, a: 'alice', b: 'bob', xa: 400, xb: 1000, scale: 2, bounds: BOUNDS, rng })

interface Frame {
  t: number
  out: TickOutput
  done: boolean
}

/**
 * Runs an interaction in 1/60 s frames. Each actor appears at a run step's
 * target `arriveAfter[login]` seconds after the step (default: next frame).
 */
function play(ia: Interaction, seconds: number, arriveAfter: Record<string, number> = {}): Frame[] {
  const x: Record<string, number> = { alice: 400, bob: 1000 }
  const moving: Record<string, { to: number; at: number }> = {}
  const frames: Frame[] = []
  const dt = 1 / 60
  for (let i = 0; i <= Math.round(seconds * 60); i++) {
    const t = i * dt
    for (const [login, m] of Object.entries(moving)) {
      if (t >= m.at) {
        x[login] = m.to
        delete moving[login]
      }
    }
    const out = ia.tick(i === 0 ? 0 : dt, (login) => x[login] ?? 0)
    for (const { login, step } of out.steps) {
      if (step.type === 'run') moving[login] = { to: step.x, at: t + (arriveAfter[login] ?? dt / 2) }
    }
    frames.push({ t, out, done: ia.done })
  }
  return frames
}

const stepsOf = (frames: Frame[], login: string, type: ActorStep['type']) =>
  frames.flatMap(({ t, out }) =>
    out.steps.filter((s) => s.login === login && s.step.type === type).map((s) => ({ t, step: s.step })),
  )
const cuesOf = (frames: Frame[], name: string) =>
  frames.flatMap(({ t, out }) => out.cues.filter((c) => c.name === name).map((cue) => ({ t, cue })))
const doneAt = (frames: Frame[]) => frames.find((f) => f.done)?.t ?? Number.NaN

describe('meetingSpots', () => {
  it('meets halfway, a gap apart, each on their own side', () => {
    expect(meetingSpots(400, 1000, 'highfive', 2, BOUNDS)).toEqual({ a: 672, b: 728 })
    expect(meetingSpots(1000, 400, 'highfive', 2, BOUNDS)).toEqual({ a: 728, b: 672 })
  })

  it('scales the gap with the sprites, and uses each kind of gap', () => {
    expect(meetingSpots(400, 1000, 'hug', 1, BOUNDS)).toEqual({ a: 692, b: 708 })
    expect(meetingSpots(400, 1000, 'fight', 2, BOUNDS)).toEqual({ a: 688, b: 712 })
  })

  it('keeps both spots off the walls', () => {
    expect(meetingSpots(-60, 10, 'highfive', 2, BOUNDS)).toEqual({ a: 40, b: 96 })
    expect(meetingSpots(1900, 1980, 'highfive', 2, BOUNDS)).toEqual({ a: 1824, b: 1880 })
  })
})

describe('Interaction', () => {
  it('sends both running to their spots first', () => {
    const [first] = play(make('highfive'), 0)
    expect(first?.out.steps).toEqual([
      { login: 'alice', step: { type: 'run', x: 672 } },
      { login: 'bob', step: { type: 'run', x: 728 } },
    ])
  })

  it('has the first to arrive wait, facing the other, until both are there', () => {
    const frames = play(make('hug'), 3, { alice: 0.5, bob: 2 })
    const [waiting] = stepsOf(frames, 'alice', 'face')
    expect(waiting?.step).toEqual({ type: 'face', dir: 1 })
    expect(waiting?.t).toBeCloseTo(0.5, 1)
    expect(stepsOf(frames, 'alice', 'play')[0]?.t).toBeGreaterThanOrEqual(2)
  })

  it('starts wherever they are once 8 seconds have passed', () => {
    const frames = play(make('hug'), 9, { bob: 60 })
    expect(stepsOf(frames, 'bob', 'play')[0]?.t).toBeCloseTo(8, 1)
  })

  it('high-fives: raised hands, a spark between them on the slap frame, a cheer, done 2 s later', () => {
    const frames = play(make('highfive'), 4)
    const [raise] = stepsOf(frames, 'alice', 'play')
    expect(raise?.step).toEqual({ type: 'play', anim: 'highfive' })
    const sparks = cuesOf(frames, 'spark')
    expect(sparks).toHaveLength(1)
    expect(sparks[0]?.cue).toMatchObject({ x: 700, rise: 30 })
    expect((sparks[0]?.t ?? 0) - (raise?.t ?? 0)).toBeCloseTo(1 / 3, 1)
    expect(stepsOf(frames, 'bob', 'play').map((s) => s.step)).toEqual([
      { type: 'play', anim: 'highfive' },
      { type: 'play', anim: 'cheer' },
    ])
    expect(doneAt(frames) - (raise?.t ?? 0)).toBeCloseTo(2, 1)
  })

  it('hugs: both hug while three hearts rise between them, done after 2.5 s', () => {
    const frames = play(make('hug'), 4)
    const [hug] = stepsOf(frames, 'bob', 'play')
    expect(hug?.step).toEqual({ type: 'play', anim: 'hug' })
    const hearts = cuesOf(frames, 'heart')
    expect(hearts.map((h) => h.t - (hug?.t ?? 0))).toEqual([
      expect.closeTo(0.3, 1),
      expect.closeTo(0.9, 1),
      expect.closeTo(1.5, 1),
    ])
    expect(hearts.every((h) => h.cue.x === 700 && h.cue.rise === 34)).toBe(true)
    expect(doneAt(frames) - (hug?.t ?? 0)).toBeCloseTo(2.5, 1)
  })

  it('fights in a cloud: hidden, pokes on its edge, then a poof, a winner and a dizzy loser', () => {
    const frames = play(make('fight', () => 0.25), 8)
    const [hide, show] = stepsOf(frames, 'alice', 'hide')
    expect(hide?.step).toEqual({ type: 'hide', hidden: true })
    expect(show?.step).toEqual({ type: 'hide', hidden: false })
    const start = hide?.t ?? 0
    expect((show?.t ?? 0) - start).toBeCloseTo(3, 1)

    expect(cuesOf(frames, 'cloud').map((c) => c.cue)).toEqual([{ name: 'cloud', x: 700, rise: 24, lifeMs: 3000 }])
    const pokes = cuesOf(frames, 'fist') // rng 0.25 always picks the fist, at the bottom of the cloud
    expect(pokes).toHaveLength(12)
    expect(pokes.every((p) => p.t - start < 3 && Math.round(p.cue.x) === 700 && p.cue.rise === 6)).toBe(true)
    expect(cuesOf(frames, 'puff')).toHaveLength(6)

    const results = frames.filter((f) => f.out.result)
    expect(results.map((f) => f.out.result)).toEqual([{ winner: 'alice', loser: 'bob' }])
    expect(stepsOf(frames, 'alice', 'play').at(-1)?.step).toEqual({ type: 'play', anim: 'cheer' })
    expect(stepsOf(frames, 'bob', 'play').at(-1)?.step).toEqual({ type: 'play', anim: 'dizzy' })
    const stars = cuesOf(frames, 'tinyStar')
    expect(stars).toHaveLength(3)
    expect(stars.every((s) => s.cue.x === 712 && s.cue.lifeMs === 3000 && s.cue.orbit?.radius === 8)).toBe(true)
    expect(doneAt(frames) - start).toBeCloseTo(6, 1)
  })

  it('lets the coin pick either side', () => {
    const frames = play(make('fight', () => 0.75), 8)
    expect(frames.find((f) => f.out.result)?.out.result).toEqual({ winner: 'bob', loser: 'alice' })
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/interactions/timeline.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: The timelines**

Create `src/interactions/timeline.ts`:

```ts
import { WALL_MARGIN, type StripBounds } from '../avatars/stateMachine'
import type { EffectName } from '../render/effects/effectArt'
import type { EffectCue } from '../render/effects/effectMotion'
import { ANIMATIONS, type AnimName } from '../render/sprites/contract'
import type { PairKind } from './gate'

/** How far apart the two stand, between their centers, in frame px (times spriteScale on stage). */
export const GAPS: Record<PairKind, number> = { highfive: 28, hug: 16, fight: 12 }
/** Both run to the meeting point this fast, stage px per second. */
export const RUN_SPEED = 180
/** If they haven't both arrived by then, the interaction starts wherever they are. */
export const ARRIVE_TIMEOUT_SEC = 8

/** The slap is frame 3 of the high-five row. */
const SLAP_SEC = 2 / ANIMATIONS.highfive.fps
const HIGHFIVE_SEC = 1.2
const CHEER_SEC = 0.8
const HUG_SEC = 2.5
const HEART_SECS = [0.3, 0.9, 1.5]
const BRAWL_SEC = 3
const POKE_EVERY_SEC = 0.25
const RESULT_SEC = 3
const POKES: readonly EffectName[] = ['fist', 'shoe', 'star']
const PUFFS = 6
const PUFF_SPEED = 40
/** Effect heights above the ground, frame px. */
const HAND_RISE = 30
const HEART_RISE = 34
const CLOUD_RISE = 24
const HEAD_TOP_RISE = 46
/** Pokes pop out on this ellipse round the cloud's middle, frame px. */
const CLOUD_RX = 34
const CLOUD_RY = 18
const STAR_ORBIT = 8

export type ActorStep =
  | { type: 'run'; x: number }
  | { type: 'face'; dir: 1 | -1 }
  | { type: 'play'; anim: AnimName }
  | { type: 'hide'; hidden: boolean }

export interface TickOutput {
  steps: { login: string; step: ActorStep }[]
  cues: EffectCue[]
  /** A fight's result, on the tick it is decided. */
  result: { winner: string; loser: string } | null
}

export interface InteractionOptions {
  kind: PairKind
  /** Who started it (the challenger, in a fight). */
  a: string
  b: string
  xa: number
  xb: number
  scale: number
  bounds: StripBounds
  /** Picks the fight's winner and where the brawl's pokes appear. */
  rng: () => number
}

/** Where the two stand: halfway between them, kept off the walls, whoever is further left on the left. */
export function meetingSpots(
  xa: number,
  xb: number,
  kind: PairKind,
  scale: number,
  bounds: StripBounds,
): { a: number; b: number } {
  const half = (GAPS[kind] * scale) / 2
  const lo = bounds.minX + WALL_MARGIN + half
  const hi = bounds.maxX - WALL_MARGIN - half
  const mid = Math.min(hi, Math.max(lo, (xa + xb) / 2))
  return xa <= xb ? { a: mid - half, b: mid + half } : { a: mid + half, b: mid - half }
}

/**
 * One high-five, hug or fight between two characters, as a pure timeline:
 * both run to their spots (the first to arrive waits, facing the other),
 * then the interaction plays out beat by beat. Each tick returns the steps
 * for both characters, the effects to show, and a fight's result.
 */
export class Interaction {
  readonly kind: PairKind
  readonly a: string
  readonly b: string
  private spots: { a: number; b: number }
  private scale: number
  private rng: () => number
  private phase: 'approach' | 'perform' | 'done' = 'approach'
  private started = false
  /** Seconds in the current phase. */
  private t = 0
  private arrived = new Set<string>()
  /** One-shot beats already played, by name. */
  private fired = new Set<string>()
  private nextPoke = 0

  constructor(o: InteractionOptions) {
    this.kind = o.kind
    this.a = o.a
    this.b = o.b
    this.scale = o.scale
    this.rng = o.rng
    this.spots = meetingSpots(o.xa, o.xb, o.kind, o.scale, o.bounds)
  }

  get done(): boolean {
    return this.phase === 'done'
  }

  get logins(): readonly [string, string] {
    return [this.a, this.b]
  }

  /** Advances by dtSec; `xOf` reads where a participant stands now. */
  tick(dtSec: number, xOf: (login: string) => number): TickOutput {
    const out: TickOutput = { steps: [], cues: [], result: null }
    if (this.phase === 'approach') this.approach(dtSec, xOf, out)
    else if (this.phase === 'perform') this.perform(dtSec, out)
    return out
  }

  private approach(dtSec: number, xOf: (login: string) => number, out: TickOutput): void {
    if (!this.started) {
      this.started = true
      out.steps.push(
        { login: this.a, step: { type: 'run', x: this.spots.a } },
        { login: this.b, step: { type: 'run', x: this.spots.b } },
      )
      return
    }
    this.t += dtSec
    for (const login of this.logins) {
      if (this.arrived.has(login) || Math.abs(xOf(login) - this.spotOf(login)) >= 0.5) continue
      this.arrived.add(login)
      out.steps.push({ login, step: { type: 'face', dir: this.facing(login) } }) // waits facing the other
    }
    if (this.arrived.size === 2 || this.t >= ARRIVE_TIMEOUT_SEC) {
      this.phase = 'perform'
      this.t = 0
      this.perform(0, out) // the first beat plays on this tick
    }
  }

  private perform(dtSec: number, out: TickOutput): void {
    this.t += dtSec
    const mid = (this.spots.a + this.spots.b) / 2
    const both = (step: ActorStep) => out.steps.push({ login: this.a, step }, { login: this.b, step })
    if (this.due('face', 0)) {
      for (const login of this.logins) out.steps.push({ login, step: { type: 'face', dir: this.facing(login) } })
    }
    switch (this.kind) {
      case 'highfive':
        if (this.due('raise', 0)) both({ type: 'play', anim: 'highfive' })
        if (this.due('slap', SLAP_SEC)) out.cues.push({ name: 'spark', x: mid, rise: HAND_RISE })
        if (this.due('cheer', HIGHFIVE_SEC)) both({ type: 'play', anim: 'cheer' })
        if (this.t >= HIGHFIVE_SEC + CHEER_SEC) this.phase = 'done'
        break
      case 'hug':
        if (this.due('hug', 0)) both({ type: 'play', anim: 'hug' })
        HEART_SECS.forEach((sec, i) => {
          if (this.due(`heart${i}`, sec)) out.cues.push({ name: 'heart', x: mid, rise: HEART_RISE })
        })
        if (this.t >= HUG_SEC) this.phase = 'done'
        break
      case 'fight':
        this.fight(mid, out, both)
        break
    }
  }

  private fight(mid: number, out: TickOutput, both: (step: ActorStep) => void): void {
    if (this.due('brawl', 0)) {
      both({ type: 'hide', hidden: true })
      out.cues.push({ name: 'cloud', x: mid, rise: CLOUD_RISE, lifeMs: BRAWL_SEC * 1000 })
    }
    while (this.t < BRAWL_SEC && this.nextPoke <= this.t) {
      const angle = this.rng() * Math.PI * 2
      const name = POKES[Math.floor(this.rng() * POKES.length)] ?? 'star'
      out.cues.push({
        name,
        x: mid + Math.cos(angle) * CLOUD_RX * this.scale,
        rise: CLOUD_RISE - Math.sin(angle) * CLOUD_RY,
      })
      this.nextPoke += POKE_EVERY_SEC
    }
    if (this.due('poof', BRAWL_SEC)) {
      both({ type: 'hide', hidden: false })
      for (let i = 0; i < PUFFS; i++) {
        const angle = (i / PUFFS) * Math.PI * 2
        out.cues.push({
          name: 'puff',
          x: mid,
          rise: CLOUD_RISE,
          vx: Math.cos(angle) * PUFF_SPEED,
          vy: Math.sin(angle) * PUFF_SPEED,
        })
      }
      const aWins = this.rng() < 0.5
      const winner = aWins ? this.a : this.b
      const loser = aWins ? this.b : this.a
      out.steps.push(
        { login: winner, step: { type: 'play', anim: 'cheer' } },
        { login: loser, step: { type: 'play', anim: 'dizzy' } },
      )
      for (let i = 0; i < 3; i++) {
        out.cues.push({
          name: 'tinyStar',
          x: this.spotOf(loser),
          rise: HEAD_TOP_RISE,
          lifeMs: RESULT_SEC * 1000,
          orbit: { radius: STAR_ORBIT, phase: (i / 3) * Math.PI * 2 },
        })
      }
      out.result = { winner, loser }
    }
    if (this.t >= BRAWL_SEC + RESULT_SEC) this.phase = 'done'
  }

  /** True once, the first tick at or after `sec` into the performance. */
  private due(beat: string, sec: number): boolean {
    if (this.t < sec || this.fired.has(beat)) return false
    this.fired.add(beat)
    return true
  }

  private spotOf(login: string): number {
    return login === this.a ? this.spots.a : this.spots.b
  }

  /** Toward the other one's spot. */
  private facing(login: string): 1 | -1 {
    const other = login === this.a ? this.b : this.a
    return this.spotOf(login) <= this.spotOf(other) ? 1 : -1
  }
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/interactions/timeline.test.ts`
Expected: PASS. If a timing assertion is off by one frame, check the 1/60 s step boundaries in `play`, not the timeline's constants.

- [ ] **Step 5: Commit**

```bash
git add src/interactions
git commit -m "feat: high-five, hug and fight timelines"
```

---

### Task 11: The director

**Files:**
- Create: `src/interactions/director.ts`, `src/interactions/director.test.ts`

**Interfaces:**
- Consumes: `AvatarStateMachine` scripted API (Task 6), `InteractionStore` (Task 7), `InteractionGate`, `refusalText`, `PairKind` (Task 8), `ChallengeBook` (Task 9), `Interaction`, `RUN_SPEED`, `ActorStep` (Task 10), `parseTarget`, `findTarget` (Task 8), `EffectCue` (Task 4).
- Produces:
  - `interface StageCharacter { login: string; displayName: string; labelText: string; machine: AvatarStateMachine; groundY: number }` (the `Avatar` class satisfies it after Task 12).
  - `interface DirectorView { onScreen(): Iterable<StageCharacter>; find(login): StageCharacter | null; sender(event: ChatMessageEvent, now): StageCharacter | null; isLurking(login): boolean; touch(login, now): void; say(login, text, now): void; cue(cue: EffectCue, groundY: number, now: number): void }`.
  - `class InteractionDirector { constructor(opts: DirectorOptions); isBusy(login): boolean; pair(kind: PairKind, command: ChatCommandEvent, now): void; accept(event: ChatMessageEvent, now): void; setOptedOut(event: ChatMessageEvent, optedOut: boolean, now): void; update(dtSec, now): void }` with `DirectorOptions { view; store; bounds: StripBounds; spriteScale; interactionCooldownMs; targetCooldownMs; challengeTimeoutMs; rng?: () => number }`.

- [ ] **Step 1: Write the failing tests**

Create `src/interactions/director.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { AvatarStateMachine } from '../avatars/stateMachine'
import type { ChatCommandEvent, ChatMessageEvent } from '../chat/types'
import type { EffectCue } from '../render/effects/effectMotion'
import { MemoryStorage } from '../test/fakes'
import { mulberry32 } from '../utils/rng'
import { InteractionDirector, type DirectorView, type StageCharacter } from './director'
import { InteractionStore } from './interactionStore'

const BOUNDS = { minX: 0, maxX: 1920 }
const capitalized = (login: string) => login.charAt(0).toUpperCase() + login.slice(1)

const message = (login: string): ChatMessageEvent => ({
  login,
  displayName: capitalized(login),
  color: null,
  text: '',
  emotes: [],
  messageId: null,
  timestamp: 0,
  tags: {},
})
const command = (name: string, login: string, ...args: string[]): ChatCommandEvent => ({
  name,
  args,
  message: message(login),
})

/** A stand-in stage with real state machines: characters stand where they're put. */
function setup(rng: () => number = () => 0.25) {
  const chars = new Map<string, StageCharacter>()
  const lurking = new Set<string>()
  const said: string[] = []
  const cues: EffectCue[] = []
  const store = new InteractionStore(new MemoryStorage())
  const onStage = (c: StageCharacter | undefined): c is StageCharacter =>
    c !== undefined && c.machine.state !== 'leaving' && c.machine.state !== 'gone'
  const add = (login: string, x: number): StageCharacter => {
    const machine = new AvatarStateMachine({ bounds: BOUNDS, walkSpeed: 100, bubbleDurationMs: 5000, rng: mulberry32(7) })
    machine.beginScript() // place it: run to x instantly, then stand idle there
    machine.runTo(x, 1e9)
    machine.update(1)
    machine.endScript()
    const c: StageCharacter = { login, displayName: capitalized(login), labelText: capitalized(login), machine, groundY: 1080 }
    chars.set(login, c)
    return c
  }
  const view: DirectorView = {
    onScreen: () => [...chars.values()].filter(onStage),
    find: (login) => {
      const c = chars.get(login)
      return onStage(c) ? c : null
    },
    sender: (event) => {
      lurking.delete(event.login) // a command stands a lurker up, like !jump
      const c = chars.get(event.login) ?? add(event.login, 960)
      return onStage(c) ? c : null
    },
    isLurking: (login) => lurking.has(login),
    touch: () => {},
    say: (login, text) => said.push(`${login}: ${text}`),
    cue: (cue) => cues.push(cue),
  }
  const director = new InteractionDirector({
    view,
    store,
    bounds: BOUNDS,
    spriteScale: 2,
    interactionCooldownMs: 15_000,
    targetCooldownMs: 30_000,
    challengeTimeoutMs: 30_000,
    rng,
  })
  let now = 0
  return {
    director,
    store,
    lurking,
    said,
    cues,
    add,
    now: () => now,
    state: (login: string) => chars.get(login)?.machine.state,
    run(seconds: number) {
      for (let i = 0; i < Math.round(seconds * 60); i++) {
        now += 1000 / 60
        for (const c of chars.values()) c.machine.update(1 / 60)
        director.update(1 / 60, now)
      }
    },
  }
}

describe('InteractionDirector', () => {
  it('high-fives: both run to meet, a spark shows, and both go back to normal', () => {
    const s = setup()
    s.add('alice', 400)
    const bob = s.add('bob', 1000)
    s.director.pair('highfive', command('highfive', 'alice', '@bob'), s.now())
    expect(s.state('alice')).toBe('scripted')
    expect(s.director.isBusy('bob')).toBe(true)
    s.run(5)
    expect(s.cues.map((c) => c.name)).toEqual(['spark'])
    expect(s.state('alice')).toBe('idle')
    expect(bob.machine.where().x).toBe(728)
    expect(s.director.isBusy('alice')).toBe(false)
    expect(s.said).toEqual([])
  })

  it('tells the sender why a pair command cannot happen', () => {
    const s = setup()
    s.add('alice', 400)
    s.add('bob', 1000)
    s.add('carol', 1500)
    s.lurking.add('carol')
    s.director.pair('hug', command('hug', 'alice'), s.now())
    s.director.pair('hug', command('hug', 'alice', '@nobody'), s.now())
    s.director.pair('hug', command('hug', 'alice', 'carol'), s.now())
    s.store.setOptedOut('bob', true)
    s.director.pair('hug', command('hug', 'alice', 'Bob'), s.now())
    s.director.pair('hug', command('hug', 'alice', '@alice'), s.now()) // yourself: silent
    expect(s.said).toEqual([
      'alice: who? try !hug @name',
      "alice: nobody isn't here",
      'alice: Carol is lurking',
      'alice: Bob opted out',
    ])
  })

  it('tells an opted-out sender how to opt back in, walking them in to say so', () => {
    const s = setup()
    s.add('bob', 1000)
    s.store.setOptedOut('alice', true)
    s.director.pair('hug', command('hug', 'alice', 'bob'), s.now())
    expect(s.said).toEqual(['alice: you opted out (!interact)'])
    expect(s.state('alice')).toBe('idle')
  })

  it('plays one high-five when two people high-five each other at the same moment', () => {
    const s = setup()
    s.add('alice', 400)
    s.add('bob', 1000)
    s.add('carol', 1500)
    s.director.pair('highfive', command('highfive', 'alice', 'bob'), s.now())
    s.director.pair('highfive', command('highfive', 'bob', 'alice'), s.now()) // bob is busy: silent
    s.director.pair('highfive', command('highfive', 'carol', 'bob'), s.now())
    expect(s.said).toEqual(['carol: Bob is busy'])
    s.run(5)
    expect(s.cues.filter((c) => c.name === 'spark')).toHaveLength(1)
  })

  it('keeps a sender to one interaction per cooldown, and a target to one per target cooldown', () => {
    const s = setup()
    s.add('alice', 400)
    s.add('bob', 1000)
    s.add('carol', 1500)
    s.director.pair('hug', command('hug', 'alice', 'bob'), s.now())
    s.run(6)
    s.director.pair('hug', command('hug', 'alice', 'carol'), s.now()) // alice cooling down: silent
    s.director.pair('hug', command('hug', 'carol', 'bob'), s.now()) // bob just hugged: silent
    expect(s.state('carol')).not.toBe('scripted')
    expect(s.said).toEqual([])
    s.run(10)
    s.director.pair('hug', command('hug', 'alice', 'carol'), s.now())
    expect(s.state('carol')).toBe('scripted')
  })

  it('fights once the target accepts, and the winner shows their record', () => {
    const s = setup(() => 0.25)
    s.add('alice', 400)
    s.add('bob', 1000)
    s.director.pair('fight', command('fight', 'alice', '@bob'), s.now())
    expect(s.said).toEqual(['bob: Alice wants to fight! !accept'])
    expect(s.state('alice')).not.toBe('scripted')
    s.run(1)
    s.director.accept(message('bob'), s.now())
    expect(s.state('alice')).toBe('scripted')
    s.run(10)
    expect(s.said).toContain('alice: Alice wins! (1-0)')
    expect(s.store.record('bob')).toEqual({ wins: 0, losses: 1 })
    expect(s.cues.filter((c) => c.name === 'cloud')).toHaveLength(1)
    expect(['idle', 'wander']).toContain(s.state('bob'))
  })

  it('fights when the target fights back instead of typing !accept', () => {
    const s = setup()
    s.add('alice', 400)
    s.add('bob', 1000)
    s.director.pair('fight', command('fight', 'alice', 'bob'), s.now())
    s.director.pair('fight', command('fight', 'bob', '@alice'), s.now())
    expect(s.state('bob')).toBe('scripted')
    expect(s.said).toEqual(['bob: Alice wants to fight! !accept'])
  })

  it('does nothing on !accept without a live challenge', () => {
    const s = setup()
    s.add('alice', 400)
    s.add('bob', 1000)
    s.director.accept(message('bob'), s.now())
    s.director.pair('fight', command('fight', 'alice', 'bob'), s.now())
    s.run(31)
    s.director.accept(message('bob'), s.now())
    expect(s.state('bob')).not.toBe('scripted')
  })

  it('hands the sender back when the target leaves before they meet', () => {
    const s = setup()
    s.add('alice', 400)
    const bob = s.add('bob', 1000)
    s.director.pair('hug', command('hug', 'alice', 'bob'), s.now())
    s.run(0.5)
    bob.machine.beginLeave()
    s.run(0.1)
    expect(s.state('alice')).toBe('idle')
    expect(s.director.isBusy('alice')).toBe(false)
  })

  it('stops a fight on !nointeract, records nothing, and confirms it', () => {
    const s = setup()
    const alice = s.add('alice', 400)
    s.add('bob', 1000)
    s.director.pair('fight', command('fight', 'alice', 'bob'), s.now())
    s.director.accept(message('bob'), s.now())
    s.run(2.5) // mid-brawl
    s.director.setOptedOut(message('bob'), true, s.now())
    expect(s.state('alice')).toBe('idle')
    expect(alice.machine.update(0).hidden).toBe(false)
    expect(s.store.record('alice')).toEqual({ wins: 0, losses: 0 })
    expect(s.said.at(-1)).toBe('bob: interactions off')
    s.run(31)
    s.director.pair('hug', command('hug', 'alice', 'bob'), s.now())
    expect(s.said.at(-1)).toBe('alice: Bob opted out')
  })

  it('drops pending challenges on !nointeract, even after !interact', () => {
    const s = setup()
    s.add('alice', 400)
    s.add('bob', 1000)
    s.director.pair('fight', command('fight', 'alice', 'bob'), s.now())
    s.director.setOptedOut(message('bob'), true, s.now())
    s.director.setOptedOut(message('bob'), false, s.now())
    s.director.accept(message('bob'), s.now())
    expect(s.state('bob')).not.toBe('scripted')
    expect(s.said.at(-1)).toBe('bob: interactions on')
  })

  it('confirms !nointeract only to someone on screen', () => {
    const s = setup()
    s.director.setOptedOut(message('ghost'), true, s.now())
    expect(s.said).toEqual([])
    expect(s.store.isOptedOut('ghost')).toBe(true)
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/interactions/director.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: The director**

Create `src/interactions/director.ts`:

```ts
import type { AvatarStateMachine, StripBounds } from '../avatars/stateMachine'
import type { ChatCommandEvent, ChatMessageEvent } from '../chat/types'
import type { EffectCue } from '../render/effects/effectMotion'
import { ChallengeBook } from './challenges'
import { InteractionGate, refusalText, type PairKind } from './gate'
import type { InteractionStore } from './interactionStore'
import { findTarget, parseTarget } from './target'
import { Interaction, RUN_SPEED, type ActorStep } from './timeline'

/** A character on stage, as the director sees it. */
export interface StageCharacter {
  login: string
  displayName: string
  /** Name plate text: what bubbles call them. */
  labelText: string
  machine: AvatarStateMachine
  /** Ground line (feet), stage px. */
  groundY: number
}

/** What the director needs from the stage; the manager provides it. */
export interface DirectorView {
  /** Characters on stage and not walking off. */
  onScreen(): Iterable<StageCharacter>
  /** An on-screen character, or null. */
  find(login: string): StageCharacter | null
  /** The sender's character: walks it in if needed and stands up a lurker, like `!jump`. Null while it walks off. */
  sender(event: ChatMessageEvent, now: number): StageCharacter | null
  isLurking(login: string): boolean
  touch(login: string, now: number): void
  /** A speech bubble over an on-screen character. */
  say(login: string, text: string, now: number): void
  cue(cue: EffectCue, groundY: number, now: number): void
}

export interface DirectorOptions {
  view: DirectorView
  store: InteractionStore
  bounds: StripBounds
  spriteScale: number
  interactionCooldownMs: number
  targetCooldownMs: number
  challengeTimeoutMs: number
  /** Picks fight winners and brawl pokes. */
  rng?: () => number
}

/**
 * Runs `!highfive`, `!hug`, `!fight`, `!accept` and `!nointeract`: checks
 * the rules, keeps the cooldowns and the pending challenges, and drives both
 * characters' scripted mode from each interaction's timeline. Works only for
 * interactions in progress; an empty stage costs nothing per frame.
 */
export class InteractionDirector {
  private view: DirectorView
  private store: InteractionStore
  private bounds: StripBounds
  private scale: number
  private rng: () => number
  private gate: InteractionGate
  private challenges: ChallengeBook
  private active: Interaction[] = []

  constructor(o: DirectorOptions) {
    this.view = o.view
    this.store = o.store
    this.bounds = o.bounds
    this.scale = o.spriteScale
    this.rng = o.rng ?? Math.random
    this.gate = new InteractionGate(o.interactionCooldownMs, o.targetCooldownMs)
    this.challenges = new ChallengeBook(o.challengeTimeoutMs)
  }

  isBusy(login: string): boolean {
    return this.active.some((ia) => ia.a === login || ia.b === login)
  }

  /** `!highfive <name>`, `!hug <name>`, `!fight <name>`. */
  pair(kind: PairKind, command: ChatCommandEvent, now: number): void {
    const sender = this.view.sender(command.message, now)
    if (!sender) return
    const name = parseTarget(command.args)
    const target = name === null ? null : findTarget(name, this.view.onScreen())
    // fighting back accepts their challenge instead of sending a new one
    if (kind === 'fight' && target && this.challenges.take(target.login, sender.login, now)) {
      this.acceptFight(target, sender, now)
      return
    }
    const refusal = this.gate.check(
      {
        sender: sender.login,
        senderOptedOut: this.store.isOptedOut(sender.login),
        senderBusy: this.isBusy(sender.login),
        name,
        target: target && {
          login: target.login,
          lurking: this.view.isLurking(target.login),
          optedOut: this.store.isOptedOut(target.login),
          busy: this.isBusy(target.login),
        },
      },
      now,
    )
    if (refusal) {
      const text = refusalText(refusal, command.name, target?.labelText ?? name ?? '')
      if (text) this.view.say(sender.login, text, now)
      return
    }
    if (!target) return // the gate already refused a missing target
    this.gate.senderActed(sender.login, now)
    if (kind === 'fight') {
      this.challenges.challenge(sender.login, target.login, now)
      this.view.say(target.login, `${sender.labelText} wants to fight! !accept`, now)
      return
    }
    this.start(kind, sender, target, now)
  }

  /** `!accept`: the newest live challenge to the sender, if both are still free to fight. */
  accept(event: ChatMessageEvent, now: number): void {
    const accepter = this.view.find(event.login)
    if (!accepter) return
    const challenge = this.challenges.acceptNewest(accepter.login, now)
    if (!challenge) return
    const challenger = this.view.find(challenge.from)
    if (challenger) this.acceptFight(challenger, accepter, now)
  }

  /** `!nointeract` (true) and `!interact` (false). Opting out stops their interaction and drops their challenges. */
  setOptedOut(event: ChatMessageEvent, optedOut: boolean, now: number): void {
    this.store.setOptedOut(event.login, optedOut)
    if (optedOut) {
      this.challenges.dropFor(event.login)
      for (const ia of this.active.filter((x) => x.a === event.login || x.b === event.login)) this.finish(ia)
    }
    if (this.view.find(event.login)) this.view.say(event.login, optedOut ? 'interactions off' : 'interactions on', now)
  }

  update(dtSec: number, now: number): void {
    this.challenges.prune(now, (login) => this.view.find(login) !== null)
    for (let i = this.active.length - 1; i >= 0; i--) {
      const ia = this.active[i]
      if (!ia) continue
      const a = this.view.find(ia.a)
      const b = this.view.find(ia.b)
      // someone walked off (evicted, timed out, sent away): the other goes back to normal
      if (!a || !b || a.machine.state !== 'scripted' || b.machine.state !== 'scripted') {
        this.finish(ia)
        continue
      }
      const out = ia.tick(dtSec, (login) => (login === a.login ? a : b).machine.where().x)
      for (const { login, step } of out.steps) apply(login === a.login ? a : b, step)
      for (const cue of out.cues) this.view.cue(cue, a.groundY, now)
      if (out.result) {
        const winner = out.result.winner === a.login ? a : b
        const record = this.store.addResult(out.result.winner, out.result.loser)
        this.view.say(winner.login, `${winner.labelText} wins! (${record.wins}-${record.losses})`, now)
      }
      if (ia.done) this.finish(ia)
    }
  }

  /** Accepting skips the cooldowns but re-checks that both are still free to fight. */
  private acceptFight(challenger: StageCharacter, accepter: StageCharacter, now: number): void {
    for (const c of [challenger, accepter]) {
      if (this.view.isLurking(c.login) || this.store.isOptedOut(c.login) || this.isBusy(c.login)) return
    }
    this.start('fight', challenger, accepter, now)
  }

  private start(kind: PairKind, a: StageCharacter, b: StageCharacter, now: number): void {
    if (!a.machine.beginScript()) return
    if (!b.machine.beginScript()) {
      a.machine.endScript()
      return
    }
    this.gate.targeted([a.login, b.login], now)
    this.view.touch(a.login, now) // counts as activity: neither times out or is evicted first
    this.view.touch(b.login, now)
    this.active.push(
      new Interaction({
        kind,
        a: a.login,
        b: b.login,
        xa: a.machine.where().x,
        xb: b.machine.where().x,
        scale: this.scale,
        bounds: this.bounds,
        rng: this.rng,
      }),
    )
  }

  /** Hands both characters back to their normal behavior. */
  private finish(ia: Interaction): void {
    this.active = this.active.filter((x) => x !== ia)
    for (const login of ia.logins) this.view.find(login)?.machine.endScript()
  }
}

function apply(c: StageCharacter, step: ActorStep): void {
  switch (step.type) {
    case 'run':
      c.machine.runTo(step.x, RUN_SPEED)
      break
    case 'face':
      c.machine.face(step.dir)
      break
    case 'play':
      c.machine.play(step.anim)
      break
    case 'hide':
      c.machine.setHidden(step.hidden)
      break
  }
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/interactions`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/interactions
git commit -m "feat: interaction director for high-fives, hugs and fights"
```

---

### Task 12: Wire it up: manager, bootstrap and fake chat

**Files:**
- Modify: `src/avatars/avatar.ts`, `src/avatars/manager.ts`, `src/app/bootstrap.ts`, `src/app/fakeChat.ts`
- Test: `src/avatars/manager.test.ts`

**Interfaces:**
- Consumes: everything above.
- Produces:
  - `Avatar.displayName`, `Avatar.labelText`, `Avatar.groundY` (readonly), so an `Avatar` is a `StageCharacter`; `AvatarDisplayOptions.displayName`.
  - `ManagerOptions.interactionStore: InteractionStore`, `ManagerOptions.effects?: EffectSink` with `interface EffectSink { spawn(cue: EffectCue, groundY: number, now: number): void }` (`EffectLayer` satisfies it).
  - `AvatarManager.interact(kind: PairKind, command: ChatCommandEvent, now)`, `accept(event, now)`, `setInteractions(event, on: boolean, now)`, `emote(name: EmoteName, event, now)`, `sesh()`.

- [ ] **Step 1: Write the failing tests**

In `src/avatars/manager.test.ts`:

Replace the mocked `Avatar` class in `vi.mock('./avatar', ...)` with:

```ts
  Avatar: class {
    login: string
    displayName: string
    labelText: string
    groundY = 1080
    machine: AvatarStateMachine
    lastActiveAt: number
    destroyed = false
    container = {}
    constructor(
      options: { login: string; displayName: string; labelText: string; machine: AvatarStateMachine },
      now: number,
    ) {
      this.login = options.login
      this.displayName = options.displayName
      this.labelText = options.labelText
      this.machine = options.machine
      this.lastActiveAt = now
      created.push(this)
    }
    touch(now: number): void {
      this.lastActiveAt = now
    }
    update(dtSec: number) {
      return this.machine.update(dtSec)
    }
    setLayers(): void {}
    showBubble(): void {}
    destroy(): void {
      this.destroyed = true
    }
  },
```

Add these imports:

```ts
import { InteractionStore } from '../interactions/interactionStore'
import { MemoryStorage } from '../test/fakes'
```

add `interactionStore: new InteractionStore(new MemoryStorage()),` to the `AvatarManager` options in `setup`, and add after the `ev` helper:

```ts
const command = (name: string, login: string, ...args: string[]) => ({ name, args, message: ev(login) })
const stateOf = (login: string) => created.find((a) => a.login === login && !a.destroyed)?.machine.state
```

Add at the end of the file:

```ts
describe('AvatarManager emotes and interactions', () => {
  it('stands a lurker up to dance', () => {
    const { manager, now, run } = setup({})
    manager.lurk(ev('l'), now())
    run(70)
    manager.emote('dance', ev('l'), now())
    run(0.1)
    expect(stateOf('l')).toBe('emote')
  })

  it('lights up everyone but the lurkers on !sesh', () => {
    const { manager, now, run } = setup({})
    for (const login of ['a', 'b']) manager.handleMessage(ev(login), now())
    manager.lurk(ev('l'), now())
    run(70)
    manager.sesh()
    run(1.3)
    expect([stateOf('a'), stateOf('b'), stateOf('l')]).toEqual(['emote', 'emote', 'sit'])
  })

  it('ignores !smoke, !smoke bong and !sesh with smokeEnabled off, walking nobody in', () => {
    const { manager, now, run } = setup({ smokeEnabled: false })
    manager.emote('smoke', ev('a'), now())
    manager.emote('bong', ev('a'), now())
    expect(created).toHaveLength(0)
    manager.handleMessage(ev('b'), now())
    run(30)
    manager.sesh()
    run(1.3)
    expect(stateOf('b')).not.toBe('emote')
    manager.emote('clap', ev('b'), now())
    run(0.1)
    expect(stateOf('b')).toBe('emote')
  })

  it('runs a high-five between two chatters and hands them back', () => {
    const { manager, now, run } = setup({})
    for (const login of ['a', 'b']) manager.handleMessage(ev(login), now())
    run(30)
    manager.interact('highfive', command('highfive', 'a', '@b'), now())
    run(0.1)
    expect(stateOf('a')).toBe('scripted')
    expect(stateOf('b')).toBe('scripted')
    run(15)
    expect(stateOf('a')).not.toBe('scripted')
  })

  it('stands a lurker up even when their pair command is refused', () => {
    const { manager, now, run } = setup({})
    manager.lurk(ev('l'), now())
    run(70)
    manager.interact('hug', command('hug', 'l', '@nobody'), now())
    run(0.1)
    expect(stateOf('l')).not.toBe('sit')
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/avatars/manager.test.ts`
Expected: FAIL (`interactionStore` is not an option; `emote`, `sesh` and `interact` don't exist).

- [ ] **Step 3: Give avatars their names and ground line**

In `src/avatars/avatar.ts`:

Add to `AvatarDisplayOptions` after `labelText`:

```ts
  /** Twitch display name, for `@name` matching. */
  displayName: string
```

Add fields after `readonly login: string`:

```ts
  readonly displayName: string
  /** Name plate text: what bubbles call them. */
  readonly labelText: string
  /** Ground line (feet), stage px. */
  readonly groundY: number
```

and in the constructor after `this.login = options.login`:

```ts
    this.displayName = options.displayName
    this.labelText = options.labelText
    this.groundY = options.baseY
```

- [ ] **Step 4: The manager**

In `src/avatars/manager.ts`:

Add imports:

```ts
import type { ChatCommandEvent } from '../chat/types'
import { InteractionDirector, type DirectorView } from '../interactions/director'
import { EMOTES, exhaleCues, isSmoke, MOUTH_X, SESH_RIPPLE_SEC, type EmoteName } from '../interactions/emotes'
import type { PairKind } from '../interactions/gate'
import type { InteractionStore } from '../interactions/interactionStore'
import type { EffectCue } from '../render/effects/effectMotion'
```

(`ChatCommandEvent` joins the existing `../chat/types` import.) Add `type Snapshot` to the `./stateMachine` import.

Add before `ManagerOptions`:

```ts
/** Where effects go (the effect layer); left out in tests. */
export interface EffectSink {
  spawn(cue: EffectCue, groundY: number, now: number): void
}
```

Add to `ManagerOptions`:

```ts
  /** Opt-outs and fight records. */
  interactionStore: InteractionStore
  /** Shows sparks, hearts, the fight cloud and smoke. */
  effects?: EffectSink
```

Add a field `private director: InteractionDirector` after `lurkers`, and in the constructor after `this.options = options`:

```ts
    const { cfg } = options
    this.director = new InteractionDirector({
      view: this.directorView(),
      store: options.interactionStore,
      bounds: { minX: 0, maxX: options.stageWidth },
      spriteScale: cfg.spriteScale,
      interactionCooldownMs: cfg.interactionCooldownMs,
      targetCooldownMs: cfg.targetCooldownMs,
      challengeTimeoutMs: cfg.challengeTimeoutMs,
    })
```

Add after `unlurk`:

```ts
  /** `!highfive`, `!hug` and `!fight <name>`. */
  interact(kind: PairKind, command: ChatCommandEvent, now: number): void {
    this.director.pair(kind, command, now)
  }

  /** `!accept`: the newest fight challenge to this viewer. */
  accept(event: ChatMessageEvent, now: number): void {
    this.director.accept(event, now)
  }

  /** `!interact` (on) and `!nointeract` (off). */
  setInteractions(event: ChatMessageEvent, on: boolean, now: number): void {
    this.director.setOptedOut(event, !on, now)
  }

  /** A solo emote: walks in if needed and stands a lurker up. Smoke and bong need smokeEnabled. */
  emote(name: EmoteName, event: ChatMessageEvent, now: number): void {
    if (isSmoke(name) && !this.options.cfg.smokeEnabled) return
    if (this.director.isBusy(event.login)) return // the interaction carries on
    const avatar = this.getOrSpawn(event, now)
    if (!avatar) return
    avatar.touch(now)
    this.endLurk(event.login) // standing up to play it
    const { anim, seconds, turnEverySec } = EMOTES[name]
    avatar.machine.onEmote(anim, seconds, { turnEverySec })
  }

  /** `!sesh`: everyone on screen who can smokes a joint, in a ripple; lurkers keep watching. */
  sesh(): void {
    if (!this.options.cfg.smokeEnabled) return
    const { anim, seconds } = EMOTES.smoke
    for (const [login, avatar] of this.avatars) {
      if (this.lurkers.isLurking(login)) continue
      // walking off, jumping, mid-interaction or already emoting: onEmote declines
      avatar.machine.onEmote(anim, seconds, { delaySec: Math.random() * SESH_RIPPLE_SEC })
    }
  }
```

In `update`, change the avatar loop's first line from `avatar.update(dtSec, now)` to:

```ts
      const snap = avatar.update(dtSec, now)
      if (snap.emoteStarted === 'smoke' || snap.emoteStarted === 'bong') this.exhale(avatar, snap, now)
```

and add after the loop (before the sweep):

```ts
    this.director.update(dtSec, now)
```

In `spawn`, add `displayName: event.displayName,` to the `Avatar` options.

Add these private methods (after `endLurk`):

```ts
  /** Smoke puffs from the mouth for a smoke or bong emote that just began; they show on the exhale. */
  private exhale(avatar: Avatar, snap: Snapshot, now: number): void {
    const emote = snap.emoteStarted === 'bong' ? 'bong' : 'smoke'
    const mouthX = snap.x + snap.facing * MOUTH_X * this.options.cfg.spriteScale
    for (const cue of exhaleCues(emote, mouthX, snap.facing)) this.options.effects?.spawn(cue, avatar.groundY, now)
  }

  /** The stage as the director sees it; an Avatar is a StageCharacter, so nothing is copied. */
  private directorView(): DirectorView {
    const onStage = (a: Avatar | undefined): a is Avatar =>
      a !== undefined && a.machine.state !== 'leaving' && a.machine.state !== 'gone'
    return {
      onScreen: () => [...this.avatars.values()].filter(onStage),
      find: (login) => {
        const avatar = this.avatars.get(login)
        return onStage(avatar) ? avatar : null
      },
      sender: (event, now) => {
        const avatar = this.getOrSpawn(event, now)
        if (!avatar) return null
        avatar.touch(now)
        // a lurker stands up for any pair command, even one that gets refused
        if (this.endLurk(event.login)) avatar.machine.onUnlurk()
        return avatar
      },
      isLurking: (login) => this.lurkers.isLurking(login),
      touch: (login, now) => this.avatars.get(login)?.touch(now),
      say: (login, text, now) => {
        const avatar = this.avatars.get(login)
        if (onStage(avatar)) this.attachBubble(avatar, text, [], now, 'overlay')
      },
      cue: (cue, groundY, now) => this.options.effects?.spawn(cue, groundY, now),
    }
  }
```

(`onUnlurk` stands a seated machine up into idle; a scripted interaction that starts right after takes it from there.)

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/avatars`
Expected: PASS.

- [ ] **Step 6: Register the commands**

In `src/app/bootstrap.ts`:

Add imports:

```ts
import { smokeEmote } from '../interactions/emotes'
import { PAIR_KINDS } from '../interactions/gate'
import { InteractionStore } from '../interactions/interactionStore'
import { EffectLayer } from '../render/effects/effectLayer'
```

After `const chooser = ...` add:

```ts
  const interactionStore = new InteractionStore(storage)
  const effects = new EffectLayer(stage.effectLayer, cfg.spriteScale)
```

and add `interactionStore,` and `effects,` to the `AvatarManager` options.

Replace the line `// Phase 2 commands are one register() call each: !dance, !hug, ...` with:

```ts
  // interactions between chatters, and the opt-out
  for (const kind of PAIR_KINDS) commands.register(kind, (e) => manager.interact(kind, e, performance.now()))
  commands.register('accept', (e) => manager.accept(e.message, performance.now()))
  commands.register('nointeract', (e) => manager.setInteractions(e.message, false, performance.now()))
  commands.register('interact', (e) => manager.setInteractions(e.message, true, performance.now()))
  // solo emotes; the manager ignores !smoke and !sesh unless smokeEnabled
  for (const name of ['clap', 'wave', 'dance'] as const) {
    commands.register(name, (e) => manager.emote(name, e.message, performance.now()))
  }
  commands.register('smoke', (e) => manager.emote(smokeEmote(e.args), e.message, performance.now()))
  commands.register('sesh', (e) => {
    if (isPrivileged(e.message.tags)) manager.sesh()
  })
```

Replace the ticker callback with:

```ts
  stage.app.ticker.add((ticker) => {
    frameCount++
    const now = performance.now()
    manager.update(ticker.deltaMS / 1000, now)
    effects.update(now)
  })
```

Add `interactionStore,` to the `__chatAvatars` debug handle, and `effects.destroy()` right before `stage.destroy()` in the dispose function.

- [ ] **Step 7: Fake chat sends the new commands**

In `src/app/fakeChat.ts`:

Update the doc comment to: `...including \`!avatar\` picks, interactions (fights are accepted 2 s later) and emotes. About every 30 seconds a hype or sad wave rolls through.`

Add after `FAKE_PICKS`:

```ts
/** Fake interactions and emotes; '@' becomes another fake chatter's name. */
const FAKE_INTERACTIONS: [name: string, args: string[]][] = [
  ['highfive', ['@']],
  ['hug', ['@']],
  ['fight', ['@']],
  ['clap', []],
  ['wave', []],
  ['dance', []],
  ['smoke', []],
  ['smoke', ['bong']],
]
/** A fake challenge is accepted this long after it's sent. */
const FAKE_ACCEPT_MS = 2_000
```

Add after `pick`:

```ts
function fakeMessage(login: string, text: string, id: string): ChatMessageEvent {
  return {
    login,
    displayName: login,
    color: pick(COLORS, null),
    text,
    emotes: fakeTwitchEmotes(text),
    messageId: `fake-${id}`,
    timestamp: Date.now(),
    tags: {},
  }
}
```

Replace the body of `startFakeChat` with:

```ts
  let counter = 0
  let wave: string[] = []
  const accepts = new Set<number>()
  const interval = window.setInterval(() => {
    counter++
    if (counter % WAVE_EVERY_TICKS === 0) {
      const lines = Math.random() < 0.5 ? HYPE_WAVE : SAD_WAVE
      wave = Array.from({ length: WAVE_SIZE }, () => pick(lines, 'W'))
    }
    const waveLine = wave.shift()
    const login = pick(FAKE_LOGINS, 'fallback')
    const message = fakeMessage(login, waveLine ?? pick(FAKE_LINES, 'hi'), String(counter))
    if (waveLine !== undefined || Math.random() >= 0.15) {
      onMessage(message)
      return
    }
    const roll = Math.random()
    if (roll < 0.25) {
      const [name, args] = pick(FAKE_PICKS, ['avatar', ['cat']])
      onCommand({ name, args, message })
    } else if (roll < 0.6) {
      const [name, args] = pick(FAKE_INTERACTIONS, ['clap', []])
      const other = pick(
        FAKE_LOGINS.filter((l) => l !== login),
        'pixelpete',
      )
      onCommand({ name, args: args.map((a) => (a === '@' ? `@${other}` : a)), message })
      if (name === 'fight') {
        const id = window.setTimeout(() => {
          accepts.delete(id)
          onCommand({ name: 'accept', args: [], message: fakeMessage(other, '!accept', `${counter}-accept`) })
        }, FAKE_ACCEPT_MS)
        accepts.add(id)
      }
    } else {
      onCommand({ name: 'jump', args: [], message })
    }
  }, 400)
  return () => {
    window.clearInterval(interval)
    for (const id of accepts) window.clearTimeout(id)
  }
```

- [ ] **Step 8: Run everything**

Run: `npm test && npx tsc -b && npm run lint && npm run build`
Expected: all PASS.

- [ ] **Step 9: Commit**

```bash
git add src
git commit -m "feat: !highfive, !hug, !fight, !accept, emotes, !sesh and !nointeract in the overlay"
```

---

### Task 13: Docs, a look in Chrome, and the performance check

**Files:**
- Modify: `README.md`; `docs/superpowers/specs/2026-10-07-avatar-builder-design.md` in the **main checkout** (it is untracked there, waiting for the streamer's review: edit it, don't commit it)

- [ ] **Step 1: README**

In `README.md`:

- In the intro paragraph, after `sits down to watch on \`!lurk\`,` add `high-fives, hugs and fights other chatters (\`!highfive\`, \`!hug\`, \`!fight\`), claps, waves, dances and smokes,`.
- In **Commands**, after the `!unlurk` bullet, add:

```md
- `!highfive @name` and `!hug @name`: your character and theirs run to meet in the middle and high-five or hug. `@name` is their Twitch name (the `@` is optional), and they must be on screen and not lurking. One per 15 seconds per viewer (`interactionCooldownSec`); someone who was just high-fived, hugged or fought can't be targeted again for 30 seconds (`targetCooldownSec`). If it can't happen, a bubble over you says why: they aren't here, are lurking, opted out, or are busy.
- `!fight @name` challenges them: a bubble over them says so, and they have 30 seconds (`challengeSec`) to answer with `!accept` or by fighting back (`!fight @you`). You both vanish into a cartoon dust cloud, a coin flip picks the winner, who walks out cheering with their record (`alice wins! (5-2)`), and the loser sways, dizzy. Records are remembered on this PC. (StreamElements' points duel also uses `!accept`; fighting back always works.)
- `!nointeract` makes you untargetable, and stops you starting high-fives, hugs and fights; `!interact` turns it back on. Remembered on this PC.
- `!clap`, `!wave` and `!dance` play on your own character.
- `!smoke` smokes a joint and `!smoke bong` a bong. `!sesh` (the broadcaster and mods only) lights up everyone on screen at once; lurkers keep watching. `smoke=0` turns both off.
```

- In **Architecture**, add the line `  interactions/ high-fives, hugs, fights and emotes: rules, cooldowns, challenges, timelines, the director` after `avatars/`, and change the `render/` line to `Pixi stage, sprite sheets, effects, speech bubbles, emotes, labels`.
- In **Testing**, add `interactions` to the `npm test` comment's list.
- In **Phase 2 ideas**, replace the `More commands` and `Avatar interactions` bullets with `- More interactions: \`!bonk @user\`, \`!throw @user\`, a fight leaderboard; emote rain.`

- [ ] **Step 2: The builder spec's command list**

In the main checkout (`../chat-avatars`), in `docs/superpowers/specs/2026-10-07-avatar-builder-design.md`, change item 7 of "The page" to:

`7. **Commands**: every viewer command with an example: \`!avatar\`, \`!skin\`, \`!jump\`, \`!lurk\`, \`!unlurk\`, \`!avatarinfo\`, \`!highfive\`, \`!hug\`, \`!fight\` and \`!accept\`, \`!clap\`, \`!wave\`, \`!dance\`, \`!smoke\`, \`!nointeract\` and \`!interact\` (not \`!sesh\`, which is for the streamer and mods).`

Leave it uncommitted.

- [ ] **Step 3: Commit the README**

```bash
git add README.md
git commit -m "docs: interactions, emotes and their settings"
```

- [ ] **Step 4: Watch every command in Chrome**

Run `npm run dev` and open `http://localhost:5173/?debug=1&interactionCooldownSec=0&targetCooldownSec=0` (the channel comes from `overrides.ts`; chat is read-only, so a quiet channel keeps the stage clear; the cooldowns are off so the checks can run back to back). In the DevTools console, paste:

```js
const msg = (login) => ({ login, displayName: login, color: '#1E90FF', text: 'hi', emotes: [], messageId: null, timestamp: Date.now(), tags: {} })
const chat = (login) => __chatAvatars.manager.handleMessage(msg(login), performance.now())
const cmd = (login, name, ...args) => __chatAvatars.commands.dispatch({ name, args, message: msg(login) })
for (const l of ['tester_one', 'tester_two', 'tester_fox']) chat(l)
cmd('tester_fox', 'avatar', 'fox')
```

Then, waiting for each to finish:

- `cmd('tester_one', 'highfive', '@tester_two')`: both run in, raise hands, spark, cheer.
- `cmd('tester_one', 'hug', 'tester_fox')`: a human and an animal hug, hearts rise.
- `cmd('tester_two', 'fight', '@tester_fox')`, then `cmd('tester_fox', 'accept')`: the challenge bubble, the cloud with pokes, the poof, a cheering winner with `(1-0)`, a dizzy loser with stars.
- `cmd('tester_one', 'hug', '@nobody')`: the "isn't here" bubble.
- `cmd('tester_fox', 'clap')`, `'wave'`, `'dance'`, `'smoke'`, then `cmd('tester_two', 'smoke', 'bong')`: each plays; smoke puffs on the exhale.
- `__chatAvatars.manager.sesh()`: everyone smokes, in a ripple.
- `cmd('tester_two', 'nointeract')` then `cmd('tester_one', 'hug', 'tester_two')`: "opted out".

Fix anything that reads badly at stream size (positions of effects, prop placement) in the art or timeline constants; keep the tests passing. Record a GIF of the high-five, the hug, the fight and a smoke (Chrome `gif_creator`, file `interactions.gif`) for the PR.

- [ ] **Step 5: Measure the cost**

Measure on `main` and on this branch, the same way, so the PR can say what the feature costs:

```bash
git worktree add ../chat-avatars-perf main
cd ../chat-avatars-perf && npm install && npx vite --port 5174
```

Open `http://localhost:5174/?debug=grid` (main) and `http://localhost:5173/?debug=grid` (this branch) one at a time, wait 30 s for the 25 fake chatters to arrive, then paste in the console:

```js
(() => {
  const m = __chatAvatars.manager
  const update = m.update.bind(m)
  let total = 0
  let frames = 0
  m.update = (dt, now) => {
    const t = performance.now()
    update(dt, now)
    total += performance.now() - t
    frames++
  }
  const started = performance.now()
  setTimeout(() => {
    const secs = (performance.now() - started) / 1000
    console.log(`[perf] manager.update ${(total / frames).toFixed(3)} ms per frame, ${(frames / secs).toFixed(1)} fps over ${secs.toFixed(0)} s`)
  }, 60_000)
})()
```

Note both results for the PR description, then remove the temporary worktree: `git worktree remove ../chat-avatars-perf`. (The streamer checks the browser source's CPU in Task Manager with OBS running; that can't be measured from here.)

- [ ] **Step 6: Finish the branch**

Use superpowers:finishing-a-development-branch. The PR description lists the commands, the settings, the `!accept` / StreamElements note, the GIF and the two performance numbers. No Claude attribution.
