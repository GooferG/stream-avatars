import { choiceFromCommand, parseAvatarCommand } from './avatarCommand'
import type { ChoiceStore } from './choiceStore'

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
