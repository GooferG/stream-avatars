import '@fontsource/press-start-2p/index.css'
import '../render/font.css'
import './builder.css'
import { resolveConfig } from '../config/resolveConfig'
import { luma, MIN_LABEL_LUMA } from '../render/color'
import { characterSheets, drawCharacterFrame } from '../render/sprites/canvasCharacter'
import { FRAME_SIZE, type AnimName } from '../render/sprites/contract'
import { BUILDS, COLOR_NAMES, HAIR_STYLES, KINDS, SKIN_TONES } from '../render/sprites/roster'
import type { SheetImage } from '../render/sprites/sheetSource'
import {
  commandFor,
  fallbackBodyFor,
  initialState,
  lookFor,
  naturalColorFor,
  swatchColorFor,
  withLogin,
  type BuilderState,
  type ColorPick,
} from './builderState'
import { cooldownNote, titleFor, VIEWER_COMMANDS } from './builderText'
import { copyText } from './copy'
import { latestOnly } from './latest'
import { PREVIEW_ANIMS, previewFrame } from './previewCycle'

/**
 * The avatar builder (builder.html, published to GitHub Pages): viewers
 * pick a look, see it drawn exactly like the stream draws it, and copy the
 * `!avatar` line. The logic lives in builderState; this file only wires the
 * page. Nothing leaves the browser.
 */

/** The preview character at 4x (192px), crisp. */
const PREVIEW_SCALE = 4
const COPY_LABEL = 'Copy'

const hex = (color: number): string => `#${color.toString(16).padStart(6, '0')}`

function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const found = document.getElementById(id)
  if (!found) throw new Error(`builder.html is missing #${id}`)
  return found as T
}

/** A swatch's color, with a label that stays readable on it (same rule as the strip). */
function paint(button: HTMLElement, color: number): void {
  button.style.background = hex(color)
  button.style.color = luma(color) >= MIN_LABEL_LUMA ? '#1a1020' : '#ffffff'
}

/** One toggle button per value; `mark` presses the current one (or none). */
function chipRow<T>(
  root: HTMLElement,
  values: readonly T[],
  label: (value: T) => string,
  onPick: (value: T) => void,
): { buttons: Map<T, HTMLButtonElement>; mark(current: T | null): void } {
  const buttons = new Map<T, HTMLButtonElement>()
  for (const value of values) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'chip'
    button.textContent = label(value)
    button.setAttribute('aria-pressed', 'false')
    button.addEventListener('click', () => onPick(value))
    root.append(button)
    buttons.set(value, button)
  }
  return {
    buttons,
    mark(current) {
      for (const [value, button] of buttons) button.setAttribute('aria-pressed', String(value === current))
    },
  }
}

function main(): void {
  const cfg = resolveConfig(new URLSearchParams())
  document.documentElement.style.setProperty('--brand', cfg.brandColor)
  const title = titleFor(cfg.channel)
  document.title = title
  byId('title').textContent = title
  byId('cooldown-note').textContent = cooldownNote(cfg.avatarChangeCooldownMs)

  const loginInput = byId<HTMLInputElement>('login')
  const loginNote = byId('login-note')
  const nameColorInput = byId<HTMLInputElement>('name-color')
  const nameColorReset = byId<HTMLButtonElement>('name-color-reset')
  const humanOnly = byId('human-only')
  const colorTitle = byId('color-title')
  const lineInput = byId<HTMLInputElement>('line')
  const copyButton = byId<HTMLButtonElement>('copy')
  const canvas = byId<HTMLCanvasElement>('preview')
  canvas.width = FRAME_SIZE
  canvas.height = FRAME_SIZE
  canvas.style.width = `${FRAME_SIZE * PREVIEW_SCALE}px`
  canvas.style.height = `${FRAME_SIZE * PREVIEW_SCALE}px`
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2d canvas context unavailable')

  let state: BuilderState = initialState()
  const update = (next: BuilderState): void => {
    state = next
    render()
  }

  const kinds = chipRow(byId('kinds'), KINDS, (kind) => kind, (kind) => update({ ...state, kind }))
  const builds = chipRow(byId('builds'), BUILDS, (build) => build, (build) => update({ ...state, build }))
  const hairs = chipRow(byId('hairstyles'), HAIR_STYLES, (style) => style, (hairStyle) => update({ ...state, hairStyle }))
  const skins = chipRow(
    byId('skins'),
    SKIN_TONES.map((_, i) => i),
    (skin) => String(skin + 1),
    (skin) => update({ ...state, skin }),
  )
  for (const [skin, button] of skins.buttons) {
    button.classList.add('swatch')
    paint(button, SKIN_TONES[skin] ?? 0xffffff)
  }
  const colorPicks: readonly ColorPick[] = [...COLOR_NAMES, 'natural']
  const colors = chipRow(byId('colors'), colorPicks, (color) => color, (color) => update({ ...state, color }))
  for (const button of colors.buttons.values()) button.classList.add('swatch')

  // The preview: sheets load async, and only the newest picks' sheets are kept.
  let layers: SheetImage[] | null = null
  const load = latestOnly(
    (s: BuilderState) => characterSheets(lookFor(s), s.nameColor, fallbackBodyFor(s)),
    (loaded) => {
      layers = loaded
    },
    (err) => console.error('[chat-avatars] builder: the preview failed to load', err),
  )
  let pinned: AnimName | null = null
  let cycleStart = performance.now()
  const anims = chipRow(byId('anims'), PREVIEW_ANIMS, (anim) => anim, (anim) => pin(anim))
  /** Pins an animation (restarting it), or unpins it to resume the cycle from idle. */
  function pin(anim: AnimName): void {
    pinned = pinned === anim ? null : anim
    cycleStart = performance.now()
    anims.mark(pinned)
  }
  let playing: AnimName | null = null
  const frame = (now: number): void => {
    const { anim, ms } = previewFrame(now - cycleStart, pinned)
    if (layers) drawCharacterFrame(ctx, layers, anim, ms)
    if (anim !== playing) {
      if (playing) anims.buttons.get(playing)?.classList.remove('playing')
      anims.buttons.get(anim)?.classList.add('playing')
      playing = anim
    }
    requestAnimationFrame(frame)
  }

  function render(): void {
    kinds.mark(state.kind)
    builds.mark(state.build)
    hairs.mark(state.hairStyle)
    skins.mark(state.skin)
    colors.mark(state.color)
    for (const [pick, button] of colors.buttons) {
      paint(button, pick === 'natural' ? naturalColorFor(state) : swatchColorFor(state, pick))
    }
    humanOnly.hidden = state.kind !== 'human'
    colorTitle.textContent = state.kind === 'human' ? 'Hair color' : 'Fur color'
    loginNote.hidden = state.login !== null
    nameColorInput.value = state.nameColor ?? hex(fallbackBodyFor(state))
    nameColorReset.disabled = state.nameColor === null
    const line = commandFor(state)
    if (lineInput.value !== line) {
      lineInput.value = line
      copyButton.textContent = COPY_LABEL
    }
    load(state)
  }

  loginInput.addEventListener('input', () => update(withLogin(state, loginInput.value)))
  nameColorInput.addEventListener('input', () => update({ ...state, nameColor: nameColorInput.value }))
  nameColorReset.addEventListener('click', () => update({ ...state, nameColor: null }))
  copyButton.addEventListener('click', () => {
    void copyText(lineInput.value, navigator.clipboard).then((result) => {
      if (result === 'copied') {
        copyButton.textContent = 'Copied!'
        return
      }
      lineInput.focus()
      lineInput.select()
      copyButton.textContent = 'Selected: press Ctrl+C'
    })
  })

  const commandList = byId('commands')
  for (const { usage, does } of VIEWER_COMMANDS) {
    const term = document.createElement('dt')
    const code = document.createElement('code')
    code.textContent = usage
    term.append(code)
    const detail = document.createElement('dd')
    detail.textContent = does
    commandList.append(term, detail)
  }

  render()
  requestAnimationFrame(frame)
}

main()
