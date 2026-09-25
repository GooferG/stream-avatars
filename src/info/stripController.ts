export interface StripView {
  show(): void
  hide(): void
}

/**
 * When the strip is up: `durationMs` after the last opening. Opening while
 * it's already up restarts the countdown instead of replaying the slide.
 */
export class StripController {
  private view: StripView
  private durationMs: number
  private closeTimer: ReturnType<typeof setTimeout> | null = null

  constructor(view: StripView, durationMs: number) {
    this.view = view
    this.durationMs = durationMs
  }

  get isOpen(): boolean {
    return this.closeTimer !== null
  }

  open(): void {
    if (this.closeTimer === null) this.view.show()
    else clearTimeout(this.closeTimer)
    this.closeTimer = setTimeout(() => {
      this.closeTimer = null
      this.view.hide()
    }, this.durationMs)
  }
}
