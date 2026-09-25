import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from './defaults'
import { resolveConfig } from './resolveConfig'

const params = (q: string) => new URLSearchParams(q)

describe('resolveConfig', () => {
  it('returns defaults with empty params and overrides', () => {
    const cfg = resolveConfig(params(''), {})
    expect(cfg).toEqual(DEFAULT_CONFIG)
  })

  it('normalizes the channel name', () => {
    expect(resolveConfig(params('channel=%23GooferG'), {}).channel).toBe('gooferg')
    expect(resolveConfig(params('channel= GooferG '), {}).channel).toBe('gooferg')
  })

  it('applies precedence defaults < overrides < params', () => {
    const cfg = resolveConfig(params('maxAvatars=10'), {
      maxAvatars: 5,
      stripHeight: 300,
    })
    expect(cfg.maxAvatars).toBe(10) // param wins
    expect(cfg.stripHeight).toBe(300) // override wins
    expect(cfg.spriteScale).toBe(DEFAULT_CONFIG.spriteScale) // default
  })

  it('rejects invalid numbers and falls back', () => {
    expect(resolveConfig(params('maxAvatars=banana'), {}).maxAvatars).toBe(25)
    expect(resolveConfig(params('maxAvatars=0'), {}).maxAvatars).toBe(25)
    expect(resolveConfig(params('maxAvatars=9999'), {}).maxAvatars).toBe(25)
    expect(resolveConfig(params('scale=-2'), {}).spriteScale).toBe(3)
  })

  it('parses idleMinutes as fractional minutes', () => {
    expect(resolveConfig(params('idleMinutes=0.2'), {}).idleTimeoutMs).toBe(12_000)
    expect(resolveConfig(params('idleMinutes=nope'), {}).idleTimeoutMs).toBe(600_000)
  })

  it('parses walkSpeed as a lo-hi range', () => {
    expect(resolveConfig(params('walkSpeed=40-90'), {}).walkSpeedRange).toEqual([40, 90])
    expect(resolveConfig(params('walkSpeed=90-40'), {}).walkSpeedRange).toEqual([30, 70])
    expect(resolveConfig(params('walkSpeed=fast'), {}).walkSpeedRange).toEqual([30, 70])
  })

  it('parses the bot list, lowercased', () => {
    const cfg = resolveConfig(params('bots=NightBot,%20MyBot%20,'), {})
    expect(cfg.ignoredBots).toEqual(['nightbot', 'mybot'])
  })

  it('accepts only known debug modes', () => {
    expect(resolveConfig(params('debug=1'), {}).debug).toBe('1')
    expect(resolveConfig(params('debug=grid'), {}).debug).toBe('grid')
    expect(resolveConfig(params('debug=yes'), {}).debug).toBe('')
  })
})
