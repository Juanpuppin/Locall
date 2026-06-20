import { useEffect, useRef } from 'react'
import { useCall } from './hooks/useCall'
import { useTheme } from './hooks/useTheme'
import { JoinScreen } from './components/JoinScreen'
import { CallScreen } from './components/CallScreen'
import { ThemeToggle } from './components/ThemeToggle'
import { Window } from './ui'
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
      <Window title="LOCALL" controls={<ThemeToggle theme={theme} onToggle={toggle} />}>
        {inCall ? <CallScreen call={call} /> : <JoinScreen call={call} />}
      </Window>
      <audio ref={audioRef} autoPlay playsInline />
      <p className={styles.footnote}>ÁUDIO DIRETO PELA SUA REDE LOCAL · SEM INTERNET</p>
    </div>
  )
}
