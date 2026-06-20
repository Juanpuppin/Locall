import type { UseCall } from '../hooks/useCall'
import type { CallState } from '../types'
import { useElapsed, formatDuration } from '../hooks/useElapsed'
import { useMicLevel } from '../hooks/useMicLevel'
import { Avatar, ControlTile, LevelMeter } from '../ui'
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
  const avatarStatus = connected ? 'live' : reconnecting ? 'warn' : 'idle'

  return (
    <div className={styles.call}>
      <Avatar name={call.remoteName} status={avatarStatus} />

      <div className={styles.who}>
        <div className={styles.name}>{call.remoteName ?? 'Sala'}</div>
        <div className={`${styles.status} ${reconnecting ? styles.warn : ''}`}>
          {connected ? formatDuration(elapsed) : STATUS[call.state]}
        </div>
        {connected && <QualityBadge quality={call.quality} />}
      </div>

      <div className={styles.controls}>
        <ControlTile
          icon={call.muted ? '🔇' : '🎙️'}
          label={call.muted ? 'Mudo' : 'Microfone'}
          variant={call.muted ? 'warning' : 'default'}
          pressed={call.muted}
          onClick={call.toggleMute}
          ariaLabel="Silenciar microfone"
        >
          <LevelMeter level={level} muted={call.muted} />
        </ControlTile>

        <ControlTile icon="📴" label="Desligar" variant="danger" onClick={call.leave} ariaLabel="Desligar" />
      </div>

      <MicSelect mics={call.mics} currentId={call.currentMicId} onSelect={call.selectMic} />
    </div>
  )
}
