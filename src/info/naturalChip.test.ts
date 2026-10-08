import { describe, expect, it } from 'vitest'
import { luma, MIN_LABEL_LUMA } from '../render/color'
import { NATURAL_CHIP_FURS, naturalChipBackground } from './naturalChip'

describe('the natural chip', () => {
  it('stripes only natural furs light enough for its dark label', () => {
    expect(NATURAL_CHIP_FURS.length).toBeGreaterThanOrEqual(3)
    for (const fur of NATURAL_CHIP_FURS) expect(luma(fur)).toBeGreaterThanOrEqual(MIN_LABEL_LUMA)
  })

  it('is a stripe of the cat, duck, frog and bunny furs', () => {
    expect(naturalChipBackground()).toBe('linear-gradient(90deg, #f0a04b, #f5d547, #6bbf59, #e8e2dc)')
  })
})
