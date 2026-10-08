import { describe, expect, it } from 'vitest'
import { builderLinkText } from './builderLink'

describe('builderLinkText', () => {
  it('shows the address without its scheme', () => {
    expect(builderLinkText('https://gooferg.github.io/stream-avatars/builder.html')).toBe(
      'build yours: gooferg.github.io/stream-avatars/builder.html',
    )
    expect(builderLinkText('http://example.test/b')).toBe('build yours: example.test/b')
  })

  it('shows nothing without an address', () => {
    expect(builderLinkText('')).toBeNull()
  })
})
