import type { ReactNode } from 'react'
import styles from './Avatar.module.css'

interface AvatarProps {
  /** Nome; a inicial é derivada dele. */
  name?: string | null
  status?: 'idle' | 'live' | 'warn'
  /** Exibido quando não há nome. */
  fallback?: ReactNode
}

/** Avatar quadrado emoldurado, com estado (ao vivo / instável). */
export function Avatar({ name, status = 'idle', fallback = '👤' }: AvatarProps) {
  const initial = name?.trim()?.[0]?.toUpperCase()
  return (
    <div className={`${styles.wrap} ${styles[status]}`}>
      <div className={styles.box}>{initial || fallback}</div>
    </div>
  )
}
