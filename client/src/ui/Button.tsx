import type { ButtonHTMLAttributes } from 'react'
import styles from './Button.module.css'

type Variant = 'primary' | 'default' | 'danger' | 'warning' | 'window'
type Size = 'md' | 'lg' | 'icon'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  block?: boolean
}

/** Botão blocado retrô (borda reta + sombra dura). */
export function Button({
  variant = 'default',
  size = 'md',
  block = false,
  className,
  ...rest
}: ButtonProps) {
  const cls = [styles.btn, styles[variant], styles[size], block ? styles.block : '', className ?? '']
    .filter(Boolean)
    .join(' ')
  return <button className={cls} {...rest} />
}
