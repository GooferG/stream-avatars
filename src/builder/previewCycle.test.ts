import { describe, expect, it } from 'vitest'
import { ANIM_NAMES } from '../render/sprites/contract'
import { MIN_SHOW_MS, PREVIEW_ANIMS, previewFrame, showMs } from './previewCycle'

describe('PREVIEW_ANIMS', () => {
  it('is every animation a lone character plays, in sheet order', () => {
    const needsAPartner: string[] = ['highfive', 'hug', 'dizzy']
    expect(PREVIEW_ANIMS).toEqual(ANIM_NAMES.filter((anim) => !needsAPartner.includes(anim)))
  })
})

describe('previewFrame', () => {
  it('starts with idle and moves on after its turn', () => {
    expect(previewFrame(0, null)).toEqual({ anim: 'idle', ms: 0 })
    expect(previewFrame(showMs('idle') + 5, null)).toEqual({ anim: 'walk', ms: 5 })
  })

  it('shows quick animations for a while and lets slow ones play through once', () => {
    expect(showMs('idle')).toBe(MIN_SHOW_MS)
    expect(showMs('smoke')).toBe(4000) // 6 frames at 1.5 fps
  })

  it('loops back to idle after the last animation', () => {
    const cycle = PREVIEW_ANIMS.reduce((sum, anim) => sum + showMs(anim), 0)
    expect(previewFrame(cycle - 1, null).anim).toBe('bong')
    expect(previewFrame(cycle + 10, null)).toEqual({ anim: 'idle', ms: 10 })
  })

  it('plays only the pinned animation', () => {
    expect(previewFrame(123_456, 'dance')).toEqual({ anim: 'dance', ms: 123_456 })
  })
})
