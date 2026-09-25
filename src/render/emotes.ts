import { Assets, type Texture } from 'pixi.js'

const CACHE_CAPACITY = 200

/** Static variant so animated emotes render as crisp stills. */
function emoteUrl(id: string): string {
  return `https://static-cdn.jtvnw.net/emoticons/v2/${id}/static/dark/2.0`
}

/**
 * LRU texture cache for Twitch emotes. Long streams see thousands of
 * distinct emotes; without eviction VRAM creeps forever. Eviction goes
 * through Assets.unload so Pixi destroys the texture properly. Failed
 * loads resolve to null and the bubble falls back to the emote's text.
 */
export class EmoteCache {
  private entries = new Map<string, Promise<Texture | null>>()

  get(id: string): Promise<Texture | null> {
    const existing = this.entries.get(id)
    if (existing) {
      // refresh recency
      this.entries.delete(id)
      this.entries.set(id, existing)
      return existing
    }

    const url = emoteUrl(id)
    // The CDN URL has no file extension, so name the parser explicitly.
    const loading: Promise<Texture | null> = Assets.load<Texture>({
      src: url,
      loadParser: 'loadTextures',
    })
      .then((t) => t ?? null)
      .catch(() => null)
    this.entries.set(id, loading)

    if (this.entries.size > CACHE_CAPACITY) {
      const oldest = this.entries.keys().next().value
      if (oldest !== undefined) {
        this.entries.delete(oldest)
        void Assets.unload(emoteUrl(oldest)).catch(() => {})
      }
    }
    return loading
  }
}
