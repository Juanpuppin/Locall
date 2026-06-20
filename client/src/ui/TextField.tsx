import type { InputHTMLAttributes } from 'react'
import styles from './TextField.module.css'

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

/** Campo de texto com rótulo, em estilo "afundado" (inset). */
export function TextField({ label, ...rest }: TextFieldProps) {
  return (
    <label className={styles.field}>
      {label && <span className={styles.label}>{label}</span>}
      <input className={styles.input} {...rest} />
    </label>
  )
}
