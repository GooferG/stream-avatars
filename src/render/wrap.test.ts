import { describe, expect, it } from 'vitest'
import { breakLines } from './wrap'

const words = (text: string) => text.split(' ').map((w) => ({ text: w, width: w.length }))
const wrap = (text: string, maxLines = Number.POSITIVE_INFINITY) =>
  breakLines(words(text), 10, 1, maxLines).map((line) => line.map((w) => w.text).join(' '))

describe('breakLines', () => {
  it('fills each line greedily, counting one gap between items', () => {
    expect(wrap('aaaa bbbbb cc dddddddddd e')).toEqual(['aaaa bbbbb', 'cc', 'dddddddddd', 'e'])
  })

  it('keeps an item wider than a line on a line of its own', () => {
    expect(wrap('aa bbbbbbbbbbbb cc')).toEqual(['aa', 'bbbbbbbbbbbb', 'cc'])
  })

  it('stops after the last allowed line', () => {
    expect(wrap('aaaa bbbb cccc dddd eeee', 2)).toEqual(['aaaa bbbb', 'cccc dddd'])
  })
})
