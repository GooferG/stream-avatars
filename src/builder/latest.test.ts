import { describe, expect, it } from 'vitest'
import { latestOnly } from './latest'

function deferred<T>(): { promise: Promise<T>; resolve(value: T): void; reject(err: unknown): void } {
  let resolve: (value: T) => void = () => {}
  let reject: (err: unknown) => void = () => {}
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('latestOnly', () => {
  it('delivers only the newest call, even when an older one finishes last', async () => {
    const calls = [deferred<string>(), deferred<string>()]
    const delivered: string[] = []
    const load = latestOnly(
      (i: number) => calls[i]?.promise ?? Promise.reject(new Error('no such call')),
      (result) => delivered.push(result),
      () => {},
    )
    load(0)
    load(1)
    calls[1]?.resolve('newest')
    calls[0]?.resolve('older')
    await settle()
    expect(delivered).toEqual(['newest'])
  })

  it('reports a failure of the newest call and ignores stale ones', async () => {
    const calls = [deferred<string>(), deferred<string>()]
    const failures: unknown[] = []
    const load = latestOnly(
      (i: number) => calls[i]?.promise ?? Promise.reject(new Error('no such call')),
      () => {},
      (err) => failures.push(err),
    )
    load(0)
    load(1)
    calls[0]?.reject(new Error('stale'))
    calls[1]?.reject(new Error('newest'))
    await settle()
    expect(failures.map((err) => (err as Error).message)).toEqual(['newest'])
  })
})
