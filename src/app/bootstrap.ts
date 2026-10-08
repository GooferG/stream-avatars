import {
  AVATAR_HELP,
  parseAvatarCommand,
  parseSkinCommand,
  SKIN_HELP,
  type AvatarCommand,
} from '../avatars/avatarCommand'
import { AvatarChooser } from '../avatars/chooser'
import { ChoiceStore } from '../avatars/choiceStore'
import { AvatarManager } from '../avatars/manager'
import { CommandRegistry } from '../chat/commands'
import { ChatMood } from '../chat/mood'
import { SevenTvEmotes } from '../chat/sevenTv'
import { TmiChatSource } from '../chat/tmiSource'
import type {
  ChatCommandEvent,
  ChatEventSource,
  ChatMessageEvent,
  ConnectionState,
} from '../chat/types'
import { resolveConfig } from '../config/resolveConfig'
import type { AppConfig } from '../config/types'
import { INFO_COMMANDS, InfoState, isPrivileged, showHelpInstead } from '../info/infoState'
import { smokeEmote } from '../interactions/emotes'
import { PAIR_KINDS } from '../interactions/gate'
import { InteractionStore } from '../interactions/interactionStore'
import { EffectLayer } from '../render/effects/effectLayer'
import { EmoteCache } from '../render/emotes'
import { loadPixelFont } from '../render/font'
import { loadSpriteCatalog } from '../render/sprites/loader'
import { createStage, STAGE_HEIGHT, STAGE_WIDTH } from '../render/stage'
import { browserStorage, SafeStorage } from '../utils/storage'
import { startFakeChat } from './fakeChat'
import { fitToWindow } from './fitToWindow'

/** How often the channel's 7TV emotes are fetched again, so ones added mid-stream show up. */
const SEVEN_TV_REFRESH_MS = 5 * 60_000

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

  const unfit = fitToWindow(host, STAGE_WIDTH, STAGE_HEIGHT)
  await loadPixelFont()
  const stage = await createStage(host)
  const catalog = await loadSpriteCatalog()
  const emoteCache = new EmoteCache()
  const sevenTv = new SevenTvEmotes()

  // one never-throwing store shared by picks (and the info strip protocol)
  const storage = new SafeStorage(browserStorage())
  const choices = new ChoiceStore(storage)
  const chooser = new AvatarChooser(choices, cfg.avatarChangeCooldownMs)
  const interactionStore = new InteractionStore(storage)
  const effects = new EffectLayer(stage.effectLayer, cfg.spriteScale)

  const manager = new AvatarManager({
    cfg,
    catalog,
    avatarLayer: stage.avatarLayer,
    labelLayer: stage.labelLayer,
    bubbleLayer: stage.bubbleLayer,
    emoteCache,
    stageWidth: STAGE_WIDTH,
    stageHeight: STAGE_HEIGHT,
    choiceFor: (login) => choices.get(login),
    extraEmotes: (text, twitchEmotes) => sevenTv.spansFor(text, twitchEmotes),
    interactionStore,
    effects,
  })

  const commands = new CommandRegistry()
  commands.register('jump', (e) => manager.jumpFor(e.message, performance.now()))
  commands.register('lurk', (e) => manager.lurk(e.message, performance.now()))
  commands.register('unlurk', (e) => manager.unlurk(e.message, performance.now()))
  // !avatar combos and the !skin shortcut share one cooldown per viewer
  const choose = (e: ChatCommandEvent, command: AvatarCommand, help: string) => {
    const now = performance.now()
    const outcome = chooser.choose(e.message.login, command, now)
    if (outcome === 'help') manager.say(e.message, help, now)
    else if (outcome === 'changed') manager.applyChoice(e.message, now)
  }
  commands.register('avatar', (e) => choose(e, parseAvatarCommand(e.args), AVATAR_HELP))
  commands.register('skin', (e) => choose(e, parseSkinCommand(e.args), SKIN_HELP))
  // !avatarinfo opens the strip (its own OBS source); the overlay only
  // steps in with the help bubble when the strip won't open for it
  const info = new InfoState(storage)
  const onInfo = (e: ChatCommandEvent) => {
    const showHelp = showHelpInstead({
      now: Date.now(),
      lastOpen: info.lastOpen(),
      aliveAt: info.aliveAt(),
      messageId: e.message.messageId,
      privileged: isPrivileged(e.message.tags),
      cooldownMs: cfg.infoCooldownMs,
    })
    if (showHelp) manager.say(e.message, AVATAR_HELP, performance.now())
  }
  for (const name of INFO_COMMANDS) commands.register(name, onInfo)
  // interactions between chatters, and the opt-out
  for (const kind of PAIR_KINDS) commands.register(kind, (e) => manager.interact(kind, e, performance.now()))
  commands.register('accept', (e) => manager.accept(e.message, performance.now()))
  commands.register('nointeract', (e) => manager.setInteractions(e.message, false, performance.now()))
  commands.register('interact', (e) => manager.setInteractions(e.message, true, performance.now()))
  // solo emotes; the manager ignores !smoke and !sesh unless smokeEnabled
  for (const name of ['clap', 'wave', 'dance'] as const) {
    commands.register(name, (e) => manager.emote(name, e.message, performance.now()))
  }
  commands.register('smoke', (e) => manager.emote(smokeEmote(e.args), e.message, performance.now()))
  commands.register('sesh', (e) => {
    if (isPrivileged(e.message.tags)) manager.sesh()
  })

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
  let sevenTvRefresh: ReturnType<typeof setInterval> | undefined
  if (cfg.channel) {
    source = new TmiChatSource(cfg.channel, { ignoredBots: cfg.ignoredBots })
    source.on('message', onChat)
    source.on('command', (e) => commands.dispatch(e))
    source.on('state', (s) => {
      connectionState = s
    })
    // every (re)join names the channel's id; 7TV emotes load from it
    source.on('room', (roomId) => {
      void sevenTv.load(roomId)
      clearInterval(sevenTvRefresh)
      sevenTvRefresh = setInterval(() => void sevenTv.load(roomId), SEVEN_TV_REFRESH_MS)
    })
    // A rejected first attempt is not fatal: tmi.js keeps reconnecting.
    source.connect().catch((err) => {
      if (!disposed) console.warn('[chat-avatars] initial chat connect failed, retrying', err)
    })
  }

  let frameCount = 0
  stage.app.ticker.add((ticker) => {
    frameCount++
    const now = performance.now()
    manager.update(ticker.deltaMS / 1000, now)
    effects.update(ticker.deltaMS) // same clamped frame time the interactions run on
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
      interactionStore,
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
    clearInterval(sevenTvRefresh)
    unfit()
    stopFake()
    stopOverlay()
    void source?.disconnect().catch(() => {})
    manager.destroy()
    effects.destroy()
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
