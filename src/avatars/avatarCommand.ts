import { BUILDS, HAIR_STYLES, KINDS, SKIN_TONES, type Kind } from '../render/sprites/roster'
import type { Choice } from './look'

export type AvatarCommand = { type: 'pick'; choice: Choice } | { type: 'help' }

const HELP: AvatarCommand = { type: 'help' }

/** A Map, not an object literal, so words like "constructor" never match. */
const ALIASES = new Map<string, Kind>([
  ['person', 'human'],
  ['kitty', 'cat'],
  ['puppy', 'dog'],
  ['rabbit', 'bunny'],
])

/** The options, shown in a speech bubble; plain ASCII like everything the pixel font draws. */
export const AVATAR_HELP = `!avatar ${KINDS.join(' ')} | ${BUILDS.join(' ')} | ${HAIR_STYLES.join(' ')} | skin 1-${SKIN_TONES.length}`
export const SKIN_HELP = `!skin 1-${SKIN_TONES.length} (light to deep)`

/** A skin number as typed (1 = lightest) to a SKIN_TONES index, or undefined. */
function skinIndex(word: string): number | undefined {
  const n = /^\d+$/.test(word) ? Number(word) : 0
  return n >= 1 && n <= SKIN_TONES.length ? n - 1 : undefined
}

/**
 * `!avatar <words>`: any mix of one kind, one build, one hairstyle and one
 * skin number (1-6), in any order, case and punctuation ignored. A build,
 * hairstyle or skin number also makes the viewer human, since only humans
 * have them. Unknown words, two words of the same sort, or an animal with a
 * human-only word ask for help instead.
 */
export function parseAvatarCommand(args: readonly string[]): AvatarCommand {
  const choice: Choice = {}
  for (const arg of args) {
    const word = arg.toLowerCase().replace(/[^a-z0-9]/g, '')
    if (word === 'skin') continue // "skin 3", the way the help text reads
    const kind = ALIASES.get(word) ?? KINDS.find((k) => k === word)
    const build = BUILDS.find((b) => b === word)
    const hairStyle = HAIR_STYLES.find((h) => h === word)
    const skin = skinIndex(word)
    if (kind && !choice.kind) choice.kind = kind
    else if (build && !choice.build) choice.build = build
    else if (hairStyle && !choice.hairStyle) choice.hairStyle = hairStyle
    else if (skin !== undefined && choice.skin === undefined) choice.skin = skin
    else return HELP
  }
  const humanOnly = choice.build !== undefined || choice.hairStyle !== undefined || choice.skin !== undefined
  if (!humanOnly && !choice.kind) return HELP
  if (humanOnly) {
    if (choice.kind && choice.kind !== 'human') return HELP
    choice.kind = 'human'
  }
  return { type: 'pick', choice }
}

/** `!skin <1-6>`: the shortcut for picking only a skin tone. */
export function parseSkinCommand(args: readonly string[]): AvatarCommand {
  const skin = args.length === 1 ? skinIndex(args[0] ?? '') : undefined
  return skin === undefined ? HELP : { type: 'pick', choice: { kind: 'human', skin } }
}
