# Chat Avatars Overlay

An OBS browser source overlay for Twitch that shows active chatters as small pixel-art characters walking around the bottom of the stream. When someone chats, their avatar walks in, speaks their messages in a pixel speech bubble (Twitch emotes included), jumps on `!jump`, and walks off after going idle. Avatars are generated deterministically from the username, so regulars keep the same look every stream.

Built with Vite, React, TypeScript (strict), PixiJS v8, and tmi.js (anonymous read-only chat, no OAuth needed).

## Quick start

```
npm install
npm run dev
```

Then open `http://localhost:5173/?channel=yourchannel` in a browser, or add it to OBS (below).

## OBS setup

No server needed: OBS loads the production build straight from disk.

1. Set your channel in `src/config/overrides.ts` (local files can't take URL params), then run `npm run build`.
2. Add a new **Browser** source, tick **Local file**, and pick `dist/index.html`.
3. Width `1920`, height `1080`. Right-click the source > Transform > Fit to screen. It's transparent full-frame, and avatars stay in the bottom strip.
4. Leave "Shutdown source when not visible" **unchecked** so avatars persist across scene switches.
5. No custom CSS needed. The page background is transparent.

Rebuild after editing `overrides.ts` or adding sprite PNGs, then click **Refresh cache of current page** on the source. To use URL params instead, run `npm run dev` and point the source at `http://localhost:5173/?channel=gooferg`.

## URL parameters

Everything is configurable from the URL. Defaults live in `src/config/defaults.ts`, and `src/config/overrides.ts` is the single user-editable config file. Precedence: defaults, then overrides.ts, then URL params.

| Param | Default | Meaning |
| --- | --- | --- |
| `channel` | `gooferg` (from `overrides.ts`) | Twitch channel to join |
| `maxAvatars` | `25` | Cap on avatars; the longest-idle avatar is evicted when full |
| `idleMinutes` | `10` | No messages for this long: avatar walks off and despawns |
| `stripHeight` | `200` | Height in px of the bottom strip the avatars live in |
| `scale` | `2` | Integer sprite scale (48px frames, so 2 = 96px tall) |
| `walkSpeed` | `30-70` | Walk speed range in px/sec, e.g. `walkSpeed=40-90` |
| `bubbleMs` | `5000` | How long speech bubbles stay up |
| `bots` | `nightbot,streamelements,streamlabs,moobot,fossabot` | Comma-separated logins that never spawn avatars |
| `crowdChatters` | `3` | Different chatters needed (within the window) for the whole crowd to react |
| `crowdWindowSec` | `10` | How far back chat is remembered for crowd reactions |
| `crowdCooldownSec` | `15` | Per mood: wait this long before the crowd can react that way again |
| `debug` | (off) | `debug=1` shows an fps/count overlay and a checkerboard background; `debug=grid` also spawns 25 fake chatters |

Example: `http://localhost:5173/?channel=gooferg&maxAvatars=15&idleMinutes=5`

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
  - a cap tucks `bun` and `spiky` hair in: those looks use `hair-short` under `accessory-cap`
- **Human heads** sit in the same place for every build, so hair, face and accessory sheets fit all three. **Animals** share one body template, so a single collar fits every animal.
- Characters face **right**. Walking left is a horizontal flip.
- The art format lives in `src/render/sprites/contract.ts`, the roster (kinds, palettes, layer stacks) in `src/render/sprites/roster.ts`, and the code-drawn art in `humanArt.ts` and `animalArt.ts`.
- Preview everything with `npm run dev`, then open `/sheet-preview.html`.

**Anchors.** Layers only line up if replacement art keeps these rows (frame pixels on the idle frame, with the character centered on column 24):

| Anchor | Row | Sheets that must agree |
| --- | --- | --- |
| Ground (last row of the feet) | y = 46 | `human-<build>-pants` and every animal |
| Human head center | y = 16 (top of head y = 7) | `human-<build>-skin`, `hair-*`, `accessory-*` |
| Human eye row | y = 17 | `human-face`, `accessory-glasses` |
| Animal neck (top of collar) | y = 28 | every animal and `collar` |

**What goes on which layer.** Head and hands go on `skin`, torso and sleeves on `shirt`, legs and shoes on `pants`, and eyes, mouth, blush and tears on `human-face`. An animal sheet holds the whole animal, face included.

**Per-frame motion.** Every layer moves together frame by frame, so replacement art must follow the same pose per frame (from `src/render/sprites/poses.ts`). `dy` lifts the whole character (negative is up). `squash` sinks the head, torso, arms and collar by that many pixels while the feet stay put.

| Animation | (`dy`, `squash`) per frame | Also |
| --- | --- | --- |
| idle | (0,0) (-1,0) (-1,0) (0,0) | |
| walk | (0,0) (-1,0) (0,0) (0,0) (-1,0) (0,0) | feet alternate |
| jump | (0,3) (-2,0) (-4,0) (-4,0) (-2,0) (0,3) | arms up in the air |
| talk | (0,0) on every frame | mouth open on frames 2 and 4 |
| cheer | (0,0) (-2,0) (-3,0) (-1,0) | arms up, grinning |
| sad | (0,2) (0,2) (0,3) (0,3) | arms limp, tear |

**Replace sheets that share an anchor together.** A new head shape means new `human-<build>-skin` sheets plus matching `hair-*`, `human-face` and `accessory-*` sheets. A new animal body shape means a matching `collar`.

## How avatars are generated

The lowercase login is hashed (FNV-1a 32) into a small seeded PRNG that picks, in a fixed order:

- kind: about half humans, the rest split evenly across cat, dog, duck, frog, bunny, bear and fox
- build, skin tone, hairstyle and hair color
- a fallback color, accessory, walk speed and standing depth

Same login, same look, every stream. The hash and draw order are locked by golden values in `src/avatars/dna.test.ts` and `src/avatars/look.test.ts`; changing either rerolls every viewer's look.

Colors come from chat: human shirts and animal collars (and the name tag) wear the chatter's Twitch name color, lightened if it's too dark to see on stream. Accessories take whichever palette accent contrasts most with it. Viewers who never set a Twitch color get the fallback color their login hashes to.

## Commands

- `!jump` makes your avatar jump.

Commands are a registry (`src/chat/commands.ts`); adding a new one is a single `register()` call in `src/app/bootstrap.ts`. Command messages do not show a speech bubble.

## Chat reactions

Characters react to the mood of chat:

- **Cheer** (arms up, grin): a message containing a hype word makes the sender's character cheer for 2 seconds.
- **Sad** (droopy face, tear, slump): the same for sad words.
- **Crowd**: when 3 different chatters send hype (or sad) words within 10 seconds, every character on screen reacts for 4 seconds, in a quick ripple. Anything 3 chatters repeat word for word (up to 3 words, like a new meme) also counts as hype. Each mood then cools down for 15 seconds.

Matching ignores case, accents, apostrophes, punctuation and stretched letters (`WWWW` = `W`, `LET'S GOOOO` = `LETS GO`). Stretched letters collapse in your list entries too, so avoid entries that shrink into everyday words (`oof` becomes `of`). Twitch emotes are words, so emote names work in the lists. Commands like `!jump` never count. Characters still walking in finish their walk instead of reacting.

The default lists live in `src/config/defaults.ts`. To change them, set them in `src/config/overrides.ts` (they replace the defaults), then rebuild:

```ts
export const OVERRIDES: Partial<AppConfig> = {
  channel: 'gooferg',
  hypeWords: ['w', 'lets go', 'pog', 'goofergHype'],
  sadWords: ['l', 'f', 'rip'],
  crowdChatters: 4,
}
```

## Architecture

```
src/
  app/        bootstrap (composition root), fake chat for debug=grid
  chat/       ChatEventSource interface, tmi.js adapter, command registry, chat mood (reactions)
  avatars/    deterministic DNA generator, movement state machine, manager
  render/     Pixi stage, sprite sheets, speech bubbles, emotes, labels
  config/     defaults, overrides file, URL param resolution
  utils/      code-point-safe text helpers, seeded PRNG
```

Notes:

- The chat layer is an interface (`ChatEventSource`), so tmi.js can be swapped for a Streamer.bot WebSocket source (stubbed in `src/chat/streamerbotSource.ts`) or any other backend without touching avatars or rendering.
- The avatar map is keyed by login and survives reconnects, so a flaky connection never duplicates avatars. Duplicate message delivery is also filtered by message id.
- Twitch emote ranges index Unicode code points, not UTF-16 units. All message slicing goes through `src/utils/text.ts`.
- Rendering is one Pixi canvas: BitmapText everywhere, textures pre-sliced, emote textures in an LRU cache with proper destruction. 25 avatars run at a capped 60fps.
- The speech bubble font is Latin-only (Press Start 2P). Emoji and non-Latin characters are dropped from bubble text; Twitch emotes still render as images.

## Testing

```
npm test          # vitest: DNA golden values, state machine, config, chat parsing, chat mood, sprite art, text utils
npx tsc -b        # strict typecheck
npm run build     # production build
npm run dev       # then open /sheet-preview.html to review the built-in character art
```

## Phase 2 ideas (hooks already in place)

- Role flair: sub/mod/VIP badges from tmi.js tags (raw tags are already on every message event).
- Channel point redeems for cosmetics via Streamer.bot WebSocket or EventSub.
- More commands: `!dance`, `!hug @user`, emote rain.
- Avatar interactions: bump, wave at each other.
