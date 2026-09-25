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
| `scale` | `3` | Integer sprite scale (32px base, so 3 = 96px tall) |
| `walkSpeed` | `30-70` | Walk speed range in px/sec, e.g. `walkSpeed=40-90` |
| `bubbleMs` | `5000` | How long speech bubbles stay up |
| `bots` | `nightbot,streamelements,streamlabs,moobot,fossabot` | Comma-separated logins that never spawn avatars |
| `debug` | (off) | `debug=1` shows an fps/count overlay and a checkerboard background; `debug=grid` also spawns 25 fake chatters |

Example: `http://localhost:5173/?channel=gooferg&maxAvatars=15&idleMinutes=5`

## Sprite sheet contract

The placeholder characters are drawn at runtime, but real hand-drawn sheets can be dropped in **without any code changes**. Put PNG files in `src/assets/sprites/` named `body-0.png`, `body-1.png`, `body-2.png` and `accessory-0.png` through `accessory-3.png`, then rebuild. The build records which sheets exist, so the overlay never requests missing files at runtime (in OBS, each missing-file request took seconds and delayed the chat connection). Missing sheets fall back to the placeholders.

Each sheet must follow this layout:

- **192 x 192 px** PNG: a 6 x 6 grid of **32 x 32** frames. A sheet of any other size is ignored (with a console warning) and the built-in art is used.
- One animation per row, left to right:

| Row | Animation | Frames | FPS |
| --- | --- | --- | --- |
| 0 | idle | 4 | 4 |
| 1 | walk | 6 | 10 |
| 2 | jump | 6 | 10 |
| 3 | talk | 4 | 6 |
| 4 | cheer | 4 | 6 |
| 5 | sad | 4 | 2 |

- Unused cells in short rows (idle, talk, cheer, sad) are ignored.
- Arms are part of each body sheet and visible in every row (hanging at the sides when idle, swinging when walking, up when cheering, limp when sad).
- **Grayscale plus black outline.** White and gray pixels are tinted with the avatar's palette color at runtime (multiplicative tint), black outlines stay black. Draw the art in white with gray shading.
- Characters face **right**. Walking left is a horizontal flip, so avoid asymmetric details that would look wrong mirrored.
- Accessory sheets share the same grid and are drawn over the body, aligned to the same 32 x 32 frame origin. They get tinted with a separate accent color.
- **Eyes sit on row 16** of every body's frame (before any bounce or squash). Accessory sheets are shared by all bodies, so this is what makes face accessories like glasses line up on every body.
- Frame counts, rows, and sizes are defined in `src/render/sprites/contract.ts`. Palettes (body color plus accent color pairs) are in the same file.

## How avatars are generated

The lowercase login is hashed (FNV-1a 32) and the hash seeds a small PRNG that picks body, palette, accessory, walk speed, and standing depth in a fixed order. Same login, same avatar, every stream. The hash and draw order are locked by golden-value tests in `src/avatars/dna.test.ts`; changing either rerolls every viewer's avatar.

## Commands

- `!jump` makes your avatar jump.

Commands are a registry (`src/chat/commands.ts`); adding a new one is a single `register()` call in `src/app/bootstrap.ts`. Command messages do not show a speech bubble.

## Architecture

```
src/
  app/        bootstrap (composition root), fake chat for debug=grid
  chat/       ChatEventSource interface, tmi.js adapter, command registry
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
npm test          # vitest: DNA golden values, state machine, config, chat parsing, text utils
npx tsc -b        # strict typecheck
npm run build     # production build
```

## Phase 2 ideas (hooks already in place)

- Role flair: sub/mod/VIP badges from tmi.js tags (raw tags are already on every message event).
- Channel point redeems for cosmetics via Streamer.bot WebSocket or EventSub.
- More commands: `!dance`, `!hug @user`, emote rain.
- Avatar interactions: bump, wave at each other.
