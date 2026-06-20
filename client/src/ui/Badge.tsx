import type { ReactNode } from 'react'
import styles from './Badge.module.css'

type Variant = 'good' | 'warn' | 'danger' | 'neutral'

interface BadgeProps {
  variant?: Variant
  dot?: boolean
  children: ReactNode
}

/** Etiqueta emoldurada com ponto de status opcional. */
export function Badge({ variant = 'neutral', dot = true, children }: BadgeProps) {
  return (
    <span className={`${styles.badge} ${styles[variant]}`}>
      {dot && <span className={styles.dot} />}
      {children}
    </span>
  )
}
