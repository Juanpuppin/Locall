import type { ReactNode } from 'react'
import styles from './Window.module.css'

interface WindowProps {
  /** Texto da barra de título (prefixado com o glifo ◖). */
  title: string
  /** Controles extras à direita da barra de título (ex.: alternador de tema). */
  controls?: ReactNode
  children: ReactNode
}

/** Moldura "janela" retrô: barra de título colorida + corpo. */
export function Window({ title, controls, children }: WindowProps) {
  return (
    <div className={styles.window}>
      <header className={styles.titlebar}>
        <span className={styles.title}>◖ {title}</span>
        <span className={styles.controls}>
          {controls}
          <span className={styles.winbtns} aria-hidden>
            ▭ ✕
          </span>
        </span>
      </header>
      <div className={styles.body}>{children}</div>
    </div>
  )
}
