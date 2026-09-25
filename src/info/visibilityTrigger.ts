/** How soon a show must follow a hide to count as the Stream Deck button. */
export const BLINK_MS = 3_000

/**
 * OBS tells the page when its source is shown or hidden. The strip source
 * stays visible (the strip is invisible while down), so the Stream Deck's
 * silent button is a quick hide then show. A source becoming visible for
 * any other reason (the page loading, switching to a scene that contains
 * it) does not open the strip.
 */
export class BlinkDetector {
  private hiddenAt: number | null = null

  /** True when this change completes a blink. */
  onVisibleChanged(visible: boolean, now: number): boolean {
    if (!visible) {
      this.hiddenAt = now
      return false
    }
    const blink = this.hiddenAt !== null && now - this.hiddenAt <= BLINK_MS
    this.hiddenAt = null
    return blink
  }
}
