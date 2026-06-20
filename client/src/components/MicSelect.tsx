import type { ChangeEvent } from 'react'
import styles from './MicSelect.module.css'

interface Props {
  mics: MediaDeviceInfo[]
  currentId: string | null
  onSelect: (deviceId: string) => void
}

export function MicSelect({ mics, currentId, onSelect }: Props) {
  if (mics.length <= 1) return null
  return (
    <label className={styles.wrap}>
      <span className={styles.icon}>🎚️</span>
      <select
        className={styles.select}
        value={currentId ?? ''}
        onChange={(e: ChangeEvent<HTMLSelectElement>) => onSelect(e.target.value)}
      >
        {mics.map((m, i) => (
          <option key={m.deviceId || i} value={m.deviceId}>
            {m.label || `Microfone ${i + 1}`}
          </option>
        ))}
      </select>
    </label>
  )
}
