/** Deterministic PRNG stream in [0, 1). */
export type Rng = () => number

/** mulberry32: tiny, fast, good-enough distribution for cosmetic randomness. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Uniform float in [min, max). */
export function range(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min)
}

/** Uniform integer index in [0, count). */
export function pickIndex(rng: Rng, count: number): number {
  return Math.min(count - 1, Math.floor(rng() * count))
}
