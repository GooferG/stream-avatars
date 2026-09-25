import type { AppConfig } from './types'

/**
 * The single user-editable config file. Anything set here overrides the
 * defaults; URL params override both. OBS local-file sources cannot pass URL
 * params, so settings for that setup belong here (rebuild after editing).
 * Example:
 *
 *   export const OVERRIDES: Partial<AppConfig> = {
 *     channel: 'gooferg',
 *     idleTimeoutMs: 5 * 60_000,
 *     ignoredBots: ['nightbot', 'streamelements', 'mycustombot'],
 *   }
 */
export const OVERRIDES: Partial<AppConfig> = {
  channel: 'gooferg',
}
