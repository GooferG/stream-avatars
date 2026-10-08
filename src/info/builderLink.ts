/** The strip's bottom line pointing at the builder page: the address without its scheme, or null without one. */
export function builderLinkText(url: string): string | null {
  if (!url) return null
  return `build yours: ${url.replace(/^https?:\/\//i, '')}`
}
