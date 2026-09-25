import { describe, expect, it } from 'vitest'
import { OUTLINE, darken, drawParts, lighten, mix, partBounds, spans, uncovered, type Part } from './pixelKit'

function recorder() {
  const ops: { style: string; x: number; y: number; w: number; h: number }[] = []
  const ctx = {
    fillStyle: '' as string | CanvasGradient | CanvasPattern,
    fillRect(x: number, y: number, w: number, h: number) {
      ops.push({ style: String(this.fillStyle), x, y, w, h })
    },
  }
  return { ctx, ops }
}

describe('spans', () => {
  it('fills a rect row by row', () => {
    expect(spans({ t: 'r', x: 2, y: 3, w: 4, h: 2, col: '#fff' })).toEqual([
      { x: 2, y: 3, w: 4 },
      { x: 2, y: 4, w: 4 },
    ])
  })

  it('fills an ellipse symmetrically around its centre', () => {
    const rows = spans({ t: 'e', cx: 10, cy: 10, rx: 3, ry: 2, col: '#fff' })
    expect(rows.map((r) => r.y)).toEqual([8, 9, 10, 11, 12])
    for (const r of rows) expect(r.x + r.w - 1 - 10).toBe(10 - r.x)
  })

  it('widens a triangle from its tip to its base', () => {
    const rows = spans({ t: 't', cx: 10, top: 0, h: 4, w: 7, col: '#fff' })
    expect(rows[0]?.w).toBe(1)
    expect(rows[3]?.w).toBe(7)
  })
})

describe('partBounds', () => {
  it('includes the 1px outline unless the part has none', () => {
    const rect: Part = { t: 'r', x: 5, y: 5, w: 2, h: 2, col: '#fff' }
    expect(partBounds(rect)).toEqual({ x0: 4, y0: 4, x1: 8, y1: 8 })
    expect(partBounds({ ...rect, noOutline: true })).toEqual({ x0: 5, y0: 5, x1: 7, y1: 7 })
  })
})

describe('drawParts', () => {
  it('draws every outline before any fill, so parts merge into one silhouette', () => {
    const { ctx, ops } = recorder()
    drawParts(ctx, [
      { t: 'r', x: 0, y: 0, w: 2, h: 2, col: '#ff0000' },
      { t: 'r', x: 3, y: 0, w: 2, h: 2, col: '#00ff00' },
    ])
    const lastOutline = ops.map((o) => o.style).lastIndexOf(OUTLINE)
    const firstFill = ops.findIndex((o) => o.style !== OUTLINE)
    expect(lastOutline).toBeLessThan(firstFill)
  })

  it('shades a part by laying its colour over a shade-coloured copy', () => {
    const { ctx, ops } = recorder()
    drawParts(ctx, [{ t: 'r', x: 0, y: 0, w: 3, h: 3, col: '#ffffff', shade: '#999999', noOutline: true }])
    expect(ops.map((o) => o.style)).toEqual(['#999999', '#999999', '#999999', '#ffffff', '#ffffff'])
  })
})

describe('colour helpers', () => {
  it('mixes, darkens and lightens #rrggbb colours', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080')
    expect(darken('#ff0000', 0.5)).toBe('#800000')
    expect(lighten('#000080', 1)).toBe('#ffffff')
  })
})

describe('uncovered', () => {
  const pixels = (parts: Part[]) =>
    new Set(parts.flatMap((p) => spans(p).flatMap((r) => Array.from({ length: r.w }, (_, i) => `${r.x + i},${r.y}`))))

  it('keeps exactly the pixels of a part that the other parts do not paint over', () => {
    const part: Part = { t: 'e', cx: 10, cy: 10, rx: 4, ry: 3, col: '#f39c34', noOutline: true }
    const covers: Part[] = [
      { t: 'e', cx: 12, cy: 7, rx: 3, ry: 4, col: '#ffffff' },
      { t: 'r', x: 6, y: 11, w: 3, h: 2, col: '#ffffff' },
    ]
    const hidden = pixels(covers)
    const expected = [...pixels([part])].filter((px) => !hidden.has(px))
    expect([...pixels(uncovered(part, covers))].sort()).toEqual(expected.sort())
  })

  it('splits a row the cover crosses in the middle, keeping the style', () => {
    const part: Part = { t: 'r', x: 0, y: 0, w: 6, h: 1, col: '#123456', noOutline: true }
    const cover: Part = { t: 'r', x: 2, y: 0, w: 2, h: 1, col: '#ffffff' }
    expect(uncovered(part, [cover])).toEqual([
      { t: 'r', x: 0, y: 0, w: 2, h: 1, col: '#123456', noOutline: true },
      { t: 'r', x: 4, y: 0, w: 2, h: 1, col: '#123456', noOutline: true },
    ])
  })
})
