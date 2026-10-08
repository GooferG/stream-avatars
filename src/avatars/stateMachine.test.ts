import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../utils/rng'
import { AvatarStateMachine, type MachineOptions, type Snapshot } from './stateMachine'

const BOUNDS = { minX: 0, maxX: 1920 }

function machine(seed = 1, overrides: Partial<MachineOptions> = {}): AvatarStateMachine {
  return new AvatarStateMachine({
    bounds: BOUNDS,
    walkSpeed: 100,
    bubbleDurationMs: 5000,
    rng: mulberry32(seed),
    ...overrides,
  })
}

/** Advance in fixed 1/60s steps; returns the last snapshot. */
function run(m: AvatarStateMachine, seconds: number, each?: (s: Snapshot) => void): Snapshot {
  const dt = 1 / 60
  let snap = m.update(0)
  for (let t = 0; t < seconds; t += dt) {
    snap = m.update(dt)
    each?.(snap)
  }
  return snap
}

/** Advance until the machine reaches `state` (or give up after maxSeconds). */
function runUntil(m: AvatarStateMachine, state: Snapshot['state'], maxSeconds = 60): Snapshot {
  const dt = 1 / 60
  let snap = m.update(0)
  for (let t = 0; t < maxSeconds && snap.state !== state; t += dt) snap = m.update(dt)
  return snap
}

describe('AvatarStateMachine', () => {
  it('starts offscreen, walks in, and settles into idle', () => {
    const m = machine()
    const first = m.update(0)
    expect(first.state).toBe('entering')
    expect(first.x < BOUNDS.minX || first.x > BOUNDS.maxX).toBe(true)

    const snap = run(m, 30)
    expect(['idle', 'wander']).toContain(snap.state)
    expect(snap.x).toBeGreaterThan(BOUNDS.minX)
    expect(snap.x).toBeLessThan(BOUNDS.maxX)
  })

  it('wanders within bounds over a long simulation', () => {
    const m = machine(7)
    run(m, 25) // get onscreen first
    run(m, 120, (s) => {
      expect(s.x).toBeGreaterThanOrEqual(BOUNDS.minX)
      expect(s.x).toBeLessThanOrEqual(BOUNDS.maxX)
      expect(['idle', 'wander']).toContain(s.state)
    })
  })

  it('talks on message and returns to idle when the bubble expires', () => {
    const m = machine()
    run(m, 30)
    m.onMessage()
    let snap = m.update(1 / 60)
    expect(snap.state).toBe('talk')
    expect(snap.anim).toBe('talk')
    snap = run(m, 5.1)
    expect(snap.state).not.toBe('talk')
  })

  it('a new message during talk resets the talk timer', () => {
    const m = machine()
    run(m, 30)
    m.onMessage()
    run(m, 4) // 4s into a 5s talk
    m.onMessage()
    const snap = run(m, 3) // would have expired without the reset
    expect(snap.state).toBe('talk')
  })

  it('jumps in a parabola and lands back at offset 0', () => {
    const m = machine()
    run(m, 30)
    m.onJump()
    let peak = 0
    const snap = run(m, 0.8, (s) => {
      peak = Math.min(peak, s.jumpOffsetY)
    })
    expect(peak).toBeLessThan(-40) // went airborne
    expect(snap.jumpOffsetY).toBe(0) // landed
    expect(snap.state).not.toBe('jump')
  })

  it('ignores jump while leaving', () => {
    const m = machine()
    run(m, 30)
    m.beginLeave()
    m.onJump()
    const snap = m.update(1 / 60)
    expect(snap.state).toBe('leaving')
  })

  it('leaves through the nearest edge and becomes gone', () => {
    const m = machine()
    run(m, 30)
    m.beginLeave()
    const snap = run(m, 40)
    expect(snap.state).toBe('gone')
    expect(snap.x < BOUNDS.minX || snap.x > BOUNDS.maxX).toBe(true)
  })

  it('messages do not interrupt leaving', () => {
    const m = machine()
    run(m, 30)
    m.beginLeave()
    m.onMessage()
    const snap = m.update(1 / 60)
    expect(snap.state).toBe('leaving')
  })

  it('reacts from idle, standing still, then returns to idle', () => {
    const m = machine()
    run(m, 30)
    const x = m.update(0).x
    m.onReact('cheer', 2)
    let snap = m.update(1 / 60)
    expect(snap.state).toBe('react')
    expect(snap.anim).toBe('cheer')
    snap = run(m, 1.5)
    expect(snap.state).toBe('react')
    expect(snap.x).toBe(x)
    snap = run(m, 0.6)
    expect(snap.state).not.toBe('react')
  })

  it('plays the sad animation for a sad reaction', () => {
    const m = machine()
    run(m, 30)
    m.onReact('sad', 2)
    expect(m.update(1 / 60).anim).toBe('sad')
  })

  it('interrupts talking, and a new message does not cut the reaction short', () => {
    const m = machine()
    run(m, 30)
    m.onMessage()
    m.onReact('cheer', 2)
    m.onMessage()
    expect(m.update(1 / 60).state).toBe('react')
  })

  it('ignores reactions while walking in (a new chatter hyping)', () => {
    const m = machine()
    m.update(0)
    m.onReact('cheer', 2)
    expect(m.update(1 / 60).state).toBe('entering')
  })

  it('ignores reactions while leaving', () => {
    const m = machine()
    run(m, 30)
    m.beginLeave()
    m.onReact('cheer', 2)
    expect(m.update(1 / 60).state).toBe('leaving')
  })

  it('ignores reactions mid-jump', () => {
    const m = machine()
    run(m, 30)
    m.onJump()
    m.onReact('cheer', 2)
    expect(m.update(1 / 60).state).toBe('jump')
    expect(run(m, 0.8).state).not.toBe('react')
  })

  it('waits out the ripple delay before reacting', () => {
    const m = machine()
    run(m, 30)
    m.onReact('cheer', 2, 0.3)
    expect(m.update(0.1).state).not.toBe('react')
    expect(run(m, 0.25).state).toBe('react')
  })

  it('drops a delayed reaction if the avatar started leaving', () => {
    const m = machine()
    run(m, 30)
    m.onReact('cheer', 2, 0.3)
    m.beginLeave()
    expect(run(m, 0.5).state).toBe('leaving')
  })

  it('resumes the reaction after a jump', () => {
    const m = machine()
    run(m, 30)
    m.onReact('cheer', 3)
    run(m, 0.5)
    m.onJump()
    const landed = run(m, 0.8)
    expect(landed.state).toBe('react')
    expect(landed.anim).toBe('cheer')
    expect(run(m, 2.6).state).not.toBe('react')
  })
})

describe('lurking (sit)', () => {
  it('sits where it stands and plays the sit row', () => {
    const m = machine()
    run(m, 30)
    const x = m.update(0).x
    m.onLurk()
    const snap = run(m, 10)
    expect(snap.state).toBe('sit')
    expect(snap.anim).toBe('sit')
    expect(snap.x).toBe(x)
  })

  it('sits straight from wandering and from talking', () => {
    const wandering = machine(3)
    runUntil(wandering, 'wander')
    wandering.onLurk()
    expect(wandering.update(1 / 60).state).toBe('sit')

    const talking = machine()
    run(talking, 30)
    talking.onMessage()
    talking.onLurk()
    expect(talking.update(1 / 60).state).toBe('sit')
  })

  it('walks in first, then sits once it arrives', () => {
    const m = machine()
    m.update(0)
    m.onLurk()
    expect(m.update(1 / 60).state).toBe('entering')
    expect(run(m, 30).state).toBe('sit')
  })

  it('sits once a jump or a reaction finishes', () => {
    const jumping = machine()
    run(jumping, 30)
    jumping.onJump()
    jumping.onLurk()
    expect(jumping.update(1 / 60).state).toBe('jump')
    expect(run(jumping, 0.8).state).toBe('sit')

    const reacting = machine()
    run(reacting, 30)
    reacting.onReact('cheer', 2)
    reacting.onLurk()
    expect(reacting.update(1 / 60).state).toBe('react')
    expect(run(reacting, 2.1).state).toBe('sit')
  })

  it('stands up to talk when a message comes in, then carries on normally', () => {
    const m = machine()
    run(m, 30)
    m.onLurk()
    run(m, 1)
    m.onMessage()
    const snap = m.update(1 / 60)
    expect(snap.state).toBe('talk')
    expect(snap.anim).toBe('talk')
    expect(['idle', 'wander']).toContain(run(m, 5.1).state)
  })

  it('arrives standing when they chat during the walk-in', () => {
    const m = machine()
    m.update(0)
    m.onLurk()
    m.onMessage()
    let sat = false
    run(m, 30, (s) => {
      if (s.state === 'sit') sat = true
    })
    expect(sat).toBe(false)
  })

  it('cancels a pending sit when a second !jump comes mid-jump', () => {
    const m = machine()
    run(m, 30)
    m.onJump()
    m.onLurk() // sits once the jump lands...
    m.onJump() // ...unless they jump again: that's coming back, like the manager says
    let sat = false
    run(m, 1, (s) => {
      if (s.state === 'sit') sat = true
    })
    expect(sat).toBe(false)
  })

  it('stands up and jumps on !jump, landing on its feet', () => {
    const m = machine()
    run(m, 30)
    m.onLurk()
    run(m, 1)
    m.onJump()
    expect(m.update(1 / 60).state).toBe('jump')
    const landed = run(m, 0.8)
    expect(landed.state).toBe('idle')
    expect(landed.anim).toBe('idle')
  })

  it('ignores crowd reactions while seated or on the way to its seat', () => {
    const seated = machine()
    run(seated, 30)
    seated.onLurk()
    seated.onReact('cheer', 2)
    expect(seated.update(1 / 60).state).toBe('sit')

    const arriving = machine()
    arriving.update(0)
    arriving.onLurk()
    arriving.onReact('cheer', 2)
    expect(run(arriving, 30).state).toBe('sit')
  })

  it('drops a rippled crowd reaction that was waiting when it sat down', () => {
    const m = machine()
    run(m, 30)
    m.onReact('cheer', 2, 0.3)
    m.onLurk()
    expect(run(m, 1).state).toBe('sit')
  })

  it('stands up on !unlurk, and !unlurk on the way in cancels the sit', () => {
    const seated = machine()
    run(seated, 30)
    seated.onLurk()
    seated.onUnlurk()
    expect(seated.update(1 / 60).state).toBe('idle')

    const arriving = machine()
    arriving.update(0)
    arriving.onLurk()
    arriving.onUnlurk()
    expect(run(arriving, 30).state).not.toBe('sit')
  })

  it('ignores !lurk while leaving', () => {
    const m = machine()
    run(m, 30)
    m.beginLeave()
    m.onLurk()
    expect(m.update(1 / 60).state).toBe('leaving')
  })

  it('stands up and walks off when sent away', () => {
    const m = machine()
    run(m, 30)
    m.onLurk()
    run(m, 1)
    m.beginLeave()
    expect(m.update(1 / 60).state).toBe('leaving')
    expect(run(m, 40).state).toBe('gone')
  })
})
