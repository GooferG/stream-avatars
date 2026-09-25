# Chat Reactions: cheer and sad crowd moments

Date: 2026-09-25 · Status: design approved in chat, awaiting spec review

## Goal

When chat collectively pops off ("W", "LETS GO", "POG"...), the avatars throw their arms up and cheer. When chat spams loss words ("L", "F", "RIP"...), they droop sadly. A chatter's own avatar reacts to their message right away; when several chatters do it together, the whole crowd reacts. The point is to make chat's mood visible on stream and give viewers instant feedback that their messages move the characters.

## Decisions (agreed with the streamer)

| Topic | Decision |
|---|---|
| Who reacts | Both: the sender's avatar reacts personally, and the whole crowd reacts when enough chatters do. |
| What counts as hype | An editable hype word list **plus** any message chat repeats. |
| Sad spam | Its own sad reaction (droopy eyes, worried brows, frown, tear, slump), driven by an editable sad word list. |
| Arms | Always visible (mockup option A): every animation gets arms, not just the cheer. |
| Crowd threshold | Small chat: 3 different chatters within 10 seconds. |
| Where detection lives | Inside the overlay (approach 1), as a pure, unit-tested module. |

Visual reference: the approved mockup is `.superpowers/brainstorm/1164-1790342722/content/cheer-sad-look.html` (option A + sad row).

## Behavior

### Message normalization

`normalizeMessage(text): string[]` turns a message into its cleaned words:

1. Lowercase.
2. Replace every character that is not `a-z`, `0-9` or whitespace with a space (punctuation, emoji, non-Latin text).
3. Collapse runs of the same character: `wwww` -> `w`, `gooo` -> `go`, `gg` -> `g`.
4. Split on whitespace and drop empty strings.
5. Keep only the first occurrence of each word, in order: `lets go lets go` -> `[lets, go]`.

Word-list entries are normalized with the same function, so matching is always like for like (`gg` in the list becomes `g`, and so does a typed `GGGG`). Twitch emotes arrive as plain words in the message text, so `PogChamp` -> `pogchamp` matches a list entry of the same name.

### Classifying a message

- **List mood.** A list entry matches when all its normalized words appear consecutively in the message's normalized words. Single-word entries therefore match anywhere ("W streamer" is hype). A message matching both lists (e.g. "W or L?") has no list mood.
- **Repeat key.** When the message has 1 to 3 normalized words (`MAX_REPEAT_WORDS = 3`, a constant), its key is the words joined by a space. Longer messages have no key.
- `!commands` never reach classification: `BaseChatSource` already emits them as `command` events, not `message` events.
- A message that normalizes to no words is ignored entirely.

### Personal reaction

Every message with a list mood makes its sender's avatar react with that mood for `selfReactionMs` (default 2000). It is skipped if the sender has no avatar, or the avatar is walking in (`entering`), leaving, or mid-jump.

### Crowd reaction

`ChatMood` remembers each classified message as `{ login, at, mood, key }` for `crowdWindowMs` (default 10 000), pruning older entries on every message and never holding more than 500 entries.

After recording a message, for each mood whose cooldown has elapsed:

- **Crowd cheer** fires when at least `crowdChatters` (default 3) **distinct logins** in the window sent cheer-list messages, **or** sent the same repeat key where that key has no list mood (e.g. a new meme like "caught").
- **Crowd sad** fires when at least `crowdChatters` distinct logins in the window sent sad-list messages.
- A repeated sad word is already covered by the sad count, and a repeated hype word by the cheer count.

Each mood has its own cooldown, `crowdCooldownMs` (default 15 000), counted from the moment that mood's crowd reaction fired: a clutch then a loss can go cheer then sad immediately, but a long W wave cannot cheer continuously. The window (10 s) is shorter than the cooldown (15 s), so stale messages cannot re-trigger once the cooldown ends. One person spamming only ever counts once.

When a crowd reaction fires for the same mood as the current message, the personal reaction for that message is dropped (the crowd reaction already includes that avatar).

The crowd plays the mood on every eligible avatar for `crowdReactionMs` (default 4000). Each avatar first waits a random 0-400 ms (`CROWD_RIPPLE_MS`, a constant), so the crowd erupts in a quick ripple instead of in lockstep.

### Default word lists

- Hype: `w`, `lets go`, `letsgo`, `lfg`, `pog`, `poggers`, `pogchamp`, `pogu`, `hype`, `clutch`, `gg`, `ez`, `sheesh`, `goated`
- Sad: `l`, `f`, `o7`, `rip`, `ripbozo`, `sadge`, `biblethump`, `notlikethis`, `unlucky`, `pain`

## Architecture

```
chat source --message--+--> AvatarManager.handleMessage   (bubble + talk, unchanged)
                       +--> ChatMood.observe --Reaction[]--> AvatarManager.react
                                                               +--> AvatarStateMachine.onReact
                                                                      +--> cheer / sad animation
```

### New: `src/chat/mood.ts`

Pure logic, with no Pixi, DOM or timers. Time comes in as the `now` argument, so tests control the clock.

```ts
export type Mood = 'cheer' | 'sad'

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

export function normalizeMessage(text: string): string[]

export class ChatMood {
  constructor(options: MoodOptions)
  /** Records one chat message and returns the reactions it causes (possibly none). */
  observe(message: { login: string; text: string }, now: number): Reaction[]
}
```

### Changed units

- **`render/sprites/contract.ts`** becomes the single source of animation names: `export type AnimName = keyof typeof ANIMATIONS`. It adds `cheer` (row 4) and `sad` (row 5), sets `SHEET_ROWS = 6`, and adds a pure `isSheetSize(width, height)` check.
- **`avatars/stateMachine.ts`**:
  - Imports `AnimName` from the contract instead of declaring its own union.
  - New state `react`, and `onReact(mood, durationSec, delaySec = 0)`:
    - Ignored while `entering`, `jump`, `leaving` or `gone`.
    - A delayed reaction counts down in `update()` and applies only if the avatar is still eligible when the delay ends.
    - While reacting the avatar stands still, and a new chat message does not switch it to `talk`. When the timer ends it goes to `idle`.
  - `onJump` from `react` resumes `react` after landing, with the remaining time: `react` joins the resume states.
  - `beginLeave` overrides `react`.
  - The snapshot's `anim` is the mood name while reacting.
- **`avatars/avatar.ts`**: builds one animation group per key of `ANIMATIONS` instead of four hard-coded ones. Adding `dance` later needs no edit here.
- **`avatars/manager.ts`**: new `react(reaction: Reaction)`.
  - `self` goes to that login's avatar.
  - `crowd` goes to every avatar, each with a random `CROWD_RIPPLE_MS` delay.
  - Unknown logins are ignored.
- **`render/sprites/loader.ts`**: `AnimationSet` becomes `Record<AnimName, Texture[]>` and slicing iterates `ANIMATIONS`. A PNG that fails `isSheetSize` logs a warning and uses the placeholder for that sheet.
- **`render/sprites/placeholder.ts`**:
  - `Pose` gains an `arms` pose (`down`, `swingA`, `swingB`, `mid`, `up`, `gesture`, `limp`) and a `face` (`normal`, `talk`, `happy`, `grin`, `sad`), replacing `mouthOpen`.
  - Each body declares its geometry (left and right edge, shoulder height, eye line). Shared `drawArms` and `drawFace` helpers do the drawing, so arms and faces are written once for all three bodies.
  - Frames per row:
    - idle: arms down, bobbing
    - walk: swingA/swingB alternating with the legs
    - jump: arms down -> mid -> up -> up -> mid -> down
    - talk: gesture on the open-mouth frames
    - cheer: mid/up with a hop and `happy`/`grin` faces (as mocked)
    - sad: limp arms, `sad` face, slow slump (as mocked)
  - Accessory sheets get rows 4-5 automatically, because accessories follow each pose's offsets.
- **`config/types.ts`, `defaults.ts`, `resolveConfig.ts`**: new settings below.
- **`app/bootstrap.ts`**: creates `ChatMood` from config and forwards each `message` event's reactions to `manager.react`.
- **`app/fakeChat.ts`** (debug=grid only): about every 30 s, 3-5 fake chatters send a hype or sad wave within a few seconds, so crowd reactions can be watched without a live chat.

### Settings

| Setting | Default | URL param | Notes |
|---|---|---|---|
| `hypeWords` | list above | none | Edit in `overrides.ts`; replaces the default list. Empty list disables cheers. |
| `sadWords` | list above | none | Edit in `overrides.ts`; replaces the default list. Empty list disables sad reactions. |
| `crowdChatters` | 3 | `crowdChatters` (2-50) | Distinct chatters needed for a crowd reaction. |
| `crowdWindowMs` | 10 000 | `crowdWindowSec` (2-120) | Memory window. |
| `crowdCooldownMs` | 15 000 | `crowdCooldownSec` (0-600) | Per mood. |
| `selfReactionMs` | 2000 | none | Personal reaction length. |
| `crowdReactionMs` | 4000 | none | Crowd reaction length. |

Out-of-range values fall back to the previous layer, like existing params. OBS local-file users set these in `overrides.ts`; URL params are for the dev server.

## Art contract change

Sheets grow from 192x128 to **192x192**: a 6x6 grid of 32x32 frames.

| Row | Animation | Frames | FPS |
|---|---|---|---|
| 0 | idle | 4 | 4 |
| 1 | walk | 6 | 10 |
| 2 | jump | 6 | 10 |
| 3 | talk | 4 | 6 |
| 4 | cheer | 4 | 6 |
| 5 | sad | 4 | 2 |

Arms (always visible) are part of each body sheet, drawn white or grey like the rest of the body so they take the body tint. The same goes for the tear in the sad row. No PNG sheets exist yet, so there is nothing to migrate. The README's sprite section is updated to the new layout.

## Error handling

- Invalid settings fall back to defaults, as with existing params.
- Messages that normalize to nothing (emoji only, non-Latin only) cause no reaction.
- Reactions for avatars that don't exist, or aren't eligible, are silently skipped. A crowd reaction with nobody on screen is a no-op.
- The mood memory is pruned per message and capped at 500 entries.
- The mood memory survives chat reconnects. Duplicate delivery is already filtered upstream by message id.
- Wrong-size sprite PNGs log a warning and fall back to the placeholder.

## Testing

Unit tests (vitest, node environment, no Pixi):

- `normalizeMessage`: `WWWW`, `LETS GOOOO LETS GO`, `PogChamp`, punctuation, emoji-only, non-Latin.
- `ChatMood`:
  - Personal reactions for hype and sad words; nothing for mixed messages or plain text.
  - 2 chatters -> nothing; 3 -> crowd; one chatter spamming counts once.
  - Entries expire after the window.
  - Cooldown blocks re-firing; cheer and sad cooldowns are independent.
  - A repeated unlisted key -> crowd cheer; a repeated "L" -> crowd sad; messages over 3 words never form a repeat.
  - Personal reaction dropped when the same-mood crowd fires.
  - The memory cap holds.
- `AvatarStateMachine`:
  - `onReact` from idle, wander and talk; ignored while entering, jumping or leaving.
  - The delay; back to idle after the duration; messages during react don't switch to talk.
  - Jump mid-react resumes react.
- Contract: 6 rows fit a 192x192 sheet; `isSheetSize`.
- Config: new params and validation.

Visual checks:

1. All six placeholder animations for the three bodies, with accessories, in the brainstorm browser for sign-off before any wiring.
2. `?debug=grid` with the new fake waves: screenshots of a personal cheer, a crowd cheer ripple and a crowd sad.
3. The streamer confirms in OBS. Browser-source `console.error` output lands in the OBS log if anything needs diagnosing.

## Out of scope

- Dancing to music (a later row 6 + mood, same path).
- Viewer customization site.
- Streamer.bot chat source.
- Excluding greetings from repeat detection (3x "hi" cheering is accepted).
- Replaying a reaction for an avatar that was still walking in when its sender hyped.
