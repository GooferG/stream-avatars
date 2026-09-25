import { characterColors, roleTints } from '../render/color'
import { tintedSheet } from '../render/sprites/canvasTint'
import { ANIM_NAMES, ANIMATIONS, FRAME_SIZE, type AnimName } from '../render/sprites/contract'
import { ANIMALS, layersFor, type Look } from '../render/sprites/roster'
import { sheetSource, type SheetImage } from '../render/sprites/sheetSource'

/**
 * Dev-only art review page: `npm run dev`, then open /sheet-preview.html.
 * Every kind plays every row, assembled and tinted exactly like on stream.
 * Not part of the OBS build.
 */
const SCALE = 3
const SAMPLE_CHAT = ['#1E90FF', '#FF4500', '#9ACD32', '#FF69B4', '#FFD700', '#8A2BE2', '#00CED1']

const HUMANS: Look[] = [
  { kind: 'human', build: 'skinny', skin: 0, hairStyle: 'short', hairColor: 1, accessory: 'cap' },
  { kind: 'human', build: 'average', skin: 2, hairStyle: 'long', hairColor: 0, accessory: 'glasses' },
  { kind: 'human', build: 'chubby', skin: 3, hairStyle: 'bun', hairColor: 0, accessory: 'bow' },
  { kind: 'human', build: 'average', skin: 1, hairStyle: 'spiky', hairColor: 3, accessory: null },
]
const BASE: Look = { kind: 'human', build: 'average', skin: 0, hairStyle: 'short', hairColor: 0, accessory: null }
const LOOKS: Look[] = [...HUMANS, ...ANIMALS.map((kind): Look => ({ ...BASE, kind }))]

interface Cell {
  ctx: CanvasRenderingContext2D
  layers: SheetImage[]
  anim: AnimName
}

function lookLabel(look: Look): string {
  if (look.kind !== 'human') return look.kind
  return `${look.build} · ${look.hairStyle} hair · ${look.accessory ?? 'no accessory'}`
}

async function main(): Promise<void> {
  const root = document.getElementById('sheets')
  if (!root) throw new Error('missing #sheets')
  const cells: Cell[] = []
  for (const [i, look] of LOOKS.entries()) {
    const tints = roleTints(look, characterColors(SAMPLE_CHAT[i % SAMPLE_CHAT.length] ?? null, 0xffffff))
    const layers = await Promise.all(
      layersFor(look).map(async (ref) => tintedSheet(await sheetSource(ref.sheet), tints[ref.role])),
    )
    const title = document.createElement('h2')
    title.textContent = lookLabel(look)
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
    root.append(title, row)
  }

  const frame = (now: number): void => {
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
}

void main()
