import { accessoryParts, hairParts, humanBodyParts, humanFaceParts } from './humanArt'
import { animalParts, collarParts } from './animalArt'
import { ANIM_NAMES, ANIMATIONS, FRAME_SIZE, SHEET_HEIGHT, SHEET_WIDTH } from './contract'
import { drawParts, type Part } from './pixelKit'
import { POSES, type Pose } from './poses'
import {
  ACCESSORIES,
  ANIMALS,
  BUILDS,
  HAIR_STYLES,
  type SheetId,
} from './roster'

const HUMAN_LAYERS = ['pants', 'shirt', 'skin'] as const

/** The parts of one frame of a sheet. Pure, so every sheet's bounds are testable. */
export function partsFor(id: SheetId, pose: Pose): Part[] {
  if (id === 'human-face') return humanFaceParts(pose)
  if (id === 'collar') return collarParts(pose)
  for (const build of BUILDS) {
    for (const layer of HUMAN_LAYERS) if (id === `human-${build}-${layer}`) return humanBodyParts(layer, build, pose)
  }
  for (const style of HAIR_STYLES) {
    if (id === `hair-${style}`) return hairParts(style, false, pose)
    if (id === `hair-${style}-back`) return hairParts(style, true, pose)
  }
  for (const name of ACCESSORIES) if (id === `accessory-${name}`) return accessoryParts(name, pose)
  for (const kind of ANIMALS) if (id === kind) return animalParts(kind, pose)
  throw new Error(`no art for sheet ${id}`)
}

/** Paints a whole sheet: every animation row, one frame per pose, each clipped to its cell. */
export function paintSheet(id: SheetId): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = SHEET_WIDTH
  canvas.height = SHEET_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2d canvas context unavailable')
  for (const anim of ANIM_NAMES) {
    const { row } = ANIMATIONS[anim]
    POSES[anim].forEach((pose, frame) => {
      ctx.save()
      ctx.translate(frame * FRAME_SIZE, row * FRAME_SIZE)
      ctx.beginPath()
      ctx.rect(0, 0, FRAME_SIZE, FRAME_SIZE)
      ctx.clip()
      ctx.translate(0, pose.dy)
      drawParts(ctx, partsFor(id, pose))
      ctx.restore()
    })
  }
  return canvas
}
