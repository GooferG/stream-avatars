import { describe, expect, it } from 'vitest'
import { LurkRoster, lurkerNameAlpha } from './lurkRoster'

const HOURS_2 = 7_200_000

describe('LurkRoster', () => {
  it('tracks who is lurking', () => {
    const roster = new LurkRoster()
    expect(roster.start('ana', 0, 10)).toEqual([])
    expect(roster.isLurking('ana')).toBe(true)
    expect(roster.isLurking('bo')).toBe(false)
  })

  it('sends the longest lurker off when one more sits than the cap allows', () => {
    const roster = new LurkRoster()
    roster.start('ana', 0, 2)
    roster.start('bo', 1, 2)
    expect(roster.start('cy', 2, 2)).toEqual(['ana'])
    expect(roster.start('di', 3, 2)).toEqual(['bo'])
    expect(roster.isLurking('ana')).toBe(false)
    expect(roster.isLurking('cy')).toBe(true)
    expect(roster.isLurking('di')).toBe(true)
  })

  it('never restarts the clock when someone repeats !lurk', () => {
    const roster = new LurkRoster()
    roster.start('ana', 0, 10)
    expect(roster.start('ana', 60_000, 10)).toEqual([])
    // the clock still counts from 0, so it runs out 2h after the first !lurk
    expect(roster.expire(HOURS_2 + 1, HOURS_2)).toEqual(['ana'])
  })

  it('expires only lurks older than the timeout, and forgets them', () => {
    const roster = new LurkRoster()
    roster.start('ana', 0, 10)
    roster.start('bo', 1_000, 10)
    expect(roster.expire(HOURS_2, HOURS_2)).toEqual([]) // exactly at the timeout: not yet
    expect(roster.expire(HOURS_2 + 500, HOURS_2)).toEqual(['ana'])
    expect(roster.isLurking('ana')).toBe(false)
    expect(roster.isLurking('bo')).toBe(true)
  })

  it('stops a lurk once, after which the viewer can lurk again on a fresh clock', () => {
    const roster = new LurkRoster()
    roster.start('ana', 0, 10)
    expect(roster.stop('ana')).toBe(true)
    expect(roster.stop('ana')).toBe(false)
    roster.start('ana', 5_000, 10)
    expect(roster.expire(HOURS_2 + 1_000, HOURS_2)).toEqual([])
    expect(roster.expire(HOURS_2 + 5_001, HOURS_2)).toEqual(['ana'])
  })
})

describe('lurkerNameAlpha', () => {
  it('shows the name for 4 seconds after sitting, then fades it out over half a second', () => {
    expect([0, 4_000, 4_250, 4_500, 60_000].map(lurkerNameAlpha)).toEqual([1, 1, 0.5, 0, 0])
  })
})
