import { useState, type FormEvent } from 'react'
import type { UseCall } from '../hooks/useCall'
import { Alert, Brand, Button, TextField } from '../ui'
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
      <Brand tagline="Chamada de voz pela sua rede de casa." />

      {call.notice && <Alert variant="info">{call.notice}</Alert>}
      {call.error && <Alert variant="error">{call.error}</Alert>}

      <div className={styles.foot}>
        <TextField
          label="Seu nome"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Como te chamam?"
          maxLength={24}
          autoComplete="name"
          autoFocus
        />
        <Button variant="primary" size="lg" block type="submit" disabled={!name.trim()}>
          Entrar na chamada
        </Button>
      </div>
    </form>
  )
}
