import type { ChangeEvent, ReactNode } from 'react'
import styles from './Select.module.css'

export interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  icon?: ReactNode
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  ariaLabel?: string
}

/** Dropdown nativo com moldura retrô. */
export function Select({ icon, value, options, onChange, ariaLabel }: SelectProps) {
  return (
    <label className={styles.wrap}>
      {icon && <span className={styles.icon}>{icon}</span>}
      <select
        className={styles.select}
        value={value}
        aria-label={ariaLabel}
        onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
