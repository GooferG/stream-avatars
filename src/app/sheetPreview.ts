import { characterSheets, drawCharacterFrame } from '../render/sprites/canvasCharacter'
import { ANIM_NAMES, FRAME_SIZE, type AnimName } from '../render/sprites/contract'
import {
  ACCESSORIES,
  ANIMALS,
  BUILDS,
  HAIR_COLORS,
  HAIR_STYLES,
  SKIN_TONES,
  type Look,
} from '../render/sprites/roster'
import type { SheetImage } from '../render/sprites/sheetSource'

/**
 * Dev-only art review page: `npm run dev`, then open /sheet-preview.html.
 * Every build × hairstyle, every accessory over every hairstyle and every
 * animal plays every row, assembled and tinted exactly like on stream.
 * Not part of the OBS build.
 */
const SCALE = 3
const SAMPLE_CHAT = ['#1E90FF', '#FF4500', '#9ACD32', '#FF69B4', '#FFD700', '#8A2BE2', '#00CED1']

const BASE: Look = { kind: 'human', build: 'average', skin: 0, hairStyle: 'short', hairColor: 0, accessory: null }

/** Cycles skin and hair colors so each section shows the whole palette. */
const varied = (looks: Look[]): Look[] =>
  looks.map((look, i) => ({ ...look, skin: i % SKIN_TONES.length, hairColor: i % HAIR_COLORS.length }))

const SECTIONS: { title: string; looks: Look[] }[] = [
  {
    title: 'Builds × hairstyles',
    looks: varied(BUILDS.flatMap((build) => HAIR_STYLES.map((hairStyle) => ({ ...BASE, build, hairStyle })))),
  },
  {
    title: 'Accessories × hairstyles',
    looks: varied(
      ACCESSORIES.flatMap((accessory) => HAIR_STYLES.map((hairStyle) => ({ ...BASE, hairStyle, accessory }))),
    ),
  },
  { title: 'Animals', looks: ANIMALS.map((kind) => ({ ...BASE, kind })) },
]

interface Cell {
  ctx: CanvasRenderingContext2D
  layers: SheetImage[]
  anim: AnimName
}

function lookLabel(look: Look): string {
  if (look.kind !== 'human') return look.kind
  return `${look.build} · ${look.hairStyle} hair · ${look.accessory ?? 'no accessory'}`
}

async function lookRow(look: Look, chatColor: string, cells: Cell[]): Promise<HTMLElement[]> {
  const layers = await characterSheets(look, chatColor)
  const label = document.createElement('h3')
  label.textContent = lookLabel(look)
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
  return [label, row]
}

async function main(): Promise<void> {
  const root = document.getElementById('sheets')
  if (!root) throw new Error('missing #sheets')
  const cells: Cell[] = []
  for (const section of SECTIONS) {
    const title = document.createElement('h2')
    title.textContent = section.title
    root.append(title)
    for (const [i, look] of section.looks.entries()) {
      root.append(...(await lookRow(look, SAMPLE_CHAT[i % SAMPLE_CHAT.length] ?? '#ffffff', cells)))
    }
  }

  const frame = (now: number): void => {
    for (const cell of cells) drawCharacterFrame(cell.ctx, cell.layers, cell.anim, now)
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}

void main()
