import { describe, expect, it } from 'vitest'
import { animalDetailParts, animalFurParts, collarParts } from './animalArt'
import { ANIM_NAMES, FRAME_SIZE } from './contract'
import { drawParts, partBounds, spans, type Part } from './pixelKit'
import { POSES, pose } from './poses'
import { ANIMALS } from './roster'

const ALL_POSES = ANIM_NAMES.flatMap((name) => POSES[name])

function expectInFrame(parts: Part[], dy: number): void {
  for (const p of parts) {
    const b = partBounds(p)
    expect(b.x0).toBeGreaterThanOrEqual(0)
    expect(b.x1).toBeLessThanOrEqual(FRAME_SIZE)
    expect(b.y0 + dy).toBeGreaterThanOrEqual(0)
    expect(b.y1 + dy).toBeLessThanOrEqual(FRAME_SIZE)
  }
}

/** The color each pixel ends up with once the parts are drawn, keyed "x,y". */
function finalColors(parts: Part[]): Map<string, string> {
  const colors = new Map<string, string>()
  const ctx = {
    fillStyle: '' as string | CanvasGradient | CanvasPattern,
    fillRect(x: number, y: number, w: number) {
      for (let i = 0; i < w; i++) colors.set(`${x + i},${y}`, String(this.fillStyle))
    },
  }
  drawParts(ctx, parts)
  return colors
}

const pixelsOf = (p: Part) => spans(p).flatMap((r) => Array.from({ length: r.w }, (_, i) => `${r.x + i},${r.y}`))

const topOf = (parts: Part[]) => Math.min(...parts.map((p) => partBounds(p).y0))

/** A #rrggbb color with equal channels: it takes a tint's hue without shifting it. */
const isGray = (col: string) => /^#([0-9a-f]{2})\1\1$/i.test(col)

describe('animal art', () => {
  it('keeps every animal layer and the collar inside the 48px frame in every pose', () => {
    for (const p of ALL_POSES) {
      for (const kind of ANIMALS) {
        expectInFrame(animalFurParts(kind, p), p.dy)
        expectInFrame(animalDetailParts(kind, p), p.dy)
      }
      expectInFrame(collarParts(p), p.dy)
    }
  })

  it('paints the fur in grays only, so any fur color tints it cleanly', () => {
    for (const p of ALL_POSES) {
      for (const kind of ANIMALS) {
        for (const part of animalFurParts(kind, p)) {
          expect(isGray(part.col), `${kind} ${part.col}`).toBe(true)
          if (part.shade) expect(isGray(part.shade), `${kind} ${part.shade}`).toBe(true)
        }
      }
    }
  })

  it('paints the details without outlines: the fur layer draws the silhouette', () => {
    for (const p of ALL_POSES) {
      for (const kind of ANIMALS) {
        for (const part of animalDetailParts(kind, p)) expect(part.noOutline, `${kind} ${part.col}`).toBe(true)
      }
    }
  })

  it('lays every see-through detail on flat, unshaded fur, so it lightens any fur color evenly', () => {
    for (const p of ALL_POSES) {
      for (const kind of ANIMALS) {
        const fur = finalColors(animalFurParts(kind, p))
        for (const part of animalDetailParts(kind, p)) {
          if (!part.col.startsWith('rgba')) continue
          for (const px of pixelsOf(part)) expect(fur.get(px), `${kind} ${px}`).toBe('#ffffff')
        }
      }
    }
  })

  it('keeps bird feet behind the body, where the fur already covers them', () => {
    for (const p of ALL_POSES) {
      for (const kind of ['duck', 'penguin'] as const) {
        const furParts = animalFurParts(kind, p)
        const fur = finalColors(furParts)
        // the feet: the only shapes centred below the body
        const feetOnly = finalColors(furParts.filter((part) => part.t === 'e' && part.cy > 40))
        for (const part of animalDetailParts(kind, p).filter((d) => d.col === '#f39c34')) {
          for (const px of pixelsOf(part)) {
            // beak pixels are the beak's own; foot pixels must still show the foot on the fur layer
            if (feetOnly.has(px)) expect(fur.get(px), `${kind} ${px}`).toBe(feetOnly.get(px))
          }
        }
      }
    }
  })

  it('draws each animal differently', () => {
    const drawings = ANIMALS.map((k) => JSON.stringify([animalFurParts(k, pose()), animalDetailParts(k, pose())]))
    expect(new Set(drawings).size).toBe(ANIMALS.length)
  })

  it('droops the ears when sad', () => {
    for (const kind of ['cat', 'bunny', 'fox'] as const) {
      const sad = animalFurParts(kind, pose(0, 2, { face: 'sad' }))
      const calm = animalFurParts(kind, pose(0, 2))
      expect(topOf(sad)).toBeGreaterThan(topOf(calm))
    }
  })

  it('sits the collar on the neck, where the head meets the body', () => {
    const [collar] = collarParts(pose())
    expect(collar).toMatchObject({ t: 'r', y: 28 })
  })
})
