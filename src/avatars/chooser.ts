import { choiceFromCommand, parseAvatarCommand } from './avatarCommand'
import type { ChoiceStore } from './choiceStore'
import type { AvatarStateName } from './stateMachine'

export type ChooseOutcome = 'help' | 'cooldown' | 'changed'

/**
 * `!avatar` rules: an unknown word asks for help; a real pick is saved
 * unless that viewer changed less than `cooldownMs` ago (then it's ignored).
 */
export class AvatarChooser {
  private store: ChoiceStore
  private cooldownMs: number
  private lastChangeAt = new Map<string, number>()

  constructor(store: ChoiceStore, cooldownMs: number) {
    this.store = store
    this.cooldownMs = cooldownMs
  }

  choose(login: string, args: readonly string[], now: number): ChooseOutcome {
    const command = parseAvatarCommand(args)
    if (command.type === 'help') return 'help'
    const last = this.lastChangeAt.get(login)
    if (last !== undefined && now - last < this.cooldownMs) return 'cooldown'
    this.lastChangeAt.set(login, now)
    this.store.update(login, choiceFromCommand(command))
    return 'changed'
  }
}

export type ChoiceAction = 'spawn' | 'swap' | 'swap-only' | 'wait'

/**
 * What a saved pick does to the chatter's character:
 * - `spawn`: walk in wearing it
 * - `swap`: swap in place with a hop
 * - `swap-only`: swap without disturbing a walk-in, reaction or jump in progress
 *   (a hop would cut the walk-in short and interrupt the reaction)
 * - `wait`: it's walking off; the pick shows on the next visit
 */
export function choiceAction(state: AvatarStateName | null): ChoiceAction {
  if (state === null) return 'spawn'
  if (state === 'leaving' || state === 'gone') return 'wait'
  return state === 'entering' || state === 'react' || state === 'jump' ? 'swap-only' : 'swap'
}
