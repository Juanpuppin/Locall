import type { SignalMessage } from '../types'

export interface JoinResult {
  id: number
  otherPresent: boolean
}

export interface ApiError extends Error {
  status?: number
}

async function api<T>(path: string, body?: unknown): Promise<T> {
  const opts: RequestInit = body
    ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    : {}
  const resp = await fetch(path, opts)
  const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>
  if (!resp.ok) {
    const err = new Error((data.error as string) || `HTTP ${resp.status}`) as ApiError
    err.status = resp.status
    throw err
  }
  return data as T
}

export const join = (name: string) => api<JoinResult>('/api/join', { name })
export const poll = (id: number) => api<{ messages: SignalMessage[] }>(`/api/poll?id=${id}`)
export const signal = (id: number, data: SignalMessage) => api<{ ok: boolean }>('/api/signal', { id, data })
export const leave = (id: number) => api<{ ok: boolean }>('/api/leave', { id })
