import type { ChatCommandEvent } from './types'

export type CommandHandler = (event: ChatCommandEvent) => void

/**
 * Adding a new chat command is one register() call in bootstrap.ts.
 * Unknown commands are ignored silently.
 */
export class CommandRegistry {
  private handlers = new Map<string, CommandHandler>()

  register(name: string, handler: CommandHandler): void {
    this.handlers.set(name.toLowerCase(), handler)
  }

  dispatch(event: ChatCommandEvent): void {
    this.handlers.get(event.name)?.(event)
  }
}
