# Lurking: `!lurk` sits a viewer down to watch

Date: 2026-10-07 · Status: design approved in chat, awaiting spec review

## Goal

Viewers who are watching but not chatting can show up on stream without adding clutter. A viewer types `!lurk`; their avatar sits down and quietly watches, faded and behind the chatters, until they come back. It is opt-in, so nobody appears who didn't ask to, and it is the first of the "phase 2" commands (README) that add new animations. It also sets the pattern later interactions (`!hug`, `!highfive`, `!fight`) will follow for new sprite rows.

## Decisions (agreed with the streamer)

| Topic | Decision |
|---|---|
| Order | `!lurk` first; viewer-to-viewer interactions get their own spec afterwards. |
| Look | A real sitting pose: a new `sit` animation row, sheet format v5. |
| What ends a lurk | A chat message, `!jump`, `!unlurk`, or a timeout (setting, default 2 hours). |
| Where they sit | Wherever they are along the bottom, drawn behind standing avatars, about 60% opaque. No separate lurker area. |
| Where it lives | A `sit` state in the existing avatar state machine (approach A), not a separate lurker system or a display-only flag. |

## Behavior

### Starting

- `!lurk` from a viewer with no avatar on screen: their avatar walks in like any new chatter, then sits where it stops.
- `!lurk` from a viewer whose avatar is on screen: it stops where it is and sits. If it is mid-jump or mid-reaction, it sits once that finishes.
- `!lurk` from someone already lurking does nothing: their timeout is not reset, so repeating it can't keep them seated forever.
- `!lurk` shows no speech bubble, like every command.
- As the avatar sits, its name plate shows for 4 seconds so chat sees who is lurking, then fades out over 0.5 seconds and stays hidden while they lurk.

### While lurking

- The avatar plays `sit` (a slow breathing sway) at its spot, facing the way it was facing.
- Its character sprites (not the name plate) draw at 60% opacity and behind every standing avatar, whatever their depth.
- It ignores crowd hype and sad reactions: lurkers stay seated and calm.
- The normal idle timeout (`idleMinutes`) does not apply; the lurk timeout does.
- `!avatar`, `!skin` and `!avatarinfo` (and its aliases) work as usual and keep them seated: picking or checking a look is not "coming back".
- Commands the overlay doesn't know (another bot's `!uptime`, ...) are dropped before they reach the avatars, as today, so they don't stand a lurker up either.

### Ending

- **They chat** (any message that isn't a command), or **use `!jump`**: they stand up and are a normal avatar again. Their name plate shows again, opacity and depth return to normal, and the message or command plays out as usual (a message shows its bubble and talk animation; `!jump` jumps). The idle timeout starts counting from that moment.
- **`!unlurk`**: they stand up and are a normal avatar again, as above, without a bubble.
- **Timeout** (`lurkMinutes`, default 120, counted from when they sat): they stand up and walk off.
- **Lurker cap** (`maxLurkers`, default 10): when one more viewer lurks while the cap is full, the viewer who has lurked longest stands up and walks off.

### Counting

- Lurkers have their own cap and do not count toward `maxAvatars`, so lurking never pushes chatters off the stage, and chatters never evict lurkers.
- A lurker who stands up counts toward `maxAvatars` again from that moment, like any chatter.

### Not included

- Lurkers do not survive an OBS source refresh or overlay reload.
- No automatic lurker detection from Twitch join events (only logged-in viewers with chat open, batched about every 10 seconds, stops above 1,000 chatters, and bots join every channel).
- No seated versions of cheer, sad or talk.

## Architecture

### State machine (`src/avatars/stateMachine.ts`)

New state `sit` and new inputs:

- `onLurk()`: from `idle`, `wander` or `talk`, go to `sit` at the current x. From `entering`, sit once entering ends. From `jump` or `react`, sit when that finishes (the resume target becomes `sit`). Ignored while `sit`, `leaving` or `gone`.
- `onUnlurk()`: from `sit` to `idle`. Ignored otherwise.
- `onMessage()` from `sit`: stand up into `talk`, as from `idle`.
- `onJump()` from `sit`: stand up, then jump; the jump resumes into `idle`, not `sit`.
- `onReact()` while `sit`, or while waiting to sit: ignored.
- `beginLeave()` from `sit`: stand up and walk off (the existing `leaving` path).
- `Snapshot.anim` is `sit` in the `sit` state; `Snapshot.state` reads `sit`, so the manager can tell lurkers apart.

The machine stays pure: no timers of its own for the lurk timeout (the manager owns lurk timing, as it owns the idle timeout today).

### Manager (`src/avatars/manager.ts`)

- `lurk(event, now)`: get or spawn the viewer's avatar, record `lurkingSince = now` (only if not already lurking), call `machine.onLurk()`, and evict the longest lurker if this makes more than `maxLurkers`.
- `unlurk(event, now)`: call `machine.onUnlurk()` and clear `lurkingSince`.
- `handleMessage` and `jumpFor` clear a lurker's `lurkingSince` (the machine's own `onMessage` / `onJump` stand them up). `applyChoice` and the help bubble leave it alone, so look commands keep a lurker seated.
- The sweep skips the idle timeout for lurkers and instead calls `beginLeave()` once `now - lurkingSince > lurkTimeoutMs`.
- `evictIfFull()` (chatters) ignores lurkers; a new lurker-only eviction picks the smallest `lurkingSince`.
- Drawing (`Avatar`): while the machine reports `sit`, the sprite group's alpha is 0.6 and the container's `zIndex` is lowered below every standing avatar (standing avatars keep `zIndex = baseY`). The name plate shows for 4 s after sitting starts, then fades over 0.5 s; it reappears when they stand.
- Crowd reactions (`react`) skip lurkers.

### Commands (`src/app/bootstrap.ts`)

`commands.register('lurk', ...)` and `commands.register('unlurk', ...)`, calling the manager. `!jump` stands a lurker up through the machine; `!avatar`, `!skin` and `!avatarinfo` don't touch the lurk.

### Settings (`src/config`)

| Setting | URL param | Default | Range | Meaning |
|---|---|---|---|---|
| `lurkTimeoutMs` | `lurkMinutes` | 120 min | 1 to 1440 min | How long a lurker sits before standing up and walking off |
| `maxLurkers` | `maxLurkers` | 10 | 0 to 50 | Seated lurkers at once; 0 turns `!lurk` off |

Invalid values fall back to the previous layer, like every other setting.

### Fake chat (`src/app/fakeChat.ts`)

`debug=grid` sends `!lurk` now and then, and some lurkers later chat, so sitting, the cap and standing up can be checked without a live channel.

## Art contract change

### New row

| Row | Animation | Frames | FPS |
|---|---|---|---|
| 6 | sit | 4 | 2 |

Sheets become 288 x 336 px (6 columns x 7 rows of 48 x 48 frames): **sheet format v5**. A PNG of the old 288 x 288 size is ignored with the existing warning, and the built-in art is used for that layer. `src/assets/sprites/` holds no PNGs today, so nothing on stream changes.

### Pose

`POSES.sit` in `src/render/sprites/poses.ts`, one table for humans and animals:

| Frame | dy | squash | seated | arms | face |
|---|---|---|---|---|---|
| 1 | 0 | 1 | yes | down | normal |
| 2 | 0 | 1 | yes | down | normal |
| 3 | 0 | 0 | yes | down | normal |
| 4 | 0 | 0 | yes | down | normal |

- `Pose` gains `seated`. Humans and animals need different drops to reach the ground (a human's hips sit higher than an animal's round body), so each art module adds its own seat drop to the upper body: 4 px for humans, 1 px for animals. `squash` on top of that is the 1 px breathing sway.
- With those drops, every build's hips and legs and every animal's haunch end exactly on the ground row (46), never below (checked against the real part rasterization).
- Humans draw seated legs on the `human-<build>-pants` layer; skin, shirt, face, hair and accessory follow the squash like other poses.
- Animals draw the seated haunch on the fur sheet and its details sheet; the collar follows the squash.
- The ground anchor (y = 46) stays where it is: seated characters sit on the same ground line.
- README: the animation table, the per-frame motion table, and the sheet size (v5) are updated, with a note that v4 PNGs need a seventh row.

## Error handling

- `!lurk` with `maxLurkers` = 0: ignored, no bubble.
- `!unlurk` from someone not lurking: ignored.
- A lurker evicted, timed out or leaving: stands up first, then leaves through the existing `leaving` path, so the despawn code is unchanged.
- An `!avatar` swap on a lurker rebuilds its layers with the `sit` row, so it stays seated.

## Testing

- `stateMachine.test.ts`: lurk from idle, wander, talk, entering (sits after entering), jump and react (sits after they finish); message stands up into talk; jump stands up and resumes into idle; reactions ignored while seated or waiting to sit; unlurk; beginLeave from sit; snapshot anim and state.
- Manager lurk rules as pure helpers where possible (lurker eviction order, timeout selection, idle sweep skipping lurkers), unit-tested; the Pixi drawing is checked by eye.
- `resolveConfig.test.ts`: the two settings, defaults, ranges and fallbacks.
- `contract.test.ts` / `poses.test.ts`: the 7-row sheet size and the `sit` row (frame count, ground anchor kept).
- Art: every human build and hairstyle and every animal shown seated on `sheet-preview.html`, signed off by the streamer before the overlay work lands.
- In the built overlay with `debug=grid`: lurkers sit behind and faded, names fade after 4 s, the cap evicts the longest lurker, chatting stands a lurker up with their bubble, `!jump` stands and jumps, and crowd waves leave lurkers seated.

## Out of scope

- Viewer-to-viewer interactions (`!hug`, `!highfive`, `!fight`): next spec.
- Seated cheer, sad or talk animations.
- Persisting lurkers across overlay reloads.
- Automatic lurker detection from Twitch join events.
