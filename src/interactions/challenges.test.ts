import { describe, expect, it } from 'vitest'
import { ChallengeBook } from './challenges'

describe('ChallengeBook', () => {
  it('lets the target accept within the timeout, once', () => {
    const book = new ChallengeBook(30_000)
    book.challenge('alice', 'bob', 0)
    expect(book.acceptNewest('bob', 29_999)).toEqual({ from: 'alice', to: 'bob', expiresAt: 30_000 })
    expect(book.acceptNewest('bob', 29_999)).toBeNull()
  })

  it('lets a challenge expire', () => {
    const book = new ChallengeBook(30_000)
    book.challenge('alice', 'bob', 0)
    expect(book.acceptNewest('bob', 30_000)).toBeNull()
  })

  it('accepts the newest of several challenges first', () => {
    const book = new ChallengeBook(30_000)
    book.challenge('alice', 'bob', 0)
    book.challenge('carol', 'bob', 1_000)
    expect(book.acceptNewest('bob', 2_000)?.from).toBe('carol')
    expect(book.acceptNewest('bob', 2_000)?.from).toBe('alice')
  })

  it('keeps one challenge per challenger: a new one replaces it and becomes the newest', () => {
    const book = new ChallengeBook(30_000)
    book.challenge('alice', 'bob', 0)
    book.challenge('alice', 'carol', 1_000)
    expect(book.acceptNewest('bob', 2_000)).toBeNull()
    book.challenge('dave', 'carol', 2_000)
    book.challenge('alice', 'carol', 3_000)
    expect(book.acceptNewest('carol', 4_000)?.from).toBe('alice')
  })

  it('takes the challenge when its target fights back', () => {
    const book = new ChallengeBook(30_000)
    book.challenge('alice', 'bob', 0)
    expect(book.take('bob', 'alice', 1)).toBeNull() // bob never challenged alice
    expect(book.take('alice', 'bob', 1)?.from).toBe('alice')
    expect(book.size).toBe(0)
  })

  it('drops challenges from and to someone who opted out, and prunes the expired and the absent', () => {
    const book = new ChallengeBook(30_000)
    book.challenge('alice', 'bob', 0)
    book.challenge('erin', 'alice', 0)
    book.challenge('carol', 'dave', 0)
    book.challenge('frank', 'gina', 10_000)
    book.dropFor('alice')
    expect(book.size).toBe(2)
    book.prune(1, (login) => login !== 'dave')
    expect(book.size).toBe(1)
    book.prune(40_000, () => true)
    expect(book.size).toBe(0)
  })
})
