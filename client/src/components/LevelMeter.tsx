import styles from './LevelMeter.module.css'

const BARS = 5

export function LevelMeter({ level, muted }: { level: number; muted: boolean }) {
  return (
    <div className={styles.meter} aria-hidden>
      {Array.from({ length: BARS }).map((_, i) => {
        const on = !muted && level > (i + 0.4) / BARS
        return (
          <span
            key={i}
            className={`${styles.bar} ${on ? styles.on : ''}`}
            style={{ height: `${34 + i * 14}%` }}
          />
        )
      })}
    </div>
  )
}
