import styles from './LevelMeter.module.css'

const BARS = 5

interface LevelMeterProps {
  /** Nível 0..1. */
  level: number
  muted?: boolean
}

/** Medidor de nível em barras pixeladas. */
export function LevelMeter({ level, muted = false }: LevelMeterProps) {
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
