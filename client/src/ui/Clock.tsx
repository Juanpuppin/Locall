import { useEffect, useState } from 'react'
import styles from './Clock.module.css'

/** Relógio HH:MM ao vivo, no estilo da barra de título do mockup. */
export function Clock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(t)
  }, [])
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  return (
    <span className={styles.clock}>
      {hh}:{mm}
    </span>
  )
}
