# Character Roster: humans, animals, `!avatar` and the `!avatarinfo` strip

Date: 2026-09-25 · Status: design approved in chat, awaiting spec review · Builds on: chat reactions (merged), chat-color characters (PR #2)

## Goal

Replace the three placeholder bodies (slime, robot, ghost) with a roster viewers recognise and can choose from:

- chibi **humans** in three builds (skinny, average, chubby), with varied skin tones and hair;
- **animals**: cat, dog, duck, frog, bunny, bear and fox.

Viewers pick their character in chat (`!avatar cat`), and the pick is remembered across streams. A "character select" strip slides up from the bottom of the stream to show the options. Chat can open it with `!avatarinfo`, and the streamer can open it from a Stream Deck button.

All art is drawn in code for now, in a layered format that AI-assisted or commissioned art can replace later with no code changes.

## Decisions (agreed with the streamer)

| Topic | Decision |
|---|---|
| Art source | Drawn in code now; AI-assisted art later, dropped in through the same format. |
| Roster | Chibi humans (skinny, average, chubby) and cat, dog, duck, frog, bunny, bear, fox. Slime, robot and ghost retire. |
| Human proportions | Mockup A: chibi, big head. |
| Animal colors | Mockup D: natural colors plus a collar in the chatter's color. |
| Chat choices | `!avatar <kind>` and `!avatar <build>`. Skin and hair come from the username. |
| Remembering | Stored in the OBS browser source's own storage (localStorage) on this PC. |
| Art system | Approach 1: layered sheets, each with a color role. |
| Info display | Separate OBS source: a character-select strip (mockup B) sliding up from the bottom. |
| Stream Deck | Both triggers: a button that posts `!avatarinfo`, and a button that shows the OBS source. |

Visual references (git-ignored brainstorm files): `.superpowers/brainstorm/8056-1790347411/content/humans-animals.html` (options A and D) and `avatar-info-strip.html` (the strip, including the fully-hidden fix).

## Art format (contract v3)

- **Frames:** 48x48 px, a 6x6 grid (**288x288 px** sheets), same rows as today: idle 0 (4 frames, 4 fps), walk 1 (6, 10), jump 2 (6, 10), talk 3 (4, 6), cheer 4 (4, 6), sad 5 (4, 2).
- **Scale:** `spriteScale` defaults to **2** (was 3), so characters are the same height on screen, with 50% more detail.
- **Layers:** every character is a back-to-front stack of layer sheets. Each layer has one **color role**:

| Role | Tinted with | Used for |
|---|---|---|
| `chat` | the chatter's color (lifted like the name tag) | human shirt, animal collar |
| `skin` | one of `SKIN_TONES` | human head, neck, hands |
| `hair` | one of `HAIR_COLORS` | hairstyles |
| `accent` | the contrasting accent (`contrastingAccent`) | human cap, bow, glasses |
| `fixed` | nothing: painted in final colors (alpha allowed) | human face, pants and shoes; whole animals |

- **How tinting works:**
  - Tinted layers are grayscale: white takes the full tint, grays shade it, black outlines stay black.
  - `fixed` layers are painted in final colors and are never tinted. A blush drawn in translucent pink sits over any skin tone.
- **Stacks:**
  - Human: `hair-<style>-back` (only styles that have one) → `human-<build>-pants` → `human-<build>-shirt` → `human-<build>-skin` → `human-face` → `hair-<style>` → `accessory-<name>` (if any).
  - Animal: `<kind>` (fixed, face included) → `collar` (chat).
- **Anchors:**
  - The human head (position, eye row, head top) is identical across the three builds, so hair, face and accessory sheets are shared by all builds.
  - All animals share one body template and neck row, so a single `collar` sheet fits every animal.
  - Every layer of a character is painted from the same pose table, so the layers line up frame by frame.
- **Sheet names**, which double as PNG drop-in names in `src/assets/sprites/`:
  - `human-{skinny,average,chubby}-{pants,shirt,skin}`
  - `human-face`
  - `hair-{short,long,bun,spiky}`, plus `hair-long-back`
  - `accessory-{cap,bow,glasses}`
  - `{cat,dog,duck,frog,bunny,bear,fox}`
  - `collar`
- **Loading:** the build-time sheet manifest resolves any PNG with a matching name; missing names fall back to the code-drawn sheet. A PNG of the wrong size is ignored with a warning (as today).
- **Assembly:** `layersFor(look): LayerRef[]`, where `LayerRef = { sheet: SheetId; role: ColorRole }`, is the single function that assembles a character.

## Looks and colors

```ts
type Kind = 'human' | 'cat' | 'dog' | 'duck' | 'frog' | 'bunny' | 'bear' | 'fox'
type Build = 'skinny' | 'average' | 'chubby'
type HairStyle = 'short' | 'long' | 'bun' | 'spiky'
type AccessoryName = 'cap' | 'bow' | 'glasses'

interface Look {
  kind: Kind
  build: Build             // humans only
  skin: number             // index into SKIN_TONES, humans only
  hairStyle: HairStyle     // humans only
  hairColor: number        // index into HAIR_COLORS, humans only
  accessory: AccessoryName | null  // humans only
}
```

- **Palettes:**
  - `SKIN_TONES = [0xf6d2b4, 0xe2a882, 0xb9784f, 0x7d4a2c]`
  - `HAIR_COLORS = [0x2a1a12, 0x7a4520, 0xe0b04a, 0xa8322c]` (black, brown, blond, red)
  - Fixed pants `0x3b4a6b`, fixed shoes `0x3a2a2a`
- **DNA v2**, the default look from the username:
  - The login is hashed (FNV-1a) into a seeded PRNG, as today.
  - Frozen draw order: kind → build → skin → hairStyle → hairColor → palette (the fallback chat color) → accessory presence (25% none) → accessory → walkSpeed → depth.
  - `human` is weighted equal to all 7 animals combined (`HUMAN_SHARE = 0.5`); animals are uniform within the rest.
  - New golden-value tests lock the order. Every viewer gets a new look once when this ships; this is accepted.
- **`resolveLook(dna, choice)`:** the DNA look overridden by the viewer's stored choice.
  - `choice.kind` sets the kind.
  - `choice.build` sets the build. A build only shows while the kind is `human`, and `!avatar <build>` also sets kind `human`.
- **Tints:**
  - `chat` and `accent` come from `characterColors` (the existing chat-color rules). A chatter with no color gets the DNA palette color.
  - `skin` and `hair` come from the palettes above; `fixed` gets `0xffffff`, which means no tint.
  - Name tags stay in the chat color, so shirts and collars always match the name.

## Drawing (code)

- **Pixel toolkit** (`render/sprites/pixelKit.ts`), grown from the mockup code and shared by every painter:
  - pixel ellipse, rectangle and triangle shapes
  - a two-pass draw: outlines for every part first, then fills, giving one clean silhouette
  - optional per-part shading
  - color helpers (mix, darken, lighten)
- **Pose tables:** one table per family (humans, animals) per row. Each pose sets bounce and squash, arms (`down`, `swingA`/`swingB`, `mid`, `up`, `gesture`, `limp`), leg step and face (`normal`, `talk`, `happy`, `grin`, `sad`). Reaction rows match today: cheer has arms up with a happy or grin face; sad has limp arms, droopy eyes and a tear.
- **Human painters:**
  - One set, parameterised by build (torso radius, arm and leg thickness).
  - Each emits its own layer: skin, shirt, pants, face, and hair front and back.
  - Hairstyles: short, long (back halo and side strands behind the head, top in front, never under the chin), bun, spiky.
  - Accessories redrawn for the 48 px head.
- **Animal painters:**
  - A shared chibi body (head, torso, paws, feet) plus per-species parts: cat and fox ears, bunny ears, bear ears, dog floppy ears; tails; snout, beak and frog eye bumps.
  - Faces are painted per pose. Sad also droops the ears for cat, dog and bunny.
  - The collar is painted from the same animal pose table.
- **Retune for 48 px frames:** the ground shadow, `HEAD_CLEARANCE` (bubble height), the name tag gap and the jump height, so they look right at the new scale.
- **Preview page:** `sheet-preview.html` shows every kind, every build with each hairstyle, and all six rows. It's the art sign-off tool.

## `!avatar` command and remembering choices

- **Parsing:** `parseAvatarCommand(args)` returns one of:
  - `{ type: 'kind', kind }`: human, cat, dog, duck, frog, bunny, bear, fox
  - `{ type: 'build', build }`: skinny, average, chubby
  - `{ type: 'help' }`: no word, or an unknown word

  Matching ignores case. Aliases: person → human, kitty → cat, puppy → dog, rabbit → bunny.
- **Help:** shows the options in a speech bubble over the sender's character: `human cat dog duck frog bunny bear fox · skinny average chubby`. The overlay reads chat anonymously and cannot post to chat.
- **Apply:**
  - A viewer changes at most once per `avatarChangeCooldownMs` (10 000). Extra commands are ignored.
  - The choice is saved to `ChoiceStore`.
  - If the viewer's character is on screen and not leaving, it swaps its layers in place (same spot, state, name tag and bubble) and hops.
  - If they have no character yet, they spawn with the new look. `!jump` already spawns this way.
- **`ChoiceStore`:**
  - Wraps a minimal storage interface (`getItem`/`setItem`): localStorage in the overlay, an in-memory fake in tests.
  - One key, `chat-avatars:choices:v1`, holding `{ login: { kind?, build?, at } }`.
  - Capped at 2000 viewers; the least recently changed are evicted first.
  - Corrupted JSON starts empty. A throwing or absent storage falls back to memory only for the session, with one console warning.
- **Future hook:** a choice saved from the streamer's website later becomes another choice source feeding `resolveLook`.

## `!avatarinfo` character-select strip

- **The page:** `avatar-info.html`, a second Vite entry that ships in `dist/`. It's added in OBS as its own Browser source at 1920x300.
- **Look (mockup B):**
  - a tilted banner "CHOOSE YOUR AVATAR" and how-to text on the left
  - a stage lineup of the 10 roster entries on the right, each an idle animation at 2x with a name sign
  - sample looks: humans in varied skin and hair wearing the brand color; animals in natural colors with a brand-color collar
  - the Press Start 2P font, and one `brandColor` setting (default `#9b5cff`) for banner and trim
- **Motion:**
  - Slides up over about 0.6 s, stays `infoDurationMs` (12 000), then slides down.
  - Hidden means fully off-screen: the slide distance clears the tilted banner's overhang and shadow, and the strip is set to `visibility: hidden` once down.
  - Transparent background otherwise.
- **Shared rendering:** the strip and the preview page draw sheets with the same canvas code: a shared tint helper, plus sheet sources that resolve a PNG or a painted canvas. The Pixi loader wraps those same sources, so the three views never drift apart.
- **Triggers:**
  1. **Chat:** `!avatarinfo` or `!avatars`. The strip page runs its own anonymous chat connection, using the same channel config.
  2. **Stream Deck, chat route:** a button posts `!avatarinfo` as the broadcaster. The broadcaster and mods bypass the cooldown; the check is `isPrivileged(tags)`, reading the tmi badges and mod flag.
  3. **Stream Deck, silent route:** a button shows the OBS source. The page listens for OBS's `obsSourceVisibleChanged` event and opens when the source becomes visible. The streamer's multi-action is show → wait 12 s → hide. Opening this way bypasses the cooldown. The strip does not open when the page first loads.
- **Cooldown and bubble fallback:**
  - A pure `infoDecision(now, lastOpenAt, privileged, cooldownMs)` returns `'open'` or `'cooldown'`. Both pages call it on the same shared state: localStorage key `chat-avatars:info:lastOpenAt`, same origin for OBS local files and the dev server.
  - The strip page writes `lastOpenAt` when it opens, and writes a heartbeat (`chat-avatars:info:alive`) every 10 s.
  - The avatars overlay shows the help bubble for `!avatarinfo` when the decision is `'cooldown'`, or when the strip isn't alive (heartbeat older than 30 s, e.g. the source was never added).
  - The README says to leave "Shutdown source when not visible" unchecked on the strip source.
- **Debug:** with `?debug=1`, a click or keypress opens the strip, so it can be tested without chat.

## Settings (additions)

| Setting | Default | Notes |
|---|---|---|
| `spriteScale` | **2** (was 3) | Same `scale` URL param. |
| `brandColor` | `'#9b5cff'` | Strip banner and trim. Must be `#RRGGBB`; invalid values fall back. |
| `infoDurationMs` | 12 000 | How long the strip stays up. |
| `infoCooldownMs` | 60 000 | Cooldown for regular viewers. |
| `avatarChangeCooldownMs` | 10 000 | Per viewer. |

Set these in `overrides.ts`. Invalid override values fall back to the defaults, following the `crowdChatters` pattern.

## Error handling

- **Unknown `!avatar` words** show help and never throw.
- **Storage:** full, blocked or corrupted storage degrades to memory-only for the session.
- **Swaps:**
  - A swap arriving while the character is leaving saves the choice but doesn't swap.
  - A swap during a reaction or jump keeps the state machine as it is; only the layers change.
- **Strip without chat:** the strip still opens through Stream Deck or visibility.
- **Wrong-size PNG layers:** ignored with a warning, and that layer falls back to the painted sheet.
- **Resources:** textures are shared per sheet, not per viewer (about 30 sheets of 288x288). Only the current animation's sprites play.

## Testing

**Unit tests** (vitest, node environment, no Pixi):
- **Art:**
  - pixel kit shape bounds and outline pass
  - pose tables have one pose per frame for every row
  - every painted part stays inside its 48 px frame for every pose, build and species; this uses the same pure geometry approach as today's `armRects` test
  - contract: 6x6 grid of 48 px frames, `isSheetSize(288, 288)`
- **Looks:**
  - DNA v2: golden values, determinism, and a human share of 45-55% over 2,000 logins
  - `resolveLook` precedence
  - `layersFor` for every kind: sheet ids, roles and order, including the long-hair back layer and the no-accessory case
  - role-to-tint mapping
- **Chat:**
  - `parseAvatarCommand`: kinds, builds, aliases, case, unknown word, no word
  - `ChoiceStore`: round trip, corrupted JSON, the 2,000 cap, throwing storage
  - the change cooldown
- **Strip:** `infoDecision` and `isPrivileged`.

**Visual checks:**
1. **Phase 1 checkpoint:** every kind, build and hairstyle in all six rows on the preview page. The streamer signs off on the art before phase 2.
2. The overlay (production build) with fake chat that also sends `!avatar` commands.
3. The strip page in `?debug=1`: slide up and down, fully hidden, lineup correct.
4. The streamer checks in OBS. The README covers the strip source and both Stream Deck buttons.

## Build phases

- **Phase 1, the new characters:**
  - pixel kit and contract v3
  - painters, DNA v2 and `resolveLook` (without choices yet), `layersFor` and role tints
  - rendering integration and the retune
  - the preview page, then the art sign-off
- **Phase 2, choosing in chat:** `ChoiceStore`, `!avatar` with in-place swap, the `avatarinfo` strip page with its triggers, cooldown and fallback, the settings, and the README (OBS and Stream Deck setup).

Each phase gets its own implementation plan and PR.

## Out of scope

- The website editor, and choosing skin or hair in chat.
- AI or commissioned art. This spec defines the drop-in format.
- Live recoloring if a chatter changes their Twitch color mid-stream.
- Dancing to music.
- A Streamer.bot connection.
- Accessories on animals, where the collar plays that role.
