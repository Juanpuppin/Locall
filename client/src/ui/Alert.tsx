import type { ReactNode } from 'react'
import styles from './Alert.module.css'

interface AlertProps {
  variant?: 'error' | 'info'
  children: ReactNode
}

/** Caixa de aviso (erro sólido / informação tracejada). */
export function Alert({ variant = 'info', children }: AlertProps) {
  return (
    <div className={`${styles.alert} ${styles[variant]}`} role={variant === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  )
}
