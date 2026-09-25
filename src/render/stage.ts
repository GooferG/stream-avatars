import { Application, Container, TextureSource } from 'pixi.js'

export const STAGE_WIDTH = 1920
export const STAGE_HEIGHT = 1080

export interface Stage {
  app: Application
  /** Avatars, z-sorted by strip depth. */
  avatarLayer: Container
  /** Name plates render above every avatar, z-sorted like them. */
  labelLayer: Container
  /** Bubbles render above everything else. */
  bubbleLayer: Container
  destroy(): void
}

export async function createStage(host: HTMLElement): Promise<Stage> {
  // Crisp pixels everywhere: nearest-neighbor sampling for all textures.
  TextureSource.defaultOptions.scaleMode = 'nearest'

  const app = new Application()
  await app.init({
    width: STAGE_WIDTH,
    height: STAGE_HEIGHT,
    backgroundAlpha: 0,
    antialias: false,
    resolution: 1,
    roundPixels: true,
  })
  // This shares the machine with a game and the OBS encoder; never render
  // faster than the overlay needs, even on high-refresh displays.
  app.ticker.maxFPS = 60
  host.appendChild(app.canvas)

  const avatarLayer = new Container()
  avatarLayer.sortableChildren = true
  const labelLayer = new Container()
  labelLayer.sortableChildren = true
  const bubbleLayer = new Container()
  app.stage.addChild(avatarLayer, labelLayer, bubbleLayer)

  return {
    app,
    avatarLayer,
    labelLayer,
    bubbleLayer,
    destroy() {
      app.destroy(true, { children: true, texture: true })
    },
  }
}
