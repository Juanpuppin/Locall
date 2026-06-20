import type { ReactNode } from 'react'
import styles from './ControlTile.module.css'

interface ControlTileProps {
  icon: ReactNode
  label: ReactNode
  variant?: 'default' | 'danger' | 'warning'
  pressed?: boolean
  onClick?: () => void
  /** Conteúdo extra abaixo do rótulo (ex.: medidor de nível). */
  children?: ReactNode
  ariaLabel?: string
}

/** Botão grande em coluna (ícone + rótulo) para controles de chamada. */
export function ControlTile({
  icon,
  label,
  variant = 'default',
  pressed,
  onClick,
  children,
  ariaLabel,
}: ControlTileProps) {
  return (
    <button
      className={`${styles.tile} ${styles[variant]}`}
      onClick={onClick}
      aria-pressed={pressed}
      aria-label={ariaLabel}
    >
      <span className={styles.icon}>{icon}</span>
      <span className={styles.label}>{label}</span>
      {children}
    </button>
  )
}
