import {
  ACCESSORY_COUNT,
  ANIM_NAMES,
  ANIMATIONS,
  BODY_COUNT,
  FRAME_SIZE,
  PALETTES,
  type AnimName,
} from '../render/sprites/contract'
import { paintAccessorySheet, paintBodySheet } from '../render/sprites/placeholder'

/**
 * Dev-only art review page: `npm run dev`, then open /sheet-preview.html
 * (add ?accessory=0..3 to try one accessory on every body). Every built-in
 * body plays every row, tinted like on stream, with and without an
 * accessory. Not part of the OBS build.
 */
const SCALE = 4

function hex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`
}

/** Same multiplicative tint the stage applies: gray * color, black stays black. */
function tint(sheet: HTMLCanvasElement, color: number): HTMLCanvasElement {
  const out = document.createElement('canvas')
  out.width = sheet.width
  out.height = sheet.height
  const ctx = out.getContext('2d')
  if (!ctx) throw new Error('2d canvas context unavailable')
  ctx.drawImage(sheet, 0, 0)
  ctx.globalCompositeOperation = 'multiply'
  ctx.fillStyle = hex(color)
  ctx.fillRect(0, 0, out.width, out.height)
  ctx.globalCompositeOperation = 'destination-in'
  ctx.drawImage(sheet, 0, 0)
  return out
}

interface Cell {
  ctx: CanvasRenderingContext2D
  layers: HTMLCanvasElement[]
  anim: AnimName
}

const cells: Cell[] = []
const root = document.getElementById('sheets')
if (!root) throw new Error('missing #sheets')
// ?accessory=N puts accessory N on every body (to check it fits each shape)
const forcedAccessory = new URLSearchParams(location.search).get('accessory')

for (let body = 0; body < BODY_COUNT; body++) {
  const palette = PALETTES[body] ?? { body: 0xffffff, accent: 0xffffff }
  const bodySheet = tint(paintBodySheet(body), palette.body)
  const accessory = forcedAccessory === null ? body % ACCESSORY_COUNT : Number(forcedAccessory)
  const accessorySheet = tint(paintAccessorySheet(accessory), palette.accent)
  for (const layers of [[bodySheet], [bodySheet, accessorySheet]]) {
    const row = document.createElement('div')
    row.className = 'row'
    for (const anim of ANIM_NAMES) {
      const figure = document.createElement('figure')
      const canvas = document.createElement('canvas')
      canvas.width = FRAME_SIZE
      canvas.height = FRAME_SIZE
      canvas.style.width = `${FRAME_SIZE * SCALE}px`
      canvas.style.height = `${FRAME_SIZE * SCALE}px`
      const caption = document.createElement('figcaption')
      caption.textContent = anim
      figure.append(canvas, caption)
      row.append(figure)
      const ctx = canvas.getContext('2d')
      if (ctx) cells.push({ ctx, layers, anim })
    }
    root.append(row)
  }
}

function frame(now: number): void {
  for (const cell of cells) {
    const spec = ANIMATIONS[cell.anim]
    const col = Math.floor((now / 1000) * spec.fps) % spec.frames
    cell.ctx.clearRect(0, 0, FRAME_SIZE, FRAME_SIZE)
    for (const layer of cell.layers) {
      cell.ctx.drawImage(
        layer,
        col * FRAME_SIZE,
        spec.row * FRAME_SIZE,
        FRAME_SIZE,
        FRAME_SIZE,
        0,
        0,
        FRAME_SIZE,
        FRAME_SIZE,
      )
    }
  }
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
