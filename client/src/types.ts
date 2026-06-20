export type CallState =
  | 'idle'
  | 'requesting-mic'
  | 'waiting'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'ended'

export type Quality = 'good' | 'ok' | 'poor' | 'unknown'

export interface SignalMessage {
  type: 'offer' | 'answer' | 'ice' | 'recall' | 'hello' | 'bye'
  sdp?: RTCSessionDescriptionInit
  candidate?: RTCIceCandidateInit
  name?: string
}
