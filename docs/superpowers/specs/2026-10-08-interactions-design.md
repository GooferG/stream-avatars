# Interactions: chatters high-five, hug, fight, and emote

Date: 2026-10-08 · Status: design approved in chat, awaiting spec review

## Goal

Chatters can make their characters interact with each other's on stream: `!highfive @bob` and both characters meet and slap hands; `!fight @bob` and, once bob agrees, a cartoon dust cloud decides a winner. Solo emotes (`!clap`, `!wave`, `!dance`, `!smoke`) and the streamer's `!sesh` give everyone something to do with their own character. Success: a command plays out within a few seconds of being typed, reads clearly at stream size for every kind (humans and the 8 animals), and cannot be used to spam or harass a particular viewer.

Built on the current pixel art. Poses are described by meaning (`arms: 'wave'`), not pixels, so they carry over if the puppet-rig art direction (spiked 2026-10-07, on hold) is picked up later.

## Decisions (agreed with the streamer)

| Topic | Decision |
|---|---|
| Version 1 | `!highfive`, `!hug`, `!fight` (+ `!accept`), `!clap`, `!wave`, `!dance`, `!smoke`, `!sesh`, `!nointeract` / `!interact`. `!bonk` and `!throw` come later. |
| Consent | High-five and hug happen right away. A fight needs the target to agree: `!accept`, or fighting back with `!fight <challenger>`. |
| Opt-out | `!nointeract` / `!interact`, remembered on this PC like `!avatar` picks. |
| Fight result | 50/50 coin flip. Each viewer's wins and losses are remembered; the winner's bubble shows them. |
| Smoke | `!smoke` (joint) and `!smoke bong`; `!sesh` (broadcaster and mods) lights up everyone on screen. A `smokeEnabled` setting turns both off. |
| Architecture | A scripted mode in the existing state machine, driven by a new pure choreographer (approach A). |

## Behavior

### Commands

| Command | What it does |
|---|---|
| `!highfive <name>` | Both characters meet and high-five. |
| `!hug <name>` | Both characters meet and hug. |
| `!fight <name>` | Challenges `<name>` to a fight. If `<name>` already challenged the sender, this accepts instead. |
| `!accept` | Accepts the newest pending fight challenge aimed at the sender. |
| `!clap`, `!wave`, `!dance` | Solo emotes; any words after them are ignored. |
| `!smoke`, `!smoke bong` | Solo emote with a joint, or with a bong when the first word is `bong`. |
| `!sesh` | Broadcaster and mods only: everyone on screen smokes a joint, in a ripple. |
| `!nointeract`, `!interact` | Opt out of pair interactions, and back in. |

Fighting back counts as accepting partly because StreamElements' points duel also uses `!accept`; fighting back always works even where `!accept` collides.

### Finding the target

The first word after the command, with one leading `@` removed, lowercased. It matches an on-screen character's login first, then its display name lowercased. A character that is walking off (`leaving`) does not count as on screen.

### Who can interact

A pair command (`!highfive`, `!hug`, `!fight`) goes ahead only when, checked in this order:

| Check | If it fails, a bubble over the sender says |
|---|---|
| The sender has not opted out | `you opted out (!interact)` |
| A name was given | `who? try !<command> @name` |
| The sender's per-sender cooldown has passed | nothing (silent) |
| The name matches an on-screen character | `<name> isn't here` |
| The target is not the sender | nothing (silent) |
| The target is not lurking | `<name> is lurking` |
| The target has not opted out | `<name> opted out` |
| The target is not in an interaction | `<name> is busy` |
| The target's per-target cooldown has passed | nothing (silent) |

`<name>` in a bubble is the character's name plate text. The sender's character spawns and walks in if it isn't on screen (like `!jump`), so the bubble always has somewhere to appear; a lurking sender stands up first. A sender's own interaction in progress also counts as busy: they cannot start a second one (silent).

### Cooldowns

- `interactionCooldownMs` (15 s): per sender, shared by high-five, hug and fight challenges. Starts only when one actually starts (a challenge counts when it is sent), so a typo doesn't lock anyone out.
- `targetCooldownMs` (30 s): after someone is high-fived, hugged or fought, nobody can target them for this long. Starts for both participants when the interaction starts.
- Solo emotes have no cooldown, like `!jump`.

### Meeting

- The meeting point is halfway between the two characters, clamped so both end spots stay at least `WALL_MARGIN` (40 px, as in the state machine) from the stage edges.
- Whoever is further left takes the left spot and faces right; the other takes the right spot and faces left. Spots are `gap / 2` either side of the meeting point, with `gap` per interaction in frame pixels times `spriteScale`: high-five 28, hug 16, fight 12 (starting values, tuned in Chrome).
- Both run at 180 stage px/s, playing `walk` at double speed. Whoever arrives first stands facing the other until both have arrived. After 8 s the interaction starts wherever they are.
- A sender still walking in from off screen runs from where they are.
- Starting an interaction counts as activity for both (`touch`), so neither times out or is the first evicted mid-interaction.

### High-five (about 2 s after meeting)

1. Both play `highfive` once and hold its last frame, for 1.2 s in all. On its slap frame (frame 3, 0.33 s in), a spark appears at hand height between them.
2. Both play `cheer` for 0.8 s, then return to normal behavior (idle).

### Hug (about 2.5 s)

Both play `hug` for 2.5 s at the hug gap, so they overlap slightly. Hearts rise from between them at 0.3 s, 0.9 s and 1.5 s. Then both return to normal behavior.

### Fight

**Challenge.** `!fight bob` from alice, passing the checks above, records a challenge that expires after `challengeTimeoutMs` (30 s) and starts alice's sender cooldown. Alice has at most one pending challenge; a new one replaces it. Bob may have several; `!accept` takes the newest. A bubble over bob says `alice wants to fight! !accept`. Expiry is silent.

**Accepting** re-checks both: on screen, not lurking, not in an interaction, not opted out. If any check fails, nothing happens. Accepting ignores both cooldowns, and `!accept` with no pending challenge does nothing. `!fight <name>` looks for a pending challenge from `<name>` to the sender before running the checks, so fighting back is always an accept. A challenge is dropped when its challenger leaves or opts out; every challenge to a viewer is dropped when they opt out or leave.

**Timeline** (about 8 s after meeting):

1. Meet at the fight gap; the target cooldown starts for both.
2. Brawl, 3 s: both characters, their shadows and name plates are hidden. A churning dust cloud about 100 × 50 frame px covers the meeting point, bobbing and drifting a few pixels. Every 0.25 s a poke (a white cartoon-glove fist, a shoe or a yellow star) pops out at a random point on its edge and vanishes.
3. Poof, 0.4 s: the cloud bursts into a few scattering puffs; both reappear in their spots.
4. Result, 3 s: the coin flip picks the winner. Their record is updated first, then they play `cheer` with a bubble `<name> wins! (<wins>-<losses>)`. The loser plays `dizzy` with three stars circling above their head. Then both return to normal behavior.

### Solo emotes

| Command | Animation | Duration |
|---|---|---|
| `!clap` | `clap`, looped | 2 s |
| `!wave` | `wave`, looped | 2 s |
| `!dance` | `dance`, looped, turning around every 0.5 s | 3 s |
| `!smoke` | `smoke`, played once; smoke puffs rise from the mouth when the exhale frames start | 4 s |
| `!smoke bong` | `bong`, played once; a bigger set of puffs on the exhale | 4 s |

- They play from idle, wander, talk and react. A lurker stands up to play them (like `!jump`). A character still walking in plays it once it arrives.
- Ignored while the same character is jumping, leaving, in an interaction, or already playing an emote. Chatting during an emote shows the bubble and the emote carries on.
- Crowd and self reactions (hype, sad) skip characters that are playing an emote or are in an interaction.
- `!sesh`: every on-screen character that is not lurking, leaving, in an interaction or already playing an emote plays `!smoke` after a random delay of 0 to 1.2 s. It never spawns a character, not even the sender's.
- With `smokeEnabled` off, `!smoke` and `!sesh` do nothing.

### Interruptions during an interaction

| Event | Result |
|---|---|
| Either participant chats | The bubble shows; the interaction carries on (as during a jump or walk-in). |
| `!jump` from either | Ignored until it is over. |
| `!lurk` from either | They sit once it is over (the existing "sit once this ends" path). |
| `!avatar` change | The look swaps in place without the hop; the interaction carries on. |
| `!nointeract` from either | The interaction stops; both return to normal behavior. No fight result is recorded. |
| Either starts leaving (evicted, timed out) | Same as above. Checked by the director every frame, so no leave path can be missed. |

During the brawl, a participant's chat bubble floats where their hidden character stands.

### `!nointeract` and `!interact`

`!nointeract` remembers the opt-out, stops the viewer's current interaction, and drops fight challenges from and to them. `!interact` removes the opt-out. If the viewer's character is on screen, a bubble confirms: `interactions off` or `interactions on`. Neither command spawns a character.

## Art

### Sheet format v6

The seven v5 rows keep their positions; eight rows are added, for 15 rows of 48 × 48 frames (288 × 720 px). A v5 PNG is rejected and the built-in art is used, as when v5 arrived.

| Row | Animation | Frames | fps | Notes |
|---|---|---|---|---|
| 7 | `highfive` | 4 | 6 | Front arm winds up, then raised up and forward; slap on frame 3 (index 2). |
| 8 | `hug` | 4 | 4 | Both arms out and around, happy face, slight lean. |
| 9 | `clap` | 4 | 8 | Hands meet in front of the chest, then apart. |
| 10 | `wave` | 4 | 6 | Front arm up, alternating tilt; other arm down. |
| 11 | `dance` | 6 | 6 | Existing arm shapes (up, mid, swing) with hops and leg lifts. |
| 12 | `dizzy` | 4 | 4 | Limp arms, spiral-eyes face, 1 px sway. |
| 13 | `smoke` | 6 | 1.5 | Raise to mouth, at mouth, at mouth with the ember bright, lower, chill, chill (exhale from index 4). |
| 14 | `bong` | 6 | 1.5 | Lift bong, mouth on it with bubbles, bubbles, lower, chill, chill (exhale from index 4). |

### Poses, faces and props

- `poses.ts`: new arm poses `reachUp`, `hug`, `clap`, `waveA`, `waveB`, `toMouth`, `holdFront`; new faces `dizzy` and `chill` (half-closed eyes, small smile); a new `dx` (whole-character sideways offset in frame px) for the dizzy sway. "Front arm" is the arm on the facing side.
- `humanArt.ts`, `animalArt.ts` and `faces.ts` draw them for every build and all 8 animals. One function per arm shape per art module, as today.
- Props (joint with an ember pixel, bong with bubbles) are a new top layer with fixed colors, drawn from the same pose table so they stay in the hand. One sheet per body template: `prop-skinny`, `prop-average`, `prop-chubby` for humans, `prop-animal` for every animal. Only the `smoke` and `bong` rows have pixels; the rest are transparent. `layersFor` adds the prop layer last.
- README sprite contract and anchors updated for v6 and the prop layer; the sheet preview page shows the new rows automatically.

### Effects

New code-drawn pixel art in fixed colors, on a new effect layer between the characters and the name plates, scaled by `spriteScale`, nearest-neighbor like everything else.

| Effect | Look | Life |
|---|---|---|
| Spark | 4-frame starburst | 0.4 s |
| Heart | Small pixel heart, rising and fading | 1.2 s |
| Dust cloud | About 100 × 50 frame px, 4 churning frames | the brawl |
| Pokes | Glove fist, shoe, yellow star | 0.2 s each |
| Puffs | Small circles scattering outward | 0.4 s |
| Dizzy stars | Three stars circling above the loser's head, following them | 3 s |
| Smoke puffs | Gray-white circles that rise, grow and fade | 1.5 s |

## Architecture

### New: `src/interactions/` (pure, tested, no Pixi)

- `target.ts`: `parseTarget(args)` and `findTarget(name, onScreen)`: login match first, then display name.
- `gate.ts`: `InteractionGate` runs the checks above in order and returns `ok` or the failing reason; owns both cooldowns (started only by `start`); `refusalText(reason, command, name)` gives the bubble.
- `challenges.ts`: `ChallengeBook`: `challenge`, `accept` (newest to a target), `fightBack` (an existing challenge from the target), `expire(now)`, `dropFor(login)`.
- `timeline.ts`: one `Interaction` per pair: given both start positions, the kind, `spriteScale` and an injected coin flip, `tick(dt)` returns the steps for each participant (run to x, face, play anim for seconds, hide or show) and the effect requests (`{ effect, x, y }`), and finally a result (`{ winner, loser }` for fights). `cancel()` ends it with no result.
- `director.ts`: `InteractionDirector` owns the gate, the challenge book, the active interactions and the store. It talks to the manager through a narrow interface (find an on-screen character, spawn or get the sender's, show a bubble, is lurking, end a lurk) and drives the state machines through their scripted mode. Each frame it ticks the interactions, cancels any whose participant is leaving or gone, and expires challenges.
- `interactionStore.ts`: opt-outs (`chat-avatars:nointeract:v1`) and fight records (`chat-avatars:fights:v1`) over the existing `SafeStorage`; validated on load, never throws, at most 2,000 viewers each (the oldest update is forgotten first), like `ChoiceStore`.

### New: `src/render/effects/`

- `effectArt.ts`: the code-drawn effect frames (tested like the sprite art).
- `effectLayer.ts`: the Pixi side: turns effect requests into pooled sprites, ticks their lifetimes, and caps live effect sprites at 64 (the oldest goes first).

### Changed

- `stateMachine.ts`: two new states. `scripted`, with `beginScript()`, `runTo(x, speed)`, `face(dir)`, `play(anim, seconds, { once })` (once: play through, then hold the last frame), `setHidden(bool)` and `endScript()` (to idle, or to sit when `!lurk` is waiting). `emote`, entered by `onEmote(anim, seconds, { once, turnEverySec })`, pending while entering. `onJump` and `onReact` are ignored in both. The snapshot gains `hidden` and `animSpeed`.
- `avatar.ts`: honors `hidden` (sprite group, shadow and name plate) and plays frames at `animSpeed`.
- `chooser.ts`: `choiceAction` returns `swap-only` (no hop) for `scripted` and `emote`.
- `manager.ts`: entry points for emotes and `!sesh`, lurk stand-up for senders, the director's narrow interface, and the director's per-frame tick from `update`.
- `contract.ts` (v6 rows), `poses.ts`, `faces.ts`, `humanArt.ts`, `animalArt.ts`, `roster.ts` (prop sheets and layer), `stage.ts` (effect layer).
- `bootstrap.ts`: registers the new commands; `!sesh` uses the existing `isPrivileged` (moved from `info/infoState.ts` to `chat/` now that the overlay uses it too).
- `config`: `interactionCooldownMs` (15000), `targetCooldownMs` (30000), `challengeTimeoutMs` (30000), `smokeEnabled` (true), in defaults, types, URL params and overrides like the existing settings.
- `fakeChat.ts` (`?debug=grid`): fake chatters also send the new commands to each other, including accepting challenges, about every 20 s.
- README: the new commands, the settings, sheet format v6 and the prop layer. The avatar builder spec (2026-10-07) lists the new commands in its command section.

## Performance

The overlay runs inside OBS's browser source on the streaming PC, next to a game and the encoder, so this feature must not add noticeable load.

- No per-frame allocations in the director or timelines; effect sprites are pooled and capped at 64.
- Texture memory grows from about 14 MB (35 sheets of 288 × 336) to about 32 MB (39 sheets of 288 × 720), a one-time GPU upload at startup.
- The empty-overlay short-circuit in `manager.update` stays, and the director's tick runs after it, so an empty overlay still does no per-frame work.
- Measured before and after on `?debug=grid` with 25 chatters: frame time in Chrome's performance panel, and the browser source's CPU in Windows Task Manager while OBS shows it. The numbers go in the PR.

## Error handling

- Unknown or malformed names, extra words, mixed case and a leading `@` are handled by `parseTarget`; anything that doesn't match is `<name> isn't here`.
- Corrupt or foreign data under either storage key loads as empty, like `ChoiceStore`.
- A participant destroyed between frames (the manager deletes `gone` avatars) is treated as leaving: the interaction is cancelled.
- A bubble never appears for a character that isn't on screen; `!nointeract` / `!interact` never spawn one.
- With `smokeEnabled` off, smoke commands are ignored silently.

## Testing

- `target.test.ts`: `@` and case handling, login before display name, no match, leaving characters excluded.
- `gate.test.ts`: every check in order with its reason and bubble text; cooldowns start only on `start`; the target cooldown covers both participants; silent reasons.
- `challenges.test.ts`: replace, expire, newest accept, fight-back accept, simultaneous mutual challenges, drop on leave and opt-out.
- `timeline.test.ts`: meeting spots (left/right, both edges, scales 1 and 2), the first arrival waits facing the other, the 8 s fallback, the spark on the slap frame, the hug's hearts, the fight's hidden phases, the coin flip deciding the result, `cancel` producing no result.
- `director.test.ts`: a participant leaving mid-interaction cancels it, `!nointeract` mid-fight records nothing, `!sesh` skips lurkers and busy characters, emotes from a lurker stand them up.
- `interactionStore.test.ts`: opt-out and record round trips, corrupt JSON, the 2,000 cap.
- `stateMachine.test.ts`: scripted enter and exit, `!jump` ignored while scripted, `!lurk` sits afterwards, emote durations, dance turning, emotes pending during the walk-in.
- `chooser.test.ts`, `resolveConfig.test.ts`, `contract.test.ts` (v6 size), the art tests (every sheet renders 15 rows; props line up with the hand for every build and the animal template), `effectArt.test.ts`.
- In Chrome with `?debug=grid`: every command watched at stream size for a human and an animal, plus a recorded GIF; the performance numbers above.

## Out of scope

- `!bonk` and `!throw` (props and projectiles; they reuse this machinery later).
- A fight leaderboard (`!fights` or a strip).
- Sound.
- A broadcaster or mod switch for all interactions (`smokeEnabled` covers smoke only).
- Interactions with seated lurkers.
- Special handling for a staggered strip (`stripHeight` above one character): participants meet at their own depths.
- The puppet-rig art direction.
