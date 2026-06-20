import { useEffect, useRef } from 'react'
import styles from './ScreenView.module.css'

interface ScreenViewProps {
  stream: MediaStream | null
}

/** Superfície de vídeo da tela compartilhada, com botão de tela cheia. */
export function ScreenView({ stream }: ScreenViewProps) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const v = ref.current
    if (!v) return
    v.srcObject = stream
    if (stream) v.play().catch(() => {})
  }, [stream])

  const goFullscreen = () => {
    const v = ref.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null
    if (!v) return
    if (v.requestFullscreen) void v.requestFullscreen().catch(() => {})
    else if (v.webkitEnterFullscreen) v.webkitEnterFullscreen() // iOS Safari
  }

  if (!stream) return null

  return (
    <div className={styles.wrap}>
      <video ref={ref} className={styles.video} autoPlay playsInline muted />
      <button className={styles.fs} onClick={goFullscreen} aria-label="Tela cheia" title="Tela cheia">
        ⛶
      </button>
    </div>
  )
}
