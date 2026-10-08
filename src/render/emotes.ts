import { ImageSource, Texture } from 'pixi.js'
import { GifSource } from 'pixi.js/gif'
import type { EmoteSpan } from '../chat/types'
import { emoteUrl, isGif, type EmoteSize } from './emoteImages'

const CACHE_CAPACITY = 200

/** A loaded emote: one texture, or GIF frames that every bubble showing it shares. */
export type EmoteImage =
  | { kind: 'still'; texture: Texture; width: number; height: number }
  | { kind: 'animated'; source: GifSource; width: number; height: number }

/**
 * LRU cache for Twitch and 7TV emote images. Long streams see thousands of
 * distinct emotes; without eviction VRAM creeps forever. Failed loads
 * resolve to null and the bubble falls back to the emote's text. Each size
 * is its own entry: a jumbo emote is a different file.
 */
export class EmoteCache {
  private entries = new Map<string, Promise<EmoteImage | null>>()

  get(emote: EmoteSpan, size: EmoteSize = 1): Promise<EmoteImage | null> {
    const key = `${emote.provider}:${emote.id}@${size}`
    const existing = this.entries.get(key)
    if (existing) {
      // refresh recency
      this.entries.delete(key)
      this.entries.set(key, existing)
      return existing
    }

    const loading = loadEmote(emoteUrl(emote, size))
    this.entries.set(key, loading)

    if (this.entries.size > CACHE_CAPACITY) {
      const [oldestKey, oldest] = this.entries.entries().next().value ?? []
      if (oldestKey !== undefined && oldest) {
        this.entries.delete(oldestKey)
        void oldest.then((image) => image && destroyImage(image))
      }
    }
    return loading
  }
}

/**
 * Twitch's URLs carry no file extension and its `default` file may be a GIF
 * or a PNG, so the bytes decide. Emotes are smooth art, not pixel art: they
 * scale with linear filtering, unlike the stage's nearest-neighbour default.
 */
async function loadEmote(url: string): Promise<EmoteImage | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const buffer = await res.arrayBuffer()
    if (isGif(new Uint8Array(buffer))) {
      const source = GifSource.from(buffer, { scaleMode: 'linear' })
      return { kind: 'animated', source, width: source.width, height: source.height }
    }
    const bitmap = await createImageBitmap(new Blob([buffer]))
    const texture = new Texture({ source: new ImageSource({ resource: bitmap, scaleMode: 'linear' }) })
    return { kind: 'still', texture, width: bitmap.width, height: bitmap.height }
  } catch {
    return null
  }
}

function destroyImage(image: EmoteImage): void {
  if (image.kind === 'animated') image.source.destroy()
  else image.texture.destroy(true)
}
