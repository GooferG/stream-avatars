import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatMessageEvent } from '../chat/types'
import { DEFAULT_CONFIG } from '../config/defaults'
import type { AppConfig } from '../config/types'
import { AvatarManager, type ManagerOptions } from './manager'
import type { AvatarStateMachine } from './stateMachine'

/** Every character the manager put on stage, in order. */
const created = vi.hoisted(() => [] as { login: string; machine: AvatarStateMachine; destroyed: boolean }[])

// Avatar and the speech bubble draw with Pixi, which the node test
// environment can't load. Stand-ins keep the manager's own rules (the caps,
// the lurk roster, the sweep) under test with the real state machine.
vi.mock('./avatar', () => ({
  Avatar: class {
    login: string
    machine: AvatarStateMachine
    lastActiveAt: number
    destroyed = false
    container = {}
    constructor(options: { login: string; machine: AvatarStateMachine }, now: number) {
      this.login = options.login
      this.machine = options.machine
      this.lastActiveAt = now
      created.push(this)
    }
    touch(now: number): void {
      this.lastActiveAt = now
    }
    update(dtSec: number): void {
      this.machine.update(dtSec)
    }
    setLayers(): void {}
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
