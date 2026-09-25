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
