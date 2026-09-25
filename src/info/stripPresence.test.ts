import { describe, expect, it } from 'vitest'
import { StripPresence } from './stripPresence'

describe('StripPresence', () => {
  it('is ready once chat connects on a live source', () => {
    const presence = new StripPresence(true)
    expect(presence.ready).toBe(false)
    presence.onChatState('connected')
    expect(presence.ready).toBe(true)
  })

  it('is not ready while chat is down, so the overlay falls back to the help bubble', () => {
    const presence = new StripPresence(true)
    presence.onChatState('connected')
    presence.onChatState('reconnecting')
    expect(presence.ready).toBe(false)
    presence.onChatState('connected')
    expect(presence.ready).toBe(true)
  })

  it('is not ready while OBS has the source off the live output (a scene without the strip)', () => {
    const presence = new StripPresence(true)
    presence.onChatState('connected')
    presence.onLiveChanged(false)
    expect(presence.ready).toBe(false)
    presence.onLiveChanged(true)
    expect(presence.ready).toBe(true)
  })

  it('is never ready without a channel to hear !avatarinfo from', () => {
    const presence = new StripPresence(false)
    presence.onChatState('connected')
    expect(presence.ready).toBe(false)
  })
})
