/** `!hug @Bob` -> 'bob': the first word after the command without its leading @s, lowercased; null if none. */
export function parseTarget(args: readonly string[]): string | null {
  const word = (args[0] ?? '').replace(/^@+/, '').toLowerCase()
  return word.length > 0 ? word : null
}

export interface Named {
  login: string
  displayName: string
}

/** The on-screen character a typed name means: a login match first, then a display name match. */
export function findTarget<T extends Named>(name: string, onScreen: Iterable<T>): T | null {
  let byDisplayName: T | null = null
  for (const character of onScreen) {
    if (character.login === name) return character
    if (byDisplayName === null && character.displayName.toLowerCase() === name) byDisplayName = character
  }
  return byDisplayName
}
