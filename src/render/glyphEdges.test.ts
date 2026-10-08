import { describe, expect, it } from 'vitest'
import { hardenGlyphs } from './glyphEdges'

/** RGBA pixels as [r, g, b, a] quadruples. */
const pixels = (...alphas: number[]) => new Uint8ClampedArray(alphas.flatMap((a) => [200, 180, 160, a]))
const alphasOf = (data: Uint8ClampedArray) => [...data].filter((_, i) => i % 4 === 3)

describe('hardenGlyphs', () => {
  it('rounds every glyph pixel to fully on or fully off, at half coverage', () => {
    const data = pixels(0, 60, 127, 128, 200, 255)
    hardenGlyphs(data)
    expect(alphasOf(data)).toEqual([0, 0, 0, 255, 255, 255])
  })

  it('paints the glyphs pure white, so a tint colors them exactly', () => {
    const data = pixels(255, 128)
    hardenGlyphs(data)
    expect([...data]).toEqual([255, 255, 255, 255, 255, 255, 255, 255])
  })
})
