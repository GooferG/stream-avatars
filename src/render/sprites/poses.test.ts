import { describe, expect, it } from 'vitest'
import { ANIM_NAMES, ANIMATIONS } from './contract'
import { POSES } from './poses'

describe('POSES', () => {
  it('has exactly one pose per frame for every animation', () => {
    for (const name of ANIM_NAMES) expect(POSES[name]).toHaveLength(ANIMATIONS[name].frames)
  })

  it('gives the reaction rows their faces and arms', () => {
    expect(POSES.cheer.every((p) => p.face === 'happy' || p.face === 'grin')).toBe(true)
    expect(POSES.cheer.some((p) => p.arms === 'up')).toBe(true)
    expect(POSES.sad.every((p) => p.face === 'sad' && p.arms === 'limp' && p.squash > 0)).toBe(true)
  })

  it('keeps the arms still while talking, so the mouth does the talking', () => {
    // a single arm pumping out at waist height reads as something crude on stream
    expect(new Set(POSES.talk.map((p) => p.arms))).toEqual(new Set(['down']))
    expect(POSES.talk.some((p) => p.face === 'talk')).toBe(true)
  })

  it('sits on every sit frame, breathing by one pixel, and nowhere else', () => {
    expect(POSES.sit.every((p) => p.seated && p.dy === 0)).toBe(true)
    expect(POSES.sit.map((p) => p.squash)).toEqual([1, 1, 0, 0])
    for (const name of ANIM_NAMES) {
      if (name !== 'sit') expect(POSES[name].some((p) => p.seated), name).toBe(false)
    }
  })

  it('never moves the feet below the ground line', () => {
    for (const name of ANIM_NAMES) for (const p of POSES[name]) expect(p.dy).toBeLessThanOrEqual(0)
  })

  it('raises the front arm for the high-five, slapping on frame 3', () => {
    expect(POSES.highfive.map((p) => p.arms)).toEqual(['down', 'reachUp', 'reachUp', 'reachUp'])
    expect(POSES.highfive[2]?.dy).toBe(Math.min(...POSES.highfive.map((p) => p.dy)))
  })

  it('sways sideways only while dizzy', () => {
    expect(POSES.dizzy.map((p) => p.dx)).toEqual([-1, 0, 1, 0])
    expect(POSES.dizzy.every((p) => p.face === 'dizzy' && p.arms === 'limp')).toBe(true)
    for (const name of ANIM_NAMES) {
      if (name !== 'dizzy') expect(POSES[name].every((p) => p.dx === 0), name).toBe(true)
    }
  })

  it('holds a prop on every smoke and bong frame, and nowhere else', () => {
    for (const name of ANIM_NAMES) {
      const smoking = name === 'smoke' || name === 'bong'
      expect(POSES[name].every((p) => (p.prop !== null) === smoking), name).toBe(true)
    }
  })

  it('lights the joint at the mouth, and relaxes for the exhale on the last two frames', () => {
    expect(POSES.smoke.map((p) => p.prop)).toEqual(['joint', 'joint', 'jointLit', 'joint', 'joint', 'joint'])
    expect(POSES.smoke.map((p) => p.arms)).toEqual(['down', 'toMouth', 'toMouth', 'down', 'down', 'down'])
    expect(POSES.bong.every((p) => p.arms === 'holdFront')).toBe(true)
    for (const i of [4, 5]) {
      expect(POSES.smoke[i]?.face).toBe('chill')
      expect(POSES.bong[i]?.face).toBe('chill')
    }
  })

  it('claps with the hands together on every other frame', () => {
    expect(POSES.clap.map((p) => p.arms)).toEqual(['clapOpen', 'clap', 'clapOpen', 'clap'])
    expect(POSES.wave.map((p) => p.arms)).toEqual(['waveA', 'waveB', 'waveA', 'waveB'])
  })
})
