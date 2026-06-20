import { useEffect, useRef } from 'react'
import { useCall } from './hooks/useCall'
import { useTheme } from './hooks/useTheme'
import { JoinScreen } from './components/JoinScreen'
import { CallScreen } from './components/CallScreen'
import { ThemeToggle } from './components/ThemeToggle'
import styles from './App.module.css'

export default function App() {
  const call = useCall()
  const { theme, toggle } = useTheme()
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    el.srcObject = call.remoteStream
    if (call.remoteStream) el.play().catch(() => {})
  }, [call.remoteStream])

  const inCall = call.state !== 'idle' && call.state !== 'ended'

  return (
    <div className={styles.app}>
      <div className={styles.card}>
        <header className={styles.titlebar}>
          <span className={styles.titleText}>◖ LOCALL</span>
          <span className={styles.titleControls}>
            <ThemeToggle theme={theme} onToggle={toggle} />
            <span className={styles.winbtns} aria-hidden>
              ▭ ✕
            </span>
          </span>
        </header>
        <div className={styles.body}>
          {inCall ? <CallScreen call={call} /> : <JoinScreen call={call} />}
        </div>
      </div>
      <audio ref={audioRef} autoPlay playsInline />
      <p className={styles.footnote}>ÁUDIO DIRETO PELA SUA REDE LOCAL · SEM INTERNET</p>
    </div>
  )
}
