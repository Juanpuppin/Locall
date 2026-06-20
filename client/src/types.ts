export type CallState =
  | 'idle'
  | 'requesting-mic'
  | 'waiting'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'ended'

export type Quality = 'good' | 'ok' | 'poor' | 'unknown'

/**
 * Mensagem de sinalização (perfect negotiation). Cada mensagem carrega um dos
 * campos: uma descrição SDP, um candidato ICE, o nome do participante (hello)
 * ou um aviso de saída (bye).
 */
export interface SignalMessage {
  description?: RTCSessionDescriptionInit
  candidate?: RTCIceCandidateInit
  name?: string
  bye?: boolean
}
