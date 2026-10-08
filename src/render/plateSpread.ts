/** A name plate on screen, in stage px: where its center wants to be, half its width, its top and height. */
export interface Plate {
  x: number
  halfWidth: number
  y: number
  height: number
  /** Higher goes first: when the character was last active. */
  priority: number
}

interface Placed {
  x: number
  plate: Plate
}

/**
 * Where to show name plates so none overlap. The most recently active name
 * stays over its character; a name that bumps into one already placed moves
 * to sit right beside it, never further, so it stays by its own character.
 * If there's no room there, it hides for now (null) rather than drift down
 * a long chain of names. Returns each plate's center x, in the order given.
 */
export function placePlates(plates: readonly Plate[], gap: number, stageWidth: number): (number | null)[] {
  const out: (number | null)[] = plates.map(() => null)
  const order = plates
    .map((plate, index) => ({ plate, index }))
    .sort((a, b) => b.plate.priority - a.plate.priority)
  const placed: Placed[] = []
  for (const { plate, index } of order) {
    const x = spotFor(plate, placed, gap, stageWidth)
    if (x === null) continue
    placed.push({ x, plate })
    out[index] = x
  }
  return out
}

/** The plate's own spot if free, else the closest free spot right beside a plate it bumps into. */
function spotFor(plate: Plate, placed: readonly Placed[], gap: number, stageWidth: number): number | null {
  const blocking = placed.filter((other) => collides(plate, plate.x, other, gap))
  if (blocking.length === 0) return plate.x
  let best: number | null = null
  for (const other of blocking) {
    const beside = plate.halfWidth + other.plate.halfWidth + gap
    for (const x of [other.x - beside, other.x + beside]) {
      if (Math.abs(x - plate.x) > beside) continue // never further than right beside the name it bumped into
      if (x - plate.halfWidth < 0 || x + plate.halfWidth > stageWidth) continue
      if (placed.some((p) => collides(plate, x, p, gap))) continue
      if (best === null || Math.abs(x - plate.x) < Math.abs(best - plate.x)) best = x
    }
  }
  return best
}

/** Whether `plate` centered at x would overlap `other` (same row, closer than `gap`). */
function collides(plate: Plate, x: number, other: Placed, gap: number): boolean {
  const sameRow = plate.y < other.plate.y + other.plate.height && other.plate.y < plate.y + plate.height
  return sameRow && Math.abs(x - other.x) < plate.halfWidth + other.plate.halfWidth + gap
}
