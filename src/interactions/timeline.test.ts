import { describe, expect, it } from 'vitest'
import type { PairKind } from './gate'
import { Interaction, meetingSpots, type ActorStep, type TickOutput } from './timeline'

const BOUNDS = { minX: 0, maxX: 1920 }

const make = (kind: PairKind, rng: () => number = () => 0.25) =>
  new Interaction({ kind, a: 'alice', b: 'bob', xa: 400, xb: 1000, scale: 2, bounds: BOUNDS, rng })

interface Frame {
  t: number
  out: TickOutput
  done: boolean
}

/**
 * Runs an interaction in 1/60 s frames. Each actor appears at a run step's
 * target `arriveAfter[login]` seconds after the step (default: next frame).
 */
function play(ia: Interaction, seconds: number, arriveAfter: Record<string, number> = {}): Frame[] {
  const x: Record<string, number> = { alice: 400, bob: 1000 }
  const moving: Record<string, { to: number; at: number }> = {}
  const frames: Frame[] = []
  const dt = 1 / 60
  for (let i = 0; i <= Math.round(seconds * 60); i++) {
    const t = i * dt
    for (const [login, m] of Object.entries(moving)) {
      if (t >= m.at) {
        x[login] = m.to
        delete moving[login]
      }
    }
    const out = ia.tick(i === 0 ? 0 : dt, (login) => x[login] ?? 0)
    for (const { login, step } of out.steps) {
      if (step.type === 'run') moving[login] = { to: step.x, at: t + (arriveAfter[login] ?? dt / 2) }
    }
    frames.push({ t, out, done: ia.done })
  }
  return frames
}

const stepsOf = (frames: Frame[], login: string, type: ActorStep['type']) =>
  frames.flatMap(({ t, out }) =>
    out.steps.filter((s) => s.login === login && s.step.type === type).map((s) => ({ t, step: s.step })),
  )
const cuesOf = (frames: Frame[], name: string) =>
  frames.flatMap(({ t, out }) => out.cues.filter((c) => c.name === name).map((cue) => ({ t, cue })))
const doneAt = (frames: Frame[]) => frames.find((f) => f.done)?.t ?? Number.NaN

describe('meetingSpots', () => {
  it('meets halfway, a gap apart, each on their own side', () => {
    expect(meetingSpots(400, 1000, 'highfive', 2, BOUNDS)).toEqual({ a: 672, b: 728 })
    expect(meetingSpots(1000, 400, 'highfive', 2, BOUNDS)).toEqual({ a: 728, b: 672 })
  })

  it('scales the gap with the sprites, and uses each kind of gap', () => {
    expect(meetingSpots(400, 1000, 'hug', 1, BOUNDS)).toEqual({ a: 692, b: 708 })
    expect(meetingSpots(400, 1000, 'fight', 2, BOUNDS)).toEqual({ a: 676, b: 724 })
  })

  it('keeps both spots off the walls', () => {
    expect(meetingSpots(-60, 10, 'highfive', 2, BOUNDS)).toEqual({ a: 40, b: 96 })
    expect(meetingSpots(1900, 1980, 'highfive', 2, BOUNDS)).toEqual({ a: 1824, b: 1880 })
  })
})

describe('Interaction', () => {
  it('sends both running to their spots first', () => {
    const [first] = play(make('highfive'), 0)
    expect(first?.out.steps).toEqual([
      { login: 'alice', step: { type: 'run', x: 672 } },
      { login: 'bob', step: { type: 'run', x: 728 } },
    ])
  })

  it('has the first to arrive wait, facing the other, until both are there', () => {
    const frames = play(make('hug'), 3, { alice: 0.5, bob: 2 })
    const [waiting] = stepsOf(frames, 'alice', 'face')
    expect(waiting?.step).toEqual({ type: 'face', dir: 1 })
    expect(waiting?.t).toBeCloseTo(0.5, 1)
    expect(stepsOf(frames, 'alice', 'play')[0]?.t).toBeGreaterThanOrEqual(2)
  })

  it('starts wherever they are once 8 seconds have passed', () => {
    const frames = play(make('hug'), 9, { bob: 60 })
    expect(stepsOf(frames, 'bob', 'play')[0]?.t).toBeCloseTo(8, 1)
  })

  it('high-fives: raised hands, a spark between them on the slap frame, a cheer, done 2 s later', () => {
    const frames = play(make('highfive'), 4)
    const [raise] = stepsOf(frames, 'alice', 'play')
    expect(raise?.step).toEqual({ type: 'play', anim: 'highfive' })
    const sparks = cuesOf(frames, 'spark')
    expect(sparks).toHaveLength(1)
    expect(sparks[0]?.cue).toMatchObject({ x: 700, rise: 30 })
    expect((sparks[0]?.t ?? 0) - (raise?.t ?? 0)).toBeCloseTo(1 / 3, 1)
    expect(stepsOf(frames, 'bob', 'play').map((s) => s.step)).toEqual([
      { type: 'play', anim: 'highfive' },
      { type: 'play', anim: 'cheer' },
    ])
    expect(doneAt(frames) - (raise?.t ?? 0)).toBeCloseTo(2, 1)
  })

  it('hugs: both hug while three hearts rise between them, done after 2.5 s', () => {
    const frames = play(make('hug'), 4)
    const [hug] = stepsOf(frames, 'bob', 'play')
    expect(hug?.step).toEqual({ type: 'play', anim: 'hug' })
    const hearts = cuesOf(frames, 'heart')
    expect(hearts.map((h) => h.t - (hug?.t ?? 0))).toEqual([
      expect.closeTo(0.3, 1),
      expect.closeTo(0.9, 1),
      expect.closeTo(1.5, 1),
    ])
    expect(hearts.every((h) => h.cue.x === 700 && h.cue.rise === 34)).toBe(true)
    expect(doneAt(frames) - (hug?.t ?? 0)).toBeCloseTo(2.5, 1)
  })

  it('fights in a cloud: hidden, pokes on its edge, then a poof, a winner and a dizzy loser', () => {
    const frames = play(make('fight', () => 0.25), 8)
    const [hide, show] = stepsOf(frames, 'alice', 'hide')
    expect(hide?.step).toEqual({ type: 'hide', hidden: true })
    expect(show?.step).toEqual({ type: 'hide', hidden: false })
    const start = hide?.t ?? 0
    expect((show?.t ?? 0) - start).toBeCloseTo(3, 1)

    expect(cuesOf(frames, 'cloud').map((c) => c.cue)).toEqual([{ name: 'cloud', x: 700, rise: 24, lifeMs: 3000 }])
    const pokes = cuesOf(frames, 'fist') // rng 0.25 always picks the fist, at the bottom of the cloud
    expect(pokes).toHaveLength(12)
    expect(pokes.every((p) => p.t - start < 3 && Math.round(p.cue.x) === 700 && p.cue.rise === 6)).toBe(true)
    expect(cuesOf(frames, 'puff')).toHaveLength(6)

    const results = frames.filter((f) => f.out.result)
    expect(results.map((f) => f.out.result)).toEqual([{ winner: 'alice', loser: 'bob' }])
    expect(stepsOf(frames, 'alice', 'play').at(-1)?.step).toEqual({ type: 'play', anim: 'cheer' })
    expect(stepsOf(frames, 'bob', 'play').at(-1)?.step).toEqual({ type: 'play', anim: 'dizzy' })
    const stars = cuesOf(frames, 'tinyStar')
    expect(stars).toHaveLength(3)
    expect(stars.every((s) => s.cue.x === 724 && s.cue.lifeMs === 3000 && s.cue.orbit?.radius === 8)).toBe(true)
    // they circle the head, below the name plate (which starts 44 frame px up and draws over effects)
    expect(stars.every((s) => s.cue.rise + (s.cue.orbit?.radius ?? 0) * 0.4 < 44)).toBe(true)
    expect(doneAt(frames) - start).toBeCloseTo(6, 1)
  })

  it('lets the coin pick either side', () => {
    const frames = play(make('fight', () => 0.75), 8)
    expect(frames.find((f) => f.out.result)?.out.result).toEqual({ winner: 'bob', loser: 'alice' })
  })
})
