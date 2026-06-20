import { useCallback, useEffect, useRef, useState } from 'react'
import * as signaling from '../lib/signaling'
import type { ApiError } from '../lib/signaling'
import type { CallState, Quality, SignalMessage } from '../types'

const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
const statusOf = (e: unknown) => (e as ApiError)?.status

export interface UseCall {
  state: CallState
  remoteName: string | null
  muted: boolean
  quality: Quality
  connectedAt: number | null
  error: string | null
  notice: string | null
  mics: MediaDeviceInfo[]
  currentMicId: string | null
  localStream: MediaStream | null
  remoteStream: MediaStream | null
  join: (name: string) => Promise<void>
  leave: () => void
  toggleMute: () => void
  selectMic: (deviceId: string) => Promise<void>
}

export function useCall(): UseCall {
  const [state, setState] = useState<CallState>('idle')
  const [remoteName, setRemoteName] = useState<string | null>(null)
  const [muted, setMuted] = useState(false)
  const [quality, setQuality] = useState<Quality>('unknown')
  const [connectedAt, setConnectedAt] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [mics, setMics] = useState<MediaDeviceInfo[]>([])
  const [currentMicId, setCurrentMicId] = useState<string | null>(null)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const myIdRef = useRef<number | null>(null)
  const isOffererRef = useRef(false)
  const pollSessionRef = useRef(0)
  const pendingRef = useRef<RTCIceCandidateInit[]>([])
  const nameRef = useRef('')
  const mutedRef = useRef(false)
  const statsTimerRef = useRef<number | null>(null)

  const refreshMics = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      setMics(devices.filter((d) => d.kind === 'audioinput'))
    } catch {
      /* sem permissão ainda: labels virão depois do getUserMedia */
    }
  }, [])

  const sendSignal = useCallback((data: SignalMessage) => {
    const id = myIdRef.current
    if (id == null) return
    signaling.signal(id, data).catch((err) => console.warn('signal falhou:', err))
  }, [])

  const stopStats = useCallback(() => {
    if (statsTimerRef.current != null) {
      window.clearInterval(statsTimerRef.current)
      statsTimerRef.current = null
    }
  }, [])

  const startStats = useCallback(() => {
    stopStats()
    statsTimerRef.current = window.setInterval(async () => {
      const pc = pcRef.current
      if (!pc || pc.connectionState !== 'connected') return
      try {
        const stats = await pc.getStats()
        let rtt = -1
        let loss = -1
        stats.forEach((report) => {
          const r = report as unknown as {
            type: string
            state?: string
            currentRoundTripTime?: number
            kind?: string
            packetsLost?: number
            packetsReceived?: number
          }
          if (r.type === 'candidate-pair' && r.state === 'succeeded' && typeof r.currentRoundTripTime === 'number') {
            rtt = r.currentRoundTripTime
          }
          if (r.type === 'inbound-rtp' && r.kind === 'audio') {
            const lost = r.packetsLost ?? 0
            const recv = r.packetsReceived ?? 0
            if (recv > 0) loss = lost / (lost + recv)
          }
        })
        if (rtt < 0 && loss < 0) return
        let q: Quality = 'good'
        if ((rtt >= 0 && rtt > 0.3) || (loss >= 0 && loss > 0.08)) q = 'poor'
        else if ((rtt >= 0 && rtt > 0.15) || (loss >= 0 && loss > 0.03)) q = 'ok'
        setQuality(q)
      } catch {
        /* ignora amostra */
      }
    }, 2000)
  }, [stopStats])

  const drainCandidates = useCallback(async () => {
    const pc = pcRef.current
    if (!pc) return
    const list = pendingRef.current.splice(0)
    for (const c of list) await pc.addIceCandidate(c).catch(() => {})
  }, [])

  const stopMic = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setLocalStream(null)
  }, [])

  const createPeerConnection = useCallback(() => {
    pcRef.current?.close()
    pendingRef.current = []
    const pc = new RTCPeerConnection({ iceServers: [] }) // só rede local

    streamRef.current?.getTracks().forEach((t) => pc.addTrack(t, streamRef.current!))

    pc.onicecandidate = (ev) => {
      if (ev.candidate) sendSignal({ type: 'ice', candidate: ev.candidate.toJSON() })
    }
    pc.ontrack = (ev) => setRemoteStream(ev.streams[0])
    pc.onconnectionstatechange = () => {
      const st = pc.connectionState
      if (st === 'connected') {
        setState('connected')
        setConnectedAt((prev) => prev ?? Date.now())
        sendSignal({ type: 'hello', name: nameRef.current })
        startStats()
      } else if (st === 'failed') {
        setState('reconnecting')
        window.setTimeout(() => maybeRecover(), 1000)
      } else if (st === 'disconnected') {
        setState('reconnecting')
      }
    }

    pcRef.current = pc
    return pc
    // maybeRecover é estável (useCallback []), referência resolvida em runtime
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendSignal, startStats])

  const makeOffer = useCallback(async () => {
    const pc = createPeerConnection()
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    sendSignal({ type: 'offer', sdp: offer })
    sendSignal({ type: 'hello', name: nameRef.current })
    setState('connecting')
  }, [createPeerConnection, sendSignal])

  const maybeRecover = useCallback(() => {
    if (myIdRef.current == null) return
    if (pcRef.current && pcRef.current.connectionState === 'connected') return
    if (isOffererRef.current) makeOffer().catch(() => {})
    else sendSignal({ type: 'recall' })
  }, [makeOffer, sendSignal])

  const handleMessage = useCallback(
    async (msg: SignalMessage) => {
      if (myIdRef.current == null) return
      try {
        if (msg.type === 'offer') {
          const pc = createPeerConnection()
          await pc.setRemoteDescription(msg.sdp!)
          await drainCandidates()
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          sendSignal({ type: 'answer', sdp: answer })
          sendSignal({ type: 'hello', name: nameRef.current })
          setState('connecting')
        } else if (msg.type === 'answer') {
          const pc = pcRef.current
          if (!pc) return
          await pc.setRemoteDescription(msg.sdp!)
          await drainCandidates()
          setState('connecting')
        } else if (msg.type === 'ice') {
          const pc = pcRef.current
          if (pc && pc.remoteDescription && msg.candidate) {
            await pc.addIceCandidate(msg.candidate).catch(() => {})
          } else if (msg.candidate) {
            pendingRef.current.push(msg.candidate)
          }
        } else if (msg.type === 'hello') {
          if (msg.name) setRemoteName(msg.name)
        } else if (msg.type === 'recall') {
          if (isOffererRef.current) await makeOffer()
        } else if (msg.type === 'bye') {
          pcRef.current?.close()
          pcRef.current = null
          pendingRef.current = []
          setRemoteStream(null)
          setRemoteName(null)
          setConnectedAt(null)
          setQuality('unknown')
          stopStats()
          setState('waiting')
        }
      } catch (err) {
        console.error('erro na sinalização:', err)
      }
    },
    [createPeerConnection, drainCandidates, makeOffer, sendSignal, stopStats],
  )

  const teardown = useCallback(
    (endNotice: string | null) => {
      pollSessionRef.current++
      myIdRef.current = null
      isOffererRef.current = false
      pendingRef.current = []
      pcRef.current?.close()
      pcRef.current = null
      stopStats()
      stopMic()
      setRemoteStream(null)
      setRemoteName(null)
      setMuted(false)
      mutedRef.current = false
      setQuality('unknown')
      setConnectedAt(null)
      setNotice(endNotice)
      setState('ended')
    },
    [stopMic, stopStats],
  )

  const pollLoop = useCallback(async () => {
    const session = ++pollSessionRef.current
    while (session === pollSessionRef.current && myIdRef.current != null) {
      try {
        const { messages } = await signaling.poll(myIdRef.current)
        if (session !== pollSessionRef.current) return
        for (const m of messages) await handleMessage(m)
      } catch (err) {
        if (statusOf(err) === 410) {
          if (session === pollSessionRef.current) teardown('A conexão com o servidor caiu.')
          return
        }
        await sleep(2000) // rede oscilou; tenta de novo
      }
    }
  }, [handleMessage, teardown])

  const join = useCallback(
    async (name: string) => {
      setError(null)
      setNotice(null)
      nameRef.current = name.trim() || 'Alguém'
      setState('requesting-mic')

      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS })
      } catch {
        setError('Sem acesso ao microfone. Libere a permissão no navegador e tente de novo.')
        setState('idle')
        return
      }
      streamRef.current = stream
      setLocalStream(stream)
      setMuted(false)
      mutedRef.current = false
      void refreshMics()
      setCurrentMicId(stream.getAudioTracks()[0]?.getSettings().deviceId ?? null)

      let joined: signaling.JoinResult
      const deadline = Date.now() + 30000
      for (;;) {
        try {
          joined = await signaling.join(nameRef.current)
          break
        } catch (err) {
          if (statusOf(err) === 409 && Date.now() < deadline) {
            setError('A sala parece cheia — tentando entrar...')
            await sleep(3000)
            continue
          }
          setError(
            statusOf(err) === 409
              ? 'A sala já está cheia (2 pessoas).'
              : 'Não consegui falar com o servidor. Ele está rodando?',
          )
          stopMic()
          setState('idle')
          return
        }
      }

      setError(null)
      myIdRef.current = joined.id
      setConnectedAt(null)
      void pollLoop()

      if (joined.otherPresent) {
        isOffererRef.current = true
        setState('connecting')
        await makeOffer()
      } else {
        isOffererRef.current = false
        setState('waiting')
      }
    },
    [makeOffer, pollLoop, refreshMics, stopMic],
  )

  const leave = useCallback(() => {
    const id = myIdRef.current
    if (id != null) signaling.leave(id).catch(() => {})
    teardown('Você desligou.')
  }, [teardown])

  const toggleMute = useCallback(() => {
    const track = streamRef.current?.getAudioTracks()[0]
    if (!track) return
    track.enabled = !track.enabled
    mutedRef.current = !track.enabled
    setMuted(!track.enabled)
  }, [])

  const selectMic = useCallback(async (deviceId: string) => {
    try {
      const next = await navigator.mediaDevices.getUserMedia({
        audio: { ...AUDIO_CONSTRAINTS, deviceId: { exact: deviceId } },
      })
      const nextTrack = next.getAudioTracks()[0]
      nextTrack.enabled = !mutedRef.current

      const sender = pcRef.current?.getSenders().find((s) => s.track?.kind === 'audio')
      if (sender) await sender.replaceTrack(nextTrack)

      streamRef.current?.getAudioTracks().forEach((t) => t.stop())
      streamRef.current = next
      setLocalStream(next)
      setCurrentMicId(deviceId)
    } catch (err) {
      console.error('troca de microfone falhou:', err)
    }
  }, [])

  // Lista de microfones + atualização quando dispositivos mudam
  useEffect(() => {
    void refreshMics()
    const md = navigator.mediaDevices
    md.addEventListener?.('devicechange', refreshMics)
    return () => md.removeEventListener?.('devicechange', refreshMics)
  }, [refreshMics])

  // Reconecta ao voltar do bloqueio de tela / quando a rede volta
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') maybeRecover()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', maybeRecover)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', maybeRecover)
    }
  }, [maybeRecover])

  // Avisa o servidor ao fechar a aba
  useEffect(() => {
    const onHide = () => {
      const id = myIdRef.current
      if (id != null) navigator.sendBeacon('/api/leave', JSON.stringify({ id }))
    }
    window.addEventListener('pagehide', onHide)
    return () => window.removeEventListener('pagehide', onHide)
  }, [])

  return {
    state,
    remoteName,
    muted,
    quality,
    connectedAt,
    error,
    notice,
    mics,
    currentMicId,
    localStream,
    remoteStream,
    join,
    leave,
    toggleMute,
    selectMic,
  }
}
