/**
 * OBS loads a source at exactly its set size; a dev browser window usually
 * isn't. Scales the page's root element down to fit (never up) so it can
 * be checked while developing.
 */
export function fitToWindow(host: HTMLElement, width: number, height: number): () => void {
  const apply = () => {
    const scale = Math.min(1, window.innerWidth / width, window.innerHeight / height)
    host.style.transformOrigin = 'top left'
    host.style.transform = scale < 1 ? `scale(${scale})` : ''
  }
  apply()
  window.addEventListener('resize', apply)
  return () => window.removeEventListener('resize', apply)
}
