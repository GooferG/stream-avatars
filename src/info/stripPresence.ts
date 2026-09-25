import type { ConnectionState } from '../chat/types'

/**
 * Whether a viewer's !avatarinfo would actually show the strip on stream:
 * the page has a channel, its chat connection is up, and OBS hasn't said
 * the source is off the live output (a scene without the strip). OBS only
 * reports changes, so a page that hasn't heard from OBS counts as live.
 * While not ready the strip ignores chat and tells the overlay, which then
 * shows the help bubble instead.
 */
export class StripPresence {
  private hasChannel: boolean
  private connected = false
  private live = true

  constructor(hasChannel: boolean) {
    this.hasChannel = hasChannel
  }

  get ready(): boolean {
    return this.hasChannel && this.connected && this.live
  }

  onChatState(state: ConnectionState): void {
    this.connected = state === 'connected'
  }

  onLiveChanged(live: boolean): void {
    this.live = live
  }
}
