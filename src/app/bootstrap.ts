import { AVATAR_HELP } from '../avatars/avatarCommand'
import { AvatarChooser } from '../avatars/chooser'
import { ChoiceStore } from '../avatars/choiceStore'
import { AvatarManager } from '../avatars/manager'
import { CommandRegistry } from '../chat/commands'
import { ChatMood } from '../chat/mood'
import { TmiChatSource } from '../chat/tmiSource'
import type { ChatEventSource, ChatMessageEvent, ConnectionState } from '../chat/types'
import { resolveConfig } from '../config/resolveConfig'
import type { AppConfig } from '../config/types'
import { EmoteCache } from '../render/emotes'
import { loadPixelFont } from '../render/font'
import { loadSpriteCatalog } from '../render/sprites/loader'
import { createStage, STAGE_HEIGHT, STAGE_WIDTH } from '../render/stage'
import { browserStorage, SafeStorage } from '../utils/storage'
import { startFakeChat } from './fakeChat'

/**
 * Composition root. Wires config -> stage -> sprites -> manager -> chat and
 * returns a dispose function (App.tsx uses it for the StrictMode guard).
 */
export async function bootstrap(host: HTMLElement): Promise<() => void> {
  const cfg = resolveConfig(new URLSearchParams(window.location.search))

  if (!cfg.channel && cfg.debug !== 'grid') {
    showError(
      host,
      'No channel configured. Add ?channel=yourchannel to the URL, for example: http://localhost:5173/?channel=gooferg',
    )
    return () => {}
  }

  const unfit = fitStageToWindow(host)
  await loadPixelFont()
  const stage = await createStage(host)
  const catalog = await loadSpriteCatalog()
  const emoteCache = new EmoteCache()

  // one never-throwing store shared by picks (and the info strip protocol)
  const storage = new SafeStorage(browserStorage())
  const choices = new ChoiceStore(storage)
  const chooser = new AvatarChooser(choices, cfg.avatarChangeCooldownMs)

  const manager = new AvatarManager({
    cfg,
    catalog,
    avatarLayer: stage.avatarLayer,
    bubbleLayer: stage.bubbleLayer,
    emoteCache,
    stageWidth: STAGE_WIDTH,
    stageHeight: STAGE_HEIGHT,
    choiceFor: (login) => choices.get(login),
  })

  const commands = new CommandRegistry()
  commands.register('jump', (e) => manager.jumpFor(e.message, performance.now()))
  commands.register('avatar', (e) => {
    const now = performance.now()
    const outcome = chooser.choose(e.message.login, e.args, now)
    if (outcome === 'help') manager.say(e.message, AVATAR_HELP, now)
    else if (outcome === 'changed') manager.applyChoice(e.message, now)
  })
  // Phase 2 commands are one register() call each: !dance, !hug, ...

  const mood = new ChatMood(cfg)
  // one path for live and fake chat: bubble/talk first, then any reactions
  const onChat = (e: ChatMessageEvent) => {
    const now = performance.now()
    manager.handleMessage(e, now)
    for (const reaction of mood.observe(e, now)) manager.react(reaction)
  }

  let disposed = false
  let connectionState: ConnectionState = 'disconnected'
  let source: ChatEventSource | null = null
  if (cfg.channel) {
    source = new TmiChatSource(cfg.channel, { ignoredBots: cfg.ignoredBots })
    source.on('message', onChat)
    source.on('command', (e) => commands.dispatch(e))
    source.on('state', (s) => {
      connectionState = s
    })
    // A rejected first attempt is not fatal: tmi.js keeps reconnecting.
    source.connect().catch((err) => {
      if (!disposed) console.warn('[chat-avatars] initial chat connect failed, retrying', err)
    })
  }

  let frameCount = 0
  stage.app.ticker.add((ticker) => {
    frameCount++
    manager.update(ticker.deltaMS / 1000, performance.now())
  })

  if (cfg.debug) {
    // console handle for poking the overlay while debugging
    ;(window as unknown as Record<string, unknown>).__chatAvatars = {
      manager,
      commands,
      cfg,
      app: stage.app,
      mood,
      choices,
    }
  }

  const stopFake = cfg.debug === 'grid'
    ? startFakeChat(onChat, (e) => commands.dispatch(e))
    : () => {}

  // Measured ticks per second: ticker.FPS is instantaneous and jitters
  // between raw refresh rate and the maxFPS cap on high-refresh displays.
  let lastFrameCount = 0
  let lastFpsAt = performance.now()
  const stopOverlay = cfg.debug
    ? startDebugOverlay(host, cfg, () => {
        const now = performance.now()
        const fps = ((frameCount - lastFrameCount) / (now - lastFpsAt)) * 1000
        lastFrameCount = frameCount
        lastFpsAt = now
        return {
          fps: Math.round(fps),
          avatars: manager.count,
          connection: cfg.channel ? connectionState : 'no channel',
        }
      })
    : () => {}

  return () => {
    disposed = true
    unfit()
    stopFake()
    stopOverlay()
    void source?.disconnect().catch(() => {})
    manager.destroy()
    stage.destroy()
  }
}

function showError(host: HTMLElement, message: string): void {
  const div = document.createElement('div')
  div.className = 'boot-error'
  div.textContent = message
  host.appendChild(div)
}

interface DebugStats {
  fps: number
  avatars: number
  connection: string
}

// Ref-counted: StrictMode boots overlap briefly and the first boot's
// dispose must not strip the class the surviving boot depends on.
let debugBgCount = 0

function startDebugOverlay(
  host: HTMLElement,
  cfg: AppConfig,
  stats: () => DebugStats,
): () => void {
  debugBgCount++
  document.body.classList.add('debug-bg')
  const div = document.createElement('div')
  div.className = 'debug-overlay'
  host.appendChild(div)
  const interval = window.setInterval(() => {
    const s = stats()
    div.textContent = `fps ${s.fps} | avatars ${s.avatars}/${cfg.maxAvatars} | chat ${s.connection}`
  }, 500)
  return () => {
    window.clearInterval(interval)
    div.remove()
    debugBgCount--
    if (debugBgCount <= 0) document.body.classList.remove('debug-bg')
  }
}

/**
 * OBS loads the source at exactly 1920x1080; a dev browser window usually
 * does not. Scale the whole stage down to fit so the bottom strip (where
 * all the avatars live) is visible while developing.
 */
function fitStageToWindow(host: HTMLElement): () => void {
  const apply = () => {
    const scale = Math.min(1, window.innerWidth / 1920, window.innerHeight / 1080)
    host.style.transformOrigin = 'top left'
    host.style.transform = scale < 1 ? `scale(${scale})` : ''
  }
  apply()
  window.addEventListener('resize', apply)
  return () => window.removeEventListener('resize', apply)
}
