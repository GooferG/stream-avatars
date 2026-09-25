import { BUILDS, KINDS, type Build, type Kind } from '../render/sprites/roster'
import type { Choice } from './look'

export type AvatarCommand =
  | { type: 'kind'; kind: Kind }
  | { type: 'build'; build: Build }
  | { type: 'help' }
export type AvatarPick = Exclude<AvatarCommand, { type: 'help' }>

/** A Map, not an object literal, so words like "constructor" never match. */
const ALIASES = new Map<string, Kind>([
  ['person', 'human'],
  ['kitty', 'cat'],
  ['puppy', 'dog'],
  ['rabbit', 'bunny'],
])

/** The options, shown in a speech bubble; plain ASCII like everything the pixel font draws. */
export const AVATAR_HELP = `!avatar ${KINDS.join(' ')} | ${BUILDS.join(' ')}`

/** `!avatar <word>`: the first word picks a kind or a build (case and punctuation ignored). */
export function parseAvatarCommand(args: readonly string[]): AvatarCommand {
  const word = (args[0] ?? '').toLowerCase().replace(/[^a-z]/g, '')
  const kind = ALIASES.get(word) ?? KINDS.find((k) => k === word)
  if (kind) return { type: 'kind', kind }
  const build = BUILDS.find((b) => b === word)
  if (build) return { type: 'build', build }
  return { type: 'help' }
}

/** What a pick saves. A build also makes the viewer human, since only humans have builds. */
export function choiceFromCommand(command: AvatarPick): Choice {
  return command.type === 'kind' ? { kind: command.kind } : { kind: 'human', build: command.build }
}
