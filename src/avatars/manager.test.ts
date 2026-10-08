import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatMessageEvent } from '../chat/types'
import { DEFAULT_CONFIG } from '../config/defaults'
import type { AppConfig } from '../config/types'
import { AvatarManager, type ManagerOptions } from './manager'
import type { AvatarStateMachine } from './stateMachine'
import { InteractionStore } from '../interactions/interactionStore'
import { MemoryStorage } from '../test/fakes'
import type { Plate } from '../render/plateSpread'

/** Every character the manager put on stage, in order. */
const created = vi.hoisted(
  () =>
    [] as {
      login: string
      machine: AvatarStateMachine
      destroyed: boolean
      plate: Plate | null
      placed: number | null
    }[],
)

// Avatar and the speech bubble draw with Pixi, which the node test
// environment can't load. Stand-ins keep the manager's own rules (the caps,
// the lurk roster, the sweep) under test with the real state machine.
vi.mock('./avatar', () => ({
  Avatar: class {
    login: string
    displayName: string
    labelText: string
    groundY = 1080
    machine: AvatarStateMachine
    lastActiveAt: number
    destroyed = false
    container = {}
    constructor(
      options: { login: string; displayName: string; labelText: string; machine: AvatarStateMachine },
      now: number,
    ) {
      this.login = options.login
      this.displayName = options.displayName
      this.labelText = options.labelText
      this.machine = options.machine
      this.lastActiveAt = now
      created.push(this)
    }
    touch(now: number): void {
      this.lastActiveAt = now
    }
    update(dtSec: number) {
      return this.machine.update(dtSec)
    }
    setLayers(): void {}
    /** The name plate the test says is showing, and where the manager last put it. */
    plate: Plate | null = null
    placed: number | null = null
    nameplate(): Plate | null {
      return this.plate
    }
    placeNameplate(x: number | null): void {
      this.placed = x
    }
    showBubble(): void {}
    destroy(): void {
      this.destroyed = true
    }
  },
}))
vi.mock('../render/bubble', () => ({ buildBubble: async () => null }))

const stub = <T>(value: unknown): T => value as T

function setup(cfg: Partial<AppConfig>) {
  const manager = new AvatarManager({
    cfg: { ...DEFAULT_CONFIG, ...cfg },
    catalog: stub<ManagerOptions['catalog']>({ get: () => ({}) }),
    avatarLayer: stub<ManagerOptions['avatarLayer']>({ addChild: () => {} }),
    labelLayer: stub<ManagerOptions['labelLayer']>({}),
    bubbleLayer: stub<ManagerOptions['bubbleLayer']>({}),
    emoteCache: stub<ManagerOptions['emoteCache']>({}),
    stageWidth: 1920,
    stageHeight: 1080,
    choiceFor: () => null,
    interactionStore: new InteractionStore(new MemoryStorage()),
  })
  let now = 0
  return {
    manager,
    now: () => now,
    /** Advances the stage in 100ms frames. */
    run(seconds: number) {
      for (let i = 0; i < seconds * 10; i++) {
        now += 100
        manager.update(0.1, now)
      }
    },
  }
}

const ev = (login: string, text = 'hi'): ChatMessageEvent => ({
  login,
  displayName: login,
  color: null,
  text,
  emotes: [],
  messageId: null,
  timestamp: 0,
  tags: {},
})

const command = (name: string, login: string, ...args: string[]) => ({ name, args, message: ev(login) })
const stateOf = (login: string) => created.find((a) => a.login === login && !a.destroyed)?.machine.state

/** Characters that count toward maxAvatars: on stage, not walking off, not seated. */
const standing = () =>
  created
    .filter((a) => !a.destroyed && !['leaving', 'gone', 'sit'].includes(a.machine.state))
    .map((a) => a.login)
    .sort()

beforeEach(() => {
  created.length = 0
})

describe('AvatarManager lurkers and the chatter cap', () => {
  const comebacks = {
    chatting: (m: AvatarManager, now: number) => m.handleMessage(ev('lurker', 'back!'), now),
    '!jump': (m: AvatarManager, now: number) => m.jumpFor(ev('lurker'), now),
    '!unlurk': (m: AvatarManager, now: number) => m.unlurk(ev('lurker'), now),
  }

  for (const [how, comeBack] of Object.entries(comebacks)) {
    it(`keeps the stage within maxAvatars when a lurker comes back by ${how}`, () => {
      const { manager, now, run } = setup({ maxAvatars: 3 })
      for (const login of ['a', 'b', 'c']) manager.handleMessage(ev(login), now())
      manager.lurk(ev('lurker'), now())
      run(70) // everyone walks in; the lurker sits
      expect(standing()).toEqual(['a', 'b', 'c'])

      comeBack(manager, now())
      run(0.1)
      expect(standing()).toHaveLength(3)
      expect(standing()).toContain('lurker')
    })
  }

  it('never evicts seated lurkers to make room for chatters', () => {
    const { manager, now, run } = setup({ maxAvatars: 2 })
    manager.lurk(ev('l1'), now())
    manager.lurk(ev('l2'), now())
    run(70)
    for (const login of ['a', 'b', 'c']) manager.handleMessage(ev(login), now())
    run(0.1)
    const seated = created.filter((a) => a.machine.state === 'sit').map((a) => a.login)
    expect(seated.sort()).toEqual(['l1', 'l2'])
    expect(standing().length).toBeLessThanOrEqual(2)
  })
})

describe('AvatarManager emotes and interactions', () => {
  it('stands a lurker up to dance', () => {
    const { manager, now, run } = setup({})
    manager.lurk(ev('l'), now())
    run(70)
    manager.emote('dance', ev('l'), now())
    run(0.1)
    expect(stateOf('l')).toBe('emote')
  })

  it('lights up everyone but the lurkers on !sesh', () => {
    const { manager, now, run } = setup({})
    for (const login of ['a', 'b']) manager.handleMessage(ev(login), now())
    manager.lurk(ev('l'), now())
    run(70)
    manager.sesh()
    run(1.3)
    expect([stateOf('a'), stateOf('b'), stateOf('l')]).toEqual(['emote', 'emote', 'sit'])
  })

  it('ignores !smoke, !smoke bong and !sesh with smokeEnabled off, walking nobody in', () => {
    const { manager, now, run } = setup({ smokeEnabled: false })
    manager.emote('smoke', ev('a'), now())
    manager.emote('bong', ev('a'), now())
    expect(created).toHaveLength(0)
    manager.handleMessage(ev('b'), now())
    run(70) // everyone walks in (a slow walk-in takes up to ~55 s)
    manager.sesh()
    run(1.3)
    expect(stateOf('b')).not.toBe('emote')
    manager.emote('clap', ev('b'), now())
    run(0.1)
    expect(stateOf('b')).toBe('emote')
  })

  it('runs a high-five between two chatters and hands them back', () => {
    const { manager, now, run } = setup({})
    for (const login of ['a', 'b']) manager.handleMessage(ev(login), now())
    run(70) // everyone walks in (a slow walk-in takes up to ~55 s)
    manager.interact('highfive', command('highfive', 'a', '@b'), now())
    run(0.1)
    expect(stateOf('a')).toBe('scripted')
    expect(stateOf('b')).toBe('scripted')
    run(15)
    expect(stateOf('a')).not.toBe('scripted')
  })

  it('stands a lurker up even when their pair command is refused', () => {
    const { manager, now, run } = setup({})
    manager.lurk(ev('l'), now())
    run(70)
    manager.interact('hug', command('hug', 'l', '@nobody'), now())
    run(0.1)
    expect(stateOf('l')).not.toBe('sit')
  })
})

describe('AvatarManager keeps the lurk roster and the character in step', () => {
  it('makes a lurker who emotes during the walk-in a chatter again, not a seated non-lurker', () => {
    const { manager, now, run } = setup({})
    manager.lurk(ev('l'), now()) // walking in, will sit on arrival
    manager.emote('dance', ev('l'), now())
    run(70)
    expect(stateOf('l')).not.toBe('sit')
  })

  it('stands someone up for good when they !lurk then !jump mid-hug', () => {
    const { manager, now, run } = setup({})
    for (const login of ['a', 'b']) manager.handleMessage(ev(login), now())
    run(70) // everyone walks in (a slow walk-in takes up to ~55 s)
    manager.interact('hug', command('hug', 'a', '@b'), now())
    run(0.5)
    manager.lurk(ev('a'), now())
    manager.jumpFor(ev('a'), now())
    run(15)
    expect(stateOf('a')).not.toBe('sit')
  })
})

describe('AvatarManager name plates', () => {
  it('spreads the name plates of characters standing together so they never overlap', () => {
    const { manager, now, run } = setup({})
    for (const login of ['a', 'b', 'c']) manager.handleMessage(ev(login), now())
    const [a, b, c] = created
    if (!a || !b || !c) throw new Error('three characters expected')
    a.plate = { x: 500, halfWidth: 50, y: 900, height: 28, priority: 2 }
    b.plate = { x: 510, halfWidth: 50, y: 900, height: 28, priority: 1 }
    run(0.1)
    expect(Math.abs((b.placed ?? 0) - (a.placed ?? 0))).toBeGreaterThanOrEqual(104)
    expect(c.placed).toBeNull() // its plate isn't showing
  })
})
