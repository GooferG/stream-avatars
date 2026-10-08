import { describe, expect, it } from 'vitest'
import { parseAvatarCommand, parseSkinCommand } from '../avatars/avatarCommand'
import { cooldownNote, titleFor, VIEWER_COMMANDS } from './builderText'

describe('titleFor', () => {
  it("names the channel when there's one", () => {
    expect(titleFor('gooferg')).toBe("Build your avatar for gooferg's stream")
    expect(titleFor('')).toBe('Build your avatar')
  })
})

describe('cooldownNote', () => {
  it('says how long to wait between changes, in whole seconds', () => {
    expect(cooldownNote(10_000)).toBe('Paste it in chat. Changes need about 10 seconds between them.')
    expect(cooldownNote(1_000)).toBe('Paste it in chat. Changes need about 1 second between them.')
    expect(cooldownNote(1_500)).toBe('Paste it in chat. Changes need about 2 seconds between them.')
  })

  it('leaves the wait out without a cooldown', () => {
    expect(cooldownNote(0)).toBe('Paste it in chat.')
  })
})

describe('VIEWER_COMMANDS', () => {
  it('lists every viewer command once, and not the mods-only !sesh', () => {
    expect(VIEWER_COMMANDS.map((c) => c.usage.split(' ')[0])).toEqual([
      '!avatar',
      '!skin',
      '!jump',
      '!lurk',
      '!unlurk',
      '!avatarinfo',
      '!highfive',
      '!hug',
      '!fight',
      '!accept',
      '!clap',
      '!wave',
      '!dance',
      '!smoke',
      '!nointeract',
      '!interact',
    ])
  })

  it('gives examples the overlay understands', () => {
    const args = (usage: string | undefined) => (usage ?? '').split(' ').slice(1)
    expect(parseAvatarCommand(args(VIEWER_COMMANDS[0]?.usage)).type).toBe('pick')
    expect(parseSkinCommand(args(VIEWER_COMMANDS[1]?.usage)).type).toBe('pick')
  })
})
