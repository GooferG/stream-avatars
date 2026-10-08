import { describe, expect, it } from 'vitest'
import { copyText } from './copy'

describe('copyText', () => {
  it('copies with the clipboard when the browser allows it', async () => {
    const written: string[] = []
    const clipboard = {
      writeText: (text: string) => {
        written.push(text)
        return Promise.resolve()
      },
    }
    expect(await copyText('!avatar fox natural', clipboard)).toBe('copied')
    expect(written).toEqual(['!avatar fox natural'])
  })

  it('asks for a manual copy when the clipboard refuses', async () => {
    const clipboard = { writeText: () => Promise.reject(new Error('denied')) }
    expect(await copyText('!avatar fox natural', clipboard)).toBe('manual')
  })

  it('asks for a manual copy without a clipboard (plain http)', async () => {
    expect(await copyText('!avatar fox natural', undefined)).toBe('manual')
  })
})
