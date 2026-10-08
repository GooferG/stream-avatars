import type { AppConfig, DebugMode } from './types'
import { DEFAULT_CONFIG } from './defaults'
import { OVERRIDES } from './overrides'

const HEX_COLOR = /^#[0-9a-f]{6}$/i
const WEB_URL = /^https?:\/\/\S+$/i

/**
 * Precedence: defaults < overrides.ts < URL params.
 * Invalid or out-of-range params fall back to the previous layer.
 */
export function resolveConfig(
  params: URLSearchParams,
  overrides: Partial<AppConfig> = OVERRIDES,
): AppConfig {
  const cfg: AppConfig = { ...DEFAULT_CONFIG, ...overrides }

  const channel = params.get('channel')
  if (channel) cfg.channel = channel.trim().toLowerCase().replace(/^#/, '')

  cfg.maxAvatars = intParam(params, 'maxAvatars', cfg.maxAvatars, 1, 200)
  cfg.stripHeight = intParam(params, 'stripHeight', cfg.stripHeight, 48, 1080)
  // half steps (1, 1.5, 2...): 1.5 draws some art pixels 1 screen px wide and some 2, which stream compression hides
  const scaleOverride = isHalfStep(cfg.spriteScale) ? cfg.spriteScale : DEFAULT_CONFIG.spriteScale
  const scale = floatParam(params, 'scale', scaleOverride, 1, 8)
  cfg.spriteScale = isHalfStep(scale) ? scale : scaleOverride
  cfg.bubbleDurationMs = intParam(params, 'bubbleMs', cfg.bubbleDurationMs, 500, 60_000)

  // A crowd of 0 or 1 would react to every message, so a bad override is
  // treated like a bad param: fall back to the default.
  const crowdOverride = validOr(cfg.crowdChatters, 2, 50, DEFAULT_CONFIG.crowdChatters)
  cfg.crowdChatters = intParam(params, 'crowdChatters', crowdOverride, 2, 50)
  cfg.crowdWindowMs = intParam(params, 'crowdWindowSec', cfg.crowdWindowMs / 1000, 2, 120) * 1000
  cfg.crowdCooldownMs =
    intParam(params, 'crowdCooldownSec', cfg.crowdCooldownMs / 1000, 0, 600) * 1000

  const idleMinutes = floatParam(params, 'idleMinutes', cfg.idleTimeoutMs / 60_000, 0.05, 24 * 60)
  cfg.idleTimeoutMs = Math.round(idleMinutes * 60_000)
  cfg.lurkTimeoutMs = intParam(params, 'lurkMinutes', cfg.lurkTimeoutMs / 60_000, 1, 24 * 60) * 60_000
  cfg.maxLurkers = intParam(params, 'maxLurkers', cfg.maxLurkers, 0, 50)

  // a bad override is treated like a bad param: fall back to the default
  const interactionOverride = validOr(cfg.interactionCooldownMs, 0, 600_000, DEFAULT_CONFIG.interactionCooldownMs)
  cfg.interactionCooldownMs = intParam(params, 'interactionCooldownSec', interactionOverride / 1000, 0, 600) * 1000
  const targetOverride = validOr(cfg.targetCooldownMs, 0, 600_000, DEFAULT_CONFIG.targetCooldownMs)
  cfg.targetCooldownMs = intParam(params, 'targetCooldownSec', targetOverride / 1000, 0, 600) * 1000
  const challengeOverride = validOr(cfg.challengeTimeoutMs, 5_000, 300_000, DEFAULT_CONFIG.challengeTimeoutMs)
  cfg.challengeTimeoutMs = intParam(params, 'challengeSec', challengeOverride / 1000, 5, 300) * 1000
  if (typeof cfg.smokeEnabled !== 'boolean') cfg.smokeEnabled = DEFAULT_CONFIG.smokeEnabled
  const smoke = params.get('smoke')
  if (smoke === '0') cfg.smokeEnabled = false
  else if (smoke === '1') cfg.smokeEnabled = true

  const walkSpeed = params.get('walkSpeed')
  if (walkSpeed) {
    const m = /^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/.exec(walkSpeed)
    if (m) {
      const lo = Number(m[1])
      const hi = Number(m[2])
      if (lo > 0 && hi >= lo && hi <= 1000) cfg.walkSpeedRange = [lo, hi]
    }
  }

  const bots = params.get('bots')
  if (bots !== null) {
    cfg.ignoredBots = bots
      .split(',')
      .map((b) => b.trim().toLowerCase())
      .filter((b) => b.length > 0)
  }

  // Overrides-only settings (no URL params): a bad value falls back to the default.
  if (typeof cfg.brandColor !== 'string' || !HEX_COLOR.test(cfg.brandColor)) {
    cfg.brandColor = DEFAULT_CONFIG.brandColor
  }
  cfg.infoDurationMs = validOr(cfg.infoDurationMs, 2_000, 120_000, DEFAULT_CONFIG.infoDurationMs)
  cfg.infoCooldownMs = validOr(cfg.infoCooldownMs, 0, 3_600_000, DEFAULT_CONFIG.infoCooldownMs)
  cfg.avatarChangeCooldownMs = validOr(
    cfg.avatarChangeCooldownMs,
    0,
    600_000,
    DEFAULT_CONFIG.avatarChangeCooldownMs,
  )
  if (typeof cfg.builderUrl !== 'string' || !WEB_URL.test(cfg.builderUrl)) cfg.builderUrl = ''

  const debug = params.get('debug')
  if (debug === '1' || debug === 'grid') cfg.debug = debug as DebugMode

  cfg.ignoredBots = cfg.ignoredBots.map((b) => b.toLowerCase())
  return cfg
}

function intParam(
  params: URLSearchParams,
  name: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw = params.get(name)
  if (raw === null) return fallback
  const n = Number.parseInt(raw, 10)
  if (Number.isNaN(n) || n < min || n > max) return fallback
  return n
}

function floatParam(
  params: URLSearchParams,
  name: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw = params.get(name)
  if (raw === null) return fallback
  const n = Number.parseFloat(raw)
  if (Number.isNaN(n) || n < min || n > max) return fallback
  return n
}

/** A sprite scale from 1 to 8 in half steps. */
function isHalfStep(value: number): boolean {
  return inRange(value, 1, 8) && Number.isInteger(value * 2)
}

function inRange(value: number, min: number, max: number): boolean {
  return Number.isFinite(value) && value >= min && value <= max
}

function validOr(value: number, min: number, max: number, fallback: number): number {
  return inRange(value, min, max) ? value : fallback
}
