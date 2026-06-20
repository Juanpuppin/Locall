import type { Quality } from '../types'
import { Badge } from '../ui'

const MAP: Record<Quality, { label: string; variant: 'good' | 'warn' | 'danger' | 'neutral' }> = {
  good: { label: 'Boa conexão', variant: 'good' },
  ok: { label: 'Conexão ok', variant: 'warn' },
  poor: { label: 'Conexão ruim', variant: 'danger' },
  unknown: { label: 'Medindo…', variant: 'neutral' },
}

export function QualityBadge({ quality }: { quality: Quality }) {
  const q = MAP[quality]
  return <Badge variant={q.variant}>{q.label}</Badge>
}
