import { useState, type ChangeEvent, type FormEvent } from 'react'
import type { UseCall } from '../hooks/useCall'
import styles from './JoinScreen.module.css'

export function JoinScreen({ call }: { call: UseCall }) {
  const [name, setName] = useState(() => localStorage.getItem('locall-name') ?? '')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const n = name.trim()
    if (!n) return
    localStorage.setItem('locall-name', n)
    void call.join(n)
  }

  return (
    <form className={styles.join} onSubmit={submit}>
      <div className={styles.hero}>
        <div className={styles.bigIcon}>📞</div>
        <h1 className={styles.title}>Locall</h1>
        <p className={styles.subtitle}>Chamada de voz pela sua rede de casa.</p>
      </div>

      {call.notice && <div className={styles.notice}>{call.notice}</div>}
      {call.error && <div className={styles.error}>{call.error}</div>}

      <label className={styles.label}>
        Seu nome
        <input
          className={styles.input}
          value={name}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
          placeholder="Como te chamam?"
          maxLength={24}
          autoComplete="name"
          autoFocus
        />
      </label>

      <button className={styles.cta} type="submit" disabled={!name.trim()}>
        Entrar na chamada
      </button>
    </form>
  )
}
