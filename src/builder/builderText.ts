/** The page title, naming the channel the overlay is set up for. */
export function titleFor(channel: string): string {
  return channel ? `Build your avatar for ${channel}'s stream` : 'Build your avatar'
}

/** Under the line: what to do with it, and the overlay's per-viewer change cooldown. */
export function cooldownNote(cooldownMs: number): string {
  const seconds = Math.ceil(cooldownMs / 1000)
  if (seconds <= 0) return 'Paste it in chat.'
  return `Paste it in chat. Changes need about ${seconds} second${seconds === 1 ? '' : 's'} between them.`
}

/** Every command a viewer can use, with an example. `!sesh` is for the streamer and mods, so it's left out. */
export const VIEWER_COMMANDS: readonly { usage: string; does: string }[] = [
  { usage: '!avatar fox blue', does: 'pick your character: a kind, build, hairstyle, skin 1-6 and color, in any order' },
  { usage: '!skin 3', does: 'change only your skin tone, 1 (light) to 6 (deep)' },
  { usage: '!jump', does: 'jump' },
  { usage: '!lurk', does: 'sit down and watch; chatting or !jump stands you back up' },
  { usage: '!unlurk', does: 'stand back up' },
  { usage: '!avatarinfo', does: 'show every character and color on stream for a few seconds' },
  { usage: '!highfive @name', does: 'run over and high-five someone on screen' },
  { usage: '!hug @name', does: 'run over and hug someone on screen' },
  { usage: '!fight @name', does: 'challenge someone; they answer with !accept or by fighting back' },
  { usage: '!accept', does: 'take on a fight challenge' },
  { usage: '!clap', does: 'clap' },
  { usage: '!wave', does: 'wave' },
  { usage: '!dance', does: 'dance' },
  { usage: '!smoke', does: 'smoke a joint, or a bong with !smoke bong' },
  { usage: '!nointeract', does: 'nobody can high-five, hug or fight you' },
  { usage: '!interact', does: 'turn high-fives, hugs and fights back on' },
]
