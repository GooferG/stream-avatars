import type { Container } from 'pixi.js'
import type { Reaction } from '../chat/mood'
import type { ChatMessageEvent, EmoteSpan } from '../chat/types'
import type { AppConfig } from '../config/types'
import { buildBubble } from '../render/bubble'
import { characterColors, roleTints } from '../render/color'
import type { EmoteCache } from '../render/emotes'
import { groundLine } from '../render/placement'
import { CHAT_BUBBLE_LINES, OVERLAY_BUBBLE_LINES } from '../render/wrap'
import { PALETTES } from '../render/sprites/contract'
import { layersFor } from '../render/sprites/roster'
import type { SpriteCatalog } from '../render/sprites/loader'
import { isPrintableAscii } from '../utils/text'
import { Avatar, type AvatarLayer } from './avatar'
import { choiceAction } from './chooser'
import { lookDna, resolveLook, type Choice, type LookDna } from './look'
import { LurkRoster } from './lurkRoster'
import { AvatarStateMachine } from './stateMachine'

const SWEEP_INTERVAL_MS = 1_000
/** Crowd reactions start staggered by up to this much, so the crowd erupts in a ripple. */
const CROWD_RIPPLE_MS = 400

export interface ManagerOptions {
  cfg: AppConfig
  catalog: SpriteCatalog
  avatarLayer: Container
  labelLayer: Container
  bubbleLayer: Container
  emoteCache: EmoteCache
  stageWidth: number
  stageHeight: number
  /** The viewer's saved `!avatar` pick, if any. */
  choiceFor: (login: string) => Choice | null
  /** Emotes a chat message holds beyond the Twitch ones in its tags (7TV). */
  extraEmotes?: (text: string, twitchEmotes: readonly EmoteSpan[]) => EmoteSpan[]
}

/**
 * Owns the avatar lifecycle. Keyed by lowercase login and never cleared on
 * reconnects, so chat source reconnection can never duplicate an avatar.
 */
export class AvatarManager {
  private options: ManagerOptions
  private avatars = new Map<string, Avatar>()
  private lastSweepAt = 0
  private lurkers = new LurkRoster()

  constructor(options: ManagerOptions) {
    this.options = options
  }

  get count(): number {
    return this.avatars.size
  }

  handleMessage(event: ChatMessageEvent, now: number): void {
    const avatar = this.getOrSpawn(event, now)
    if (!avatar) return
    avatar.touch(now)
    this.endLurk(event.login) // coming back: the state machine stands them up
    avatar.machine.onMessage()
    // chat only: the overlay's own text (the !avatar help) never turns into emotes
    const extra = this.options.extraEmotes?.(event.text, event.emotes) ?? []
    this.attachBubble(avatar, event.text, [...event.emotes, ...extra], now)
  }

  /** Commands animate but intentionally show no bubble. */
  jumpFor(event: ChatMessageEvent, now: number): void {
    const avatar = this.getOrSpawn(event, now)
    if (!avatar) return
    avatar.touch(now)
    this.endLurk(event.login) // coming back: the state machine stands them up
    avatar.machine.onJump()
  }

  /**
   * `!lurk`: sit down to watch, faded and behind the chatters, until they
   * chat, jump, `!unlurk` or the lurk times out. Lurkers have their own cap
   * and never count toward maxAvatars, so a new one never pushes a chatter out.
   */
  lurk(event: ChatMessageEvent, now: number): void {
    const { maxLurkers } = this.options.cfg
    if (maxLurkers === 0 || this.lurkers.isLurking(event.login)) return
    const existing = this.avatars.get(event.login)
    if (existing?.machine.state === 'leaving') return
    const avatar = existing ?? this.spawn(event, now, false)
    avatar.touch(now)
    avatar.machine.onLurk()
    for (const login of this.lurkers.start(event.login, now, maxLurkers)) {
      this.avatars.get(login)?.machine.beginLeave()
    }
  }

  /** `!unlurk`: stand back up as a normal chatter. */
  unlurk(event: ChatMessageEvent, now: number): void {
    if (!this.endLurk(event.login)) return
    const avatar = this.avatars.get(event.login)
    if (!avatar) return
    avatar.touch(now)
    avatar.machine.onUnlurk()
  }

  /** A viewer's pick was saved: swap it in place (see choiceAction), or walk in wearing it. */
  applyChoice(event: ChatMessageEvent, now: number): void {
    const existing = this.avatars.get(event.login)
    const action = choiceAction(existing?.machine.state ?? null)
    if (action === 'wait') return
    let avatar = existing
    if (action !== 'spawn' && avatar) {
      const dna = lookDna(event.login, this.options.cfg.walkSpeedRange)
      avatar.setLayers(this.characterFor(event, dna).layers)
    } else {
      avatar = this.spawn(event, now)
    }
    avatar.touch(now)
    if (action === 'swap') avatar.machine.onJump()
  }

  /** Overlay text (like the `!avatar` help) in a speech bubble over the chatter's character. */
  say(event: ChatMessageEvent, text: string, now: number): void {
    const avatar = this.getOrSpawn(event, now)
    if (!avatar) return
    avatar.touch(now)
    this.attachBubble(avatar, text, [], now, 'overlay')
  }

  /** Plays a ChatMood reaction. Missing or ineligible avatars are skipped by their state machine. */
  react(reaction: Reaction): void {
    const { selfReactionMs, crowdReactionMs } = this.options.cfg
    if (reaction.scope === 'self') {
      this.avatars.get(reaction.login)?.machine.onReact(reaction.mood, selfReactionMs / 1000)
      return
    }
    for (const avatar of this.avatars.values()) {
      const delaySec = (Math.random() * CROWD_RIPPLE_MS) / 1000
      avatar.machine.onReact(reaction.mood, crowdReactionMs / 1000, delaySec)
    }
  }

  update(dtSec: number, now: number): void {
    if (this.avatars.size === 0) return // keep the encoder's CPU for the game

    for (const [login, avatar] of this.avatars) {
      avatar.update(dtSec, now)
      if (avatar.machine.state === 'gone') {
        avatar.destroy()
        this.avatars.delete(login)
        this.lurkers.stop(login)
      }
    }

    if (now - this.lastSweepAt >= SWEEP_INTERVAL_MS) {
      this.lastSweepAt = now
      const { idleTimeoutMs, lurkTimeoutMs } = this.options.cfg
      for (const login of this.lurkers.expire(now, lurkTimeoutMs)) {
        this.avatars.get(login)?.machine.beginLeave()
      }
      for (const [login, avatar] of this.avatars) {
        if (this.lurkers.isLurking(login)) continue // lurkers have their own timeout
        if (avatar.machine.state !== 'leaving' && now - avatar.lastActiveAt > idleTimeoutMs) {
          avatar.machine.beginLeave()
        }
      }
    }
  }

  destroy(): void {
    for (const avatar of this.avatars.values()) avatar.destroy()
    this.avatars.clear()
  }

  private getOrSpawn(event: ChatMessageEvent, now: number): Avatar | null {
    const existing = this.avatars.get(event.login)
    if (existing) {
      // Messages during the walk-off are dropped; the user respawns fresh
      // on their next message once the avatar is gone.
      return existing.machine.state === 'leaving' ? null : existing
    }
    return this.spawn(event, now)
  }

  private spawn(event: ChatMessageEvent, now: number, evictChatters = true): Avatar {
    const { cfg } = this.options
    if (evictChatters) this.evictIfFull()

    const dna = lookDna(event.login, cfg.walkSpeedRange)

    const machine = new AvatarStateMachine({
      bounds: { minX: 0, maxX: this.options.stageWidth },
      walkSpeed: dna.walkSpeed,
      bubbleDurationMs: cfg.bubbleDurationMs,
      rng: Math.random,
    })

    // Deeper in the strip = higher on screen and behind closer avatars.
    const baseY = groundLine(this.options.stageHeight, cfg.stripHeight, dna.depth)

    const { layers, labelTint } = this.characterFor(event, dna)
    const avatar = new Avatar(
      {
        login: event.login,
        labelText: isPrintableAscii(event.displayName) ? event.displayName : event.login,
        labelTint,
        layers,
        machine,
        scale: cfg.spriteScale,
        baseY,
        stageWidth: this.options.stageWidth,
        labelLayer: this.options.labelLayer,
        bubbleLayer: this.options.bubbleLayer,
      },
      now,
    )
    this.avatars.set(event.login, avatar)
    this.options.avatarLayer.addChild(avatar.container)
    return avatar
  }

  /** A chatter's layer stack and name tag color: username look plus saved pick, in their chat color. */
  private characterFor(
    event: ChatMessageEvent,
    dna: LookDna,
  ): { layers: AvatarLayer[]; labelTint: number } {
    const { catalog, choiceFor } = this.options
    const look = resolveLook(dna.look, choiceFor(event.login))
    const fallbackBody = PALETTES[dna.paletteIndex]?.body ?? 0xffffff
    const colors = characterColors(event.color, fallbackBody)
    const tints = roleTints(look, colors)
    const layers = layersFor(look).map((ref) => {
      const set = catalog.get(ref.sheet)
      if (!set) throw new Error(`missing sprite sheet ${ref.sheet}`)
      return { set, tint: tints[ref.role] }
    })
    return { layers, labelTint: colors.body }
  }

  /**
   * A lurker standing back up counts as a chatter again, so they arrive
   * like one: the cap is made room for while they're still excluded as a
   * lurker. True if they were lurking.
   */
  private endLurk(login: string): boolean {
    if (!this.lurkers.isLurking(login)) return false
    this.evictIfFull()
    return this.lurkers.stop(login)
  }

  private evictIfFull(): void {
    // lurkers have their own cap (see lurk), so chatters never evict them
    const active = [...this.avatars]
      .filter(([login, a]) => !this.lurkers.isLurking(login) && a.machine.state !== 'leaving' && a.machine.state !== 'gone')
      .map(([, a]) => a)
    if (active.length < this.options.cfg.maxAvatars) return
    let oldest: Avatar | null = null
    for (const avatar of active) {
      if (!oldest || avatar.lastActiveAt < oldest.lastActiveAt) oldest = avatar
    }
    // Briefly exceeding the cap while the evictee walks off reads as intended.
    oldest?.machine.beginLeave()
  }

  /** Chat bubbles are capped against spam; the overlay's own text (like the help) shows in full. */
  private attachBubble(
    avatar: Avatar,
    text: string,
    emotes: EmoteSpan[],
    now: number,
    source: 'chat' | 'overlay' = 'chat',
  ): void {
    const { cfg, emoteCache } = this.options
    const overlay = source === 'overlay'
    void buildBubble(text, emotes, {
      maxChars: overlay ? Number.POSITIVE_INFINITY : cfg.bubbleMaxChars,
      maxLines: overlay ? OVERLAY_BUBBLE_LINES : CHAT_BUBBLE_LINES,
      emoteCache,
    }).then((bubble) => {
      if (!bubble) return
      if (avatar.destroyed) {
        bubble.destroy()
        return
      }
      avatar.showBubble(bubble, now, cfg.bubbleDurationMs)
    })
  }
}
