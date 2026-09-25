/**
 * Tiny pixel-art toolkit shared by every code-drawn sheet. Shapes are
 * described as data (Parts), rasterised into horizontal spans, and drawn
 * in two passes: a 1px black outline for every part first, then the fills,
 * so overlapping parts merge into one clean silhouette. Pure except for
 * drawParts, which only needs fillStyle + fillRect (a fake in tests).
 */
export const OUTLINE = '#000000'

interface PartStyle {
  col: string
  /** When set, the part is filled with `shade` and then `col` nudged up-left, leaving a shaded rim. */
  shade?: string
  noOutline?: boolean
}

export type Part =
  | ({ t: 'e'; cx: number; cy: number; rx: number; ry: number } & PartStyle)
  | ({ t: 'r'; x: number; y: number; w: number; h: number } & PartStyle)
  | ({ t: 't'; cx: number; top: number; h: number; w: number } & PartStyle)

export interface Span {
  x: number
  y: number
  w: number
}

export interface PixelCtx {
  fillStyle: string | CanvasGradient | CanvasPattern
  fillRect(x: number, y: number, w: number, h: number): void
}

/** The filled pixel rows of a part; `grow` expands it (1 = its outline ring). */
export function spans(p: Part, grow = 0): Span[] {
  const out: Span[] = []
  if (p.t === 'r') {
    for (let y = p.y - grow; y < p.y + p.h + grow; y++) out.push({ x: p.x - grow, y, w: p.w + 2 * grow })
  } else if (p.t === 'e') {
    const rx = p.rx + grow
    const ry = p.ry + grow
    for (let y = Math.ceil(p.cy - ry); y <= Math.floor(p.cy + ry); y++) {
      const t = (y - p.cy) / ry
      const hw = rx * Math.sqrt(Math.max(0, 1 - t * t))
      const x0 = Math.round(p.cx - hw)
      const x1 = Math.round(p.cx + hw)
      out.push({ x: x0, y, w: x1 - x0 + 1 })
    }
  } else {
    const h = p.h + grow
    const w = p.w + 2 * grow
    for (let i = 0; i < h; i++) {
      const wi = Math.max(1, Math.round(1 + (i * (w - 1)) / Math.max(1, h - 1)))
      out.push({ x: Math.round(p.cx - wi / 2), y: p.top - grow + i, w: wi })
    }
  }
  return out
}

/** Pixel bounds of a part, outline included unless it has none; x1/y1 are exclusive. */
export function partBounds(p: Part): { x0: number; y0: number; x1: number; y1: number } {
  const rows = spans(p, p.noOutline ? 0 : 1)
  return {
    x0: Math.min(...rows.map((r) => r.x)),
    y0: Math.min(...rows.map((r) => r.y)),
    x1: Math.max(...rows.map((r) => r.x + r.w)),
    y1: Math.max(...rows.map((r) => r.y)) + 1,
  }
}

/**
 * The pixels of `p` that none of `covers` would paint over, as 1px-tall
 * rects in p's color: for details that sit behind shapes of another layer.
 */
export function uncovered(p: Part, covers: readonly Part[]): Part[] {
  const coverRows = covers.flatMap((c) => spans(c))
  const out: Part[] = []
  for (const row of spans(p)) {
    let pieces: [number, number][] = [[row.x, row.x + row.w]]
    for (const c of coverRows) {
      if (c.y !== row.y) continue
      pieces = pieces.flatMap(([x0, x1]): [number, number][] => [
        [x0, Math.min(x1, c.x)],
        [Math.max(x0, c.x + c.w), x1],
      ])
    }
    for (const [x0, x1] of pieces) {
      if (x1 > x0) out.push({ t: 'r', x: x0, y: row.y, w: x1 - x0, h: 1, col: p.col, noOutline: p.noOutline })
    }
  }
  return out
}

export function drawParts(ctx: PixelCtx, parts: readonly Part[]): void {
  ctx.fillStyle = OUTLINE
  for (const p of parts) if (!p.noOutline) fill(ctx, spans(p, 1))
  for (const p of parts) {
    ctx.fillStyle = p.shade ?? p.col
    fill(ctx, spans(p))
    if (p.shade) {
      ctx.fillStyle = p.col
      fill(ctx, spans(highlightOf(p)))
    }
  }
}

function highlightOf(p: Part): Part {
  if (p.t === 'e') return { ...p, cx: p.cx - 0.6, cy: p.cy - 0.8, rx: p.rx - 0.9, ry: p.ry - 0.9 }
  if (p.t === 'r') return { ...p, w: p.w - 1, h: p.h - 1 }
  return p
}

function fill(ctx: PixelCtx, rows: Span[]): void {
  for (const r of rows) ctx.fillRect(r.x, r.y, r.w, 1)
}

export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = rgb(a)
  const [r2, g2, b2] = rgb(b)
  const c = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0')
  return `#${c(r1, r2)}${c(g1, g2)}${c(b1, b2)}`
}

export const darken = (c: string, t: number): string => mix(c, '#000000', t)
export const lighten = (c: string, t: number): string => mix(c, '#ffffff', t)

function rgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}
