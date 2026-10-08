/**
 * Wraps an async loader so only the newest call's result is delivered:
 * when a viewer types fast, an older load that finishes late is dropped
 * instead of replacing the newer one.
 */
export function latestOnly<A, R>(
  load: (arg: A) => Promise<R>,
  deliver: (result: R) => void,
  fail: (err: unknown) => void,
): (arg: A) => void {
  let newest = 0
  return (arg) => {
    const call = ++newest
    load(arg).then(
      (result) => {
        if (call === newest) deliver(result)
      },
      (err: unknown) => {
        if (call === newest) fail(err)
      },
    )
  }
}
