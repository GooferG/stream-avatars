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
    expect(resolveConfig(params('scale=-2'), {}).spriteScale).toBe(1.5)
  })

  it('takes sprite scales in half steps, 1.5 by default', () => {
    expect(resolveConfig(params(''), {}).spriteScale).toBe(1.5)
    expect(resolveConfig(params('scale=1'), {}).spriteScale).toBe(1)
    expect(resolveConfig(params('scale=2'), {}).spriteScale).toBe(2)
    expect(resolveConfig(params('scale=2.5'), {}).spriteScale).toBe(2.5)
    expect(resolveConfig(params('scale=3'), { spriteScale: 2 }).spriteScale).toBe(3)
  })

  it('rejects scales off the half steps or out of range, and bad overrides', () => {
    for (const bad of ['1.3', '0.5', '8.5', 'big']) {
      expect(resolveConfig(params(`scale=${bad}`), {}).spriteScale, bad).toBe(1.5)
    }
    expect(resolveConfig(params(''), { spriteScale: 1.25 }).spriteScale).toBe(1.5)
    expect(resolveConfig(params('scale=1.3'), { spriteScale: 2 }).spriteScale).toBe(2)
  })

  it('parses idleMinutes as fractional minutes', () => {
    expect(resolveConfig(params('idleMinutes=0.2'), {}).idleTimeoutMs).toBe(12_000)
    expect(resolveConfig(params('idleMinutes=nope'), {}).idleTimeoutMs).toBe(600_000)
  })

  it('resolves the lurk settings, turning minutes into ms', () => {
    const cfg = resolveConfig(params('lurkMinutes=30&maxLurkers=4'), {})
    expect(cfg.lurkTimeoutMs).toBe(1_800_000)
    expect(cfg.maxLurkers).toBe(4)
  })

  it('defaults to a 2 hour lurk and 10 lurkers', () => {
    const cfg = resolveConfig(params(''), {})
    expect(cfg.lurkTimeoutMs).toBe(7_200_000)
    expect(cfg.maxLurkers).toBe(10)
  })

  it('accepts maxLurkers=0, which turns !lurk off', () => {
    expect(resolveConfig(params('maxLurkers=0'), {}).maxLurkers).toBe(0)
  })

  it('rejects out-of-range lurk params', () => {
    expect(resolveConfig(params('lurkMinutes=0'), {}).lurkTimeoutMs).toBe(7_200_000)
    expect(resolveConfig(params('lurkMinutes=2000'), {}).lurkTimeoutMs).toBe(7_200_000)
    expect(resolveConfig(params('maxLurkers=51'), {}).maxLurkers).toBe(10)
    expect(resolveConfig(params('maxLurkers=-1'), {}).maxLurkers).toBe(10)
  })

  it('resolves the interaction settings, turning seconds into ms', () => {
    const cfg = resolveConfig(params('interactionCooldownSec=5&targetCooldownSec=60&challengeSec=45&smoke=0'), {})
    expect(cfg.interactionCooldownMs).toBe(5_000)
    expect(cfg.targetCooldownMs).toBe(60_000)
    expect(cfg.challengeTimeoutMs).toBe(45_000)
    expect(cfg.smokeEnabled).toBe(false)
  })

  it('defaults to 15 s per sender, 30 s per target, 30 s challenges and smoke on', () => {
    const cfg = resolveConfig(params(''), {})
    expect(cfg.interactionCooldownMs).toBe(15_000)
    expect(cfg.targetCooldownMs).toBe(30_000)
    expect(cfg.challengeTimeoutMs).toBe(30_000)
    expect(cfg.smokeEnabled).toBe(true)
  })

  it('accepts 0 cooldowns, which turn them off, and smoke=1 over an override', () => {
    const cfg = resolveConfig(params('interactionCooldownSec=0&targetCooldownSec=0&smoke=1'), { smokeEnabled: false })
    expect(cfg.interactionCooldownMs).toBe(0)
    expect(cfg.targetCooldownMs).toBe(0)
    expect(cfg.smokeEnabled).toBe(true)
  })

  it('rejects out-of-range interaction params and bad overrides', () => {
    expect(resolveConfig(params('challengeSec=2'), {}).challengeTimeoutMs).toBe(30_000)
    expect(resolveConfig(params('interactionCooldownSec=601'), {}).interactionCooldownMs).toBe(15_000)
    expect(resolveConfig(params('smoke=yes'), {}).smokeEnabled).toBe(true)
    expect(resolveConfig(params(''), { targetCooldownMs: -1 }).targetCooldownMs).toBe(30_000)
    expect(resolveConfig(params(''), { smokeEnabled: 'no' as unknown as boolean }).smokeEnabled).toBe(true)
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

  it('resolves reaction settings, turning seconds params into ms', () => {
    const cfg = resolveConfig(
      params('crowdChatters=4&crowdWindowSec=8&crowdCooldownSec=20'),
      {},
    )
    expect(cfg.crowdChatters).toBe(4)
    expect(cfg.crowdWindowMs).toBe(8_000)
    expect(cfg.crowdCooldownMs).toBe(20_000)
  })

  it('rejects out-of-range reaction params', () => {
    expect(resolveConfig(params('crowdChatters=1'), {}).crowdChatters).toBe(3)
    expect(resolveConfig(params('crowdWindowSec=999'), {}).crowdWindowMs).toBe(10_000)
    expect(resolveConfig(params('crowdCooldownSec=-5'), {}).crowdCooldownMs).toBe(15_000)
  })

  it('falls back when overrides set a crowd size that would fire on every message', () => {
    expect(resolveConfig(params(''), { crowdChatters: 0 }).crowdChatters).toBe(3)
    expect(resolveConfig(params(''), { crowdChatters: 1 }).crowdChatters).toBe(3)
    expect(resolveConfig(params(''), { crowdChatters: 5 }).crowdChatters).toBe(5)
  })

  it('lets overrides replace the word lists', () => {
    const cfg = resolveConfig(params(''), { hypeWords: ['goofergHype'], sadWords: [] })
    expect(cfg.hypeWords).toEqual(['goofergHype'])
    expect(cfg.sadWords).toEqual([])
  })

  it('keeps valid choice and info strip settings from overrides', () => {
    const cfg = resolveConfig(params(''), {
      brandColor: '#12AbEf',
      infoDurationMs: 8_000,
      infoCooldownMs: 0,
      avatarChangeCooldownMs: 30_000,
    })
    expect([cfg.brandColor, cfg.infoDurationMs, cfg.infoCooldownMs, cfg.avatarChangeCooldownMs])
      .toEqual(['#12AbEf', 8_000, 0, 30_000])
  })

  it('falls back to the defaults for invalid choice and info strip settings', () => {
    const cfg = resolveConfig(params(''), {
      brandColor: 'purple',
      infoDurationMs: 500,
      infoCooldownMs: -1,
      avatarChangeCooldownMs: Number.NaN,
    })
    expect([cfg.brandColor, cfg.infoDurationMs, cfg.infoCooldownMs, cfg.avatarChangeCooldownMs])
      .toEqual(['#9b5cff', 12_000, 60_000, 10_000])
    expect(resolveConfig(params(''), { brandColor: '#9b5cf' }).brandColor).toBe('#9b5cff')
    expect(resolveConfig(params(''), { infoDurationMs: 999_999_999 }).infoDurationMs).toBe(12_000)
  })
})
