import { describe, expect, it } from 'vitest'
import {
  ANIM_NAMES,
  ANIMATIONS,
  SHEET_COLS,
  SHEET_ROWS,
  findSheet,
  isSheetSize,
  sheetFile,
} from './contract'

describe('sheetFile', () => {
  it('names sheets as documented for artists', () => {
    expect(sheetFile('body', 2)).toBe('body-2.png')
    expect(sheetFile('accessory', 0)).toBe('accessory-0.png')
  })
})

describe('findSheet', () => {
  // shape of Vite's import.meta.glob result: source path -> built URL
  const built = {
    '../../assets/sprites/body-0.png': './assets/body-0-a1b2.png',
    '../../assets/sprites/body-10.png': './assets/body-10-c3d4.png',
    '../../assets/sprites/accessory-3.png': 'data:image/png;base64,AAAA',
  }

  it('returns the built URL of a sheet that was dropped in', () => {
    expect(findSheet(built, 'body', 0)).toBe('./assets/body-0-a1b2.png')
    expect(findSheet(built, 'accessory', 3)).toBe('data:image/png;base64,AAAA')
  })

  it('returns null for a missing sheet, so no request is ever made for it', () => {
    expect(findSheet(built, 'accessory', 0)).toBeNull()
    expect(findSheet({}, 'body', 0)).toBeNull()
  })

  it('matches whole file names only', () => {
    expect(findSheet(built, 'body', 1)).toBeNull()
  })
})

describe('animation rows', () => {
  it('gives every animation its own row inside the sheet', () => {
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
  it('accepts only the 6x6 grid of 32px frames', () => {
    expect(isSheetSize(192, 192)).toBe(true)
    expect(isSheetSize(192, 128)).toBe(false) // old 4-row sheets
    expect(isSheetSize(96, 96)).toBe(false)
  })
})
