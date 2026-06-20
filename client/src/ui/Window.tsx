import {
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import styles from './Window.module.css'

type Accent = 'purple' | 'teal' | 'olive' | 'orange' | 'gold'

export interface Rect {
  x: number
  y: number
  w: number
  h: number | 'auto'
}

interface WindowProps {
  title: string
  icon?: ReactNode
  accent?: Accent
  draggable?: boolean
  resizable?: boolean
  maximizable?: boolean
  closable?: boolean
  /** Corpo sem padding (para conteúdo que preenche, ex.: vídeo). */
  flush?: boolean
  onClose?: () => void
  defaultRect: Rect
  minW?: number
  minH?: number
  /** Fornecido pelo desktop para trazer a janela à frente (z-index). */
  getNextZ?: () => number
  children: ReactNode
}

const EDGE = 44 // mantém a barra de título sempre acessível dentro do canvas

/** Janela arrastável/redimensionável com maximizar e fechar, posicionável no canvas. */
export function Window({
  title,
  icon = '◖',
  accent = 'purple',
  draggable = true,
  resizable = false,
  maximizable = resizable,
  closable = false,
  flush = false,
  onClose,
  defaultRect,
  minW = 240,
  minH = 160,
  getNextZ,
  children,
}: WindowProps) {
  const [rect, setRect] = useState<Rect>(defaultRect)
  const [maximized, setMaximized] = useState(false)
  const [z, setZ] = useState<number>(() => (getNextZ ? getNextZ() : 1))
  const prevRect = useRef<Rect>(defaultRect)
  const rootRef = useRef<HTMLElement>(null)

  const bringToFront = () => {
    if (getNextZ) setZ(getNextZ())
  }

  const startDrag = (e: ReactPointerEvent) => {
    if (maximized || !draggable) return
    if ((e.target as HTMLElement).closest('button')) return
    e.preventDefault()
    const sx = e.clientX
    const sy = e.clientY
    const r0 = rect
    const move = (ev: PointerEvent) => {
      const el = rootRef.current
      const parent = el?.offsetParent as HTMLElement | null
      setRect((cur) => {
        let x = r0.x + (ev.clientX - sx)
        let y = r0.y + (ev.clientY - sy)
        if (el && parent) {
          x = Math.min(Math.max(0, x), Math.max(0, parent.clientWidth - el.offsetWidth))
          y = Math.min(Math.max(0, y), Math.max(0, parent.clientHeight - EDGE))
        } else {
          x = Math.max(0, x)
          y = Math.max(0, y)
        }
        return { ...cur, x, y }
      })
    }
    const up = () => {
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerup', up)
    }
    document.addEventListener('pointermove', move)
    document.addEventListener('pointerup', up)
  }

  const startResize = (e: ReactPointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const sx = e.clientX
    const sy = e.clientY
    const startW = rect.w
    const startH = typeof rect.h === 'number' ? rect.h : rootRef.current?.offsetHeight ?? minH
    const move = (ev: PointerEvent) => {
      const parent = rootRef.current?.offsetParent as HTMLElement | null
      setRect((cur) => {
        let w = Math.max(minW, startW + (ev.clientX - sx))
        let h = Math.max(minH, startH + (ev.clientY - sy))
        if (parent) {
          w = Math.min(w, parent.clientWidth - cur.x)
          h = Math.min(h, parent.clientHeight - cur.y)
        }
        return { ...cur, w, h }
      })
    }
    const up = () => {
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerup', up)
    }
    document.addEventListener('pointermove', move)
    document.addEventListener('pointerup', up)
  }

  const toggleMax = () => {
    if (!maximized) {
      prevRect.current = rect
      setMaximized(true)
    } else {
      setMaximized(false)
      setRect(prevRect.current)
    }
  }

  const style: CSSProperties = maximized
    ? { left: 0, top: 0, right: 0, bottom: 0, zIndex: z }
    : {
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h === 'auto' ? undefined : rect.h,
        zIndex: z,
      }

  return (
    <section ref={rootRef} className={styles.window} style={style} onPointerDown={bringToFront}>
      <header
        className={`${styles.bar} ${styles[accent]}`}
        onPointerDown={startDrag}
        onDoubleClick={maximizable ? toggleMax : undefined}
      >
        <span className={styles.title}>
          {icon} {title}
        </span>
        <span className={styles.controls}>
          {maximizable && (
            <button
              className={styles.winbtn}
              onClick={toggleMax}
              aria-label={maximized ? 'Restaurar' : 'Maximizar'}
              title={maximized ? 'Restaurar' : 'Maximizar'}
            >
              {maximized ? '❐' : '▢'}
            </button>
          )}
          {closable && (
            <button className={styles.winbtn} onClick={onClose} aria-label="Fechar" title="Fechar">
              ✕
            </button>
          )}
        </span>
      </header>

      <div className={`${styles.body} ${flush ? styles.flush : ''}`}>{children}</div>

      {resizable && !maximized && <div className={styles.resize} onPointerDown={startResize} aria-hidden />}
    </section>
  )
}
