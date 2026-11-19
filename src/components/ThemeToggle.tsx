import { useEffect, useState } from 'react'

// Tema claro/escuro. A escolha fica salva no aparelho de cada visitante;
// sem escolha salva, segue o modo do sistema (script em index.html aplica
// o tema antes da página aparecer, sem "piscar").
export type Theme = 'dark' | 'light'
const KEY = 'gner-theme'
const THEME_COLOR: Record<Theme, string> = { dark: '#0c0a09', light: '#ebe6dd' }

function current(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
}

export function applyTheme(t: Theme, save = true) {
  document.documentElement.dataset.theme = t
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[t])
  if (save) {
    try { localStorage.setItem(KEY, t) } catch { /* modo privado: só não salva */ }
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => (typeof document === 'undefined' ? 'dark' : current()))

  // acompanha o sistema enquanto o visitante não escolheu um tema
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const onChange = () => {
      let saved: string | null = null
      try { saved = localStorage.getItem(KEY) } catch { /* ignora */ }
      if (saved) return
      const t: Theme = mq.matches ? 'light' : 'dark'
      applyTheme(t, false)
      setTheme(t)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const next: Theme = theme === 'dark' ? 'light' : 'dark'
  const label = next === 'light' ? 'Ativar modo claro' : 'Ativar modo escuro'
  return (
    <button
      type="button"
      className="theme-btn"
      onClick={() => { applyTheme(next); setTheme(next) }}
      aria-label={label}
      title={label}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="theme-btn__icon">
        {theme === 'dark' ? (
          // sol: mostra para onde vai
          <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <circle cx="12" cy="12" r="4.2" />
            <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
          </g>
        ) : (
          <path fill="currentColor" d="M20.2 14.6A8.4 8.4 0 0 1 9.4 3.8a.6.6 0 0 0-.8-.7A9.6 9.6 0 1 0 20.9 15.4a.6.6 0 0 0-.7-.8Z" />
        )}
      </svg>
      <span className="theme-btn__txt">{next === 'light' ? 'Claro' : 'Escuro'}</span>
    </button>
  )
}
