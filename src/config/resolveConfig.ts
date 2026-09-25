import type { AppConfig, DebugMode } from './types'
import { DEFAULT_CONFIG } from './defaults'
import { OVERRIDES } from './overrides'

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
  cfg.spriteScale = intParam(params, 'scale', cfg.spriteScale, 1, 8)
  cfg.bubbleDurationMs = intParam(params, 'bubbleMs', cfg.bubbleDurationMs, 500, 60_000)

  // A crowd of 0 or 1 would react to every message, so a bad override is
  // treated like a bad param: fall back to the default.
  const crowdOverride = inRange(cfg.crowdChatters, 2, 50)
    ? cfg.crowdChatters
    : DEFAULT_CONFIG.crowdChatters
  cfg.crowdChatters = intParam(params, 'crowdChatters', crowdOverride, 2, 50)
  cfg.crowdWindowMs = intParam(params, 'crowdWindowSec', cfg.crowdWindowMs / 1000, 2, 120) * 1000
  cfg.crowdCooldownMs =
    intParam(params, 'crowdCooldownSec', cfg.crowdCooldownMs / 1000, 0, 600) * 1000

  const idleMinutes = floatParam(params, 'idleMinutes', cfg.idleTimeoutMs / 60_000, 0.05, 24 * 60)
  cfg.idleTimeoutMs = Math.round(idleMinutes * 60_000)

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

function inRange(value: number, min: number, max: number): boolean {
  return Number.isFinite(value) && value >= min && value <= max
}
