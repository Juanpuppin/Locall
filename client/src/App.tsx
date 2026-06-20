import { useEffect, useRef, useState } from 'react'
import { useCall } from './hooks/useCall'
import { useTheme } from './hooks/useTheme'
import { JoinScreen } from './components/JoinScreen'
import { CallScreen } from './components/CallScreen'
import { Taskbar, type Launcher } from './components/Taskbar'
import { ScreenView, Window } from './ui'
import styles from './App.module.css'

export default function App() {
  const call = useCall()
  const { theme, toggle } = useTheme()
  const audioRef = useRef<HTMLAudioElement>(null)

  // z-index incremental para trazer janelas à frente
  const zRef = useRef(10)
  const getNextZ = () => (zRef.current += 1)

  // Janela de Tela: aberta/fechada pelo usuário; reabre ao chegar novo compartilhamento
  const [screenOpen, setScreenOpen] = useState(true)
  const prevScreen = useRef<MediaStream | null>(null)
  useEffect(() => {
    if (call.remoteScreenStream && call.remoteScreenStream !== prevScreen.current) setScreenOpen(true)
    prevScreen.current = call.remoteScreenStream
  }, [call.remoteScreenStream])

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    el.srcObject = call.remoteStream
    if (call.remoteStream) el.play().catch(() => {})
  }, [call.remoteStream])

  const inCall = call.state !== 'idle' && call.state !== 'ended'
  const showScreen = inCall && !!call.remoteScreenStream && screenOpen

  const launchers: Launcher[] = []
  if (inCall && call.remoteScreenStream) {
    launchers.push({
      key: 'screen',
      label: call.remoteName ? `Tela de ${call.remoteName}` : 'Tela compartilhada',
      icon: '🖥️',
      active: showScreen,
      attention: !showScreen, // compartilhando mas minimizada
      onClick: () => setScreenOpen((o) => !o),
    })
  }

  return (
    <div className={styles.desktop}>
      <div className={styles.canvas}>
        {inCall ? (
          <Window
            title="CHAMADA"
            icon="◉"
            accent="purple"
            defaultRect={{ x: 28, y: 28, w: 360, h: 'auto' }}
            getNextZ={getNextZ}
          >
            <CallScreen call={call} />
          </Window>
        ) : (
          <Window
            title="ENTRAR"
            icon="◖"
            accent="purple"
            defaultRect={{ x: 28, y: 28, w: 380, h: 'auto' }}
            getNextZ={getNextZ}
          >
            <JoinScreen call={call} />
          </Window>
        )}

        {showScreen && (
          <Window
            title={`TELA · ${call.remoteName ?? ''}`.trim()}
            icon="▤"
            accent="teal"
            resizable
            closable
            flush
            defaultRect={{ x: 420, y: 28, w: 496, h: 312 }}
            minW={280}
            minH={200}
            onClose={() => setScreenOpen(false)}
            getNextZ={getNextZ}
          >
            <ScreenView stream={call.remoteScreenStream} />
          </Window>
        )}
      </div>

      <Taskbar theme={theme} onToggle={toggle} launchers={launchers} />
      <audio ref={audioRef} autoPlay playsInline />
    </div>
  )
}
