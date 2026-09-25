import { describe, expect, it } from 'vitest'
import { multiplyTint } from './canvasTint'

describe('multiplyTint', () => {
  it('multiplies colors like Pixi does, keeping alpha, so soft edges never turn tint-colored', () => {
    const pixels = new Uint8ClampedArray([
      0, 0, 0, 128, // half-transparent black outline stays black
      128, 128, 128, 128, // half-transparent gray is shaded, alpha kept
      255, 255, 255, 255, // white takes the tint exactly
      0, 0, 0, 0, // fully transparent stays untouched
    ])
    multiplyTint(pixels, 0xff8000)
    expect([...pixels]).toEqual([
      0, 0, 0, 128,
      128, 64, 0, 128,
      255, 128, 0, 255,
      0, 0, 0, 0,
    ])
  })
})
