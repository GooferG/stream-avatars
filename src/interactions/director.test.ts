import { describe, expect, it } from 'vitest'
import { AvatarStateMachine } from '../avatars/stateMachine'
import type { ChatCommandEvent, ChatMessageEvent } from '../chat/types'
import type { EffectCue } from '../render/effects/effectMotion'
import { MemoryStorage } from '../test/fakes'
import { mulberry32 } from '../utils/rng'
import { InteractionDirector, type DirectorView, type StageCharacter } from './director'
import { InteractionStore } from './interactionStore'

const BOUNDS = { minX: 0, maxX: 1920 }
const capitalized = (login: string) => login.charAt(0).toUpperCase() + login.slice(1)

const message = (login: string): ChatMessageEvent => ({
  login,
  displayName: capitalized(login),
  color: null,
  text: '',
  emotes: [],
  messageId: null,
  timestamp: 0,
  tags: {},
})
const command = (name: string, login: string, ...args: string[]): ChatCommandEvent => ({
  name,
  args,
  message: message(login),
})

/** A stand-in stage with real state machines: characters stand where they're put. */
function setup(rng: () => number = () => 0.25) {
  const chars = new Map<string, StageCharacter>()
  const lurking = new Set<string>()
  const said: string[] = []
  const cues: EffectCue[] = []
  const store = new InteractionStore(new MemoryStorage())
  const onStage = (c: StageCharacter | undefined): c is StageCharacter =>
    c !== undefined && c.machine.state !== 'leaving' && c.machine.state !== 'gone'
  const add = (login: string, x: number): StageCharacter => {
    const machine = new AvatarStateMachine({ bounds: BOUNDS, walkSpeed: 100, bubbleDurationMs: 5000, rng: mulberry32(7) })
    machine.beginScript() // place it: run to x instantly, then stand idle there
    machine.runTo(x, 1e9)
    machine.update(1)
    machine.endScript()
    const c: StageCharacter = { login, displayName: capitalized(login), labelText: capitalized(login), machine, groundY: 1080 }
    chars.set(login, c)
    return c
  }
  const view: DirectorView = {
    onScreen: () => [...chars.values()].filter(onStage),
    find: (login) => {
      const c = chars.get(login)
      return onStage(c) ? c : null
    },
    sender: (event) => {
      lurking.delete(event.login) // a command stands a lurker up, like !jump
      const c = chars.get(event.login) ?? add(event.login, 960)
      return onStage(c) ? c : null
    },
    isLurking: (login) => lurking.has(login),
    touch: () => {},
    say: (login, text) => said.push(`${login}: ${text}`),
    cue: (cue) => cues.push(cue),
  }
  const director = new InteractionDirector({
    view,
    store,
    bounds: BOUNDS,
    spriteScale: 2,
    interactionCooldownMs: 15_000,
    targetCooldownMs: 30_000,
    challengeTimeoutMs: 30_000,
    rng,
  })
  let now = 0
  return {
    director,
    store,
    lurking,
    said,
    cues,
    add,
    now: () => now,
    state: (login: string) => chars.get(login)?.machine.state,
    run(seconds: number) {
      for (let i = 0; i < Math.round(seconds * 60); i++) {
        now += 1000 / 60
        for (const c of chars.values()) c.machine.update(1 / 60)
        director.update(1 / 60, now)
      }
    },
  }
}

describe('InteractionDirector', () => {
  it('high-fives: both run to meet, a spark shows, and both go back to normal', () => {
    const s = setup()
    s.add('alice', 400)
    const bob = s.add('bob', 1000)
    s.director.pair('highfive', command('highfive', 'alice', '@bob'), s.now())
    expect(s.state('alice')).toBe('scripted')
    expect(s.director.isBusy('bob')).toBe(true)
    s.run(5)
    expect(s.cues.map((c) => c.name)).toEqual(['spark'])
    expect(s.state('alice')).toBe('idle')
    expect(bob.machine.where().x).toBe(728)
    expect(s.director.isBusy('alice')).toBe(false)
    expect(s.said).toEqual([])
  })

  it('tells the sender why a pair command cannot happen', () => {
    const s = setup()
    s.add('alice', 400)
    s.add('bob', 1000)
    s.add('carol', 1500)
    s.lurking.add('carol')
    s.director.pair('hug', command('hug', 'alice'), s.now())
    s.director.pair('hug', command('hug', 'alice', '@nobody'), s.now())
    s.director.pair('hug', command('hug', 'alice', 'carol'), s.now())
    s.store.setOptedOut('bob', true)
    s.director.pair('hug', command('hug', 'alice', 'Bob'), s.now())
    s.director.pair('hug', command('hug', 'alice', '@alice'), s.now()) // yourself: silent
    expect(s.said).toEqual([
      'alice: who? try !hug @name',
      "alice: nobody isn't here",
      'alice: Carol is lurking',
      'alice: Bob opted out',
    ])
  })

  it('tells an opted-out sender how to opt back in, walking them in to say so', () => {
    const s = setup()
    s.add('bob', 1000)
    s.store.setOptedOut('alice', true)
    s.director.pair('hug', command('hug', 'alice', 'bob'), s.now())
    expect(s.said).toEqual(['alice: you opted out (!interact)'])
    expect(s.state('alice')).toBe('idle')
  })

  it('plays one high-five when two people high-five each other at the same moment', () => {
    const s = setup()
    s.add('alice', 400)
    s.add('bob', 1000)
    s.add('carol', 1500)
    s.director.pair('highfive', command('highfive', 'alice', 'bob'), s.now())
    s.director.pair('highfive', command('highfive', 'bob', 'alice'), s.now()) // bob is busy: silent
    s.director.pair('highfive', command('highfive', 'carol', 'bob'), s.now())
    expect(s.said).toEqual(['carol: Bob is busy'])
    s.run(5)
    expect(s.cues.filter((c) => c.name === 'spark')).toHaveLength(1)
  })

  it('keeps a sender to one interaction per cooldown, and a target to one per target cooldown', () => {
    const s = setup()
    s.add('alice', 400)
    s.add('bob', 1000)
    s.add('carol', 1500)
    s.director.pair('hug', command('hug', 'alice', 'bob'), s.now())
    s.run(6)
    s.director.pair('hug', command('hug', 'alice', 'carol'), s.now()) // alice cooling down: silent
    s.director.pair('hug', command('hug', 'carol', 'bob'), s.now()) // bob just hugged: silent
    expect(s.state('carol')).not.toBe('scripted')
    expect(s.said).toEqual([])
    s.run(10)
    s.director.pair('hug', command('hug', 'alice', 'carol'), s.now())
    expect(s.state('carol')).toBe('scripted')
  })

  it('fights once the target accepts, and the winner shows their record', () => {
    const s = setup(() => 0.25)
    s.add('alice', 400)
    s.add('bob', 1000)
    s.director.pair('fight', command('fight', 'alice', '@bob'), s.now())
    expect(s.said).toEqual(['bob: Alice wants to fight! !accept'])
    expect(s.state('alice')).not.toBe('scripted')
    s.run(1)
    s.director.accept(message('bob'), s.now())
    expect(s.state('alice')).toBe('scripted')
    s.run(10)
    expect(s.said).toContain('alice: Alice wins! (1-0)')
    expect(s.store.record('bob')).toEqual({ wins: 0, losses: 1 })
    expect(s.cues.filter((c) => c.name === 'cloud')).toHaveLength(1)
    expect(['idle', 'wander']).toContain(s.state('bob'))
  })

  it('fights when the target fights back instead of typing !accept', () => {
    const s = setup()
    s.add('alice', 400)
    s.add('bob', 1000)
    s.director.pair('fight', command('fight', 'alice', 'bob'), s.now())
    s.director.pair('fight', command('fight', 'bob', '@alice'), s.now())
    expect(s.state('bob')).toBe('scripted')
    expect(s.said).toEqual(['bob: Alice wants to fight! !accept'])
  })

  it('does nothing on !accept without a live challenge', () => {
    const s = setup()
    s.add('alice', 400)
    s.add('bob', 1000)
    s.director.accept(message('bob'), s.now())
    s.director.pair('fight', command('fight', 'alice', 'bob'), s.now())
    s.run(31)
    s.director.accept(message('bob'), s.now())
    expect(s.state('bob')).not.toBe('scripted')
  })

  it('hands the sender back when the target leaves before they meet', () => {
    const s = setup()
    s.add('alice', 400)
    const bob = s.add('bob', 1000)
    s.director.pair('hug', command('hug', 'alice', 'bob'), s.now())
    s.run(0.5)
    bob.machine.beginLeave()
    s.run(0.1)
    expect(s.state('alice')).toBe('idle')
    expect(s.director.isBusy('alice')).toBe(false)
  })

  it('stops a fight on !nointeract, records nothing, and confirms it', () => {
    const s = setup()
    const alice = s.add('alice', 400)
    s.add('bob', 1000)
    s.director.pair('fight', command('fight', 'alice', 'bob'), s.now())
    s.director.accept(message('bob'), s.now())
    s.run(2.5) // mid-brawl
    s.director.setOptedOut(message('bob'), true, s.now())
    expect(s.state('alice')).toBe('idle')
    expect(alice.machine.update(0).hidden).toBe(false)
    expect(s.store.record('alice')).toEqual({ wins: 0, losses: 0 })
    expect(s.said.at(-1)).toBe('bob: interactions off')
    s.run(31)
    s.director.pair('hug', command('hug', 'alice', 'bob'), s.now())
    expect(s.said.at(-1)).toBe('alice: Bob opted out')
  })

  it('drops pending challenges on !nointeract, even after !interact', () => {
    const s = setup()
    s.add('alice', 400)
    s.add('bob', 1000)
    s.director.pair('fight', command('fight', 'alice', 'bob'), s.now())
    s.director.setOptedOut(message('bob'), true, s.now())
    s.director.setOptedOut(message('bob'), false, s.now())
    s.director.accept(message('bob'), s.now())
    expect(s.state('bob')).not.toBe('scripted')
    expect(s.said.at(-1)).toBe('bob: interactions on')
  })

  it('confirms !nointeract only to someone on screen', () => {
    const s = setup()
    s.director.setOptedOut(message('ghost'), true, s.now())
    expect(s.said).toEqual([])
    expect(s.store.isOptedOut('ghost')).toBe(true)
  })
})
