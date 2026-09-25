import '@fontsource/press-start-2p/index.css'
import './strip.css'
import { fitToWindow } from '../app/fitToWindow'
import { TmiChatSource } from '../chat/tmiSource'
import type { ChatCommandEvent } from '../chat/types'
import { resolveConfig } from '../config/resolveConfig'
import { characterSheets, drawCharacterFrame } from '../render/sprites/canvasCharacter'
import { FRAME_SIZE } from '../render/sprites/contract'
import type { SheetImage } from '../render/sprites/sheetSource'
import { browserStorage, SafeStorage } from '../utils/storage'
import { HEARTBEAT_MS, INFO_COMMANDS, InfoState, infoDecision, isPrivileged } from './infoState'
import { LINEUP } from './lineup'
import { StripController } from './stripController'
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

interface LineupCell {
  ctx: CanvasRenderingContext2D
  layers: SheetImage[]
}

function withAlpha(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 0xff}, ${(n >> 8) & 0xff}, ${n & 0xff}, ${alpha})`
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
  if (!page || !strip || !lineupRoot) throw new Error('avatar-info.html is missing #page, #strip or #lineup')

  document.documentElement.style.setProperty('--brand', cfg.brandColor)
  document.documentElement.style.setProperty('--brand-glow', withAlpha(cfg.brandColor, 0.35))
  fitToWindow(page, STRIP_WIDTH, STRIP_HEIGHT)

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

  // 1. chat: !avatarinfo / !avatars, cooldown for regular viewers
  const onCommand = (e: ChatCommandEvent): void => {
    if (!INFO_COMMANDS.includes(e.name)) return
    const lastOpenAt = state.lastOpen()?.at ?? null
    const decision = infoDecision(Date.now(), lastOpenAt, isPrivileged(e.message.tags), cfg.infoCooldownMs)
    if (decision === 'open') open(e.message.messageId)
  }
  if (cfg.channel) {
    const source = new TmiChatSource(cfg.channel, { ignoredBots: cfg.ignoredBots })
    source.on('command', onCommand)
    source.connect().catch((err) => {
      console.warn('[chat-avatars] info strip: initial chat connect failed, retrying', err)
    })
  }

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
    ;(window as unknown as Record<string, unknown>).__avatarInfo = { open, onCommand, state, cfg }
  }

  // the overlay reads this to know the strip is running
  state.beat(Date.now())
  window.setInterval(() => state.beat(Date.now()), HEARTBEAT_MS)
}

main().catch((err) => console.error('[chat-avatars] info strip failed to start', err))
