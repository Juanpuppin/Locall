import type { Quality } from '../types'
import styles from './QualityBadge.module.css'

const MAP: Record<Quality, { label: string; cls: string }> = {
  good: { label: 'Boa conexão', cls: 'good' },
  ok: { label: 'Conexão ok', cls: 'ok' },
  poor: { label: 'Conexão ruim', cls: 'poor' },
  unknown: { label: 'Medindo…', cls: 'unknown' },
}

export function QualityBadge({ quality }: { quality: Quality }) {
  const q = MAP[quality]
  return (
    <div className={`${styles.badge} ${styles[q.cls]}`}>
      <span className={styles.dot} />
      {q.label}
    </div>
  )
}
