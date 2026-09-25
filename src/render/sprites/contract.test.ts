import { describe, expect, it } from 'vitest'
import {
  ANIM_NAMES,
  ANIMATIONS,
  FRAME_SIZE,
  SHEET_COLS,
  SHEET_ROWS,
  findSheet,
  isSheetSize,
  sheetFile,
} from './contract'

describe('sheetFile', () => {
  it('names a sheet after its id', () => {
    expect(sheetFile('human-chubby-shirt')).toBe('human-chubby-shirt.png')
    expect(sheetFile('cat')).toBe('cat.png')
  })
})

describe('findSheet', () => {
  const built = {
    '../../assets/sprites/cat.png': './assets/cat-a1b2.png',
    '../../assets/sprites/hair-long-back.png': './assets/hair-long-back-c3d4.png',
  }

  it('returns the built URL of a sheet that was dropped in', () => {
    expect(findSheet(built, 'cat')).toBe('./assets/cat-a1b2.png')
    expect(findSheet(built, 'hair-long-back')).toBe('./assets/hair-long-back-c3d4.png')
  })

  it('matches whole names only, so hair-long never picks up hair-long-back', () => {
    expect(findSheet(built, 'hair-long')).toBeNull()
    expect(findSheet({}, 'cat')).toBeNull()
  })
})

describe('animation rows', () => {
  it('gives every animation its own row inside the 6x6 grid', () => {
    const rows = ANIM_NAMES.map((name) => ANIMATIONS[name].row)
    expect(new Set(rows).size).toBe(rows.length)
    for (const name of ANIM_NAMES) {
      expect(ANIMATIONS[name].row).toBeLessThan(SHEET_ROWS)
      expect(ANIMATIONS[name].frames).toBeLessThanOrEqual(SHEET_COLS)
    }
  })

  it('puts the reactions in rows 4 and 5', () => {
    expect(ANIMATIONS.cheer).toEqual({ row: 4, frames: 4, fps: 6 })
    expect(ANIMATIONS.sad).toEqual({ row: 5, frames: 4, fps: 2 })
  })
})

describe('isSheetSize', () => {
  it('accepts only the 6x6 grid of 48px frames', () => {
    expect(FRAME_SIZE).toBe(48)
    expect(isSheetSize(288, 288)).toBe(true)
    expect(isSheetSize(192, 192)).toBe(false) // old 32px sheets
    expect(isSheetSize(288, 192)).toBe(false)
  })
})
