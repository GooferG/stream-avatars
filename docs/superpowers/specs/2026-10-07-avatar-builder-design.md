# Avatar builder: a page viewers use to design their character

Date: 2026-10-07 (updated 2026-10-08 for interactions) · Status: spec approved 2026-10-08

## Goal

Viewers can design their character on a web page the streamer links them to, see exactly how it will look on stream, and copy one line to paste in chat. Today the only guide is the `!avatarinfo` strip, which is on screen for 12 seconds and hard to read; the page replaces squinting at it with a builder and plain instructions. Success: a viewer builds a look in under a minute, pastes one line, and the stream shows what the page showed.

Built after `!lurk` (see `2026-10-07-lurk-design.md`), so the page's instructions and preview include sitting.

## Decisions (agreed with the streamer)

| Topic | Decision |
|---|---|
| Hosting | GitHub Pages (the repo is public), deployed by a GitHub Action on every merge to `main`. |
| Where it lives | A third page in this repo, `builder.html`, reusing the overlay's art, roster, username look and `!avatar` parser (approach A), so it can't drift from the stream. |
| What's published | Only the builder page. The overlay and the strip stay local OBS files. |
| Exactness | The copied line always names every field, and `!avatar` gains `natural` so a color pick can be undone. |

## Behavior

### The page

Top to bottom:

1. **Title**: "Build your avatar for <channel>'s stream" (channel from `overrides.ts` at build time).
2. **Your Twitch name** (optional): typing it starts the builder from that viewer's username look (`lookDna`): kind, build, skin, hairstyle, hair color and accessory. Leading `@` and spaces are stripped; it is lowercased like chat logins. Without a name the builder starts from a fixed neutral look (human, average, short hair, skin 1) and notes: "Your accessory comes from your name. Type it above to see your exact character."
3. **Your name color** (optional): the color of their name in Twitch chat, which colors the shirt and the animal collar. Defaults to the username's fallback palette color (what the overlay uses for viewers who never set a color), or a neutral gray without a name.
4. **Preview**: the character large (4x, crisp), drawn with `characterSheets` and `drawCharacterFrame` exactly like the strip, cycling through the animations a viewer can see on their own character (idle, walk, jump, talk, cheer, sad, sit, and the emotes clap, wave, dance, smoke and bong), with buttons to pin one. The high-five, hug and dizzy rows are left out: they only make sense with a second character.
5. **Pickers**:
   - Kind: human and the 8 animals, as buttons.
   - Build, hairstyle, skin 1-6: shown only for humans.
   - Color: a swatch per color word (hair for humans, fur for animals) plus **natural** (the animal's natural fur, or the username's hair color for humans).
6. **Your line**: the `!avatar` line for the current picks, with a **Copy** button and "Paste it in chat. Changes need about <cooldown> seconds between them." (cooldown from `avatarChangeCooldownMs` at build time).
7. **Commands**: every viewer command with an example: `!avatar`, `!skin`, `!jump`, `!lurk`, `!unlurk`, `!avatarinfo`, `!highfive`, `!hug`, `!fight` and `!accept`, `!clap`, `!wave`, `!dance`, `!smoke`, `!nointeract` and `!interact` (not `!sesh`, which is for the streamer and mods).

Every change updates the preview and the line immediately. Nothing is sent anywhere: the page makes no network requests, and the name never leaves the browser.

### The line

The line names every field the builder shows, so a viewer's earlier picks (which `!avatar` merges with) can't leak through:

- Human: `!avatar human <build> <hairstyle> <skin 1-6> <color or natural>`, e.g. `!avatar human chubby bun 5 red`.
- Animal: `!avatar <animal> <color or natural>`, e.g. `!avatar fox natural`, `!avatar dog blue`.

Builds, hairstyles and skin numbers left over from earlier human picks stay saved while a viewer is an animal; they don't show, and the next human line overwrites them.

### `natural` (overlay change)

- `!avatar natural` (alone or with other words) clears the viewer's saved color: animals get their natural fur back, humans their username hair color.
- `natural` counts as the color word: `natural` together with a color word asks for help, like two colors do.
- The `!avatar` help bubble mentions it ("any color or natural") and still fits its 6 lines.
- The `!avatarinfo` strip's color row gains a **natural** chip.

### Linking it

- Optional `builderUrl` setting (overrides only, like `brandColor`): when set, the `!avatarinfo` strip shows "build yours: <builderUrl>" on its bottom line.
- The overlay reads chat but never posts, so a chat link is a bot command the streamer adds (Nightbot, StreamElements: `!build` -> the URL). The README says how.

## Architecture

### New

- `builder.html` (repo root, next to `avatar-info.html`).
- `src/builder/builderState.ts`, pure and tested:
  - `BuilderState`: kind, build, hairstyle, skin, color (a color word or `natural`), name color, login.
  - `initialState(login)`: from `lookDna(login)`, or the neutral look without a login.
  - `lookFor(state)`: the `Look` the stream will show (`resolveLook` over the username look).
  - `commandFor(state)`: the line, following the rules above.
- `src/builder/builderPage.ts`: DOM wiring (inputs, pickers, preview loop, copy button), no logic of its own beyond calling `builderState`.
- `src/builder/builder.css`: pixel style in the strip's family (Press Start 2P, `brandColor`), single column, readable on a phone (360 px wide and up).

### Changed

- `src/avatars/avatarCommand.ts`: `natural`, as above.
- `src/avatars/look.ts` / `choiceStore.ts`: a pick that clears the color removes the saved color instead of keeping it (the merge must not let an old color survive, and the saved JSON must not resurrect it).
- `src/info/stripPage.ts`, `avatar-info.html`, `strip.css`: the natural chip and the optional `builderUrl` line.
- `src/config`: `builderUrl` (string, default empty = not shown; overrides only).

### Build and deploy

- `vite.site.config.ts`: builds only `builder.html` to `dist-site/`, `base: './'`. Script `npm run build:site`.
- `.github/workflows/pages.yml`:
  - On pull requests: `npm ci`, `npm test`, `npm run build:site` (proves the page builds before merge).
  - On push to `main` (and manual runs): the same, then upload `dist-site/` and deploy with `actions/deploy-pages`.
- One-time manual step for the streamer: repo **Settings -> Pages -> Source: GitHub Actions**. The URL becomes `https://gooferg.github.io/stream-avatars/builder.html`.

## Error handling

- Copy fails (no clipboard permission): the line is selected so it can be copied by hand, and the button says "Selected: press Ctrl+C".
- A name with characters Twitch logins can't have: still works (`lookDna` takes any string), the page just normalizes `@`, spaces and case.
- A sheet PNG override missing on the site: the code-drawn art is used, as in the overlay.
- `builderUrl` empty or not a URL: the strip shows no link line.

## Testing

- `builderState.test.ts`:
  - `commandFor` for a human and for every animal, with a color and with `natural`.
  - Round trip: for a grid of states, `parseAvatarCommand(commandFor(state))` merged over several different earlier saved choices, resolved over the username look, equals `lookFor(state)`. This proves old picks can't leak.
  - `initialState` with and without a login, and login normalization.
- `avatarCommand.test.ts`: `natural` alone, with a kind, with a color (help), and the help bubble still fitting 6 lines.
- `choiceStore.test.ts`: clearing the color removes it from the saved choice and from the stored JSON.
- `resolveConfig.test.ts`: `builderUrl` default and fallback.
- In Chrome: the built page at desktop and 360 px widths: pickers, preview cycling, copy, a name's exact look matching the overlay for the same name and line.
- The workflow's PR run passes on the branch before merge; after merge, the deployed URL loads.

## Out of scope

- Saving a pick from the page directly (the overlay only listens to chat; no server, no login).
- Choosing an accessory (they come from the username; `!avatar` has no accessory words).
- A gallery of other viewers' avatars.
- Hosting the overlay itself on Pages.
