import type { UseCall } from '../hooks/useCall'
import type { CallState } from '../types'
import { useElapsed, formatDuration } from '../hooks/useElapsed'
import { useMicLevel } from '../hooks/useMicLevel'
import { LevelMeter } from './LevelMeter'
import { QualityBadge } from './QualityBadge'
import { MicSelect } from './MicSelect'
import styles from './CallScreen.module.css'

const STATUS: Record<CallState, string> = {
  idle: '',
  'requesting-mic': 'Pedindo acesso ao microfone…',
  waiting: 'Aguardando a outra pessoa entrar',
  connecting: 'Chamando…',
  connected: 'Conectado',
  reconnecting: 'Reconectando…',
  ended: '',
}

export function CallScreen({ call }: { call: UseCall }) {
  const elapsed = useElapsed(call.connectedAt)
  const level = useMicLevel(call.localStream, !call.muted)

  const connected = call.state === 'connected'
  const reconnecting = call.state === 'reconnecting'
  const initial = (call.remoteName?.trim()?.[0] ?? '').toUpperCase()
  const avatarText = call.remoteName ? initial : '👤'

  return (
    <div className={styles.call}>
      <div
        className={[
          styles.avatarWrap,
          connected ? styles.live : '',
          reconnecting ? styles.warn : '',
        ].join(' ')}
      >
        <div className={styles.avatar}>{avatarText}</div>
      </div>

      <div className={styles.who}>
        <div className={styles.name}>{call.remoteName ?? 'Sala'}</div>
        <div className={`${styles.status} ${reconnecting ? styles.statusWarn : ''}`}>
          {connected ? formatDuration(elapsed) : STATUS[call.state]}
        </div>
        {connected && <QualityBadge quality={call.quality} />}
      </div>

      <div className={styles.controls}>
        <button
          className={`${styles.ctrl} ${call.muted ? styles.muted : ''}`}
          onClick={call.toggleMute}
          aria-pressed={call.muted}
        >
          <span className={styles.ctrlIcon}>{call.muted ? '🔇' : '🎙️'}</span>
          <span className={styles.ctrlLabel}>{call.muted ? 'Mudo' : 'Microfone'}</span>
          <LevelMeter level={level} muted={call.muted} />
        </button>

        <button className={`${styles.ctrl} ${styles.hang}`} onClick={call.leave}>
          <span className={styles.ctrlIcon}>📴</span>
          <span className={styles.ctrlLabel}>Desligar</span>
        </button>
      </div>

      <MicSelect mics={call.mics} currentId={call.currentMicId} onSelect={call.selectMic} />
    </div>
  )
}
