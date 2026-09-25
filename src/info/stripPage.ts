import '@fontsource/press-start-2p/index.css'
import './strip.css'
import { fitToWindow } from '../app/fitToWindow'
import { TmiChatSource } from '../chat/tmiSource'
import type { ChatCommandEvent } from '../chat/types'
import { resolveConfig } from '../config/resolveConfig'
import { luma, MIN_LABEL_LUMA } from '../render/color'
import { characterSheets, drawCharacterFrame } from '../render/sprites/canvasCharacter'
import { FRAME_SIZE } from '../render/sprites/contract'
import { SKIN_TONES } from '../render/sprites/roster'
import type { SheetImage } from '../render/sprites/sheetSource'
import { browserStorage, SafeStorage } from '../utils/storage'
import { HEARTBEAT_MS, INFO_COMMANDS, InfoState, infoDecision, isPrivileged } from './infoState'
import { HAIRSTYLE_PREVIEWS, LINEUP } from './lineup'
import { StripController } from './stripController'
import { StripPresence } from './stripPresence'
import { BlinkDetector } from './visibilityTrigger'

/**
 * The !avatarinfo character-select strip: its own OBS browser source
 * (dist/avatar-info.html, 1920x300). Opens from chat, from a Stream Deck
 * hide then show of the source, or (with ?debug=1) a click or key press.
 */
const STRIP_WIDTH = 1920
const STRIP_HEIGHT = 300
/** Lineup characters at 2x (96px), crisp like on stream. */
const LINEUP_SCALE = 2
/** Each character bobs a little after its left neighbour. */
const BOB_STAGGER_S = 0.13
/** Head-and-shoulders crop of a 48px frame (hair tops out at row 5), shown at 2x. */
const HEAD_CROP = { x: 10, y: 3, size: 28 }
const HEAD_SCALE = 2

interface LineupCell {
  ctx: CanvasRenderingContext2D
  layers: SheetImage[]
}

function withAlpha(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 0xff}, ${(n >> 8) & 0xff}, ${n & 0xff}, ${alpha})`
}

/** The `!skin` numbers, each on its tone, so viewers see which number is which. */
function buildSkinSwatches(root: HTMLElement): void {
  SKIN_TONES.forEach((tone, i) => {
    const swatch = document.createElement('span')
    swatch.className = 'swatch'
    swatch.style.background = `#${tone.toString(16).padStart(6, '0')}`
    swatch.style.color = luma(tone) >= MIN_LABEL_LUMA ? '#1a1020' : '#ffffff'
    swatch.textContent = String(i + 1)
    root.append(swatch)
  })
}

/** One still head per hairstyle word, over its sign, so viewers see what each looks like. */
async function buildHairstyles(root: HTMLElement, brandColor: string): Promise<void> {
  const frame = document.createElement('canvas')
  frame.width = FRAME_SIZE
  frame.height = FRAME_SIZE
  const frameCtx = frame.getContext('2d')
  if (!frameCtx) throw new Error('2d canvas context unavailable')
  const { x, y, size } = HEAD_CROP
  for (const entry of HAIRSTYLE_PREVIEWS) {
    drawCharacterFrame(frameCtx, await characterSheets(entry.look, brandColor), 'idle', 0)
    const head = document.createElement('canvas')
    head.width = size
    head.height = size
    head.style.width = `${size * HEAD_SCALE}px`
    head.style.height = `${size * HEAD_SCALE}px`
    head.getContext('2d')?.drawImage(frame, x, y, size, size, 0, 0, size, size)
    const sign = document.createElement('div')
    sign.className = 'sign'
    sign.textContent = entry.name
    const slot = document.createElement('div')
    slot.className = 'slot'
    slot.append(head, sign)
    root.append(slot)
  }
}

/** One slot per lineup entry: an idle character over its name sign, in lineup order. */
async function buildLineup(root: HTMLElement, brandColor: string): Promise<LineupCell[]> {
  return Promise.all(
    LINEUP.map(async (entry, i) => {
      const canvas = document.createElement('canvas')
      canvas.width = FRAME_SIZE
      canvas.height = FRAME_SIZE
      canvas.style.width = `${FRAME_SIZE * LINEUP_SCALE}px`
      canvas.style.height = `${FRAME_SIZE * LINEUP_SCALE}px`
      canvas.style.animationDelay = `${i * BOB_STAGGER_S}s`
      const sign = document.createElement('div')
      sign.className = 'sign'
      sign.textContent = entry.name
      const slot = document.createElement('div')
      slot.className = 'slot'
      slot.append(canvas, sign)
      root.append(slot) // appended before the await, so slots keep lineup order
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('2d canvas context unavailable')
      return { ctx, layers: await characterSheets(entry.look, brandColor) }
    }),
  )
}

/** Plays the lineup's idle animation only while the strip is up, sparing OBS the work. */
function lineupAnimator(cells: readonly LineupCell[]): { start(): void; stop(): void } {
  let handle = 0
  const draw = (now: number) => {
    for (const cell of cells) drawCharacterFrame(cell.ctx, cell.layers, 'idle', now)
    handle = requestAnimationFrame(draw)
  }
  return {
    start() {
      if (!handle) draw(performance.now())
    },
    stop() {
      cancelAnimationFrame(handle)
      handle = 0
    },
  }
}

async function main(): Promise<void> {
  const cfg = resolveConfig(new URLSearchParams(window.location.search))
  const page = document.getElementById('page')
  const strip = document.getElementById('strip')
  const lineupRoot = document.getElementById('lineup')
  const skins = document.getElementById('skins')
  const hairstyles = document.getElementById('hairstyles')
  if (!page || !strip || !lineupRoot || !skins || !hairstyles) {
    throw new Error('avatar-info.html is missing #page, #strip, #lineup, #skins or #hairstyles')
  }

  document.documentElement.style.setProperty('--brand', cfg.brandColor)
  document.documentElement.style.setProperty('--brand-glow', withAlpha(cfg.brandColor, 0.35))
  fitToWindow(page, STRIP_WIDTH, STRIP_HEIGHT)
  buildSkinSwatches(skins)
  await buildHairstyles(hairstyles, cfg.brandColor)

  const animator = lineupAnimator(await buildLineup(lineupRoot, cfg.brandColor))
  strip.addEventListener('transitionend', () => {
    if (!strip.classList.contains('up')) animator.stop()
  })
  const controller = new StripController(
    {
      show: () => {
        animator.start()
        strip.classList.add('up')
      },
      hide: () => strip.classList.remove('up'),
    },
    cfg.infoDurationMs,
  )
  const state = new InfoState(new SafeStorage(browserStorage()))
  const open = (messageId: string | null): void => {
    controller.open()
    state.recordOpen({ at: Date.now(), messageId })
  }

  // The overlay reads this heartbeat to know chat can open the strip on
  // stream; otherwise it shows the help bubble for !avatarinfo instead.
  const presence = new StripPresence(Boolean(cfg.channel))
  const beat = (): void => {
    if (presence.ready) state.beat(Date.now())
    else state.markUnavailable()
  }

  // 1. chat: !avatarinfo / !avatars, cooldown for regular viewers
  const onCommand = (e: ChatCommandEvent): void => {
    if (!INFO_COMMANDS.includes(e.name) || !presence.ready) return
    const lastOpenAt = state.lastOpen()?.at ?? null
    const decision = infoDecision(Date.now(), lastOpenAt, isPrivileged(e.message.tags), cfg.infoCooldownMs)
    if (decision === 'open') open(e.message.messageId)
  }
  if (cfg.channel) {
    const source = new TmiChatSource(cfg.channel, { ignoredBots: cfg.ignoredBots })
    source.on('command', onCommand)
    source.on('state', (s) => {
      presence.onChatState(s)
      beat()
    })
    source.connect().catch((err) => {
      console.warn('[chat-avatars] info strip: initial chat connect failed, retrying', err)
    })
  }

  // OBS: is the source on the live output (a scene that contains the strip)?
  window.addEventListener('obsSourceActiveChanged', (event) => {
    presence.onLiveChanged((event as CustomEvent<{ active?: boolean }>).detail?.active !== false)
    beat()
  })

  // 2. Stream Deck, silent: a quick hide then show of this source in OBS
  const blink = new BlinkDetector()
  window.addEventListener('obsSourceVisibleChanged', (event) => {
    const visible = (event as CustomEvent<{ visible?: boolean }>).detail?.visible === true
    if (blink.onVisibleChanged(visible, Date.now())) open(null)
  })

  // 3. debug: click or press a key
  if (cfg.debug) {
    document.body.classList.add('debug-bg')
    window.addEventListener('click', () => open(null))
    window.addEventListener('keydown', () => open(null))
    ;(window as unknown as Record<string, unknown>).__avatarInfo = { open, onCommand, state, cfg, presence }
  }

  beat()
  window.setInterval(beat, HEARTBEAT_MS)
}

main().catch((err) => console.error('[chat-avatars] info strip failed to start', err))
