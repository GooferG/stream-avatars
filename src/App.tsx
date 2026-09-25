import { useEffect, useRef } from 'react'
import { bootstrap } from './app/bootstrap'

export default function App() {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    // StrictMode runs effects twice in dev; the flag prevents a second
    // Pixi Application from surviving the first cleanup.
    let cancelled = false
    let dispose: (() => void) | undefined
    bootstrap(host).then(
      (d) => {
        if (cancelled) d()
        else dispose = d
      },
      (err) => console.error('[chat-avatars] bootstrap failed', err),
    )
    return () => {
      cancelled = true
      dispose?.()
      host.replaceChildren()
    }
  }, [])

  return <div ref={hostRef} className="stage-host" />
}
