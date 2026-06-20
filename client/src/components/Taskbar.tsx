import type { ReactNode } from 'react'
import { Clock } from '../ui'
import { ThemeToggle } from './ThemeToggle'
import styles from './Taskbar.module.css'

export interface Launcher {
  key: string
  label: string
  icon: ReactNode
  active: boolean
  /** Em destaque: feature ativa mas com a janela minimizada (pede atenção). */
  attention?: boolean
  onClick: () => void
}

interface Props {
  theme: 'dark' | 'light'
  onToggle: () => void
  launchers: Launcher[]
}

/** Barra inferior: marca, lançadores de janelas e controles do sistema. */
export function Taskbar({ theme, onToggle, launchers }: Props) {
  return (
    <div className={styles.bar}>
      <span className={styles.brand}>◖ LOCALL</span>

      <div className={styles.launchers}>
        {launchers.map((l) => (
          <button
            key={l.key}
            className={[styles.launch, l.active ? styles.active : '', l.attention ? styles.attention : '']
              .filter(Boolean)
              .join(' ')}
            onClick={l.onClick}
            aria-pressed={l.active}
          >
            {l.attention && <span className={styles.live} aria-hidden>●</span>}
            <span className={styles.icon}>{l.icon}</span>
            <span className={styles.label}>{l.label}</span>
          </button>
        ))}
      </div>

      <div className={styles.right}>
        <Clock />
        <ThemeToggle theme={theme} onToggle={onToggle} />
      </div>
    </div>
  )
}
