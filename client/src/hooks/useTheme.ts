import { useEffect, useState } from 'react'

type Theme = 'dark' | 'light'

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('locall-theme')
    if (saved === 'dark' || saved === 'light') return saved
    return 'light' // o visual Commodore 64 (Light) é o padrão do Locall
  })

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('locall-theme', theme)
  }, [theme])

  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  return { theme, toggle }
}
