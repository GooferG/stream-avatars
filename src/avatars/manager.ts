import type { Container } from 'pixi.js'
import type { Reaction } from '../chat/mood'
import type { ChatMessageEvent } from '../chat/types'
import type { AppConfig } from '../config/types'
import { buildBubble } from '../render/bubble'
import { characterColors } from '../render/color'
import type { EmoteCache } from '../render/emotes'
import { PALETTES } from '../render/sprites/contract'
import type { SpriteCatalog } from '../render/sprites/loader'
import { isPrintableAscii } from '../utils/text'
import { Avatar, LABEL_ROOM } from './avatar'
import { generateDna } from './dna'
import { AvatarStateMachine } from './stateMachine'

const SWEEP_INTERVAL_MS = 1_000
/** Visual footprint of a scaled sprite plus label, for strip depth math. */
const AVATAR_ROOM = 130
/** Crowd reactions start staggered by up to this much, so the crowd erupts in a ripple. */
const CROWD_RIPPLE_MS = 400

export interface ManagerOptions {
  cfg: AppConfig
  catalog: SpriteCatalog
  avatarLayer: Container
  bubbleLayer: Container
  emoteCache: EmoteCache
  stageWidth: number
  stageHeight: number
}

/**
 * Owns the avatar lifecycle. Keyed by lowercase login and never cleared on
 * reconnects, so chat source reconnection can never duplicate an avatar.
 */
export class AvatarManager {
  private options: ManagerOptions
  private avatars = new Map<string, Avatar>()
  private lastSweepAt = 0

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
    avatar.machine.onMessage()
    this.attachBubble(avatar, event, now)
  }

  /** Commands animate but intentionally show no bubble. */
  jumpFor(event: ChatMessageEvent, now: number): void {
    const avatar = this.getOrSpawn(event, now)
    if (!avatar) return
    avatar.touch(now)
    avatar.machine.onJump()
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
      }
    }

    if (now - this.lastSweepAt >= SWEEP_INTERVAL_MS) {
      this.lastSweepAt = now
      for (const avatar of this.avatars.values()) {
        if (
          avatar.machine.state !== 'leaving' &&
          now - avatar.lastActiveAt > this.options.cfg.idleTimeoutMs
        ) {
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

  private spawn(event: ChatMessageEvent, now: number): Avatar {
    const { cfg, catalog } = this.options
    this.evictIfFull()

    const dna = generateDna(event.login, {
      bodyCount: catalog.bodies.length,
      accessoryCount: catalog.accessories.length,
      palettes: PALETTES,
    }, cfg.walkSpeedRange)

    const machine = new AvatarStateMachine({
      bounds: { minX: 0, maxX: this.options.stageWidth },
      walkSpeed: dna.walkSpeed,
      bubbleDurationMs: cfg.bubbleDurationMs,
      rng: Math.random,
    })

    // Deeper in the strip = higher on screen and behind closer avatars.
    const depthRange = Math.max(0, cfg.stripHeight - AVATAR_ROOM)
    const baseY = this.options.stageHeight - LABEL_ROOM - dna.depth * depthRange

    const body = catalog.bodies[dna.bodyIndex]
    if (!body) throw new Error(`missing body sheet ${dna.bodyIndex}`)
    const accessory = dna.accessoryIndex >= 0
      ? catalog.accessories[dna.accessoryIndex] ?? null
      : null

    // body matches the chat name color; the username's palette is the fallback
    const colors = characterColors(event.color, dna.bodyTint)
    const avatar = new Avatar(
      {
        login: event.login,
        labelText: isPrintableAscii(event.displayName) ? event.displayName : event.login,
        bodyTint: colors.body,
        accentTint: colors.accent,
        body,
        accessory,
        machine,
        scale: cfg.spriteScale,
        baseY,
        stageWidth: this.options.stageWidth,
        bubbleLayer: this.options.bubbleLayer,
      },
      now,
    )
    this.avatars.set(event.login, avatar)
    this.options.avatarLayer.addChild(avatar.container)
    return avatar
  }

  private evictIfFull(): void {
    const active = [...this.avatars.values()].filter(
      (a) => a.machine.state !== 'leaving' && a.machine.state !== 'gone',
    )
    if (active.length < this.options.cfg.maxAvatars) return
    let oldest: Avatar | null = null
    for (const avatar of active) {
      if (!oldest || avatar.lastActiveAt < oldest.lastActiveAt) oldest = avatar
    }
    // Briefly exceeding the cap while the evictee walks off reads as intended.
    oldest?.machine.beginLeave()
  }

  private attachBubble(avatar: Avatar, event: ChatMessageEvent, now: number): void {
    const { cfg, emoteCache } = this.options
    void buildBubble(event.text, event.emotes, {
      maxChars: cfg.bubbleMaxChars,
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
