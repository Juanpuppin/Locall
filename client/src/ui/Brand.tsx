import styles from './Brand.module.css'

interface BrandProps {
  tagline?: string
}

/** Marca do Locall (ícone + nome + tagline) para telas de abertura. */
export function Brand({ tagline }: BrandProps) {
  return (
    <div className={styles.brand}>
      <div className={styles.icon}>📞</div>
      <h1 className={styles.name}>Locall</h1>
      {tagline && <p className={styles.tagline}>{tagline}</p>}
    </div>
  )
}
