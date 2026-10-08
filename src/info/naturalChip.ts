import { luma, MIN_LABEL_LUMA } from '../render/color'
import { NATURAL_FUR } from '../render/sprites/roster'

/** The animals' own furs that are light enough for the chip's dark label. */
export const NATURAL_CHIP_FURS: readonly number[] = Object.values(NATURAL_FUR).filter(
  (fur) => luma(fur) >= MIN_LABEL_LUMA,
)

/** The strip's `natural` chip background: a stripe of natural furs, since it stands for every kind. */
export function naturalChipBackground(): string {
  const stops = NATURAL_CHIP_FURS.map((fur) => `#${fur.toString(16).padStart(6, '0')}`)
  return `linear-gradient(90deg, ${stops.join(', ')})`
}
