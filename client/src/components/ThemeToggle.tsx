import { Button } from '../ui'

interface Props {
  theme: 'dark' | 'light'
  onToggle: () => void
}

export function ThemeToggle({ theme, onToggle }: Props) {
  return (
    <Button
      variant="window"
      size="icon"
      onClick={onToggle}
      aria-label="Alternar tema claro/escuro"
      title="Alternar tema"
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </Button>
  )
}
