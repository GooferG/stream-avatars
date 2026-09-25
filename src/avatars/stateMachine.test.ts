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
})
