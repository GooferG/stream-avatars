/** The one clipboard method the builder uses; `navigator.clipboard` is undefined on plain http. */
export interface ClipboardLike {
  writeText(text: string): Promise<void>
}

/** Copies with the clipboard when the browser allows it; 'manual' means select the text for Ctrl+C instead. */
export async function copyText(text: string, clipboard: ClipboardLike | undefined): Promise<'copied' | 'manual'> {
  if (!clipboard) return 'manual'
  try {
    await clipboard.writeText(text)
    return 'copied'
  } catch {
    return 'manual'
  }
}
