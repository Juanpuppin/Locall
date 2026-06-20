import { useEffect, useState } from 'react'

/** Segundos decorridos desde `startedAt` (ms). 0 quando null. */
export function useElapsed(startedAt: number | null): number {
  const [sec, setSec] = useState(0)

  useEffect(() => {
    if (startedAt == null) {
      setSec(0)
      return
    }
    const update = () => setSec(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)))
    update()
    const t = window.setInterval(update, 1000)
    return () => window.clearInterval(t)
  }, [startedAt])

  return sec
}

export function formatDuration(totalSec: number): string {
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}
