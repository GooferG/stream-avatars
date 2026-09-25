import { describe, expect, it } from 'vitest'
import { findSheet, sheetFile } from './contract'

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
