import styles from './ThemeToggle.module.css'

interface Props {
  theme: 'dark' | 'light'
  onToggle: () => void
}

export function ThemeToggle({ theme, onToggle }: Props) {
  return (
    <button
      className={styles.toggle}
      onClick={onToggle}
      aria-label="Alternar tema claro/escuro"
      title="Alternar tema"
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  )
}
